/* Real downloads and map-link navigation, with no production account writes. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),crypto=require('node:crypto');
const M=require('../../planner/model.js'),Sources=require('../../planner/sources.js'),root=path.resolve(__dirname,'../..');
let browser,server;
async function serve(){
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
 server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;
}
function book(){
 const p=M.empty(crypto.randomUUID()),date=M.nextDay(p.date),tomorrow=M.nextDay(date);p.date=date;p.days=[date,tomorrow];p.daySettings={[date]:{name:'Austin visits',bufferMinutes:20},[tomorrow]:{name:'Tomorrow',bufferMinutes:20}};
 p.items=Array.from({length:7},(_,i)=>{
  const s=Sources.item({key:'export-'+i,title:i===6?'Meeting without a map location':i===5?'Untimed stop':`Visit ${i+1} · Café 🦊`,kind:'place',timing:'unknown',coordinates:i===6?null:[-97.74+i*.001,30.27+i*.001],address:'Austin, TX',url:'https://example.invalid/visit'},crypto.randomUUID());
  s.day=date;s.schedule.start=i===5?null:M.timeOnDay(date,`${String(9+i).padStart(2,'0')}:00`);s.schedule.duration=45;s.schedule.durationConfirmed=true;s.schedule.note='Notes, punctuation; and café 🦊';return s;
 });
 const other=Sources.item({key:'tomorrow-only',title:'Tomorrow only',kind:'place',timing:'unknown',coordinates:[-97.75,30.28]},crypto.randomUUID());other.day=tomorrow;other.schedule.start=M.timeOnDay(tomorrow,'10:00');p.items.push(other);
 assert.ok(M.valid(p));return p;
}
async function download(page,f,name){
 const wait=page.waitForEvent('download');await f.locator('#export-action').click();const file=await wait;
 assert.match(file.suggestedFilename(),/^austin-day-\d{4}-\d{2}-\d{2}\.ics$/);
 await file.saveAs('/tmp/'+name+'.ics');return fs.readFileSync(await file.path(),'utf8').replace(/\r\n[ \t]/g,'');
}
(async()=>{try{
 const base=process.argv[2]||await serve();
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(os.homedir(),'.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500}),p=book(),id=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+3600,enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  await context.route('https://*.supabase.co/**',route=>{
   if(new URL(route.request().url()).pathname==='/auth/v1/signup')return route.fulfill({json:{access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,exp,role:'authenticated',is_anonymous:true})+'.fixture',refresh_token:crypto.randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user:{id,is_anonymous:true,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}}});
   return route.fulfill({status:400,json:{message:'Production account requests are blocked in this check'}});
  });
  await context.route(/^https:\/\/(www\.google\.com\/maps\/dir\/|maps\.apple\.com\/directions)/,route=>route.fulfill({contentType:'text/html',body:'<title>Export destination fixture</title>Route link received'}));
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/myplanmap/');const f=await(await page.locator('#app-window').elementHandle()).contentFrame();
  await f.waitForFunction(()=>window.PlanExport&&window.PlanStore);await f.evaluate(()=>PlanStore.ready());await f.evaluate(p=>PlanStore.restore(p),p);
  assert.equal(await f.locator('h1').textContent(),'Austin day Planner');assert.equal(await page.title(),'Austin day Planner · Austin.Chat');
  const before=await f.evaluate(()=>JSON.stringify(PlanStore.book));
  await f.locator('#export-plan').click();assert.equal(await f.locator('#export-dialog').evaluate(d=>d.open),true);
  assert.equal(await f.locator('[name=export-format]:checked').count(),1);assert.equal(await f.locator('[name=export-format]:checked').inputValue(),'google-calendar');
  assert.match(await f.locator('#export-summary').textContent(),/^6 scheduled visits/);
  assert.match(await f.locator('#export-skipped').textContent(),/Untimed stop/);
  const google=await download(page,f,`austin-export-${width}-google`);assert.equal((google.match(/BEGIN:VEVENT/g)||[]).length,6);assert.ok(!google.includes('Tomorrow only'));assert.ok(google.includes('Notes\\, punctuation\\; and café 🦊'));
  assert.equal(await f.locator('#export-dialog').evaluate(d=>d.open),true);
  await f.locator('[value=apple-calendar]').check();assert.equal(await f.locator('[name=export-format]:checked').count(),1);
  const apple=await download(page,f,`austin-export-${width}-apple`);assert.equal(apple.replace(/^DTSTAMP:.*\r\n/gm,''),google.replace(/^DTSTAMP:.*\r\n/gm,''));
  const bounds=await f.locator('#export-dialog').evaluate(d=>{const b=d.getBoundingClientRect();return {fits:b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,overflow:d.scrollWidth>d.clientWidth};});assert.equal(bounds.fits,true);assert.equal(bounds.overflow,false);
  await page.screenshot({path:`/tmp/austin-export-calendar-${width}.png`});
  await f.locator('[value=google-maps]').check();assert.equal(await f.locator('[name=export-format]:checked').count(),1);
  assert.match(await f.locator('#export-summary').textContent(),/^6 located stops/);assert.match(await f.locator('#export-skipped').textContent(),/Meeting without a map location/);
  await f.locator('#export-action').click();assert.equal(await f.locator('#export-results a').count(),2);
  const urls=await f.locator('#export-results a').evaluateAll(links=>links.map(a=>a.href));assert.equal(new URL(urls[0]).searchParams.get('waypoints').split('|').length,3);
  let opened=page.waitForEvent('popup');await f.locator('#export-results a').first().click();let popup=await opened;await popup.waitForLoadState();assert.equal(popup.url(),urls[0]);await popup.close();
  await f.locator('[value=apple-maps]').check();assert.equal(await f.locator('#export-results a').count(),0);assert.equal(await f.locator('[name=export-format]:checked').count(),1);
  await f.locator('#export-action').click();assert.equal(await f.locator('#export-results a').count(),1);
  const appleUrl=await f.locator('#export-results a').getAttribute('href');assert.equal(new URL(appleUrl).searchParams.getAll('waypoint').length,4);
  opened=page.waitForEvent('popup');await f.locator('#export-results a').click();popup=await opened;await popup.waitForLoadState();assert.equal(popup.url(),appleUrl);await popup.close();
  assert.equal(await f.evaluate(()=>JSON.stringify(PlanStore.book)),before,'exports never edit the itinerary');
  await page.locator('.theme-toggle').click();await f.locator('#export-dialog').evaluate(d=>d.scrollTop=0);await page.screenshot({path:`/tmp/austin-export-maps-dark-${width}.png`});
  await f.locator('#export-dialog').press('Escape');await f.waitForFunction(()=>!document.querySelector('#export-dialog').open&&document.activeElement.id==='export-plan');
  await f.locator('#plan-day').selectOption(p.days[1]);await f.locator('#export-plan').click();await f.locator('[value=google-calendar]').check();
  const tomorrow=await download(page,f,`austin-export-${width}-tomorrow`);assert.equal((tomorrow.match(/BEGIN:VEVENT/g)||[]).length,1);assert.ok(tomorrow.includes('Tomorrow only'));
  // Changing the day while open (for example through a synced edit) cannot
  // leave the prior day's export results or download active.
  await f.evaluate(day=>PlanStore.chooseDay(day),M.nextDay(p.days[1]));assert.equal(await f.locator('#export-action').isDisabled(),true);assert.equal(await f.locator('#export-results a').count(),0);
  await f.locator('[value=apple-maps]').check();assert.equal(await f.locator('#export-action').isDisabled(),true);
  await f.locator('#export-close').click();await f.locator('#plan-day').selectOption(p.date);
  await f.evaluate(()=>PlanStore.edit(plan=>{plan.items[0].schedule.duration=37;}));
  await f.locator('#export-plan').click();await f.locator('[value=apple-calendar]').check();
  const edited=await download(page,f,`austin-export-${width}-edited`);const end=new Date(Date.parse(p.items[0].schedule.start)+37*60000).toISOString().replace(/[-:]/g,'').replace('.000','');assert.ok(edited.includes('DTEND:'+end));
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}px: rename, exclusive choices, repeated ICS downloads, route links, limits, day isolation, edits, empty days, themes and dialog accessibility passed.`);
 }
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}})().catch(error=>{console.error(error.stack);process.exitCode=1;});
