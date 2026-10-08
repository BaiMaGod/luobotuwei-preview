const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');

test('peppers wait for the cat to arrive behind them and kick, in every direction', () => {
  for (const dir of ['up', 'right', 'down', 'left']) {
    const { game, debug } = createGame();
    game.board([{ row: 2, col: 2, dir }]);
    const pepper = game.refs().carrots[0];
    assert.equal(game.launchCarrot(pepper), true);
    assert.equal(game.launchCarrot(pepper), false, 'a double tap cannot queue a duplicate');
    const shot = game.refs().projectiles[0];
    const action = game.refs().catAction;
    const { CAT_KICK, DIRS } = game.config();
    const contact = action.travel + CAT_KICK.windup + CAT_KICK.strike;
    const d = DIRS[dir];
    assert.equal(action.to.x, pepper.x - d.x * CAT_KICK.behind);
    assert.equal(action.to.y, pepper.y - d.y * CAT_KICK.behind);
    game.step(contact - 0.005);
    assert.equal(shot.mode, 'waitingKick');
    assert.equal(shot.x, pepper.x);
    assert.equal(shot.y, pepper.y);
    game.step(0.02);
    assert.equal(shot.mode, 'flight');
    assert.ok((shot.x - pepper.x) * d.x + (shot.y - pepper.y) * d.y > 0);
    assert.equal(game.refs().effects.filter(fx => fx.kind === 'kick').length, 1);
    assert.equal(debug.getState().pendingKicks, 0);
  }
});

test('rapid chain taps use one cat in order, while blocked taps and the hammer never kick', () => {
  const { game, debug } = createGame();
  game.board([0, 1, 2].map(col => ({ row: 2, col, dir: 'left' })));
  const peppers = game.refs().carrots;
  assert.equal(game.launchCarrot(peppers[2]), false);
  assert.equal(game.refs().catAction, null);
  for (const pepper of peppers) assert.equal(game.launchCarrot(pepper), true);
  const shots = [...game.refs().projectiles];
  assert.equal(shots.filter(p => p.finisher).length, 1);
  assert.equal(debug.getState().pendingKicks, 3);
  const launched = [];
  for (let t = 0; t < 2; t += 1 / 60) {
    game.step(1 / 60);
    for (let i = 0; i < shots.length; i++) {
      if (shots[i].mode !== 'waitingKick' && !launched.includes(i)) launched.push(i);
    }
    if (debug.getState().pendingKicks > 0) assert.equal(game.refs().catAction.kind, 'kick');
  }
  assert.deepEqual(launched, [0, 1, 2]);
  assert.equal(debug.getState().catPhase, 'idle');
  game.loadLevel(2);
  assert.equal(game.removeCarrot(game.refs().carrots[0]), true);
  assert.equal(debug.getState().pendingKicks, 0);
  assert.equal(game.refs().catAction, null);
});

test('a tap during the return flight redirects the same cat without snapping home', () => {
  const { game, debug } = createGame();
  game.board([{ row: 2, col: 1, dir: 'left' }, { row: 3, col: 2, dir: 'right' }]);
  game.launchCarrot(game.refs().carrots[0]);
  for (let t = 0; t < 1 && debug.getState().catPhase !== 'return'; t += 1 / 60) game.step(1 / 60);
  assert.equal(debug.getState().catPhase, 'return');
  game.step(0.04);
  const position = { ...game.refs().catPosition };
  game.launchCarrot(game.refs().carrots[1]);
  assert.equal(debug.getState().catPhase, 'kick');
  assert.equal(game.refs().catAction.from.x, position.x);
  assert.equal(game.refs().catAction.from.y, position.y);
});

test('the final kick is visible before an empty-road win; reset cancels pending kicks', () => {
  const { game, debug } = createGame();
  game.board([{ row: 2, col: 2, dir: 'up' }]);
  game.resolvedWaves(debug.getState().totalEnemies);
  debug.launchFirstAvailable();
  game.checkEndState();
  assert.equal(debug.getState().gameState, 'playing');
  game.step(0.8);
  assert.equal(debug.getState().gameState, 'won');
  game.loadLevel(2);
  debug.launchFirstAvailable();
  game.loadLevel(1);
  game.step(1);
  assert.equal(debug.getState().pendingKicks, 0);
  assert.equal(game.refs().projectiles.length, 0);
  assert.equal(game.refs().effects.length, 0);
  assert.equal(debug.getState().catPhase, 'idle');
});

test('hit flames follow living enemies, refresh without stacking, and never deal extra damage', () => {
  const { game } = createGame();
  const enemy = game.spawn('tank', 800, 100);
  game.hitEnemy(enemy, { hasHit: false, finisher: false });
  const fire = game.refs().effects.find(fx => fx.kind === 'fire');
  assert.ok(fire);
  assert.equal(fire.finisher, false);
  game.updateEnemies(0.1);
  game.updateEffects(0.1);
  assert.equal(fire.x, enemy.x);
  assert.ok(fire.y > enemy.y + enemy.radius, 'fire should sit under the rendered monster, not on its belly');
  assert.equal(enemy.hp, 90);
  game.hitEnemy(enemy, { hasHit: false, finisher: false });
  assert.equal(game.refs().effects.filter(fx => fx.kind === 'fire').length, 1);
  game.updateEffects(1);
  assert.equal(game.refs().effects.length, 0);
  assert.equal(enemy.hp, 80);
});

test('finisher contact leaves gold flames after killing a boss; defeat cancels queued launches', () => {
  const { game, debug } = createGame();
  const boss = game.spawn('boss', 800, 1000000);
  game.hitEnemy(boss, { hasHit: false, finisher: true });
  assert.equal(boss.active, false);
  const fire = game.refs().effects.find(fx => fx.kind === 'fire');
  const x = fire.x;
  game.updateEffects(0.2);
  assert.equal(fire.finisher, true);
  assert.equal(fire.x, x);
  assert.ok(fire.life > 0);
  debug.launchFirstAvailable();
  game.setLives(0);
  game.checkEndState();
  game.step(1);
  assert.equal(debug.getState().gameState, 'lost');
  assert.equal(game.refs().catAction, null);
  assert.equal(debug.getState().pendingKicks, 0);
});

test('blocked tap identifies the actual obstructing chili without modifying combat rules', () => {
  const { game, debug } = createGame();
  game.board([
    { row: 2, col: 1, dir: 'right' },
    { row: 2, col: 3, dir: 'up' },
    { row: 2, col: 4, dir: 'left' },
  ]);
  const [source, blocker] = game.refs().carrots;
  assert.equal(game.launchCarrot(source), false);
  assert.equal(debug.getState().blockingHintActive, true);
  assert.equal(debug.getState().activePeppers, 3);
  assert.equal(debug.getState().projectiles, 0);
  game.tick(0.2);
  assert.equal(debug.getState().blockingHintActive, true);
  game.tick(0.42);
  assert.equal(debug.getState().blockingHintActive, false);
  assert.equal(debug.getState().activePeppers, 3);
  assert.equal(game.launchCarrot(blocker), true);
});
