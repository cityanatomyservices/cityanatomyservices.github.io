/* Main-page integration using real city records. Account requests are blocked. */
const {chromium} = require('../video/node_modules/playwright-core');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const root = path.resolve(__dirname, '../..');
let browser, server;
async function serve() {
  const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
  server = http.createServer((req,res) => {
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => { if (err) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(data); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
async function ready(page) {
  const frame = await (await page.locator('#app-window').elementHandle()).contentFrame();
  await frame.waitForFunction(() => window.chatMap && window.austinExplore && window.AustinCityHall?.close, {}, {timeout:45000});
  return frame;
}
(async () => { try {
  const base = process.argv[2] || await serve();
  browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || path.join(os.homedir(),'.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for (const width of [1280,390]) {
    const context = await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
    await context.route('https://*.supabase.co/**', route => route.fulfill({status:400,json:{message:'No production account access in this check'}}));
    const page = await context.newPage(), errors = [], cityRequests = [];
    page.setDefaultTimeout(30000); page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().includes('/chat/data/city-hall.json')) cityRequests.push(r.url()); });
    await page.goto(base); let f = await ready(page);
    assert.deepEqual(await f.locator('#stack > button').evaluateAll(bs=>bs.map(b=>b.id)), ['ctrlExplore','ctrlDayPlan','ctrlChat','ctrlCityHall','ctrlApps','ctrlLocate','ctrlMapLayers']);
    assert.equal(cityRequests.length,0,'City Hall data loads only on opening');
    // A failed request is explicit and retryable.
    await context.route('**/chat/data/city-hall.json', route => route.fulfill({status:503,body:'Unavailable'}), {times:1});
    await f.locator('#ctrlCityHall').click();
    await f.locator('.city-hall-status').filter({hasText:'unavailable'}).waitFor();
    await f.locator('.city-hall-retry').click();
    await f.waitForFunction(()=>document.querySelector('[data-category=meetings] .explore-tile-count').textContent !== '');
    assert.equal(await f.locator('.city-hall-tile').count(),4);
    await f.locator('[data-category=meetings]').click();
    const meetingCount = await f.locator('.city-hall-result').count(); assert.ok(meetingCount > 0);
    const board = await f.locator('[data-filter=board] option').nth(1).getAttribute('value');
    await f.locator('[data-filter=board]').selectOption(board);
    assert.ok(await f.locator('.city-hall-result').count() > 0);
    assert.ok((await f.locator('.city-hall-meta').allTextContents()).some(t=>t.includes(board)));
    await f.locator('[data-filter=district]').selectOption('1');
    assert.ok(await f.locator('.city-hall-result').count()>0,'Citywide meetings remain visible by district');
    await f.locator('[data-filter=board]').selectOption('');
    await f.locator('[data-filter=district]').selectOption('');
    await f.locator('#city-hall-panel [data-filter=query]').fill('no such city meeting xyz');
    assert.equal(await f.locator('.city-hall-result').count(),0);
    await f.locator('#city-hall-panel [data-filter=query]').fill('');
    assert.equal(await f.locator('.city-hall-result').count(),meetingCount);
    const cityBounds = await f.locator('#city-hall-panel').boundingBox();
    assert.ok(cityBounds.x>=0 && cityBounds.x+cityBounds.width<=width && cityBounds.height<900);
    await page.screenshot({path:`/tmp/city-hall-meetings-${width}.png`});
    for (const category of ['announcements','permits','development']) {
      await f.locator(`[data-category=${category}]`).click();
      assert.ok(await f.locator('.city-hall-result').count()>0,`${category} has city records`);
      assert.equal(await f.locator('.city-hall-board').isHidden(),true);
      for (const link of await f.locator('.city-hall-result a').evaluateAll(as=>as.map(a=>({url:a.href,target:a.target})))) {
        assert.equal(link.target,'_blank'); assert.match(new URL(link.url).hostname,/(^|\.)austintexas\.gov$/);
      }
      if (category === 'permits') {
        assert.equal(await f.locator('.city-hall-result').count(),30);
        await f.locator('.city-hall-more').click(); assert.equal(await f.locator('.city-hall-result').count(),60);
        await f.locator('[data-filter=district]').selectOption('1');
        const meta = await f.locator('.city-hall-meta').allTextContents();
        assert.ok(meta.some(t=>t.includes('District 1'))); assert.ok(!meta.some(t=>/District (?:[2-9]|10)(?: ·|$)/.test(t)));
        await f.locator('[data-filter=district]').selectOption('');
      }
    }
    await f.locator('[data-category=meetings]').click();
    await f.evaluate(()=>document.documentElement.dataset.theme='dark');
    await page.screenshot({path:`/tmp/city-hall-dark-${width}.png`});
    await f.locator('#city-hall-panel .explore-close').press('Escape');
    assert.equal(await f.locator('#city-hall-panel').isHidden(),true);
    assert.equal(await f.locator('#ctrlCityHall').evaluate(el=>el===document.activeElement),true);
    for (const [control,panel] of [['ctrlExplore','explore-panel'],['ctrlDayPlan','day-plan-panel'],['ctrlChat','legend'],['ctrlApps','apps-panel'],['ctrlMapLayers','map-layers-panel']]) {
      await f.locator('#'+control).click();
      // Phone panels cover the stack. Dispatch exercises the same capture and
      // button listeners; the visible close buttons are checked separately.
      await f.locator('#ctrlCityHall').dispatchEvent('click');
      assert.equal(await f.locator('#'+panel).isHidden(),true);
      assert.equal(await f.locator('#city-hall-panel').isVisible(),true);
      await f.locator('#'+control).dispatchEvent('click');
      assert.equal(await f.locator('#city-hall-panel').isHidden(),true);
      assert.equal(await f.locator('#'+panel).isVisible(),true);
      await f.locator('#'+control).dispatchEvent('click');
    }
    await page.reload(); f = await ready(page);
    assert.equal(await f.locator('#city-hall-panel').isHidden(),true);
    await f.locator('#ctrlCityHall').click();
    assert.equal(await f.locator('.city-hall-tile[aria-pressed=true]').count(),0);
    // Expired meetings must never be advertised as current.
    await f.locator('#city-hall-panel .explore-close').click();
    const snapshot = JSON.parse(fs.readFileSync(path.join(root,'chat/data/city-hall.json')));
    snapshot.records.forEach(r=>{r.expires='2000-01-01T00:00:00Z';});
    await context.route('**/chat/data/city-hall.json',route=>route.fulfill({json:snapshot}),{times:1});
    await page.reload(); f=await ready(page); await f.locator('#ctrlCityHall').click();
    await f.waitForFunction(()=>document.querySelector('[data-category=meetings] .explore-tile-count').textContent==='0');
    await f.locator('[data-category=meetings]').click();assert.equal(await f.locator('.city-hall-result').count(),0);
    assert.deepEqual(errors,[]);
    await page.goto(base+'/apps/austin-pizza/');
    const catalog=await(await page.locator('#app-window').elementHandle()).contentFrame();await catalog.locator('[data-map-ui-ready=true]').waitFor();
    assert.equal(await catalog.locator('#ctrlCityHall,#city-hall-panel').count(),0);
    console.log(`${width}px: City Hall placement, lazy load/retry, four categories, filters, pagination, links, layout, exclusive panels, focus, refresh, expiration and catalog isolation passed.`);
    await context.close();
  }
} finally { if(browser)await browser.close(); if(server)await new Promise(resolve=>server.close(resolve)); }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
