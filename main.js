import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const DOM = {
  game: document.getElementById('game'),
  lives: document.getElementById('lives'),
  levelLabel: document.getElementById('levelLabel'),
  waveLabel: document.getElementById('waveLabel'),
  comboLabel: document.getElementById('comboLabel'),
  tutorial: document.getElementById('tutorial'),
  tutorialText: document.getElementById('tutorialText'),
  floatingMessage: document.getElementById('floatingMessage'),
  resultModal: document.getElementById('resultModal'),
  resultIcon: document.getElementById('resultIcon'),
  resultTitle: document.getElementById('resultTitle'),
  resultSubtitle: document.getElementById('resultSubtitle'),
  accuracyValue: document.getElementById('accuracyValue'),
  bestComboValue: document.getElementById('bestComboValue'),
  lifeValue: document.getElementById('lifeValue'),
  primaryResultButton: document.getElementById('primaryResultButton'),
  retryButton: document.getElementById('retryButton'),
  hammerButton: document.getElementById('hammerButton'),
  freezeButton: document.getElementById('freezeButton'),
  bombButton: document.getElementById('bombButton'),
  hammerCount: document.getElementById('hammerCount'),
  freezeCount: document.getElementById('freezeCount'),
  bombCount: document.getElementById('bombCount'),
};

const DIRS = {
  up: { dr: -1, dc: 0, x: 0, y: 1, angle: 0 },
  right: { dr: 0, dc: 1, x: 1, y: 0, angle: -Math.PI / 2 },
  down: { dr: 1, dc: 0, x: 0, y: -1, angle: Math.PI },
  left: { dr: 0, dc: -1, x: -1, y: 0, angle: Math.PI / 2 },
};
const DIR_NAMES = Object.keys(DIRS);
const WORLD = { left: -8, right: 8, bottom: -13.5, top: 13.5 };
const BOARD = { rows: 6, cols: 5, cell: 1.48, centerY: 0.6 };
const ROAD = { x: 6.05, topY: 7.15, bottomY: -7.15, leftX: -6.05, width: 1.2 };
const PROJECTILE_SPEED = 16;
const PATH_PROJECTILE_SPEED = 7.2;
const BASE_DAMAGE = 10;
const MAX_LEVEL = 10;

let scene;
let camera;
let renderer;
let raycaster;
let pointer;
let clock;
let boardGroup;
let roadGroup;
let enemyGroup;
let projectileGroup;
let fxGroup;
let sunflower;
let carrots = [];
let carrotByCell = new Map();
let projectiles = [];
let enemies = [];
let effects = [];
let level = 1;
let lives = 3;
let totalEnemies = 0;
let spawnedEnemies = 0;
let defeatedEnemies = 0;
let spawnTimer = 0;
let spawnInterval = 1.1;
let gameState = 'playing';
let toolMode = null;
let toolsLeft = { hammer: 1, freeze: 1, bomb: 1 };
let freezeTimer = 0;
let shots = 0;
let hits = 0;
let successfulShots = 0;
let combo = 0;
let bestCombo = 0;
let comboTimer = 0;
let feverTimer = 0;
let lastHintAt = 0;
let tutorialDismissTimer = 0;
let audioContext = null;

const pathPoints = [
  new THREE.Vector2(-2.8, ROAD.topY),
  new THREE.Vector2(ROAD.x, ROAD.topY),
  new THREE.Vector2(ROAD.x, ROAD.bottomY),
  new THREE.Vector2(ROAD.leftX, ROAD.bottomY),
  new THREE.Vector2(ROAD.leftX, ROAD.topY - 1.4),
];
const pathData = buildPathData(pathPoints);

init();
loadLevel(1);
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x86d85a);

  camera = new THREE.OrthographicCamera(WORLD.left, WORLD.right, WORLD.top, WORLD.bottom, 0.1, 100);
  camera.position.set(0, 0, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  DOM.game.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff8df, 0x3d7134, 2.8));
  const light = new THREE.DirectionalLight(0xfff8e8, 2.45);
  light.position.set(-6, 10, 12);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  scene.add(light);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  clock = new THREE.Clock();

  createGround();
  createRoad();
  createSunflower();

  boardGroup = new THREE.Group();
  enemyGroup = new THREE.Group();
  projectileGroup = new THREE.Group();
  fxGroup = new THREE.Group();
  scene.add(boardGroup, enemyGroup, projectileGroup, fxGroup);

  renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('resize', resize);

  DOM.primaryResultButton.addEventListener('click', () => {
    if (gameState !== 'won') return;
    const next = level >= MAX_LEVEL ? 1 : level + 1;
    loadLevel(next);
  });
  DOM.retryButton.addEventListener('click', () => loadLevel(level));

  DOM.hammerButton.addEventListener('click', () => toggleTool('hammer'));
  DOM.freezeButton.addEventListener('click', useFreeze);
  DOM.bombButton.addEventListener('click', useBomb);

  resize();
}

function createGround() {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(17, 28),
    new THREE.MeshStandardMaterial({ color: 0x79c94d, roughness: 0.94 })
  );
  grass.position.z = -1.5;
  grass.receiveShadow = true;
  scene.add(grass);

  const random = mulberry32(20260921);
  const patches = new THREE.Group();
  for (let i = 0; i < 120; i++) {
    const color = i % 4 === 0 ? 0xa3de68 : i % 3 === 0 ? 0x67b844 : 0x86d557;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(0.05 + random() * 0.08, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28 + random() * 0.18 })
    );
    patch.position.set((random() - 0.5) * 15.6, (random() - 0.5) * 25.7, -1.34);
    patch.scale.set(0.8 + random() * 1.7, 0.55 + random() * 1.2, 1);
    patches.add(patch);
  }
  scene.add(patches);

  const decor = new THREE.Group();
  const bushMatA = new THREE.MeshStandardMaterial({ color: 0x4da43d, roughness: 0.9 });
  const bushMatB = new THREE.MeshStandardMaterial({ color: 0x6bbb45, roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb8b39b, roughness: 0.92 });
  const bushSpots = [
    [-4.45, 2.7, 0.82], [4.35, 2.3, 0.7], [-4.2, -3.9, 0.74],
    [4.25, -4.3, 0.82], [-5.25, 9.6, 0.68], [5.3, -10.3, 0.72],
  ];

  for (const [x, y, scale] of bushSpots) {
    const bush = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), i % 2 ? bushMatA : bushMatB);
      const a = (i / 5) * Math.PI * 2;
      puff.position.set(Math.cos(a) * 0.32, Math.sin(a) * 0.16, 0);
      puff.scale.set(1, 0.72, 0.5);
      bush.add(puff);
    }
    bush.position.set(x, y, -0.92);
    bush.scale.setScalar(scale);
    decor.add(bush);
  }

  const flowerSpots = [
    [-4.9, 5.3], [4.75, 4.4], [-4.65, 0.1], [4.75, -0.6],
    [-4.8, -5.3], [4.7, -5.6], [-5.3, 11.1], [5.1, -11.3]
  ];
  for (let i = 0; i < flowerSpots.length; i++) {
    const [x, y] = flowerSpots[i];
    decor.add(makeGardenFlower(x, y, i % 3 === 0 ? 0xffd75a : 0xfff6db));
  }

  const stoneSpots = [[4.4,5.3],[-4.5,-2.1],[4.65,-6.0],[-5.0,8.8],[5.2,-8.7]];
  for (const [x, y] of stoneSpots) {
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), stoneMat);
    stone.scale.set(1.15, 0.7, 0.45);
    stone.position.set(x, y, -1.0);
    stone.rotation.z = random() * Math.PI;
    decor.add(stone);
  }

  scene.add(decor);
}

function makeGardenFlower(x, y, petalColor) {
  const flower = new THREE.Group();
  const petalMat = new THREE.MeshBasicMaterial({ color: petalColor });
  const centerMat = new THREE.MeshBasicMaterial({ color: 0xf6b634 });
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), petalMat);
    const a = i / 5 * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0);
    petal.scale.set(0.9, 1.25, 1);
    flower.add(petal);
  }
  flower.add(new THREE.Mesh(new THREE.CircleGeometry(0.065, 12), centerMat));
  flower.position.set(x, y, -0.85);
  return flower;
}

function createRoad() {
  roadGroup = new THREE.Group();
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0xe1a663, roughness: 0.88 });
  const roadLight = new THREE.MeshStandardMaterial({ color: 0xefbd79, roughness: 0.9 });
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x936039, roughness: 0.94 });
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0xc88f54, roughness: 0.95 });
  const random = mulberry32(7031);

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const a = pathPoints[i];
    const b = pathPoints[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const horizontal = Math.abs(dx) > Math.abs(dy);

    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? len + 0.24 : ROAD.width + 0.28, horizontal ? ROAD.width + 0.28 : len + 0.24, 0.12),
      edgeMaterial
    );
    edge.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, -0.75);
    edge.receiveShadow = true;
    roadGroup.add(edge);

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? len : ROAD.width, horizontal ? ROAD.width : len, 0.18),
      i === 0 ? roadLight : roadMaterial
    );
    road.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, -0.61);
    road.receiveShadow = true;
    roadGroup.add(road);

    const pebbleCount = Math.max(2, Math.floor(len / 2.2));
    for (let p = 0; p < pebbleCount; p++) {
      const t = (p + 0.45 + random() * 0.15) / pebbleCount;
      const pebble = new THREE.Mesh(new THREE.SphereGeometry(0.09 + random() * 0.04, 10, 7), pebbleMat);
      pebble.scale.set(1.25, 0.7, 0.38);
      const jitter = (random() - 0.5) * ROAD.width * 0.46;
      pebble.position.set(
        THREE.MathUtils.lerp(a.x, b.x, t) + (horizontal ? 0 : jitter),
        THREE.MathUtils.lerp(a.y, b.y, t) + (horizontal ? jitter : 0),
        -0.45
      );
      roadGroup.add(pebble);
    }
  }

  scene.add(roadGroup);
}

function createSunflower() {
  sunflower = new THREE.Group();
  sunflower.userData.kind = 'cat-mascot';

  const orange = new THREE.MeshStandardMaterial({ color: 0xf59a43, roughness: 0.48, metalness: 0.02 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff0d5, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xfffbef, roughness: 0.55 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xf58a8d, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x39261f, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd94735, roughness: 0.48 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf6bf39, roughness: 0.32, metalness: 0.15 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8f5d35, roughness: 0.86 });

  const perch = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.28, 0.34), wood);
  perch.position.set(0, -1.05, -0.04);
  perch.castShadow = true;
  sunflower.add(perch);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.58, 24, 18), orange);
  body.scale.set(0.9, 1.08, 0.72);
  body.position.set(0, -0.5, 0.22);
  body.castShadow = true;
  sunflower.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), cream);
  belly.scale.set(0.95, 1.12, 0.45);
  belly.position.set(0, -0.53, 0.65);
  sunflower.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.64, 26, 20), orange);
  head.scale.set(1.02, 0.93, 0.72);
  head.position.set(0, 0.26, 0.35);
  head.castShadow = true;
  sunflower.add(head);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.5, 3), orange);
    ear.position.set(side * 0.4, 0.75, 0.28);
    ear.rotation.z = side * -0.13;
    ear.castShadow = true;
    sunflower.add(ear);

    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 3), pink);
    innerEar.position.set(side * 0.4, 0.77, 0.52);
    innerEar.rotation.z = side * -0.13;
    sunflower.add(innerEar);
  }

  for (const side of [-1, 1]) {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), white);
    eyeWhite.scale.set(0.9, 1.16, 0.44);
    eyeWhite.position.set(side * 0.23, 0.34, 0.9);
    sunflower.add(eyeWhite);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), dark);
    pupil.scale.set(0.9, 1.12, 0.5);
    pupil.position.set(side * 0.23, 0.33, 1.005);
    sunflower.add(pupil);

    const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), white);
    sparkle.position.set(side * 0.205, 0.37, 1.065);
    sunflower.add(sparkle);

    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14), new THREE.MeshBasicMaterial({ color: 0xff9e8c, transparent: true, opacity: 0.8 }));
    cheek.position.set(side * 0.38, 0.12, 1.045);
    sunflower.add(cheek);
  }

  const muzzleL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), white);
  muzzleL.scale.set(1.1, 0.82, 0.45);
  muzzleL.position.set(-0.1, 0.12, 0.96);
  sunflower.add(muzzleL);
  const muzzleR = muzzleL.clone();
  muzzleR.position.x = 0.1;
  sunflower.add(muzzleR);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), pink);
  nose.scale.set(1.15, 0.75, 0.65);
  nose.position.set(0, 0.17, 1.08);
  sunflower.add(nose);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.075, 10, 26), red);
  collar.position.set(0, -0.2, 0.54);
  collar.scale.set(1, 0.38, 1);
  sunflower.add(collar);

  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), gold);
  bell.position.set(0, -0.31, 0.93);
  sunflower.add(bell);

  for (const side of [-1, 1]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), white);
    paw.scale.set(1.2, 0.72, 0.7);
    paw.position.set(side * 0.28, -0.88, 0.58);
    sunflower.add(paw);
  }

  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.72, 5, 12), orange);
  tail.position.set(-0.63, -0.56, 0.18);
  tail.rotation.z = -0.95;
  tail.castShadow = true;
  sunflower.add(tail);

  sunflower.position.set(ROAD.leftX, ROAD.topY - 0.35, 0.25);
  sunflower.scale.setScalar(0.95);
  scene.add(sunflower);
}

function loadLevel(nextLevel) {
  level = nextLevel;
  clearDynamicScene();
  gameState = 'playing';
  lives = 3;
  shots = 0;
  hits = 0;
  successfulShots = 0;
  combo = 0;
  bestCombo = 0;
  comboTimer = 0;
  feverTimer = 0;
  freezeTimer = 0;
  toolMode = null;
  toolsLeft = { hammer: 1, freeze: 1, bomb: 1 };
  spawnedEnemies = 0;
  defeatedEnemies = 0;
  totalEnemies = level === 2 ? 18 : 6 + Math.ceil(level * 0.7);
  spawnInterval = level === 2 ? 0.58 : Math.max(0.68, 1.18 - level * 0.035);
  spawnTimer = level === 2 ? 0.08 : 0.5;
  lastHintAt = performance.now();

  const count = Math.min(14 + level * 2, BOARD.rows * BOARD.cols - 3);
  const layout = level === 2
    ? generateLevel2HardLayout()
    : generateSolvableLayout(BOARD.rows, BOARD.cols, count, 5000 + level * 7919);
  carrots = layout.map((item, index) => createCarrot(item, index));
  carrotByCell = new Map(carrots.map(c => [cellKey(c.row, c.col), c]));

  DOM.levelLabel.textContent = `第 ${level} 关`;
  DOM.resultModal.classList.add('hidden');
  DOM.tutorial.classList.remove('hidden');
  DOM.tutorialText.textContent = level === 1
    ? '尖端就是方向。辣椒飞到道路后，会逆着怪物前进方向一路穿刺！'
    : level === 2
      ? '第 2 关：只有少数辣椒能先动，拆开锁链的同时顶住更强怪潮！'
      : '怪物有血量：同一根辣椒会沿道路逆行，依次穿刺途中每个敌人。';
  tutorialDismissTimer = level === 1 ? 7 : level === 2 ? 3 : 3.5;
  updateHUD();
  updateToolButtons();
}

function clearDynamicScene() {
  for (const group of [boardGroup, enemyGroup, projectileGroup, fxGroup]) {
    if (!group) continue;
    while (group.children.length) {
      const child = group.children[0];
      disposeObject(child);
      group.remove(child);
    }
  }
  carrots = [];
  projectiles = [];
  enemies = [];
  effects = [];
  carrotByCell.clear();
}

function createCarrot(data, index) {
  const group = new THREE.Group();
  group.userData.kind = 'carrot';
  group.userData.index = index;

  const isPierce = data.type === 'pierce';
  const bodyMat = new THREE.MeshStandardMaterial({
    color: isPierce ? 0xff6a2e : 0xf03527,
    roughness: 0.28,
    metalness: 0.03,
    emissive: isPierce ? 0x4a1200 : 0x2e0502,
    emissiveIntensity: 0.12,
  });
  const darkRedMat = new THREE.MeshStandardMaterial({
    color: isPierce ? 0xe14a1e : 0xc91d19,
    roughness: 0.38,
  });
  const greenMat = new THREE.MeshStandardMaterial({
    color: isPierce ? 0x45b950 : 0x259d42,
    roughness: 0.45,
  });

  const profile = [
    new THREE.Vector2(0.10, -0.68),
    new THREE.Vector2(0.27, -0.62),
    new THREE.Vector2(0.40, -0.42),
    new THREE.Vector2(0.45, -0.10),
    new THREE.Vector2(0.39, 0.20),
    new THREE.Vector2(0.28, 0.46),
    new THREE.Vector2(0.16, 0.66),
    new THREE.Vector2(0.055, 0.82),
    new THREE.Vector2(0.0, 0.89),
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), bodyMat);
  body.scale.x = 0.9;
  body.rotation.z = -0.055;
  body.position.x = 0.035;
  body.castShadow = true;
  group.add(body);

  const base = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 14), darkRedMat);
  base.scale.set(1.0, 0.58, 0.82);
  base.position.set(-0.015, -0.57, -0.015);
  base.castShadow = true;
  group.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.14, 0.32, 14), greenMat);
  stem.position.set(-0.02, -0.83, 0.01);
  stem.rotation.z = 0.12;
  stem.castShadow = true;
  group.add(stem);

  for (const side of [-1, 0, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), greenMat);
    leaf.scale.set(0.65, 1.15, 0.42);
    leaf.position.set(side * 0.16, -0.7 - Math.abs(side) * 0.035, 0.02);
    leaf.rotation.z = side * 0.72;
    leaf.castShadow = true;
    group.add(leaf);
  }

  const highlightMat = new THREE.MeshBasicMaterial({
    color: 0xffd3c8,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), highlightMat);
  highlight.scale.set(0.42, 1.75, 0.18);
  highlight.position.set(-0.16, 0.02, 0.39);
  highlight.rotation.z = -0.15;
  group.add(highlight);

  if (isPierce) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.31, 0.05, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xffe45f, emissive: 0x8a5b00, emissiveIntensity: 0.22, roughness: 0.3 })
    );
    ring.position.y = 0.16;
    ring.scale.set(1, 0.86, 1);
    group.add(ring);
  }

  group.rotation.z = DIRS[data.dir].angle;
  const p = cellToWorld(data.row, data.col);
  group.position.set(p.x, p.y, 0.2);
  group.scale.setScalar(1.02);
  boardGroup.add(group);

  return {
    row: data.row,
    col: data.col,
    dir: data.dir,
    type: data.type,
    group,
    active: true,
    bumpTime: 0,
    baseX: p.x,
    baseY: p.y,
  };
}

function createEnemy(type = 'normal') {
  const config = enemyConfig(type);
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(config.radius, 18, 14),
    new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.75 })
  );
  body.scale.y = 0.86;
  body.castShadow = true;
  group.add(body);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x202020 });
  for (const x of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eyeMat);
    eye.position.set(x, 0.11, config.radius * 0.92);
    group.add(eye);
  }

  if (type === 'tank') {
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xf0dfbb });
    for (const x of [-0.27, 0.27]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 10), hornMat);
      horn.position.set(x, 0.45, 0);
      horn.rotation.z = x < 0 ? 0.3 : -0.3;
      group.add(horn);
    }
  }

  const level2HpBoost = level === 2 ? 1.65 : 1;
  const maxHp = Math.round(config.hp * (1 + (level - 1) * 0.045) * level2HpBoost);
  const label = makeNumberLabel(maxHp);
  label.position.set(0, 0.82, 0.5);
  group.add(label);

  const start = pathPoints[0];
  group.position.set(start.x, start.y, 0.1);
  enemyGroup.add(group);

  enemies.push({
    group,
    body,
    label,
    hp: maxHp,
    maxHp,
    speed: config.speed * (1 + (level - 1) * 0.018) * (level === 2 ? 1.22 : 1),
    distance: 0,
    active: true,
    radius: config.radius,
    type,
    hitFlash: 0,
  });
}

function enemyConfig(type) {
  if (type === 'fast') return { hp: 24, speed: 2.05, radius: 0.45, color: 0xb56fff };
  if (type === 'tank') return { hp: 55, speed: 0.95, radius: 0.56, color: 0x67a4d8 };
  return { hp: 32, speed: 1.35, radius: 0.48, color: 0xe8675b };
}

function chooseEnemyType(index) {
  if (level === 2) {
    if (index === 4 || index === 8 || index === 12 || index === 16) return 'tank';
    if (index === 1 || index === 3 || index === 6 || index === 10 || index === 13 || index === 15) return 'fast';
    return 'normal';
  }

  if (level >= 4 && index % 6 === 5) return 'tank';
  if (level >= 3 && index % 5 === 3) return 'fast';
  return 'normal';
}

function makeNumberLabel(value) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  );
  sprite.scale.set(1.25, 0.62, 1);
  sprite.userData.canvas = canvas;
  sprite.userData.texture = texture;
  updateNumberLabel(sprite, value);
  return sprite;
}

function updateNumberLabel(sprite, value) {
  const canvas = sprite.userData.canvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '900 37px Arial Rounded MT Bold, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(69, 48, 28, .88)';
  ctx.strokeText(String(Math.max(0, Math.ceil(value))), 64, 31);
  ctx.fillStyle = '#fff9c9';
  ctx.fillText(String(Math.max(0, Math.ceil(value))), 64, 31);
  sprite.userData.texture.needsUpdate = true;
}

function launchCarrot(carrot, byHammer = false) {
  if (!carrot.active || gameState !== 'playing') return;

  if (!byHammer && isBlocked(carrot)) {
    carrot.bumpTime = 0.24;
    playTone(120, 0.055, 'square', 0.04);
    showMessage('被挡住了！');
    return;
  }

  carrot.active = false;
  carrotByCell.delete(cellKey(carrot.row, carrot.col));
  const dir = DIRS[carrot.dir];

  if (byHammer) {
    createBurst(carrot.group.position.x, carrot.group.position.y, 0xf7df72, 9);
    boardGroup.remove(carrot.group);
    disposeObject(carrot.group);
    return;
  }

  boardGroup.remove(carrot.group);
  projectileGroup.add(carrot.group);
  shots++;
  projectiles.push({
    group: carrot.group,
    dir,
    type: carrot.type,
    active: true,
    mode: 'flight',
    pathDistance: null,
    alreadyHit: new Set(),
    hasHit: false,
  });
  playTone(feverTimer > 0 ? 660 : 520, 0.045, 'triangle', 0.035);
  tutorialDismissTimer = Math.min(tutorialDismissTimer, 0.7);
}

function isBlocked(carrot) {
  const d = DIRS[carrot.dir];
  let r = carrot.row + d.dr;
  let c = carrot.col + d.dc;
  while (r >= 0 && r < BOARD.rows && c >= 0 && c < BOARD.cols) {
    const other = carrotByCell.get(cellKey(r, c));
    if (other?.active) return true;
    r += d.dr;
    c += d.dc;
  }
  return false;
}

function onPointerDown(event) {
  if (gameState !== 'playing') return;
  event.preventDefault();

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const clickable = carrots.filter(c => c.active).map(c => c.group);
  const intersections = raycaster.intersectObjects(clickable, true);
  if (!intersections.length) return;

  let object = intersections[0].object;
  while (object.parent && object.userData.kind !== 'carrot') object = object.parent;
  const carrot = carrots.find(c => c.group === object);
  if (!carrot) return;

  if (toolMode === 'hammer' && toolsLeft.hammer > 0) {
    toolsLeft.hammer--;
    toolMode = null;
    launchCarrot(carrot, true);
    updateToolButtons();
    showMessage('清除阻挡！');
    return;
  }

  launchCarrot(carrot, false);
}

function update(dt) {
  if (gameState !== 'playing') {
    updateEffects(dt);
    return;
  }

  tutorialDismissTimer -= dt;
  if (tutorialDismissTimer <= 0) DOM.tutorial.classList.add('hidden');

  if (freezeTimer > 0) freezeTimer -= dt;
  if (feverTimer > 0) feverTimer -= dt;

  updateCarrotBumps(dt);
  updateSpawner(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateEffects(dt);
  updateCombo(dt);
  updateHint();
  updateHUD();
  checkEndState();
}

function updateSpawner(dt) {
  if (spawnedEnemies >= totalEnemies) return;
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    createEnemy(chooseEnemyType(spawnedEnemies));
    spawnedEnemies++;
    spawnTimer = spawnInterval;
  }
}

function updateEnemies(dt) {
  const speedFactor = freezeTimer > 0 ? 0 : 1;

  for (const enemy of enemies) {
    if (!enemy.active) continue;

    enemy.distance += enemy.speed * dt * speedFactor;
    const pos = pointAtDistance(enemy.distance);
    enemy.group.position.x = pos.x;
    enemy.group.position.y = pos.y;

    if (enemy.hitFlash > 0) {
      enemy.hitFlash -= dt;
      const s = 1 + Math.sin(enemy.hitFlash * 40) * 0.07;
      enemy.group.scale.set(s, 0.9 / s, 1);
    } else {
      enemy.group.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 15));
    }

    if (enemy.distance >= pathData.totalLength) reachGoal(enemy);
  }
}

function updateProjectiles(dt) {
  for (const projectile of projectiles) {
    if (!projectile.active) continue;

    if (projectile.mode === 'flight') {
      const speed = PROJECTILE_SPEED * (feverTimer > 0 ? 1.3 : 1);
      projectile.group.position.x += projectile.dir.x * speed * dt;
      projectile.group.position.y += projectile.dir.y * speed * dt;

      const entry = nearestPointOnPath(projectile.group.position.x, projectile.group.position.y);
      if (entry.offset <= ROAD.width * 0.68) {
        projectile.mode = 'path';
        projectile.pathDistance = entry.distance;
        projectile.group.position.set(entry.point.x, entry.point.y, 0.55);
        alignCarrotToPath(projectile);
        createBurst(entry.point.x, entry.point.y, 0xffd66b, 5);
      } else if (
        projectile.group.position.x < WORLD.left - 1 ||
        projectile.group.position.x > WORLD.right + 1 ||
        projectile.group.position.y < WORLD.bottom - 1 ||
        projectile.group.position.y > WORLD.top + 1
      ) {
        deactivateProjectile(projectile);
        continue;
      }
    } else if (projectile.mode === 'path') {
      const pathSpeed = PATH_PROJECTILE_SPEED * (feverTimer > 0 ? 1.25 : 1);
      projectile.pathDistance -= pathSpeed * dt;

      if (projectile.pathDistance <= 0) {
        deactivateProjectile(projectile);
        continue;
      }

      const pos = pointAtDistance(projectile.pathDistance);
      projectile.group.position.set(pos.x, pos.y, 0.55);
      alignCarrotToPath(projectile);
    }

    if (projectile.mode !== 'path') continue;

    for (const enemy of enemies) {
      if (!enemy.active || projectile.alreadyHit.has(enemy)) continue;

      const dx = projectile.group.position.x - enemy.group.position.x;
      const dy = projectile.group.position.y - enemy.group.position.y;
      const hitRadius = enemy.radius + 0.42;

      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        projectile.alreadyHit.add(enemy);
        hitEnemy(enemy, projectile);
      }
    }
  }

  projectiles = projectiles.filter(p => p.active);
}

function alignCarrotToPath(projectile) {
  const tangent = tangentAtDistance(projectile.pathDistance, -1);
  projectile.group.rotation.z = Math.atan2(-tangent.x, tangent.y);
}

function hitEnemy(enemy, projectile) {
  const damage = BASE_DAMAGE * (feverTimer > 0 ? 1.2 : 1);
  enemy.hp -= damage;

  if (projectile && !projectile.hasHit) {
    projectile.hasHit = true;
    successfulShots++;
  }
  enemy.hitFlash = 0.18;
  updateNumberLabel(enemy.label, enemy.hp);
  createBurst(enemy.group.position.x, enemy.group.position.y, 0xffd15b, 8);

  hits++;
  combo++;
  comboTimer = 2;
  bestCombo = Math.max(bestCombo, combo);

  DOM.comboLabel.classList.remove('hot');
  void DOM.comboLabel.offsetWidth;
  DOM.comboLabel.classList.add('hot');

  playTone(350 + Math.min(combo, 12) * 34, 0.05, 'sine', 0.04);

  if (combo === 10 && feverTimer <= 0) {
    feverTimer = 5;
    showMessage('🔥 辣椒狂热！');
  } else if ([3, 5, 8].includes(combo)) {
    showMessage(combo >= 8 ? 'PERFECT!' : combo >= 5 ? 'GREAT!' : 'GOOD!');
  }

  if (enemy.hp <= 0) killEnemy(enemy);
}

function killEnemy(enemy) {
  if (!enemy.active) return;
  enemy.active = false;
  defeatedEnemies++;
  createBurst(
    enemy.group.position.x,
    enemy.group.position.y,
    enemy.type === 'tank' ? 0x9fd4ff : 0xff8b75,
    14
  );
  playTone(180, 0.09, 'sawtooth', 0.045);
  enemyGroup.remove(enemy.group);
  disposeObject(enemy.group);
}

function reachGoal(enemy) {
  if (!enemy.active) return;
  enemy.active = false;
  enemyGroup.remove(enemy.group);
  disposeObject(enemy.group);

  lives--;
  combo = 0;
  comboTimer = 0;
  sunflower.scale.set(0.82, 1.12, 1);
  setTimeout(() => sunflower.scale.set(0.95, 0.95, 0.95), 140);
  playTone(90, 0.16, 'square', 0.055);
  showMessage('小猫咪受伤！');
}

function deactivateProjectile(projectile) {
  if (!projectile.active) return;
  projectile.active = false;
  projectileGroup.remove(projectile.group);
  disposeObject(projectile.group);
}

function updateCarrotBumps(dt) {
  for (const carrot of carrots) {
    if (!carrot.active || carrot.bumpTime <= 0) continue;
    carrot.bumpTime -= dt;
    const d = DIRS[carrot.dir];
    const phase = Math.sin(((0.24 - carrot.bumpTime) / 0.24) * Math.PI * 2);
    carrot.group.position.x = carrot.baseX + d.x * phase * 0.13;
    carrot.group.position.y = carrot.baseY + d.y * phase * 0.13;
    if (carrot.bumpTime <= 0) carrot.group.position.set(carrot.baseX, carrot.baseY, 0.2);
  }
}

function updateCombo(dt) {
  if (combo <= 0) return;
  comboTimer -= dt;
  if (comboTimer <= 0) combo = 0;
}

function checkEndState() {
  if (lives <= 0) {
    finishLevel(false);
    return;
  }

  const activeEnemies = enemies.some(e => e.active);
  if (spawnedEnemies >= totalEnemies && !activeEnemies) finishLevel(true);
}

function finishLevel(won) {
  if (gameState !== 'playing') return;
  gameState = won ? 'won' : 'lost';

  DOM.resultIcon.textContent = won ? '😺' : '😿';
  DOM.resultTitle.textContent = won ? '守住了！' : '差一点！';
  DOM.resultSubtitle.textContent = won
    ? '辣椒们成功挡住了怪潮'
    : '调整发射顺序和时机，再试一次';

  const accuracy = shots > 0 ? Math.round((successfulShots / shots) * 100) : 0;
  DOM.accuracyValue.textContent = `${accuracy}%`;
  DOM.bestComboValue.textContent = String(bestCombo);
  DOM.lifeValue.textContent = String(Math.max(0, lives));
  DOM.primaryResultButton.style.display = won ? '' : 'none';
  DOM.retryButton.textContent = won ? '重玩本关' : '再来一次';
  DOM.resultModal.classList.remove('hidden');

  playTone(won ? 700 : 120, won ? 0.22 : 0.28, won ? 'triangle' : 'sawtooth', 0.06);
}

function toggleTool(name) {
  if (gameState !== 'playing' || toolsLeft[name] <= 0) return;
  toolMode = toolMode === name ? null : name;
  updateToolButtons();
  if (toolMode === 'hammer') showMessage('选择一根辣椒移除');
}

function useFreeze() {
  if (gameState !== 'playing' || toolsLeft.freeze <= 0) return;
  toolsLeft.freeze--;
  freezeTimer = 3;
  toolMode = null;
  updateToolButtons();
  showMessage('❄️ 冻结 3 秒');
  playTone(760, 0.15, 'sine', 0.04);
}

function useBomb() {
  if (gameState !== 'playing' || toolsLeft.bomb <= 0) return;
  toolsLeft.bomb--;
  toolMode = null;
  updateToolButtons();

  for (const enemy of [...enemies]) {
    if (!enemy.active) continue;
    enemy.hp -= 12;
    updateNumberLabel(enemy.label, enemy.hp);
    createBurst(enemy.group.position.x, enemy.group.position.y, 0xffe26c, 7);
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  showMessage('💥 全屏轰炸！');
  playTone(100, 0.2, 'sawtooth', 0.065);
}

function updateToolButtons() {
  DOM.hammerCount.textContent = `×${toolsLeft.hammer}`;
  DOM.freezeCount.textContent = `×${toolsLeft.freeze}`;
  DOM.bombCount.textContent = `×${toolsLeft.bomb}`;
  DOM.hammerButton.disabled = toolsLeft.hammer <= 0;
  DOM.freezeButton.disabled = toolsLeft.freeze <= 0;
  DOM.bombButton.disabled = toolsLeft.bomb <= 0;
  DOM.hammerButton.classList.toggle('active', toolMode === 'hammer');
}

function updateHUD() {
  DOM.lives.textContent =
    '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
  DOM.waveLabel.textContent = `怪物 ${defeatedEnemies} / ${totalEnemies}`;
  DOM.comboLabel.textContent =
    feverTimer > 0 ? `🔥 FEVER ${feverTimer.toFixed(1)}s` : `COMBO ×${combo}`;
}

function updateHint() {
  const now = performance.now();
  if (now - lastHintAt < 3200) return;
  lastHintAt = now;

  const available = carrots.filter(c => c.active && !isBlocked(c));
  if (!available.length) return;

  const target = available[Math.floor(Math.random() * available.length)];
  target.group.scale.set(1.1, 1.1, 1.1);
  setTimeout(() => {
    if (target.active) target.group.scale.set(1, 1, 1);
  }, 380);
}

function showMessage(text) {
  DOM.floatingMessage.textContent = text;
  DOM.floatingMessage.classList.remove('show');
  void DOM.floatingMessage.offsetWidth;
  DOM.floatingMessage.classList.add('show');
}

function createBurst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.06 + Math.random() * 0.06, 8),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthTest: false,
      })
    );
    mesh.position.set(x, y, 1.2);
    fxGroup.add(mesh);

    const angle = Math.random() * Math.PI * 2;
    const speed = 1.3 + Math.random() * 2.2;
    effects.push({
      mesh,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.28,
      maxLife: 0.73,
    });
  }
}

function updateEffects(dt) {
  for (const fx of effects) {
    fx.life -= dt;
    fx.mesh.position.x += fx.vx * dt;
    fx.mesh.position.y += fx.vy * dt;
    fx.vy -= 3.6 * dt;
    fx.mesh.material.opacity = Math.max(0, fx.life / fx.maxLife);
    fx.mesh.scale.multiplyScalar(0.985);

    if (fx.life <= 0) {
      fxGroup.remove(fx.mesh);
      disposeObject(fx.mesh);
    }
  }

  effects = effects.filter(fx => fx.life > 0);
}

function generateLevel2HardLayout() {
  const layout = [];
  const push = (row, col, dir, type = 'normal') => {
    layout.push({ row, col, dir, type });
  };

  // 上半区锁链：开局仅左上角可动，逐个清开整行后才会解锁下一行。
  push(0, 0, 'left');
  for (let c = 1; c < BOARD.cols; c++) push(0, c, 'left');

  for (let c = 0; c < BOARD.cols - 1; c++) push(1, c, 'right');
  push(1, BOARD.cols - 1, 'up');

  push(2, 0, 'up');
  for (let c = 1; c < BOARD.cols; c++) push(2, c, 'left');

  // 下半区第二条独立锁链：与上半区反向。
  // 因此第二关开局严格只有两个合法出口，而不是同时出现大量可点击辣椒。
  for (let c = 0; c < BOARD.cols; c++) push(5, c, 'right');

  push(4, 0, 'down');
  for (let c = 1; c < BOARD.cols; c++) push(4, c, 'left');

  for (let c = 0; c < BOARD.cols - 1; c++) push(3, c, 'right');
  push(3, BOARD.cols - 1, 'down');

  return layout;
}

function generateSolvableLayout(rows, cols, count, seed) {
  const random = mulberry32(seed);
  const occupied = new Map();
  const result = [];
  const cells = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push({ r, c });
  }
  shuffle(cells, random);

  // 逆向构造：已放置的辣椒属于“更晚移除”的集合。
  // 新加入的辣椒只要对这些更晚移除的辣椒存在一个畅通方向，
  // 那么按“最后加入的先移除”就天然存在至少一条完整解法。
  let attempts = 0;

  while (result.length < count && attempts < 3000) {
    attempts++;

    const cell = cells.find(c => !occupied.has(cellKey(c.r, c)));
    if (!cell) break;

    const candidates = shuffle([...DIR_NAMES], random).filter(dir => {
      const d = DIRS[dir];
      let r = cell.r + d.dr;
      let c = cell.c + d.dc;

      while (r >= 0 && r < rows && c >= 0 && c < cols) {
        if (occupied.has(cellKey(r, c))) return false;
        r += d.dr;
        c += d.dc;
      }
      return true;
    });

    if (!candidates.length) {
      cells.splice(cells.indexOf(cell), 1);
      continue;
    }

    const dir = candidates[Math.floor(random() * candidates.length)];
    const item = {
      row: cell.r,
      col: cell.c,
      dir,
      type: level >= 4 && result.length % 8 === 5 ? 'pierce' : 'normal',
    };

    occupied.set(cellKey(cell.r, cell.c), item);
    result.push(item);
    cells.splice(cells.indexOf(cell), 1);
  }

  if (result.length < count) {
    for (let r = 0; r < rows && result.length < count; r++) {
      for (let c = 0; c < cols && result.length < count; c++) {
        if (occupied.has(cellKey(r, c))) continue;

        let dir = null;
        if (r === 0) dir = 'up';
        else if (r === rows - 1) dir = 'down';
        else if (c === 0) dir = 'left';
        else if (c === cols - 1) dir = 'right';

        if (!dir) continue;

        const item = { row: r, col: c, dir, type: 'normal' };
        occupied.set(cellKey(r, c), item);
        result.push(item);
      }
    }
  }

  return shuffle(result, random);
}

function cellToWorld(row, col) {
  const width = (BOARD.cols - 1) * BOARD.cell;
  const height = (BOARD.rows - 1) * BOARD.cell;
  return {
    x: col * BOARD.cell - width / 2,
    y: BOARD.centerY + height / 2 - row * BOARD.cell,
  };
}

function cellKey(r, c) {
  return `${r},${c}`;
}

function buildPathData(points) {
  const segments = [];
  let total = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const length = a.distanceTo(b);
    segments.push({ a, b, length, start: total });
    total += length;
  }

  return { segments, totalLength: total };
}

function nearestPointOnPath(x, y) {
  const p = new THREE.Vector2(x, y);
  let best = null;

  for (const segment of pathData.segments) {
    const ab = segment.b.clone().sub(segment.a);
    const lenSq = ab.lengthSq();
    const t = lenSq === 0
      ? 0
      : THREE.MathUtils.clamp(p.clone().sub(segment.a).dot(ab) / lenSq, 0, 1);

    const point = segment.a.clone().add(ab.multiplyScalar(t));
    const offset = point.distanceTo(p);
    const distance = segment.start + segment.length * t;

    if (!best || offset < best.offset) best = { point, offset, distance };
  }

  return best;
}

function tangentAtDistance(distance, direction = 1) {
  const d = THREE.MathUtils.clamp(distance, 0, pathData.totalLength);
  const segment =
    pathData.segments.find(s => d <= s.start + s.length) ||
    pathData.segments[pathData.segments.length - 1];

  const tangent = segment.b.clone().sub(segment.a).normalize();
  return tangent.multiplyScalar(direction);
}

function pointAtDistance(distance) {
  const d = Math.min(Math.max(distance, 0), pathData.totalLength);
  const segment =
    pathData.segments.find(s => d <= s.start + s.length) ||
    pathData.segments[pathData.segments.length - 1];

  const t = segment.length === 0 ? 0 : (d - segment.start) / segment.length;

  return new THREE.Vector2(
    THREE.MathUtils.lerp(segment.a.x, segment.b.x, t),
    THREE.MathUtils.lerp(segment.a.y, segment.b.y, t)
  );
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(array, random = Math.random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function playTone(frequency, duration, type = 'sine', volume = 0.03) {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // 音频不是核心逻辑；部分浏览器会在首个用户手势前阻止播放。
  }
}

function disposeObject(object) {
  object.traverse?.(child => {
    if (child.geometry) child.geometry.dispose?.();

    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];

      for (const mat of materials) {
        if (mat.map) mat.map.dispose?.();
        mat.dispose?.();
      }
    }
  });
}

function resize() {
  const rect = DOM.game.getBoundingClientRect();
  renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);

  const aspect = rect.width / rect.height;
  const targetAspect = 9 / 16;

  if (aspect > targetAspect) {
    const visibleWidth = (WORLD.top - WORLD.bottom) * aspect;
    camera.left = -visibleWidth / 2;
    camera.right = visibleWidth / 2;
    camera.top = WORLD.top;
    camera.bottom = WORLD.bottom;
  } else {
    const visibleHeight = (WORLD.right - WORLD.left) / aspect;
    camera.left = WORLD.left;
    camera.right = WORLD.right;
    camera.top = visibleHeight / 2;
    camera.bottom = -visibleHeight / 2;
  }

  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  update(dt);
  renderer.render(scene, camera);
}
