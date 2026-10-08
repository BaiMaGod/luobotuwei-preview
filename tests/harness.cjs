const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Instrument a copy of the real game for deterministic logic/UI scenarios.
// No scenario setters are exposed by the production script.
const hook = `
  window.testGame = {
    loadLevel, validateDifficultyProgression, checkEndState, launchCarrot,
    removeCarrot, updateProjectiles, updateEnemies, advanceFinisher, getFinalPepper,
    hitEnemy, useFreeze, useBomb, toggleTool, onPointerDown, render, updateCatKick, updateEffects,
    config: () => ({ ENEMY_SPEED_SCALE, OPENING_THINK_TIME, PATH, DIRS, CAT_HOME, CAT_KICK }),
    audioStatus: () => ({
      unlocked: audioUnlocked, enabled: soundEnabled,
      state: audioContext?.state || 'unused',
      buffered: Array.from(soundBuffers.keys()),
      voices: soundVoices,
    }),
    refs: () => ({ carrots, projectiles, enemies, toolsLeft, DOM, spawnTimer, effects, catAction, catPosition }),
    spawn: (type, distance = 0, hp = null) => {
      createEnemy(type);
      const enemy = enemies[enemies.length - 1];
      enemy.id = 'fixture-' + enemies.length;
      enemy.distance = distance;
      enemy.previousDistance = distance;
      Object.assign(enemy, pointAtDistance(distance));
      if (hp !== null) enemy.hp = enemy.maxHp = hp;
      return enemy;
    },
    board: (items) => {
      carrots = items.map((item, index) => createCarrot({ type: 'normal', ...item }, index));
      carrotByCell = new Map(carrots.map(c => [cellKey(c.row, c.col), c]));
      finisherReady = false;
      finisherLaunched = false;
      updateFinisherReady(); updateToolButtons(); updateHUD(); updateDebugDataset();
    },
    resolvedWaves: (defeated = 0) => {
      spawnedEnemies = totalEnemies;
      spawnPlanIndex = enemySpawnPlan.length;
      defeatedEnemies = defeated;
    },
    setLives: value => { lives = value; },
    setFever: value => { feverTimer = value; },
    setCanvas: value => { canvas = value; },
    clearProjectiles: () => { projectiles = []; },
    step: seconds => {
      for (let remaining = seconds; remaining > 1e-9;) {
        const dt = Math.min(1 / 60, remaining);
        update(dt, performance.now());
        remaining -= dt;
      }
    },
    tick: (dt) => update(dt, performance.now()),
  };
`;

function instrument(source, skipBoot = false) {
  if (skipBoot) source = source.replace('\n  boot();', '\n  // Graphics boot disabled in VM tests.');
  if (!source.includes('  window.gameDebug = {')) throw new Error('Game test insertion point not found');
  return source.replace('  window.gameDebug = {', hook + '\n  window.gameDebug = {');
}

function createGame() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, {
        dataset: {}, style: {}, textContent: '', disabled: false,
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        setAttribute() {}, querySelectorAll() { return []; },
      });
      return elements.get(id);
    },
  };
  const context = { document, window: {}, performance: { now: () => 0 }, console: { info() {}, warn() {}, error() {} } };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  vm.runInContext(instrument(source, true), context);
  const game = context.window.testGame;
  game.loadLevel(1);
  return { game, debug: context.window.gameDebug, elements };
}

module.exports = { createGame, instrument };
