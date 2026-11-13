/* Isolated real Realtime rooms, disposable anonymous users, simulated GPS.
   Run through check-stops-live.py; credentials arrive only on stdin. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),backend='https://aqbyxpiwugcvoephsvpm.supabase.co',run='stop-qa-'+crypto.randomUUID();
const source=JSON.parse(fs.readFileSync(path.join(root,'special-events/data/austin-studio-tour-2026.geojson'),'utf8'));
const stop=n=>source.features.find(f=>f.properties.number===n),room=n=>`event-${run}-stop-${stop(n).properties.id}`;
const output=process.env.STOP_SCREENSHOTS||path.join(require('node:os').tmpdir(),'austin-studio-stops');
let browser,server,admin;const users=new Set(),errors=[],blocked=[],devices=[];
const pass=s=>console.log('PASS '+s);
async function serve(){
  const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
  server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,body)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(body);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`;
}
async function peers(d,n){await d.f.waitForFunction(n=>ChatEngine.people().filter(p=>!p.self).length===n,n);}
async function visible(d){await d.f.locator('#visibleBtn').click();await d.f.waitForFunction(()=>ChatEngine.room);}
async function send(d,text){if(!await d.f.evaluate(()=>ChatPanel.isOpen()))await d.f.locator('#chatBtn').click();await d.f.locator('#chatText').fill(text);await d.f.locator('#chatSend').click();}
async function receive(d,text){await d.f.waitForFunction(text=>document.getElementById('chatLines').textContent.includes(text),text);}
(async()=>{try{
  ({admin}=JSON.parse(fs.readFileSync(0,'utf8')));assert.ok(admin,'No cleanup credential');
  const base=process.argv[2]||await serve();fs.mkdirSync(output,{recursive:true});
  browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  async function device(number,width=390,tour=false){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
    await context.addInitScript(point=>{
      let sample={coords:{longitude:point[0],latitude:point[1],accuracy:5},timestamp:Date.now()};
      Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(success,error,options){window.gpsOptions=options;window.qaGPS=(point,accuracy=5,age=0)=>{sample={coords:{longitude:point[0],latitude:point[1],accuracy},timestamp:Date.now()-age};success(sample);};window.qaGPSError=()=>error({code:1});queueMicrotask(()=>success({...sample,timestamp:Date.now()}));return 1;},clearWatch(){},getCurrentPosition(success){success({...sample,timestamp:Date.now()});}}});
    },stop(number).geometry.coordinates);
    await context.route('**/special-events/model.js?*',async route=>{
      const response=await route.fetch(),original=await response.text();
      assert.ok(original.includes('event-${event.id}-stop-'),'Room isolation hook must exist');
      await route.fulfill({response,body:original.replace('event-${event.id}-stop-','event-'+run+'-stop-')});
    });
    await context.route(backend+'/**',async route=>{
      const p=new URL(route.request().url()).pathname;
      if(p==='/auth/v1/signup'){const response=await route.fetch(),data=await response.json();if(data.user?.is_anonymous)users.add(data.user.id);assert.equal(response.status(),200);assert.ok(data.user?.is_anonymous);return route.fulfill({response});}
      if(p.startsWith('/auth/v1/')||p.startsWith('/realtime/'))return route.continue();
      if(p==='/rest/v1/messages'){blocked.push(p);return route.abort();}
      if(p==='/rest/v1/rpc/profile_display')return route.fulfill({json:null});
      if(p==='/rest/v1/rpc/membership_read')return route.fulfill({json:{plan:'free',status:'none'}});
      return route.fulfill({status:400,json:{message:'Unrelated request blocked in stop chat check'}});
    });
    const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
    const d={page,context,tour};devices.push(d);await navigate(d,number);return d;
  }
  async function navigate(d,number){
    await d.page.goto(base+(d.tour?'/maps/austin-studio-tour/':`/maps/austin-studio-tour/stops/${number}/`));
    d.f=d.tour?await(await d.page.locator('#app-window').elementHandle()).contentFrame():d.page;
    if(d.tour){await d.f.waitForFunction(()=>ChatRoom.room);await d.f.locator('#ctrlChat').click();}
    else{
      await d.f.waitForFunction(()=>window.StudioStopMap?.getLayer('stop-zone-line'));
      assert.equal(await d.f.evaluate(()=>window.qaGPS===undefined),true,'GPS waits for visitor action');
      await d.page.screenshot({path:path.join(output,`stop-${number}-${d.page.viewportSize().width}.png`)});
      await d.f.locator('#stop-gps').click();await d.f.waitForFunction(()=>window.qaGPS);
      await d.f.evaluate(point=>qaGPS(point),stop(number).geometry.coordinates);await d.f.waitForFunction(()=>ChatRoom.room);
      assert.equal(await d.f.evaluate(()=>gpsOptions.enableHighAccuracy),true);
      assert.ok(await d.f.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    }
    assert.equal(await d.f.evaluate(()=>ChatEngine.room),null,'Visitor starts hidden');
    assert.ok((await d.f.evaluate(()=>ChatRoom.room.properties.id)).includes(run),'Only isolated test rooms may be joined');
  }
  const a=await device(47,1280,true),b=await device(47),c=await device(233,1280);
  await visible(a);await visible(b);await visible(c);await peers(a,1);await peers(b,1);await peers(c,0);
  assert.equal(await b.f.locator('#stop-members li').count(),2);assert.equal(await c.f.locator('#stop-members li').count(),1);
  pass('Stop 47 page and full tour see each other; adjacent stop 233 stays separate.');
  await send(a,'QA: full tour to studio page');await receive(b,'QA: full tour to studio page');
  await send(b,'QA: studio page to full tour');await receive(a,'QA: studio page to full tour');
  assert.equal(await c.f.locator('#chatLines').innerText(),'');
  await b.page.screenshot({path:path.join(output,'stop-47-live-chat-phone.png')});
  pass('Real broadcasts deliver both ways without reading or writing saved messages.');
  await c.f.evaluate(point=>qaGPS(point),stop(47).geometry.coordinates);await c.f.waitForFunction(()=>ChatEngine.room===null);
  await peers(a,1);pass('A stop-specific page cannot silently join another studio’s room.');
  await b.f.evaluate(()=>qaGPSError());await b.f.waitForFunction(()=>ChatEngine.room===null);await peers(a,0);
  assert.equal(await b.f.locator('#chatLines').innerText(),'');assert.ok(await b.f.locator('#chatBtn').isDisabled());
  await b.f.evaluate(point=>qaGPS(point,100),stop(47).geometry.coordinates);assert.equal(await b.f.evaluate(()=>ChatEngine.room),null);
  await b.f.evaluate(point=>qaGPS(point,5,70000),stop(47).geometry.coordinates);assert.equal(await b.f.evaluate(()=>ChatEngine.room),null);
  await b.f.evaluate(point=>qaGPS(point),stop(47).geometry.coordinates);await peers(a,1);
  pass('Denied, inaccurate and stale GPS disconnect chat; a fresh fix rejoins.');
  await b.f.locator('.stop-share summary').click();const download= b.page.waitForEvent('download');await b.f.getByRole('link',{name:'Download QR (PNG)'}).click();assert.ok((await download).suggestedFilename().endsWith('.png'));
  await navigate(b,1);await visible(b);await a.f.evaluate(point=>qaGPS(point),stop(1).geometry.coordinates);await peers(a,1);await peers(b,1);
  await send(a,'QA: second studio');await receive(b,'QA: second studio');
  assert.equal(await b.f.evaluate(()=>ChatEngine.room),room(1));pass('Second location, stop 1, connects to its own full-tour room.');
  await b.page.evaluate(()=>{Date.now=()=>Date.parse('2026-11-25T04:00:01Z');document.dispatchEvent(new Event('visibilitychange'));});
  await b.f.waitForFunction(()=>ChatEngine.room===null);assert.ok(await b.f.locator('#stop-active').isHidden());assert.ok(await b.f.locator('#stop-expired').isVisible());await peers(a,0);
  pass('An already-open page closes and leaves the room at event retirement.');
  await b.page.goto(base+'/maps/austin-studio-tour/stops/');await b.page.locator('#stop-search').fill('4700 Grover');assert.equal(await b.page.locator('#stop-directory li:visible').count(),2);
  await b.page.screenshot({path:path.join(output,'directory-phone.png')});
  await b.page.evaluate(()=>{Date.now=()=>Date.parse('2026-11-25T04:00:01Z');document.dispatchEvent(new Event('visibilitychange'));});assert.ok(await b.page.locator('#stop-active').isHidden());
  assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);pass('Search, PNG download, mobile layout and directory retirement pass; no page errors.');
}catch(e){console.error(e.message);console.log('Page errors:',JSON.stringify(errors));for(const d of devices){try{console.log(JSON.stringify(await d.f.evaluate(()=>({url:location.pathname,error:document.getElementById('map-error')?.textContent,status:document.getElementById('roomLine')?.textContent,room:window.ChatEngine?.room,peers:window.ChatEngine?.people().length}))));}catch(_){}}process.exitCode=1;}finally{
  await browser?.close();if(server)await new Promise(r=>server.close(r));
  let removed=0;for(const id of users){try{const r=await fetch(backend+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:{apikey:admin,Authorization:'Bearer '+admin}});if(r.ok)removed++;else process.exitCode=1;}catch(_){process.exitCode=1;}}
  console.log(`Removed ${removed}/${users.size} disposable guests. Screenshots: ${output}`);
}})();
