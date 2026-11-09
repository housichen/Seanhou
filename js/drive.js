/* ============================================================
   DRIVE — a tiny vehicle playground on a dark desk.
   Four rides: F1, Tesla flying car, WRC rally, Semi truck.
   Third-person chase cam, WASD driving, drift-friendly arcade
   physics with tire smoke, knockable cones, ramps, OBB collision.
   Tesla: Space thrusters, Q/E yaw, A/D strafe, W/S pitch, Shift nitro.
   ============================================================ */
import * as THREE from './vendor/three.module.js';

/* ----------------------------------------------------------
   0. i18n (shares localStorage 'lang' with the main site)
   ---------------------------------------------------------- */
const I18N = {
  en: {
    back: '← Back',
    title: 'PLAYGROUND',
    subtitle: 'a tiny desk to drive on',
    hint: 'W A S D / arrows to drive · Space handbrake · R reset · C camera · 1-4 switch ride · M teleport',
    hintTesla: 'Space jets (hold = lift) · A D strafe · W S front/back flip · Q E roll · Shift nitro · R reset · M teleport',
    'veh-f1': 'F1',
    'veh-tesla': 'TESLA',
    'veh-rally': 'RALLY',
    'veh-truck': 'SEMI',
    'zone-plaza': 'PLAZA',
    'zone-circuit': 'TIME ATTACK',
    'zone-drift': 'DRIFT PARK',
    'zone-bowl': 'BOWLING',
    'zone-yard': 'HEAVY YARD',
    'zone-jump': 'BIG JUMP',
    'zone-fire': 'FIRE RUN',
    'zone-sky': 'SKY RINGS',
    'ch-wait': 'FLY THROUGH RING 1 TO START',
    'ch-go': 'GO!',
    'ch-finish': 'FINISH',
    'ch-best': 'BEST',
    'ch-newbest': 'NEW BEST!',
    'a-gate': 'GATE',
    'a-lapstart': 'CROSS THE LINE TO START',
    'a-lap': 'LAP',
    'a-drift': 'DRIFT',
    'a-pins': 'PINS',
    'a-jump': 'JUMP',
    'a-fire': 'FIRE RINGS',
    'a-jumpgo': 'HIT THE RAMP FULL SPEED!',
    'a-bowlgo': 'SMASH THE PINS!',
    'a-driftgo': 'HOLD SPACE AND SLIDE!',
    't-lap': 'LAP',
    't-jump': 'JUMP',
    't-pins': 'PINS',
    't-strike': 'STRIKE!',
    't-fire': 'FIRE RUN CLEAR',
    't-drift': 'DRIFT',
    photoLink: '📷 PHOTO',
    loading: 'warming up the engine…'
  },
  zh: {
    back: '← 返回',
    title: '游乐场',
    subtitle: '一张可以开车的小桌面',
    hint: 'W A S D / 方向键驾驶 · 空格手刹 · R 重置 · C 视角 · 1-4 换车 · M 传送',
    hintTesla: '按住空格喷气升空 · A D 平移 · W S 前/后空翻 · Q E 左/右翻滚 · Shift 氮气 · R 重置 · M 传送',
    'veh-f1': 'F1',
    'veh-tesla': '特斯拉',
    'veh-rally': '拉力',
    'veh-truck': '卡车',
    'zone-plaza': '中央广场',
    'zone-circuit': '计时赛道',
    'zone-drift': '漂移公园',
    'zone-bowl': '保龄球道',
    'zone-yard': '重卡货场',
    'zone-jump': '跳远挑战',
    'zone-fire': '烈焰火圈',
    'zone-sky': '空中环道',
    'ch-wait': '穿过 1 号环开始计时',
    'ch-go': '出发！',
    'ch-finish': '完成',
    'ch-best': '最佳',
    'ch-newbest': '新纪录！',
    'a-gate': '检查点',
    'a-lapstart': '冲过起跑线开始计时',
    'a-lap': '圈速',
    'a-drift': '漂移',
    'a-pins': '球瓶',
    'a-jump': '跳远',
    'a-fire': '火圈',
    'a-jumpgo': '全速冲上跳台！',
    'a-bowlgo': '撞倒所有球瓶！',
    'a-driftgo': '按住空格甩尾刷分！',
    't-lap': '圈速',
    't-jump': '跳远',
    't-pins': '球瓶',
    't-strike': '全中！',
    't-fire': '火圈全穿',
    't-drift': '漂移',
    photoLink: '📷 摄影',
    loading: '引擎预热中…'
  }
};

let lang = document.documentElement.lang === 'zh' ? 'zh' : 'en';

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (I18N[lang][key] != null) el.textContent = I18N[lang][key];
  });
  try { localStorage.setItem('lang', lang); } catch (e) {}
}

document.getElementById('langBtn').addEventListener('click', () => {
  lang = lang === 'en' ? 'zh' : 'en';
  applyLang();
  /* zone label + activity panel are dynamic (not data-i18n) */
  refreshZoneLabel();
  updateActivityHUD(currentZoneId);
});
applyLang();

/* ----------------------------------------------------------
   1. Renderer / scene / camera / lights
   ---------------------------------------------------------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030303);
scene.fog = new THREE.Fog(0x030303, 115, 330);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 6, -12);

const ACCENT = new THREE.Color(0xccff00);

scene.add(new THREE.HemisphereLight(0x334422, 0x050505, 1.15));
scene.add(new THREE.AmbientLight(0xffffff, 0.18));

const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(30, 50, -20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 5;
sun.shadow.camera.far = 160;
const SHADOW_RANGE = 55;
sun.shadow.camera.left = -SHADOW_RANGE;
sun.shadow.camera.right = SHADOW_RANGE;
sun.shadow.camera.top = SHADOW_RANGE;
sun.shadow.camera.bottom = -SHADOW_RANGE;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

const glowA = new THREE.PointLight(0xccff00, 30, 40, 1.8);
glowA.position.set(0, 6, 0);
scene.add(glowA);

/* ----------------------------------------------------------
   2. The desk — dark disc, painted grid, glowing edge
   ---------------------------------------------------------- */
const MAP_R = 320;

function makeDeskTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');

  g.fillStyle = '#0b0b09';
  g.fillRect(0, 0, 1024, 1024);

  g.strokeStyle = 'rgba(204,255,0,0.055)';
  g.lineWidth = 1;
  for (let i = 0; i <= 1024; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(1024, i); g.stroke();
  }
  g.strokeStyle = 'rgba(204,255,0,0.10)';
  for (let i = 0; i <= 1024; i += 128) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(1024, i); g.stroke();
  }

  g.strokeStyle = 'rgba(204,255,0,0.14)';
  g.lineWidth = 2;
  [110, 210, 330, 460].forEach((r) => {
    g.beginPath(); g.arc(512, 512, r, 0, Math.PI * 2); g.stroke();
  });

  const v = g.createRadialGradient(512, 512, 200, 512, 512, 720);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.65)');
  g.fillStyle = v;
  g.fillRect(0, 0, 1024, 1024);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

const desk = new THREE.Mesh(
  new THREE.CircleGeometry(MAP_R + 6, 96),
  new THREE.MeshStandardMaterial({ map: makeDeskTexture(), roughness: 0.85, metalness: 0.1 })
);
desk.rotation.x = -Math.PI / 2;
desk.receiveShadow = true;
scene.add(desk);

const rim = new THREE.Mesh(
  new THREE.TorusGeometry(MAP_R, 0.35, 10, 260),
  new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: ACCENT,
    emissiveIntensity: 1.6,
    roughness: 0.4
  })
);
rim.rotation.x = Math.PI / 2;
rim.position.y = 0.35;
scene.add(rim);

const postGeo = new THREE.CylinderGeometry(0.16, 0.16, 2.6, 8);
const postMat = new THREE.MeshStandardMaterial({
  color: 0x0c0c0c, emissive: ACCENT, emissiveIntensity: 1.1
});
for (let i = 0; i < 56; i++) {
  const a = (i / 56) * Math.PI * 2;
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(Math.cos(a) * (MAP_R - 2.5), 1.3, Math.sin(a) * (MAP_R - 2.5));
  scene.add(post);
}

/* ----------------------------------------------------------
   3. Vehicles — four builds with distinct silhouettes
   ---------------------------------------------------------- */
const MAT = {
  body: new THREE.MeshPhysicalMaterial({
    color: 0x1a1a1a, metalness: 0.55, roughness: 0.28,
    clearcoat: 0.8, clearcoatRoughness: 0.25
  }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.3, roughness: 0.55 }),
  carbon: new THREE.MeshStandardMaterial({ color: 0x060606, metalness: 0.2, roughness: 0.8 }),
  green: new THREE.MeshStandardMaterial({
    color: 0x223300, emissive: ACCENT, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.35
  }),
  tire: new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.92 }),
  rimMetal: new THREE.MeshStandardMaterial({
    color: 0x333333, emissive: ACCENT, emissiveIntensity: 0.4, metalness: 0.85, roughness: 0.25
  }),
  helmet: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.2, roughness: 0.35 }),
  visor: new THREE.MeshStandardMaterial({ color: 0x050508, metalness: 0.6, roughness: 0.15 }),
  rain: new THREE.MeshStandardMaterial({
    color: 0x220000, emissive: 0xff2020, emissiveIntensity: 2.4, roughness: 0.4
  }),
  // tesla — pearl silver wedge
  pearl: new THREE.MeshPhysicalMaterial({
    color: 0xd8dbe0, metalness: 0.85, roughness: 0.22,
    clearcoat: 1.0, clearcoatRoughness: 0.12
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x04060a, metalness: 0.4, roughness: 0.08,
    clearcoat: 1.0, clearcoatRoughness: 0.05
  }),
  tailRed: new THREE.MeshStandardMaterial({
    color: 0x330000, emissive: 0xff2a2a, emissiveIntensity: 2.2, roughness: 0.3
  }),
  jetGlow: new THREE.MeshStandardMaterial({
    color: 0x0a2228, emissive: 0x66d9ff, emissiveIntensity: 1.1, roughness: 0.4
  }),
  // rally — white + red WRC livery
  rallyWhite: new THREE.MeshPhysicalMaterial({
    color: 0xf0f0ee, metalness: 0.35, roughness: 0.35,
    clearcoat: 0.7, clearcoatRoughness: 0.25
  }),
  rallyRed: new THREE.MeshStandardMaterial({
    color: 0xb01218, metalness: 0.4, roughness: 0.4,
    emissive: 0x300000, emissiveIntensity: 0.5
  }),
  // semi truck — silver white cab
  semiWhite: new THREE.MeshPhysicalMaterial({
    color: 0xe4e6ea, metalness: 0.6, roughness: 0.3,
    clearcoat: 0.8, clearcoatRoughness: 0.2
  }),
  chrome: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.95, roughness: 0.18 })
};

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/* shared wheel factory — pivot steers, spin rolls */
function makeWheel(x, z, r, w, steer, rimMat) {
  const pivot = new THREE.Group();
  pivot.position.set(x, r, z);
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 22), MAT.tire);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  const rimDisc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.58, r * 0.58, w + 0.02, 16), rimMat || MAT.rimMetal);
  rimDisc.rotation.z = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.05, r * 0.72), MAT.carbon);
    spoke.rotation.x = (i / 3) * Math.PI;
    spin.add(spoke);
  }
  spin.add(tire, rimDisc);
  pivot.add(spin);
  return { pivot, spin, steerable: steer, rear: !steer };
}

/* --- F1 — the original black + #ccff00 open-wheeler --- */
function buildF1() {
  const group = new THREE.Group();
  const body = new THREE.Group();

  body.add(box(1.42, 0.06, 4.1, MAT.carbon, 0, 0.14, 0.1));
  const diffuser = box(1.5, 0.05, 0.6, MAT.carbon, 0, 0.24, -2.15);
  diffuser.rotation.x = -0.35;
  body.add(diffuser);

  body.add(box(0.95, 0.36, 2.6, MAT.body, 0, 0.52, -0.1));
  body.add(box(1.42, 0.3, 1.35, MAT.body, 0, 0.46, -0.5));
  body.add(box(0.06, 0.2, 0.5, MAT.carbon, -0.76, 0.48, -0.15));
  body.add(box(0.06, 0.2, 0.5, MAT.carbon, 0.76, 0.48, -0.15));

  // bargeboards ahead of the front wheels (clear of the tyre arc)
  body.add(box(0.05, 0.3, 0.4, MAT.green, -0.82, 0.4, 0.28));
  body.add(box(0.05, 0.3, 0.4, MAT.green, 0.82, 0.4, 0.28));

  const nose1 = box(0.6, 0.24, 0.8, MAT.body, 0, 0.44, 1.35);
  const nose2 = box(0.44, 0.2, 0.8, MAT.body, 0, 0.4, 2.0);
  const nose3 = box(0.3, 0.16, 0.5, MAT.body, 0, 0.36, 2.55);
  nose1.rotation.x = 0.05;
  nose2.rotation.x = 0.08;
  nose3.rotation.x = 0.1;
  body.add(nose1, nose2, nose3);
  body.add(box(0.1, 0.02, 1.9, MAT.green, 0, 0.52, 1.9));

  body.add(box(0.68, 0.28, 1.05, MAT.carbon, 0, 0.72, -0.15));
  body.add(box(0.4, 0.12, 0.24, MAT.green, 0, 0.88, -0.62));

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), MAT.helmet);
  helmet.position.set(0, 0.92, 0.05);
  helmet.castShadow = true;
  body.add(helmet);
  body.add(box(0.3, 0.08, 0.1, MAT.visor, 0, 0.93, 0.24));

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 10, 24, Math.PI * 1.25), MAT.dark);
  halo.position.set(0, 1.0, 0.1);
  halo.rotation.set(Math.PI / 2, 0, Math.PI * 0.875);
  halo.castShadow = true;
  body.add(halo);
  body.add(box(0.06, 0.3, 0.06, MAT.dark, 0, 0.86, 0.42));

  body.add(box(0.16, 0.06, 0.08, MAT.green, -0.62, 0.86, 0.35));
  body.add(box(0.16, 0.06, 0.08, MAT.green, 0.62, 0.86, 0.35));

  body.add(box(0.58, 0.26, 1.5, MAT.body, 0, 0.68, -1.25));
  body.add(box(0.05, 0.44, 1.15, MAT.body, 0, 0.9, -1.3));
  body.add(box(0.34, 0.16, 0.3, MAT.carbon, 0, 1.06, -0.55));
  body.add(box(0.05, 0.02, 1.1, MAT.green, 0, 1.13, -1.3));

  body.add(box(2.0, 0.05, 0.42, MAT.green, 0, 0.2, 2.72));
  body.add(box(1.7, 0.04, 0.22, MAT.body, 0, 0.3, 2.58));
  body.add(box(0.05, 0.3, 0.55, MAT.green, -1.0, 0.32, 2.66));
  body.add(box(0.05, 0.3, 0.55, MAT.green, 1.0, 0.32, 2.66));

  body.add(box(1.5, 0.05, 0.4, MAT.green, 0, 1.06, -2.05));
  body.add(box(1.4, 0.04, 0.26, MAT.body, 0, 0.94, -2.18));
  body.add(box(0.07, 0.45, 0.34, MAT.body, -0.26, 0.82, -2.02));
  body.add(box(0.07, 0.45, 0.34, MAT.body, 0.26, 0.82, -2.02));
  body.add(box(0.05, 0.46, 0.62, MAT.green, -0.76, 1.0, -2.08));
  body.add(box(0.05, 0.46, 0.62, MAT.green, 0.76, 1.0, -2.08));

  body.add(box(0.18, 0.03, 3.0, MAT.green, 0, 0.71, -0.4));
  body.add(box(0.26, 0.09, 0.06, MAT.rain, 0, 0.62, -2.32));

  [[-1, 1.05], [1, 1.05], [-1, -1.05], [1, -1.05]].forEach(([s, z]) => {
    body.add(box(0.72, 0.04, 0.07, MAT.dark, s * 0.82, 0.5, z + 0.08));
    body.add(box(0.72, 0.04, 0.07, MAT.dark, s * 0.82, 0.34, z - 0.08));
  });

  group.add(body);

  const wheels = [
    makeWheel(-0.92, 1.05, 0.42, 0.34, true),
    makeWheel(0.92, 1.05, 0.42, 0.34, true),
    makeWheel(-0.94, -1.05, 0.42, 0.44, false),
    makeWheel(0.94, -1.05, 0.42, 0.44, false)
  ];
  wheels.forEach((w) => body.add(w.pivot));   // wheels ride with the body (flips/pitch)

  const underglow = new THREE.PointLight(0xccff00, 8, 7, 2.0);
  underglow.position.set(0, 0.25, 0);
  group.add(underglow);

  return { group, body, wheels, wheelR: 0.42 };
}

/* --- Tesla flying car — pearl wedge, glass canopy, belly + side + tail jets --- */
function buildTesla() {
  const group = new THREE.Group();
  const body = new THREE.Group();

  /* wheels: r 0.38 → top 0.76; every body panel near them keeps clear
     or wraps them as an arch (fender bottoms sit above the tyre) */
  const wheels = [
    makeWheel(-0.85, 1.3, 0.38, 0.3, true, MAT.carbon),
    makeWheel(0.85, 1.3, 0.38, 0.3, true, MAT.carbon),
    makeWheel(-0.85, -1.3, 0.38, 0.32, false, MAT.carbon),
    makeWheel(0.85, -1.3, 0.38, 0.32, false, MAT.carbon)
  ];

  // floor tray + main hull — segmented: wide between the axles, narrow
  // fore/aft of them so the flanks never slice through a tyre
  body.add(box(1.36, 0.12, 4.35, MAT.dark, 0, 0.26, -0.05));
  body.add(box(1.8, 0.36, 1.76, MAT.pearl, 0, 0.52, 0));           // mid tub
  body.add(box(1.36, 0.36, 0.9, MAT.pearl, 0, 0.52, 1.33));        // front
  body.add(box(1.36, 0.36, 1.27, MAT.pearl, 0, 0.52, -1.51));      // rear

  // stepped wedge nose
  body.add(box(1.4, 0.22, 0.7, MAT.pearl, 0, 0.45, 1.75));
  body.add(box(1.4, 0.16, 0.5, MAT.pearl, 0, 0.38, 2.2));
  body.add(box(1.55, 0.1, 0.2, MAT.dark, 0, 0.3, 2.4));           // front lip
  body.add(box(1.3, 0.05, 0.05, MAT.helmet, 0, 0.48, 2.44));      // LED light bar

  // fender arches wrapping each wheel (bottom edge above tyre top)
  [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]].forEach(([x, z]) => {
    body.add(box(0.44, 0.14, 1.05, MAT.pearl, x, 0.84, z));
  });

  // glass canopy — wide black wedge
  body.add(box(1.2, 0.36, 2.0, MAT.glass, 0, 0.82, -0.2));
  body.add(box(1.0, 0.26, 0.7, MAT.glass, 0, 0.78, 1.0));         // windshield slope
  // rear deck + ducktail spoiler
  body.add(box(1.36, 0.16, 1.0, MAT.pearl, 0, 0.78, -1.6));
  body.add(box(1.5, 0.05, 0.3, MAT.dark, 0, 0.92, -2.05));

  // full-width red tail bar + diffuser fins
  body.add(box(1.66, 0.07, 0.06, MAT.tailRed, 0, 0.55, -2.21));
  body.add(box(1.5, 0.14, 0.4, MAT.dark, 0, 0.28, -2.2));
  [-0.5, 0, 0.5].forEach((x) => body.add(box(0.05, 0.16, 0.42, MAT.carbon, x, 0.26, -2.22)));

  // side skirts (between the axles only) + scissor door shut-lines + mirrors
  body.add(box(0.08, 0.14, 1.7, MAT.dark, -0.92, 0.3, 0.05));
  body.add(box(0.08, 0.14, 1.7, MAT.dark, 0.92, 0.3, 0.05));
  body.add(box(0.03, 0.3, 1.1, MAT.carbon, -0.91, 0.52, -0.1));
  body.add(box(0.03, 0.3, 1.1, MAT.carbon, 0.91, 0.52, -0.1));
  body.add(box(0.14, 0.05, 0.08, MAT.pearl, -0.78, 0.78, 0.6));
  body.add(box(0.14, 0.05, 0.08, MAT.pearl, 0.78, 0.78, 0.6));

  wheels.forEach((w) => body.add(w.pivot));

  /* ---- thruster set ----
     belly: 4 corner nozzles (Space = all, W = rear pair, S = front pair,
            Q = left pair, E = right pair)
     side: 1 per side, fires outward (A strafes left → RIGHT side fires)
     tail: 1 rear nozzle, fires backward (Shift nitro) */
  const jets = [];
  const nozzleGeo = new THREE.CylinderGeometry(0.15, 0.19, 0.16, 12);
  const flameGeo = new THREE.ConeGeometry(0.19, 1.9, 12, 1, true);
  flameGeo.rotateX(Math.PI);              // tip pointing down
  flameGeo.translate(0, -0.95, 0);        // origin at the nozzle mouth
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x7fd4ff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xeafcff, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false
  });

  function addJet(kind, corner, x, y, z, dirLocal, nozzleTilt) {
    const nozzle = new THREE.Mesh(nozzleGeo, MAT.jetGlow);
    nozzle.position.set(x, y, z);
    if (nozzleTilt) nozzle.rotation.copy(nozzleTilt);
    body.add(nozzle);
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(x, y - 0.04, z);
    flame.scale.set(1, 0, 1);
    flame.visible = false;
    body.add(flame);
    const core = new THREE.Mesh(flameGeo, coreMat);
    core.scale.set(0.55, 1, 0.55);
    flame.add(core);
    const jet = { kind, corner, nozzle, flame, dirLocal: dirLocal.clone() };
    if (dirLocal.y > -0.9) {
      // horizontal flame: orient the cone along dirLocal
      flame.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirLocal);
    }
    jets.push(jet);
    return jet;
  }

  addJet('belly', 'fl', -0.6, 0.14, 1.15, new THREE.Vector3(0, -1, 0));
  addJet('belly', 'fr', 0.6, 0.14, 1.15, new THREE.Vector3(0, -1, 0));
  addJet('belly', 'rl', -0.6, 0.14, -1.15, new THREE.Vector3(0, -1, 0));
  addJet('belly', 'rr', 0.6, 0.14, -1.15, new THREE.Vector3(0, -1, 0));
  // side nozzles — angled slightly down, flames point outward
  addJet('side', 'l', -0.98, 0.4, 0.1, new THREE.Vector3(-1, -0.25, 0).normalize(),
    new THREE.Euler(0, 0, -Math.PI / 2 + 0.25));
  addJet('side', 'r', 0.98, 0.4, 0.1, new THREE.Vector3(1, -0.25, 0).normalize(),
    new THREE.Euler(0, 0, Math.PI / 2 - 0.25));
  // tail nozzle — points backward for nitro
  addJet('tail', 't', 0, 0.45, -2.32, new THREE.Vector3(0, -0.15, -1).normalize(),
    new THREE.Euler(-Math.PI / 2 + 0.15, 0, 0));

  const jetLight = new THREE.PointLight(0x66d9ff, 0, 14, 1.8);
  jetLight.position.set(0, -0.4, 0);
  group.add(jetLight);

  const underglow = new THREE.PointLight(0x66d9ff, 5, 7, 2.0);
  underglow.position.set(0, 0.25, 0);
  group.add(underglow);
  group.add(body);

  return { group, body, wheels, wheelR: 0.38, jets, jetLight };
}

/* --- Rally — WRC hatch: white/red livery, flared arches, big wing --- */
function buildRally() {
  const group = new THREE.Group();
  const body = new THREE.Group();

  /* wheels r 0.42 → top 0.84; flares wrap them from above (bottom 0.85) */
  const wheels = [
    makeWheel(-0.88, 1.25, 0.42, 0.3, true, MAT.rallyWhite),
    makeWheel(0.88, 1.25, 0.42, 0.3, true, MAT.rallyWhite),
    makeWheel(-0.88, -1.25, 0.42, 0.32, false, MAT.rallyWhite),
    makeWheel(0.88, -1.25, 0.42, 0.32, false, MAT.rallyWhite)
  ];

  // floor + lower body — segmented like the tesla: full width only
  // between the axles, narrow sections over the wheels
  body.add(box(1.4, 0.14, 4.2, MAT.dark, 0, 0.32, 0));
  body.add(box(1.8, 0.42, 1.6, MAT.rallyWhite, 0, 0.6, 0));        // mid
  body.add(box(1.42, 0.42, 1.1, MAT.rallyWhite, 0, 0.6, 1.35));    // front
  body.add(box(1.42, 0.42, 1.15, MAT.rallyWhite, 0, 0.6, -1.37));  // rear
  body.add(box(1.86, 0.3, 0.4, MAT.rallyWhite, 0, 0.45, 1.95));   // front bumper
  body.add(box(1.9, 0.08, 0.34, MAT.rallyRed, 0, 0.28, 2.02));    // red splitter
  body.add(box(1.86, 0.26, 0.3, MAT.rallyWhite, 0, 0.48, -2.0));  // rear bumper

  // hood with red stripe + vents
  body.add(box(1.44, 0.12, 1.0, MAT.rallyWhite, 0, 0.85, 1.35));
  body.add(box(0.9, 0.03, 0.95, MAT.rallyRed, 0, 0.92, 1.3));
  body.add(box(0.5, 0.04, 0.4, MAT.carbon, 0, 0.92, 1.6));

  // flared arches over all four wheels
  [[-0.88, 1.25], [0.88, 1.25], [-0.88, -1.25], [0.88, -1.25]].forEach(([x, z]) => {
    body.add(box(0.42, 0.14, 1.05, MAT.rallyWhite, x, 0.92, z));
  });

  // cabin glasshouse + white pillars + roof
  body.add(box(1.5, 0.45, 1.9, MAT.glass, 0, 1.05, -0.35));
  body.add(box(0.08, 0.45, 0.1, MAT.rallyWhite, -0.72, 1.05, 0.58));   // A-pillar L
  body.add(box(0.08, 0.45, 0.1, MAT.rallyWhite, 0.72, 1.05, 0.58));    // A-pillar R
  body.add(box(1.55, 0.08, 1.95, MAT.rallyWhite, 0, 1.31, -0.35));     // roof
  body.add(box(0.5, 0.18, 0.6, MAT.rallyRed, 0, 1.42, 0.3));           // roof scoop
  body.add(box(0.06, 0.22, 0.06, MAT.carbon, 0.5, 1.42, -0.9));        // antenna

  // door number roundels + red side stripe
  body.add(box(0.03, 0.34, 0.5, MAT.helmet, -0.92, 0.62, -0.3));
  body.add(box(0.03, 0.34, 0.5, MAT.helmet, 0.92, 0.62, -0.3));
  body.add(box(0.03, 0.12, 1.5, MAT.rallyRed, -0.92, 0.42, 0));
  body.add(box(0.03, 0.12, 1.5, MAT.rallyRed, 0.92, 0.42, 0));

  // rally light pod on the nose — 4 lamps
  body.add(box(0.8, 0.14, 0.14, MAT.carbon, 0, 0.98, 1.78));
  [-0.27, -0.09, 0.09, 0.27].forEach((x) => {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 10),
      new THREE.MeshStandardMaterial({ color: 0x333322, emissive: 0xffffcc, emissiveIntensity: 1.6 }));
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(x, 0.98, 1.86);
    body.add(lamp);
  });

  // big WRC rear wing: pylons + main plane + endplates
  body.add(box(0.08, 0.42, 0.3, MAT.carbon, -0.5, 1.2, -1.85));
  body.add(box(0.08, 0.42, 0.3, MAT.carbon, 0.5, 1.2, -1.85));
  body.add(box(1.8, 0.07, 0.5, MAT.rallyRed, 0, 1.46, -1.9));
  body.add(box(0.06, 0.32, 0.56, MAT.rallyWhite, -0.92, 1.44, -1.9));
  body.add(box(0.06, 0.32, 0.56, MAT.rallyWhite, 0.92, 1.44, -1.9));
  body.add(box(1.6, 0.04, 0.28, MAT.carbon, 0, 1.34, -1.98));     // lower flap

  // mirrors, mud flaps (behind the tyre arc), twin exhausts
  body.add(box(0.16, 0.07, 0.1, MAT.rallyWhite, -0.85, 0.95, 0.55));
  body.add(box(0.16, 0.07, 0.1, MAT.rallyWhite, 0.85, 0.95, 0.55));
  [[-0.85, 1.78], [0.85, 1.78], [-0.85, -1.78], [0.85, -1.78]].forEach(([x, z]) => {
    body.add(box(0.34, 0.22, 0.05, MAT.rallyRed, x, 0.22, z));
  });
  [-0.4, 0.4].forEach((x) => {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 10), MAT.chrome);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(x, 0.32, -2.14);
    body.add(ex);
  });

  wheels.forEach((w) => body.add(w.pivot));

  const underglow = new THREE.PointLight(0xccff00, 6, 7, 2.0);
  underglow.position.set(0, 0.25, 0);
  group.add(underglow);
  group.add(body);

  return { group, body, wheels, wheelR: 0.42 };
}

/* --- Semi truck — tall silver cab-over, no trailer, 6 wheels --- */
function buildTruck() {
  const group = new THREE.Group();
  const body = new THREE.Group();

  /* wheels r 0.48 → top 0.96; the cab floor sits at 1.0 so nothing
     slices through the tyres, mudguards wrap the rear axles */
  const wheels = [
    makeWheel(-1.0, 1.55, 0.48, 0.38, true, MAT.chrome),
    makeWheel(1.0, 1.55, 0.48, 0.38, true, MAT.chrome),
    makeWheel(-1.0, -0.95, 0.48, 0.4, false, MAT.chrome),
    makeWheel(1.0, -0.95, 0.48, 0.4, false, MAT.chrome),
    makeWheel(-1.0, -2.05, 0.48, 0.4, false, MAT.chrome),
    makeWheel(1.0, -2.05, 0.48, 0.4, false, MAT.chrome)
  ];

  // chassis rail + between-axle skirts (clear of every tyre)
  body.add(box(1.56, 0.3, 5.2, MAT.dark, 0, 0.5, -0.2));
  body.add(box(0.1, 0.34, 1.4, MAT.chrome, -1.04, 0.78, 0.3));
  body.add(box(0.1, 0.34, 1.4, MAT.chrome, 1.04, 0.78, 0.3));

  // main cab — floor above the wheel tops
  body.add(box(2.2, 1.1, 3.4, MAT.semiWhite, 0, 1.55, 0.6));
  // sloped windshield (rotated glass slab)
  const shield = box(1.9, 1.0, 0.12, MAT.glass, 0, 1.9, 2.18);
  shield.rotation.x = 0.42;
  body.add(shield);
  // black glass band around the cab mid
  body.add(box(2.22, 0.4, 2.2, MAT.glass, 0, 1.85, 1.0));
  // roof fairing sweeping back
  const fairing = box(2.0, 0.9, 1.8, MAT.semiWhite, 0, 2.55, -0.1);
  fairing.rotation.x = -0.18;
  body.add(fairing);
  body.add(box(2.05, 1.1, 1.4, MAT.semiWhite, 0, 1.65, -1.2)); // rear bulkhead
  // amber roof marker lights
  for (let i = -2; i <= 2; i++) {
    body.add(box(0.12, 0.05, 0.06, new THREE.MeshStandardMaterial({
      color: 0x442200, emissive: 0xffaa22, emissiveIntensity: 1.8
    }), i * 0.3, 2.16, 1.98));
  }
  // front: slim LED blades + lower valance ahead of the tyres
  body.add(box(2.2, 0.5, 0.4, MAT.dark, 0, 0.55, 2.35));
  const bladeL = box(0.14, 0.5, 0.06, MAT.helmet, -0.85, 1.15, 2.32);
  bladeL.rotation.x = 0.3;
  const bladeR = box(0.14, 0.5, 0.06, MAT.helmet, 0.85, 1.15, 2.32);
  bladeR.rotation.x = 0.3;
  body.add(bladeL, bladeR);
  // mirrors on stalks
  body.add(box(0.06, 0.5, 0.06, MAT.dark, -1.25, 1.9, 1.6));
  body.add(box(0.06, 0.5, 0.06, MAT.dark, 1.25, 1.9, 1.6));
  body.add(box(0.1, 0.3, 0.16, MAT.dark, -1.28, 2.1, 1.6));
  body.add(box(0.1, 0.3, 0.16, MAT.dark, 1.28, 2.1, 1.6));
  // front wheel brows + rear mudguards (both above the tyre tops)
  body.add(box(0.46, 0.12, 1.1, MAT.semiWhite, -1.0, 1.02, 1.55));
  body.add(box(0.46, 0.12, 1.1, MAT.semiWhite, 1.0, 1.02, 1.55));
  body.add(box(0.5, 0.16, 2.6, MAT.semiWhite, -1.0, 1.08, -1.5));
  body.add(box(0.5, 0.16, 2.6, MAT.semiWhite, 1.0, 1.08, -1.5));
  // fifth wheel plate between the rear axles (clear of the tyres)
  body.add(box(1.5, 0.08, 1.2, MAT.carbon, 0, 0.72, -1.5));

  wheels.forEach((w) => body.add(w.pivot));

  const underglow = new THREE.PointLight(0xccff00, 6, 8, 2.0);
  underglow.position.set(0, 0.25, 0);
  group.add(underglow);
  group.add(body);

  return { group, body, wheels, wheelR: 0.48 };
}

/* ----------------------------------------------------------
   3b. Vehicle registry — per-ride handling
   ---------------------------------------------------------- */
const VEHICLES = [
  {
    id: 'f1', nameKey: 'veh-f1', hintKey: 'hint', build: buildF1, map: 'desk',
    carR: 1.05, carHalf: 1.55, camH: 0,
    tune: {
      accel: 24, brake: 30, reverseMax: 10, maxSpeed: 52,
      drag: 0.3, rollResist: 1.0,
      steerRate: 2.7, steerHighCut: 34,
      gripBase: 4.0, gripHand: 0.8, driftSteerLoss: 0.55, driftScrub: 0.5,
      gravity: 14, gravityUp: 0.72, jumpBoost: 1.3, jumpCap: 14,
      bodyRoll: 0.08
    }
  },
  {
    id: 'tesla', nameKey: 'veh-tesla', hintKey: 'hintTesla', build: buildTesla, fly: true, map: 'sky',
    carR: 1.0, carHalf: 1.45, camH: 0,
    tune: {
      accel: 20, brake: 34, reverseMax: 8, maxSpeed: 46,
      drag: 0.35, rollResist: 1.2,
      steerRate: 2.2, steerHighCut: 30,
      gripBase: 6.5, gripHand: 1.4, driftSteerLoss: 0.3, driftScrub: 0.4,
      gravity: 14, gravityUp: 0.72, jumpBoost: 1.15, jumpCap: 12,
      bodyRoll: 0.05
    }
  },
  {
    id: 'rally', nameKey: 'veh-rally', hintKey: 'hint', build: buildRally, map: 'slalom',
    carR: 1.0, carHalf: 1.4, camH: 0,
    tune: {
      accel: 27, brake: 34, reverseMax: 9, maxSpeed: 44,
      drag: 0.32, rollResist: 1.0,
      steerRate: 3.5, steerHighCut: 26,
      gripBase: 2.3, gripHand: 0.45, driftSteerLoss: 0.75, driftScrub: 0.35,
      gravity: 14, gravityUp: 0.72, jumpBoost: 1.2, jumpCap: 12,
      bodyRoll: 0.12
    }
  },
  {
    id: 'truck', nameKey: 'veh-truck', hintKey: 'hint', build: buildTruck, map: 'yard',
    carR: 1.25, carHalf: 1.9, camH: 1.6,
    tune: {
      accel: 15, brake: 22, reverseMax: 7, maxSpeed: 40,
      drag: 0.42, rollResist: 1.4,
      steerRate: 1.9, steerHighCut: 20,
      gripBase: 6.8, gripHand: 2.2, driftSteerLoss: 0.18, driftScrub: 0.6,
      gravity: 16, gravityUp: 0.85, jumpBoost: 0.9, jumpCap: 9,
      bodyRoll: 0.16
    }
  }
];

/* one container carries whichever ride is active */
const car = new THREE.Group();
scene.add(car);

let vehIndex = 0;
let activeVeh = null;
let carBody = null;
let wheels = [];
let TUNE = VEHICLES[0].tune;
let CAR_R = VEHICLES[0].carR;
let CAR_HALF = VEHICLES[0].carHalf;
let WHEEL_R = 0.42;

const vehButtons = [...document.querySelectorAll('.veh-btn')];
const hintEl = document.querySelector('.hud-hint');
const speedBox = document.querySelector('.hud-speed');

function switchVehicle(i, silent) {
  if (!VEHICLES[i]) return;
  if (activeVeh) car.remove(activeVeh.group);
  vehIndex = i;
  const v = VEHICLES[i];
  if (!v.built) v.built = v.build();
  activeVeh = v.built;
  car.add(activeVeh.group);
  carBody = activeVeh.body;
  wheels = activeVeh.wheels;
  TUNE = v.tune;
  CAR_R = v.carR;
  CAR_HALF = v.carHalf;
  WHEEL_R = activeVeh.wheelR;
  // leaving the tesla mid-air: drop the flight state
  if (!v.fly) carState.fly = false;
  vehButtons.forEach((b, j) => b.classList.toggle('is-active', j === i));
  hintEl.dataset.i18n = v.hintKey;
  hintEl.textContent = I18N[lang][v.hintKey];
  if (!silent) {
    try { localStorage.setItem('veh', v.id); } catch (e) {}
  }
}

vehButtons.forEach((b) => {
  b.addEventListener('click', () => { switchVehicle(+b.dataset.veh); dimHint(); });
});

/* ----------------------------------------------------------
   4. Props — cones (knockable), blocks (OBB), ramps
   ---------------------------------------------------------- */
let seed = 7;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

const cones = [];
const rampArrows = [];   // flat chevrons — tracked so map switches can remove them
const coneGeo = new THREE.ConeGeometry(0.55, 1.15, 14);
const coneStripeGeo = new THREE.CylinderGeometry(0.30, 0.40, 0.22, 14);
const coneMat = new THREE.MeshStandardMaterial({
  color: 0x141414, emissive: ACCENT, emissiveIntensity: 0.55, roughness: 0.5
});
const coneStripeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });

function addCone(x, z) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(coneGeo, coneMat);
  c.position.y = 0.58;
  c.castShadow = true;
  const stripe = new THREE.Mesh(coneStripeGeo, coneStripeMat);
  stripe.position.y = 0.52;
  g.add(c, stripe);
  g.position.set(x, 0, z);
  scene.add(g);
  cones.push({ mesh: g, vel: new THREE.Vector2(), vy: 0, angVel: 0, tip: 0, r: 0.6 });
}

/* desk layout moved into buildDeskProps() (map section below) */

/* blocks — full OBB data for accurate collision (no clipping) */
const blocks = [];
const blockEdgeMat = new THREE.LineBasicMaterial({ color: 0xccff00, transparent: true, opacity: 0.8 });

function addBlock(x, z, w, h, d, yaw) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x1e2016, metalness: 0.35, roughness: 0.55,
    emissive: 0x151a06, emissiveIntensity: 0.8
  }));
  m.position.set(x, h / 2, z);
  m.rotation.y = yaw;
  m.castShadow = true;
  m.receiveShadow = true;
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), blockEdgeMat));
  scene.add(m);
  blocks.push({
    mesh: m,
    x, z, hw: w / 2, hd: d / 2, h,
    cos: Math.cos(yaw), sin: Math.sin(yaw),     // world→local (R(-yaw))
    cosB: Math.cos(yaw), sinB: Math.sin(yaw)    // local→world (R(yaw))
  });
}

/* random blocks moved into buildDeskProps() (map section below) */

/* ramps — slope rises along local +z; tall faces act as walls.
   All ramps face the desk centre so you drive UP from the open area. */
const ramps = [];

/* flat chevron arrow on the ground pointing uphill — shows which way to hit it */
function addRampArrow(x, z, yaw, dist, opacity) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, 1.9,   1.25, 0, -0.9,   -1.25, 0, -0.9
  ]), 3));
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xccff00, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false
  }));
  const dirX = Math.sin(yaw), dirZ = Math.cos(yaw);
  m.position.set(x - dirX * dist, 0.03, z - dirZ * dist);
  m.rotation.y = yaw;
  scene.add(m);
  rampArrows.push(m);
}

function addRamp(x, z, yaw, w = 10, l = 20, h = 3.2) {
  const geo = new THREE.BoxGeometry(w, h, l);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getZ(i) < 0) pos.setY(i, -h / 2);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x22241a, metalness: 0.3, roughness: 0.6,
    emissive: 0x181c07, emissiveIntensity: 0.8
  }));
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), blockEdgeMat));
  m.position.set(x, h / 2, z);
  m.rotation.y = yaw;
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  rampMeshes.push(m);
  ramps.push({ x, z, w, l, h, cos: Math.cos(yaw), sin: Math.sin(yaw) });
  // a random block sitting inside a new ramp would clip — remove it
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    const dx = b.x - x, dz = b.z - z;
    const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    if (Math.abs(lx) < w / 2 + b.hw + 1 && Math.abs(lz) < l / 2 + b.hd + 1) {
      scene.remove(b.mesh);
      blocks.splice(i, 1);
    }
  }
  addRampArrow(x, z, yaw, l / 2 + 4, 0.55);
  addRampArrow(x, z, yaw, l / 2 + 7.5, 0.3);
}

/* radial ramps moved into buildDeskProps() (map section below).
   Every ramp is RADIAL: its low edge faces the desk centre, uphill points
   straight away from it — approach from anywhere near the middle and you
   climb, never hit a side wall. yaw = atan2(x, z) achieves exactly that. */

/* highest ramp surface at (x,z), plus which ramp it belongs to */
function rampInfoAt(x, z) {
  let best = 0;
  let owner = null;
  for (const r of ramps) {
    const dx = x - r.x;
    const dz = z - r.z;
    const lx = dx * r.cos - dz * r.sin;
    const lz = dx * r.sin + dz * r.cos;
    if (Math.abs(lx) < r.w / 2 && lz > -r.l / 2 && lz < r.l / 2) {
      const h = ((lz + r.l / 2) / r.l) * r.h;
      if (h > best) { best = h; owner = r; }
    }
  }
  return { h: best, ramp: owner };
}

/* ----------------------------------------------------------
   4c. One big world — districts + activities.
   Everything lives on the same giant desk; the car drives (or
   flies) between districts. M teleports to the next district.
   ---------------------------------------------------------- */
const rampMeshes = [];

/* district circles — current zone = nearest centre inside its radius */
const DISTRICTS = [
  { id: 'plaza',   nameKey: 'zone-plaza',   cx: 0,    cz: 40,   r: 60 },
  { id: 'circuit', nameKey: 'zone-circuit', cx: 0,    cz: -210, r: 95 },
  { id: 'drift',   nameKey: 'zone-drift',   cx: 205,  cz: -5,   r: 95 },
  { id: 'bowl',    nameKey: 'zone-bowl',    cx: 205,  cz: 88,   r: 34 },
  { id: 'yard',    nameKey: 'zone-yard',    cx: -205, cz: 0,    r: 85 },
  { id: 'jump',    nameKey: 'zone-jump',    cx: 0,    cz: 215,  r: 100 },
  { id: 'fire',    nameKey: 'zone-fire',    cx: 78,   cz: 218,  r: 55 }
];
let currentZoneId = 'plaza';

function zoneAt(x, z) {
  let best = 'plaza', bestD = Infinity, bestAny = 'plaza', bestAnyD = Infinity;
  for (const d of DISTRICTS) {
    const dist = Math.hypot(x - d.cx, z - d.cz);
    if (dist < bestAnyD) { bestAny = d.id; bestAnyD = dist; }
    if (dist < d.r && dist < bestD) { best = d.id; bestD = dist; }
  }
  return bestD < Infinity ? best : bestAny;   // between districts: nearest wins
}

/* M — teleport to the next district */
const TELEPORTS = [
  { zone: 'plaza',   x: 0,    z: 12,   heading: Math.PI },
  { zone: 'circuit', x: 55,   z: -228, heading: 0 },
  { zone: 'drift',   x: 205,  z: -75,  heading: 0 },
  { zone: 'bowl',    x: 205,  z: 60,   heading: 0 },
  { zone: 'yard',    x: -160, z: 0,    heading: -Math.PI / 2 },
  { zone: 'jump',    x: 0,    z: 120,  heading: 0 },
  { zone: 'fire',    x: 50,   z: 168,  heading: -0.6 }
];
let teleportIdx = 0;
function teleportNext() {
  teleportIdx = (teleportIdx + 1) % TELEPORTS.length;
  const t = TELEPORTS[teleportIdx];
  carState.pos.set(t.x, 0, t.z);
  carState.heading = t.heading;
  carState.vel.set(0, 0);
  carState.vy = 0;
  carState.fly = false;
  carState.grounded = true;
  showToast(I18N[lang][DISTRICTS.find(d => d.id === t.zone).nameKey]);
  dimHint();
}

/* ---------- world construction ---------- */

/* flat ground strip (distance markers, finish lines…) */
function addGroundStrip(x, z, w, d, color, opacity) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.04, z);
  scene.add(m);
  return m;
}

function makeCheckerTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 128;   // checks alternate along the strip's length
  const g = c.getContext('2d');
  for (let i = 0; i < 2; i++) for (let j = 0; j < 16; j++) {
    g.fillStyle = (i + j) % 2 ? '#e8e8e8' : '#101010';
    g.fillRect(i * 8, j * 8, 8, 8);
  }
  return new THREE.CanvasTexture(c);
}

function buildWorld() {
  /* — PLAZA: sparse cones so the spawn area has some life — */
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2;
    const d = 20 + rand() * 25;
    addCone(Math.cos(a) * d, 40 + Math.sin(a) * d * 0.6);
  }

  /* — CIRCUIT (north): oval time-attack, cone walls + gates — */
  const CC = { x: 0, z: -210, a: 55, b: 42 };
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    addCone(Math.cos(t) * 48, -210 + Math.sin(t) * 35);
    addCone(Math.cos(t) * 62, -210 + Math.sin(t) * 49);
  }
  /* start/finish checker strip on the east side (gate 0) */
  const checker = addGroundStrip(55, -210, 3.2, 16, 0xffffff, 0.9);
  checker.material.map = checkerTex;
  checker.material.needsUpdate = true;

  /* — DRIFT PARK (east): drift circle + slalom lane — */
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    addCone(205 + Math.cos(a) * 48, -40 + Math.sin(a) * 48);
  }
  for (let i = 0; i < 14; i++) {
    addCone(150 + i * 9, 20 + (i % 2 ? -5 : 5));
  }

  /* — BOWLING (far east): lane gutters + 10 pins (pins built below) — */
  addBlock(199.4, 75, 1.2, 1.1, 34, 0);
  addBlock(210.6, 75, 1.2, 1.1, 34, 0);

  /* — HEAVY YARD (west): containers + wide ramps — */
  for (let i = 0; i < 4; i++) {
    addBlock(-251, -30 + i * 16, 6, 4.2, 12, 0);
    addBlock(-159, -30 + i * 16, 6, 4.2, 12, 0);
  }
  addBlock(-205, -70, 14, 5, 6, 0.2);
  addBlock(-225, 66, 10, 4, 6, -0.3);
  addBlock(-179, 70, 8, 3.4, 6, 0.5);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    addCone(-205 + Math.cos(a) * 26, Math.sin(a) * 26);
  }
  addRamp(-205, -34, Math.atan2(-205, -34), 14, 24, 3.4);
  addRamp(-275, 40, Math.atan2(-275, 40), 14, 26, 4);
  addRamp(-125, -60, Math.atan2(-125, -60), 14, 26, 4);

  /* — BIG JUMP (south): monster ramp + measured landing strip — */
  jumpRamp = { x: 0, z: 150, lip: 167 };
  addRamp(0, 150, 0, 16, 34, 6);
  for (let i = 0; i < 9; i++) {
    const z = 180 + i * 15;
    addGroundStrip(0, z, 18, 0.8, 0xffffff, 0.5);
    addCone(-10, z); addCone(10, z);
  }

  /* — FIRE RUN (south-east): ground slalom between burning rings — */
  addRamp(58, 186, Math.atan2(75 - 45, 200 - 175), 8, 14, 2.4);

  /* — general scenery: blocks scattered between districts — */
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const d = 95 + rand() * 200;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (zoneAt(x, z) !== 'plaza' && Math.hypot(x, z - 40) > 70) continue;  // keep districts clean
    addBlock(x, z, 2.5 + rand() * 3, 1.6 + rand() * 2.4, 2.5 + rand() * 3, rand() * Math.PI);
  }
}

/* ---------- sky rings (tesla time trial, above the plaza) ---------- */
const RING_COURSE = [
  [0, 6, 54], [10, 8, 34], [30, 11, 20], [54, 14, 26],
  [68, 16, 50], [58, 13, 76], [34, 10, 88], [10, 8, 96]
];
const RING_R = 4.2;
const rings = [];

const challenge = { active: false, t: 0, next: 0, best: null };

function buildRings() {
  const group = new THREE.Group();
  const geo = new THREE.TorusGeometry(RING_R, 0.22, 12, 48);
  for (let i = 0; i < RING_COURSE.length; i++) {
    const [x, y, z] = RING_COURSE[i];
    const nxt = RING_COURSE[(i + 1) % RING_COURSE.length];
    const prv = RING_COURSE[(i - 1 + RING_COURSE.length) % RING_COURSE.length];
    const normal = new THREE.Vector3(nxt[0] - prv[0], 0, nxt[2] - prv[2]).normalize();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0c2a33, emissive: 0x66d9ff, emissiveIntensity: 0.9,
      transparent: true, opacity: 0.55, roughness: 0.4, metalness: 0.2
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.lookAt(x + normal.x, y, z + normal.z);
    group.add(mesh);
    rings.push({ mesh, center: new THREE.Vector3(x, y, z), normal, radius: RING_R });
  }
  scene.add(group);
}

/* ---------- circuit gates ---------- */
const GATES = [
  { x: 55, z: -210, nx: 0, nz: 1 },
  { x: 0, z: -168, nx: -1, nz: 0 },
  { x: -55, z: -210, nx: 0, nz: -1 },
  { x: 0, z: -252, nx: 1, nz: 0 }
];
const GATE_HALF = 9;
const lap = { active: false, t: 0, expected: 0, best: null, last: null };

function checkGates() {
  const g = GATES[lap.expected];
  if (!g) return;
  const hit = planeCross(g.x, 1, g.z, g.nx, 0, g.nz, GATE_HALF);
  if (!hit) return;
  const L = I18N[lang];
  if (lap.expected === 0) {
    if (!lap.active) {
      lap.active = true; lap.t = 0; lap.expected = 1;
      showToast(L['ch-go']);
    } else {
      /* full lap done */
      lap.active = false; lap.last = lap.t;
      let msg = `${L['t-lap']} · ${lap.t.toFixed(1)}s`;
      if (!lap.best || lap.t < lap.best) {
        lap.best = lap.t;
        msg += `\n${L['ch-newbest']}`;
        try { localStorage.setItem('lapBest', String(lap.best)); } catch (e) {}
      }
      showToast(msg);
      lap.t = 0; lap.expected = 1; lap.active = true;   // rolling start for the next lap
    }
  } else {
    lap.expected = (lap.expected + 1) % 4;
  }
}

/* ---------- fire rings ---------- */
const FIRE_COURSE = [
  [45, 2.6, 175], [75, 2.6, 200], [95, 2.6, 230], [100, 2.6, 262]
];
const FIRE_R = 3.0;
const fireRings = [];
const fire = { active: false, t: 0, next: 0, best: null };

function buildFireRings() {
  const geo = new THREE.TorusGeometry(FIRE_R, 0.3, 12, 40);
  for (let i = 0; i < FIRE_COURSE.length; i++) {
    const [x, y, z] = FIRE_COURSE[i];
    const nxt = FIRE_COURSE[(i + 1) % FIRE_COURSE.length];
    const prv = FIRE_COURSE[(i - 1 + FIRE_COURSE.length) % FIRE_COURSE.length];
    const normal = new THREE.Vector3(nxt[0] - prv[0], 0, nxt[2] - prv[2]).normalize();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x2a0f04, emissive: 0xff6a00, emissiveIntensity: 1.4,
      transparent: true, opacity: 0.85, roughness: 0.5
    }));
    mesh.position.set(x, y, z);
    mesh.lookAt(x + normal.x, y, z + normal.z);
    scene.add(mesh);
    const light = new THREE.PointLight(0xff7722, 6, 16, 2);
    light.position.set(x, y + 0.5, z);
    scene.add(light);
    fireRings.push({ mesh, light, center: new THREE.Vector3(x, y, z), normal, radius: FIRE_R });
  }
}

function checkFirePass() {
  const r = fireRings[fire.next];
  if (!r) return;
  if (!planeCross(r.center.x, r.center.y, r.center.z, r.normal.x, r.normal.y, r.normal.z, r.radius)) return;
  const L = I18N[lang];
  if (fire.next === 0) {
    fire.active = true; fire.t = 0; fire.next = 1;
    showToast(L['ch-go']);
  } else if (fire.next === fireRings.length - 1) {
    fire.active = false;
    let msg = `${L['t-fire']} · ${fire.t.toFixed(1)}s`;
    if (!fire.best || fire.t < fire.best) {
      fire.best = fire.t;
      msg += `\n${L['ch-newbest']}`;
      try { localStorage.setItem('fireBest', String(fire.best)); } catch (e) {}
    }
    showToast(msg);
    fire.next = 0; fire.t = 0;
  } else {
    fire.next++;
  }
  for (let i = 0; i < fireRings.length; i++) {
    const m = fireRings[i].mesh.material;
    if (fire.active && i < fire.next) { m.emissive.setHex(0xccff00); m.opacity = 0.4; }
    else { m.emissive.setHex(0xff6a00); m.opacity = 0.85; }
  }
}

/* ---------- long jump ---------- */
let jumpRamp = null;      // { x, z, lip } — set by buildWorld
let jumpRun = false;
const jump = { last: null, best: null };

function checkJump(wasGrounded, s) {
  /* takeoff: leaving the ground on the monster ramp, heading south */
  if (wasGrounded && !s.grounded && Math.abs(s.pos.x - jumpRamp.x) < 14 &&
      s.pos.z > jumpRamp.z && s.pos.z < jumpRamp.lip + 4 && s.vy > 4) {
    jumpRun = true;
  }
  if (jumpRun && s.grounded) {
    jumpRun = false;
    const dist = s.pos.z - jumpRamp.lip;
    if (dist > 3) {
      const L = I18N[lang];
      jump.last = dist;
      let msg = `${L['t-jump']} · ${dist.toFixed(1)}m`;
      if (!jump.best || dist > jump.best) {
        jump.best = dist;
        msg += `\n${L['ch-newbest']}`;
        try { localStorage.setItem('jumpBest', String(jump.best)); } catch (e) {}
      }
      showToast(msg);
    }
  }
}

/* ---------- drift score ---------- */
const DRIFT_C = { x: 205, z: -40, r: 58 };
const drift = { score: 0, run: 0, idle: 0, best: null };

function updateDrift(dt, latSpeed, speedFwd, grounded) {
  const inCircle = Math.hypot(carState.pos.x - DRIFT_C.x, carState.pos.z - DRIFT_C.z) < DRIFT_C.r;
  const sliding = grounded && latSpeed > 3.5 && Math.abs(speedFwd) > 6;
  if (inCircle && sliding) {
    drift.run += latSpeed * Math.abs(speedFwd) * dt * 0.45;
    drift.idle = 0;
  } else if (drift.run > 0) {
    drift.idle += dt;
    if (drift.idle > 1.4) {
      /* bank the run */
      if (drift.run >= 40) {
        const L = I18N[lang];
        const pts = Math.round(drift.run);
        let msg = `${L['t-drift']} · ${pts}`;
        if (!drift.best || pts > drift.best) {
          drift.best = pts;
          msg += `\n${L['ch-newbest']}`;
          try { localStorage.setItem('driftBest', String(pts)); } catch (e) {}
        }
        showToast(msg);
      }
      drift.run = 0;
      drift.idle = 0;
    }
  }
  drift.score = Math.round(drift.run);
}

/* ---------- bowling ---------- */
const pins = [];
const bowl = { hit: false, settle: 0, best: null };

function buildPins() {
  const pinGeo = new THREE.CapsuleGeometry(0.24, 0.72, 4, 10);
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.35 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd8242a, roughness: 0.4 });
  const stripeGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10);
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) {
      const x = 205 + (i - row / 2) * 1.25;
      const z = 80 + row * 1.6;
      const mesh = new THREE.Group();
      const bodyM = new THREE.Mesh(pinGeo, pinMat);
      bodyM.position.y = 0.75;
      bodyM.castShadow = true;
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = 1.02;
      mesh.add(bodyM, stripe);
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      pins.push({ mesh, x0: x, z0: z, vel: new THREE.Vector2(), tip: 0, tipX: 0, tipZ: 0, angVel: 0, down: false });
    }
  }
}

function resetPins() {
  for (const p of pins) {
    p.mesh.position.set(p.x0, 0, p.z0);
    p.mesh.rotation.set(0, 0, 0);
    p.vel.set(0, 0);
    p.tip = 0; p.angVel = 0; p.down = false;
  }
  bowl.hit = false;
  bowl.settle = 0;
}

function collidePins(s) {
  if (s.pos.y > 1.6) return;
  const carSpeed = Math.hypot(s.vel.x, s.vel.y);
  if (carSpeed < 1) return;
  for (const p of pins) {
    if (p.down && p.tip > 1.3) continue;              // already flat
    const dx = p.mesh.position.x - s.pos.x;
    const dz = p.mesh.position.z - s.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < CAR_R + 0.35) {
      const dd = d || 0.001;
      const nx = dx / dd, nz = dz / dd;
      p.vel.set(s.vel.x * 0.75 + nx * 5, s.vel.y * 0.75 + nz * 5);
      p.angVel = 5 + Math.random() * 4;
      p.tipX = -nz; p.tipZ = nx;                      // fall away from the hit
      if (!bowl.hit) { bowl.hit = true; bowl.settle = 0; }
      s.vel.multiplyScalar(0.96);
    }
  }
}

function updatePins(dt) {
  let moving = false;
  for (const p of pins) {
    if (p.vel.lengthSq() > 0.02) {
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.z += p.vel.y * dt;
      p.vel.multiplyScalar(Math.exp(-2.6 * dt));
      moving = true;
    }
    if (p.angVel > 0.01) {
      p.tip = Math.min(1.45, p.tip + p.angVel * dt);
      p.angVel *= Math.exp(-1.4 * dt);
      p.mesh.rotation.set(p.tipX * p.tip, 0, p.tipZ * p.tip);
      moving = true;
    }
    if (p.tip > 0.75) p.down = true;
  }
  if (bowl.hit && !moving) {
    bowl.settle += dt;
    if (bowl.settle > 2.2) {
      const down = pins.filter(p => p.down).length;
      const L = I18N[lang];
      let msg = down === 10 ? L['t-strike'] : `${L['t-pins']} · ${down}/10`;
      if (down > 0 && (!bowl.best || down > bowl.best)) {
        bowl.best = down;
        if (down < 10) msg += `\n${L['ch-newbest']}`;
        try { localStorage.setItem('bowlBest', String(down)); } catch (e) {}
      }
      if (down > 0) showToast(msg);
      resetPins();
    }
  }
}

/* ---------- shared helpers ---------- */

/* did the car cross a plane this frame, inside a radius around a point? */
const _prevCarPos = new THREE.Vector3();
function planeCross(cx, cy, cz, nx, ny, nz, radius) {
  const p0 = _prevCarPos, p1 = carState.pos;
  const d0 = (p0.x - cx) * nx + (p0.y - cy) * ny + (p0.z - cz) * nz;
  const d1 = (p1.x - cx) * nx + (p1.y - cy) * ny + (p1.z - cz) * nz;
  if (d0 * d1 > 0 || d0 === d1) return false;
  const t = d0 / (d0 - d1);
  const ix = p0.x + (p1.x - p0.x) * t - cx;
  const iy = p0.y + (p1.y - p0.y) * t - cy;
  const iz = p0.z + (p1.z - p0.z) * t - cz;
  return Math.hypot(ix, iy, iz) < radius;
}

/* ---------- challenge HUD ---------- */
const hudChallenge = document.getElementById('hudChallenge');
const chProgress = document.getElementById('chProgress');
const chTime = document.getElementById('chTime');
const chBest = document.getElementById('chBest');
const hudToast = document.getElementById('hudToast');
const mapNameEl = document.getElementById('mapName');
let toastTimer = 0;

function showToast(text) {
  hudToast.textContent = text;
  hudToast.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hudToast.classList.remove('is-show'), 3800);
}

/* bests — restored from localStorage */
try {
  const f = (k) => { const v = parseFloat(localStorage.getItem(k)); return isFinite(v) && v > 0 ? v : null; };
  challenge.best = f('skyBest');
  lap.best = f('lapBest');
  fire.best = f('fireBest');
  jump.best = f('jumpBest');
  drift.best = (() => { const v = parseInt(localStorage.getItem('driftBest')); return isFinite(v) && v > 0 ? v : null; })();
  bowl.best = (() => { const v = parseInt(localStorage.getItem('bowlBest')); return isFinite(v) && v > 0 ? v : null; })();
} catch (e) {}

function resetActivities() {
  challenge.active = false; challenge.t = 0; challenge.next = 0;
  for (const r of rings) {
    r.mesh.material.emissive.setHex(0x66d9ff);
    r.mesh.material.opacity = 0.55;
    r.mesh.scale.setScalar(1);
  }
  lap.active = false; lap.t = 0; lap.expected = 0;
  fire.active = false; fire.t = 0; fire.next = 0;
  for (const fr of fireRings) {
    fr.mesh.material.emissive.setHex(0xff6a00);
    fr.mesh.material.opacity = 0.85;
  }
  jumpRun = false;
  drift.run = 0; drift.idle = 0; drift.score = 0;
  resetPins();
}

function refreshZoneLabel() {
  const d = DISTRICTS.find(d => d.id === currentZoneId);
  mapNameEl.textContent = I18N[lang][d.nameKey];
}

/* one HUD panel, content follows the current activity */
function updateActivityHUD(zoneId) {
  const L = I18N[lang];
  const s = carState;
  let show = true;
  if (s.fly) {
    chProgress.textContent = challenge.active ? `${challenge.next}/${rings.length}` : L['ch-wait'];
    chTime.textContent = challenge.t.toFixed(1) + 's';
    chBest.textContent = challenge.best ? `${L['ch-best']} ${challenge.best.toFixed(1)}s` : '';
  } else if (zoneId === 'circuit') {
    chProgress.textContent = lap.active ? `${L['a-gate']} ${lap.expected}/4` : L['a-lapstart'];
    chTime.textContent = lap.t.toFixed(1) + 's';
    chBest.textContent = lap.best ? `${L['ch-best']} ${lap.best.toFixed(1)}s` : '';
  } else if (zoneId === 'drift') {
    chProgress.textContent = L['a-driftgo'];
    chTime.textContent = String(Math.round(drift.run));
    chBest.textContent = drift.best ? `${L['ch-best']} ${drift.best}` : '';
  } else if (zoneId === 'bowl') {
    chProgress.textContent = L['a-bowlgo'];
    chTime.textContent = `${pins.filter(p => p.down).length}/10`;
    chBest.textContent = bowl.best ? `${L['ch-best']} ${bowl.best}/10` : '';
  } else if (zoneId === 'jump') {
    chProgress.textContent = L['a-jumpgo'];
    chTime.textContent = jump.last ? jump.last.toFixed(1) + 'm' : '—';
    chBest.textContent = jump.best ? `${L['ch-best']} ${jump.best.toFixed(1)}m` : '';
  } else if (zoneId === 'fire') {
    chProgress.textContent = fire.active ? `${L['a-fire']} ${fire.next}/${fireRings.length}` : L['a-fire'];
    chTime.textContent = fire.t.toFixed(1) + 's';
    chBest.textContent = fire.best ? `${L['ch-best']} ${fire.best.toFixed(1)}s` : '';
  } else {
    show = false;
  }
  hudChallenge.classList.toggle('is-hidden', !show);
}

/* per-frame activity update, called from tick after physics */
function updateActivities(dt, wasGrounded, latSpeed, speedFwd) {
  const s = carState;
  const zoneId = zoneAt(s.pos.x, s.pos.z);
  if (zoneId !== currentZoneId) {
    currentZoneId = zoneId;
    refreshZoneLabel();
  }
  /* sky rings — only meaningful while flying */
  if (s.fly) {
    if (challenge.active) challenge.t += dt;
    const r = rings[challenge.next];
    if (r && planeCross(r.center.x, r.center.y, r.center.z, r.normal.x, r.normal.y, r.normal.z, r.radius)) {
      onRingPassed();
    }
    const target = rings[challenge.next];
    if (target) {
      target.mesh.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5) * 0.06);
      target.mesh.material.emissive.setHex(0xccff00);
      target.mesh.material.opacity = 0.85 + Math.sin(clock.elapsedTime * 5) * 0.15;
    }
  }
  /* circuit */
  if (lap.active) lap.t += dt;
  checkGates();
  /* fire rings + flame flicker */
  if (fire.active) fire.t += dt;
  checkFirePass();
  for (const fr of fireRings) {
    fr.light.intensity = 5 + Math.sin(clock.elapsedTime * 17 + fr.center.x) * 1.6 + Math.random() * 0.8;
  }
  /* long jump */
  checkJump(wasGrounded, s);
  /* drift */
  updateDrift(dt, latSpeed, speedFwd, s.grounded);
  /* bowling */
  collidePins(s);
  updatePins(dt);
  /* HUD */
  updateActivityHUD(currentZoneId);
}

function onRingPassed() {
  const L = I18N[lang];
  if (challenge.next === 0) {
    challenge.active = true;
    challenge.t = 0;
    challenge.next = 1;
    showToast(L['ch-go']);
  } else if (challenge.next === rings.length - 1) {
    challenge.active = false;
    const t = challenge.t;
    let msg = `${L['ch-finish']} · ${t.toFixed(1)}s`;
    if (!challenge.best || t < challenge.best) {
      challenge.best = t;
      msg += `\n${L['ch-newbest']}`;
      try { localStorage.setItem('skyBest', String(t)); } catch (e) {}
    } else {
      msg += `\n${L['ch-best']} ${challenge.best.toFixed(1)}s`;
    }
    showToast(msg);
    challenge.next = 0;
    challenge.t = 0;
  } else {
    challenge.next++;
  }
  for (let i = 0; i < rings.length; i++) {
    const m = rings[i].mesh.material;
    if (challenge.active && i < challenge.next) {
      m.emissive.setHex(0xccff00);
      m.opacity = 0.35;
    } else {
      m.emissive.setHex(0x66d9ff);
      m.opacity = 0.55;
    }
  }
}

const checkerTex = makeCheckerTexture();

/* ----------------------------------------------------------
   5. Input — keyboard + touch, smoothed for a linear feel
   ---------------------------------------------------------- */
const input = { throttle: 0, steer: 0, drift: false };   // smoothed values
const keys = new Set();

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'drift',
  KeyQ: 'yawL', KeyE: 'yawR',
  ShiftLeft: 'nitro', ShiftRight: 'nitro'
};

window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); dimHint(); }
  if (e.code === 'KeyR') resetCar();
  if (e.code === 'KeyC') cycleCamera();
  if (e.code === 'KeyM') teleportNext();
  if (/^Digit[1-4]$/.test(e.code)) switchVehicle(+e.code.slice(5) - 1);
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]);
});

const touch = { up: false, down: false, left: false, right: false };
function bindTouch(id, key) {
  const el = document.getElementById(id);
  const on = (e) => { e.preventDefault(); touch[key] = true; el.classList.add('is-on'); dimHint(); };
  const off = (e) => { e.preventDefault(); touch[key] = false; el.classList.remove('is-on'); };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
}
bindTouch('tGas', 'up');
bindTouch('tBrake', 'down');
bindTouch('tLeft', 'left');
bindTouch('tRight', 'right');
/* touch thrust button doubles as the handbrake on ground rides */
bindTouch('tFly', 'drift');

let hintDimmed = false;
function dimHint() {
  if (hintDimmed) return;
  hintDimmed = true;
  setTimeout(() => hintEl.classList.add('is-dim'), 2500);
}

/* ----------------------------------------------------------
   6. Tire smoke — pooled point sprites with per-particle
      size/alpha via a tiny shader
   ---------------------------------------------------------- */
function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const SMOKE_MAX = 320;
const smokePos = new Float32Array(SMOKE_MAX * 3);
const smokeSize = new Float32Array(SMOKE_MAX);
const smokeAlpha = new Float32Array(SMOKE_MAX);
const smokePool = [];
for (let i = 0; i < SMOKE_MAX; i++) {
  smokePool.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grow: 1 });
  smokePos[i * 3 + 1] = -50; // parked below the map
}

const smokeGeo = new THREE.BufferGeometry();
smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
smokeGeo.setAttribute('aSize', new THREE.BufferAttribute(smokeSize, 1));
smokeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(smokeAlpha, 1));
const smokeMat = new THREE.ShaderMaterial({
  uniforms: { uMap: { value: makeSmokeTexture() } },
  transparent: true,
  depthWrite: false,
  vertexShader: `
    attribute float aSize;
    attribute float aAlpha;
    varying float vAlpha;
    void main() {
      vAlpha = aAlpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (240.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform sampler2D uMap;
    varying float vAlpha;
    void main() {
      vec4 tex = texture2D(uMap, gl_PointCoord);
      gl_FragColor = vec4(vec3(0.82, 0.84, 0.78), tex.a * vAlpha);
    }`
});
const smoke = new THREE.Points(smokeGeo, smokeMat);
smoke.frustumCulled = false;
scene.add(smoke);

let smokeCursor = 0;
function spawnSmoke(x, y, z, vx, vy, vz) {
  const p = smokePool[smokeCursor];
  const i = smokeCursor;
  smokeCursor = (smokeCursor + 1) % SMOKE_MAX;
  p.maxLife = 0.8 + Math.random() * 0.6;
  p.life = p.maxLife;
  p.vx = vx + (Math.random() - 0.5) * 1.4;
  p.vy = vy + 0.8 + Math.random() * 1.2;
  p.vz = vz + (Math.random() - 0.5) * 1.4;
  p.grow = 2.4 + Math.random() * 1.6;
  smokePos[i * 3] = x + (Math.random() - 0.5) * 0.5;
  smokePos[i * 3 + 1] = y;
  smokePos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
  smokeSize[i] = 1.1;
}

function updateSmoke(dt) {
  for (let i = 0; i < SMOKE_MAX; i++) {
    const p = smokePool[i];
    if (p.life <= 0) { smokeAlpha[i] = 0; continue; }
    p.life -= dt;
    const t = Math.max(0, p.life / p.maxLife);
    smokePos[i * 3] += p.vx * dt;
    smokePos[i * 3 + 1] += p.vy * dt;
    smokePos[i * 3 + 2] += p.vz * dt;
    p.vy += 1.6 * dt;                     // smoke rises
    smokeSize[i] += p.grow * dt;          // …and expands
    smokeAlpha[i] = t * 0.6;
  }
  smokeGeo.attributes.position.needsUpdate = true;
  smokeGeo.attributes.aSize.needsUpdate = true;
  smokeGeo.attributes.aAlpha.needsUpdate = true;
}

/* --- jet exhaust — additive cyan streaks under the tesla --- */
const JET_MAX = 520;
const jetPos = new Float32Array(JET_MAX * 3);
const jetSize = new Float32Array(JET_MAX);
const jetAlpha = new Float32Array(JET_MAX);
const jetPool = [];
for (let i = 0; i < JET_MAX; i++) {
  jetPool.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0 });
  jetPos[i * 3 + 1] = -50;
}
const jetGeo = new THREE.BufferGeometry();
jetGeo.setAttribute('position', new THREE.BufferAttribute(jetPos, 3));
jetGeo.setAttribute('aSize', new THREE.BufferAttribute(jetSize, 1));
jetGeo.setAttribute('aAlpha', new THREE.BufferAttribute(jetAlpha, 1));
const jetMat = new THREE.ShaderMaterial({
  uniforms: { uMap: { value: smokeMat.uniforms.uMap.value } },
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: smokeMat.vertexShader,
  fragmentShader: `
    uniform sampler2D uMap;
    varying float vAlpha;
    void main() {
      vec4 tex = texture2D(uMap, gl_PointCoord);
      gl_FragColor = vec4(vec3(0.45, 0.8, 1.0), tex.a * vAlpha);
    }`
});
const jetPoints = new THREE.Points(jetGeo, jetMat);
jetPoints.frustumCulled = false;
scene.add(jetPoints);

let jetCursor = 0;
function spawnJet(x, y, z, vx, vy, vz) {
  const p = jetPool[jetCursor];
  const i = jetCursor;
  jetCursor = (jetCursor + 1) % JET_MAX;
  p.maxLife = 0.28 + Math.random() * 0.22;
  p.life = p.maxLife;
  p.vx = vx + (Math.random() - 0.5) * 2.2;
  p.vy = vy - Math.random() * 3;
  p.vz = vz + (Math.random() - 0.5) * 2.2;
  jetPos[i * 3] = x;
  jetPos[i * 3 + 1] = y;
  jetPos[i * 3 + 2] = z;
  jetSize[i] = 0.7 + Math.random() * 0.5;
}

function updateJets(dt) {
  for (let i = 0; i < JET_MAX; i++) {
    const p = jetPool[i];
    if (p.life <= 0) { jetAlpha[i] = 0; continue; }
    p.life -= dt;
    const t = Math.max(0, p.life / p.maxLife);
    jetPos[i * 3] += p.vx * dt;
    jetPos[i * 3 + 1] += p.vy * dt;
    jetPos[i * 3 + 2] += p.vz * dt;
    p.vy -= 6 * dt;                        // exhaust accelerates downward
    jetSize[i] *= 1 + 1.8 * dt;            // plume widens as it falls
    jetAlpha[i] = t * 0.85;
  }
  jetGeo.attributes.position.needsUpdate = true;
  jetGeo.attributes.aSize.needsUpdate = true;
  jetGeo.attributes.aAlpha.needsUpdate = true;
}

/* ----------------------------------------------------------
   7. Driving physics — drift-friendly arcade model + flight
   ---------------------------------------------------------- */
const carState = {
  pos: new THREE.Vector3(0, 0, 12),
  heading: Math.PI,
  vel: new THREE.Vector2(),
  vy: 0,
  grounded: true,
  fly: false,            // tesla thruster mode
  pitchA: 0, pitchV: 0,  // flip angles (tesla flight): W front-flip, S back-flip
  rollA: 0, rollV: 0,    // Q roll left, E roll right
  groundRate: 0,       // vertical speed implied by the ramp slope
  lastRamp: null,      // ramp we were grounded on (for lip detection)
  steerVisual: 0
};

/* tesla flight tuning */
const FLY = {
  lift: 34,          // vertical accel with thrusters held
  gravity: 21,       // near-real pull — you must keep the burn going
  maxRise: 16,
  maxDrop: 30,
  vDamp: 0.55,
  strafeAcc: 22,     // A/D sideways
  flipRate: 4.6,     // rad/s while a flip key is held
  flipResp: 5.5,     // how fast angular velocity ramps up
  gyroK: 7,          // self-righting spring once a flip key is released
  hDamp: 0.9,
  maxSpeed: 38,
  nitroMul: 1.8,
  nitroAcc: 34,      // Shift: tail-nozzle forward boost
  ceiling: 55
};

function resetCar() {
  carState.pos.set(0, 0, 12);
  carState.heading = Math.PI;
  carState.vel.set(0, 0);
  carState.vy = 0;
  carState.groundRate = 0;
  carState.fly = false;
  carState.grounded = true;
  carState.pitchA = carState.pitchV = 0;
  carState.rollA = carState.rollV = 0;
  resetActivities();   // R also restarts every activity run
}

const CAM_MODES = [
  { dist: 9.5, height: 4.4, label: 'chase' },
  { dist: 15, height: 8.5, label: 'high' },
  { dist: 5.6, height: 2.2, label: 'low' }
];
let camMode = 0;
function cycleCamera() { camMode = (camMode + 1) % CAM_MODES.length; }

const speedNum = document.getElementById('speedNum');
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 8, -6);
const forward = new THREE.Vector3();

/* speed lines */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const P_COUNT = 240;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(P_COUNT * 3);
for (let i = 0; i < P_COUNT; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 70;
  pPos[i * 3 + 1] = Math.random() * 14 + 0.5;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({
  color: 0xccff00, size: 0.14, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false
});
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

/* --- collision helpers --- */

/* push a cone away from the car's spine capsule */
function collideCones(s) {
  // cones are ~1.15 tall — no contact while the car is flying well above them
  if (s.pos.y > 1.35) return;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const ax = s.pos.x + fx * CAR_HALF, az = s.pos.z + fz * CAR_HALF;
  const bx = s.pos.x - fx * CAR_HALF, bz = s.pos.z - fz * CAR_HALF;
  const carSpeed = Math.hypot(s.vel.x, s.vel.y);
  const fling = Math.min(20, 4.5 + carSpeed * 0.6);
  for (const c of cones) {
    // point-to-segment distance (2D)
    const px = c.mesh.position.x, pz = c.mesh.position.z;
    const abx = bx - ax, abz = bz - az;
    const t = Math.max(0, Math.min(1,
      ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz)));
    const cx = ax + abx * t, cz = az + abz * t;
    let nx = px - cx, nz = pz - cz;
    const d = Math.hypot(nx, nz);
    const minD = c.r + CAR_R;
    if (d < minD) {
      const dd = d || 0.001;
      nx /= dd; nz /= dd;
      c.mesh.position.x = cx + nx * minD;
      c.mesh.position.z = cz + nz * minD;
      // fling it clear of the bodywork and into the air, never under the floor
      c.vel.set(s.vel.x * 0.8 + nx * fling, s.vel.y * 0.8 + nz * fling);
      c.vy = 4 + Math.random() * 3 + (s.pos.y > 0.25 ? 3.5 : 0);
      c.angVel = 6 + Math.random() * 5;
      c.tip = Math.min(1, c.tip + 0.8);
      s.vel.multiplyScalar(0.985);
      // landing on a cone pops it out and gives the car a tiny bounce
      if (!s.grounded && s.pos.y > 0.3) s.vy = Math.max(s.vy, 2.2);
    }
  }
}

/* accurate OBB collision — car treated as a circle of CAR_R */
function collideBlocks(s) {
  for (const b of blocks) {
    if (s.pos.y > b.h + 0.4) continue;   // flying clean over it
    const dx = s.pos.x - b.x;
    const dz = s.pos.z - b.z;
    const lx = dx * b.cos - dz * b.sin;
    const lz = dx * b.sin + dz * b.cos;
    const ex = b.hw + CAR_R;
    const ez = b.hd + CAR_R;
    if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
      // push out along the axis of least penetration (local frame)
      const px = ex - Math.abs(lx);
      const pz = ez - Math.abs(lz);
      let nlx = 0, nlz = 0;
      if (px < pz) nlx = Math.sign(lx) || 1;
      else nlz = Math.sign(lz) || 1;
      // local normal back to world: R(yaw)
      const nx = nlx * b.cosB + nlz * b.sinB;
      const nz = -nlx * b.sinB + nlz * b.cosB;
      const push = Math.min(px, pz);
      s.pos.x += nx * push;
      s.pos.z += nz * push;
      const dot = s.vel.x * nx + s.vel.y * nz;
      if (dot < 0) {
        s.vel.x -= dot * nx * 1.35;
        s.vel.y -= dot * nz * 1.35;
      }
    }
  }
}

/* ramp walls: if the surface is far above the car, it is a wall */
function collideRampWalls(s) {
  for (const r of ramps) {
    const dx = s.pos.x - r.x;
    const dz = s.pos.z - r.z;
    const lx = dx * r.cos - dz * r.sin;
    const lz = dx * r.sin + dz * r.cos;
    const ex = r.w / 2 + CAR_R;
    const ez = r.l / 2 + CAR_R;
    if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) continue;
    if (lz < -r.l / 2 + 1.2) continue;   // low-edge band: always climbable
    const surfH = Math.max(0, Math.min(1, (lz + r.l / 2) / r.l)) * r.h;
    if (surfH - s.pos.y <= 0.8) continue;  // gentle enough: it's a slope, not a wall
    const px = ex - Math.abs(lx);
    const pz = ez - Math.abs(lz);
    let nlx = 0, nlz = 0;
    if (px < pz) nlx = Math.sign(lx) || 1;
    else nlz = Math.sign(lz) || 1;
    // local normal back to world: R(yaw) — x' = x·cos + z·sin, z' = −x·sin + z·cos
    const nx = nlx * r.cos + nlz * r.sin;
    const nz = -nlx * r.sin + nlz * r.cos;
    const push = Math.min(px, pz);
    s.pos.x += nx * push;
    s.pos.z += nz * push;
    const dot = s.vel.x * nx + s.vel.y * nz;
    if (dot < 0) {
      s.vel.x -= dot * nx * 1.3;
      s.vel.y -= dot * nz * 1.3;
    }
  }
}

/* ----------------------------------------------------------
   8. Main loop — with physics substeps so nothing tunnels
   ---------------------------------------------------------- */
const clock = new THREE.Clock();
let prevDrift = false;   // Space edge-detect: takeoff needs a fresh press

/* tesla flight — Space lift, A/D strafe, W/S front/back flips,
   Q/E left/right rolls, Shift tail-nozzle nitro */
function flyStep(s, dt) {
  const fwdX = Math.sin(s.heading);
  const fwdZ = Math.cos(s.heading);
  const rightX = Math.cos(s.heading);
  const rightZ = -Math.sin(s.heading);

  const thrust = keys.has('drift');            // Space
  const nitro = keys.has('nitro');
  const nitroMul = nitro ? FLY.nitroMul : 1;

  /* vertical — real gravity pull, thrusters must be held to stay up */
  const liftAcc = thrust ? FLY.lift * nitroMul : 0;
  s.vy += (liftAcc - FLY.gravity) * dt;
  s.vy *= Math.exp(-FLY.vDamp * dt);
  s.vy = Math.max(-FLY.maxDrop, Math.min(FLY.maxRise * nitroMul, s.vy));

  /* horizontal — A/D strafe, Shift boosts along the nose.
     steer is L-positive but the screen-right vector here is mirrored,
     so strafe = +steer puts D on screen-right (verified in headless). */
  const strafe = input.steer;
  let ax = rightX * strafe * FLY.strafeAcc;
  let az = rightZ * strafe * FLY.strafeAcc;
  if (nitro) { ax += fwdX * FLY.nitroAcc; az += fwdZ * FLY.nitroAcc; }
  s.vel.x += ax * dt;
  s.vel.y += az * dt;
  const hd = Math.exp(-FLY.hDamp * dt);
  s.vel.x *= hd;
  s.vel.y *= hd;
  const hSpeed = s.vel.length();
  const hMax = FLY.maxSpeed * nitroMul;
  if (hSpeed > hMax) s.vel.multiplyScalar(hMax / hSpeed);

  /* flips — W nose-down front flip, S back flip, Q/E barrel rolls.
     Q dips the screen-left side: rotation.z must go NEGATIVE here. */
  const pitchIn = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
  const rollIn = (keys.has('yawR') ? 1 : 0) - (keys.has('yawL') ? 1 : 0);
  const resp = Math.min(1, dt * FLY.flipResp);
  s.pitchV += (pitchIn * FLY.flipRate - s.pitchV) * resp;
  s.rollV += (rollIn * FLY.flipRate - s.rollV) * resp;
  /* gyro: once a flip key is released, spring back to the nearest
     level attitude — the car can never be parked upside-down */
  const TAU = Math.PI * 2;
  if (!pitchIn) s.pitchV += (Math.round(s.pitchA / TAU) * TAU - s.pitchA) * FLY.gyroK * dt;
  if (!rollIn) s.rollV += (Math.round(s.rollA / TAU) * TAU - s.rollA) * FLY.gyroK * dt;
  /* parked level? drop accumulated whole turns so the angle never
     grows into multiples of 2π (they leak into the jump visuals).
     The mesh gets the same wrap via s.wrapX/wrapZ — no visual jump. */
  if (!pitchIn && Math.abs(s.pitchV) < 0.05) {
    const w = Math.round(s.pitchA / TAU) * TAU;
    if (w !== 0 && Math.abs(s.pitchA - w) < 0.02) { s.pitchA -= w; s.wrapX = (s.wrapX || 0) - w; }
  }
  if (!rollIn && Math.abs(s.rollV) < 0.05) {
    const w = Math.round(s.rollA / TAU) * TAU;
    if (w !== 0 && Math.abs(s.rollA - w) < 0.02) { s.rollA -= w; s.wrapZ = (s.wrapZ || 0) - w; }
  }
  s.pitchA += s.pitchV * dt;
  s.rollA += s.rollV * dt;

  s.pos.x += s.vel.x * dt;
  s.pos.z += s.vel.y * dt;
  s.pos.y += s.vy * dt;

  /* ceiling + landing */
  if (s.pos.y > FLY.ceiling) { s.pos.y = FLY.ceiling; s.vy = Math.min(s.vy, 0); }
  const groundInfo = rampInfoAt(s.pos.x, s.pos.z);
  const ground = groundInfo.h;
  if (s.pos.y <= ground && s.vy <= 0) {
    s.pos.y = ground;
    s.vy = 0;
    s.fly = false;
    s.grounded = true;
    s.groundRate = 0;
    s.lastRamp = groundInfo.ramp;
    /* touchdown: kill all spin and level the ATTITUDE state — the
       visual layer snaps along with it (s.justLanded), so there is
       no lerp-rotation and no 2π residue after landing */
    s.pitchA = 0;
    s.rollA = 0;
    s.pitchV = 0;
    s.rollV = 0;
    s.justLanded = true;
  }
  s.lastGround = ground;

  return { speedFwd: s.vel.dot(new THREE.Vector2(fwdX, fwdZ)), latSpeed: 0, thrust, nitro, strafe };
}

function physicsStep(s, dt) {
  if (s.fly) return flyStep(s, dt);

  const fwdX = Math.sin(s.heading);
  const fwdZ = Math.cos(s.heading);
  let speedFwd = s.vel.x * fwdX + s.vel.y * fwdZ;
  let latX = s.vel.x - fwdX * speedFwd;
  let latZ = s.vel.y - fwdZ * speedFwd;
  const latSpeed = Math.hypot(latX, latZ);

  /* longitudinal — smoothed throttle makes pedal travel feel linear */
  const groundNitro = VEHICLES[vehIndex].fly && keys.has('nitro') ? 1.7 : 1;
  const maxNow = TUNE.maxSpeed * (groundNitro > 1 ? 1.18 : 1);
  if (input.throttle > 0) {
    speedFwd += TUNE.accel * groundNitro * input.throttle * dt * (1 - Math.max(0, speedFwd) / maxNow);
  } else if (input.throttle < 0) {
    if (speedFwd > 0.5) speedFwd += TUNE.brake * input.throttle * dt;
    else speedFwd = Math.max(speedFwd + TUNE.accel * 0.6 * input.throttle * dt, -TUNE.reverseMax);
  }
  // airborne: barely any resistance, so jumps carry far
  const dragNow = s.grounded ? TUNE.drag : TUNE.drag * 0.25;
  speedFwd -= speedFwd * dragNow * dt;
  if (s.grounded) {
    speedFwd -= Math.sign(speedFwd) * Math.min(Math.abs(speedFwd), TUNE.rollResist * dt);
  }

  /* steering — needs rolling speed (no spinning in place),
     full lock at crawl, less lock at high speed */
  const speedAbs = Math.abs(speedFwd);
  const steerAuthority = Math.min(1, speedAbs / 6) / (1 + speedAbs / TUNE.steerHighCut);
  s.heading += input.steer * TUNE.steerRate * steerAuthority * dt * Math.sign(speedFwd || 1);

  /* grip — steering hard throws the tail out even at low speed */
  const driftInfluence = Math.min(1, speedAbs / 10);
  const steerFactor = Math.abs(input.steer);
  let grip = TUNE.gripBase * (1 - TUNE.driftSteerLoss * steerFactor * driftInfluence);
  if (input.drift && !VEHICLES[vehIndex].fly) grip = TUNE.gripHand;
  const damp = Math.exp(-grip * dt);
  latX *= damp;
  latZ *= damp;

  /* sliding scrubs forward speed */
  if (latSpeed > 2.5) speedFwd -= Math.sign(speedFwd) * Math.min(speedAbs, latSpeed * TUNE.driftScrub * dt);

  /* rebuild velocity in the OLD frame: the car nose rotates away
     from the velocity vector, and grip is what pulls it back —
     that difference IS the drift */
  s.vel.set(fwdX * speedFwd + latX, fwdZ * speedFwd + latZ);
  s.pos.x += s.vel.x * dt;
  s.pos.z += s.vel.y * dt;

  /* vertical — slope-following, natural launch off the lip */
  const groundInfo = rampInfoAt(s.pos.x, s.pos.z);
  const ground = groundInfo.h;
  if (s.grounded) {
    const rate = (ground - (s.lastGround ?? ground)) / dt;
    if (ground < s.pos.y - 0.05) {
      s.grounded = false;
      // Launch ONLY when rolling off the top lip of the ramp we were
      // climbing. Sliding off a side edge just drops — never flings.
      let launch = 0;
      const r = s.lastRamp;
      if (r) {
        const dx = s.pos.x - r.x;
        const dz = s.pos.z - r.z;
        const lz = dx * r.sin + dz * r.cos;
        if (lz > r.l / 2 - 0.2) {
          launch = Math.max(0, Math.min(s.groundRate * TUNE.jumpBoost, TUNE.jumpCap));
        }
      }
      s.vy = launch;
      s.groundRate = 0;
    } else {
      s.groundRate = Math.max(-20, Math.min(20, rate));
      s.pos.y = ground;
      s.lastRamp = groundInfo.ramp;
    }
  }
    if (!s.grounded) {
      // float up light, fall down heavier — hang time at the apex
      const g = s.vy > 0 ? TUNE.gravity * TUNE.gravityUp : TUNE.gravity;
      s.vy -= g * dt;
      s.pos.y += s.vy * dt;
      if (s.pos.y <= ground) {
        s.pos.y = ground;
        s.vy = 0;
        s.grounded = true;
        s.groundRate = 0;
        s.lastRamp = groundInfo.ramp;
      }
    }
  s.lastGround = ground;

  return { speedFwd, latSpeed };
}

/* collisions + rim shared by driving and flight */
function collideWorld(s) {
  collideRampWalls(s);
  collideBlocks(s);
  collideCones(s);

  /* desk rim */
  const distC = Math.hypot(s.pos.x, s.pos.z);
  const maxR = MAP_R - 2;
  if (distC > maxR) {
    const nx = s.pos.x / distC;
    const nz = s.pos.z / distC;
    s.pos.x = nx * maxR;
    s.pos.z = nz * maxR;
    const dot = s.vel.x * nx + s.vel.y * nz;
    if (dot > 0) {
      s.vel.x -= dot * nx * 1.4;
      s.vel.y -= dot * nz * 1.4;
    }
  }
}

const _jetWorld = new THREE.Vector3();
const _jetQuat = new THREE.Quaternion();
const _jetDir = new THREE.Vector3();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);

  /* --- raw input → smoothed (linear pedal / steering feel) --- */
  const up = keys.has('up') || touch.up;
  const down = keys.has('down') || touch.down;
  const left = keys.has('left') || touch.left;
  const right = keys.has('right') || touch.right;
  const throttleTarget = up ? 1 : down ? -1 : 0;
  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  input.throttle += (throttleTarget - input.throttle) * Math.min(1, dt * 6);
  input.steer += (steerTarget - input.steer) * Math.min(1, dt * 8);
  input.drift = keys.has('drift');

  const s = carState;
  const canFly = VEHICLES[vehIndex].fly;

  /* tesla: a fresh Space press fires the thrusters ANYTIME — parked,
     rolling, or already airborne off a ramp (reset needs a fresh press) */
  if (canFly && input.drift && !prevDrift && !s.fly) {
    s.fly = true;
    s.grounded = false;
    s.vy = Math.max(s.vy, 3.5);
  }
  prevDrift = input.drift;

  /* flip angles hard-reset when not flying (landing already snapped
     them; this is just a safety net) */
  if (!s.fly && (s.pitchA || s.rollA || s.pitchV || s.rollV)) {
    s.pitchA = s.rollA = s.pitchV = s.rollV = 0;
  }

  /* --- physics substeps (no tunneling at high speed) --- */
  _prevCarPos.copy(s.pos);   // for gate/ring crossing detection
  const wasGrounded = s.grounded;   // for long-jump takeoff detection
  const speed = s.vel.length();
  const steps = speed * dt > 0.7 ? 3 : 1;
  let result = { speedFwd: 0, latSpeed: 0 };
  for (let i = 0; i < steps; i++) result = physicsStep(s, dt / steps);
  collideWorld(s);
  const { speedFwd, latSpeed } = result;

  /* --- sliding cones settle down --- */
  for (const c of cones) {
    // vertical: knocked cones hop, then fall and settle
    if (c.mesh.position.y > 0.001 || c.vy !== 0) {
      c.vy -= 26 * dt;
      c.mesh.position.y += c.vy * dt;
      if (c.mesh.position.y <= 0) {
        c.mesh.position.y = 0;
        if (c.vy < -4) c.vy = -c.vy * 0.35;  // small bounce on landing
        else c.vy = 0;
      }
    }
    if (c.vel.lengthSq() > 0.01) {
      c.mesh.position.x += c.vel.x * dt;
      c.mesh.position.z += c.vel.y * dt;
      c.vel.multiplyScalar(Math.exp(-3.2 * dt));
      const cd = Math.hypot(c.mesh.position.x, c.mesh.position.z);
      if (cd > MAP_R - 1.5) {
        c.mesh.position.x *= (MAP_R - 1.5) / cd;
        c.mesh.position.z *= (MAP_R - 1.5) / cd;
        c.vel.multiplyScalar(-0.4);
      }
    }
    // cones never sink into blocks (2D OBB pushout)
    for (const b of blocks) {
      const dx = c.mesh.position.x - b.x;
      const dz = c.mesh.position.z - b.z;
      const lx = dx * b.cos - dz * b.sin;
      const lz = dx * b.sin + dz * b.cos;
      const ex = b.hw + c.r, ez = b.hd + c.r;
      if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
        const px = ex - Math.abs(lx), pz = ez - Math.abs(lz);
        let nlx = 0, nlz = 0;
        if (px < pz) nlx = Math.sign(lx) || 1;
        else nlz = Math.sign(lz) || 1;
        c.mesh.position.x = b.x + nlx * b.cosB + nlz * b.sinB;
        c.mesh.position.z = b.z - nlx * b.sinB + nlz * b.cosB;
        c.vel.multiplyScalar(0.6);
      }
    }
    // a cone on a ramp sits on the slope, not inside it
    const g = rampInfoAt(c.mesh.position.x, c.mesh.position.z);
    if (g.h > 0.01 && c.mesh.position.y < g.h - 0.02) {
      c.mesh.position.y = g.h - 0.02;
    }
    if (c.tip > 0) {
      c.tip = Math.max(0, c.tip - dt * 0.25);
      c.mesh.rotation.z = Math.sin(c.tip * Math.PI * 0.5) * 1.2;
      c.mesh.rotation.y += c.angVel * dt;
      c.angVel *= Math.exp(-2.5 * dt);
    }
  }

  /* --- tire smoke while sliding (grounded only) --- */
  const drifting = s.grounded && (latSpeed > 2.3 || (input.drift && !canFly && Math.abs(speedFwd) > 6));
  if (drifting && !reduceMotion) {
    for (const w of wheels) {
      if (!w.rear) continue;
      w.pivot.getWorldPosition(_jetWorld);
      spawnSmoke(_jetWorld.x, _jetWorld.y - w.pivot.position.y + 0.25, _jetWorld.z, s.vel.x * 0.25, 0, s.vel.y * 0.25);
      spawnSmoke(_jetWorld.x, _jetWorld.y - w.pivot.position.y + 0.25, _jetWorld.z, s.vel.x * 0.25, 0, s.vel.y * 0.25);
      spawnSmoke(_jetWorld.x, _jetWorld.y - w.pivot.position.y + 0.25, _jetWorld.z, s.vel.x * 0.25, 0, s.vel.y * 0.25);
    }
  }
  updateSmoke(dt);

  /* --- tesla thrusters: each nozzle fires for its own control ---
     Space → all 4 belly · W → rear pair · S → front pair
     Q → screen-right pair fires (dips screen-left) · E → screen-left pair fires (dips screen-right)
     A → screen-right nozzle · D → screen-left nozzle · Shift → tail (nitro)
     NOTE: corner labels 'l'/'r' are mirrored vs the screen — 'r' sits
     on screen-left when the chase cam looks at the car's back. */
  if (activeVeh.jets) {
    const space = keys.has('drift') && s.fly;
    const wF = keys.has('up') && s.fly;
    const sF = keys.has('down') && s.fly;
    const qF = keys.has('yawL') && s.fly;
    const eF = keys.has('yawR') && s.fly;
    const aF = keys.has('left') && s.fly;
    const dF = keys.has('right') && s.fly;
    const nitro = keys.has('nitro');
    const nitroMul = nitro ? 1.5 : 1;
    let anyFiring = false;

    for (const j of activeVeh.jets) {
      let level = 0;
      if (j.kind === 'belly') {
        if (space) level = Math.max(level, 1);
        if (wF && j.corner[0] === 'r') level = Math.max(level, 0.95);  // rear pair → front flip
        if (sF && j.corner[0] === 'f') level = Math.max(level, 0.95);  // front pair → back flip
        if (qF && j.corner[1] === 'l') level = Math.max(level, 0.95);  // screen-RIGHT pair fires → screen-left dips
        if (eF && j.corner[1] === 'r') level = Math.max(level, 0.95);  // screen-LEFT pair fires → screen-right dips
      } else if (j.kind === 'side') {
        if (aF && j.corner === 'l') level = 1;   // strafe screen-left → screen-right nozzle fires
        if (dF && j.corner === 'r') level = 1;   // strafe screen-right → screen-left nozzle fires
      } else if (j.kind === 'tail') {
        if (nitro && (s.fly || Math.abs(speedFwd) > 1 || input.throttle > 0)) level = 1.2;
      }
      level *= nitroMul;
      if (level > 0.02) anyFiring = true;

      const cur = j.flame.scale.y;
      const next = next0(cur, level, dt);
      j.flame.scale.set(1, next, 1);
      j.flame.visible = next > 0.03;

      if (level > 0.05 && !reduceMotion) {
        j.nozzle.getWorldPosition(_jetWorld);
        j.nozzle.getWorldQuaternion(_jetQuat);
        _jetDir.copy(j.dirLocal).applyQuaternion(_jetQuat);
        const spd = (9 + Math.random() * 5) * level;
        for (let k = 0; k < 3; k++) {
          spawnJet(
            _jetWorld.x + _jetDir.x * 0.3, _jetWorld.y + _jetDir.y * 0.3, _jetWorld.z + _jetDir.z * 0.3,
            _jetDir.x * spd + s.vel.x * 0.25, _jetDir.y * spd + (s.fly ? 0 : s.vy * 0.4), _jetDir.z * spd + s.vel.y * 0.25
          );
        }
      }
    }
    const lightTarget = anyFiring ? (space ? 55 : 34) * (nitro ? 1.5 : 1) : 0;
    activeVeh.jetLight.intensity += (lightTarget - activeVeh.jetLight.intensity) * Math.min(1, dt * 8);
    if (activeVeh.jetLight.intensity < 0.1) activeVeh.jetLight.intensity = 0;
  }
  updateJets(dt);

  /* --- apply to the car mesh --- */
  car.position.copy(s.pos);
  car.rotation.y = s.heading;

  /* whole-turn wraps from the gyro normalize — wrap the mesh by the
     same amount so neither state nor visual accumulates 2π */
  if (s.wrapX) { carBody.rotation.x += s.wrapX; s.wrapX = 0; }
  if (s.wrapZ) { carBody.rotation.z += s.wrapZ; s.wrapZ = 0; }

  s.steerVisual += (input.steer * 0.42 - s.steerVisual) * Math.min(1, dt * 10);
  const speedFactor = Math.min(1, Math.abs(speedFwd) / 30);
  let roll = input.steer * -TUNE.bodyRoll * speedFactor;
  let pitch = (up ? -0.025 : 0) + (down ? 0.035 : 0);
  let pitchLerp = 8;
  let rollA2 = 0;   // roll base (flip angle rides on top)
  if (s.fly) {
    // flight: flip angles accumulate from the fly-step; on top, a hint of
    // climb/dive pitch and strafe bank so translation reads visually
    const hSpeed = Math.hypot(s.vel.x, s.vel.y);
    pitch = s.pitchA - Math.atan2(s.vy, Math.max(10, hSpeed)) * 0.2;
    rollA2 = s.rollA - (result.strafe || 0) * 0.1;
    pitchLerp = 22;   // flip angles are already smoothed by their own dynamics
    carBody.rotation.z += (rollA2 - carBody.rotation.z) * Math.min(1, dt * 22);
  } else if (!s.grounded) {
    pitch += s.pitchA;
    rollA2 = s.rollA;
    // airborne: the nose rides the flight arc — up off the lip, level at
    // the apex, easing down on descent. Never snaps nose-down at takeoff.
    const hSpeed = Math.hypot(s.vel.x, s.vel.y);
    pitch += -Math.atan2(s.vy, Math.max(8, hSpeed)) * 0.85;
    pitch = Math.max(-0.45 + Math.min(0, s.pitchA), Math.min(0.22 + Math.max(0, s.pitchA), pitch));
    pitchLerp = 2.6;   // slow, floaty rotation in the air
    carBody.rotation.z += (rollA2 + roll - carBody.rotation.z) * Math.min(1, dt * 8);
  } else if (s.pos.y > 0.05) {
    // on a ramp: nose up by the ramp's own grade. (Sampling ahead/behind
    // broke at the lip — a point past the top reads flat while the rear
    // still reads high, which flipped the nose DOWN right at takeoff.)
    const onRamp = rampInfoAt(s.pos.x, s.pos.z).ramp;
    if (onRamp) pitch -= Math.atan2(onRamp.h, onRamp.l);
    carBody.rotation.z += (roll - carBody.rotation.z) * Math.min(1, dt * 8);
  } else {
    carBody.rotation.z += (roll - carBody.rotation.z) * Math.min(1, dt * 8);
  }
  if (s.justLanded) {
    // touchdown: snap the body level in ONE step — a spin-lerp back
    // from a half-finished flip is exactly the "twitch" on landing
    carBody.rotation.x = pitch;
    carBody.rotation.z = s.fly ? rollA2 : roll;
    s.justLanded = false;
  }
  carBody.rotation.x += (pitch - carBody.rotation.x) * Math.min(1, dt * pitchLerp);

  for (const w of wheels) {
    w.spin.rotation.x += (speedFwd / WHEEL_R) * dt;
    if (w.steerable) w.pivot.rotation.y = s.steerVisual;
  }

  /* --- chase camera --- */
  const mode = CAM_MODES[camMode];
  const nFwdX = Math.sin(s.heading);
  const nFwdZ = Math.cos(s.heading);
  const camLift = VEHICLES[vehIndex].camH + (s.fly ? Math.min(9, s.pos.y * 0.4) : 0);
  const camBack = s.fly ? Math.min(5, s.pos.y * 0.2) : 0;
  forward.set(nFwdX, 0, nFwdZ);
  camTarget.copy(s.pos).addScaledVector(forward, -(mode.dist + camBack));
  camTarget.y = s.pos.y + mode.height + camLift;
  const lerpK = 1 - Math.exp(-dt * 4.5);
  camPos.lerp(camTarget, lerpK);
  camera.position.copy(camPos);
  camera.lookAt(s.pos.x + nFwdX * 4, s.pos.y + 1.2, s.pos.z + nFwdZ * 4);
  let targetFov = 62 + Math.min(1, speed / TUNE.maxSpeed) * 12;
  if (canFly && keys.has('nitro')) targetFov += 9;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
    camera.updateProjectionMatrix();
  }

  sun.position.set(s.pos.x + 30, 50 + s.pos.y * 0.5, s.pos.z - 20);
  sun.target.position.copy(s.pos);

  /* --- speed lines --- */
  if (!reduceMotion) {
    const pArr = pGeo.attributes.position.array;
    const rel = speed * dt * 0.85;
    for (let i = 0; i < P_COUNT; i++) {
      pArr[i * 3] -= nFwdX * rel;
      pArr[i * 3 + 2] -= nFwdZ * rel;
      let rx = pArr[i * 3] - s.pos.x;
      let rz = pArr[i * 3 + 2] - s.pos.z;
      if (Math.abs(rx) > 35) pArr[i * 3] = s.pos.x - Math.sign(rx) * 35 + (Math.random() - 0.5) * 4;
      if (Math.abs(rz) > 35) pArr[i * 3 + 2] = s.pos.z - Math.sign(rz) * 35 + (Math.random() - 0.5) * 4;
      if (pArr[i * 3 + 1] > 16 + s.pos.y) pArr[i * 3 + 1] = s.pos.y + 0.5;
    }
    pGeo.attributes.position.needsUpdate = true;
    pMat.opacity += ((speed > 12 ? 0.5 : 0) - pMat.opacity) * Math.min(1, dt * 3);
  }

  speedNum.textContent = Math.round(Math.abs(speedFwd) * 6);
  speedBox.classList.toggle('is-fly', s.fly);

  /* --- districts & activities (rings, lap, jump, drift, pins, fire) --- */
  updateActivities(dt, wasGrounded, latSpeed, speedFwd);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* flame easing helper (kept out of the loop body for clarity) */
function next0(cur, target, dt) {
  const k = Math.min(1, dt * 9);
  const flicker = target > 0 ? 0.85 + Math.random() * 0.3 : 1;
  return cur + (target * flicker - cur) * k;
}

/* ----------------------------------------------------------
   9. Boot
   ---------------------------------------------------------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* restore the last ride */
let startVeh = 0;
try {
  const saved = localStorage.getItem('veh');
  const idx = VEHICLES.findIndex((v) => v.id === saved);
  if (idx >= 0) startVeh = idx;
} catch (e) {}
switchVehicle(startVeh, true);

/* build the whole world once — districts, rings, pins, fire course */
buildWorld();
buildRings();
buildFireRings();
buildPins();
refreshZoneLabel();

resetCar();
tick();
// debug handle for automated tests
window.__car = carState;
window.__smokeAlive = () => smokePool.filter((p) => p.life > 0).length;
window.__jetsAlive = () => jetPool.filter((p) => p.life > 0).length;
window.__cones = cones;
window.__blocks = blocks;
window.__carBody = () => carBody;
window.__vehicle = () => VEHICLES[vehIndex].id;
window.__setVehicle = (i) => switchVehicle(i);
window.__isFly = () => carState.fly;
window.__zone = () => currentZoneId;
window.__teleport = (i) => { teleportIdx = i - 1; teleportNext(); };
window.__rings = rings;
window.__challenge = challenge;
window.__lap = lap;
window.__fire = fire;
window.__jump = jump;
window.__drift = drift;
window.__pins = pins;
window.__mapInfo = () => ({
  zone: currentZoneId,
  mapR: MAP_R,
  ramps: ramps.map(r => ({ x: r.x, z: r.z })),
  blocks: blocks.length,
  cones: cones.length,
  rings: rings.length,
  pins: pins.length
});
/* debug: report body panels whose world AABB overlaps a wheel's AABB */
window.__clipCheck = () => {
  const out = [];
  const wb = wheels.map((w, i) => ({ i, box: new THREE.Box3().setFromObject(w.pivot) }));
  const meshes = [];
  carBody.traverse((o) => { if (o.isMesh && o.geometry?.type === 'BoxGeometry') meshes.push(o); });
  for (const m of meshes) {
    let p = m, inside = false;
    while (p) { if (wheels.some((w) => w.pivot === p)) { inside = true; break; } p = p.parent; }
    if (inside) continue;
    const mb = new THREE.Box3().setFromObject(m);
    for (const w of wb) {
      const ox = Math.min(mb.max.x, w.box.max.x) - Math.max(mb.min.x, w.box.min.x);
      const oy = Math.min(mb.max.y, w.box.max.y) - Math.max(mb.min.y, w.box.min.y);
      const oz = Math.min(mb.max.z, w.box.max.z) - Math.max(mb.min.z, w.box.min.z);
      if (ox > 0.02 && oy > 0.02 && oz > 0.02) {
        out.push({
          wheel: w.i,
          size: [m.geometry.parameters.width, m.geometry.parameters.height, m.geometry.parameters.depth],
          at: [+m.position.x.toFixed(2), +m.position.y.toFixed(2), +m.position.z.toFixed(2)],
          overlap: [+ox.toFixed(2), +oy.toFixed(2), +oz.toFixed(2)]
        });
      }
    }
  }
  return out;
};
requestAnimationFrame(() => {
  setTimeout(() => document.getElementById('veil').classList.add('is-hidden'), 350);
});
