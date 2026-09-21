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
  scene.background = new THREE.Color(0x86cf5a);

  camera = new THREE.OrthographicCamera(WORLD.left, WORLD.right, WORLD.top, WORLD.bottom, 0.1, 100);
  camera.position.set(0, 0, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  DOM.game.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff5d8, 0x44713b, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 2.1);
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
    new THREE.MeshStandardMaterial({ color: 0x7fc94f, roughness: 0.95 })
  );
  grass.position.z = -1.5;
  grass.receiveShadow = true;
  scene.add(grass);

  const patches = new THREE.Group();
  const geometry = new THREE.CircleGeometry(0.12, 12);
  for (let i = 0; i < 90; i++) {
    const hue = i % 3 === 0 ? 0x6ab843 : 0x91d662;
    const patch = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.35 }));
    patch.position.set((Math.random() - 0.5) * 15.5, (Math.random() - 0.5) * 25.5, -1.35);
    patch.scale.setScalar(0.6 + Math.random() * 1.4);
    patches.add(patch);
  }
  scene.add(patches);
}

function createRoad() {
  roadGroup = new THREE.Group();
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0xc58f55, roughness: 1 });
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x8d6b3f, roughness: 1 });

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const a = pathPoints[i];
    const b = pathPoints[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const horizontal = Math.abs(dx) > Math.abs(dy);

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? len : ROAD.width, horizontal ? ROAD.width : len, 0.14),
      roadMaterial
    );
    road.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, -0.65);
    road.receiveShadow = true;

    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? len + 0.18 : ROAD.width + 0.22, horizontal ? ROAD.width + 0.22 : len + 0.18, 0.06),
      edgeMaterial
    );
    edge.position.set(road.position.x, road.position.y, -0.78);
    roadGroup.add(edge, road);
  }

  scene.add(roadGroup);
}

function createSunflower() {
  sunflower = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.13, 0.95, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0x4f9d3d })
  );
  stem.position.y = -0.55;
  sunflower.add(stem);

  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0x7d4928 })
  );
  center.position.z = 0.2;
  sunflower.add(center);

  const petalGeometry = new THREE.SphereGeometry(0.28, 14, 10);
  const petalMaterial = new THREE.MeshStandardMaterial({ color: 0xffd43b });
  for (let i = 0; i < 10; i++) {
    const p = new THREE.Mesh(petalGeometry, petalMaterial);
    const a = (i / 10) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.05);
    p.scale.set(0.7, 1.15, 0.75);
    p.rotation.z = a;
    sunflower.add(p);
  }

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x251d17 });
  for (const x of [-0.16, 0.16]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), eyeMat);
    eye.position.set(x, 0.1, 0.64);
    sunflower.add(eye);
  }
  sunflower.position.set(ROAD.leftX, ROAD.topY - 0.35, 0.2);
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
  totalEnemies = level === 2 ? 16 : 6 + Math.ceil(level * 0.7);
  spawnInterval = level === 2 ? 0.62 : Math.max(0.68, 1.18 - level * 0.035);
  spawnTimer = level === 2 ? 0.1 : 0.5;
  lastHintAt = performance.now();

  const count = level === 2
    ? 27
    : Math.min(14 + level * 2, BOARD.rows * BOARD.cols - 3);
  const layout = generateSolvableLayout(BOARD.rows, BOARD.cols, count, 5000 + level * 7919);
  carrots = layout.map((item, index) => createCarrot(item, index));
  carrotByCell = new Map(carrots.map(c => [cellKey(c.row, c.col), c]));

  DOM.levelLabel.textContent = `第 ${level} 关`;
  DOM.resultModal.classList.add('hidden');
  DOM.tutorial.classList.remove('hidden');
  DOM.tutorialText.textContent = level === 1
    ? '尖端就是方向。萝卜飞到道路后，会逆着怪物前进方向一路穿刺！'
    : level === 2
      ? '第 2 关：怪潮大幅加速，高血怪更多，萝卜阵也更拥挤！'
      : '怪物有血量：同一根萝卜会沿道路逆行，依次穿刺途中每个敌人。';
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

  const bodyMat = new THREE.MeshStandardMaterial({
    color: data.type === 'pierce' ? 0xf6b936 : 0xf47d2b,
    roughness: 0.7,
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.28, 18), bodyMat);
  body.castShadow = true;
  body.position.y = 0.06;
  group.add(body);

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.38, 0.16, 16),
    new THREE.MeshStandardMaterial({ color: 0xef6723 })
  );
  collar.position.y = -0.61;
  group.add(collar);

  const leafMat = new THREE.MeshStandardMaterial({
    color: data.type === 'pierce' ? 0x30a86a : 0x3eaa45,
    roughness: 0.8,
  });
  for (const offset of [-0.18, 0, 0.18]) {
    const leaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.34, 4, 8), leafMat);
    leaf.position.set(offset, -0.93, 0);
    leaf.rotation.z = offset * 1.3;
    group.add(leaf);
  }

  if (data.type === 'pierce') {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.055, 8, 18),
      new THREE.MeshBasicMaterial({ color: 0xfff07d })
    );
    ring.position.y = 0.22;
    group.add(ring);
  }

  group.rotation.z = DIRS[data.dir].angle;
  const p = cellToWorld(data.row, data.col);
  group.position.set(p.x, p.y, 0.2);
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

  const level2HpBoost = level === 2 ? 1.38 : 1;
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
    speed: config.speed * (1 + (level - 1) * 0.018) * (level === 2 ? 1.16 : 1),
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
    if (index === 4 || index === 8 || index === 12 || index === 15) return 'tank';
    if (index === 1 || index === 3 || index === 6 || index === 10 || index === 13) return 'fast';
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
    showMessage('🔥 萝卜狂热！');
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
  sunflower.scale.set(0.78, 1.18, 1);
  setTimeout(() => sunflower.scale.set(0.95, 0.95, 0.95), 140);
  playTone(90, 0.16, 'square', 0.055);
  showMessage('向日葵受伤！');
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

  DOM.resultIcon.textContent = won ? '🌻' : '🥀';
  DOM.resultTitle.textContent = won ? '守住了！' : '差一点！';
  DOM.resultSubtitle.textContent = won
    ? '萝卜们成功挡住了怪潮'
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
  if (toolMode === 'hammer') showMessage('选择一根萝卜移除');
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

function generateSolvableLayout(rows, cols, count, seed) {
  const random = mulberry32(seed);
  const occupied = new Map();
  const result = [];
  const cells = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push({ r, c });
  }
  shuffle(cells, random);

  // 逆向构造：已放置的萝卜属于“更晚移除”的集合。
  // 新加入的萝卜只要对这些更晚移除的萝卜存在一个畅通方向，
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
