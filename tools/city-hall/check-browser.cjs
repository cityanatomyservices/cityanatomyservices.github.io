/* Main-page integration using real city records. Account requests are blocked. */
const {chromium} = require('../video/node_modules/playwright-core');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const root = path.resolve(__dirname, '../..');
let browser, server;
async function serve() {
  const types = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
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
async function openCity(f){
  if(await f.locator('#explore-panel').isHidden())await f.locator('#ctrlExplore').click();
  if(await f.locator('#city-hall-panel').isHidden())await f.locator('#ctrlCityHall').click();
}
(async () => { try {
  const base=process.argv[2]||await serve(),dates=require('../../chat/explore/model.js'),today=dates.dayKey(Date.now());
  const shift=n=>new Date(Date.parse(today+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const instant=(n,h=12)=>new Date(dates.dateWindow({when:'date',date:shift(n)})[0]+h*3600000).toISOString();
  const row=(id,category,n,extra={})=>({id,title:id,category,source:category,url:'https://www.austintexas.gov/events/'+id,date:instant(n),dateOnly:false,expires:new Date(Date.now()+86400000).toISOString(),scope:'citywide',districts:[],board:'City Council',...extra});
  const records=[row('Tomorrow meeting','meetings',1),row('Later meeting','meetings',3),row('Unknown time meeting','meetings',1,{dateOnly:true,date:instant(1,0)}),row('Recent city news','announcements',-2),row('Older city news','announcements',-15),row('New site plan','development',-1),row('Older site plan','development',-20),...Array.from({length:65},(_,i)=>row('Permit '+String(i).padStart(2,'0'),'permits',-i%6,{dateOnly:true,scope:'district',districts:[String(i%2+1)]}))];
  const snapshot={version:1,generated:new Date().toISOString(),records,sources:['meetings','announcements','permits','development'].map(id=>({id,category:id,title:id,url:'https://www.austintexas.gov/news',checked:new Date().toISOString(),ok:true}))};
  browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
    await context.route('https://*.supabase.co/**',r=>r.fulfill({status:400,json:{message:'Fixture: no production account access'}}));
    let fail=true,expired=false,requests=0;
    await context.route('**/chat/data/city-hall.json',r=>{requests++;if(fail){fail=false;return r.fulfill({status:503,body:'Unavailable'});}return r.fulfill({json:expired?{...snapshot,records:records.map(r=>({...r,expires:'2000-01-01T00:00:00Z'}))}:snapshot});});
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);let f=await ready(page);
    assert.deepEqual(await f.locator('#stack > button').evaluateAll(bs=>bs.map(b=>b.id)),['ctrlExplore','ctrlDayPlan','ctrlChat']);
    assert.equal(requests,0);await openCity(f);await f.locator('.city-hall-status').filter({hasText:'unavailable'}).waitFor();await f.locator('.city-hall-retry').click();
    await f.waitForFunction(()=>document.querySelectorAll('.city-hall-result').length===3);
    assert.equal(await f.locator('#city-hall-panel [data-filter=category] option').count(),4);
    await f.locator('[data-filter=board]').selectOption('City Council');await f.locator('[data-filter=district]').selectOption('1');assert.equal(await f.locator('.city-hall-result').count(),3);
    await f.locator('[data-filter=board]').selectOption('');await f.locator('[data-filter=district]').selectOption('');
    await f.locator('#city-hall-panel [data-filter=query]').fill('no such meeting');assert.equal(await f.locator('.city-hall-result').count(),0);await f.locator('#city-hall-panel [data-filter=query]').fill('');
    await f.locator('[data-filter=date]').fill(shift(1));assert.equal(await f.locator('.city-hall-result').count(),2);
    await f.locator('[data-when=week]').click();assert.equal(await f.locator('.city-hall-result').count(),3);assert.equal(await f.locator('[data-filter=date]').inputValue(),'');
    await f.locator('#city-hall-panel [data-filter=category]').selectOption('announcements');assert.equal(await f.locator('.city-hall-result').count(),1);
    await f.locator('[data-filter=when]').selectOption('all');assert.equal(await f.locator('.city-hall-result').count(),2);
    await f.locator('#city-hall-panel [data-filter=sort]').selectOption('asc');assert.match(await f.locator('.city-hall-result').first().innerText(),/Older city news/);
    await f.locator('#city-hall-panel [data-filter=sort]').selectOption('desc');assert.match(await f.locator('.city-hall-result').first().innerText(),/Recent city news/);
    await f.locator('[data-filter=date]').fill(shift(-15));assert.equal(await f.locator('.city-hall-result').count(),1);assert.match(await f.locator('.city-hall-result').innerText(),/Older city news/);
    await f.locator('[data-when=week]').click();
    for(const category of ['permits','development']){
      await f.locator('#city-hall-panel [data-filter=category]').selectOption(category);assert.ok(await f.locator('.city-hall-result').count()>0);assert.equal(await f.locator('.city-hall-board').isHidden(),true);
      if(category==='permits'){assert.equal(await f.locator('.city-hall-result').count(),30);await f.locator('.city-hall-more').click();assert.equal(await f.locator('.city-hall-result').count(),60);await f.locator('[data-filter=district]').selectOption('1');assert.ok(!(await f.locator('.city-hall-meta').allTextContents()).some(t=>t.includes('District 2')));await f.locator('[data-filter=district]').selectOption('');}
    }
    await f.locator('#city-hall-panel [data-filter=category]').selectOption('meetings');
    for(const a of await f.locator('.city-hall-result a').evaluateAll(as=>as.map(a=>({url:a.href,target:a.target})))){assert.equal(a.target,'_blank');assert.equal(new URL(a.url).hostname,'www.austintexas.gov');}
    const bounds=await f.locator('#explore-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.height<900);
    await f.locator('.explore-scroll').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'/tmp/city-hall-meetings-'+width+'.png'});
    await f.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:'/tmp/city-hall-dark-'+width+'.png'});
    await f.locator('#explore-panel .explore-close').press('Escape');assert.equal(await f.locator('#city-hall-panel').isHidden(),true);assert.equal(await f.locator('#ctrlExplore').evaluate(el=>el===document.activeElement),true);
    for(const [control,panel] of [['ctrlDayPlan','plan-panel'],['ctrlChat','legend'],['ctrlMapLayers','map-layers-panel']]){
      await openCity(f);await f.locator('#explore-panel .explore-close').click();await f.locator('#'+control).click();assert.equal(await f.locator('#'+panel).isVisible(),true);await openCity(f);assert.equal(await f.locator('#'+panel).isHidden(),true);
    }
    await f.locator('#ctrlProApps').click();assert.equal(await f.locator('#city-hall-panel').isHidden(),true);assert.equal(await f.locator('#pro-apps-panel').isVisible(),true);
    await f.locator('#ctrlClassifieds').click();assert.equal(await f.locator('#pro-apps-panel').isHidden(),true);assert.equal(await f.locator('#city-hall-panel').isHidden(),true);assert.equal(await f.locator('#classifieds-panel').isVisible(),true);
    await f.locator('#ctrlCityHall').click();assert.equal(await f.locator('#classifieds-panel').isHidden(),true);assert.equal(await f.locator('#city-hall-panel').isVisible(),true);
    await f.locator('[data-layer=movies]').check();assert.equal(await f.locator('#city-hall-panel').isHidden(),true);assert.equal(await f.locator('.explore-event-content').isVisible(),true);
    expired=true;await page.reload();f=await ready(page);assert.equal(await f.locator('#city-hall-panel').isHidden(),true);await openCity(f);await f.locator('.city-hall-status').filter({hasText:'0 upcoming meetings'}).waitFor();assert.equal(await f.locator('.city-hall-result').count(),0);
    assert.deepEqual(errors,[]);await context.close();console.log(width+'px: City Hall inside Explore, dropdowns, date windows/sort, retries, pagination, safe links, focus, exclusivity, expired data and layout passed.');
  }
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
