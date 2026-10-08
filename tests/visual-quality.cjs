'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-output', 'quality');
fs.mkdirSync(output, { recursive: true });
const errors = [];
const checks = [];
const report = { screenshots: [], sizes: [], assetDimensions: {}, warnings: [] };
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif' };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!(file === root || file.startsWith(root + path.sep))) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
const save = async (page, name) => {
  const dest = path.join(output, name + '.png');
  await page.screenshot({ path: dest, fullPage: true, animations: 'disabled' });
  report.screenshots.push(name + '.png');
};
(async () => {
  let browser;
  try {
    await new Promise((r, j) => { server.once('error', j); server.listen(0, '127.0.0.1', r); });
    browser = await chromium.launch({ headless: true,
      ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
      args: ['--disable-dev-shm-usage', '--no-zygote'] });
    const url = 'http://127.0.0.1:' + server.address().port;
    const sources = [
      'result-frame.avif','result-win-hero.avif','result-loss-hero.avif',
      'result-next.avif','result-replay.avif'
    ];
    for (const [width, height] of [[320,568],[390,844],[412,915],[1280,900]]) {
      const context = await browser.newContext({ viewport:{width,height},deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600 });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
      await page.goto(url);
      await page.waitForFunction(() => document.getElementById('game').dataset.ready === '1');
      assert.equal(await page.locator('#game').getAttribute('data-assets'), 'ready', 'sprite sheet');
      assert.equal(await page.locator('#game').getAttribute('data-background'), 'ready', 'garden background');
      assert.equal(await page.locator('#game').getAttribute('data-enemy-art'), 'ready', 'monster variants');
      assert.equal(await page.locator('#game').getAttribute('data-result-art'), 'ready', 'approved conclusion art');
      const dimensions = await page.evaluate(async sources => {
        return Object.fromEntries(await Promise.all(sources.map(async name => {
          const im = new Image();
          im.src = './assets/' + name;
          await im.decode();
          return [name, { width: im.naturalWidth, height: im.naturalHeight }];
        })));
      }, sources);
      if (width === 390) report.assetDimensions = dimensions;
      for (const [name, dims] of Object.entries(dimensions)) {
        assert.ok(dims.width >= 250 && dims.height >= 50, 'unexpected low-resolution art ' + name + ': ' + JSON.stringify(dims));
      }
      const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflowing,false,'horizontal document overflow');
      const gameRatio = await page.locator('.game-card').evaluate(el => {
        const r=el.getBoundingClientRect();return r.width / r.height;
      });
      assert.ok(Math.abs(gameRatio-9/16)<0.001,'9:16 canvas is being stretched: '+gameRatio);

      // Screenshot the ACTUAL first screen. Check elements before any game clicks.
      assert.equal(await page.locator('#homeScreen').isVisible(), true, 'home initially visible');
      assert.equal(await page.locator('#game').getAttribute('data-state'), 'home');
      const homeGeometry = await page.evaluate(() => {
        const root = document.querySelector('.game-card').getBoundingClientRect();
        const elements = ['.home-logo','.home-hero-art','.home-guide','#startGameButton'];
        return elements.map(selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { selector, left:r.left-root.left, top:r.top-root.top,
            right:root.right-r.right, bottom:root.bottom-r.bottom,
            height:r.height };
        });
      });
      for (const item of homeGeometry) for (const edge of ['left','right','top','bottom']) {
        assert.ok(item[edge]>=-2,'home screen clips '+width+'x'+height+' '+JSON.stringify(item));
      }
      const guide = homeGeometry.find(item=>item.selector==='.home-guide');
      const start = homeGeometry.find(item=>item.selector==='#startGameButton');
      assert.ok(guide.top+guide.height < start.top+3,
        'home start button overlaps tutorial at '+width+'x'+height);
      await save(page,'home-'+width+'x'+height);
      if(width===390) {
        const jpeg=await page.screenshot({type:'jpeg',quality:50,fullPage:true,animations:'disabled'});
        console.log('QUALITY_IMAGE_HOME_BEGIN');
        console.log(jpeg.toString('base64'));
        console.log('QUALITY_IMAGE_HOME_END');
      }
      await page.locator('#startGameButton').click();
      assert.equal(await page.locator('#homeScreen').isVisible(),false);
      assert.equal(await page.locator('#game').getAttribute('data-state'),'playing');
      // Mute is a real control (not decorative) and works without restarting.
      // Combo HUD should not show distracting ×0 before a real chain.
      assert.equal(await page.locator('.combo-board').evaluate(el=>getComputedStyle(el).opacity),'0');
      const mute=page.locator('#muteButton');
      assert.equal(await mute.getAttribute('aria-pressed'),'false');
      await mute.click();
      assert.equal(await mute.getAttribute('aria-pressed'),'true');
      await mute.click();
      assert.equal(await mute.getAttribute('aria-pressed'),'false');
      const muteBounds=await mute.boundingBox();
      const pauseButtonBounds=await page.locator('#pauseButton').boundingBox();
      assert.ok(muteBounds.y >= pauseButtonBounds.y + pauseButtonBounds.height - 1,'mute/pause overlap');
      await save(page, 'game-' + width + 'x' + height);
      if (width === 390) {
        const jpeg=await page.screenshot({type:'jpeg',quality:42,fullPage:true,animations:'disabled'});
        console.log('QUALITY_IMAGE_GAME_BEGIN');
        console.log(jpeg.toString('base64'));
        console.log('QUALITY_IMAGE_GAME_END');
      }
      const state1 = await page.locator('#game').getAttribute('data-state');
      assert.equal(state1,'playing');
      await page.locator('#pauseButton').click();
      assert.equal(await page.locator('#game').getAttribute('data-state'),'paused');
      assert.equal(await page.locator('#pauseOverlay').isVisible(),true);
      const pauseBounds = await page.evaluate(() => {
        const frame=document.querySelector('.game-card').getBoundingClientRect();
        const panel=document.querySelector('.pause-panel').getBoundingClientRect();
        return {left:panel.left-frame.left,right:frame.right-panel.right,top:panel.top-frame.top,bottom:frame.bottom-panel.bottom};
      });
      for (const [edge,space] of Object.entries(pauseBounds)) {
        assert.ok(space>=-1, 'pause panel clips '+edge+' at '+width+'x'+height+': '+JSON.stringify(pauseBounds));
      }
      const before = await page.locator('#game').getAttribute('data-spawned-enemies');
      await page.waitForTimeout(450);
      const after = await page.locator('#game').getAttribute('data-spawned-enemies');
      assert.equal(after,before,'time advances while paused');
      await save(page,'pause-' + width + 'x' + height);
      if (width === 390) {
        const jpeg=await page.screenshot({type:'jpeg',quality:42,fullPage:true,animations:'disabled'});
        console.log('QUALITY_IMAGE_PAUSE_BEGIN');
        console.log(jpeg.toString('base64'));
        console.log('QUALITY_IMAGE_PAUSE_END');
      }
      await page.locator('#resumeButton').click();
      assert.equal(await page.locator('#game').getAttribute('data-state'),'playing');
      for (const status of ['win','loss']) {
        await page.evaluate(status => {
          const modal = document.getElementById('resultModal');
          modal.dataset.result = status;
          modal.classList.remove('hidden');
          document.getElementById('accuracyValue').textContent='83%';
          document.getElementById('bestComboValue').textContent='9';
          document.getElementById('lifeValue').textContent=status==='win'?'3':'0';
        },status);
        await page.waitForTimeout(550);
        const measure = await page.evaluate(() => {
          const a=document.getElementById('resultModal');
          const b=a.querySelector('.modal-card').getBoundingClientRect();
          const parent=document.querySelector('.game-card').getBoundingClientRect();
          const buttons=[...a.querySelectorAll('button')].filter(el=>getComputedStyle(el).display!=='none')
            .map(el=>{const q=el.getBoundingClientRect();return {text:el.textContent.trim(),left:q.left,right:q.right,top:q.top,bottom:q.bottom}});
          return { rect:{left:b.left,right:b.right,top:b.top,bottom:b.bottom}, parent:{left:parent.left,right:parent.right,top:parent.top,bottom:parent.bottom}, buttons,scale:a.dataset.scale, art:a.dataset.art };
        });
        assert.equal(measure.art,'ready');
        assert.ok(measure.rect.left>=measure.parent.left-1, 'frame left clips '+JSON.stringify(measure));
        assert.ok(measure.rect.right<=measure.parent.right+1,'frame right clips '+JSON.stringify(measure));
        assert.ok(measure.rect.top>=measure.parent.top-1,'frame top clips '+JSON.stringify(measure));
        assert.ok(measure.rect.bottom<=measure.parent.bottom+1,'frame bottom clips '+JSON.stringify(measure));
        for (const b of measure.buttons) {
          assert.ok(b.left>=measure.parent.left-1 && b.right<=measure.parent.right+1,'button x clips '+JSON.stringify(b));
          assert.ok(b.top>=measure.parent.top-1 && b.bottom<=measure.parent.bottom+1,'button y clips '+JSON.stringify(b));
        }
        report.sizes.push({width,height,status,...measure});
        if(width===390) console.log('QUALITY_LAYOUT_'+status.toUpperCase()+' '+JSON.stringify(measure));
        await save(page,'result-'+status+'-'+width+'x'+height);
        if(width===390) {
          const jpeg=await page.screenshot({type:'jpeg',quality:42,fullPage:true,animations:'disabled'});
          console.log('QUALITY_IMAGE_'+status.toUpperCase()+'_BEGIN');
          console.log(jpeg.toString('base64'));
          console.log('QUALITY_IMAGE_'+status.toUpperCase()+'_END');
        }
        await page.evaluate(() => document.getElementById('resultModal').classList.add('hidden'));
      }
      checks.push('Pass: '+width+'x'+height+' assets, pause flow, conclusion bounds and screenshots');
      await context.close();
    }
    report.checks=checks;
    report.errors=errors;
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    console.log('ASSET_DIMENSIONS '+JSON.stringify(report.assetDimensions));
    console.log('QUALITY_CHECKS '+JSON.stringify(checks));
    assert.deepEqual(errors,[],'page console / network errors');
  } finally {
    if(browser) await browser.close();
    await new Promise(r=>server.close(r));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
