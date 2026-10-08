const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');

test('all enemy types at every level move at half their previous effective speed', () => {
  const { game, debug } = createGame();
  game.validateDifficultyProgression();
  const curve = debug.getDifficultyCurve();
  for (let level = 1; level <= 10; level++) {
    game.loadLevel(level);
    const profile = curve.find(p => p.level === level);
    for (const [type, base] of Object.entries({ normal: 78, fast: 116, tank: 58, boss: 78 })) {
      const oldSpeed = type === 'boss' && profile
        ? 78 * (0.40 + (level - 2) * 0.006)
        : base * (1 + (level - 1) * 0.018) * (profile?.speedBoost || 1);
      assert.ok(Math.abs(game.spawn(type).speed - oldSpeed * 0.5) < 1e-9, level + ':' + type);
    }
  }
});

test('opening observation window delays enemies but permits puzzle actions', () => {
  const { game, debug } = createGame();
  game.loadLevel(2);
  assert.equal(debug.launchFirstAvailable(), true);
  game.step(2.9);
  assert.equal(debug.getState().spawnedEnemies, 0);
  game.step(0.15);
  assert.equal(debug.getState().spawnedEnemies, 1);
});

test('ordinary peppers keep normal damage and blocked clicks never create a finisher', () => {
  const { game, debug } = createGame();
  game.loadLevel(2);
  const blocked = game.refs().carrots.find(c => debug.getPeppers().find(p => p.row === c.row && p.col === c.col).blocked);
  assert.equal(game.launchCarrot(blocked), false);
  assert.equal(game.refs().projectiles.length, 0);
  const enemy = game.spawn('boss', 100, 1000);
  game.hitEnemy(enemy, { hasHit: false, finisher: false });
  assert.equal(enemy.hp, 990);
  assert.equal(enemy.active, true);
});

test('only the last launched pepper is special, including the tutorial level', () => {
  for (const level of [1, 2, 10]) {
    const { game, debug } = createGame();
    game.loadLevel(level);
    const count = debug.getState().activePeppers;
    for (let i = 0; i < count - 1; i++) assert.equal(debug.launchFirstAvailable(), true);
    assert.equal(debug.getState().finisherReady, true);
    assert.equal(game.refs().projectiles.filter(p => p.finisher).length, 0);
    const last = game.getFinalPepper();
    assert.equal(game.launchCarrot(last), true);
    assert.equal(game.launchCarrot(last), false);
    assert.equal(game.refs().projectiles.filter(p => p.finisher).length, 1);
    assert.equal(debug.getState().finisherLaunched, true);
  }
});

test('hammer can reveal a finisher but cannot consume the final pepper or a tool charge', () => {
  const { game, debug, elements } = createGame();
  game.board([{ row: 2, col: 1, dir: 'left' }, { row: 2, col: 2, dir: 'right' }]);
  game.setCanvas({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 1600 }) });
  game.toggleTool('hammer');
  const first = game.refs().carrots[0];
  game.onPointerDown({ preventDefault() {}, clientX: first.x, clientY: first.y });
  const last = game.getFinalPepper();
  assert.equal(game.removeCarrot(last), false);
  assert.equal(elements.get('hammerButton').disabled, true);
  const before = game.refs().toolsLeft.hammer;
  game.onPointerDown({ preventDefault() {}, clientX: last.x, clientY: last.y });
  assert.equal(game.refs().toolsLeft.hammer, before);
  assert.equal(debug.getState().finisherLaunched, true);
});

test('touching the finisher kills normal, fast, tank and arbitrarily healthy boss enemies', () => {
  const { game, debug } = createGame();
  game.loadLevel(10);
  game.board([{ row: 3, col: 3, dir: 'right' }]);
  debug.launchFirstAvailable();
  const p = game.refs().projectiles[0];
  Object.assign(p, { mode: 'path', pathDistance: 1000, pathDirection: -1 });
  const touched = ['normal', 'fast', 'tank', 'boss'].map(type => game.spawn(type, 990, 1000000));
  const remote = game.spawn('boss', 2000, 1000000);
  game.updateProjectiles(0.04);
  for (const enemy of touched) assert.equal(enemy.active, false, enemy.type);
  assert.equal(remote.active, true, 'no remote or whole-screen kill');
  assert.equal(p.active, true, 'pierces every contacted enemy');
  const kills = debug.getState().defeatedEnemies;
  game.updateProjectiles(0.04);
  assert.equal(debug.getState().defeatedEnemies, kills, 'no duplicate kills');
});

test('finisher reaches road corners and both endpoints without disappearing', () => {
  const { game, debug } = createGame();
  game.loadLevel(2);
  game.board([{ row: 0, col: 0, dir: 'up' }]);
  debug.launchFirstAvailable();
  game.resolvedWaves();
  const distances = [0, 550, 1340, 2030, 2690];
  const enemies = distances.map(d => game.spawn('boss', d, 1000000));
  game.updateCatKick(0.5);
  for (let t = 0; t < 6; t += 0.04) game.updateProjectiles(0.04);
  assert.ok(enemies.every(e => !e.active));
  assert.equal(game.refs().projectiles[0].active, true);
});

test('a finisher launched through each of the four sides clears downstream enemies', () => {
  for (const dir of ['up', 'right', 'down', 'left']) {
    const { game, debug } = createGame();
    game.loadLevel(2);
    game.board([{ row: 3, col: 3, dir }]);
    game.resolvedWaves();
    const enemies = [100, 900, 1800, 2500].map(d => game.spawn('boss', d, 1000000));
    debug.launchFirstAvailable();
    game.updateCatKick(0.5);
    for (let t = 0; t < 8; t += 0.04) game.updateProjectiles(0.04);
    assert.ok(enemies.every(e => !e.active), dir);
  }
});

test('a 40 ms frame catches contact across a corner and at an endpoint reflection', () => {
  const { game, debug } = createGame();
  game.board([{ row: 2, col: 2, dir: 'right' }]);
  debug.launchFirstAvailable();
  const p = game.refs().projectiles[0];
  Object.assign(p, { mode: 'path', pathDistance: 565, pathDirection: -1 });
  const corner = game.spawn('boss', 545, 99999);
  game.updateProjectiles(0.04);
  assert.equal(corner.active, false);
  Object.assign(p, { pathDistance: 10, pathDirection: -1 });
  const entrance = game.spawn('boss', 0, 99999);
  game.updateProjectiles(0.04);
  assert.equal(entrance.active, false);
  assert.equal(p.pathDirection, 1);
  // A 40 ms step at the user-approved 700 px/s road speed travels 28 px.
  assert.equal(p.pathDistance, 38);
});

test('advanced boards avoid large same-direction streaks', () => {
  for (const level of [2, 4, 7, 10]) {
    const { game, debug } = createGame();
    game.loadLevel(level);
    const peppers = debug.getPeppers();
    const byCell = new Map(peppers.map(p => [`${p.row},${p.col}`, p.dir]));
    let maxRun = 1;

    for (let r = 0; r < 7; r++) {
      let run = 1;
      for (let c = 1; c < 6; c++) {
        run = byCell.get(`${r},${c}`) === byCell.get(`${r},${c - 1}`) ? run + 1 : 1;
        maxRun = Math.max(maxRun, run);
      }
    }

    for (let c = 0; c < 6; c++) {
      let run = 1;
      for (let r = 1; r < 7; r++) {
        run = byCell.get(`${r},${c}`) === byCell.get(`${r - 1},${c}`) ? run + 1 : 1;
        maxRun = Math.max(maxRun, run);
      }
    }

    assert.ok(maxRun <= 3, `level ${level} max same-direction run = ${maxRun}`);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 5; c++) {
        const block = [
          byCell.get(`${r},${c}`),
          byCell.get(`${r + 1},${c}`),
          byCell.get(`${r},${c + 1}`),
          byCell.get(`${r + 1},${c + 1}`),
        ];
        assert.ok(new Set(block).size > 1, `level ${level} has a 2x2 same-direction block at ${r},${c}`);
      }
    }
  }
});

test('last shot closes spawning and a cleared board does not wait on unspawned infinite waves', () => {
  for (let level = 1; level <= 10; level++) {
    const { game, debug } = createGame();
    game.loadLevel(level);
    while (debug.getState().activePeppers) assert.equal(debug.launchFirstAvailable(), true);
    assert.equal(debug.getState().spawnedEnemies, 0);
    game.step(30);
    const state = debug.getState();
    assert.equal(state.gameState, 'won', 'level ' + level);
    // Production spawns continuously up to the final chili, not a finite mandatory wave count.
    // Completing the entire puzzle before the 3-second opening delay should win with 0 kills.
    assert.equal(state.spawnedEnemies, 0);
    assert.equal(state.defeatedEnemies, 0);
    assert.equal(state.activeEnemies, 0);
  }
});

test('waves dying early cannot skip the puzzle; surviving a leak can still win after clearing it', () => {
  const { game, debug } = createGame();
  game.loadLevel(2);
  game.resolvedWaves(debug.getState().totalEnemies - 1);
  game.setLives(2);
  game.checkEndState();
  assert.equal(debug.getState().gameState, 'playing');
  while (debug.getState().activePeppers) debug.launchFirstAvailable();
  game.checkEndState();
  assert.equal(debug.getState().gameState, 'playing', 'wait for queued kicks before showing the result');
  game.step(20);
  assert.equal(debug.getState().gameState, 'won');
  assert.equal(debug.getState().lives, 2);
});

test('zero lives still loses, and replay resets all finisher state and projectiles', () => {
  const { game, debug } = createGame();
  while (debug.getState().activePeppers) debug.launchFirstAvailable();
  game.setLives(0);
  game.checkEndState();
  assert.equal(debug.getState().gameState, 'lost');
  game.loadLevel(2);
  assert.equal(debug.getState().gameState, 'playing');
  assert.equal(debug.getState().finisherReady, false);
  assert.equal(debug.getState().finisherLaunched, false);
  assert.equal(game.refs().projectiles.length, 0);
});


test('levels 2–10 have distinct certified solvable puzzles and retries keep the same board', () => {
  const { game, debug } = createGame();
  const signatures = new Set();
  const serialize = () => debug.getPeppers()
    .map(p => `${p.row},${p.col}:${p.dir}`)
    .sort().join('|');

  for (let level = 2; level <= 10; level++) {
    game.loadLevel(level);
    const original = serialize();
    const report = debug.getState();
    assert.equal(debug.getPeppers().length, 42, 'level ' + level);
    assert.ok(report.activePeppers === 42);
    assert.ok(!signatures.has(original), 'duplicate puzzle for level ' + level);
    signatures.add(original);

    // A player must be able to replay precisely the board they just saw.
    game.loadLevel(level);
    assert.equal(serialize(), original, 'retry changed board for level ' + level);
    for (let i = 0; i < 42; i++) {
      assert.equal(debug.launchFirstAvailable(), true, 'unsolvable level ' + level + ' step ' + i);
    }
    assert.equal(debug.getState().finisherLaunched, true, 'missing finisher on ' + level);
  }
  assert.equal(signatures.size, 9);
});
