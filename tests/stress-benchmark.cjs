'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { instrument } = require('./harness.cjs');

const root=path.resolve(__dirname,'..');
const out=path.join(root,'test-output','stress');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.avif':'image/avif','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    res.end(data);
  });
});
const median=list=>list[Math.floor(list.length*.5)];
const percentile=(list,q)=>list[Math.min(list.length-1,Math.ceil(list.length*q)-1)];
(async()=>{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 let browser;
 try{
  browser=await chromium.launch({headless:true,
    ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
    args:['--disable-gpu','--disable-dev-shm-usage','--no-zygote']});
  const url='http://127.0.0.1:'+server.address().port;
  const results={};
  for(const [name,sourcePath] of [
    ['baseline','tests/fixtures/20261008-baseline-main.js'],
    ['candidate','main.js'],
  ]){
    const code=fs.readFileSync(path.join(root,sourcePath),'utf8');
    const context=await browser.newContext({
      viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      // Stable deterministic bench: measured frames are explicitly rendered.
      window.requestAnimationFrame=()=>0;
      window.__stressCounts={gradients:0,radial:0,shadows:0};
      const p=CanvasRenderingContext2D.prototype;
      const l=p.createLinearGradient,r=p.createRadialGradient;
      p.createLinearGradient=function(...a){window.__stressCounts.gradients++;return l.apply(this,a);};
      p.createRadialGradient=function(...a){window.__stressCounts.radial++;return r.apply(this,a);};
    });
    await page.route('**/main.js*',route=>route.fulfill({contentType:'text/javascript',body:instrument(code)}));
    await page.goto(url);
    await page.waitForFunction(()=>document.getElementById('game').dataset.ready==='1');
    await page.locator('#startGameButton').click();
    const fixture=await page.evaluate(()=>{
      testGame.loadLevel(7);
      const types=['normal','fast','tank','boss'];
      for(let i=0;i<24;i++){
        const enemy=testGame.spawn(types[i%types.length],180+i*105,100000);
        testGame.hitEnemy(enemy,{hasHit:false,finisher:false});
      }
      const refs=testGame.refs();
      return {enemies:refs.enemies.length,flames:refs.effects.filter(e=>e.kind==='fire').length,
        particles:refs.effects.filter(e=>e.kind!=='fire').length};
    });
    assert.equal(fixture.enemies,24);
    assert.equal(fixture.flames,24);
    const samples=await page.evaluate(()=>{
      const samples=[];
      window.__stressCounts={gradients:0,radial:0,shadows:0};
      for(let i=0;i<68;i++){
        const a=performance.now();
        testGame.render(a+i*16.6667);
        const ms=performance.now()-a;
        if(i>=8) samples.push(ms);
      }
      return {samples,counters:window.__stressCounts,
        canvas:{width:document.querySelector('#game canvas').width,
          height:document.querySelector('#game canvas').height}};
    });
    samples.samples.sort((a,b)=>a-b);
    results[name]={fixture,
      render:{medianMs:+median(samples.samples).toFixed(3),
        p95Ms:+percentile(samples.samples,.95).toFixed(3),
        meanMs:+(samples.samples.reduce((a,b)=>a+b,0)/samples.samples.length).toFixed(3),
        minMs:+samples.samples[0].toFixed(3),maxMs:+samples.samples.at(-1).toFixed(3)},
      counters:samples.counters,canvas:samples.canvas,
      errors};
    await page.screenshot({path:path.join(out,name+'-dense-battle.png'),animations:'disabled'});
    await context.close();
  }
  assert.deepEqual(results.baseline.errors,[]);
  assert.deepEqual(results.candidate.errors,[]);
  assert.deepEqual(results.candidate.fixture,results.baseline.fixture);
  console.log('STRESS_BASELINE '+JSON.stringify(results.baseline));
  console.log('STRESS_CANDIDATE '+JSON.stringify(results.candidate));
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 }finally{
   if(browser)await browser.close();
   await new Promise(r=>server.close(r));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
