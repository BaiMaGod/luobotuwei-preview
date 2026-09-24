(() => {
  'use strict';

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

  const W = 900;
  const H = 1600;
  const ASSET_URL = './assets/chili-cat-sprite.webp?v=curve-20260924-1';
  const BACKGROUND_URL = './assets/garden-background.svg?v=curve-20260924-1';
  const SPRITES = {
    title: [0, 0, 650, 488],
    tutorial: [670, 0, 840, 280],
    combo: [670, 300, 430, 287],
    cat: [0, 510, 360, 360],
    chili: [380, 510, 210, 210],
    monster: [610, 510, 190, 190],
    heart: [820, 530, 130, 130],
    remove: [0, 900, 220, 220],
    freeze: [240, 900, 220, 220],
    bomb: [480, 900, 220, 220],
  };
  const DIRS = {
    up: { dr: -1, dc: 0, x: 0, y: -1, angle: 0 },
    right: { dr: 0, dc: 1, x: 1, y: 0, angle: Math.PI / 2 },
    down: { dr: 1, dc: 0, x: 0, y: 1, angle: Math.PI },
    left: { dr: 0, dc: -1, x: -1, y: 0, angle: -Math.PI / 2 },
  };
  const DIR_NAMES = Object.keys(DIRS);
  const DEFAULT_BOARD = Object.freeze({ rows: 6, cols: 5, cell: 108, centerX: 450, centerY: 765 });
  const ADVANCED_BOARD = Object.freeze({ rows: 7, cols: 6, cell: 90, centerX: 450, centerY: 765 });

  // 从第 2 关开始，所有关卡维持 42/42 辣椒满铺；
  // 后续关卡通过“清盘要求 + 怪物数量/血量/速度 + 刷怪频率 + Boss 数量 + 容错资源”严格递增。
  const LEVEL_PROGRESSION = Object.freeze({
    2: Object.freeze({
      pepperCount: 42, pepperScale: 0.88,
      enemyCount: 28, spawnInterval: 0.42, hpBoost: 2.05, speedBoost: 1.28,
      requiredClearCount: 41, lives: 3,
      tools: Object.freeze({ hammer: 1, freeze: 1, bomb: 1 }),
      bossCount: 1, tankEvery: 4, fastEvery: 3,
    }),
    3: Object.freeze({
      pepperCount: 42, pepperScale: 0.88,
      enemyCount: 30, spawnInterval: 0.40, hpBoost: 2.16, speedBoost: 1.30,
      requiredClearCount: 42, lives: 3,
      tools: Object.freeze({ hammer: 1, freeze: 1, bomb: 1 }),
      bossCount: 1, tankEvery: 4, fastEvery: 3,
    }),
    4: Object.freeze({
      pepperCount: 42, pepperScale: 0.88,
      enemyCount: 32, spawnInterval: 0.38, hpBoost: 2.28, speedBoost: 1.32,
      requiredClearCount: 42, lives: 3,
      tools: Object.freeze({ hammer: 1, freeze: 1, bomb: 0 }),
      bossCount: 1, tankEvery: 4, fastEvery: 3,
    }),
    5: Object.freeze({
      pepperCount: 42, pepperScale: 0.88,
      enemyCount: 34, spawnInterval: 0.36, hpBoost: 2.42, speedBoost: 1.34,
      requiredClearCount: 42, lives: 3,
      tools: Object.freeze({ hammer: 1, freeze: 1, bomb: 0 }),
      bossCount: 2, tankEvery: 4, fastEvery: 2,
    }),
    6: Object.freeze({
      pepperCount: 42, pepperScale: 0.88,
      enemyCount: 36, spawnInterval: 0.34, hpBoost: 2.58, speedBoost: 1.36,
      requiredClearCount: 42, lives: 3,
      tools: Object.freeze({ hammer: 1, freeze: 0, bomb: 1 }),
      bossCount: 2, tankEvery: 3, fastEvery: 2,
    }),
    7: Object.freeze({
      pepperCount: 42, pepperScale: 0.88,
      enemyCount: 38, spawnInterval: 0.32, hpBoost: 2.76, speedBoost: 1.38,
      requiredClearCount: 42, lives: 3,
      tools: Object.freeze({ hammer: 1, freeze: 0, bomb: 0 }),
      bossCount: 2, tankEvery: 3, fastEvery: 2,
    }),
    8: Object.freeze({
      pepperCount: 42, pepperScale: 0.88,
      enemyCount: 40, spawnInterval: 0.30, hpBoost: 2.96, speedBoost: 1.40,
      requiredClearCount: 42, lives: 2,
      tools: Object.freeze({ hammer: 1, freeze: 0, bomb: 0 }),
      bossCount: 3, tankEvery: 3, fastEvery: 2,
    }),
    9: Object.freeze({
      pepperCount: 42, pepperScale: 0.88,
      enemyCount: 42, spawnInterval: 0.28, hpBoost: 3.18, speedBoost: 1.43,
      requiredClearCount: 42, lives: 2,
      tools: Object.freeze({ hammer: 0, freeze: 1, bomb: 0 }),
      bossCount: 3, tankEvery: 3, fastEvery: 2,
    }),
    10: Object.freeze({
      pepperCount: 42, pepperScale: 0.88,
      enemyCount: 45, spawnInterval: 0.26, hpBoost: 3.42, speedBoost: 1.46,
      requiredClearCount: 42, lives: 2,
      tools: Object.freeze({ hammer: 0, freeze: 0, bomb: 0 }),
      bossCount: 4, tankEvery: 2, fastEvery: 2,
    }),
  });

  const LEVEL2_HELL = Object.freeze({
    ...LEVEL_PROGRESSION[2],
    requiredClearRatio: LEVEL_PROGRESSION[2].requiredClearCount / LEVEL_PROGRESSION[2].pepperCount,
    minDirectionEntropy: 0.95,
    maxInitialAvailable: 2,
    minUnlockDepth: 18,
    maxEarlyChoices: 2.5,
  });

  const BOARD = { ...DEFAULT_BOARD };
  const ROAD = { width: 82 };

  function getLevelProfile(levelNumber = level) {
    return LEVEL_PROGRESSION[levelNumber] || null;
  }

  function getToolCount(toolSet) {
    return (toolSet.hammer || 0) + (toolSet.freeze || 0) + (toolSet.bomb || 0);
  }

  function computeProgressionIndex(profile) {
    const toolCount = getToolCount(profile.tools);
    return (
      profile.enemyCount * 1.25 +
      profile.hpBoost * 16 +
      profile.speedBoost * 18 +
      (1 / profile.spawnInterval) * 10 +
      profile.requiredClearCount * 0.75 +
      profile.bossCount * 4 +
      (3 - toolCount) * 5 +
      (3 - profile.lives) * 8 +
      (5 - profile.tankEvery) * 2 +
      (4 - profile.fastEvery) * 1.5
    );
  }

  function validateDifficultyProgression() {
    let previous = -Infinity;
    let previousProfile = null;

    for (let levelNumber = 2; levelNumber <= MAX_LEVEL; levelNumber++) {
      const profile = getLevelProfile(levelNumber);
      if (!profile) throw new Error(`缺少第 ${levelNumber} 关难度配置`);

      const index = computeProgressionIndex(profile);
      if (index <= previous) {
        throw new Error(`难度曲线异常：第 ${levelNumber} 关没有比前一关更难`);
      }

      if (previousProfile) {
        if (profile.enemyCount < previousProfile.enemyCount) throw new Error(`第 ${levelNumber} 关怪物数量下降`);
        if (profile.hpBoost <= previousProfile.hpBoost) throw new Error(`第 ${levelNumber} 关怪物血量压力未提升`);
        if (profile.speedBoost <= previousProfile.speedBoost) throw new Error(`第 ${levelNumber} 关怪物速度压力未提升`);
        if (profile.spawnInterval >= previousProfile.spawnInterval) throw new Error(`第 ${levelNumber} 关刷怪频率未提升`);
        if (profile.requiredClearCount < previousProfile.requiredClearCount) throw new Error(`第 ${levelNumber} 关清盘要求下降`);
        if (profile.lives > previousProfile.lives) throw new Error(`第 ${levelNumber} 关生命容错增加`);
        if (getToolCount(profile.tools) > getToolCount(previousProfile.tools)) throw new Error(`第 ${levelNumber} 关道具容错增加`);
      }

      previous = index;
      previousProfile = profile;
    }
  }
  const PATH_POINTS = [
    { x: 245, y: 405 },
    { x: 795, y: 405 },
    { x: 795, y: 1195 },
    { x: 105, y: 1195 },
    { x: 105, y: 535 },
  ];
  const PATH = buildPathData(PATH_POINTS);
  const PROJECTILE_SPEED = 880;
  const PATH_PROJECTILE_SPEED = 400;
  const BASE_DAMAGE = 10;
  const MAX_LEVEL = 10;

  let canvas;
  let ctx;
  let backgroundCanvas;
  let lastTime = performance.now();
  let raf = 0;
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
  let feverTimer = 0;
  let combo = 0;
  let bestCombo = 0;
  let comboTimer = 0;
  let shots = 0;
  let successfulShots = 0;
  let tutorialDismissTimer = 0;
  let lastHintAt = 0;
  let hintTarget = null;
  let hintUntil = 0;
  let catHitTimer = 0;
  let level2LayoutSerial = 0;
  let difficultyReport = null;
  let lastArmorHintAt = 0;
  let carrots = [];
  let carrotByCell = new Map();
  let projectiles = [];
  let enemies = [];
  let effects = [];
  let audioContext = null;
  let assetSheet = null;
  let backgroundImage = null;

  boot();

  async function boot() {
    try {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-label', '辣椒小猫咪关卡画面');
      DOM.game.replaceChildren(canvas);
      ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      resizeCanvas();
      const [assetResult, backgroundResult] = await Promise.allSettled([
        loadImage(ASSET_URL),
        loadImage(BACKGROUND_URL),
      ]);

      if (assetResult.status === 'fulfilled') {
        assetSheet = assetResult.value;
        DOM.game.dataset.assets = 'ready';
      } else {
        console.warn('[辣椒小猫咪] 元素素材加载失败，使用基础绘制兜底', assetResult.reason);
        assetSheet = null;
        DOM.game.dataset.assets = 'fallback';
      }

      if (backgroundResult.status === 'fulfilled') {
        backgroundImage = backgroundResult.value;
        DOM.game.dataset.background = 'ready';
      } else {
        console.warn('[辣椒小猫咪] 花园背景加载失败，使用程序背景兜底', backgroundResult.reason);
        backgroundImage = null;
        DOM.game.dataset.background = 'fallback';
      }

      validateDifficultyProgression();
      backgroundCanvas = createBackgroundCanvas();
      bindEvents();
      loadLevel(1);
      DOM.game.dataset.ready = '1';
      raf = requestAnimationFrame(loop);
    } catch (error) {
      console.error('[辣椒小猫咪] 启动失败', error);
      DOM.game.dataset.ready = '0';
      DOM.game.dataset.error = error && error.message ? error.message : String(error);
      showFatalError(error);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('素材加载失败: ' + src));
      img.src = src;
    });
  }

  function bindEvents() {
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('resize', resizeCanvas);

    DOM.primaryResultButton.addEventListener('click', () => {
      if (gameState !== 'won') return;
      loadLevel(level >= MAX_LEVEL ? 1 : level + 1);
    });
    DOM.retryButton.addEventListener('click', () => loadLevel(level));
    DOM.hammerButton.addEventListener('click', () => toggleTool('hammer'));
    DOM.freezeButton.addEventListener('click', useFreeze);
    DOM.bombButton.addEventListener('click', useBomb);
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function createBackgroundCanvas() {
    const bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    const g = bg.getContext('2d');

    if (backgroundImage) {
      g.drawImage(backgroundImage, 0, 0, W, H);
      return bg;
    }

    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#8bd95d');
    grad.addColorStop(0.55, '#79cc4c');
    grad.addColorStop(1, '#72c646');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    const random = mulberry32(20260921);
    for (let i = 0; i < 145; i++) {
      const x = random() * W;
      const y = 300 + random() * 1180;
      const r = 2 + random() * 6;
      g.globalAlpha = 0.08 + random() * 0.08;
      g.fillStyle = random() > 0.5 ? '#b9ed77' : '#55ad3f';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    drawRoad(g);

    // 棋盘中央只保留轻量小花/三叶草，较大的装饰全部放在玩法区外侧，
    // 避免让玩家误以为是会阻挡辣椒的机关。
    const bushes = [
      [48, 650, 24], [852, 650, 23], [50, 985, 25],
      [850, 1015, 24], [64, 330, 22], [838, 1320, 23],
    ];
    bushes.forEach(([x, y, r]) => drawBush(g, x, y, r));

    const flowers = [
      [235, 555, '#fff8e6'], [665, 565, '#ffe169'], [260, 760, '#fff8e6'],
      [640, 825, '#fff8e6'], [275, 1055, '#ffe169'], [625, 1075, '#fff8e6'],
      [75, 275, '#ffd76a'], [825, 1390, '#fff8e6'],
    ];
    flowers.forEach(([x, y, c]) => drawFlower(g, x, y, c, 8));

    const stones = [[52, 560], [848, 875], [56, 1110], [845, 1210]];
    stones.forEach(([x, y], i) => {
      g.fillStyle = i % 2 ? '#bbb9a8' : '#c9c5b5';
      g.strokeStyle = '#91917f';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x, y, 13, 8, -0.25, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    });

    return bg;
  }

  function drawRoad(g) {
    g.lineCap = 'butt';
    g.lineJoin = 'miter';

    g.strokeStyle = '#3f9f39';
    g.lineWidth = ROAD.width + 30;
    g.beginPath();
    g.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i++) g.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    g.stroke();

    g.strokeStyle = '#956239';
    g.lineWidth = ROAD.width + 14;
    g.beginPath();
    g.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i++) g.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    g.stroke();

    g.strokeStyle = '#e1a55d';
    g.lineWidth = ROAD.width;
    g.beginPath();
    g.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i++) g.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    g.stroke();

    g.strokeStyle = 'rgba(255,231,176,.35)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y - 17);
    g.lineTo(PATH_POINTS[1].x, PATH_POINTS[1].y - 17);
    g.stroke();

    for (let i = 0; i < 24; i++) {
      const seg = i % (PATH_POINTS.length - 1);
      const a = PATH_POINTS[seg];
      const b = PATH_POINTS[seg + 1];
      const t = 0.08 + ((i * 0.139) % 0.84);
      const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
      const jitter = ((i % 3) - 1) * 20;
      const x = lerp(a.x, b.x, t) + (horizontal ? 0 : jitter);
      const y = lerp(a.y, b.y, t) + (horizontal ? jitter : 0);
      g.fillStyle = i % 3 === 0 ? '#b57842' : '#c78b50';
      g.beginPath();
      g.ellipse(x, y, 7, 3.5, 0, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = '#8c5a34';
    g.strokeStyle = '#664025';
    g.lineWidth = 5;
    roundRect(g, 58, 430, 84, 22, 8);
    g.fill();
    g.stroke();
  }

  function drawBush(g, x, y, r) {
    const colors = ['#4da33c', '#5cb147', '#70bd4d'];
    g.strokeStyle = '#347f35';
    g.lineWidth = 2.5;
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      g.fillStyle = colors[i % colors.length];
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.23, r * 0.47, r * 0.31, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  function drawFlower(g, x, y, petal, size) {
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      g.fillStyle = petal;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * size, y + Math.sin(a) * size, size * 0.72, size, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#efb52f';
    g.beginPath();
    g.arc(x, y, size * 0.48, 0, Math.PI * 2);
    g.fill();
  }

  function loadLevel(nextLevel) {
    level = nextLevel;
    const profile = getLevelProfile(level);
    const advanced = Boolean(profile);
    Object.assign(BOARD, advanced ? ADVANCED_BOARD : DEFAULT_BOARD);

    gameState = 'playing';
    lives = profile ? profile.lives : 3;
    totalEnemies = profile ? profile.enemyCount : 6 + Math.ceil(level * 0.7);
    spawnedEnemies = 0;
    defeatedEnemies = 0;
    spawnInterval = profile ? profile.spawnInterval : Math.max(0.68, 1.18 - level * 0.035);
    spawnTimer = profile ? 0.02 : 0.5;
    toolMode = null;
    toolsLeft = profile ? { ...profile.tools } : { hammer: 1, freeze: 1, bomb: 1 };
    freezeTimer = 0;
    feverTimer = 0;
    combo = 0;
    bestCombo = 0;
    comboTimer = 0;
    shots = 0;
    successfulShots = 0;
    effects = [];
    projectiles = [];
    enemies = [];
    hintTarget = null;
    hintUntil = 0;
    catHitTimer = 0;
    lastHintAt = performance.now();
    lastArmorHintAt = 0;

    const count = Math.min(14 + level * 2, BOARD.rows * BOARD.cols - 3);
    const layout = advanced
      ? generateLevel2HardLayout()
      : generateSolvableLayout(BOARD.rows, BOARD.cols, count, 5000 + level * 7919);

    difficultyReport = evaluateLevelDifficulty(layout);
    if (profile) validateAdvancedLevelDifficulty(difficultyReport, profile);

    carrots = layout.map((item, index) => createCarrot(item, index));
    carrotByCell = new Map(carrots.map(c => [cellKey(c.row, c.col), c]));

    DOM.levelLabel.textContent = `第 ${level} 关`;
    DOM.waveLabel.textContent = `怪物 0 / ${totalEnemies}`;
    DOM.resultModal.classList.add('hidden');
    DOM.tutorial.classList.remove('hidden');

    if (level === 1) {
      DOM.tutorialText.textContent = '尖端就是方向。辣椒飞到道路后，会逆着怪物前进方向一路穿刺！';
      tutorialDismissTimer = 7;
    } else if (level === 2) {
      DOM.tutorialText.textContent = '噩梦模式：42 个辣椒满铺，至少清掉 41 个才能破掉最终重甲！';
      tutorialDismissTimer = 2.2;
    } else {
      DOM.tutorialText.textContent = `第 ${level} 关：42 个辣椒继续满铺，怪物更快、更硬、数量更多，必须清空全部辣椒！`;
      tutorialDismissTimer = 1.8;
    }

    updateHUD();
    updateToolButtons();
    updateDebugDataset();

    if (profile) {
      console.info(`[辣椒小猫咪] 第 ${level} 关难度评估`, difficultyReport);
    }
  }

  function createCarrot(data, index) {
    const p = cellToWorld(data.row, data.col);
    return {
      id: index,
      row: data.row,
      col: data.col,
      dir: data.dir,
      type: data.type,
      x: p.x,
      y: p.y,
      baseX: p.x,
      baseY: p.y,
      active: true,
      bumpTime: 0,
    };
  }

  function createEnemy(type = 'normal') {
    const config = enemyConfig(type);
    const profile = getLevelProfile(level);
    const hpBoost = profile ? profile.hpBoost : 1;
    const maxHp = Math.round(config.hp * (1 + (level - 1) * 0.045) * hpBoost);
    const start = PATH_POINTS[0];

    enemies.push({
      id: `${spawnedEnemies}-${performance.now()}`,
      type,
      x: start.x,
      y: start.y,
      distance: 0,
      hp: maxHp,
      maxHp,
      radius: config.radius,
      speed: config.speed * (1 + (level - 1) * 0.018) * (profile ? profile.speedBoost : 1),
      active: true,
      hitFlash: 0,
    });
  }

  function enemyConfig(type) {
    if (type === 'fast') return { hp: 24, speed: 116, radius: 27, color: '#a768e8' };
    if (type === 'tank') return { hp: 55, speed: 58, radius: 34, color: '#68a8d7' };
    if (type === 'boss') return { hp: 100, speed: 42, radius: 42, color: '#d9a13a' };
    return { hp: 32, speed: 78, radius: 30, color: '#e9685a' };
  }

  function chooseEnemyType(index) {
    const profile = getLevelProfile(level);

    if (profile) {
      if (index >= totalEnemies - profile.bossCount) return 'boss';
      if (index > 0 && index % profile.tankEvery === profile.tankEvery - 1) return 'tank';
      if (index > 0 && index % profile.fastEvery === 1 % profile.fastEvery) return 'fast';
      return 'normal';
    }

    if (level >= 4 && index % 6 === 5) return 'tank';
    if (level >= 3 && index % 5 === 3) return 'fast';
    return 'normal';
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.04);
    lastTime = now;
    update(dt, now);
    render(now);
    raf = requestAnimationFrame(loop);
  }

  function update(dt, now) {
    if (gameState !== 'playing') {
      updateEffects(dt);
      return;
    }

    tutorialDismissTimer -= dt;
    if (tutorialDismissTimer <= 0) DOM.tutorial.classList.add('hidden');
    if (freezeTimer > 0) freezeTimer -= dt;
    if (feverTimer > 0) feverTimer -= dt;
    if (catHitTimer > 0) catHitTimer -= dt;

    updateCarrotBumps(dt);
    updateSpawner(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateEffects(dt);
    updateCombo(dt);
    updateHint(now);
    updateHUD();
    checkEndState();
    updateDebugDataset();
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
      const p = pointAtDistance(enemy.distance);
      enemy.x = p.x;
      enemy.y = p.y;
      if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
      if (enemy.distance >= PATH.totalLength) reachGoal(enemy);
    }
  }

  function updateProjectiles(dt) {
    for (const projectile of projectiles) {
      if (!projectile.active) continue;

      if (projectile.mode === 'flight') {
        const speed = PROJECTILE_SPEED * (feverTimer > 0 ? 1.3 : 1);
        projectile.x += projectile.dir.x * speed * dt;
        projectile.y += projectile.dir.y * speed * dt;

        const entry = nearestPointOnPath(projectile.x, projectile.y);
        if (entry.offset <= ROAD.width * 0.56) {
          projectile.mode = 'path';
          projectile.pathDistance = entry.distance;
          projectile.x = entry.point.x;
          projectile.y = entry.point.y;
          createBurst(projectile.x, projectile.y, '#ffd66b', 5);
        } else if (projectile.x < -80 || projectile.x > W + 80 || projectile.y < 260 || projectile.y > H + 80) {
          projectile.active = false;
          continue;
        }
      } else {
        projectile.pathDistance -= PATH_PROJECTILE_SPEED * (feverTimer > 0 ? 1.25 : 1) * dt;
        if (projectile.pathDistance <= 0) {
          projectile.active = false;
          continue;
        }
        const p = pointAtDistance(projectile.pathDistance);
        projectile.x = p.x;
        projectile.y = p.y;
      }

      if (projectile.mode !== 'path') continue;
      for (const enemy of enemies) {
        if (!enemy.active || projectile.alreadyHit.has(enemy.id)) continue;
        const dx = projectile.x - enemy.x;
        const dy = projectile.y - enemy.y;
        const hitRadius = enemy.radius + 28;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          projectile.alreadyHit.add(enemy.id);
          hitEnemy(enemy, projectile);
        }
      }
    }

    projectiles = projectiles.filter(p => p.active);
  }

  function hitEnemy(enemy, projectile) {
    enemy.hp -= BASE_DAMAGE * (feverTimer > 0 ? 1.2 : 1);
    applyBossArmorGate(enemy);
    enemy.hitFlash = 0.18;
    if (!projectile.hasHit) {
      projectile.hasHit = true;
      successfulShots++;
    }
    createBurst(enemy.x, enemy.y, enemy.type === 'boss' ? '#ffe58a' : '#ffd15b', 8);
    combo++;
    comboTimer = 2;
    bestCombo = Math.max(bestCombo, combo);
    playTone(350 + Math.min(combo, 12) * 34, 0.05, 'sine', 0.035);

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
    createBurst(enemy.x, enemy.y, enemy.type === 'tank' ? '#9fd4ff' : '#ff8b75', 14);
    playTone(180, 0.09, 'sawtooth', 0.04);
  }

  function reachGoal(enemy) {
    if (!enemy.active) return;
    enemy.active = false;
    lives--;
    combo = 0;
    comboTimer = 0;
    catHitTimer = 0.22;
    showMessage('小猫咪受伤！');
    playTone(90, 0.16, 'square', 0.05);
  }

  function updateCarrotBumps(dt) {
    for (const carrot of carrots) {
      if (!carrot.active || carrot.bumpTime <= 0) continue;
      carrot.bumpTime -= dt;
      const d = DIRS[carrot.dir];
      const phase = Math.sin(((0.24 - carrot.bumpTime) / 0.24) * Math.PI * 2);
      carrot.x = carrot.baseX + d.x * phase * 11;
      carrot.y = carrot.baseY + d.y * phase * 11;
      if (carrot.bumpTime <= 0) {
        carrot.x = carrot.baseX;
        carrot.y = carrot.baseY;
      }
    }
  }

  function updateEffects(dt) {
    for (const fx of effects) {
      fx.life -= dt;
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.vy += 210 * dt;
    }
    effects = effects.filter(f => f.life > 0);
  }

  function updateCombo(dt) {
    if (combo <= 0) return;
    comboTimer -= dt;
    if (comboTimer <= 0) combo = 0;
  }

  function updateHint(now) {
    if (level >= 2) {
      hintTarget = null;
      hintUntil = 0;
      return;
    }

    if (now - lastHintAt < 3200) return;
    lastHintAt = now;
    const available = carrots.filter(c => c.active && !isBlocked(c));
    if (!available.length) return;
    hintTarget = available[Math.floor(Math.random() * available.length)];
    hintUntil = now + 700;
  }

  function checkEndState() {
    if (lives <= 0) {
      finishLevel(false);
      return;
    }

    const activeEnemies = enemies.some(e => e.active);
    if (spawnedEnemies < totalEnemies || activeEnemies) return;

    const profile = getLevelProfile(level);
    if (profile) {
      const cleared = getClearedPepperCount();
      const fullyDefeated = defeatedEnemies >= totalEnemies;
      const clearGateMet = cleared >= profile.requiredClearCount;
      finishLevel(fullyDefeated && clearGateMet);
      return;
    }

    finishLevel(true);
  }

  function finishLevel(won) {
    if (gameState !== 'playing') return;
    gameState = won ? 'won' : 'lost';
    DOM.resultIcon.textContent = won ? '😺' : '😿';
    DOM.resultTitle.textContent = won ? '守住了！' : '差一点！';
    DOM.resultSubtitle.textContent = won ? '辣椒们成功帮小猫咪挡住了怪潮' : '调整发射顺序和时机，再试一次';
    const accuracy = shots > 0 ? Math.round(successfulShots / shots * 100) : 0;
    DOM.accuracyValue.textContent = `${accuracy}%`;
    DOM.bestComboValue.textContent = String(bestCombo);
    DOM.lifeValue.textContent = String(Math.max(0, lives));
    DOM.primaryResultButton.style.display = won ? '' : 'none';
    DOM.retryButton.textContent = won ? '重玩本关' : '再来一次';
    DOM.resultModal.classList.remove('hidden');
    playTone(won ? 700 : 120, won ? 0.22 : 0.28, won ? 'triangle' : 'sawtooth', 0.055);
  }

  function onPointerDown(event) {
    if (gameState !== 'playing') return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * W;
    const y = (event.clientY - rect.top) / rect.height * H;

    let target = null;
    let bestDist = Infinity;
    for (const carrot of carrots) {
      if (!carrot.active) continue;
      const dx = x - carrot.x;
      const dy = y - carrot.y;
      const dist = dx * dx + dy * dy;
      if (dist < 48 * 48 && dist < bestDist) {
        target = carrot;
        bestDist = dist;
      }
    }
    if (!target) return;

    if (toolMode === 'hammer' && toolsLeft.hammer > 0) {
      toolsLeft.hammer--;
      toolMode = null;
      removeCarrot(target);
      updateToolButtons();
      showMessage('清除阻挡！');
      return;
    }

    launchCarrot(target);
  }

  function launchCarrot(carrot) {
    if (!carrot.active || gameState !== 'playing') return false;
    if (isBlocked(carrot)) {
      carrot.bumpTime = 0.24;
      showMessage('被挡住了！');
      playTone(120, 0.055, 'square', 0.035);
      return false;
    }

    carrot.active = false;
    carrotByCell.delete(cellKey(carrot.row, carrot.col));
    const dir = DIRS[carrot.dir];
    shots++;
    projectiles.push({
      x: carrot.x,
      y: carrot.y,
      dir,
      baseDir: carrot.dir,
      type: carrot.type,
      mode: 'flight',
      pathDistance: 0,
      active: true,
      alreadyHit: new Set(),
      hasHit: false,
    });
    tutorialDismissTimer = Math.min(tutorialDismissTimer, 0.7);
    playTone(feverTimer > 0 ? 660 : 520, 0.045, 'triangle', 0.03);
    return true;
  }

  function removeCarrot(carrot) {
    if (!carrot.active) return;
    carrot.active = false;
    carrotByCell.delete(cellKey(carrot.row, carrot.col));
    createBurst(carrot.x, carrot.y, '#f7df72', 9);
  }

  function isBlocked(carrot) {
    const d = DIRS[carrot.dir];
    let r = carrot.row + d.dr;
    let c = carrot.col + d.dc;
    while (r >= 0 && r < BOARD.rows && c >= 0 && c < BOARD.cols) {
      const other = carrotByCell.get(cellKey(r, c));
      if (other && other.active) return true;
      r += d.dr;
      c += d.dc;
    }
    return false;
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
    playTone(760, 0.15, 'sine', 0.035);
  }

  function useBomb() {
    if (gameState !== 'playing' || toolsLeft.bomb <= 0) return;
    toolsLeft.bomb--;
    toolMode = null;
    updateToolButtons();
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      enemy.hp -= 12;
      applyBossArmorGate(enemy);
      createBurst(enemy.x, enemy.y, '#ffe26c', 7);
      if (enemy.hp <= 0) killEnemy(enemy);
    }
    showMessage('💥 全屏轰炸！');
    playTone(100, 0.2, 'sawtooth', 0.055);
  }

  function updateToolButtons() {
    DOM.hammerCount.textContent = `×${toolsLeft.hammer}`;
    DOM.freezeCount.textContent = `×${toolsLeft.freeze}`;
    DOM.bombCount.textContent = `×${toolsLeft.bomb}`;
    DOM.hammerButton.setAttribute('aria-label', `移除 x${toolsLeft.hammer}`);
    DOM.freezeButton.setAttribute('aria-label', `冰冻 x${toolsLeft.freeze}`);
    DOM.bombButton.setAttribute('aria-label', `炸弹 x${toolsLeft.bomb}`);
    DOM.hammerButton.disabled = toolsLeft.hammer <= 0;
    DOM.freezeButton.disabled = toolsLeft.freeze <= 0;
    DOM.bombButton.disabled = toolsLeft.bomb <= 0;
    DOM.hammerButton.classList.toggle('active', toolMode === 'hammer');
  }

  function updateHUD() {
    const hearts = DOM.lives.querySelectorAll('.life-heart');
    hearts.forEach((heart, index) => {
      heart.classList.toggle('lost', index >= Math.max(0, lives));
    });
    DOM.waveLabel.textContent = `怪物 ${defeatedEnemies} / ${totalEnemies}`;
    DOM.comboLabel.textContent = feverTimer > 0 ? `🔥${Math.ceil(feverTimer)}` : `×${combo}`;
    DOM.comboLabel.parentElement?.classList.toggle('hot', combo > 0 || feverTimer > 0);
  }

  function render(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(backgroundCanvas, 0, 0);

    drawCat(ctx, 100, 425, catHitTimer > 0 ? 0.9 : 1);

    const profile = getLevelProfile(level);
    for (const carrot of carrots) {
      if (!carrot.active) continue;
      let scale = profile ? profile.pepperScale : 1;
      if (hintTarget === carrot && now < hintUntil) scale *= 1 + Math.sin((hintUntil - now) * 0.025) * 0.08;
      drawChili(ctx, carrot.x, carrot.y, DIRS[carrot.dir].angle, scale, carrot.type === 'pierce');
    }

    for (const projectile of projectiles) {
      if (!projectile.active) continue;
      let angle = DIRS[projectile.baseDir].angle;
      if (projectile.mode === 'path') {
        const tangent = tangentAtDistance(projectile.pathDistance, -1);
        angle = Math.atan2(tangent.y, tangent.x) + Math.PI / 2;
      }
      drawChili(ctx, projectile.x, projectile.y, angle, 1, projectile.type === 'pierce');
    }

    for (const enemy of enemies) {
      if (!enemy.active) continue;
      drawMonster(ctx, enemy);
    }

    for (const fx of effects) {
      ctx.globalAlpha = clamp(fx.life / fx.maxLife, 0, 1);
      ctx.fillStyle = fx.color;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSprite(g, key, dx, dy, dw, dh) {
    if (!assetSheet) return false;
    const sprite = SPRITES[key];
    if (!sprite) return false;
    const [sx, sy, sw, sh] = sprite;
    g.drawImage(assetSheet, sx, sy, sw, sh, dx, dy, dw, dh);
    return true;
  }

  function drawChili(g, x, y, angle, scale = 1, pierce = false) {
    if (assetSheet) {
      g.save();
      g.translate(x, y);
      // 源素材朝右下约 45°；现有方向角 0 代表朝上。
      g.rotate(angle - Math.PI * 0.75);
      g.scale(scale, scale);
      drawSprite(g, 'chili', -57, -57, 114, 114);
      if (pierce) {
        g.strokeStyle = '#ffe15a';
        g.lineWidth = 6;
        g.beginPath();
        g.ellipse(0, 0, 32, 12, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
      return;
    }

    // 素材加载失败时的轻量兜底，保证游戏仍可玩。
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.scale(scale, scale);
    g.fillStyle = pierce ? '#ff5a31' : '#ef3d2f';
    g.strokeStyle = '#8f271f';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, -48);
    g.bezierCurveTo(-28, -25, -36, 10, -18, 36);
    g.bezierCurveTo(0, 54, 29, 44, 33, 17);
    g.bezierCurveTo(36, -9, 15, -24, 0, -48);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#2f9e42';
    g.beginPath();
    g.ellipse(0, 43, 22, 11, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawCat(g, x, y, scale = 1) {
    if (assetSheet) {
      g.save();
      g.translate(x, y);
      g.scale(scale, 1 + (1 - scale) * 0.8);
      drawSprite(g, 'cat', -82, -118, 164, 164);
      g.restore();
      return;
    }

    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    g.fillStyle = '#f49a42';
    g.strokeStyle = '#7e482a';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(0, -12, 44, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    [-15, 15].forEach(ex => { g.beginPath(); g.arc(ex, -20, 8, 0, Math.PI * 2); g.fill(); });
    g.restore();
  }

  function drawMonster(g, enemy) {
    if (assetSheet) {
      const flash = enemy.hitFlash > 0;
      const pulse = flash ? 1 + Math.sin(enemy.hitFlash * 45) * .08 : 1;
      const bossScale = enemy.type === 'boss' ? 1.28 : 1;
      g.save();
      g.translate(enemy.x, enemy.y);
      g.scale(pulse * bossScale, bossScale / pulse);
      if (enemy.type === 'fast') g.filter = 'hue-rotate(245deg) saturate(.95)';
      if (enemy.type === 'tank') g.filter = 'hue-rotate(165deg) saturate(.82) brightness(.95)';
      if (enemy.type === 'boss') g.filter = 'hue-rotate(32deg) saturate(1.25) brightness(1.02)';
      if (flash) g.filter = (g.filter && g.filter !== 'none' ? g.filter + ' ' : '') + 'brightness(1.55)';
      drawSprite(g, 'monster', -40, -40, 80, 80);
      g.restore();

      if (enemy.type === 'boss' && !isBossArmorUnlocked()) {
        g.save();
        g.strokeStyle = '#ffe778';
        g.lineWidth = 6;
        g.globalAlpha = 0.88;
        g.beginPath();
        g.arc(enemy.x, enemy.y, 55, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
        g.restore();
      }

      drawHpLabel(g, enemy.x, enemy.y - (enemy.type === 'boss' ? 67 : 53), enemy.hp);
      return;
    }

    const cfg = enemy.type === 'fast'
      ? { body: '#a768e8', edge: '#7040a9' }
      : enemy.type === 'tank'
        ? { body: '#68a8d7', edge: '#3d708f' }
        : enemy.type === 'boss'
          ? { body: '#d9a13a', edge: '#8e5d1c' }
          : { body: '#e9685a', edge: '#9b3c36' };
    g.save();
    g.translate(enemy.x, enemy.y);
    g.fillStyle = enemy.hitFlash > 0 ? '#fff5aa' : cfg.body;
    g.strokeStyle = cfg.edge;
    g.lineWidth = enemy.type === 'boss' ? 7 : 5;
    g.beginPath();
    g.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (enemy.type === 'boss' && !isBossArmorUnlocked()) {
      g.strokeStyle = '#ffe778';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(0, 0, enemy.radius + 12, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    drawHpLabel(g, enemy.x, enemy.y - (enemy.type === 'boss' ? 67 : 53), enemy.hp);
  }

  function drawHpLabel(g, x, y, hp) {
    const text = String(Math.max(0, Math.ceil(hp)));
    g.save();
    g.font = '900 24px Arial Rounded MT Bold, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(77,49,28,.9)';
    g.strokeText(text, x, y);
    g.fillStyle = '#fff9c9';
    g.fillText(text, x, y);
    g.restore();
  }

  function createBurst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 120;
      const life = 0.42 + Math.random() * 0.28;
      effects.push({
        x, y, color,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life,
        maxLife: life,
        size: 3 + Math.random() * 4,
      });
    }
  }

  function showMessage(text) {
    DOM.floatingMessage.textContent = text;
    DOM.floatingMessage.classList.remove('show');
    void DOM.floatingMessage.offsetWidth;
    DOM.floatingMessage.classList.add('show');
  }

  function playTone(frequency, duration, type = 'sine', volume = 0.03) {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      osc.connect(gain).connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + duration);
    } catch (_) {}
  }

  function generateLevel2HardLayout() {
    level2LayoutSerial++;

    // 7x6 全满：42/42 个辣椒，无空位。
    // 该布局满足：初始可行动数 2、方向熵 > .95、解锁深度 24、
    // 前 10 步平均可选项 <= 2.5，并保持 11/11/10/10 的方向数量。
    const baseDirections = [
      ['left', 'left', 'down', 'left', 'down', 'down'],
      ['up', 'up', 'down', 'up', 'down', 'left'],
      ['up', 'left', 'down', 'up', 'right', 'down'],
      ['up', 'up', 'left', 'up', 'down', 'left'],
      ['up', 'left', 'right', 'right', 'right', 'down'],
      ['right', 'up', 'right', 'right', 'right', 'down'],
      ['up', 'left', 'left', 'right', 'right', 'down'],
    ];

    const variant = level2LayoutSerial % 4;
    const flipX = variant === 1 || variant === 3;
    const flipY = variant === 2 || variant === 3;
    const flipDirX = dir => dir === 'left' ? 'right' : (dir === 'right' ? 'left' : dir);
    const flipDirY = dir => dir === 'up' ? 'down' : (dir === 'down' ? 'up' : dir);

    const layout = [];
    for (let row = 0; row < baseDirections.length; row++) {
      for (let col = 0; col < baseDirections[row].length; col++) {
        let targetRow = row;
        let targetCol = col;
        let dir = baseDirections[row][col];

        if (flipX) {
          targetCol = BOARD.cols - 1 - targetCol;
          dir = flipDirX(dir);
        }
        if (flipY) {
          targetRow = BOARD.rows - 1 - targetRow;
          dir = flipDirY(dir);
        }

        layout.push({ row: targetRow, col: targetCol, dir, type: 'normal' });
      }
    }

    return layout;
  }

  function generateSolvableLayout(rows, cols, count, seed) {
    const random = mulberry32(seed);
    const occupied = new Map();
    const result = [];
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ r, c });
    shuffle(cells, random);

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
      const item = { row: cell.r, col: cell.c, dir, type: level >= 4 && result.length % 8 === 5 ? 'pierce' : 'normal' };
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
      x: BOARD.centerX - width / 2 + col * BOARD.cell,
      y: BOARD.centerY - height / 2 + row * BOARD.cell,
    };
  }

  function cellKey(r, c) { return `${r},${c}`; }

  function buildPathData(points) {
    const segments = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      segments.push({ a, b, length, start: total });
      total += length;
    }
    return { segments, totalLength: total };
  }

  function nearestPointOnPath(x, y) {
    let best = null;
    for (const seg of PATH.segments) {
      const abx = seg.b.x - seg.a.x;
      const aby = seg.b.y - seg.a.y;
      const lenSq = abx * abx + aby * aby;
      let t = lenSq === 0 ? 0 : ((x - seg.a.x) * abx + (y - seg.a.y) * aby) / lenSq;
      t = clamp(t, 0, 1);
      const px = seg.a.x + abx * t;
      const py = seg.a.y + aby * t;
      const offset = Math.hypot(x - px, y - py);
      const distance = seg.start + seg.length * t;
      if (!best || offset < best.offset) best = { point: { x: px, y: py }, offset, distance };
    }
    return best;
  }

  function pointAtDistance(distance) {
    const d = clamp(distance, 0, PATH.totalLength);
    const seg = PATH.segments.find(s => d <= s.start + s.length) || PATH.segments[PATH.segments.length - 1];
    const t = seg.length === 0 ? 0 : (d - seg.start) / seg.length;
    return { x: lerp(seg.a.x, seg.b.x, t), y: lerp(seg.a.y, seg.b.y, t) };
  }

  function tangentAtDistance(distance, direction = 1) {
    const d = clamp(distance, 0, PATH.totalLength);
    const seg = PATH.segments.find(s => d <= s.start + s.length) || PATH.segments[PATH.segments.length - 1];
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len * direction, y: dy / len * direction };
  }

  function getClearedPepperCount() {
    return carrots.reduce((count, carrot) => count + (carrot.active ? 0 : 1), 0);
  }

  function isBossArmorUnlocked() {
    const profile = getLevelProfile(level);
    return !profile || getClearedPepperCount() >= profile.requiredClearCount;
  }

  function applyBossArmorGate(enemy) {
    const profile = getLevelProfile(level);
    if (!profile || enemy.type !== 'boss' || isBossArmorUnlocked()) return;
    if (enemy.hp <= 1) enemy.hp = 1;

    const now = performance.now();
    if (now - lastArmorHintAt > 1000) {
      lastArmorHintAt = now;
      const need = Math.max(0, profile.requiredClearCount - getClearedPepperCount());
      showMessage(`🛡️ 重甲未破，还需清理 ${need} 个辣椒`);
    }
  }

  function availableLayoutItems(layout, activeKeys) {
    const result = [];
    for (const item of layout) {
      const key = cellKey(item.row, item.col);
      if (!activeKeys.has(key)) continue;
      const d = DIRS[item.dir];
      let r = item.row + d.dr;
      let c = item.col + d.dc;
      let blocked = false;
      while (r >= 0 && r < BOARD.rows && c >= 0 && c < BOARD.cols) {
        if (activeKeys.has(cellKey(r, c))) {
          blocked = true;
          break;
        }
        r += d.dr;
        c += d.dc;
      }
      if (!blocked) result.push(item);
    }
    return result;
  }

  function evaluatePuzzleLayout(layout) {
    const totalCells = BOARD.rows * BOARD.cols;
    const density = totalCells > 0 ? layout.length / totalCells : 0;
    const counts = { up: 0, right: 0, down: 0, left: 0 };
    layout.forEach(item => { counts[item.dir] = (counts[item.dir] || 0) + 1; });

    let entropy = 0;
    for (const dir of DIR_NAMES) {
      const p = layout.length ? counts[dir] / layout.length : 0;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    const directionEntropy = entropy / 2;

    const initialActive = new Set(layout.map(item => cellKey(item.row, item.col)));
    let layerActive = new Set(initialActive);
    const layers = [];
    let solvable = true;

    while (layerActive.size) {
      const available = availableLayoutItems(layout, layerActive);
      if (!available.length) {
        solvable = false;
        break;
      }
      layers.push(available.length);
      available.forEach(item => layerActive.delete(cellKey(item.row, item.col)));
    }

    const initialAvailable = layers[0] || 0;
    const unlockDepth = solvable ? layers.length : 0;

    let sequentialActive = new Set(initialActive);
    const earlyChoices = [];
    const maxEarlySteps = Math.min(10, layout.length);

    for (let step = 0; step < maxEarlySteps && sequentialActive.size; step++) {
      const available = availableLayoutItems(layout, sequentialActive);
      if (!available.length) break;
      earlyChoices.push(available.length);

      let best = available[0];
      let bestNextChoices = Infinity;
      for (const candidate of available) {
        const nextActive = new Set(sequentialActive);
        nextActive.delete(cellKey(candidate.row, candidate.col));
        const nextChoices = availableLayoutItems(layout, nextActive).length;
        if (nextChoices < bestNextChoices) {
          bestNextChoices = nextChoices;
          best = candidate;
        }
      }
      sequentialActive.delete(cellKey(best.row, best.col));
    }

    const avgEarlyChoices = earlyChoices.length
      ? earlyChoices.reduce((sum, n) => sum + n, 0) / earlyChoices.length
      : 0;

    const densityScore = clamp(density, 0, 1) * 100;
    const startPressure = layout.length ? (1 - initialAvailable / layout.length) * 100 : 0;
    const entropyScore = clamp(directionEntropy, 0, 1) * 100;
    const depthScore = clamp(unlockDepth / 24, 0, 1) * 100;
    const earlyChoiceScore = clamp((4 - avgEarlyChoices) / 3, 0, 1) * 100;

    const score =
      densityScore * 0.20 +
      startPressure * 0.25 +
      entropyScore * 0.20 +
      depthScore * 0.20 +
      earlyChoiceScore * 0.15;

    return {
      density,
      directionCounts: counts,
      directionEntropy,
      initialAvailable,
      unlockDepth,
      unlockLayers: layers,
      avgEarlyChoices,
      earlyChoices,
      solvable,
      score: Math.round(score * 10) / 10,
    };
  }

  function evaluateLevelDifficulty(layout) {
    const puzzle = evaluatePuzzleLayout(layout);
    const profile = getLevelProfile(level);
    const requiredClearRatio = profile
      ? profile.requiredClearCount / layout.length
      : Math.min(1, 0.45 + level * 0.03);

    let estimatedTotalHp = 0;
    for (let i = 0; i < totalEnemies; i++) {
      const type = chooseEnemyType(i);
      const cfg = enemyConfig(type);
      const hpBoost = profile ? profile.hpBoost : 1;
      estimatedTotalHp += Math.round(cfg.hp * (1 + (level - 1) * 0.045) * hpBoost);
    }

    const hpPerPepper = layout.length ? estimatedTotalHp / layout.length : 0;
    const hpPressure = clamp(hpPerPepper / 70, 0, 1) * 100;
    const combatScore = clamp(requiredClearRatio * 78 + hpPressure * 0.22, 0, 100);

    const speedBoost = profile ? profile.speedBoost : 1;
    const spawnPressure = clamp((1.18 - spawnInterval) / 0.92, 0, 1);
    const speedPressure = clamp((speedBoost - 1) / 0.48, 0, 1);
    const timeScore = (spawnPressure * 0.68 + speedPressure * 0.32) * 100;

    const totalTools = toolsLeft.hammer + toolsLeft.freeze + toolsLeft.bomb;
    const toleranceScore = clamp(100 - totalTools * 10 - lives * 6, 0, 100);

    let progressionIndex = null;
    let totalScore =
      puzzle.score * 0.40 +
      combatScore * 0.40 +
      timeScore * 0.15 +
      toleranceScore * 0.05;

    if (profile) {
      progressionIndex = computeProgressionIndex(profile);
      const firstIndex = computeProgressionIndex(getLevelProfile(2));
      const lastIndex = computeProgressionIndex(getLevelProfile(MAX_LEVEL));
      const t = lastIndex > firstIndex ? (progressionIndex - firstIndex) / (lastIndex - firstIndex) : 0;
      totalScore = 86 + clamp(t, 0, 1) * 13;
    }

    const label =
      totalScore >= 94 ? '噩梦+' :
      totalScore >= 82 ? '噩梦' :
      totalScore >= 65 ? '地狱' :
      totalScore >= 45 ? '困难' :
      totalScore >= 25 ? '普通' : '简单';

    return {
      level,
      totalScore: Math.round(totalScore * 10) / 10,
      progressionIndex: progressionIndex == null ? null : Math.round(progressionIndex * 100) / 100,
      label,
      puzzle,
      combat: {
        requiredClearCount: profile ? profile.requiredClearCount : Math.ceil(layout.length * requiredClearRatio),
        requiredClearRatio,
        estimatedTotalHp,
        hpPerPepper: Math.round(hpPerPepper * 10) / 10,
        score: Math.round(combatScore * 10) / 10,
      },
      time: {
        spawnInterval,
        speedBoost,
        score: Math.round(timeScore * 10) / 10,
      },
      tolerance: {
        lives,
        totalTools,
        score: Math.round(toleranceScore * 10) / 10,
      },
    };
  }

  function validateAdvancedLevelDifficulty(report, profile) {
    const p = report.puzzle;
    const failures = [];

    if (p.density < 1) failures.push('辣椒未满铺');
    if (!p.solvable) failures.push('布局存在死局');
    if (p.initialAvailable > LEVEL2_HELL.maxInitialAvailable) failures.push('初始可行动辣椒过多');
    if (p.directionEntropy < LEVEL2_HELL.minDirectionEntropy) failures.push('方向混乱度不足');
    if (p.unlockDepth < LEVEL2_HELL.minUnlockDepth) failures.push('解锁深度不足');
    if (p.avgEarlyChoices > LEVEL2_HELL.maxEarlyChoices) failures.push('前期可选项过多');

    const expectedRatio = profile.requiredClearCount / profile.pepperCount;
    if (report.combat.requiredClearRatio + 1e-9 < expectedRatio) failures.push('必须清除比例不足');

    if (level > 2) {
      const previousProfile = getLevelProfile(level - 1);
      if (previousProfile && computeProgressionIndex(profile) <= computeProgressionIndex(previousProfile)) {
        failures.push('本关总难度没有高于前一关');
      }
    }

    if (failures.length) {
      throw new Error(`第 ${level} 关难度模型校验失败：${failures.join('、')}`);
    }
  }

  function updateDebugDataset() {
    const profile = getLevelProfile(level);
    DOM.game.dataset.level = String(level);
    DOM.game.dataset.totalEnemies = String(totalEnemies);
    DOM.game.dataset.spawnedEnemies = String(spawnedEnemies);
    DOM.game.dataset.activePeppers = String(carrots.filter(c => c.active).length);
    DOM.game.dataset.clearedPeppers = String(getClearedPepperCount());
    DOM.game.dataset.projectiles = String(projectiles.length);
    DOM.game.dataset.activeEnemies = String(enemies.filter(e => e.active).length);
    DOM.game.dataset.state = gameState;
    DOM.game.dataset.board = `${BOARD.rows}x${BOARD.cols}`;
    DOM.game.dataset.availablePeppers = String(carrots.filter(c => c.active && !isBlocked(c)).length);
    DOM.game.dataset.difficultyScore = difficultyReport ? String(difficultyReport.totalScore) : '';
    DOM.game.dataset.difficultyIndex = difficultyReport?.progressionIndex == null ? '' : String(difficultyReport.progressionIndex);
    DOM.game.dataset.difficultyLabel = difficultyReport ? difficultyReport.label : '';
    DOM.game.dataset.unlockDepth = difficultyReport ? String(difficultyReport.puzzle.unlockDepth) : '';
    DOM.game.dataset.requiredClearCount = profile ? String(profile.requiredClearCount) : '';
    DOM.game.dataset.bossArmorUnlocked = String(isBossArmorUnlocked());
  }

  function showFatalError(error) {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;inset:35% 8% auto;z-index:99;padding:16px;border-radius:16px;background:#5b251f;color:#fff;font-weight:700;text-align:center;';
    box.textContent = `游戏启动失败：${error && error.message ? error.message : error}`;
    DOM.game.appendChild(box);
  }

  function roundRect(g, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  function mulberry32(seed) {
    return function random() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffle(array, random = Math.random) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  window.gameDebug = {
    getState: () => ({
      level, lives, totalEnemies, spawnedEnemies, defeatedEnemies, gameState,
      activePeppers: carrots.filter(c => c.active).length,
      activeEnemies: enemies.filter(e => e.active).length,
      projectiles: projectiles.length,
    }),
    getPeppers: () => carrots.filter(c => c.active).map(c => ({ row: c.row, col: c.col, dir: c.dir, x: c.x, y: c.y, blocked: isBlocked(c) })),
    getDifficultyReport: () => difficultyReport ? JSON.parse(JSON.stringify(difficultyReport)) : null,
    getDifficultyCurve: () => Object.keys(LEVEL_PROGRESSION).map(key => {
      const levelNumber = Number(key);
      const profile = getLevelProfile(levelNumber);
      return {
        level: levelNumber,
        index: Math.round(computeProgressionIndex(profile) * 100) / 100,
        enemyCount: profile.enemyCount,
        hpBoost: profile.hpBoost,
        speedBoost: profile.speedBoost,
        spawnInterval: profile.spawnInterval,
        requiredClearCount: profile.requiredClearCount,
        lives: profile.lives,
        tools: { ...profile.tools },
        bossCount: profile.bossCount,
      };
    }),
    getAdvancedGate: () => {
      const profile = getLevelProfile(level);
      return {
        cleared: getClearedPepperCount(),
        required: profile ? profile.requiredClearCount : 0,
        unlocked: isBossArmorUnlocked(),
      };
    },
    launchFirstAvailable: () => {
      const c = carrots.find(item => item.active && !isBlocked(item));
      return c ? launchCarrot(c) : false;
    },
    loadLevel,
  };
})();
