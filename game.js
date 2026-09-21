import * as THREE from './vendor/three.module.js';

const $ = (id) => document.getElementById(id);
const ui = {
  viewport: $('viewport'), hud: $('hud'), timer: $('timer'), objective: $('objective'),
  objectiveDistance: $('objective-distance'), compassArrow: $('compass-arrow'), traceCount: $('trace-count'),
  staminaFill: $('stamina-fill'), batteryFill: $('battery-fill'), flashlightState: $('flashlight-state'),
  flashlightLabel: $('flashlight-label'), reticle: $('reticle'), interaction: $('interaction'),
  interactionLabel: $('interaction-label'), interactionFill: $('interaction-fill'), subtitle: $('subtitle'),
  chapterCard: $('chapter-card'), chapterNumber: $('chapter-number'), chapterName: $('chapter-name'),
  toggleToast: $('toggle-toast'), title: $('title-screen'), briefing: $('briefing-screen'),
  briefingCopy: $('briefing-copy'), start: $('start-button'), begin: $('begin-button'),
  pause: $('pause-screen'), resume: $('resume-button'), pauseRestart: $('pause-restart-button'),
  death: $('death-screen'), deathRestart: $('death-restart-button'), deathTraces: $('death-traces'),
  deathTime: $('death-time'), ending: $('ending-screen'), endingRestart: $('ending-restart-button'),
  copy: $('copy-button'), copyStatus: $('copy-status'), finalTime: $('final-time'),
  mobile: $('mobile-warning'), fear: $('fear-fx'), damage: $('damage-fx'), lightning: $('lightning'),
  missionStep: $('mission-step'), noiseFill: $('noise-fill'), decoyCount: $('decoy-count'),
  controlStrip: $('control-strip'), tuningPanel: $('tuning-panel'), tuningNeedle: $('tuning-needle'),
  tuningStatus: $('tuning-status'), controls: $('controls-screen'), controlsResume: $('controls-resume-button'),
  mouseSensitivity: $('mouse-sensitivity'), musicVolume: $('music-volume'), sfxVolume: $('sfx-volume'),
  qualitySelect: $('quality-select'), fullscreen: $('fullscreen-button'), fullscreenToggle: $('fullscreen-toggle')
};

const WORLD_SIZE = 760;
const HALF_WORLD = WORLD_SIZE / 2;
const EYE_HEIGHT = 1.72;
const WALK_SPEED = 4.7;
const SPRINT_SPEED = 8.2;
const JUMP_SPEED = 7.0;
const GRAVITY = 18;
const rng = mulberry32(303042);
let lastFrameTime = performance.now();
const tempObject = new THREE.Object3D();
const tempVec = new THREE.Vector3();
const tempVec2 = new THREE.Vector3();
const colliders = [];
const treeGrid = new Map();
const treePositions = [];
const routeSamples = [];
const landmarkLights = [];
const enemies = [];
const keys = Object.create(null);

let mode = 'title';
let yaw = -2.35;
let pitch = -0.04;
let elapsed = 0;
let traceCount = 0;
let currentTarget = 0;
let stamina = 100;
let battery = 100;
let flashlightOn = true;
let jumpOffset = 0;
let jumpVelocity = 0;
let grounded = true;
let interactionProgress = 0;
let bobTime = 0;
let shake = 0;
let subtitleTimer = 0;
let chapterTimer = 0;
let toastTimer = 0;
let directorClock = 0;
let sightingClock = 7;
let heartbeatClock = 0;
let finalMode = false;
let prologueStalkStarted = false;
let invulnerable = false;
let typingTimer = null;
let audio = null;
let renderScale = 1;
let perfElapsed = 0;
let perfFrames = 0;
let mouseSensitivity = 1;
let musicMuted = false;
let musicClock = 1.5;
let fearLevel = 0;
let noiseLevel = 0;
let crouching = false;
let decoyCount = 3;
let activeDecoy = null;
let tuningActive = false;
let taskELatch = false;
let interactPressed = false;
let jumpPressed = false;
let nearCreekJump = false;
let qualityMode = 'auto';

const objectiveOffsets = [
  { x: -7, z: 6 },
  { x: 0, z: 9 },
  { x: 0, z: 0 },
  { x: 0, z: 3.2 },
  { x: 0, z: 0 },
  { x: 5, z: 4 },
  { x: 0, z: 4 }
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d302c);
scene.fog = new THREE.FogExp2(0x304941, 0.0086);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 520);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.55));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
ui.viewport.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xaec7b6, 0x263025, 1.55);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0xcfe5d7, 2.25);
moonLight.position.set(-110, 170, 80);
scene.add(moonLight);
const ambientFill = new THREE.AmbientLight(0x527064, 0.42);
scene.add(ambientFill);

const materials = {
  ground: new THREE.MeshLambertMaterial({ color: 0x263b2a, flatShading: true, vertexColors: true }),
  trail: new THREE.MeshLambertMaterial({ color: 0x675b42, flatShading: true }),
  bark: new THREE.MeshLambertMaterial({ color: 0x302b22, flatShading: true }),
  barkLight: new THREE.MeshLambertMaterial({ color: 0x4a4030, flatShading: true }),
  pineDark: new THREE.MeshLambertMaterial({ color: 0x132b20, flatShading: true }),
  pineMid: new THREE.MeshLambertMaterial({ color: 0x1e3c29, flatShading: true }),
  pineLight: new THREE.MeshLambertMaterial({ color: 0x294b32, flatShading: true }),
  bush: new THREE.MeshLambertMaterial({ color: 0x29472e, flatShading: true }),
  rock: new THREE.MeshLambertMaterial({ color: 0x536158, flatShading: true }),
  rockDark: new THREE.MeshLambertMaterial({ color: 0x38443e, flatShading: true }),
  wood: new THREE.MeshLambertMaterial({ color: 0x5a4430, flatShading: true }),
  darkWood: new THREE.MeshLambertMaterial({ color: 0x33271f, flatShading: true }),
  metal: new THREE.MeshLambertMaterial({ color: 0x59645e, flatShading: true }),
  rust: new THREE.MeshLambertMaterial({ color: 0x75462f, flatShading: true }),
  fabric: new THREE.MeshLambertMaterial({ color: 0x59664e, flatShading: true }),
  black: new THREE.MeshLambertMaterial({ color: 0x090d0b, flatShading: true }),
  water: new THREE.MeshPhongMaterial({ color: 0x335b5b, emissive: 0x102a2b, transparent: true, opacity: 0.72, shininess: 90 }),
  yellow: new THREE.MeshBasicMaterial({ color: 0xffc62e, toneMapped: false }),
  red: new THREE.MeshBasicMaterial({ color: 0xe65335, toneMapped: false }),
  white: new THREE.MeshBasicMaterial({ color: 0xddebdc, toneMapped: false })
};

const route = [
  { x: 0, z: 0 },
  { x: 45, z: -52 },
  { x: 110, z: -130, name: 'WRECKED SURVEY VAN', chapter: 'THE SURVEY VAN', lore: 'The recorder is still warm. Something followed the crew out of the van.' },
  { x: 188, z: -210 },
  { x: 260, z: -250, name: 'RANGER CABIN', chapter: 'THE EMPTY RANGER', lore: 'Seven names are carved into the desk. Yours is the newest.' },
  { x: 325, z: -150 },
  { x: 330, z: -40, name: 'FIRE WATCHTOWER', chapter: 'ABOVE THE PINES', lore: 'The last observer wrote one line: do not let the light leave them.' },
  { x: 290, z: 82 },
  { x: 230, z: 190, name: 'STONE WITNESS CIRCLE', chapter: 'THE WITNESSES', lore: 'The stones face inward. The footprints all face out.' },
  { x: 105, z: 265 },
  { x: -30, z: 300, name: 'SHIELDED RELAY YARD', chapter: 'DEAD FREQUENCY', lore: 'The relay broadcasts one number on repeat: 303.' },
  { x: -155, z: 265 },
  { x: -260, z: 170, name: 'BROKEN CREEK BRIDGE', chapter: 'BLACK WATER', lore: 'The water carries voices upstream.' },
  { x: -305, z: 20 },
  { x: -300, z: -120, name: 'FOOTPRINT SHRINE', chapter: 'THE LAST TRACE', lore: 'This was never evidence. It was an invitation.' },
  { x: -220, z: -245 },
  { x: -100, z: -310, name: 'RANGER ROAD GATE', chapter: 'RUN TO EXTRACTION' }
];

const objectives = route.filter((n) => n.name);
const traceObjectives = objectives.slice(0, 7);
const exitObjective = objectives[7];
const evidenceMeshes = [];
const taskObjects = Array.from({ length: 7 }, () => []);
const tasks = [
  { type: 'camera', step: 0, complete: false, progress: 0 },
  { type: 'generator', step: 0, complete: false, progress: 0 },
  { type: 'tuner', step: 0, complete: false, progress: 0, value: .16 },
  { type: 'runes', step: 0, complete: false, progress: 0 },
  { type: 'breakers', step: 0, complete: false, progress: 0, order: [1, 2, 0] },
  { type: 'crossing', step: 0, complete: false, progress: 0 },
  { type: 'seal', step: 0, complete: false, progress: 0, active: false }
];

buildWorld();
setupFlashlight();
createEnemies();
placePlayer(0, 8, -0.78);
setupEvents();
updateObjectiveUI();
animate();

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function groundHeight(x, z) {
  return Math.sin(x * 0.017) * 0.8 + Math.cos(z * 0.021) * 0.65 + Math.sin((x + z) * 0.009) * 0.55;
}

function buildWorld() {
  buildGround();
  buildTrail();
  buildForest();
  buildUndergrowth();
  buildScatter();
  buildCamp(0, 0);
  buildVan(110, -130);
  buildCabin(260, -250);
  buildTower(330, -40);
  buildStoneCircle(230, 190);
  buildRelay(-30, 300);
  buildCreek(-260, 170);
  buildShrine(-300, -120);
  buildExit(-100, -310);
  buildObjectives();
  buildFieldTasks();
  buildMoon();
  buildParticles();
}

function buildGround() {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 84, 84);
  const pos = geo.attributes.position;
  const colors = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = -pos.getY(i);
    pos.setZ(i, groundHeight(x, z));
    c.setHSL(0.29 + rng() * 0.035, 0.22 + rng() * 0.12, 0.17 + rng() * 0.055);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, materials.ground);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(535, 535, 18, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x101c18, side: THREE.BackSide })
  );
  outer.position.y = 7;
  scene.add(outer);
}

function buildTrail() {
  const points = route.map((p) => new THREE.Vector3(p.x, 0, p.z));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.2);
  const samples = curve.getPoints(440);
  routeSamples.push(...samples.map((p) => ({ x: p.x, z: p.z })));
  const vertices = [];
  const indices = [];
  const colors = [];
  const colorA = new THREE.Color(0x6c634b);
  const colorB = new THREE.Color(0x4d4837);
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const length = Math.hypot(dx, dz) || 1;
    const width = 3.4 + Math.sin(i * 0.21) * 0.55 + rng() * 0.45;
    const px = -dz / length * width;
    const pz = dx / length * width;
    const y1 = groundHeight(p.x + px, p.z + pz) + 0.055;
    const y2 = groundHeight(p.x - px, p.z - pz) + 0.055;
    vertices.push(p.x + px, y1, p.z + pz, p.x - px, y2, p.z - pz);
    const mix = 0.25 + rng() * 0.55;
    const cc = colorA.clone().lerp(colorB, mix);
    colors.push(cc.r, cc.g, cc.b, cc.r * .92, cc.g * .92, cc.b * .92);
    if (i < samples.length - 1) {
      const n = i * 2;
      indices.push(n, n + 2, n + 1, n + 2, n + 3, n + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const trailMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  scene.add(new THREE.Mesh(geo, trailMat));

  for (let i = 24; i < samples.length - 20; i += 20) {
    const p = samples[i];
    const marker = new THREE.Group();
    const post = mesh(new THREE.CylinderGeometry(.08, .11, 1.65, 5), materials.darkWood, 0, .8, 0);
    const paint = mesh(new THREE.BoxGeometry(.58, .13, .06), materials.yellow, 0, 1.25, 0);
    paint.rotation.z = rng() > .5 ? .22 : -.22;
    marker.add(post, paint);
    marker.position.set(p.x + (rng() - .5) * 7.2, groundHeight(p.x, p.z), p.z + (rng() - .5) * 7.2);
    marker.rotation.y = rng() * Math.PI;
    scene.add(marker);
  }
}

function nearestRouteDistance(x, z) {
  let best = Infinity;
  for (let i = 0; i < routeSamples.length; i += 3) {
    const p = routeSamples[i];
    const d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

function landmarkClear(x, z, margin = 0) {
  for (const p of objectives) {
    const radius = p === exitObjective ? 24 : 18;
    if (Math.hypot(x - p.x, z - p.z) < radius + margin) return false;
  }
  if (Math.hypot(x, z) < 24 + margin) return false;
  return true;
}

function buildForest() {
  const count = 2650;
  const trunkGeo = new THREE.CylinderGeometry(.38, .62, 7.4, 5);
  const lowerGeo = new THREE.ConeGeometry(3.5, 7.4, 6);
  const middleGeo = new THREE.ConeGeometry(2.8, 6.2, 6);
  const upperGeo = new THREE.ConeGeometry(2.1, 5.2, 6);
  const trunks = new THREE.InstancedMesh(trunkGeo, materials.bark, count);
  const lower = new THREE.InstancedMesh(lowerGeo, materials.pineDark, count);
  const middle = new THREE.InstancedMesh(middleGeo, materials.pineMid, count);
  const upper = new THREE.InstancedMesh(upperGeo, materials.pineLight, count);
  const color = new THREE.Color();
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts++ < 24000) {
    const x = (rng() - .5) * (WORLD_SIZE - 22);
    const z = (rng() - .5) * (WORLD_SIZE - 22);
    const routeDist = nearestRouteDistance(x, z);
    if (routeDist < 6.4 || !landmarkClear(x, z, 3)) continue;
    const scale = .72 + rng() * .82;
    const y = groundHeight(x, z);
    const angle = rng() * Math.PI * 2;
    tempObject.position.set(x, y + 3.7 * scale, z);
    tempObject.rotation.set(0, angle, (rng() - .5) * .035);
    tempObject.scale.set(scale * (.84 + rng() * .25), scale, scale * (.84 + rng() * .25));
    tempObject.updateMatrix();
    trunks.setMatrixAt(placed, tempObject.matrix);
    tempObject.position.y = y + 7.0 * scale;
    tempObject.rotation.y = angle + .45;
    tempObject.updateMatrix();
    lower.setMatrixAt(placed, tempObject.matrix);
    tempObject.position.y = y + 10.5 * scale;
    tempObject.rotation.y = angle - .2;
    tempObject.updateMatrix();
    middle.setMatrixAt(placed, tempObject.matrix);
    tempObject.position.y = y + 13.5 * scale;
    tempObject.rotation.y = angle + .75;
    tempObject.updateMatrix();
    upper.setMatrixAt(placed, tempObject.matrix);
    color.setHSL(.29 + rng() * .045, .34 + rng() * .15, .13 + rng() * .08);
    lower.setColorAt(placed, color);
    middle.setColorAt(placed, color.clone().offsetHSL(.005, 0, .035));
    upper.setColorAt(placed, color.clone().offsetHSL(.008, -.02, .07));
    treePositions.push({ x, z, r: .52 * scale });
    addTreeToGrid(x, z, .52 * scale);
    placed++;
  }
  trunks.count = lower.count = middle.count = upper.count = placed;
  trunks.instanceMatrix.needsUpdate = lower.instanceMatrix.needsUpdate = middle.instanceMatrix.needsUpdate = upper.instanceMatrix.needsUpdate = true;
  if (lower.instanceColor) lower.instanceColor.needsUpdate = true;
  if (middle.instanceColor) middle.instanceColor.needsUpdate = true;
  if (upper.instanceColor) upper.instanceColor.needsUpdate = true;
  scene.add(trunks, lower, middle, upper);
}

function addTreeToGrid(x, z, r) {
  const key = `${Math.floor(x / 12)},${Math.floor(z / 12)}`;
  if (!treeGrid.has(key)) treeGrid.set(key, []);
  treeGrid.get(key).push({ x, z, r });
}

function buildUndergrowth() {
  const count = 1150;
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const bushes = new THREE.InstancedMesh(geo, materials.bush, count);
  const fernGeo = new THREE.ConeGeometry(.75, 1.15, 5);
  const ferns = new THREE.InstancedMesh(fernGeo, materials.pineMid, 620);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const x = (rng() - .5) * (WORLD_SIZE - 18);
    const z = (rng() - .5) * (WORLD_SIZE - 18);
    const s = .45 + rng() * 1.05;
    tempObject.position.set(x, groundHeight(x, z) + .48 * s, z);
    tempObject.rotation.set(rng() * .2, rng() * Math.PI, rng() * .2);
    tempObject.scale.set(s * (1 + rng() * .7), s, s * (1 + rng() * .5));
    tempObject.updateMatrix();
    bushes.setMatrixAt(i, tempObject.matrix);
    color.setHSL(.27 + rng() * .06, .32 + rng() * .2, .14 + rng() * .08);
    bushes.setColorAt(i, color);
  }
  for (let i = 0; i < 620; i++) {
    const x = (rng() - .5) * (WORLD_SIZE - 18);
    const z = (rng() - .5) * (WORLD_SIZE - 18);
    const s = .45 + rng() * .7;
    tempObject.position.set(x, groundHeight(x, z) + .42, z);
    tempObject.rotation.set((rng() - .5) * .4, rng() * Math.PI, (rng() - .5) * .4);
    tempObject.scale.set(s, .65 + rng() * .7, s);
    tempObject.updateMatrix();
    ferns.setMatrixAt(i, tempObject.matrix);
  }
  bushes.instanceMatrix.needsUpdate = ferns.instanceMatrix.needsUpdate = true;
  if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
  scene.add(bushes, ferns);
}

function buildScatter() {
  const rockCount = 260;
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, materials.rockDark, rockCount);
  for (let i = 0; i < rockCount; i++) {
    let x = (rng() - .5) * (WORLD_SIZE - 22);
    let z = (rng() - .5) * (WORLD_SIZE - 22);
    const s = .35 + rng() * 1.5;
    tempObject.position.set(x, groundHeight(x, z) + .38 * s, z);
    tempObject.rotation.set(rng() * 1.2, rng() * Math.PI, rng() * 1.2);
    tempObject.scale.set(s * (1 + rng()), s * (.45 + rng() * .35), s * (.7 + rng() * .5));
    tempObject.updateMatrix();
    rocks.setMatrixAt(i, tempObject.matrix);
    if (i < 90 && nearestRouteDistance(x, z) < 12) colliders.push({ type: 'circle', x, z, r: .55 * s, h: 1.0 * s });
  }
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);

  for (let i = 0; i < 88; i++) {
    const sample = routeSamples[Math.floor(rng() * routeSamples.length)];
    const nearTrail = i < 36;
    const x = nearTrail ? sample.x + (rng() - .5) * 17 : (rng() - .5) * (WORLD_SIZE - 30);
    const z = nearTrail ? sample.z + (rng() - .5) * 17 : (rng() - .5) * (WORLD_SIZE - 30);
    const length = 2.2 + rng() * 4.8;
    const log = mesh(new THREE.CylinderGeometry(.32 + rng() * .25, .4 + rng() * .28, length, 7), materials.darkWood);
    log.position.set(x, groundHeight(x, z) + .55, z);
    log.rotation.set(Math.PI / 2 + (rng() - .5) * .18, rng() * Math.PI, (rng() - .5) * .22);
    scene.add(log);
    if (nearTrail) colliders.push({ type: 'circle', x, z, r: Math.min(1.25, length * .23), h: 1.05 });
  }

  const obstacleIndices = [42, 91, 137, 186, 235, 286, 337, 386];
  for (const index of obstacleIndices) {
    const p = routeSamples[index];
    if (!p) continue;
    const log = mesh(new THREE.CylinderGeometry(.48, .64, 7.2, 7), materials.wood);
    log.position.set(p.x, groundHeight(p.x, p.z) + .66, p.z);
    log.rotation.set(Math.PI / 2, Math.atan2(p.z, p.x) + .7, 0);
    scene.add(log);
    colliders.push({ type: 'circle', x: p.x, z: p.z, r: 1.05, h: 1.12 });
  }
}

function buildCamp(x, z) {
  const g = new THREE.Group();
  g.position.set(x, groundHeight(x, z), z);
  addTent(g, -6, 2, .4);
  addTent(g, 8, 5, -1.1);
  const pit = mesh(new THREE.CylinderGeometry(1.15, 1.3, .25, 10), materials.rock, 0, .14, 0);
  g.add(pit);
  for (let i = 0; i < 8; i++) {
    const stone = mesh(new THREE.DodecahedronGeometry(.3, 0), materials.rock, Math.cos(i / 8 * Math.PI * 2) * 1.25, .35, Math.sin(i / 8 * Math.PI * 2) * 1.25);
    g.add(stone);
  }
  const ember = mesh(new THREE.ConeGeometry(.34, .8, 5), new THREE.MeshBasicMaterial({ color: 0xc74d22 }), 0, .7, 0);
  g.add(ember);
  const fire = new THREE.PointLight(0xff6c32, 4.4, 22, 2);
  fire.position.set(0, 2.1, 0);
  g.add(fire);
  landmarkLights.push({ light: fire, base: 4.4, phase: rng() * 8 });
  addCrate(g, -3.8, -4.2, .2);
  addCrate(g, -5.2, -4.0, -.3);
  const tripod = mesh(new THREE.CylinderGeometry(.08, .1, 2.3, 5), materials.metal, 3, 1.15, -3);
  tripod.rotation.z = .08;
  g.add(tripod);
  const cameraBox = mesh(new THREE.BoxGeometry(.9, .55, .65), materials.black, 3, 2.3, -3);
  g.add(cameraBox);
  scene.add(g);
}

function addTent(group, x, z, rotation) {
  const tent = new THREE.Group();
  const geo = new THREE.ConeGeometry(3.0, 3.1, 4);
  const body = mesh(geo, materials.fabric, 0, 1.55, 0);
  body.rotation.y = Math.PI / 4;
  tent.add(body);
  const opening = mesh(new THREE.ConeGeometry(1.2, 2.1, 3), materials.black, 0, 1.2, 2.15);
  opening.rotation.x = Math.PI / 2;
  tent.add(opening);
  tent.position.set(x, 0, z);
  tent.rotation.y = rotation;
  group.add(tent);
  colliders.push({ type: 'circle', x: group.position.x + x, z: group.position.z + z, r: 2.5, h: 3 });
}

function addCrate(group, x, z, rotation = 0) {
  const crate = mesh(new THREE.BoxGeometry(1.25, 1.05, 1.25), materials.wood, x, .55, z);
  crate.rotation.y = rotation;
  group.add(crate);
}

function buildVan(x, z) {
  const g = new THREE.Group();
  g.position.set(x, groundHeight(x, z), z);
  g.rotation.y = -.42;
  g.add(mesh(new THREE.BoxGeometry(5.5, 2.2, 9), materials.rust, 0, 1.75, 0));
  g.add(mesh(new THREE.BoxGeometry(5.0, 1.7, 2.7), materials.metal, 0, 3.5, 1.4));
  const windshield = mesh(new THREE.BoxGeometry(4.55, 1.2, .08), materials.black, 0, 3.65, -.04);
  windshield.rotation.x = -.25;
  g.add(windshield);
  for (const sx of [-2.7, 2.7]) for (const sz of [-2.7, 2.9]) {
    const wheel = mesh(new THREE.CylinderGeometry(.83, .83, .48, 10), materials.black, sx, 1.0, sz);
    wheel.rotation.z = Math.PI / 2;
    g.add(wheel);
  }
  const door = mesh(new THREE.BoxGeometry(2.35, 2.0, .16), materials.rust, -1.45, 2.1, 4.7);
  door.rotation.y = -.7;
  g.add(door);
  const lamp = new THREE.PointLight(0xffb42e, 3.4, 22, 2);
  lamp.position.set(1.7, 2.1, -4.6);
  g.add(lamp);
  landmarkLights.push({ light: lamp, base: 3.4, phase: rng() * 8 });
  scene.add(g);
  colliders.push({ type: 'circle', x, z, r: 4.4, h: 3.5 });
  for (let i = 0; i < 12; i++) addLooseDebris(x + (rng() - .5) * 15, z + (rng() - .5) * 15);
}

function buildCabin(x, z) {
  const g = new THREE.Group();
  g.position.set(x, groundHeight(x, z), z);
  g.rotation.y = .18;
  g.add(mesh(new THREE.BoxGeometry(12, 5.6, 9), materials.darkWood, 0, 2.8, 0));
  const roof = mesh(new THREE.ConeGeometry(8.2, 4.0, 4), materials.rust, 0, 7.0, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = .75;
  g.add(roof);
  const door = mesh(new THREE.BoxGeometry(2.2, 4.2, .15), materials.black, 0, 2.15, 4.56);
  g.add(door);
  for (const sx of [-3.8, 3.8]) {
    const win = mesh(new THREE.BoxGeometry(2.1, 1.8, .16), materials.yellow, sx, 3.2, 4.58);
    g.add(win);
  }
  const porch = mesh(new THREE.BoxGeometry(13.5, .4, 4.0), materials.wood, 0, .35, 5.7);
  g.add(porch);
  for (const sx of [-5.3, 5.3]) g.add(mesh(new THREE.CylinderGeometry(.15, .2, 4, 5), materials.wood, sx, 2.2, 6.4));
  const glow = new THREE.PointLight(0xffc45a, 4.5, 28, 2);
  glow.position.set(0, 3, 6);
  g.add(glow);
  landmarkLights.push({ light: glow, base: 4.5, phase: rng() * 8 });
  scene.add(g);
  colliders.push({ type: 'circle', x, z, r: 6.4, h: 5 });
  for (let i = 0; i < 9; i++) {
    const log = mesh(new THREE.CylinderGeometry(.22, .27, 2.8, 6), materials.wood);
    log.position.set(x + 8 + (i % 3) * .5, groundHeight(x + 8, z) + .3 + Math.floor(i / 3) * .48, z + 1);
    log.rotation.z = Math.PI / 2;
    scene.add(log);
  }
}

function buildTower(x, z) {
  const g = new THREE.Group();
  g.position.set(x, groundHeight(x, z), z);
  const height = 18;
  for (const sx of [-3.2, 3.2]) for (const sz of [-3.2, 3.2]) {
    const post = mesh(new THREE.CylinderGeometry(.25, .38, height, 5), materials.darkWood, sx, height / 2, sz);
    post.rotation.z = sx * .006;
    g.add(post);
  }
  for (let y = 3; y < 16; y += 3.2) {
    const brace1 = mesh(new THREE.BoxGeometry(9.5, .18, .22), materials.wood, 0, y, 3.25);
    brace1.rotation.z = y % 2 ? .48 : -.48;
    g.add(brace1);
    const brace2 = brace1.clone(); brace2.position.z = -3.25; brace2.rotation.z *= -1; g.add(brace2);
  }
  g.add(mesh(new THREE.BoxGeometry(9, .65, 9), materials.wood, 0, 17.2, 0));
  g.add(mesh(new THREE.BoxGeometry(7, 4.7, 7), materials.metal, 0, 19.8, 0));
  const roof = mesh(new THREE.ConeGeometry(5.4, 2.6, 4), materials.rust, 0, 23.0, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const flood = new THREE.PointLight(0xffd16c, 6, 52, 2);
  flood.position.set(0, 20, -3.7);
  g.add(flood);
  landmarkLights.push({ light: flood, base: 6, phase: rng() * 8 });
  scene.add(g);
  for (const sx of [-3.2, 3.2]) for (const sz of [-3.2, 3.2]) colliders.push({ type: 'circle', x: x + sx, z: z + sz, r: .6, h: 18 });
  const generator = mesh(new THREE.BoxGeometry(3.5, 2.2, 2.6), materials.rust, x - 8, groundHeight(x - 8, z) + 1.1, z + 2);
  scene.add(generator);
  colliders.push({ type: 'circle', x: x - 8, z: z + 2, r: 1.8, h: 2.2 });
}

function buildStoneCircle(x, z) {
  const g = new THREE.Group();
  g.position.set(x, groundHeight(x, z), z);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2;
    const h = 3.8 + rng() * 3.8;
    const stone = mesh(new THREE.DodecahedronGeometry(1, 0), materials.rock, Math.cos(a) * 10, h / 2, Math.sin(a) * 10);
    stone.scale.set(1.0 + rng() * .6, h / 2, .75 + rng() * .45);
    stone.rotation.set((rng() - .5) * .15, -a, (rng() - .5) * .14);
    g.add(stone);
    colliders.push({ type: 'circle', x: x + Math.cos(a) * 10, z: z + Math.sin(a) * 10, r: 1.25, h });
  }
  const altar = mesh(new THREE.BoxGeometry(4.6, 1.2, 2.8), materials.rockDark, 0, .65, 0);
  altar.rotation.y = .35;
  g.add(altar);
  for (let i = 0; i < 13; i++) {
    const candle = mesh(new THREE.CylinderGeometry(.08, .1, .45 + rng() * .4, 6), materials.white, (rng() - .5) * 4, 1.55, (rng() - .5) * 2);
    g.add(candle);
  }
  const light = new THREE.PointLight(0xff8d42, 5.0, 30, 2);
  light.position.set(0, 2.5, 0);
  g.add(light);
  landmarkLights.push({ light, base: 5.0, phase: rng() * 8 });
  scene.add(g);
  colliders.push({ type: 'circle', x, z, r: 2.4, h: 1.2 });
}

function buildRelay(x, z) {
  const g = new THREE.Group();
  g.position.set(x, groundHeight(x, z), z);
  const fenceMat = new THREE.MeshBasicMaterial({ color: 0x6b756e, wireframe: true, transparent: true, opacity: .7 });
  for (const side of [-1, 1]) {
    g.add(mesh(new THREE.BoxGeometry(34, 3.7, .12), fenceMat, 0, 1.85, side * 14));
    g.add(mesh(new THREE.BoxGeometry(.12, 3.7, 28), fenceMat, side * 17, 1.85, 0));
  }
  for (const ox of [-7, 5]) {
    g.add(mesh(new THREE.BoxGeometry(5.5, 6.5, 4.6), materials.metal, ox, 3.25, 1));
    g.add(mesh(new THREE.BoxGeometry(4.4, .16, 2.7), materials.yellow, ox, 3.7, 3.36));
  }
  const mast = mesh(new THREE.CylinderGeometry(.3, .55, 18, 7), materials.metal, 8, 9, -5);
  g.add(mast);
  const dish = mesh(new THREE.SphereGeometry(3.4, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), materials.metal, 8, 16, -5);
  dish.rotation.x = -1.0;
  g.add(dish);
  for (let i = 0; i < 6; i++) {
    const pole = mesh(new THREE.CylinderGeometry(.1, .14, 4, 5), materials.metal, -13 + i * 5, 2, -10.5);
    g.add(pole);
  }
  const pulse = new THREE.PointLight(0xffc62e, 6.4, 38, 2);
  pulse.position.set(8, 13, -5);
  g.add(pulse);
  landmarkLights.push({ light: pulse, base: 6.4, phase: rng() * 8 });
  scene.add(g);
  for (const ox of [-7, 5]) colliders.push({ type: 'circle', x: x + ox, z: z + 1, r: 3.1, h: 6.5 });
}

function buildCreek(x, z) {
  const g = new THREE.Group();
  g.position.set(x, groundHeight(x, z) - .28, z);
  const creek = mesh(new THREE.PlaneGeometry(58, 15, 12, 2), materials.water, 0, 0, 0);
  creek.rotation.x = -Math.PI / 2;
  creek.rotation.z = -.48;
  g.add(creek);
  for (let i = 0; i < 30; i++) {
    const a = (rng() - .5) * 55;
    const side = rng() > .5 ? 1 : -1;
    const rock = mesh(new THREE.DodecahedronGeometry(.65 + rng() * 1.1, 0), materials.rock, a, .55, side * (6 + rng() * 3));
    rock.rotation.set(rng(), rng(), rng());
    g.add(rock);
  }
  const bridge = new THREE.Group();
  bridge.position.set(0, 1.05, 0);
  bridge.rotation.y = -0.48;
  for (let i = -5; i <= 5; i++) {
    if (i === 0 || i === 1) continue;
    const plank = mesh(new THREE.BoxGeometry(2.8, .25, 1.15), materials.wood, 0, (rng() - .5) * .12, i * 1.05);
    plank.rotation.y = (rng() - .5) * .1;
    bridge.add(plank);
  }
  for (const sx of [-1.55, 1.55]) bridge.add(mesh(new THREE.CylinderGeometry(.13, .16, 13, 6), materials.darkWood, sx, -.1, 0));
  g.add(bridge);
  const lantern = new THREE.PointLight(0xffa33a, 4.2, 27, 2);
  lantern.position.set(5, 3.5, 2);
  g.add(lantern);
  landmarkLights.push({ light: lantern, base: 4.2, phase: rng() * 8 });
  scene.add(g);
}

function buildShrine(x, z) {
  const g = new THREE.Group();
  g.position.set(x, groundHeight(x, z), z);
  for (const sx of [-4, 4]) {
    const post = mesh(new THREE.DodecahedronGeometry(1, 0), materials.rockDark, sx, 4.5, 0);
    post.scale.set(1.2, 4.5, 1.0);
    g.add(post);
    colliders.push({ type: 'circle', x: x + sx, z, r: 1.35, h: 9 });
  }
  const lintel = mesh(new THREE.BoxGeometry(10, 1.5, 1.8), materials.rockDark, 0, 9, 0);
  lintel.rotation.z = .06;
  g.add(lintel);
  for (let i = 0; i < 7; i++) {
    const print = new THREE.Group();
    const heel = mesh(new THREE.SphereGeometry(.48, 7, 5), materials.yellow, 0, .05, 0);
    heel.scale.set(.75, .12, 1.15);
    print.add(heel);
    for (let t = 0; t < 4; t++) {
      const toe = mesh(new THREE.SphereGeometry(.16 + t * .025, 6, 4), materials.yellow, -.34 + t * .23, .07, -.65 - Math.abs(t - 1.5) * .07);
      toe.scale.y = .12;
      print.add(toe);
    }
    print.position.set((i - 3) * 1.45, .15, 3 + Math.sin(i) * .5);
    print.rotation.y = i * .25 - .7;
    g.add(print);
  }
  const brazier = mesh(new THREE.CylinderGeometry(1.0, .65, 1.5, 7), materials.rust, 0, .8, -2.5);
  g.add(brazier);
  const glow = new THREE.PointLight(0xff5d2c, 7, 38, 2);
  glow.position.set(0, 2.4, -2.5);
  g.add(glow);
  landmarkLights.push({ light: glow, base: 7, phase: rng() * 8 });
  scene.add(g);
}

function buildExit(x, z) {
  const g = new THREE.Group();
  g.position.set(x, groundHeight(x, z), z);
  const road = mesh(new THREE.PlaneGeometry(30, 90), new THREE.MeshLambertMaterial({ color: 0x343a34 }), 0, .08, -16);
  road.rotation.x = -Math.PI / 2;
  g.add(road);
  for (const sx of [-9, 9]) {
    g.add(mesh(new THREE.CylinderGeometry(.35, .48, 8, 6), materials.metal, sx, 4, 0));
    const light = new THREE.SpotLight(0xffd26a, 0, 55, .58, .45, 1.2);
    light.position.set(sx, 7.5, 0);
    light.target.position.set(0, 0, -12);
    g.add(light, light.target);
    landmarkLights.push({ light, base: 10, phase: rng() * 8, exit: true });
  }
  g.add(mesh(new THREE.BoxGeometry(18, .45, .45), materials.yellow, 0, 3.8, 0));
  const sign = mesh(new THREE.BoxGeometry(8, 2.3, .25), materials.metal, 0, 7.3, .2);
  g.add(sign);
  const signGlow = mesh(new THREE.BoxGeometry(6.8, 1.2, .06), materials.yellow, 0, 7.3, .04);
  g.add(signGlow);
  scene.add(g);
}

function buildObjectives() {
  for (let i = 0; i < traceObjectives.length; i++) {
    const obj = traceObjectives[i];
    obj.targetX = obj.x + objectiveOffsets[i].x;
    obj.targetZ = obj.z + objectiveOffsets[i].z;
    const group = new THREE.Group();
    const baseY = groundHeight(obj.targetX, obj.targetZ);
    const core = mesh(new THREE.OctahedronGeometry(.58, 0), materials.yellow, 0, 1.6, 0);
    const ring = mesh(new THREE.TorusGeometry(1.05, .08, 5, 16), materials.yellow, 0, 1.6, 0);
    ring.rotation.x = Math.PI / 2;
    const shardMat = new THREE.MeshBasicMaterial({ color: 0xffdd67, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const aura = mesh(new THREE.SphereGeometry(1.6, 10, 7), shardMat, 0, 1.6, 0);
    const light = new THREE.PointLight(0xffc62e, 5.5, 28, 2);
    light.position.set(0, 2.4, 0);
    group.add(core, ring, aura, light);
    group.position.set(obj.targetX, baseY, obj.targetZ);
    group.userData = { core, ring, aura, light, index: i, collected: false };
    group.visible = false;
    scene.add(group);
    evidenceMeshes.push(group);
  }

  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc62e, transparent: true, opacity: .30, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffdf65, transparent: true, opacity: .82, depthWrite: false, depthTest: false, toneMapped: false });
  const beam = mesh(new THREE.CylinderGeometry(1.4, 4.8, 110, 12, 1, true), beamMat);
  const beamCore = mesh(new THREE.CylinderGeometry(.22, .65, 118, 8), coreMat);
  beam.renderOrder = beamCore.renderOrder = 999;
  const beaconLight = new THREE.PointLight(0xffc62e, 9, 64, 2);
  scene.userData.objectiveBeacon = new THREE.Group();
  scene.userData.objectiveBeacon.add(beam, beamCore, beaconLight);
  scene.add(scene.userData.objectiveBeacon);
  exitObjective.targetX = exitObjective.x;
  exitObjective.targetZ = exitObjective.z;
  setBeaconTarget(traceObjectives[0]);
}

function buildFieldTasks() {
  const taskGlow = new THREE.MeshBasicMaterial({ color: 0x87e7d2, toneMapped: false });
  const taskDim = new THREE.MeshLambertMaterial({ color: 0x315c54, emissive: 0x102b25, flatShading: true });

  const addNode = (taskIndex, x, z, kind, label, model) => {
    const group = new THREE.Group();
    group.position.set(x, groundHeight(x, z), z);
    group.userData = { taskIndex, kind, label, done: false };
    group.add(model);
    const ring = mesh(new THREE.TorusGeometry(.72, .055, 5, 18), taskGlow, 0, 1.1, 0);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const light = new THREE.PointLight(0x77d9c3, 2.8, 12, 2);
    light.position.y = 1.4;
    group.add(light);
    group.userData.ring = ring;
    group.userData.light = light;
    group.visible = taskIndex === 0;
    scene.add(group);
    taskObjects[taskIndex].push(group);
    return group;
  };

  const footprint = () => {
    const g = new THREE.Group();
    const heel = mesh(new THREE.SphereGeometry(.32, 6, 4), taskGlow, 0, .08, 0);
    heel.scale.set(.75, .12, 1.25);
    g.add(heel);
    for (let i = 0; i < 4; i++) {
      const toe = mesh(new THREE.SphereGeometry(.1 + i * .018, 5, 3), taskGlow, -.23 + i * .16, .09, -.43);
      toe.scale.y = .16;
      g.add(toe);
    }
    return g;
  };
  addNode(0, 102, -122, 'photo', 'TRACK A', footprint());
  addNode(0, 118, -125, 'photo', 'TRACK B', footprint());
  addNode(0, 106, -141, 'photo', 'TRACK C', footprint());

  const fuel = mesh(new THREE.BoxGeometry(.75, 1.25, .5), materials.red, 0, .66, 0);
  const fuelHandle = mesh(new THREE.TorusGeometry(.21, .06, 5, 10, Math.PI), materials.metal, 0, 1.34, 0);
  fuel.add(fuelHandle);
  addNode(1, 270, -244, 'fuel', 'TAKE FUEL CAN', fuel);
  const generator = new THREE.Group();
  generator.add(mesh(new THREE.BoxGeometry(1.7, 1.2, 1.25), materials.rust, 0, .62, 0));
  generator.add(mesh(new THREE.CylinderGeometry(.35, .35, 1.9, 8), materials.black, 0, 1.15, 0));
  generator.children[1].rotation.z = Math.PI / 2;
  addNode(1, 252, -241, 'generator', 'INSTALL FUEL', generator);
  const starter = mesh(new THREE.BoxGeometry(.8, 1.3, .35), materials.metal, 0, .68, 0);
  starter.add(mesh(new THREE.BoxGeometry(.12, .7, .12), materials.yellow, 0, .8, .25));
  addNode(1, 257, -241, 'starter', 'PULL STARTER', starter);

  const tuner = new THREE.Group();
  tuner.add(mesh(new THREE.BoxGeometry(2.1, 1.35, 1.2), materials.metal, 0, .7, 0));
  tuner.add(mesh(new THREE.BoxGeometry(1.25, .55, .05), taskGlow, 0, .78, .63));
  for (const sx of [-.55, .55]) tuner.add(mesh(new THREE.CylinderGeometry(.05, .05, 1.6, 5), materials.metal, sx, 1.75, 0));
  addNode(2, 330, -32, 'tuner', 'TUNE FIELD RECEIVER', tuner);

  for (let i = 0; i < 3; i++) {
    const a = [-2.2, .15, 2.35][i];
    const rune = mesh(new THREE.OctahedronGeometry(.65, 0), i === 0 ? taskGlow : taskDim, 0, 1.3, 0);
    rune.rotation.z = Math.PI / 4;
    addNode(3, 230 + Math.cos(a) * 9.2, 190 + Math.sin(a) * 9.2, 'rune', `RUNE ${i + 1}`, rune);
  }

  const breakerPositions = [[-38, 303], [-28, 289], [-19, 304]];
  breakerPositions.forEach(([x, z], i) => {
    const breaker = new THREE.Group();
    breaker.add(mesh(new THREE.BoxGeometry(1.15, 1.8, .65), materials.metal, 0, .92, 0));
    for (let bar = 0; bar <= i; bar++) breaker.add(mesh(new THREE.BoxGeometry(.12, .48, .08), taskGlow, -.18 + bar * .18, 1.0, .37));
    addNode(4, x, z, 'breaker', `BREAKER ${['I', 'II', 'III'][i]}`, breaker);
  });

  const crossing = new THREE.Group();
  crossing.add(mesh(new THREE.TorusGeometry(1.3, .12, 6, 18), taskGlow, 0, 1.45, 0));
  crossing.children[0].rotation.y = Math.PI / 2;
  addNode(5, -255, 174, 'crossing', 'CLEAR THE BROKEN SPAN', crossing);

  const seal = new THREE.Group();
  const sealRing = mesh(new THREE.TorusGeometry(2.1, .16, 7, 24), taskGlow, 0, .15, 0);
  sealRing.rotation.x = Math.PI / 2;
  seal.add(sealRing);
  for (let i = 0; i < 6; i++) seal.add(mesh(new THREE.ConeGeometry(.18, .65, 4), materials.yellow, Math.cos(i / 6 * Math.PI * 2) * 1.55, .4, Math.sin(i / 6 * Math.PI * 2) * 1.55));
  addNode(6, -300, -116, 'seal', 'ACTIVATE THE WITNESS SEAL', seal);
  updateTaskVisibility();
}

function updateTaskVisibility() {
  for (let i = 0; i < taskObjects.length; i++) {
    for (const node of taskObjects[i]) node.visible = i === traceCount && !tasks[i].complete && !node.userData.done;
  }
  if (traceCount < 7) evidenceMeshes[traceCount].visible = tasks[traceCount].complete;
  updateMissionStep();
}

function setBeaconTarget(target) {
  const beacon = scene.userData.objectiveBeacon;
  const tx = target.targetX ?? target.x;
  const tz = target.targetZ ?? target.z;
  const y = groundHeight(tx, tz);
  beacon.position.set(tx, y + 55, tz);
  beacon.children[2].position.y = -52;
  beacon.visible = true;
}

function buildMoon() {
  const moon = mesh(new THREE.CircleGeometry(18, 24), new THREE.MeshBasicMaterial({ color: 0xdde7d7, fog: false, toneMapped: false }), -150, 132, -310);
  moon.lookAt(camera.position);
  scene.add(moon);
  for (let i = 0; i < 36; i++) {
    const trunk = mesh(new THREE.CylinderGeometry(.8, 1.2, 28 + rng() * 20, 5), materials.black, (rng() - .5) * 720, 12, -360 + rng() * 40);
    scene.add(trunk);
  }
}

function buildParticles() {
  const points = [];
  const colors = [];
  const c = new THREE.Color();
  for (let i = 0; i < 520; i++) {
    points.push((rng() - .5) * 720, 1 + rng() * 22, (rng() - .5) * 720);
    c.set(rng() > .86 ? 0xffd66a : 0x91aa9a);
    colors.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: .12, vertexColors: true, transparent: true, opacity: .58, depthWrite: false, blending: THREE.AdditiveBlending });
  const particleField = new THREE.Points(geo, mat);
  particleField.name = 'particles';
  scene.add(particleField);
}

function addLooseDebris(x, z) {
  const item = mesh(rng() > .5 ? new THREE.BoxGeometry(.4 + rng(), .25 + rng() * .5, .5 + rng() * 1.3) : new THREE.DodecahedronGeometry(.35 + rng() * .45, 0), rng() > .5 ? materials.rust : materials.rockDark);
  item.position.set(x, groundHeight(x, z) + .25, z);
  item.rotation.set(rng(), rng() * Math.PI, rng());
  scene.add(item);
}

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

function setupFlashlight() {
  const spot = new THREE.SpotLight(0xfff0c4, 16, 68, .34, .68, 1.1);
  spot.position.set(.18, -.13, .05);
  spot.target.position.set(.1, -.15, -28);
  camera.add(spot, spot.target);
  const nearFill = new THREE.PointLight(0xffe3a0, 1.8, 9, 2);
  nearFill.position.set(.25, -.4, -1.2);
  camera.add(nearFill);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xffe4a5, transparent: true, opacity: .034, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  const cone = mesh(new THREE.ConeGeometry(9.4, 36, 20, 1, true), coneMat, .15, -.15, -18);
  cone.rotation.x = Math.PI / 2;
  camera.add(cone);
  camera.userData.flashlight = { spot, nearFill, cone };
  scene.add(camera);
  applyFlashlightState(false);
}

function getBitfootProfiles() {
  return [
  { name: 'CINDER', head: '03', primary: 0x495169, secondary: 0x0d2140, accent: 0xf57927, glow: 0xd83a17, detail: 'ember', headAspect: 450 / 875, headHeight: 2.72, shoulder: 1.08 },
  { name: 'RANGER', head: '06', primary: 0x885e6b, secondary: 0x472e3e, accent: 0xf8f6ec, glow: 0x6e4250, detail: 'coat', headAspect: 550 / 650, headHeight: 2.18, shoulder: .98 },
  { name: 'ROSE', head: '09', primary: 0xffc5c5, secondary: 0xeb758f, accent: 0x0d2140, glow: 0xd74f83, detail: 'harness', headAspect: 450 / 650, headHeight: 2.22, shoulder: .92 },
  { name: 'MOSS', head: '12', primary: 0x4da24f, secondary: 0x2e6f2e, accent: 0xb04e49, glow: 0x235f28, detail: 'bark', headAspect: 450 / 650, headHeight: 2.24, shoulder: 1.12 },
  { name: 'SIGNAL', head: '15', primary: 0x9b9ead, secondary: 0x495169, accent: 0x258fd5, glow: 0x173f6d, detail: 'runner', headAspect: 450 / 600, headHeight: 2.16, shoulder: 1.0 }
  ];
}

function createEnemies() {
  const loader = new THREE.TextureLoader();
  const bitfootProfiles = getBitfootProfiles();
  for (let i = 0; i < 5; i++) {
    const profile = bitfootProfiles[i];
    const g = new THREE.Group();
    g.name = `bitfoot-${profile.name.toLowerCase()}`;
    const makeBodyMaterial = (color, emissive = profile.glow, emissiveIntensity = .16) => {
      const material = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness: .86, metalness: .03, flatShading: true });
      material.userData.baseEmissiveIntensity = emissiveIntensity;
      return material;
    };
    const primaryMat = makeBodyMaterial(profile.primary);
    const secondaryMat = makeBodyMaterial(profile.secondary, profile.glow, .1);
    const accentMat = makeBodyMaterial(profile.accent, profile.accent, .28);
    const darkMat = makeBodyMaterial(0x091321, profile.secondary, .08);
    const bodyMaterials = [primaryMat, secondaryMat, accentMat, darkMat];

    const torso = mesh(new THREE.DodecahedronGeometry(1, 0), primaryMat, 0, 2.9, 0);
    torso.scale.set(profile.shoulder, 1.28, .68);
    const abdomen = mesh(new THREE.CylinderGeometry(.57, .7, .88, 6), secondaryMat, 0, 1.98, 0);
    const pelvis = mesh(new THREE.DodecahedronGeometry(.64, 0), secondaryMat, 0, 1.62, 0);
    pelvis.scale.set(1.18, .62, .85);
    g.add(torso, abdomen, pelvis);

    const rig = { torso, arms: [], legs: [], accents: [] };
    for (const side of [-1, 1]) {
      const shoulder = mesh(new THREE.DodecahedronGeometry(.4, 0), accentMat, side * profile.shoulder, 3.46, 0);
      shoulder.scale.set(1.2, .8, 1.05);
      g.add(shoulder);

      const armPivot = new THREE.Group();
      armPivot.position.set(side * profile.shoulder, 3.42, 0);
      armPivot.rotation.z = side * .08;
      const upperArm = mesh(new THREE.CylinderGeometry(.25, .32, 1.08, 5), primaryMat, 0, -.55, 0);
      const forearm = mesh(new THREE.CylinderGeometry(.2, .26, 1.05, 5), secondaryMat, side * .025, -1.56, .02);
      const hand = mesh(new THREE.BoxGeometry(.42, .38, .48), darkMat, side * .03, -2.08, .08);
      const clawA = mesh(new THREE.ConeGeometry(.07, .34, 4), accentMat, side * -.09, -2.37, .13);
      const clawB = mesh(new THREE.ConeGeometry(.07, .31, 4), accentMat, side * .09, -2.34, .13);
      armPivot.add(upperArm, forearm, hand, clawA, clawB);
      g.add(armPivot);
      rig.arms.push(armPivot);

      const legPivot = new THREE.Group();
      legPivot.position.set(side * .38, 1.72, 0);
      const thigh = mesh(new THREE.CylinderGeometry(.29, .35, .95, 5), primaryMat, 0, -.43, 0);
      const shin = mesh(new THREE.CylinderGeometry(.21, .28, 1.02, 5), secondaryMat, 0, -1.33, .01);
      const foot = mesh(new THREE.BoxGeometry(.56, .27, .9), darkMat, 0, -1.67, .22);
      legPivot.add(thigh, shin, foot);
      g.add(legPivot);
      rig.legs.push(legPivot);
    }

    const chestCore = mesh(new THREE.OctahedronGeometry(.28, 0), accentMat, 0, 2.95, .69);
    g.add(chestCore);
    rig.accents.push(chestCore);
    if (profile.detail === 'ember') {
      for (const side of [-1, 1]) {
        const spike = mesh(new THREE.ConeGeometry(.17, .9, 5), accentMat, side * .82, 3.93, -.05);
        spike.rotation.z = side * -.32;
        g.add(spike);
      }
      const emberBand = mesh(new THREE.BoxGeometry(1.35, .18, .09), accentMat, 0, 2.48, .66);
      g.add(emberBand);
    } else if (profile.detail === 'coat') {
      for (const side of [-1, 1]) {
        const tail = mesh(new THREE.BoxGeometry(.57, 1.35, .18), secondaryMat, side * .34, 1.23, -.31);
        tail.rotation.z = side * .08;
        g.add(tail);
        const collar = mesh(new THREE.BoxGeometry(.72, .2, .34), accentMat, side * .38, 3.58, .42);
        collar.rotation.z = side * .24;
        g.add(collar);
      }
    } else if (profile.detail === 'harness') {
      const strapA = mesh(new THREE.BoxGeometry(.18, 1.75, .09), darkMat, -.34, 2.94, .68);
      const strapB = mesh(new THREE.BoxGeometry(.18, 1.75, .09), darkMat, .34, 2.94, .68);
      strapA.rotation.z = -.34;
      strapB.rotation.z = .34;
      g.add(strapA, strapB);
    } else if (profile.detail === 'bark') {
      for (const side of [-1, 1]) {
        const branch = mesh(new THREE.ConeGeometry(.13, .85, 5), secondaryMat, side * 1.0, 3.88, -.08);
        branch.rotation.z = side * -.58;
        g.add(branch);
      }
      const sash = mesh(new THREE.BoxGeometry(1.45, .22, .1), accentMat, 0, 2.4, .67);
      sash.rotation.z = -.12;
      g.add(sash);
    } else if (profile.detail === 'runner') {
      const stripeColors = [0xe21d42, 0xf8f6ec, 0x258fd5];
      stripeColors.forEach((color, stripeIndex) => {
        const stripeMat = makeBodyMaterial(color, color, .32);
        bodyMaterials.push(stripeMat);
        const stripe = mesh(new THREE.BoxGeometry(1.35, .1, .08), stripeMat, 0, 3.25 - stripeIndex * .16, .69);
        g.add(stripe);
      });
    }

    const texture = loader.load(`assets/heads-cropped/bitfoot-head-${profile.head}.png`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    const headWidth = profile.headHeight * profile.headAspect;
    const headY = 3.34 + profile.headHeight / 2;
    const headBacking = mesh(new THREE.BoxGeometry(Math.max(1.1, headWidth * .72), profile.headHeight * .68, .5), secondaryMat, 0, headY - .08, -.04);
    const headMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .04, side: THREE.DoubleSide, depthWrite: true, toneMapped: false });
    const head = mesh(new THREE.PlaneGeometry(headWidth, profile.headHeight), headMaterial, 0, headY, .31);
    head.renderOrder = 4;
    g.add(headBacking, head);
    rig.head = head;
    rig.headBaseY = headY;
    const presenceLight = new THREE.PointLight(profile.accent, 1.15, 9, 2);
    presenceLight.position.set(0, 3.35, .65);
    g.add(presenceLight);

    g.visible = false;
    g.scale.setScalar(.96 + rng() * .08);
    scene.add(g);
    enemies.push({ group: g, profile, rig, bodyMaterials, footOffset: .1, active: false, state: 'hidden', speed: 0, nextDecision: 0, phase: rng() * 10, side: i % 2 ? 1 : -1, grace: 0 });
  }
}

function placePlayer(x, z, facingYaw = 0) {
  camera.position.set(x, groundHeight(x, z) + EYE_HEIGHT, z);
  yaw = facingYaw;
  pitch = -.025;
  camera.rotation.set(pitch, yaw, 0);
}

function setupEvents() {
  addEventListener('resize', onResize);
  addEventListener('keydown', (event) => {
    keys[event.code] = true;
    if (event.code === 'KeyE' && !event.repeat) interactPressed = true;
    if (event.code === 'Space' && !event.repeat) jumpPressed = true;
    if (event.code === 'KeyF' && !event.repeat && mode === 'playing') toggleFlashlight();
    if (event.code === 'KeyQ' && !event.repeat && mode === 'playing') throwDecoy();
    if (event.code === 'KeyR' && !event.repeat && mode === 'playing') useFieldCamera();
    if (event.code === 'KeyM' && !event.repeat && (mode === 'playing' || mode === 'controls')) toggleMusic();
    if (event.code === 'Tab' && !event.repeat && (mode === 'playing' || mode === 'controls')) {
      event.preventDefault();
      if (mode === 'playing') openControls(); else closeControls();
    }
    if (event.code === 'Escape' && mode === 'playing') pauseGame();
  });
  addEventListener('keyup', (event) => {
    keys[event.code] = false;
    if (event.code === 'KeyE') taskELatch = false;
  });
  addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== renderer.domElement || mode !== 'playing') return;
    yaw -= event.movementX * .00205 * mouseSensitivity;
    pitch -= event.movementY * .00175 * mouseSensitivity;
    pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.35);
  });
  renderer.domElement.addEventListener('mousedown', (event) => {
    if (mode !== 'playing') return;
    if (document.pointerLockElement !== renderer.domElement) requestPointerLockSafe();
  });
  document.addEventListener('pointerlockchange', () => {
    if (mode === 'playing' && document.pointerLockElement !== renderer.domElement) pauseGame();
  });
  ui.start.addEventListener('click', showBriefing);
  ui.begin.addEventListener('click', startGame);
  ui.resume.addEventListener('click', resumeGame);
  ui.pauseRestart.addEventListener('click', restartGame);
  ui.deathRestart.addEventListener('click', restartGame);
  ui.endingRestart.addEventListener('click', restartGame);
  ui.copy.addEventListener('click', copyReport);
  ui.controlsResume.addEventListener('click', closeControls);
  ui.fullscreen.addEventListener('click', requestGameFullscreen);
  ui.fullscreenToggle.addEventListener('click', requestGameFullscreen);
  ui.mouseSensitivity.addEventListener('input', () => { mouseSensitivity = Number(ui.mouseSensitivity.value) / 100; });
  ui.musicVolume.addEventListener('input', updateAudioSettings);
  ui.sfxVolume.addEventListener('input', updateAudioSettings);
  ui.qualitySelect.addEventListener('change', () => {
    qualityMode = ui.qualitySelect.value;
    if (qualityMode === 'high') renderScale = 1;
    if (qualityMode === 'performance') renderScale = .6;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35) * renderScale);
    renderer.setSize(innerWidth, innerHeight, false);
  });

  if (matchMedia('(pointer: coarse)').matches && innerWidth < 900) {
    ui.mobile.classList.add('active');
  }
}

function showBriefing() {
  ensureAudio();
  ui.title.classList.remove('active');
  ui.briefing.classList.add('active');
  const lines = [
    'Seven encrypted field traces are still transmitting from Black Pine Forest.',
    'Each landmark requires a different field procedure. Read the objective under the receiver.',
    'Your flashlight slows anything caught in the centre of its beam. It does not stop them.',
    'Running is loud. Crouch with C or throw an echo decoy with Q to redirect the pack.',
    'Press TAB at any time for controls and settings.'
  ];
  ui.briefingCopy.innerHTML = '';
  ui.begin.classList.add('hidden');
  let line = 0;
  clearInterval(typingTimer);
  typingTimer = setInterval(() => {
    if (line >= lines.length) {
      clearInterval(typingTimer);
      ui.begin.classList.remove('hidden');
      return;
    }
    const p = document.createElement('p');
    p.textContent = `> ${lines[line++]}`;
    ui.briefingCopy.appendChild(p);
    playTick();
  }, 580);
}

function startGame() {
  ensureAudio();
  ui.briefing.classList.remove('active');
  ui.hud.classList.remove('hidden');
  ui.reticle.classList.remove('hidden');
  ui.controlStrip.classList.remove('hidden');
  mode = 'playing';
  lastFrameTime = performance.now();
  requestPointerLockSafe();
  showChapter('TRACE 01', traceObjectives[0].chapter);
  showSubtitle('Receiver locked. Find the van and photograph three marked tracks with R.', 6);
  playSting(108, .7);
}

function pauseGame() {
  if (mode !== 'playing') return;
  mode = 'paused';
  ui.pause.classList.add('active');
  if (document.pointerLockElement) document.exitPointerLock();
}

function resumeGame() {
  if (mode !== 'paused') return;
  ui.pause.classList.remove('active');
  mode = 'playing';
  lastFrameTime = performance.now();
  requestPointerLockSafe();
}

function openControls() {
  if (mode !== 'playing') return;
  mode = 'controls';
  ui.controls.classList.add('active');
  if (document.pointerLockElement) document.exitPointerLock();
}

function closeControls() {
  if (mode !== 'controls') return;
  ui.controls.classList.remove('active');
  mode = 'playing';
  lastFrameTime = performance.now();
  requestPointerLockSafe();
}

function requestPointerLockSafe() {
  if (document.pointerLockElement === renderer.domElement || !renderer.domElement.requestPointerLock) return;
  try {
    const attempt = renderer.domElement.requestPointerLock();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
  } catch (_) {
    // Some embedded Chromium builds reject pointer lock while automated or unfocused.
    // The next click on the canvas retries without breaking the game loop.
  }
}

function requestGameFullscreen() {
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

function updateAudioSettings() {
  if (!audio) return;
  const musicValue = Number(ui.musicVolume.value) / 100;
  const sfxValue = Number(ui.sfxVolume.value) / 100;
  audio.musicBus.gain.setTargetAtTime(musicMuted ? 0 : musicValue, audio.ctx.currentTime, .08);
  audio.sfxBus.gain.setTargetAtTime(sfxValue, audio.ctx.currentTime, .08);
}

function toggleMusic() {
  musicMuted = !musicMuted;
  updateAudioSettings();
  ui.toggleToast.textContent = musicMuted ? 'HORROR SCORE MUTED' : 'HORROR SCORE ON';
  ui.toggleToast.classList.add('show');
  toastTimer = 1.4;
}

function restartGame() { location.reload(); }

function toggleFlashlight() {
  flashlightOn = !flashlightOn && battery > 0;
  applyFlashlightState(true);
}

function applyFlashlightState(withFeedback = true) {
  const f = camera.userData.flashlight;
  f.spot.visible = flashlightOn;
  f.nearFill.visible = flashlightOn;
  f.cone.visible = flashlightOn;
  ui.flashlightLabel.textContent = flashlightOn ? 'ON' : 'OFF';
  ui.flashlightState.classList.toggle('on', flashlightOn);
  ui.flashlightState.classList.toggle('off', !flashlightOn);
  if (withFeedback) {
    ui.toggleToast.textContent = flashlightOn ? 'FLASHLIGHT ON' : 'FLASHLIGHT OFF';
    ui.toggleToast.classList.add('show');
    toastTimer = 1.2;
    playClick(flashlightOn);
  }
}

function updatePlayer(dt) {
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3();
  if (!tuningActive) {
    if (keys.KeyW || keys.ArrowUp) move.add(forward);
    if (keys.KeyS || keys.ArrowDown) move.sub(forward);
    if (keys.KeyD || keys.ArrowRight) move.add(right);
    if (keys.KeyA || keys.ArrowLeft) move.sub(right);
  }
  const moving = move.lengthSq() > .01;
  crouching = (keys.KeyC || keys.ControlLeft) && grounded && !tuningActive;
  const sprinting = moving && !crouching && (keys.ShiftLeft || keys.ShiftRight) && stamina > 1;
  const speed = crouching ? 2.25 : sprinting ? SPRINT_SPEED : WALK_SPEED;
  if (moving) {
    move.normalize().multiplyScalar(speed * dt * (grounded ? 1 : .64));
    movePlayerWithCollision(move.x, move.z);
    bobTime += dt * (sprinting ? 13.5 : 8.2);
  } else {
    bobTime += dt * 2;
  }
  stamina += (sprinting ? -27 : 19) * dt;
  stamina = THREE.MathUtils.clamp(stamina, 0, 100);
  if ((keys.Space || jumpPressed) && grounded && !crouching && !tuningActive) {
    jumpVelocity = JUMP_SPEED;
    grounded = false;
    playFootstep(true);
  }
  if (!grounded) {
    jumpVelocity -= GRAVITY * dt;
    jumpOffset += jumpVelocity * dt;
    if (jumpOffset <= 0) {
      jumpOffset = 0;
      jumpVelocity = 0;
      grounded = true;
      playFootstep(true);
    }
  }
  const ground = groundHeight(camera.position.x, camera.position.z);
  const bob = moving && grounded ? Math.sin(bobTime) * (sprinting ? .075 : .038) : 0;
  const sway = moving && grounded ? Math.cos(bobTime * .5) * .018 : 0;
  const eyeTarget = crouching ? 1.12 : EYE_HEIGHT;
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, ground + eyeTarget + jumpOffset + bob, 1 - Math.exp(-dt * 14));
  camera.rotation.set(pitch + Math.sin(elapsed * 41) * shake * .006, yaw, sway + Math.cos(elapsed * 37) * shake * .004);
  shake = Math.max(0, shake - dt * 1.8);
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -HALF_WORLD + 5, HALF_WORLD - 5);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -HALF_WORLD + 5, HALF_WORLD - 5);
  ui.staminaFill.style.transform = `scaleX(${stamina / 100})`;
  const targetNoise = sprinting ? 100 : moving ? (crouching ? 9 : 38) : 0;
  noiseLevel = THREE.MathUtils.lerp(noiseLevel, targetNoise, 1 - Math.exp(-dt * (targetNoise > noiseLevel ? 7 : 2.4)));
  ui.noiseFill.style.transform = `scaleX(${noiseLevel / 100})`;
}

function movePlayerWithCollision(dx, dz) {
  const startX = camera.position.x;
  const startZ = camera.position.z;
  const targetX = startX + dx;
  const targetZ = startZ + dz;
  if (!isBlockedAt(targetX, targetZ)) {
    camera.position.x = targetX;
    camera.position.z = targetZ;
    return;
  }

  // Preserve momentum along obstacle edges instead of pinning the player on a corner.
  const canMoveX = !isBlockedAt(targetX, startZ);
  const canMoveZ = !isBlockedAt(startX, targetZ);
  if (canMoveX) camera.position.x = targetX;
  if (canMoveZ) camera.position.z = targetZ;

  if (!canMoveX && !canMoveZ) {
    const nudge = .055;
    const length = Math.hypot(dx, dz) || 1;
    const slideX = -dz / length * nudge;
    const slideZ = dx / length * nudge;
    for (const sign of [1, -1]) {
      const nx = startX + slideX * sign;
      const nz = startZ + slideZ * sign;
      if (!isBlockedAt(nx, nz)) {
        camera.position.x = nx;
        camera.position.z = nz;
        break;
      }
    }
  }
}

function isBlockedAt(px, pz) {
  const playerRadius = .38;
  const gx = Math.floor(px / 12);
  const gz = Math.floor(pz / 12);
  let blocked = false;
  for (let ix = gx - 1; ix <= gx + 1; ix++) {
    for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const trees = treeGrid.get(`${ix},${iz}`) || [];
      for (const t of trees) {
        if (Math.hypot(px - t.x, pz - t.z) < playerRadius + t.r) { blocked = true; break; }
      }
      if (blocked) break;
    }
    if (blocked) break;
  }
  if (!blocked) {
    for (const c of colliders) {
      // The player's feet clear waist-high trail obstacles during the useful
      // middle of a jump; tall landmarks remain solid at every jump height.
      if (c.h <= 1.35 && jumpOffset + .48 >= c.h) continue;
      if (Math.hypot(px - c.x, pz - c.z) < playerRadius + c.r) { blocked = true; break; }
    }
  }
  return blocked;
}

function updateFlashlight(dt) {
  if (flashlightOn) {
    battery -= dt * .66;
    if (battery <= 0) {
      battery = 0;
      flashlightOn = false;
      applyFlashlightState(true);
      showSubtitle('Battery depleted. The moonlight is all you have.', 4);
    }
  }
  if (flashlightOn && battery < 22) {
    const flicker = Math.sin(elapsed * 31) > .82 && Math.sin(elapsed * 7.7) > .25;
    camera.userData.flashlight.spot.intensity = flicker ? 3 : 16;
    camera.userData.flashlight.cone.material.opacity = flicker ? .008 : .034;
  } else {
    camera.userData.flashlight.spot.intensity = 16;
    camera.userData.flashlight.cone.material.opacity = .034;
  }
  ui.batteryFill.style.transform = `scaleX(${battery / 100})`;
  ui.batteryFill.style.background = battery < 22 ? '#ec5d3f' : '#ffc62e';
}

function updateInteraction(dt) {
  const target = traceCount < 7 ? traceObjectives[traceCount] : exitObjective;
  const tx = target.targetX ?? target.x;
  const tz = target.targetZ ?? target.z;
  const distance = Math.hypot(camera.position.x - tx, camera.position.z - tz);
  if (traceCount < 7 && !tasks[traceCount].complete) {
    updateFieldTask(dt);
  } else if (traceCount < 7 && distance < 4.5) {
    ui.interaction.classList.remove('hidden');
    ui.interactionLabel.textContent = 'HOLD E — RECOVER SHIELDED TRACE';
    if (keys.KeyE) interactionProgress += dt / 1.05;
    else interactionProgress = Math.max(0, interactionProgress - dt * 2.4);
    ui.interactionFill.style.width = `${Math.min(1, interactionProgress) * 100}%`;
    if (interactionProgress >= 1) collectTrace();
  } else {
    interactionProgress = 0;
    ui.interaction.classList.add('hidden');
    ui.interactionFill.style.width = '0%';
  }
  if (traceCount === 7 && distance < 8.5) completeGame();
}

function updateMissionStep() {
  if (traceCount >= 7) {
    ui.missionStep.textContent = 'ALL TRACES SECURED — REACH THE FLOODLIT GATE';
    return;
  }
  const task = tasks[traceCount];
  if (task.complete) {
    ui.missionStep.textContent = 'TRACE EXPOSED — HOLD E TO RECOVER';
    setBeaconTarget(traceObjectives[traceCount]);
    return;
  }
  const messages = [
    `R: PHOTOGRAPH THE MARKED TRACKS — ${task.step}/3`,
    ['FIND THE RED FUEL CAN', 'CARRY FUEL TO THE GENERATOR', 'PULL THE CABIN STARTER'][task.step],
    tuningActive ? 'A / D: HOLD THE NEEDLE INSIDE THE SIGNAL BAND' : 'FIND THE TOWER RECEIVER AND PRESS E',
    `KEEP THE FLASHLIGHT ON THE ACTIVE RUNE — ${task.step}/3`,
    `BREAKER ORDER: II → III → I — ${task.step}/3`,
    'SPRINT + SPACE: JUMP THE BROKEN BRIDGE SPAN',
    task.active ? `STAY INSIDE THE SEAL — ${Math.max(0, 12 - task.progress * 12).toFixed(1)} SEC` : 'ACTIVATE THE SHRINE SEAL WITH E'
  ];
  ui.missionStep.textContent = messages[traceCount];
  updateProcedureBeacon();
}

function updateProcedureBeacon() {
  if (traceCount >= 7 || tasks[traceCount].complete) return;
  const node = getProcedureNode();
  if (node) setBeaconTarget(node.position);
}

function getProcedureNode() {
  if (traceCount >= 7 || tasks[traceCount].complete) return null;
  const task = tasks[traceCount];
  let node = null;
  if (task.type === 'camera') node = taskObjects[0].find((item) => !item.userData.done);
  if (task.type === 'generator') node = taskObjects[1][task.step];
  if (task.type === 'tuner') node = taskObjects[2][0];
  if (task.type === 'runes') node = taskObjects[3][task.step];
  if (task.type === 'breakers') node = taskObjects[4][task.order[task.step]];
  if (task.type === 'crossing') node = taskObjects[5][0];
  if (task.type === 'seal') node = taskObjects[6][0];
  return node || null;
}

function getNavigationTarget() {
  const procedureNode = getProcedureNode();
  if (procedureNode) return procedureNode.position;
  return traceCount < 7 ? traceObjectives[traceCount] : exitObjective;
}

function updateFieldTask(dt) {
  const task = tasks[traceCount];
  if (!task) return;
  if (task.type === 'camera') {
    const nearest = taskObjects[0]
      .filter((node) => !node.userData.done)
      .map((node) => ({ node, distance: horizontalDistanceTo(node.position) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest && nearest.distance < 8.5) {
      ui.interaction.classList.remove('hidden');
      ui.interactionLabel.textContent = `PRESS R OR E — PHOTOGRAPH ${nearest.node.userData.label}`;
      ui.interactionFill.style.width = '100%';
      if ((keys.KeyE || interactPressed) && !taskELatch) {
        taskELatch = true;
        useFieldCamera(nearest.node);
      }
    } else if (nearest && nearest.distance < 22) {
      ui.interaction.classList.remove('hidden');
      ui.interactionLabel.textContent = `MOVE CLOSER TO ${nearest.node.userData.label} — ${Math.ceil(nearest.distance)} M`;
      ui.interactionFill.style.width = '0%';
    } else hideInteraction();
    return;
  }
  if (task.type === 'generator') {
    const node = taskObjects[1][task.step];
    const distance = horizontalDistanceTo(node.position);
    if (distance < 3.2) {
      ui.interaction.classList.remove('hidden');
      ui.interactionLabel.textContent = `HOLD E — ${node.userData.label}`;
      if (keys.KeyE) interactionProgress += dt / (task.step === 2 ? .55 : 1.05);
      else interactionProgress = Math.max(0, interactionProgress - dt * 2.4);
      ui.interactionFill.style.width = `${Math.min(1, interactionProgress) * 100}%`;
      if (interactionProgress >= 1) {
        node.userData.done = true;
        node.visible = false;
        task.step++;
        interactionProgress = 0;
        playMechanicalClunk();
        if (task.step >= 3) completeFieldTask('Generator online. The cabin trace is materialising.');
        else updateMissionStep();
      }
    } else hideInteraction();
    return;
  }
  if (task.type === 'tuner') {
    const node = taskObjects[2][0];
    const distance = horizontalDistanceTo(node.position);
    if (!tuningActive) {
      if (distance < 3.4) {
        ui.interaction.classList.remove('hidden');
        ui.interactionLabel.textContent = 'PRESS E — OPEN RECEIVER TUNER';
        ui.interactionFill.style.width = '0%';
        if ((keys.KeyE || interactPressed) && !taskELatch) {
          taskELatch = true;
          tuningActive = true;
          ui.tuningPanel.classList.remove('hidden');
          playClick(true);
          updateMissionStep();
        }
      } else hideInteraction();
      return;
    }
    hideInteraction();
    if (keys.KeyA || keys.ArrowLeft) task.value -= dt * .3;
    if (keys.KeyD || keys.ArrowRight) task.value += dt * .3;
    task.value = THREE.MathUtils.clamp(task.value + Math.sin(elapsed * 3.7) * dt * .008, 0, 1);
    const locked = task.value > .63 && task.value < .76;
    task.progress = THREE.MathUtils.clamp(task.progress + dt * (locked ? .72 : -1.5), 0, 1);
    ui.tuningNeedle.style.left = `${task.value * 100}%`;
    ui.tuningStatus.textContent = locked ? `SIGNAL LOCK ${Math.round(task.progress * 100)}%` : `FREQUENCY ${Math.round(task.value * 100)}%`;
    if (task.progress >= 1) {
      tuningActive = false;
      ui.tuningPanel.classList.add('hidden');
      node.userData.done = true;
      node.visible = false;
      completeFieldTask('Frequency 303 locked. Something answered from below the tower.');
    }
    return;
  }
  if (task.type === 'runes') {
    const node = taskObjects[3][task.step];
    const aimed = flashlightOn && isAimingAt(node.position, 15, .965);
    if (aimed) {
      ui.interaction.classList.remove('hidden');
      ui.interactionLabel.textContent = `KEEP LIGHT ON ${node.userData.label}`;
      task.progress += dt / 1.25;
      ui.interactionFill.style.width = `${Math.min(1, task.progress) * 100}%`;
      if (task.progress >= 1) {
        node.userData.done = true;
        node.visible = false;
        task.step++;
        task.progress = 0;
        playTraceSound();
        if (task.step >= 3) completeFieldTask('All witness runes illuminated. The stones are looking back.');
        else updateMissionStep();
      }
    } else {
      task.progress = Math.max(0, task.progress - dt * .8);
      if (horizontalDistanceTo(node.position) < 15) {
        ui.interaction.classList.remove('hidden');
        ui.interactionLabel.textContent = 'AIM THE FLASHLIGHT AT THE ACTIVE RUNE';
        ui.interactionFill.style.width = `${task.progress * 100}%`;
      } else hideInteraction();
    }
    return;
  }
  if (task.type === 'breakers') {
    const nearby = taskObjects[4].find((node) => !node.userData.done && horizontalDistanceTo(node.position) < 3.2);
    if (nearby) {
      ui.interaction.classList.remove('hidden');
      ui.interactionLabel.textContent = `PRESS E — ${nearby.userData.label}`;
      ui.interactionFill.style.width = '0%';
      if ((keys.KeyE || interactPressed) && !taskELatch) {
        taskELatch = true;
        const selected = taskObjects[4].indexOf(nearby);
        if (selected === task.order[task.step]) {
          nearby.userData.done = true;
          nearby.visible = false;
          task.step++;
          playMechanicalClunk();
          if (task.step >= 3) completeFieldTask('Relay sequence accepted. Shielded packet released.');
          else updateMissionStep();
        } else {
          task.step = 0;
          for (const node of taskObjects[4]) { node.userData.done = false; node.visible = true; }
          showSubtitle('WRONG SEQUENCE — the relay broadcast your position.', 4);
          noiseLevel = 100;
          forceHuntersToInvestigate(camera.position.x, camera.position.z, 10);
          playSting(62, .8);
          updateMissionStep();
        }
      }
    } else hideInteraction();
    return;
  }
  if (task.type === 'crossing') {
    const node = taskObjects[5][0];
    const distance = horizontalDistanceTo(node.position);
    if (distance < 16 && jumpOffset > .18) nearCreekJump = true;
    if (distance < 5.4 && nearCreekJump) {
      node.userData.done = true;
      node.visible = false;
      completeFieldTask('Crossing cleared. The trace was caught in the bridge timbers.');
    } else {
      hideInteraction();
      if (distance < 18) showSubtitle('The centre boards are gone. Sprint and jump the marked span.', 2);
    }
    return;
  }
  if (task.type === 'seal') {
    const node = taskObjects[6][0];
    const distance = horizontalDistanceTo(node.position);
    if (!task.active && distance < 3.6) {
      ui.interaction.classList.remove('hidden');
      ui.interactionLabel.textContent = 'PRESS E — ACTIVATE WITNESS SEAL';
      ui.interactionFill.style.width = '0%';
      if ((keys.KeyE || interactPressed) && !taskELatch) {
        taskELatch = true;
        task.active = true;
        task.progress = 0;
        noiseLevel = 100;
        forceHuntersToInvestigate(node.position.x, node.position.z, 14);
        playSting(48, 1.2);
        updateMissionStep();
      }
    } else if (task.active) {
      if (distance > 10.5) {
        task.active = false;
        task.progress = 0;
        showSubtitle('SEAL BROKEN — return to the shrine circle.', 4);
      } else {
        task.progress += dt / 12;
        ui.interaction.classList.remove('hidden');
        ui.interactionLabel.textContent = `HOLD THE SEAL — ${Math.max(0, 12 - task.progress * 12).toFixed(1)} SEC`;
        ui.interactionFill.style.width = `${Math.min(1, task.progress) * 100}%`;
        if (task.progress >= 1) {
          node.userData.done = true;
          node.visible = false;
          completeFieldTask('The witness seal is open. Recover the final trace now.');
        }
      }
      updateMissionStep();
    } else hideInteraction();
  }
}

function useFieldCamera(preferredNode = null) {
  if (traceCount !== 0 || tasks[0].complete) {
    playCameraShutter(false);
    return;
  }
  const candidates = taskObjects[0]
    .filter((node) => !node.userData.done)
    .map((node) => ({ node, score: aimScore(node.position), distance: horizontalDistanceTo(node.position) }))
    .sort((a, b) => a.distance - b.distance);
  const preferred = preferredNode ? candidates.find((item) => item.node === preferredNode && item.distance < 8.5) : null;
  const aimed = candidates
    .filter((item) => item.distance < 18 && item.score > .90)
    .sort((a, b) => b.score - a.score)[0];
  const closeFallback = candidates.find((item) => item.distance < 8.5);
  const target = preferred || aimed || closeFallback;
  playCameraShutter(Boolean(target));
  flashScreen();
  if (!target) {
    const nearest = candidates[0];
    showSubtitle(nearest && nearest.distance < 24
      ? `FIELD CAMERA: move closer to ${nearest.node.userData.label}.`
      : 'FIELD CAMERA: follow the cyan beacon to a marked track.', 2.5);
    return;
  }
  target.node.userData.done = true;
  target.node.visible = false;
  tasks[0].step++;
  showSubtitle(`TRACK CAPTURED — ${tasks[0].step}/3`, 2.2);
  if (tasks[0].step >= 3) completeFieldTask('Three tracks recorded. The van trace is now exposed.');
  else updateMissionStep();
}

function completeFieldTask(message) {
  const task = tasks[traceCount];
  task.complete = true;
  task.progress = 0;
  tuningActive = false;
  ui.tuningPanel.classList.add('hidden');
  evidenceMeshes[traceCount].visible = true;
  hideInteraction();
  showSubtitle(message, 5);
  playTraceSound();
  updateTaskVisibility();
}

function hideInteraction() {
  interactionProgress = 0;
  ui.interaction.classList.add('hidden');
  ui.interactionFill.style.width = '0%';
}

function horizontalDistanceTo(position) {
  return Math.hypot(camera.position.x - position.x, camera.position.z - position.z);
}

function aimScore(position) {
  const forward = tempVec.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize();
  const direction = tempVec2.set(position.x - camera.position.x, position.y + 1 - camera.position.y, position.z - camera.position.z).normalize();
  return forward.dot(direction);
}

function isAimingAt(position, maxDistance, threshold) {
  return horizontalDistanceTo(position) < maxDistance && aimScore(position) > threshold;
}

function collectTrace() {
  if (traceCount >= 7) return;
  const obj = traceObjectives[traceCount];
  const evidence = evidenceMeshes[traceCount];
  evidence.userData.collected = true;
  evidence.visible = false;
  for (const node of taskObjects[traceCount]) node.visible = false;
  traceCount++;
  currentTarget = traceCount;
  interactionProgress = 0;
  battery = Math.min(100, battery + (traceCount % 2 === 0 ? 42 : 22));
  if (traceCount % 2 === 0) decoyCount = Math.min(3, decoyCount + 1);
  ui.decoyCount.textContent = decoyCount;
  ui.traceCount.textContent = traceCount;
  shake = .85;
  playTraceSound();
  flashScreen();
  showSubtitle(obj.lore, 6.5);
  escalateThreat();
  if (traceCount < 7) {
    setBeaconTarget(traceObjectives[traceCount]);
    showChapter(`TRACE ${String(traceCount + 1).padStart(2, '0')}`, traceObjectives[traceCount].chapter);
  } else {
    finalMode = true;
    setBeaconTarget(exitObjective);
    showChapter('ALL TRACES RECOVERED', 'RUN TO EXTRACTION');
    showSubtitle('RANGER GATE UNLOCKED — RUN. DO NOT LOOK BACK.', 8);
    for (const l of landmarkLights) if (l.exit) l.light.intensity = l.base;
  }
  updateObjectiveUI();
  updateTaskVisibility();
}

function updateObjectiveUI() {
  const target = traceCount < 7 ? traceObjectives[traceCount] : exitObjective;
  ui.objective.textContent = traceCount < 7 ? target.name : 'EXTRACTION — RANGER ROAD GATE';
  updateMissionStep();
}

function throwDecoy() {
  if (decoyCount <= 0 || activeDecoy || tuningActive) {
    showSubtitle(activeDecoy ? 'Only one echo decoy can transmit at a time.' : 'No echo decoys remaining.', 2.5);
    return;
  }
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const x = THREE.MathUtils.clamp(camera.position.x + forwardX * 9, -HALF_WORLD + 5, HALF_WORLD - 5);
  const z = THREE.MathUtils.clamp(camera.position.z + forwardZ * 9, -HALF_WORLD + 5, HALF_WORLD - 5);
  const group = new THREE.Group();
  const core = mesh(new THREE.OctahedronGeometry(.28, 0), materials.red, 0, .38, 0);
  const ring = mesh(new THREE.TorusGeometry(.55, .055, 5, 15), materials.yellow, 0, .4, 0);
  ring.rotation.x = Math.PI / 2;
  const light = new THREE.PointLight(0xff5e31, 4.5, 18, 2);
  light.position.y = .7;
  group.add(core, ring, light);
  group.position.set(x, groundHeight(x, z), z);
  scene.add(group);
  activeDecoy = { x, z, group, ring, time: 8, beep: 0 };
  decoyCount--;
  ui.decoyCount.textContent = decoyCount;
  noiseLevel = Math.max(noiseLevel, 72);
  forceHuntersToInvestigate(x, z, 8);
  showSubtitle('ECHO DECOY ACTIVE — move quietly while they investigate.', 3.5);
  playDecoyBeep();
}

function updateDecoy(dt) {
  if (!activeDecoy) return;
  activeDecoy.time -= dt;
  activeDecoy.beep -= dt;
  activeDecoy.ring.rotation.z += dt * 2.8;
  activeDecoy.group.scale.setScalar(1 + Math.sin(elapsed * 8) * .08);
  if (activeDecoy.beep <= 0) {
    playDecoyBeep();
    activeDecoy.beep = .72;
  }
  if (activeDecoy.time <= 0) {
    scene.remove(activeDecoy.group);
    activeDecoy = null;
  }
}

function forceHuntersToInvestigate(x, z, duration) {
  for (const enemy of enemies) {
    if (!enemy.active) continue;
    enemy.state = 'investigate';
    enemy.investigateTarget = { x, z, until: elapsed + duration };
    enemy.nextDecision = elapsed + duration;
  }
}

function updateCompass() {
  const target = getNavigationTarget();
  const dx = (target.targetX ?? target.x) - camera.position.x;
  const dz = (target.targetZ ?? target.z) - camera.position.z;
  const angle = Math.atan2(-dx, -dz);
  let relative = angle - yaw;
  while (relative > Math.PI) relative -= Math.PI * 2;
  while (relative < -Math.PI) relative += Math.PI * 2;
  ui.compassArrow.style.transform = `rotate(${relative}rad)`;
  ui.objectiveDistance.textContent = `${Math.round(Math.hypot(dx, dz))} M`;
}

function escalateThreat() {
  const activeCount = traceCount === 1 ? 1 : traceCount < 4 ? 2 : traceCount < 6 ? 3 : traceCount === 6 ? 4 : 5;
  directorClock = traceCount === 1 ? 18 : 8;
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    enemy.active = i < activeCount;
    enemy.group.visible = enemy.active;
    enemy.state = traceCount === 1 ? 'manifest' : i === 0 ? 'stalk' : 'flank';
    enemy.grace = elapsed + (traceCount === 1 ? 24 : 8);
    enemy.nextDecision = elapsed + 8 + rng() * 8;
    if (enemy.active) spawnEnemy(enemy, 29 + rng() * 17, true);
  }
}

function spawnEnemy(enemy, distance = 34, behind = true) {
  const baseAngle = yaw + (behind ? Math.PI : 0);
  const angle = baseAngle + (rng() - .5) * (behind ? 1.75 : Math.PI * 1.6);
  let x = camera.position.x + Math.sin(angle) * distance;
  let z = camera.position.z + Math.cos(angle) * distance;
  x = THREE.MathUtils.clamp(x, -HALF_WORLD + 10, HALF_WORLD - 10);
  z = THREE.MathUtils.clamp(z, -HALF_WORLD + 10, HALF_WORLD - 10);
  enemy.group.position.set(x, groundHeight(x, z) + enemy.footOffset, z);
  enemy.group.rotation.set(0, Math.atan2(camera.position.x - x, camera.position.z - z), 0);
  enemy.group.visible = true;
}

function updateEnemies(dt) {
  if (traceCount === 0) {
    sightingClock -= dt;
    if (!prologueStalkStarted && sightingClock <= 0) {
      showDistantSighting();
      prologueStalkStarted = true;
    }
    if (!enemies.some((enemy) => enemy.active)) {
      ui.fear.style.opacity = '0';
      return;
    }
  }
  directorClock -= dt;
  let nearest = Infinity;
  const forward = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  for (let index = 0; index < enemies.length; index++) {
    const enemy = enemies[index];
    if (!enemy.active) continue;
    const dx = camera.position.x - enemy.group.position.x;
    const dz = camera.position.z - enemy.group.position.z;
    const dist = Math.hypot(dx, dz);
    nearest = Math.min(nearest, dist);
    if (dist > 82) spawnEnemy(enemy, 34 + rng() * 25, true);
    if (traceCount === 0 && enemy.state === 'manifest' && elapsed >= enemy.manifestUntil) {
      enemy.state = 'stalk';
      showSubtitle('It did not leave. It is matching your pace.', 3.6);
    }
    if (traceCount > 0 && noiseLevel > 76 && dist < 58 && enemy.state !== 'investigate') {
      enemy.state = finalMode ? 'rage' : 'hunt';
      enemy.nextDecision = Math.max(enemy.nextDecision, elapsed + 5);
    }
    if (traceCount > 0 && elapsed > enemy.nextDecision && directorClock <= 0) {
      const aggressiveChance = .2 + traceCount * .09 + (finalMode ? .5 : 0);
      enemy.state = rng() < aggressiveChance ? (finalMode ? 'rage' : 'hunt') : index % 2 ? 'flank' : 'stalk';
      enemy.nextDecision = elapsed + (enemy.state === 'hunt' || enemy.state === 'rage' ? 8 + rng() * 8 : 13 + rng() * 11);
    }
    const toEnemy = tempVec.set(enemy.group.position.x - camera.position.x, enemy.group.position.y + 2.5 - camera.position.y, enemy.group.position.z - camera.position.z);
    const enemyDir = toEnemy.clone().normalize();
    const beamHit = flashlightOn && forward.dot(enemyDir) > .955 && dist < 58;
    let desiredDistance = 15;
    let speed = 1.55 + traceCount * .25;
    if (enemy.state === 'manifest') { desiredDistance = traceCount === 0 ? 14 : 22; speed = traceCount === 0 ? 0 : 1.1; }
    if (enemy.state === 'stalk') { desiredDistance = 13 + index * 2.2; speed = 1.9 + traceCount * .18; }
    if (enemy.state === 'flank') { desiredDistance = 10; speed = 2.7 + traceCount * .2; }
    if (enemy.state === 'hunt') { desiredDistance = 0; speed = 4.5 + traceCount * .36; }
    if (enemy.state === 'rage') { desiredDistance = 0; speed = 6.3 + index * .17; }
    if (enemy.state === 'investigate') { desiredDistance = 1.8; speed = 4.0 + traceCount * .2; }
    if (beamHit) {
      speed *= finalMode ? .42 : .24;
    }
    for (const material of enemy.bodyMaterials) {
      material.emissiveIntensity = material.userData.baseEmissiveIntensity * (beamHit ? 2.8 : 1);
    }
    if (dist > desiredDistance + .8 || enemy.state === 'hunt' || enemy.state === 'rage' || enemy.state === 'investigate') {
      let tx = camera.position.x;
      let tz = camera.position.z;
      if (enemy.state === 'investigate' && enemy.investigateTarget && enemy.investigateTarget.until > elapsed) {
        tx = enemy.investigateTarget.x;
        tz = enemy.investigateTarget.z;
      } else if (enemy.state === 'investigate') {
        enemy.state = 'stalk';
        enemy.investigateTarget = null;
      }
      if (enemy.state === 'flank') {
        tx += Math.cos(yaw) * enemy.side * 9;
        tz -= Math.sin(yaw) * enemy.side * 9;
      }
      const mx = tx - enemy.group.position.x;
      const mz = tz - enemy.group.position.z;
      const length = Math.hypot(mx, mz) || 1;
      enemy.group.position.x += mx / length * speed * dt;
      enemy.group.position.z += mz / length * speed * dt;
    } else if (enemy.state === 'stalk' || enemy.state === 'manifest') {
      const tangentX = -dz / (dist || 1) * enemy.side;
      const tangentZ = dx / (dist || 1) * enemy.side;
      enemy.group.position.x += tangentX * speed * .38 * dt;
      enemy.group.position.z += tangentZ * speed * .38 * dt;
    }
    enemy.group.position.y = groundHeight(enemy.group.position.x, enemy.group.position.z) + enemy.footOffset + Math.sin(elapsed * 3 + enemy.phase) * .018;
    enemy.group.rotation.x = 0;
    enemy.group.rotation.y = Math.atan2(camera.position.x - enemy.group.position.x, camera.position.z - enemy.group.position.z);
    enemy.group.rotation.z = 0;
    animateEnemy(enemy, dt, speed);
    if (dist < 1.7 && elapsed > enemy.grace && !invulnerable) killPlayer();
  }
  const fear = nearest < 28 ? THREE.MathUtils.clamp(1 - nearest / 28, 0, 1) : 0;
  fearLevel = fear;
  ui.fear.style.opacity = String(fear * .78);
  shake = Math.max(shake, fear * .12);
  if (nearest < 19) {
    heartbeatClock -= dt;
    if (heartbeatClock <= 0) {
      playHeartbeat(fear);
      heartbeatClock = THREE.MathUtils.lerp(1.15, .34, fear);
    }
  }
}

function animateEnemy(enemy, dt, speed) {
  enemy.phase += dt * (2.5 + speed * .7);
  const stride = Math.sin(enemy.phase);
  enemy.rig.arms[0].rotation.x = stride * .5;
  enemy.rig.arms[1].rotation.x = -stride * .5;
  enemy.rig.legs[0].rotation.x = -stride * .34;
  enemy.rig.legs[1].rotation.x = stride * .34;
  enemy.rig.torso.rotation.z = Math.sin(enemy.phase * .5) * .035;
  enemy.rig.head.position.y = enemy.rig.headBaseY + Math.sin(enemy.phase * 2) * .025;
  for (const accent of enemy.rig.accents) accent.rotation.y += dt * (.8 + speed * .08);
}

function showDistantSighting() {
  const enemy = enemies[0];
  enemy.active = true;
  enemy.state = 'manifest';
  enemy.grace = elapsed + 4.8;
  enemy.nextDecision = elapsed + 9999;
  enemy.manifestUntil = elapsed + 4.8;
  const distance = 13.5;
  const side = rng() > .5 ? 2.8 : -2.8;
  let x = camera.position.x - Math.sin(yaw) * distance + Math.cos(yaw) * side;
  let z = camera.position.z - Math.cos(yaw) * distance - Math.sin(yaw) * side;
  if (isBlockedAt(x, z)) {
    x = camera.position.x - Math.sin(yaw) * 10.5 - Math.cos(yaw) * side;
    z = camera.position.z - Math.cos(yaw) * 10.5 + Math.sin(yaw) * side;
  }
  enemy.group.position.set(x, groundHeight(x, z) + enemy.footOffset, z);
  enemy.group.rotation.set(0, Math.atan2(camera.position.x - x, camera.position.z - z), 0);
  enemy.group.visible = true;
  shake = Math.max(shake, .32);
  showSubtitle('MOTION DETECTED — SUBJECT DIRECTLY AHEAD.', 3.2);
  playBranchSnap();
  playSting(71, .55);
}

function killPlayer() {
  if (mode !== 'playing') return;
  mode = 'dead';
  ui.hud.classList.add('hidden');
  ui.reticle.classList.add('hidden');
  ui.deathTraces.textContent = `${traceCount} / 7`;
  ui.deathTime.textContent = formatTime(elapsed);
  ui.damage.style.opacity = '1';
  playSting(44, 1.4);
  if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => ui.death.classList.add('active'), 720);
}

function completeGame() {
  if (mode !== 'playing') return;
  mode = 'ending';
  ui.hud.classList.add('hidden');
  ui.reticle.classList.add('hidden');
  ui.finalTime.textContent = formatTime(elapsed);
  ui.ending.classList.add('active');
  if (document.pointerLockElement) document.exitPointerLock();
  playTraceSound();
}

function updateWorldAnimation(dt) {
  const beacon = scene.userData.objectiveBeacon;
  beacon.rotation.y += dt * .22;
  const activeTarget = getNavigationTarget();
  const targetX = activeTarget.targetX ?? activeTarget.x;
  const targetZ = activeTarget.targetZ ?? activeTarget.z;
  const beaconDistance = Math.hypot(camera.position.x - targetX, camera.position.z - targetZ);
  const beaconFade = THREE.MathUtils.smoothstep(beaconDistance, 7, 30);
  beacon.children[0].material.opacity = (.24 + Math.sin(elapsed * 2.4) * .08) * beaconFade;
  beacon.children[1].material.opacity = (.66 + Math.sin(elapsed * 3.1) * .18) * beaconFade;
  for (const e of evidenceMeshes) {
    if (!e.visible) continue;
    e.userData.core.rotation.y += dt * 1.6;
    e.userData.core.position.y = 1.6 + Math.sin(elapsed * 2.3 + e.userData.index) * .17;
    e.userData.ring.rotation.z += dt * .7;
    e.userData.aura.scale.setScalar(1 + Math.sin(elapsed * 2 + e.userData.index) * .07);
  }
  if (traceCount < 7) {
    for (const node of taskObjects[traceCount]) {
      if (!node.visible) continue;
      node.userData.ring.rotation.z += dt * .9;
      node.userData.light.intensity = 2.35 + Math.sin(elapsed * 4 + node.position.x) * .75;
    }
  }
  for (const l of landmarkLights) {
    if (l.exit && !finalMode) { l.light.intensity = 0; continue; }
    l.light.intensity = l.base * (.87 + Math.sin(elapsed * 7.3 + l.phase) * .08 + rng() * .04);
  }
  const particles = scene.getObjectByName('particles');
  if (particles) particles.rotation.y += dt * .002;
  if (rng() < dt * .012) {
    ui.lightning.style.opacity = '.7';
    setTimeout(() => { ui.lightning.style.opacity = '0'; }, 70);
  }
}

function showSubtitle(text, seconds = 4) {
  ui.subtitle.textContent = text;
  ui.subtitle.style.opacity = '1';
  subtitleTimer = seconds;
}

function showChapter(number, name) {
  ui.chapterNumber.textContent = number;
  ui.chapterName.textContent = name;
  ui.chapterCard.classList.add('show');
  chapterTimer = 3.2;
}

function updateTimers(dt) {
  if (subtitleTimer > 0) {
    subtitleTimer -= dt;
    if (subtitleTimer <= 0) ui.subtitle.style.opacity = '0';
  }
  if (chapterTimer > 0) {
    chapterTimer -= dt;
    if (chapterTimer <= 0) ui.chapterCard.classList.remove('show');
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) ui.toggleToast.classList.remove('show');
  }
}

function flashScreen() {
  ui.lightning.style.opacity = '.9';
  setTimeout(() => { ui.lightning.style.opacity = '0'; }, 95);
}

function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const frameDt = Math.min(Math.max((now - lastFrameTime) / 1000, 0), .25);
  const rawDt = Math.min(frameDt, .05);
  lastFrameTime = now;
  if (mode === 'title' || mode === 'briefing') {
    camera.position.y = groundHeight(camera.position.x, camera.position.z) + EYE_HEIGHT + Math.sin(performance.now() * .0006) * .03;
    camera.rotation.set(-.03, yaw + Math.sin(performance.now() * .00008) * .06, 0);
  }
  if (mode === 'playing') {
    elapsed += rawDt;
    updatePlayer(rawDt);
    updateFlashlight(rawDt);
    updateInteraction(rawDt);
    updateDecoy(rawDt);
    updateEnemies(rawDt);
    updateHorrorMusic(rawDt);
    updateCompass();
    updateTimers(rawDt);
    interactPressed = false;
    jumpPressed = false;
    ui.timer.textContent = formatTime(elapsed);
  }
  updateWorldAnimation(rawDt);
  renderer.render(scene, camera);
  updateAdaptiveQuality(frameDt);
}

function updateAdaptiveQuality(frameDt) {
  perfElapsed += frameDt;
  perfFrames++;
  if (perfElapsed < 2.4) return;
  if (qualityMode !== 'auto') { perfElapsed = 0; perfFrames = 0; return; }
  const fps = perfFrames / perfElapsed;
  let nextScale = renderScale;
  if (fps < 57 && renderScale > .58) nextScale = Math.max(.58, renderScale - .1);
  else if (fps > 64 && renderScale < 1) nextScale = Math.min(1, renderScale + .06);
  if (Math.abs(nextScale - renderScale) > .001) {
    renderScale = nextScale;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35) * renderScale);
    renderer.setSize(innerWidth, innerHeight, false);
  }
  perfElapsed = 0;
  perfFrames = 0;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35) * renderScale);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.domElement.style.width = '100vw';
  renderer.domElement.style.height = '100dvh';
}

function ensureAudio() {
  if (audio) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    startOfficialAmbience();
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  document.documentElement.dataset.audioState = ctx.state;
  ctx.addEventListener('statechange', () => { document.documentElement.dataset.audioState = ctx.state; });
  const master = ctx.createGain();
  master.gain.value = .82;
  master.connect(ctx.destination);
  const musicBus = ctx.createGain();
  const sfxBus = ctx.createGain();
  musicBus.gain.value = Number(ui.musicVolume.value) / 100;
  sfxBus.gain.value = Number(ui.sfxVolume.value) / 100;
  musicBus.connect(master);
  sfxBus.connect(master);
  const officialAmbience = new Audio('assets/audio/bitfoots-forest-night.mp3');
  officialAmbience.loop = true;
  officialAmbience.preload = 'auto';
  officialAmbience.volume = 1;
  const officialSource = ctx.createMediaElementSource(officialAmbience);
  const ambienceGain = ctx.createGain();
  ambienceGain.gain.value = .62;
  officialSource.connect(ambienceGain).connect(musicBus);
  officialAmbience.addEventListener('playing', () => { document.documentElement.dataset.musicState = 'playing'; });
  officialAmbience.addEventListener('pause', () => { document.documentElement.dataset.musicState = 'paused'; });
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (0.35 + Math.sin(i * .00031) * .2);
  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const windGain = ctx.createGain();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  filter.type = 'lowpass';
  filter.frequency.value = 730;
  windGain.gain.value = .04;
  noise.connect(filter).connect(windGain).connect(musicBus);
  noise.start();
  const scoreFilter = ctx.createBiquadFilter();
  const scoreGain = ctx.createGain();
  scoreFilter.type = 'lowpass';
  scoreFilter.frequency.value = 240;
  scoreFilter.Q.value = 4.2;
  scoreGain.gain.value = .74;
  scoreFilter.connect(scoreGain).connect(musicBus);
  const droneNotes = [32.7, 43.65, 51.91, 65.41];
  const droneTypes = ['sine', 'sawtooth', 'triangle', 'sine'];
  const droneVolumes = [.075, .052, .038, .025];
  const drones = droneNotes.map((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = droneTypes[index];
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index * 3 - 4;
    gain.gain.value = droneVolumes[index];
    oscillator.connect(gain).connect(scoreFilter);
    oscillator.start();
    return { oscillator, gain };
  });
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = .075;
  lfoGain.gain.value = .18;
  lfo.connect(lfoGain).connect(scoreGain.gain);
  lfo.start();
  audio = { ctx, master, musicBus, sfxBus, officialAmbience, officialSource, ambienceGain, windGain, scoreFilter, scoreGain, drones, lfo };
  startOfficialAmbience();
}

function startOfficialAmbience() {
  if (!audio?.officialAmbience || !audio.officialAmbience.paused) return;
  const attempt = audio.officialAmbience.play();
  if (attempt && typeof attempt.catch === 'function') {
    attempt.catch(() => { document.documentElement.dataset.musicState = 'blocked'; });
  }
}

function tone(freq, duration, volume, type = 'sine', glide = null, delay = 0, bus = 'sfx') {
  if (!audio) return;
  const t = audio.ctx.currentTime + delay;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + duration);
  gain.gain.setValueAtTime(.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + .018);
  gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
  osc.connect(gain).connect(bus === 'music' ? audio.musicBus : audio.sfxBus);
  osc.start(t);
  osc.stop(t + duration + .02);
}

function updateHorrorMusic(dt) {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  const tension = traceCount / 7 + fearLevel * .9 + (finalMode ? .45 : 0);
  audio.scoreFilter.frequency.setTargetAtTime(220 + tension * 720, now, .7);
  audio.scoreFilter.Q.setTargetAtTime(3.5 + tension * 5, now, .8);
  audio.scoreGain.gain.setTargetAtTime(.74 + tension * .28, now, .8);
  audio.ambienceGain.gain.setTargetAtTime(.62 - Math.min(.2, fearLevel * .18), now, .8);
  musicClock -= dt;
  if (musicClock <= 0) {
    const roots = [43.65, 46.25, 41.2, 36.71];
    const root = roots[traceCount % roots.length];
    const fast = fearLevel > .45 || finalMode;
    tone(root, fast ? 1.4 : 3.8, .09 + tension * .026, 'sawtooth', root * .94, 0, 'music');
    tone(root * 1.414, fast ? 1.1 : 3.1, .052 + tension * .02, 'triangle', root * 1.37, .08, 'music');
    if (traceCount >= 3) tone(root * 2.03, .34, .045 + fearLevel * .04, 'square', root * 1.82, .24, 'music');
    musicClock = fast ? 1.5 + rng() * 1.8 : 5.5 + rng() * 4.5 - traceCount * .35;
  }
}

function playClick(on) { tone(on ? 640 : 360, .055, .16, 'square', on ? 920 : 210); tone(90, .08, .11, 'sine', 58, .02); }
function playTick() { tone(920, .025, .025, 'square'); }
function playFootstep(heavy = false) { tone(heavy ? 55 : 72, .09, heavy ? .12 : .05, 'triangle', 40); }
function playSting(freq, duration) { tone(freq, duration, .18, 'sawtooth', Math.max(24, freq * .45)); tone(freq * 1.51, duration * .7, .08, 'square', freq * .72, .04); }
function playTraceSound() { tone(130, .8, .16, 'sawtooth', 620); tone(260, .7, .11, 'sine', 1100, .12); }
function playHeartbeat(fear) { tone(54, .11, .1 + fear * .18, 'sine', 39); tone(48, .12, .07 + fear * .13, 'sine', 34, .17); }
function playBranchSnap() { tone(880, .045, .07, 'square', 120); tone(170, .16, .05, 'triangle', 55, .04); }
function playMechanicalClunk() { tone(118, .18, .13, 'square', 52); tone(780, .035, .05, 'square', 210, .08); }
function playDecoyBeep() { tone(1180, .055, .11, 'square', 830); tone(590, .09, .055, 'sine', 430, .06); }
function playCameraShutter(success) { tone(success ? 920 : 520, .035, .12, 'square', 130); tone(success ? 120 : 80, .12, .1, 'triangle', 45, .03); }

async function copyReport() {
  const text = `BITFOOTS: NO TRACE — 7/7 shielded traces recovered in ${formatTime(elapsed)}. STATUS: OBSERVED. Community game by @besiktaspokemon. https://bitfoots.xyz/`;
  try {
    await navigator.clipboard.writeText(text);
    ui.copyStatus.textContent = 'FIELD REPORT COPIED';
  } catch {
    ui.copyStatus.textContent = text;
  }
}

const debugEnabled = new URLSearchParams(location.search).has('debug');
if (debugEnabled) {
  window.__BITFOOTS_DEBUG__ = {
    forceStart() {
      ui.title.classList.remove('active');
      ui.briefing.classList.remove('active');
      ui.pause.classList.remove('active');
      ui.hud.classList.remove('hidden');
      ui.reticle.classList.remove('hidden');
      ui.controlStrip.classList.remove('hidden');
      mode = 'playing';
      ensureAudio();
      updateTaskVisibility();
      return this.state();
    },
    teleportTo(index = traceCount) {
      const target = index < 7 ? traceObjectives[index] : exitObjective;
      const tx = target.targetX ?? target.x;
      const tz = target.targetZ ?? target.z;
      Object.keys(keys).forEach((key) => { keys[key] = false; });
      placePlayer(tx, tz + 3.2, 0);
      return this.state();
    },
    collect() { collectTrace(); return this.state(); },
    completeTask() { if (traceCount < 7 && !tasks[traceCount].complete) completeFieldTask('FIELD PROCEDURE COMPLETE.'); return this.state(); },
    teleportTask(nodeIndex = 0) {
      const node = taskObjects[traceCount]?.[nodeIndex];
      if (!node) return this.state();
      Object.keys(keys).forEach((key) => { keys[key] = false; });
      placePlayer(node.position.x, node.position.z + 2.5, 0);
      return this.state();
    },
    decoy() { throwDecoy(); return this.state(); },
    toggleLight() { toggleFlashlight(); return this.state(); },
    god(value = true) { invulnerable = value; return this.state(); },
    summon(index = 0, distance = 9, side = 0) {
      const enemy = enemies[Math.max(0, Math.min(enemies.length - 1, index))];
      enemy.active = true;
      enemy.state = 'manifest';
      enemy.grace = elapsed + 999;
      enemy.group.visible = true;
      enemy.group.position.set(
        camera.position.x - Math.sin(yaw) * distance + Math.cos(yaw) * side,
        0,
        camera.position.z - Math.cos(yaw) * distance - Math.sin(yaw) * side
      );
      enemy.group.position.y = groundHeight(enemy.group.position.x, enemy.group.position.z);
      enemy.group.position.y += enemy.footOffset;
      enemy.group.rotation.set(0, Math.atan2(camera.position.x - enemy.group.position.x, camera.position.z - enemy.group.position.z), 0);
      return this.state();
    },
    state() {
      return { mode, traceCount, flashlightOn, battery: Math.round(battery), stamina: Math.round(stamina), noise: Math.round(noiseLevel), decoys: decoyCount, audio: audio ? audio.ctx.state : 'off', musicMuted, task: traceCount < 7 ? { type: tasks[traceCount].type, step: tasks[traceCount].step, complete: tasks[traceCount].complete } : null, objective: ui.objective.textContent, trees: treePositions.length, colliders: colliders.length, renderScale: Number(renderScale.toFixed(2)), player: { x: Math.round(camera.position.x), z: Math.round(camera.position.z) } };
    }
  };
  const debugParams = new URLSearchParams(location.search);
  if (debugParams.has('autostart')) {
    const api = window.__BITFOOTS_DEBUG__;
    api.forceStart();
    invulnerable = true;
    const stage = THREE.MathUtils.clamp(Number(debugParams.get('stage') || 0), 0, 7);
    while (traceCount < stage) {
      tasks[traceCount].complete = true;
      collectTrace();
    }
    if (traceCount < 7) api.teleportTask(Number(debugParams.get('node') || 0));
    ui.chapterCard.classList.remove('show');
    chapterTimer = 0;
    if (debugParams.has('summon')) api.summon(Number(debugParams.get('summonIndex') || 0), Number(debugParams.get('summon') || 9), Number(debugParams.get('summonSide') || 0));
  }
}
