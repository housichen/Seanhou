/* ============================================================
   Sean Hou — single-page scroll site
   - scroll spy drives nav theme + moving race-car indicator
   - nav clicks smooth-scroll to sections
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const sections = Array.from(document.querySelectorAll('.section'));
  const navLinks = Array.from(document.querySelectorAll('.nav-item'));

  /* ---------- 1. Scroll spy: which section is on screen ---------- */
  let ticking = false;
  let currentId = null;

  function applyActive(active) {
    const id = active.id;
    if (id === currentId) return;
    currentId = id;
    body.dataset.active = id;
    body.dataset.theme = active.dataset.theme || 'dark';

    navLinks.forEach((link) => {
      link.setAttribute(
        'aria-current',
        link.dataset.target === id ? 'true' : 'false'
      );
    });
  }

  function updateActive() {
    // A section becomes active once its top passes ~38% of the viewport
    const trigger = window.scrollY + window.innerHeight * 0.38;
    let active = sections[0];

    for (const section of sections) {
      if (section.offsetTop <= trigger) active = section;
    }
    applyActive(active);
    ticking = false;
  }

  /* ---------- 1b. Home: scroll cue fades on the way down ---------- */
  const scrollHint = document.querySelector('.scroll-hint');
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  function updateHomeMotion() {
    if (scrollHint) {
      scrollHint.classList.toggle('is-hidden', window.scrollY > 300);
    }
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          updateActive();
          if (!reduceMotion) updateHomeMotion();
        });
      }
    },
    { passive: true }
  );

  window.addEventListener('resize', updateActive);
  window.addEventListener('load', updateActive);
  updateActive();
  if (!reduceMotion) updateHomeMotion();

  // IntersectionObserver: fires reliably even after programmatic/hash jumps
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) applyActive(entry.target);
        });
      },
      { rootMargin: '-38% 0px -62% 0px', threshold: 0 }
    );
    sections.forEach((section) => spy.observe(section));
  }

  /* ---------- 1c. Section reveals: content eases in as sections arrive ---------- */
  // Each group animates together with a small internal stagger; final
  // resting state is transform:none / opacity:1, so layout is never altered.
  const revealGroups = [
    // ABOUT — header + the three roles
    ['.sec-about .side-bar|bar', '.sec-about .section-label',
     '.sec-about .dash-1|rule', '.sec-about .dash-2|rule', '.sec-about .heading'],
    ['.sec-about .role-1', '.sec-about .bio-1', '.sec-about .photo-1|img',
     '.sec-about .divider-1|rule'],
    ['.sec-about .role-2', '.sec-about .bio-2', '.sec-about .photo-2|img',
     '.sec-about .divider-2|rule'],
    ['.sec-about .role-3', '.sec-about .bio-3', '.sec-about .photo-3|img'],
    // PROJECT — intro block, then gallery rows
    ['.sec-project .p-bar-1|bar', '.sec-project .p-title',
     '.sec-project .p-hero|img'],
    ['.sec-project .p-desc', '.sec-project .p-line-1|rule'],
    ['.sec-project .p-bar-2|bar', '.sec-project .p-works',
     '.sec-project .p-cityscape'],
    ['.work.c1|img', '.work.c2|img', '.work.c3|img', '.work.c4|img'],
    ['.work.c5|img', '.work.c6|img', '.work.c7|img', '.work.c8|img'],
    ['.work.cw-1|img', '.work.cw-2|img'],
    ['.sec-project .p-line-2|rule', '.sec-project .p-line-3|rule',
     '.sec-project .p-cars'],
    ['.car-01|img', '.car-02|img', '.car-03|img', '.car-04|img'],
    ['.car-05|img', '.car-06|img', '.car-07|img', '.car-08|img'],
    ['.car-09|img', '.car-10|img', '.car-11|img', '.car-12|img'],
    ['.car-13|img', '.car-14|img', '.car-15|img', '.car-16|img'],
    // CONTACT — one block
    ['.contact-content']
  ];

  if (!reduceMotion && 'IntersectionObserver' in window) {
    revealGroups.forEach((tokens) => {
      const els = tokens
        .map((token) => {
          const [sel, type] = token.split('|');
          const el = document.querySelector(sel);
          if (el) el.classList.add('rv', type ? 'rv-' + type : 'rv-up');
          return el;
        })
        .filter(Boolean);

      els.forEach((el, i) => {
        el.style.transitionDelay = i * 80 + 'ms';
      });

      const reveal = () => {
        els.forEach((el) => el.classList.add('rv-in'));
      };

      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            reveal();
            io.disconnect();
          }
        },
        // start slightly before the group scrolls into view
        { rootMargin: '0px 0px 12% 0px', threshold: 0.01 }
      );
      els.forEach((el) => io.observe(el));
    });
  }

  /* ---------- 1d. Ceremonial curtain: intro → My Works ---------- */
  // Plays when the works boundary crosses the viewport centre on the way down.
  // Uses threshold edge-detection (not a thin IntersectionObserver target),
  // so fast wheel/fling scrolls and instant jumps can never skip the trigger.
  // Scroll back up past the re-arm line and enter again to replay. A page
  // loaded deep inside the gallery does not pop the curtain.
  const curtain = document.getElementById('worksCurtain');
  const sentinel = document.querySelector('.works-sentinel');

  if (curtain && sentinel && !reduceMotion) {
    let lastPlay = 0;
    let ticking = false;
    let armed = false;
    let userActive = false;
    let navScrolling = false; // suppress curtain during nav-triggered smooth scroll
    // 'below' = boundary still under the centre line (curtain armed)
    // 'above' = already past the line (disarmed until re-arm on scroll-up)
    let side = 'below';

    // Sync state to wherever the page currently is. Called after the browser
    // finishes anchor jumps / scroll restoration AND when the first real user
    // gesture happens, so those programmatic scrolls never spend the curtain.
    const arm = () => {
      armed = true;
      side = sentinel.getBoundingClientRect().top > window.innerHeight * 0.5 ? 'below' : 'above';
    };
    const markUser = () => {
      if (!userActive) {
        userActive = true;
        arm();
      }
    };
    window.addEventListener('load', () => setTimeout(arm, 0));
    setTimeout(arm, 1200); // fallback if load already passed
    // Only real scroll gestures arm the curtain — pointerdown (nav clicks) excluded
    ['wheel', 'touchmove', 'keydown'].forEach((ev) => {
      window.addEventListener(ev, markUser, { passive: true, capture: true });
    });

    const cwKicker = curtain.querySelector('.cw-kicker');
    const cwTitle = curtain.querySelector('.cw-title');
    let activeAnims = [];

    /* ----- scroll lock during the curtain ----- */
    // While the curtain plays, the page must not scroll — otherwise the user
    // lands somewhere past My Works when the sweep ends. We hide overflow and
    // swallow wheel/touch/key scrolls, then snap to the My Works sentinel
    // while the panel still covers the screen, and release on finish.
    let scrollLocked = false;
    const blockScroll = (e) => { if (scrollLocked) e.preventDefault(); };
    const lockScroll = () => {
      if (scrollLocked) return;
      scrollLocked = true;
      document.body.style.overflow = 'hidden';
      window.addEventListener('wheel', blockScroll, { passive: false });
      window.addEventListener('touchmove', blockScroll, { passive: false });
      window.addEventListener('keydown', blockScrollKeys, { passive: false });
    };
    const blockScrollKeys = (e) => {
      if (!scrollLocked) return;
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
      }
    };
    const unlockScroll = () => {
      if (!scrollLocked) return;
      scrollLocked = false;
      document.body.style.overflow = '';
      window.removeEventListener('wheel', blockScroll);
      window.removeEventListener('touchmove', blockScroll);
      window.removeEventListener('keydown', blockScrollKeys);
    };

    // Fresh WAAPI objects every time — the panel sweep and BOTH word lines
    // are created together, so a replay can never show lime without the words.
    const playCurtain = () => {
      const now = Date.now();
      if (now - lastPlay < 2200) return; // ignore bounce within one sweep
      lastPlay = now;
      clearTimeout(curtain._hideTimer);
      clearTimeout(curtain._snapTimer);
      clearTimeout(curtain._unlockTimer);

      activeAnims.forEach((a) => a.cancel());
      activeAnims = [];
      curtain.style.transform = '';
      if (cwKicker) { cwKicker.style.opacity = ''; cwKicker.style.transform = ''; }
      if (cwTitle) { cwTitle.style.opacity = ''; cwTitle.style.transform = ''; }
      curtain.style.display = '';
      void curtain.offsetWidth; // start every play from the resting state

      // Lock the page the instant the curtain fires so the user can't scroll
      // past the trigger while the sweep is playing.
      lockScroll();

      // While the lime panel fully covers the viewport, snap the page to the
      // My Works sentinel. The jump is hidden behind the curtain, so when it
      // lifts the user is exactly at the start of the works gallery.
      curtain._snapTimer = setTimeout(() => {
        const target = sentinel.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, target);
      }, 740);

      // Panel: per-segment easing for buttery-smooth motion.
      //   0 → 0.38 : slide up   (ease-out-expo — gentle deceleration)
      //   0.38 → 0.62 : hold   (linear — steady reveal)
      //   0.62 → 1    : exit    (ease-in-expo — smooth acceleration away)
      activeAnims = [
        curtain.animate(
          [
            { transform: 'translateY(101%)', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
            { transform: 'translateY(0)', offset: 0.38, easing: 'linear' },
            { transform: 'translateY(0)', offset: 0.62, easing: 'cubic-bezier(0.7, 0, 0.84, 0)' },
            { transform: 'translateY(-101%)', offset: 1 }
          ],
          { duration: 2000, fill: 'forwards' }
        ),
        // Kicker fades in just as the panel settles (panel arrives at 760ms).
        cwKicker && cwKicker.animate(
          [
            { opacity: 0, transform: 'translateY(18px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ],
          { duration: 520, delay: 660, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
        ),
        // Title follows the kicker with a slight stagger, same smooth curve.
        cwTitle && cwTitle.animate(
          [
            { opacity: 0, transform: 'translateY(26px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ],
          { duration: 640, delay: 760, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
        )
      ].filter(Boolean);

      curtain._hideTimer = setTimeout(() => {
        curtain.style.display = 'none';
      }, 2050);

      // Release the scroll lock right after the curtain fully lifts, so the
      // user can continue scrolling from the My Works position.
      curtain._unlockTimer = setTimeout(unlockScroll, 2100);
    };

    const checkCurtain = (deltaY) => {
      ticking = false;
      if (!armed || !userActive || navScrolling) return;
      const line = window.innerHeight * 0.5;
      const top = sentinel.getBoundingClientRect().top;
      if (deltaY > 0 && side === 'below' && top <= line) {
        playCurtain();
        side = 'above';
      } else if (deltaY < 0 && side === 'above' && top >= line + 200) {
        side = 'below'; // re-arm once clearly below the line again
      }
    };

    // expose so nav-click handler can suppress the curtain
    window.__suppressWorksCurtain = (ms) => {
      navScrolling = true;
      clearTimeout(window.__suppressWorksCurtain._t);
      window.__suppressWorksCurtain._t = setTimeout(() => { navScrolling = false; }, ms);
    };

    let lastY = window.scrollY;
    window.addEventListener(
      'scroll',
      () => {
        const y = window.scrollY;
        const deltaY = y - lastY;
        lastY = y;
        if (deltaY === 0 || !userActive) return; // ignore non-gesture scroll noise
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(() => checkCurtain(deltaY));
        }
      },
      { passive: true }
    );
  } else if (curtain) {
    curtain.style.display = 'none';
  }

  /* ---------- 1e. Bilingual UI dictionary ---------- */
  let currentLang = document.documentElement.lang === 'zh' ? 'zh' : 'en';

  const I18N = {
    en: {
      'nav-home': 'Home', 'nav-about': 'About', 'nav-project': 'Project',
      'nav-contact': 'Contact', 'scroll': 'Scroll',
      'about-label': 'ABOUT ME', 'about-heading': 'Who I Am',
      'role-1': 'PHOTOGRAPHER', 'role-2': 'CAPTAIN', 'role-3': 'Teacher',
      'bio-1': "I'm Sean Hou, a Grade 9 student based in Beijing. I'm a person who loves being behind the camera — not just taking photos, but actually walking through a city at sunrise, waiting for the right light, and trying to capture how a place feels.<br /><br /><br />",
      'bio-2': "<br /><br />I'm also captain of my middle school flag football team. Being a captain has taught me more than just plays and strategies — it's taught me how to communicate, how to keep a team calm under pressure.<br />",
      'bio-3': 'The project is to let us become a "teacher" and go to teach the kids in mountainous areas of Guizhou, and the kids are all stay-at-home children. I went to teach twice — the first time was in 2024, when my mom made me go, and the second time was in 2026, when I went because I wanted to.',
      'p-title': 'Photography',
      'p-desc': 'We were exposed to photography during an ELP in Grade 7. <br />While completing this ELP, I fell in love with photography. So in the following year, I devoted a lot to this.',
      'p-works': 'My Works', 'p-cityscape': 'City Scape', 'p-cars': 'Cars',
      'cw-kicker': 'PHOTOGRAPHY · 02', 'cw-title': 'My Works',
      'contact-kicker': 'SAY HELLO', 'contact-title': 'Contact Me',
      'contact-based': 'Based in', 'contact-city': 'Beijing, China',
      'contact-email': 'Email',
      'form-name': 'Name', 'form-email': 'Email', 'form-message': 'Message',
      'ph-name': 'Your name', 'ph-message': 'Write something...',
      'form-send': 'Send Message',
      'pv-label': 'Introduction',
      'aria-lang': 'Switch language', 'aria-pv': 'Photo detail',
      'aria-pv-close': 'Close detail view',
      'aria-pv-prev': 'Previous photo', 'aria-pv-next': 'Next photo',
      'alt-home': 'Sean Hou with a camera',
      'alt-camera': 'Camera shooting the Shanghai skyline at night',
      'alt-captain': 'Flag football player making a catch',
      'alt-teacher': 'Sean teaching in a Guizhou classroom',
      'alt-hero': 'Photography work',
      'alt-city-2': "Jing'an Temple at dusk",
      'alt-city-3': 'Oriental Pearl Tower close-up',
      'alt-city-7': 'Office towers reflected at night',
      'alt-city-1': 'Oriental Pearl Tower over light trails',
      'alt-city-8': 'Three Shanghai skyscrapers',
      'alt-city-wide': 'Twin towers over highway light trails',
      'alt-city-6': 'Old Hu Barbershop on a quiet Chengdu lane at night',
      'alt-city-5': 'Teal light pillars of the Tower of Vitality',
      'alt-wide-1': 'Tianfu Art Museum reflected in the water at blue hour',
      'alt-wide-2': 'The Bund skyline at night',
      'meta-loc': 'Location: ', 'meta-time': 'Time: ',
      'meta-equip': 'Equipment: ', 'meta-params': 'Parameters: ',
      'err-required': 'Please fill in all fields before sending.',
      'err-email': 'Please enter a valid email address.',
      'success': function (name) {
        return 'Thanks, ' + name + '! Your message has been noted. (Demo only — connect a backend to actually send it.)';
      }
    },
    zh: {
      'nav-home': '首页', 'nav-about': '关于', 'nav-project': '作品',
      'nav-contact': '联系', 'scroll': '向下滚动',
      'about-label': '关于我', 'about-heading': '我是谁',
      'role-1': '摄影师', 'role-2': '队长', 'role-3': '老师',
      'bio-1': '我是 Sean Hou，一名在北京上学的九年级学生。我喜欢站在镜头后面——不只是按下快门，而是在日出时穿街走巷，等待最合适的那束光，试着捕捉一个地方给人的感觉。<br /><br /><br />',
      'bio-2': '<br /><br />我还是学校腰旗橄榄球队的队长。当队长教会我的不只是战术与配合，还有如何沟通，如何让全队在压力下保持冷静。<br />',
      'bio-3': '这个项目让我们变身成为“老师”，去贵州山区给孩子们上课，那些孩子大多是留守儿童。我去过两次：第一次是 2024 年，妈妈让我去的；第二次是 2026 年，这一次是我自己想去的。',
      'p-title': '摄影',
      'p-desc': '七年级时，我们在一次 ELP 拓展学习中接触到了摄影。<br />在完成那次 ELP 的过程中，我爱上了摄影。于是接下来的一年，我为它投入了很多。',
      'p-works': '我的作品', 'p-cityscape': '城市风光', 'p-cars': '赛车',
      'cw-kicker': '摄影 · 02', 'cw-title': '我的作品',
      'contact-kicker': '打个招呼', 'contact-title': '联系我',
      'contact-based': '所在地', 'contact-city': '中国北京',
      'contact-email': '邮箱',
      'form-name': '姓名', 'form-email': '邮箱', 'form-message': '留言',
      'ph-name': '你的名字', 'ph-message': '写点什么……',
      'form-send': '发送留言',
      'pv-label': '作品介绍',
      'aria-lang': '切换语言', 'aria-pv': '照片详情',
      'aria-pv-close': '关闭详情',
      'aria-pv-prev': '上一张', 'aria-pv-next': '下一张',
      'alt-home': '拿着相机的 Sean Hou',
      'alt-camera': '夜晚拍摄上海天际线的相机',
      'alt-captain': '正在接球的腰旗橄榄球运动员',
      'alt-teacher': 'Sean 在贵州的教室里给孩子们上课',
      'alt-hero': '摄影作品',
      'alt-city-2': '黄昏时分的静安寺',
      'alt-city-3': '东方明珠塔特写',
      'alt-city-7': '夜色中相互倒映的写字楼',
      'alt-city-1': '光轨尽头的东方明珠塔',
      'alt-city-8': '上海三座超高层摩天楼',
      'alt-city-wide': '公路光轨上方的双子塔',
      'alt-city-6': '成都老巷里的老胡理发店',
      'alt-city-5': '生机之塔的青色光柱',
      'alt-wide-1': '蓝调时刻水面倒映的天府美术馆',
      'alt-wide-2': '夜晚的外滩天际线',
      'meta-loc': '地点：', 'meta-time': '时间：',
      'meta-equip': '器材：', 'meta-params': '拍摄参数：',
      'err-required': '请把所有字段填好再发送哦。',
      'err-email': '请输入有效的邮箱地址。',
      'success': function (name) {
        return '谢谢你，' + name + '！你的留言我已经收到。（目前是演示版本，接入后端后才能真正发送。）';
      }
    }
  };

  function t(key) {
    return I18N[currentLang][key];
  }

  function setLanguage(lang) {
    currentLang = lang === 'zh' ? 'zh' : 'en';
    document.documentElement.lang = currentLang;
    const dict = I18N[currentLang];

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const val = dict[el.dataset.i18n];
      if (typeof val === 'string') el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const val = dict[el.dataset.i18nHtml];
      if (typeof val === 'string') el.innerHTML = val;
    });
    document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      const val = dict[el.dataset.i18nAlt];
      if (typeof val === 'string') el.alt = val;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      const val = dict[el.dataset.i18nPh];
      if (typeof val === 'string') el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const val = dict[el.dataset.i18nAria];
      if (typeof val === 'string') el.setAttribute('aria-label', val);
    });

    try { localStorage.setItem('lang', currentLang); } catch (e) {}

    // refresh the open photo card in the new language
    if (body.classList.contains('pv-open')) renderPhoto(pvCurrent);
  }

  /* ---------- 1f. Photo detail viewer ---------- */
  // Real EXIF was preserved on three files; the Bund card uses Sean's notes.
  // The other cards are drafts (original metadata was stripped on export) and
  // can be edited right here in one place. Every card is bilingual.
  const KIT = 'Nikon Z5 II + Tamron 18-300mm';

  // p = exposure: f (aperture), s (shutter), iso, focal (optional)
  const PHOTO_DATA = {
    'city-2.jpg': {
      loc: { en: "Jing'an Temple, Shanghai", zh: '上海 · 静安寺' },
      time: { en: 'Dusk, 2026', zh: '2026 年 · 黄昏' },
      p: { f: 'f/8', s: '1/125s', iso: 200, focal: '55mm' },
      intro: {
        en: "A golden temple standing between glass skyscrapers. I waited for the blue hour so the old roof and the modern towers would share the same light.",
        zh: '金色古寺夹在玻璃高楼之间。我等到蓝调时刻才按下快门，让古老的屋顶和现代塔楼共享同一种光。'
      }
    },
    'city-3.jpg': {
      loc: { en: 'Lujiazui, Shanghai', zh: '上海 · 陆家嘴' },
      time: { en: 'Overcast afternoon, 2026', zh: '2026 年 · 阴天午后' },
      p: { f: 'f/8', s: '1/500s', iso: 100, focal: '200mm' },
      intro: {
        en: 'A close study of the Oriental Pearl Tower. I used the long end of the zoom to flatten the sphere and fill the frame with its pattern.',
        zh: '对东方明珠球体的一次特写练习。我用长焦端压缩空间，让球体的结构纹理填满整个画面。'
      }
    },
    'city-7.jpg': {
      loc: { en: 'Bund Financial Center, Shanghai', zh: '上海 · 外滩金融中心' },
      time: { en: 'Night, 2026', zh: '2026 年 · 夜晚' },
      p: { f: 'f/11', s: '8s', iso: 100, focal: '35mm' },
      intro: {
        en: 'The orange frames of the riverside buildings doubled in the still water, so I composed with the reflection as the real subject.',
        zh: '江边建筑的橙色框架在静水中成倍倒映，于是我把倒影当作真正的主角来构图。'
      }
    },
    'city-1.jpg': {
      loc: { en: 'Shanghai, overlooking the Oriental Pearl Tower', zh: '上海 · 远眺东方明珠' },
      time: { en: 'July 1, 2026, 7:08 AM', zh: '2026 年 7 月 1 日 早上 7:08' },
      p: { f: 'f/20', s: '25s', iso: 50, focal: '18mm' },
      intro: {
        en: 'A 25-second exposure on an elevated road at dawn. The small aperture turned the traffic into long light trails that lead the eye straight toward the tower.',
        zh: '黎明时分在高架上拍的 25 秒长曝光。小光圈把车流拉成光轨，视线一路被引向明珠塔。'
      }
    },
    'city-8.jpg': {
      loc: { en: 'Lujiazui, Shanghai', zh: '上海 · 陆家嘴' },
      time: { en: 'Blue hour, 2026', zh: '2026 年 · 蓝调时刻' },
      p: { f: 'f/8', s: '1/100s', iso: 200, focal: '35mm' },
      intro: {
        en: 'The three towers of Lujiazui stacked into one vertical frame during the short blue-hour window, when the sky still holds color behind the lights.',
        zh: '在短暂的蓝调时刻，陆家嘴三座高楼叠进同一个竖向画面——此时灯火亮起，天空还留着颜色。'
      }
    },
    'city-wide.jpg': {
      loc: { en: 'Central, Hong Kong', zh: '香港 · 中环' },
      time: { en: 'Night, 2026', zh: '2026 年 · 夜晚' },
      p: { f: 'f/8', s: '1/15s', iso: 800, focal: '18mm' },
      intro: {
        en: 'Shot handheld from an elevated walkway. I slowed the shutter just enough to let the traffic carve light curves through the towers.',
        zh: '在人行天桥上手持拍摄。我把快门放慢到刚好让车灯在楼宇之间划出光的曲线。'
      }
    },
    'city-6.jpg': {
      loc: { en: 'Old Hu Barbershop, Chengdu', zh: '成都 · 老胡理发店' },
      time: { en: 'Night, September 21, 2026', zh: '2026 年 9 月 21 日 夜晚' },
      p: { f: 'f/13', s: '30s', iso: 100, focal: '18mm' },
      intro: {
        en: 'A 30-second long exposure outside Old Hu Barbershop in an old Chengdu lane. The long shutter emptied the quiet street and stretched a single light trail through the frame, while the old shopfront kept glowing.',
        zh: '在成都老巷的老胡理发店门口拍的 30 秒长曝光。长快门让安静的街道空无一人，只把一道车灯轨迹拉长穿过画面，老店面则一直亮着。'
      }
    },
    'city-5.jpg': {
      loc: { en: 'Tower of Vitality, Chengdu', zh: '成都 · 生机之塔' },
      time: { en: 'Night, September 21, 2026', zh: '2026 年 9 月 21 日 夜晚' },
      p: { f: 'f/3.5', s: '10s', iso: 100, focal: '18mm' },
      intro: {
        en: 'The light pillars of the Tower of Vitality rise into the Chengdu night. A ten-second exposure let the columns glow, and the silhouette at the bottom gives the installation a sense of scale.',
        zh: '生机之塔的光柱直插成都的夜空。10 秒曝光让柱体充分发光，底部的人影剪影给了这座装置一个尺度参照。'
      }
    },
    'wide-1.jpg': {
      loc: { en: 'Tianfu Art Museum, Chengdu', zh: '成都 · 天府美术馆' },
      time: { en: 'Blue hour, September 2026', zh: '2026 年 9 月 · 蓝调时刻' },
      p: { f: 'f/11', s: '13s', iso: 100, focal: '24mm' },
      intro: {
        en: 'A thirteen-second exposure smoothed the water into a mirror for the Tianfu Art Museum. I timed it for blue hour so the warm facade and the cool sky would balance.',
        zh: '13 秒长曝光把水面磨成镜子，映出天府美术馆。我特意等到蓝调时刻，让暖色的建筑立面与冷色天空刚好平衡。'
      }
    },
    'wide-2.jpg': {
      loc: { en: 'Shanghai Bund Park', zh: '上海 · 外滩公园' },
      time: { en: '4:00 AM on July 4, 2026', zh: '2026 年 7 月 4 日 凌晨 4:00' },
      kit: 'Nikon z52 + Tamron 18-300mm',
      p: { f: 'f/11', s: '25s', iso: 100 },
      intro: {
        en: 'This picture is very remarkable to me because before taking it I studied many courses on how to take this picture. Taking pictures at 4:00 is because at that time the park was empty, so the picture is clean, and the lights in the CBD of Shanghai on the opposite bank have very beautiful colors.',
        zh: '这张照片对我意义很大：拍它之前，我专门看了很多教程学习怎么拍。凌晨 4 点出门，是因为那时公园里没有人，画面干净，而且对岸上海 CBD 的灯光颜色特别漂亮。'
      }
    }
  };

  // 16 GT3 panning frames share one story.
  const CAR_DATA = {
    loc: { en: 'GT3 Cup — street circuit, China', zh: 'GT3 杯赛 · 中国街道赛' },
    time: { en: 'October 4, 2026', zh: '2026 年 10 月 4 日' },
    p: { f: 'f/8', s: '1/60s', iso: 100, focal: '300mm' },
    intro: {
      en: 'A panning shot from the fence: I followed the GT3 car through its pass at a slow shutter speed so the background streaks while the car stays sharp — that contrast is what sells the speed.',
      zh: '护栏边的追焦拍摄：我用较慢的快门跟着驶过的 GT3 赛车转动镜头，让背景拉成线条、车身保持清晰——这种对比正是速度感的来源。'
    }
  };

  function formatParams(p, lang) {
    if (lang === 'zh') {
      let s = '光圈 ' + p.f + '，快门 ' + p.s + '，ISO ' + p.iso;
      if (p.focal) s += '，焦距 ' + p.focal;
      return s;
    }
    let s = 'Aperture ' + p.f + ', Shutter speed ' + p.s + ', ISO ' + p.iso;
    if (p.focal) s += ', Focal length ' + p.focal;
    return s;
  }

  const gallery = Array.from(document.querySelectorAll('.work, .car'));
  const pv = document.getElementById('photoViewer');
  const pvImg = document.getElementById('pvImg');
  const pvMeta = document.getElementById('pvMeta');
  const pvBody = document.getElementById('pvBody');
  const pvIndex = document.getElementById('pvIndex');
  const pvClose = document.getElementById('pvClose');
  const pvPrev = document.getElementById('pvPrev');
  const pvNext = document.getElementById('pvNext');

  let pvCurrent = 0;

  function photoData(img) {
    const file = img.src.split('/').pop();
    return PHOTO_DATA[file] || CAR_DATA;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function renderPhoto(index) {
    pvCurrent = (index + gallery.length) % gallery.length;
    const thumb = gallery[pvCurrent];
    const d = photoData(thumb);
    const file = thumb.src.split('/').pop();
    const lang = currentLang;

    pv.classList.remove('pv-in', 'pv-portrait');
    pvIndex.textContent = pad2(pvCurrent + 1) + ' / ' + pad2(gallery.length);
    pvMeta.innerHTML =
      t('meta-loc') + d.loc[lang] + '<br />' +
      t('meta-time') + d.time[lang] + '<br />' +
      t('meta-equip') + (d.kit || KIT) + '<br />' +
      t('meta-params') + formatParams(d.p, lang);
    pvBody.textContent = d.intro[lang];
    pvImg.alt = thumb.alt || '';

    const reveal = () => {
      // portrait frames (taller than wide) get the side-by-side layout
      pv.classList.toggle('pv-portrait', pvImg.naturalHeight > pvImg.naturalWidth);
      // restart the entrance transition
      void pv.offsetWidth;
      pv.classList.add('pv-in');
    };

    pvImg.onload = reveal;
    pvImg.src = 'images/large/' + file;
    if (pvImg.complete && pvImg.naturalWidth > 0) reveal();
  }

  function openPhoto(index) {
    renderPhoto(index);
    body.classList.add('pv-open');
    pv.setAttribute('aria-hidden', 'false');
    pvClose.focus();
  }

  function closePhoto() {
    body.classList.remove('pv-open');
    pv.setAttribute('aria-hidden', 'true');
    pv.scrollTop = 0;
    pv.classList.remove('pv-in');
  }

  gallery.forEach((img, i) => {
    img.addEventListener('click', () => openPhoto(i));
  });

  pvClose.addEventListener('click', closePhoto);
  pv.addEventListener('click', (event) => {
    if (event.target === pv) closePhoto();
  });
  pvPrev.addEventListener('click', () => renderPhoto(pvCurrent - 1));
  pvNext.addEventListener('click', () => renderPhoto(pvCurrent + 1));

  /* ---------- 1g. Language switch ---------- */
  const langBtn = document.getElementById('langBtn');

  function applyInitialLanguage() {
    // head script may have restored <html lang> from localStorage;
    // render every string to match (no-opt on the default English page)
    if (currentLang !== 'en') setLanguage(currentLang);
  }

  if (langBtn) {
    langBtn.addEventListener('click', () => {
      setLanguage(currentLang === 'en' ? 'zh' : 'en');
    });
  }

  applyInitialLanguage();

  document.addEventListener('keydown', (event) => {
    if (!body.classList.contains('pv-open')) return;
    if (event.key === 'Escape') closePhoto();
    if (event.key === 'ArrowLeft') renderPhoto(pvCurrent - 1);
    if (event.key === 'ArrowRight') renderPhoto(pvCurrent + 1);
  });

  /* ---------- 2. Nav clicks: smooth-scroll inside the page ---------- */
  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();

      const target = document.getElementById(link.dataset.target);
      if (!target) return;

      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + link.dataset.target);
      // suppress the My Works curtain during nav-triggered smooth scroll
      if (window.__suppressWorksCurtain) window.__suppressWorksCurtain(1500);
    });
  });

  /* ---------- 2b. Custom camera-lens cursor ---------- */
  const cursorEl = document.getElementById('cursor');
  if (cursorEl && !reduceMotion) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let curX = mouseX;
    let curY = mouseY;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorEl.style.opacity = '1';
    });

    window.addEventListener('mouseleave', () => {
      cursorEl.style.opacity = '0';
    });
    window.addEventListener('mouseenter', () => {
      cursorEl.style.opacity = '1';
    });

    // press effect
    window.addEventListener('mousedown', () => cursorEl.classList.add('is-down'));
    window.addEventListener('mouseup', () => cursorEl.classList.remove('is-down'));

    // hover detection over interactive elements
    const interactive = 'a, button, .work, .car, .lang-btn, .pv-close, .pv-arrow, input, textarea, .nav-item';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactive)) {
        cursorEl.classList.add('is-hover');
      }
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactive)) {
        cursorEl.classList.remove('is-hover');
      }
    });

    // smooth follow loop
    const tickCursor = () => {
      curX += (mouseX - curX) * 0.18;
      curY += (mouseY - curY) * 0.18;
      cursorEl.style.transform = 'translate3d(' + curX + 'px, ' + curY + 'px, 0)';
      requestAnimationFrame(tickCursor);
    };
    requestAnimationFrame(tickCursor);
  }

  /* ---------- 3. Contact form: front-end validation ---------- */
  const form = document.getElementById('contactForm');
  if (form) {
    const errorBox = document.getElementById('formError');

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const name = document.getElementById('formName').value.trim();
      const email = document.getElementById('formEmail').value.trim();
      const message = document.getElementById('formMessage').value.trim();

      if (!name || !email || !message) {
        errorBox.textContent = t('err-required');
        return;
      }

      if (!email.includes('@') || !email.includes('.')) {
        errorBox.textContent = t('err-email');
        return;
      }

      errorBox.textContent = '';

      const success = document.createElement('div');
      success.className = 'form-success';
      success.textContent = t('success')(name);
      form.replaceWith(success);
    });
  }
});
