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
  const DIRS = {
    up: { dr: -1, dc: 0, x: 0, y: -1, angle: 0 },
    right: { dr: 0, dc: 1, x: 1, y: 0, angle: Math.PI / 2 },
    down: { dr: 1, dc: 0, x: 0, y: 1, angle: Math.PI },
    left: { dr: 0, dc: -1, x: -1, y: 0, angle: -Math.PI / 2 },
  };
  const DIR_NAMES = Object.keys(DIRS);
  const BOARD = { rows: 6, cols: 5, cell: 108, centerX: 450, centerY: 765 };
  const ROAD = { width: 82 };
  const PATH_POINTS = [
    { x: 310, y: 390 },
    { x: 790, y: 390 },
    { x: 790, y: 1190 },
    { x: 100, y: 1190 },
    { x: 100, y: 470 },
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
  let carrots = [];
  let carrotByCell = new Map();
  let projectiles = [];
  let enemies = [];
  let effects = [];
  let audioContext = null;

  boot();

  function boot() {
    try {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-label', '辣椒小猫咪关卡画面');
      DOM.game.replaceChildren(canvas);
      ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      resizeCanvas();
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

    const bushes = [
      [185, 650, 30], [715, 640, 28], [175, 990, 31],
      [720, 1010, 29], [78, 325, 24], [825, 1310, 26],
    ];
    bushes.forEach(([x, y, r]) => drawBush(g, x, y, r));

    const flowers = [
      [142, 520, '#fff8e6'], [754, 515, '#ffe169'], [146, 800, '#fff8e6'],
      [752, 835, '#fff8e6'], [165, 1110, '#ffe169'], [735, 1110, '#fff8e6'],
      [80, 255, '#ffd76a'], [815, 1395, '#fff8e6'],
    ];
    flowers.forEach(([x, y, c]) => drawFlower(g, x, y, c, 9));

    const stones = [[735, 570], [170, 870], [725, 1080], [85, 450], [815, 1260]];
    stones.forEach(([x, y], i) => {
      g.fillStyle = i % 2 ? '#bbb9a8' : '#c9c5b5';
      g.strokeStyle = '#91917f';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x, y, 15, 10, -0.25, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    });

    return bg;
  }

  function drawRoad(g) {
    g.lineCap = 'butt';
    g.lineJoin = 'miter';

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
    gameState = 'playing';
    lives = 3;
    totalEnemies = level === 2 ? 18 : 6 + Math.ceil(level * 0.7);
    spawnedEnemies = 0;
    defeatedEnemies = 0;
    spawnInterval = level === 2 ? 0.58 : Math.max(0.68, 1.18 - level * 0.035);
    spawnTimer = level === 2 ? 0.08 : 0.5;
    toolMode = null;
    toolsLeft = { hammer: 1, freeze: 1, bomb: 1 };
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

    const count = Math.min(14 + level * 2, BOARD.rows * BOARD.cols - 3);
    const layout = level === 2
      ? generateLevel2HardLayout()
      : generateSolvableLayout(BOARD.rows, BOARD.cols, count, 5000 + level * 7919);

    carrots = layout.map((item, index) => createCarrot(item, index));
    carrotByCell = new Map(carrots.map(c => [cellKey(c.row, c.col), c]));

    DOM.levelLabel.textContent = `第 ${level} 关`;
    DOM.waveLabel.textContent = `怪物 0 / ${totalEnemies}`;
    DOM.resultModal.classList.add('hidden');
    DOM.tutorial.classList.remove('hidden');
    DOM.tutorialText.textContent = level === 1
      ? '尖端就是方向。辣椒飞到道路后，会逆着怪物前进方向一路穿刺！'
      : level === 2
        ? '第 2 关：只有少数辣椒能先动，拆开锁链的同时顶住更强怪潮！'
        : '怪物有血量：同一根辣椒会沿道路逆行，依次穿刺途中每个敌人。';
    tutorialDismissTimer = level === 1 ? 7 : 3.5;
    updateHUD();
    updateToolButtons();
    updateDebugDataset();
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
    const level2HpBoost = level === 2 ? 1.65 : 1;
    const maxHp = Math.round(config.hp * (1 + (level - 1) * 0.045) * level2HpBoost);
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
      speed: config.speed * (1 + (level - 1) * 0.018) * (level === 2 ? 1.22 : 1),
      active: true,
      hitFlash: 0,
    });
  }

  function enemyConfig(type) {
    if (type === 'fast') return { hp: 24, speed: 116, radius: 27, color: '#a768e8' };
    if (type === 'tank') return { hp: 55, speed: 58, radius: 34, color: '#68a8d7' };
    return { hp: 32, speed: 78, radius: 30, color: '#e9685a' };
  }

  function chooseEnemyType(index) {
    if (level === 2) {
      if ([4, 8, 12, 16].includes(index)) return 'tank';
      if ([1, 3, 6, 10, 13, 15].includes(index)) return 'fast';
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
    enemy.hitFlash = 0.18;
    if (!projectile.hasHit) {
      projectile.hasHit = true;
      successfulShots++;
    }
    createBurst(enemy.x, enemy.y, '#ffd15b', 8);
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
    if (spawnedEnemies >= totalEnemies && !activeEnemies) finishLevel(true);
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
    DOM.hammerButton.disabled = toolsLeft.hammer <= 0;
    DOM.freezeButton.disabled = toolsLeft.freeze <= 0;
    DOM.bombButton.disabled = toolsLeft.bomb <= 0;
    DOM.hammerButton.classList.toggle('active', toolMode === 'hammer');
  }

  function updateHUD() {
    DOM.lives.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    DOM.waveLabel.textContent = `怪物 ${defeatedEnemies} / ${totalEnemies}`;
    DOM.comboLabel.textContent = feverTimer > 0 ? `🔥 FEVER ${feverTimer.toFixed(1)}s` : `COMBO ×${combo}`;
  }

  function render(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(backgroundCanvas, 0, 0);

    drawCat(ctx, 100, 425, catHitTimer > 0 ? 0.9 : 1);

    for (const carrot of carrots) {
      if (!carrot.active) continue;
      let scale = 1;
      if (hintTarget === carrot && now < hintUntil) scale = 1 + Math.sin((hintUntil - now) * 0.025) * 0.08;
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

  function drawChili(g, x, y, angle, scale = 1, pierce = false) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.scale(scale, scale);

    g.fillStyle = 'rgba(42,72,25,.17)';
    g.beginPath();
    g.ellipse(8, 34, 34, 10, 0.08, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = pierce ? '#ff5a31' : '#ef3d2f';
    g.strokeStyle = pierce ? '#9f281d' : '#8f271f';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(0, -52);
    g.bezierCurveTo(-5, -40, -22, -28, -31, -10);
    g.bezierCurveTo(-42, 11, -37, 31, -18, 42);
    g.bezierCurveTo(-2, 52, 22, 48, 31, 31);
    g.bezierCurveTo(40, 14, 30, 0, 15, -12);
    g.bezierCurveTo(6, -20, 5, -37, 0, -52);
    g.closePath();
    g.fill();
    g.stroke();

    g.strokeStyle = '#ff9f8c';
    g.lineWidth = 5;
    g.globalAlpha = .7;
    g.beginPath();
    g.moveTo(-11, -25);
    g.bezierCurveTo(-22, -7, -24, 12, -14, 24);
    g.stroke();
    g.globalAlpha = 1;

    g.fillStyle = '#2f9e42';
    g.strokeStyle = '#187031';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-11, 39);
    g.quadraticCurveTo(-27, 48, -31, 57);
    g.quadraticCurveTo(-15, 57, -5, 48);
    g.quadraticCurveTo(-3, 63, 4, 69);
    g.quadraticCurveTo(10, 57, 8, 47);
    g.quadraticCurveTo(21, 53, 31, 49);
    g.quadraticCurveTo(20, 40, 11, 37);
    g.closePath();
    g.fill();
    g.stroke();

    if (pierce) {
      g.strokeStyle = '#ffd94d';
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(0, -2, 26, 10, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  function drawCat(g, x, y, scale = 1) {
    g.save();
    g.translate(x, y);
    g.scale(scale, 1 + (1 - scale) * 0.8);

    g.fillStyle = 'rgba(60,75,35,.18)';
    g.beginPath();
    g.ellipse(0, 48, 48, 12, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = '#f49a42';
    g.strokeStyle = '#7e482a';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-42, -28); g.lineTo(-30, -67); g.lineTo(-10, -32); g.closePath(); g.fill(); g.stroke();
    g.beginPath();
    g.moveTo(42, -28); g.lineTo(30, -67); g.lineTo(10, -32); g.closePath(); g.fill(); g.stroke();

    g.beginPath();
    g.ellipse(0, 12, 37, 44, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#fff1d5';
    g.beginPath(); g.ellipse(0, 20, 23, 30, 0, 0, Math.PI * 2); g.fill();

    g.fillStyle = '#f49a42';
    g.beginPath(); g.ellipse(0, -28, 49, 43, 0, 0, Math.PI * 2); g.fill(); g.stroke();

    g.fillStyle = '#fff8e9';
    [-18, 18].forEach(ex => { g.beginPath(); g.ellipse(ex, -31, 11, 13, 0, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#342722';
    [-18, 18].forEach(ex => { g.beginPath(); g.arc(ex, -29, 5.5, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#fff';
    [-18, 18].forEach(ex => { g.beginPath(); g.arc(ex - 2, -32, 2, 0, Math.PI * 2); g.fill(); });

    g.fillStyle = '#f28f94';
    g.beginPath(); g.moveTo(0, -17); g.lineTo(-5, -12); g.lineTo(5, -12); g.closePath(); g.fill();
    g.strokeStyle = '#5a382c'; g.lineWidth = 3;
    g.beginPath(); g.arc(-5, -9, 8, .1, 1.15); g.stroke();
    g.beginPath(); g.arc(5, -9, 8, Math.PI - 1.15, Math.PI - .1); g.stroke();

    g.strokeStyle = '#d94336'; g.lineWidth = 8;
    g.beginPath(); g.arc(0, -2, 27, .2, Math.PI - .2); g.stroke();
    g.fillStyle = '#f5be36'; g.strokeStyle = '#9d6919'; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 10, 7, 0, Math.PI * 2); g.fill(); g.stroke();

    g.fillStyle = '#fff8e9'; g.strokeStyle = '#7e482a'; g.lineWidth = 4;
    [-19, 19].forEach(px => { g.beginPath(); g.ellipse(px, 45, 13, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke(); });
    g.restore();
  }

  function drawMonster(g, enemy) {
    const cfg = enemy.type === 'fast'
      ? { body: '#a768e8', edge: '#7040a9', shine: '#d8b8ff' }
      : enemy.type === 'tank'
        ? { body: '#68a8d7', edge: '#3d708f', shine: '#d7f0ff' }
        : { body: '#e9685a', edge: '#9b3c36', shine: '#ffb09f' };
    const flash = enemy.hitFlash > 0;
    const pulse = flash ? 1 + Math.sin(enemy.hitFlash * 45) * .08 : 1;

    g.save();
    g.translate(enemy.x, enemy.y);
    g.scale(pulse, 1 / pulse);
    if (enemy.type === 'tank') {
      g.fillStyle = '#f4e1b8'; g.strokeStyle = '#9b7651'; g.lineWidth = 4;
      [-1, 1].forEach(side => { g.beginPath(); g.moveTo(side * 19, -22); g.lineTo(side * 34, -42); g.lineTo(side * 10, -31); g.closePath(); g.fill(); g.stroke(); });
    }

    g.fillStyle = flash ? '#fff5aa' : cfg.body;
    g.strokeStyle = cfg.edge;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-31, 24);
    g.bezierCurveTo(-34, 2, -29, -29, -4, -37);
    g.bezierCurveTo(19, -43, 39, -28, 42, -6);
    g.bezierCurveTo(45, 18, 31, 34, 8, 38);
    g.bezierCurveTo(-11, 41, -27, 35, -31, 24);
    g.closePath(); g.fill(); g.stroke();

    g.fillStyle = cfg.shine; g.globalAlpha = .65;
    g.beginPath(); g.ellipse(-11, -20, 12, 6, -.4, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;

    g.fillStyle = '#fff8eb';
    [-12, 12].forEach(ex => { g.beginPath(); g.ellipse(ex, 0, 8, 10, 0, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#352822';
    [-11, 11].forEach(ex => { g.beginPath(); g.arc(ex, 2, 4, 0, Math.PI * 2); g.fill(); });
    g.restore();

    drawHpLabel(g, enemy.x, enemy.y - 53, enemy.hp);
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
    const layout = [];
    const push = (row, col, dir, type = 'normal') => layout.push({ row, col, dir, type });
    push(0, 0, 'left');
    for (let c = 1; c < BOARD.cols; c++) push(0, c, 'left');
    for (let c = 0; c < BOARD.cols - 1; c++) push(1, c, 'right');
    push(1, BOARD.cols - 1, 'up');
    push(2, 0, 'up');
    for (let c = 1; c < BOARD.cols; c++) push(2, c, 'left');
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

  function updateDebugDataset() {
    DOM.game.dataset.level = String(level);
    DOM.game.dataset.totalEnemies = String(totalEnemies);
    DOM.game.dataset.spawnedEnemies = String(spawnedEnemies);
    DOM.game.dataset.activePeppers = String(carrots.filter(c => c.active).length);
    DOM.game.dataset.projectiles = String(projectiles.length);
    DOM.game.dataset.activeEnemies = String(enemies.filter(e => e.active).length);
    DOM.game.dataset.state = gameState;
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
    launchFirstAvailable: () => {
      const c = carrots.find(item => item.active && !isBlocked(item));
      return c ? launchCarrot(c) : false;
    },
    loadLevel,
  };
})();
