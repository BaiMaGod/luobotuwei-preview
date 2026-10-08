const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { instrument } = require('./harness.cjs');

const root = path.resolve(__dirname, '..');
const output = process.env.TEST_OUTPUT_DIR || path.join(root, 'test-output');
fs.mkdirSync(output, { recursive: true });
const errors = [];
const checks = [];
const record = name => { checks.push(name); console.log('PASS', name); };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  });
});

(async () => {
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
      args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'],
    });
    const url = 'http://127.0.0.1:' + server.address().port;
    async function open(width, height, instrumented = false, paused = false) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700, deviceScaleFactor: 1 });
      const page = await context.newPage();
      if (paused) await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
      if (instrumented) await page.route('**/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: instrument(fs.readFileSync(path.join(root, 'main.js'), 'utf8')) }));
      await page.goto(url);
      await page.waitForFunction(() => document.getElementById('game').dataset.ready === '1');
      assert.equal(await page.locator('#game').getAttribute('data-assets'), 'ready');
      assert.equal(await page.locator('#game').getAttribute('data-background'), 'ready');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('#homeScreen').isVisible(), true, 'start screen must be visible');
      assert.equal(await page.locator('#game').getAttribute('data-state'), 'home');
      if (width === 390 && !instrumented && !paused) {
        await page.screenshot({ path: path.join(output, 'mobile-home.png'), fullPage: true });
        await page.waitForTimeout(3300);
        assert.equal(await page.locator('#game').getAttribute('data-spawned-enemies'), '0',
          'enemies must not advance behind the home screen');
        record('illustrated home is visible and no enemies spawn before start');
      }
      await page.locator('#startGameButton').click();
      assert.equal(await page.locator('#homeScreen').isVisible(), false);
      assert.equal(await page.locator('#game').getAttribute('data-state'), 'playing');
      return { page, context };
    }
    async function tapPepper(page, pepper) {
      const box = await page.locator('#game canvas').boundingBox();
      await page.touchscreen.tap(box.x + pepper.x / 900 * box.width, box.y + pepper.y / 1600 * box.height);
    }
    async function frame(page) {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }

    const live = await open(390, 844);
    assert.equal(await live.page.evaluate(() => typeof window.testGame), 'undefined');
    assert.match(await live.page.locator('#waveLabel').innerText(), /辣椒 16 \/ 16/);
    assert.equal(await live.page.locator('#tutorial').isVisible(), false);
    assert.equal(await live.page.locator('#tutorialText').innerText(), '');
    await live.page.screenshot({ path: path.join(output, 'mobile-puzzle.png'), fullPage: true });
    record('production script and all local assets load on mobile without test hooks or overflow');
    await tapPepper(live.page, await live.page.evaluate(() => gameDebug.getPeppers().find(p => !p.blocked)));
    await live.page.waitForFunction(() => gameDebug.getState().catPhase === 'idle');
    assert.equal((await live.page.evaluate(() => gameDebug.getState())).activePeppers, 15);
    assert.equal((await live.page.evaluate(() => gameDebug.getState())).pendingKicks, 0);
    record('real-time production touch completes a cat kick without test hooks');
    await live.context.close();

    const run = await open(390, 844, true);
    const page = run.page;
    await page.evaluate(() => gameDebug.loadLevel(2));
    const blocked = await page.evaluate(() => gameDebug.getPeppers().find(p => p.blocked));
    await tapPepper(page, blocked);
    assert.equal((await page.evaluate(() => gameDebug.getState())).activePeppers, 42);
    assert.equal((await page.evaluate(() => gameDebug.getState())).blockingHintActive, true);
    await page.screenshot({ path: path.join(output, 'blocked-tap-hint.png'), fullPage: true });
    const blockedEvidence = await page.screenshot({type:'jpeg',quality:44,fullPage:true,animations:'disabled'});
    console.log('BLOCKED_IMAGE_BEGIN');
    console.log(blockedEvidence.toString('base64'));
    console.log('BLOCKED_IMAGE_END');
    record('blocked tap highlights the actual obstructing pepper without firing');

    await page.waitForFunction(() => testGame.audioStatus().buffered.includes('blocked'));
    assert.equal(await page.evaluate(() => testGame.audioStatus().unlocked), true);
    record('real blocked touch unlocks and plays locally generated event audio');
    for (let i = 0; i < 41; i++) {
      const pepper = await page.evaluate(() => gameDebug.getPeppers().find(p => !p.blocked));
      assert.ok(pepper);
      await tapPepper(page, pepper);
      await page.evaluate(() => testGame.step(0.5));
    }
    await frame(page);
    assert.equal((await page.evaluate(() => gameDebug.getState())).finisherReady, true);
    assert.equal(await page.locator('#hammerButton').isDisabled(), true);
    await page.screenshot({ path: path.join(output, 'mobile-finisher-ready.png'), fullPage: true });
    const final = await page.evaluate(() => gameDebug.getPeppers()[0]);
    await tapPepper(page, final);
    assert.equal((await page.evaluate(() => gameDebug.getState())).finisherLaunched, true);
    await page.evaluate(() => testGame.step(0.4));
    await frame(page);
    await page.screenshot({ path: path.join(output, 'mobile-finisher-flight.png'), fullPage: true });
    await page.evaluate(() => testGame.step(25));
    await page.waitForFunction(() => gameDebug.getState().gameState === 'won');
    assert.equal(await page.locator('#resultModal').isVisible(), true);
    await page.screenshot({ path: path.join(output, 'mobile-result.png'), fullPage: true });
    record('42 real touch launches reveal the finisher and resolve delayed waves to a win');
    await page.locator('#retryButton').tap();
    assert.equal((await page.evaluate(() => gameDebug.getState())).finisherLaunched, false);
    assert.equal((await page.evaluate(() => gameDebug.getState())).activePeppers, 42);
    record('retry resets the board, projectiles and finisher');

    // A level-2 victory unlocks level 3 on the homepage without resetting progress.
    await page.locator('#pauseButton').tap();
    await page.locator('#pauseHomeButton').tap();
    assert.equal(await page.locator('#homeScreen').isVisible(), true);
    assert.match(await page.locator('#startGameButton').innerText(), /继续第 3 关/);
    assert.equal(await page.evaluate(() => localStorage.getItem('chili-cat:max-level')), '3');
    await page.locator('#startGameButton').tap();
    assert.equal(await page.locator('#game').getAttribute('data-level'), '3');
    record('win persists unlocked levels and returning home resumes the correct level');
    await page.evaluate(() => testGame.loadLevel(2));

    await page.evaluate(() => {
      testGame.board([{ row: 3, col: 2, dir: 'left' }, { row: 3, col: 3, dir: 'right' }]);
      testGame.resolvedWaves(gameDebug.getState().totalEnemies - 2);
      testGame.spawn('boss', 250, 1000000);
      testGame.spawn('tank', 2100, 1000000);
    });
    await page.locator('#hammerButton').tap();
    await tapPepper(page, await page.evaluate(() => gameDebug.getPeppers()[0]));
    assert.equal((await page.evaluate(() => gameDebug.getState())).finisherReady, true);
    assert.equal(await page.locator('#hammerButton').isDisabled(), true);
    await tapPepper(page, await page.evaluate(() => gameDebug.getPeppers()[0]));
    await page.evaluate(() => testGame.step(8));
    assert.equal((await page.evaluate(() => gameDebug.getState())).gameState, 'won');
    record('hammer reveals the final pepper; physical contact kills high-HP enemies on both road sides');
    await run.context.close();

    const visual = await open(390, 844, true, true);
    for (const dir of ['up', 'right', 'down', 'left']) {
      await visual.page.evaluate(direction => {
        testGame.loadLevel(2);
        testGame.board([{ row: 3, col: 2, dir: direction }, { row: 0, col: 5, dir: 'up' }]);
      }, dir);
      await tapPepper(visual.page, await visual.page.evaluate(() => gameDebug.getPeppers()[0]));
      await visual.page.evaluate(() => {
        const a = testGame.refs().catAction;
        testGame.step(a.travel + testGame.config().CAT_KICK.windup + testGame.config().CAT_KICK.strike - 0.005);
        testGame.render(1200);
      });
      assert.equal((await visual.page.evaluate(() => gameDebug.getState())).pendingKicks, 1);
      await visual.page.screenshot({ path: path.join(output, 'cat-kick-' + dir + '.png'), fullPage: true });
      await visual.page.evaluate(() => { testGame.step(0.04); testGame.render(1240); });
      assert.equal((await visual.page.evaluate(() => gameDebug.getState())).pendingKicks, 0);
      if (dir === 'right') await visual.page.screenshot({ path: path.join(output, 'cat-kick-impact.png'), fullPage: true });
    }
    record('cat reaches the pepper tail and makes contact in all four directions');
    await visual.page.evaluate(() => {
      testGame.loadLevel(2);
      testGame.step(4.1);
      const normal = testGame.spawn('normal', 850, 100);
      const boss = testGame.spawn('boss', 1650, 1000000);
      testGame.hitEnemy(normal, { hasHit: false, finisher: false });
      testGame.hitEnemy(boss, { hasHit: false, finisher: true });
      testGame.updateEffects(0.08);
      testGame.tick(0);
      testGame.render(1320);
    });
    assert.equal(await visual.page.locator('.combo-board').evaluate(el=>el.classList.contains('visible')),true);
    await visual.page.screenshot({ path: path.join(output, 'enemy-hit-flames.png'), fullPage: true });
    assert.deepEqual(await visual.page.evaluate(() => testGame.refs().effects.filter(f => f.kind === 'fire').map(f => f.finisher)), [false, true]);
    record('ordinary contact renders foot flames and a defeated boss leaves a gold flame burst');
    await visual.context.close();

    for (const [width, height] of [[320, 568], [412, 915], [1280, 900]]) {
      const view = await open(width, height, true);
      await view.page.evaluate(() => { gameDebug.loadLevel(2); testGame.board([{ row: 0, col: 0, dir: 'up' }]); });
      await frame(view.page);
      await view.page.screenshot({ path: path.join(output, 'finisher-' + width + '.png'), fullPage: true });
      const box = await view.page.locator('#game canvas').boundingBox();
      assert.ok(box.width > 0 && box.height > 0);
      const combo = await view.page.locator('.combo-board').boundingBox();
      assert.ok(combo.x >= box.x && combo.x + combo.width <= box.x + box.width + 1, 'combo board is not clipped');
      record('finisher HUD and board fit viewport ' + width + 'x' + height);
      await view.context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify({ checks, errors }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
