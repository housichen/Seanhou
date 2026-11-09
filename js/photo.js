/* ============================================================
   PHOTO WALK — a tiny camera simulator on three.js.
   Pick a body (sensor crop), a lens (focal length), aperture /
   shutter / ISO (real exposure math + ISO grain + depth of
   field via a depth-based blur composite). Three golden-hour
   scenes: lake sunrise, city dusk, misty forest.
   ============================================================ */
import * as THREE from './vendor/three.module.js';

/* ----------------------------------------------------------
   0. i18n (shares localStorage 'lang' with the main site)
   ---------------------------------------------------------- */
const I18N = {
  en: {
    back: '← Back',
    title: 'PHOTO WALK',
    subtitle: 'a tiny camera simulator',
    gallery: 'PHOTOS',
    empty: 'no photos yet — press Space to shoot',
    download: 'DOWNLOAD',
    hint: 'WASD move · drag to look · Q/E height · wheel stroll · V viewfinder · Space shoot',
    body: 'BODY', lens: 'LENS', scene: 'SCENE',
    'scene-lake': 'LAKE', 'scene-city': 'CITY', 'scene-forest': 'FOREST',
    loading: 'loading film…'
  },
  zh: {
    back: '← 返回',
    title: '摄影漫步',
    subtitle: '一台小小的相机模拟器',
    gallery: '相册',
    empty: '还没有照片 —— 按空格拍摄',
    download: '下载',
    hint: 'WASD 移动 · 拖拽环视 · Q/E 升降 · 滚轮前后 · V 取景器 · 空格拍摄',
    body: '机身', lens: '镜头', scene: '场景',
    'scene-lake': '湖畔', 'scene-city': '城市', 'scene-forest': '森林',
    loading: '胶卷装载中…'
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
});
applyLang();

/* ----------------------------------------------------------
   1. Renderer / camera / post pipeline
   ---------------------------------------------------------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 800);

/* post: scene (with depth) → half-res blur → composite by CoC */
let rtScene = null, rtBlurA = null, rtBlurB = null;
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postScene = new THREE.Scene();
const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
postScene.add(postCam);
postScene.add(postQuad);

const BLUR_SHADER = {
  uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2() } },
  vertexShader: `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uTexel; varying vec2 vUv;
    void main() {
      vec2 o = uDir * uTexel;
      vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227;
      c += texture2D(tDiffuse, vUv + o * 1.385).rgb * 0.316;
      c += texture2D(tDiffuse, vUv - o * 1.385).rgb * 0.316;
      c += texture2D(tDiffuse, vUv + o * 3.231).rgb * 0.070;
      c += texture2D(tDiffuse, vUv - o * 3.231).rgb * 0.070;
      gl_FragColor = vec4(c, 1.0);
    }`
};

const COMP_SHADER = {
  uniforms: {
    tSharp: { value: null }, tBlur: { value: null }, tDepth: { value: null },
    cameraNear: { value: 0.1 }, cameraFar: { value: 800 },
    uFocus: { value: 12 }, uCoC: { value: 0.2 }
  },
  vertexShader: `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    #include <packing>
    uniform sampler2D tSharp; uniform sampler2D tBlur; uniform sampler2D tDepth;
    uniform float cameraNear; uniform float cameraFar; uniform float uFocus; uniform float uCoC;
    varying vec2 vUv;
    void main() {
      float depth = texture2D(tDepth, vUv).x;
      float viewZ = -perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
      /* circle of confusion: grows with distance from the focus plane */
      float coc = clamp(abs(viewZ - uFocus) / max(viewZ, 0.001) * uCoC, 0.0, 1.0);
      vec4 sharp = texture2D(tSharp, vUv);
      vec4 blur = texture2D(tBlur, vUv);
      gl_FragColor = mix(sharp, blur, smoothstep(0.06, 0.75, coc));
    }`
};

const blurMat = new THREE.ShaderMaterial(BLUR_SHADER);
const compMat = new THREE.ShaderMaterial(COMP_SHADER);

function makeTargets(w, h) {
  if (rtScene) { rtScene.dispose(); rtBlurA.dispose(); rtBlurB.dispose(); }
  const depthTexture = new THREE.DepthTexture(w, h);
  rtScene = new THREE.WebGLRenderTarget(w, h, { depthTexture });
  rtBlurA = new THREE.WebGLRenderTarget(w >> 1, h >> 1);
  rtBlurB = new THREE.WebGLRenderTarget(w >> 1, h >> 1);
}
makeTargets(renderer.domElement.width, renderer.domElement.height);

/* ----------------------------------------------------------
   2. Gear — bodies, lenses, exposure triangle
   ---------------------------------------------------------- */
const BODIES = [
  { name: 'M43', crop: 2.0, grain: 1.3 },
  { name: 'APS-C', crop: 1.5, grain: 1.0 },
  { name: 'FF', crop: 1.0, grain: 0.7 }
];
const LENSES = [16, 24, 35, 50, 85, 200];
const APERTURES = [1.4, 2, 2.8, 4, 8, 16];
const SHUTTERS = [1 / 8000, 1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 60, 1 / 8, 1 / 2, 1];
const ISOS = [100, 200, 400, 800, 1600, 3200, 6400];

const gear = { body: 1, lens: 2, ap: 2, tv: 5, iso: 2 };   // indexes — f/2.8 · 1/250 · ISO400

function focalEff() { return LENSES[gear.lens] / BODIES[gear.body].crop; }
function shutterText(t) { return t >= 1 ? `${t}s` : `1/${Math.round(1 / t)}`; }

/* EV compensation: positive = brighter than the scene's ideal exposure.
   comp = sceneEV + isoTerm - settingsEV  (classic exposure math) */
let sceneEV = 14;      // each scene sets its own reference
let sceneBias = 1;     // per-scene tone-mapping calibration
function evDiff() {
  const ev100 = Math.log2((APERTURES[gear.ap] ** 2) / SHUTTERS[gear.tv]);
  return sceneEV + Math.log2(ISOS[gear.iso] / 100) - ev100;
}
function applyExposure() {
  const comp = evDiff();
  renderer.toneMappingExposure = Math.pow(2, comp * 0.75) * sceneBias;
  const evEl = document.getElementById('evMeter');
  evEl.textContent = `EV ${comp >= 0 ? '+' : ''}${comp.toFixed(1)}`;
  evEl.className = 'expo-ev ' + (Math.abs(comp) <= 1 ? 'ok' : comp > 1 ? 'over' : 'under');
  document.getElementById('expoSettings').textContent =
    `f/${APERTURES[gear.ap]} · ${shutterText(SHUTTERS[gear.tv])} · ISO${ISOS[gear.iso]}`;
  /* viewfinder readout mirrors the same info, EVF style */
  const vfInfo = document.getElementById('vfInfo');
  if (vfInfo) {
    const mark = Math.abs(comp) <= 1 ? '●' : comp > 1 ? '▲+' : '▼−';
    vfInfo.textContent = `${shutterText(SHUTTERS[gear.tv])}  F${APERTURES[gear.ap]}  ISO${ISOS[gear.iso]}   ${mark} ${comp >= 0 ? '+' : ''}${comp.toFixed(1)}`;
  }
  /* depth of field: wider aperture (small f-number) → bigger CoC */
  compMat.uniforms.uCoC.value = (1.4 / APERTURES[gear.ap]) * 0.55;
  /* ISO grain */
  document.getElementById('grain').style.opacity =
    Math.min(0.42, (ISOS[gear.iso] / 6400) * 0.42 * BODIES[gear.body].grain).toFixed(3);
}

function applyFov() {
  /* full-frame vertical sensor = 24mm → fov from the effective focal length */
  camera.fov = 2 * Math.atan(12 / focalEff()) * 180 / Math.PI;
  camera.updateProjectionMatrix();
}

/* ----------------------------------------------------------
   3. Scene builders — value noise + shared materials
   ---------------------------------------------------------- */
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return hash(xi, zi) * (1 - u) * (1 - v) + hash(xi + 1, zi) * u * (1 - v) +
         hash(xi, zi + 1) * (1 - u) * v + hash(xi + 1, zi + 1) * u * v;
}

function makeSky(top, horizon, bottom) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uBottom: { value: new THREE.Color(bottom) }
    },
    vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(min(h * 2.2, 1.0), 0.7))
                         : mix(uHorizon, uBottom, min(-h * 3.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  return new THREE.Mesh(new THREE.SphereGeometry(600, 32, 18), mat);
}

function makePine(height, trunkC, leafC) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09 * height / 3, 0.14 * height / 3, height * 0.3, 6),
    new THREE.MeshStandardMaterial({ color: trunkC, roughness: 0.9 })
  );
  trunk.position.y = height * 0.15;
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(height * 0.28, height * 0.85, 7),
    new THREE.MeshStandardMaterial({ color: leafC, roughness: 0.85 })
  );
  leaves.position.y = height * 0.3 + height * 0.4;
  trunk.castShadow = leaves.castShadow = true;
  g.add(trunk, leaves);
  return g;
}

/* --- LAKE: sunrise over still water, mountain ridge all around --- */
function buildLake(sc) {
  sceneEV = 9.2;   // golden hour is dim — default settings sit near EV 0
  sc.fog = new THREE.FogExp2(0x3a3040, 0.0038);
  sc.add(makeSky(0x2a4a7a, 0xff9a5c, 0x1a1418));

  const sunLight = new THREE.DirectionalLight(0xffb070, 3.7);
  sunLight.position.set(-40, 26, -160);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -90;
  sunLight.shadow.camera.right = sunLight.shadow.camera.top = 90;
  sunLight.shadow.camera.far = 400;
  sc.add(sunLight, sunLight.target);
  sc.add(new THREE.HemisphereLight(0xa88ab0, 0x241c14, 1.9));

  /* sun disc + halo low over the water */
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(14, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd9a8 })
  );
  sunDisc.position.set(-50, 14, -380);
  sunDisc.lookAt(0, 4, 30);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a5c, transparent: true, opacity: 0.35 })
  );
  halo.position.copy(sunDisc.position);
  halo.lookAt(0, 4, 26);
  sc.add(sunDisc, halo);

  /* water — catches a long warm sun glint, sky reflection in the rest */
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(150, 64),
    new THREE.MeshStandardMaterial({
      color: 0x3a5a68, metalness: 0.55, roughness: 0.16,
      emissive: 0x3a2a3a, emissiveIntensity: 0.5   // dusk sky bounce
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  sc.add(water);

  /* mountain ring — displaced disc, darker & higher toward the rim */
  const geo = new THREE.CircleGeometry(420, 128, 0, Math.PI * 2);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cLow = new THREE.Color(0x2c3626), cHigh = new THREE.Color(0x8a8494), cSnow = new THREE.Color(0xd8d4e0);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.hypot(x, z);
    let y = 0;
    if (d > 150) {
      const n = vnoise(x * 0.012, z * 0.012);
      y = (d - 150) * 0.12 * (0.5 + n * 1.1);
    }
    y -= Math.max(0, 1 - d / 150) * 1.2;   // dip under the lake
    pos.setY(i, y);
    const t = Math.min(1, y / 55);
    const c = t > 0.8 ? cSnow.clone().lerp(cHigh, (1 - t) * 5) : cLow.clone().lerp(cHigh, t);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ridge = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ridge.receiveShadow = true;
  sc.add(ridge);

  /* shore rocks */
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.9 });
  for (let i = 0; i < 14; i++) {
    const a = -0.6 + hash(i, 3) * 1.9;
    const r = 26 + hash(i, 7) * 10;
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(Math.sin(a) * r, 0.2, 20 - Math.cos(a) * r * 0.4);
    rock.scale.setScalar(0.5 + hash(i, 11) * 1.6);
    rock.rotation.set(hash(i, 1) * 3, hash(i, 2) * 3, 0);
    rock.castShadow = rock.receiveShadow = true;
    sc.add(rock);
  }

  /* pines on the far ridge line */
  for (let i = 0; i < 40; i++) {
    const a = hash(i, 11) * Math.PI * 2;
    const r = 155 + hash(i, 13) * 60;
    const p = makePine(5 + hash(i, 17) * 5, 0x3a2c20, 0x1e3020);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const d = Math.hypot(x, z);
    p.position.set(x, (d - 150) * 0.12 * 0.9, z);
    sc.add(p);
  }

  /* a few slow clouds catching the sunrise (unlit: they ARE the light) */
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xf5b88c, transparent: true, opacity: 0.9 });
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(18 + hash(i, 23) * 14, 12, 8), cloudMat);
    cl.scale.y = 0.22;
    cl.position.set(-200 + i * 90 + hash(i, 29) * 30, 90 + hash(i, 31) * 30, -260 - hash(i, 37) * 60);
    sc.add(cl);
    clouds.push(cl);
  }
  return {
    clouds,
    bias: 2.6,
    start: { x: 0, y: 1.7, z: 26, lx: -8, ly: 6, lz: -60 },
    clamp: (p) => { const d = Math.hypot(p.x, p.z - 20); if (d > 42) { p.x *= 42 / d; p.z = 20 + (p.z - 20) * 42 / d; } }
  };
}

/* --- CITY: dusk street, warm windows, lamps --- */
function makeWindowTexture(seed, tint) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#181c22';
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 6; x++) {
    const lit = hash(seedN(x, y), seedN(y, x) + 7) > 0.55;
    g.fillStyle = lit ? '#ffd9a0' : '#232a34';
    g.fillRect(4 + x * 10, 4 + y * 7.6, 7, 5);
  }
  function seedN(a, b) { return a * 31 + b * 17 + seed * 13; }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCity(sc) {
  sceneEV = 8.6;
  sc.fog = new THREE.FogExp2(0x2a2438, 0.0048);
  sc.add(makeSky(0x1a2340, 0xff7a50, 0x14101c));

  const dusk = new THREE.DirectionalLight(0xff9a70, 3.0);
  dusk.position.set(60, 40, -120);
  dusk.castShadow = true;
  dusk.shadow.mapSize.set(2048, 2048);
  dusk.shadow.camera.left = dusk.shadow.camera.bottom = -120;
  dusk.shadow.camera.right = dusk.shadow.camera.top = 120;
  dusk.shadow.camera.far = 400;
  sc.add(dusk, dusk.target);
  sc.add(new THREE.HemisphereLight(0x5a6590, 0x18120c, 1.5));

  /* road + sidewalks */
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 340),
    new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.92 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -140);
  road.receiveShadow = true;
  sc.add(road);
  for (const sx of [-16, 16]) {
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 340),
      new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.85 })
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(sx, 0.02, -140);
    walk.receiveShadow = true;
    sc.add(walk);
  }
  /* centre dashes */
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xb0a070 });
  for (let i = 0; i < 34; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.03, 20 - i * 10);
    sc.add(dash);
  }

  /* building walls on both sides */
  const winTexA = makeWindowTexture(1), winTexB = makeWindowTexture(2);
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    const w = 10 + hash(i, 41) * 14;
    const h = 9 + hash(i, 43) * 30;
    const d = 8 + hash(i, 47) * 8;
    const z = 10 - Math.floor(i / 2) * 22 - hash(i, 53) * 6;
    const x = side * (24 + hash(i, 59) * 12 + w / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x242a33, roughness: 0.85,
      emissive: 0xffffff, emissiveIntensity: 0.5,
      emissiveMap: hash(i, 61) > 0.5 ? winTexA : winTexB
    });
    const bld = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    bld.position.set(x, h / 2, z);
    bld.castShadow = bld.receiveShadow = true;
    sc.add(bld);
  }

  /* street lamps */
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.6, metalness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffc070, emissiveIntensity: 2.4 });
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6), poleMat);
    pole.position.set(side * 13, 2.7, 6 - i * 26);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), headMat);
    head.position.set(side * 13, 5.5, 6 - i * 26);
    const lamp = new THREE.PointLight(0xffb060, 4, 22, 1.9);
    lamp.position.copy(head.position);
    sc.add(pole, head, lamp);
  }
  return {
    bias: 3.1,
    start: { x: 0, y: 1.7, z: 8, lx: 4, ly: 4, lz: -60 },
    clamp: (p) => {
      p.x = Math.max(-12, Math.min(12, p.x));
      p.z = Math.max(-230, Math.min(12, p.z));
    }
  };
}

/* --- FOREST: misty morning, god-ray feel --- */
function buildForest(sc) {
  sceneEV = 8.9;
  sc.fog = new THREE.FogExp2(0x9db5a8, 0.013);
  sc.add(makeSky(0x9ab8cc, 0xdfe8d8, 0x6a7a66));

  const morning = new THREE.DirectionalLight(0xfff2d0, 2.8);
  morning.position.set(50, 60, 30);
  morning.castShadow = true;
  morning.shadow.mapSize.set(2048, 2048);
  morning.shadow.camera.left = morning.shadow.camera.bottom = -70;
  morning.shadow.camera.right = morning.shadow.camera.top = 70;
  morning.shadow.camera.far = 300;
  sc.add(morning, morning.target);
  sc.add(new THREE.HemisphereLight(0xc8d8cc, 0x2a3020, 1.3));

  /* mossy floor */
  const geo = new THREE.CircleGeometry(120, 72);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cA = new THREE.Color(0x4a5a34), cB = new THREE.Color(0x6a6a42);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = vnoise(x * 0.08, z * 0.08);
    pos.setY(i, n * 0.5);
    const c = cA.clone().lerp(cB, n);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const floor = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  floor.receiveShadow = true;
  sc.add(floor);

  /* pines everywhere, kept off a small clearing at the spawn */
  for (let i = 0; i < 70; i++) {
    const a = hash(i, 71) * Math.PI * 2;
    const r = 8 + hash(i, 73) * 75;
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 12;
    if (Math.hypot(x, z - 14) < 9) continue;   // spawn clearing
    const p = makePine(7 + hash(i, 79) * 9, 0x4a3626, hash(i, 83) > 0.5 ? 0x2a4226 : 0x243a2c);
    p.position.set(x, 0, z);
    p.rotation.y = hash(i, 89) * Math.PI;
    sc.add(p);
  }

  /* boulders + ferns */
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a6058, roughness: 0.95 });
  for (let i = 0; i < 8; i++) {
    const rock = new THREE.Mesh(rockGeo, rockMat);
    const a = hash(i, 97) * Math.PI * 2;
    const r = 6 + hash(i, 101) * 40;
    rock.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r - 8);
    rock.scale.set(1 + hash(i, 103), 0.7 + hash(i, 107) * 0.8, 1 + hash(i, 109));
    rock.castShadow = rock.receiveShadow = true;
    sc.add(rock);
  }
  const fernMat = new THREE.MeshStandardMaterial({ color: 0x3a5a28, roughness: 0.9 });
  for (let i = 0; i < 40; i++) {
    const fern = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 5), fernMat);
    const a = hash(i, 113) * Math.PI * 2;
    const r = 3 + hash(i, 127) * 50;
    fern.position.set(Math.cos(a) * r, 0.45, Math.sin(a) * r - 8);
    sc.add(fern);
  }

  /* god-ray planes along the sun direction */
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0xfff4d8, transparent: true, opacity: 0.07,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  for (let i = 0; i < 4; i++) {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(7, 60), rayMat);
    ray.position.set(14 + i * 9, 22, -30 - i * 12);
    ray.rotation.z = -0.7;
    ray.rotation.y = 0.4;
    sc.add(ray);
  }
  return {
    bias: 2.0,
    start: { x: 0, y: 1.7, z: 16, lx: 4, ly: 4, lz: -30 },
    clamp: (p) => { const d = Math.hypot(p.x, p.z + 10); if (d > 55) { p.x *= 55 / d; p.z = -10 + (p.z + 10) * 55 / d; } }
  };
}

/* ----------------------------------------------------------
   4. Scene management
   ---------------------------------------------------------- */
const scene = new THREE.Scene();
const BUILDERS = [buildLake, buildCity, buildForest];
const SCENE_KEYS = ['scene-lake', 'scene-city', 'scene-forest'];
let sceneIndex = 0;
let sceneCtx = null;
let activeSceneGroup = null;

function setScene(i) {
  if (activeSceneGroup) scene.remove(activeSceneGroup);
  sceneIndex = i;
  activeSceneGroup = new THREE.Group();
  scene.add(activeSceneGroup);
  sceneCtx = BUILDERS[i](activeSceneGroup);
  scene.fog = activeSceneGroup.fog || null;
  sceneBias = sceneCtx.bias || 1;
  /* move the photographer */
  camRig.x = sceneCtx.start.x; camRig.y = sceneCtx.start.y; camRig.z = sceneCtx.start.z;
  const dx = sceneCtx.start.lx - camRig.x, dy = sceneCtx.start.ly - camRig.y, dz = sceneCtx.start.lz - camRig.z;
  camRig.yaw = Math.atan2(-dx, -dz);
  camRig.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  camRig.focus = Math.max(3, Math.min(90, Math.hypot(dx, dy, dz)));
  applyExposure();
  document.querySelectorAll('#sceneBar .deck-btn').forEach((b, j) => b.classList.toggle('is-active', j === i));
}

/* ----------------------------------------------------------
   5. Photographer controls — drag look, WASD, Q/E, wheel
   ---------------------------------------------------------- */
const camRig = { x: 0, y: 1.7, z: 26, yaw: 0, pitch: 0, focus: 12 };
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') { e.preventDefault(); shoot(); }
  if (/^Digit[1-3]$/.test(e.code)) setScene(+e.code.slice(5) - 1);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

let dragging = false;
canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId); });
window.addEventListener('pointerup', () => { dragging = false; canvas.classList.remove('dragging'); });
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  camRig.yaw -= e.movementX * 0.0022;
  camRig.pitch = Math.max(-0.55, Math.min(0.6, camRig.pitch - e.movementY * 0.0018));
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const step = Math.sign(e.deltaY) * -2.2;   // scroll up = stroll forward
  camRig.x += -Math.sin(camRig.yaw) * step;
  camRig.z += -Math.cos(camRig.yaw) * step;
}, { passive: false });

function updateCamera(dt) {
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 11 : 5.5;
  const fwdX = -Math.sin(camRig.yaw), fwdZ = -Math.cos(camRig.yaw);
  const rightX = Math.cos(camRig.yaw), rightZ = -Math.sin(camRig.yaw);
  if (keys.has('KeyW') || keys.has('ArrowUp')) { camRig.x += fwdX * speed * dt; camRig.z += fwdZ * speed * dt; }
  if (keys.has('KeyS') || keys.has('ArrowDown')) { camRig.x -= fwdX * speed * dt; camRig.z -= fwdZ * speed * dt; }
  if (keys.has('KeyA') || keys.has('ArrowLeft')) { camRig.x -= rightX * speed * dt; camRig.z -= rightZ * speed * dt; }
  if (keys.has('KeyD') || keys.has('ArrowRight')) { camRig.x += rightX * speed * dt; camRig.z += rightZ * speed * dt; }
  if (keys.has('KeyQ')) camRig.y = Math.max(0.8, camRig.y - 3.4 * dt);
  if (keys.has('KeyE')) camRig.y = Math.min(7.5, camRig.y + 3.4 * dt);
  const p = { x: camRig.x, z: camRig.z };
  if (sceneCtx) sceneCtx.clamp(p);
  camRig.x = p.x; camRig.z = p.z;

  camera.position.set(camRig.x, camRig.y, camRig.z);
  camera.rotation.set(0, 0, 0);
  camera.rotateY(camRig.yaw);
  camera.rotateX(camRig.pitch);
  compMat.uniforms.uFocus.value = camRig.focus;
}

/* ----------------------------------------------------------
   5b. First-person camera — a stylized body you hold in front
   of you (screen mode) or raise to your eye (viewfinder mode,
   key V). Rendered in a separate pass AFTER the DOF composite
   so it always stays crisp, and hidden while capturing photos.
   ---------------------------------------------------------- */
const rigScene = new THREE.Scene();
const rigAnchor = new THREE.Group();          // mirrors the main camera transform
rigAnchor.matrixAutoUpdate = false;
rigScene.add(rigAnchor);

const camModel = new THREE.Group();
rigAnchor.add(camModel);

/* soft key light + cool rim so the body reads with form, not a silhouette */
const rigLight = new THREE.PointLight(0xfff0dd, 0.9, 4);
rigLight.position.set(0.12, 0.2, 0.24);
rigAnchor.add(rigLight);
const rigRim = new THREE.DirectionalLight(0x8fb4dd, 1.1);   // cool rim from the scene side
rigRim.position.set(-0.4, 0.35, -0.8);
rigAnchor.add(rigRim, rigRim.target);
rigRim.target.position.set(0.05, -0.05, 0);
rigAnchor.add(new THREE.HemisphereLight(0x8a92a8, 0x1a150e, 0.7));

let lensBarrel = null, lensGlass = null, humpPrism = null, humpLow = null, bodyMain = null;

/* leather grain bump, procedurally generated once */
function makeLeatherBump() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 100 + Math.random() * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}

(function buildCameraModel() {
  const bump = makeLeatherBump();
  const leather = new THREE.MeshStandardMaterial({ color: 0x17171b, roughness: 0.9, metalness: 0.06, bumpMap: bump, bumpScale: 0.6 });
  const topPlate = new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.45, metalness: 0.7 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.3, metalness: 0.85 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.45, metalness: 0.7 });

  /* main body + top plate */
  bodyMain = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.075, 0.042), leather);
  camModel.add(bodyMain);
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.012, 0.04), topPlate);
  topCap.position.set(0, 0.043, 0);
  camModel.add(topCap);

  /* grip on the photographer's right (+x as we see it), red accent stripe */
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.072, 0.052), leather);
  grip.position.set(0.052, -0.004, 0.004);
  camModel.add(grip);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.024, 0.002), new THREE.MeshBasicMaterial({ color: 0xd4222a }));
  stripe.position.set(0.045, 0.022, 0.0306);
  stripe.rotation.z = -0.35;
  camModel.add(stripe);

  /* prism hump — big DSLR-style for FF, low mirrorless-style for APS-C, none for M43 */
  const humpGeo = new THREE.CylinderGeometry(0.026, 0.032, 0.05, 4, 1);
  humpGeo.rotateX(Math.PI / 2);          // axis → z (depth)
  humpGeo.rotateY(Math.PI / 4);          // diamond → trapezoid silhouette
  humpPrism = new THREE.Mesh(humpGeo, topPlate);
  humpPrism.scale.set(1.15, 0.72, 1);
  humpPrism.position.set(-0.008, 0.052, 0);
  camModel.add(humpPrism);
  humpLow = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.016, 0.036), topPlate);
  humpLow.position.set(-0.008, 0.052, 0);
  camModel.add(humpLow);

  /* hot shoe + shutter button (right, near the grip) + rear dial */
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.004, 0.016), darkMetal);
  shoe.position.set(-0.008, 0.064, 0);
  camModel.add(shoe);
  const shutterBtnM = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 12), metal);
  shutterBtnM.position.set(0.05, 0.045, 0.006);
  camModel.add(shutterBtnM);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.005, 16), topPlate);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(-0.052, 0.02, 0.022);
  camModel.add(dial);

  /* rear LCD — dark screen with a faint live-view glow, like the display is on */
  const lcd = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.048, 0.002), darkMetal);
  lcd.position.set(-0.008, 0.002, 0.022);
  camModel.add(lcd);
  const lcdGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.066, 0.042),
    new THREE.MeshBasicMaterial({ color: 0x18242c })
  );
  lcdGlass.position.set(-0.008, 0.002, 0.0232);
  camModel.add(lcdGlass);
  /* rear buttons beside the LCD */
  for (let i = 0; i < 2; i++) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.002, 12), topPlate);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0.034, 0.014 - i * 0.018, 0.0225);
    camModel.add(btn);
  }

  /* lens: mount ring + barrel (length follows focal length) + silver rings + front glass.
     rotations are baked into the geometry so scale.z extends along depth. */
  const mountGeo = new THREE.CylinderGeometry(0.034, 0.036, 0.012, 24);
  mountGeo.rotateX(Math.PI / 2);
  const mount = new THREE.Mesh(mountGeo, metal);
  mount.position.set(0.005, 0, -0.026);
  camModel.add(mount);
  const barrelGeo = new THREE.CylinderGeometry(0.031, 0.033, 1, 24);
  barrelGeo.rotateX(Math.PI / 2);        // axis → z
  lensBarrel = new THREE.Mesh(barrelGeo, darkMetal);
  camModel.add(lensBarrel);
  /* focus ring + silver accent ring */
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0325, 0.0028, 8, 24), leather);
  camModel.add(ring);
  lensBarrel.userData.ring = ring;
  const silverRing = new THREE.Mesh(new THREE.TorusGeometry(0.0315, 0.0018, 8, 24), metal);
  camModel.add(silverRing);
  lensBarrel.userData.silver = silverRing;
  lensGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.027, 24),
    new THREE.MeshStandardMaterial({ color: 0x0a1a24, roughness: 0.05, metalness: 0.9, emissive: 0x14405a, emissiveIntensity: 0.8 })
  );
  camModel.add(lensGlass);
})();

/* lens barrel length scales with the real focal length */
function updateCameraModel() {
  const focal = LENSES[gear.lens];
  const t = (focal - 16) / (200 - 16);
  const len = 0.035 + t * 0.085;
  lensBarrel.scale.z = len;                        // geometry height = 1
  lensBarrel.position.set(0.005, 0, -0.032 - len / 2);
  lensBarrel.userData.ring.position.set(0.005, 0, -0.032 - len * 0.72);
  lensBarrel.userData.silver.position.set(0.005, 0, -0.032 - len * 0.9);
  lensGlass.position.set(0.005, 0, -0.033 - len);
  /* body flavor: FF = big prism hump, APS-C = low hump, M43 = flat & compact */
  humpPrism.visible = gear.body === 2;
  humpLow.visible = gear.body === 1;
  const s = gear.body === 0 ? 0.88 : 1;
  camModel.scale.setScalar(s);
}

/* two poses: held low for live-view, raised to the eye for the EVF */
const SCREEN_POSE = { pos: new THREE.Vector3(0.10, -0.105, -0.33), rot: new THREE.Euler(0.14, -0.18, 0.03) };
const VF_POSE = { pos: new THREE.Vector3(-0.01, -0.05, -0.19), rot: new THREE.Euler(0.0, 0.0, 0.0) };
let vfMode = false;
let poseT = 0;   // 0 = screen, 1 = viewfinder

function applyPose() {
  const e = poseT < 0.5 ? 2 * poseT * poseT : 1 - Math.pow(-2 * poseT + 2, 2) / 2;   // easeInOutQuad
  camModel.position.lerpVectors(SCREEN_POSE.pos, VF_POSE.pos, e);
  camModel.rotation.set(
    SCREEN_POSE.rot.x + (VF_POSE.rot.x - SCREEN_POSE.rot.x) * e,
    SCREEN_POSE.rot.y + (VF_POSE.rot.y - SCREEN_POSE.rot.y) * e,
    SCREEN_POSE.rot.z + (VF_POSE.rot.z - SCREEN_POSE.rot.z) * e
  );
  /* in the EVF pose the body is at your eye — you see through it, not at it */
  camModel.visible = e < 0.85;
}
applyPose();

const vfOverlay = document.getElementById('viewfinder');
function setVfMode(on) {
  vfMode = on;
  vfOverlay.classList.toggle('is-on', vfMode);
  /* eye to the finder: the control deck and exposure pill fade away */
  document.body.classList.toggle('vf-mode', vfMode);
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyV') setVfMode(!vfMode);
});

/* ----------------------------------------------------------
   6. ISO grain — animated noise tile over the frame
   ---------------------------------------------------------- */
const grainEl = document.getElementById('grain');
(function makeGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const g = c.getContext('2d');
  const img = g.createImageData(192, 192);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 46;
  }
  g.putImageData(img, 0, 0);
  grainEl.style.backgroundImage = `url(${c.toDataURL()})`;
})();
setInterval(() => {
  if (parseFloat(grainEl.style.opacity) > 0.01) {
    grainEl.style.backgroundPosition = `${Math.random() * 192 | 0}px ${Math.random() * 192 | 0}px`;
  }
}, 90);

/* ----------------------------------------------------------
   7. Gear UI wiring
   ---------------------------------------------------------- */
document.querySelectorAll('#bodyBar .deck-btn').forEach((b) => {
  b.addEventListener('click', () => {
    gear.body = +b.dataset.body;
    document.querySelectorAll('#bodyBar .deck-btn').forEach((x) => x.classList.toggle('is-active', x === b));
    applyFov(); applyExposure(); updateCameraModel();
  });
});
document.querySelectorAll('#lensBar .deck-btn').forEach((b) => {
  b.addEventListener('click', () => {
    gear.lens = +b.dataset.lens;
    document.querySelectorAll('#lensBar .deck-btn').forEach((x) => x.classList.toggle('is-active', x === b));
    applyFov(); applyExposure(); updateCameraModel();
  });
});
document.querySelectorAll('#sceneBar .deck-btn').forEach((b) => {
  b.addEventListener('click', () => setScene(+b.dataset.scene));
});

const apRange = document.getElementById('apRange');
const tvRange = document.getElementById('tvRange');
const isoRange = document.getElementById('isoRange');
function syncSliders() {
  document.getElementById('apVal').textContent = `f/${APERTURES[gear.ap]}`;
  document.getElementById('tvVal').textContent = shutterText(SHUTTERS[gear.tv]);
  document.getElementById('isoVal').textContent = String(ISOS[gear.iso]);
}
apRange.addEventListener('input', () => { gear.ap = +apRange.value; syncSliders(); applyExposure(); });
tvRange.addEventListener('input', () => { gear.tv = +tvRange.value; syncSliders(); applyExposure(); });
isoRange.addEventListener('input', () => { gear.iso = +isoRange.value; syncSliders(); applyExposure(); });

/* ----------------------------------------------------------
   8. Shooting + gallery
   ---------------------------------------------------------- */
const photos = [];
const gallery = document.getElementById('gallery');
const galleryGrid = document.getElementById('galleryGrid');
const galleryEmpty = document.getElementById('galleryEmpty');
const photoCount = document.getElementById('photoCount');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxMeta = document.getElementById('lightboxMeta');
const lightboxDl = document.getElementById('lightboxDl');

let rigHidden = false;   // true while capturing a photo
function renderFrame() {
  /* scene → rtScene (with depth) */
  renderer.setRenderTarget(rtScene);
  renderer.render(scene, camera);
  /* blur: rtScene → A (H) → B (V) */
  const w = rtBlurA.width, h = rtBlurA.height;
  blurMat.uniforms.uTexel.value.set(1 / w, 1 / h);
  blurMat.uniforms.tDiffuse.value = rtScene.texture;
  blurMat.uniforms.uDir.value.set(1, 0);
  postQuad.material = blurMat;
  renderer.setRenderTarget(rtBlurA);
  renderer.render(postScene, postCam);
  blurMat.uniforms.tDiffuse.value = rtBlurA.texture;
  blurMat.uniforms.uDir.value.set(0, 1);
  renderer.setRenderTarget(rtBlurB);
  renderer.render(postScene, postCam);
  /* composite */
  compMat.uniforms.tSharp.value = rtScene.texture;
  compMat.uniforms.tBlur.value = rtBlurB.texture;
  compMat.uniforms.tDepth.value = rtScene.depthTexture;
  compMat.uniforms.cameraNear.value = camera.near;
  compMat.uniforms.cameraFar.value = camera.far;
  postQuad.material = compMat;
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
  /* first-person camera body on top — sharp, unaffected by the DOF pass */
  if (!rigHidden && camModel.visible) {
    camera.updateMatrixWorld();
    rigAnchor.matrix.copy(camera.matrixWorld);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(rigScene, camera);
    renderer.autoClear = true;
  }
}

function shoot() {
  rigHidden = true;            // the photo is what the camera sees, not your hands
  renderFrame();   // present a fresh frame, then read it in the same task
  const full = renderer.domElement.toDataURL('image/jpeg', 0.92);
  rigHidden = false;
  const meta = `${I18N[lang][SCENE_KEYS[sceneIndex]]} · ${LENSES[gear.lens]}mm(${BODIES[gear.body].crop}x) · f/${APERTURES[gear.ap]} · ${shutterText(SHUTTERS[gear.tv])} · ISO${ISOS[gear.iso]}`;
  const entry = { full, meta };
  photos.unshift(entry);
  if (photos.length > 24) photos.pop();
  photoCount.textContent = String(photos.length);
  galleryEmpty.style.display = 'none';
  const img = document.createElement('img');
  img.src = full;
  img.alt = meta;
  img.addEventListener('click', () => openLightbox(photos.indexOf(entry)));
  galleryGrid.prepend(img);
  const flash = document.getElementById('flash');
  flash.classList.remove('pop');
  void flash.offsetWidth;   // restart the animation
  flash.classList.add('pop');
}

function openLightbox(i) {
  const p = photos[i];
  if (!p) return;
  lightboxImg.src = p.full;
  lightboxMeta.textContent = p.meta;
  lightboxDl.href = p.full;
  lightbox.classList.add('is-open');
}
document.getElementById('shutterBtn').addEventListener('click', shoot);
document.getElementById('galleryBtn').addEventListener('click', () => gallery.classList.toggle('is-open'));
document.getElementById('galleryClose').addEventListener('click', () => gallery.classList.remove('is-open'));
document.getElementById('lightboxClose').addEventListener('click', () => lightbox.classList.remove('is-open'));
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.classList.remove('is-open'); });

/* ----------------------------------------------------------
   9. Main loop + boot
   ---------------------------------------------------------- */
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  updateCamera(dt);
  /* raise / lower the handheld camera smoothly */
  const target = vfMode ? 1 : 0;
  if (Math.abs(poseT - target) > 0.001) {
    poseT += Math.sign(target - poseT) * Math.min(Math.abs(target - poseT), dt * 4.2);
    applyPose();
  }
  if (sceneCtx && sceneCtx.clouds) {
    for (const cl of sceneCtx.clouds) cl.position.x += dt * 1.2;
  }
  renderFrame();
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  makeTargets(renderer.domElement.width, renderer.domElement.height);
});

applyFov();
updateCameraModel();
syncSliders();
setScene(0);
tick();

/* debug hooks for automated tests */
window.__photo = {
  photos,
  gear,
  evDiff,
  focalEff,
  shoot,
  setScene,
  sceneIndex: () => sceneIndex,
  camRig,
  setVfMode,
  vfMode: () => vfMode,
  camModelVisible: () => camModel.visible
};
requestAnimationFrame(() => {
  setTimeout(() => document.getElementById('veil').classList.add('is-hidden'), 350);
});
