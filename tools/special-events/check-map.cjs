/* Real MapLibre + planner UI; all account, routing and chat traffic is mocked. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');let browser,server;
async function serve(){const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,body)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(body);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`;}
function session(member){const id=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+3600,enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return {access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,exp,role:'authenticated',is_anonymous:!member})+'.fixture',refresh_token:crypto.randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user:{id,is_anonymous:!member,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}};}
(async()=>{try{
 const base=process.argv[2]||await serve(),screenshots=process.env.EVENT_SCREENSHOTS||path.join(require('node:os').tmpdir(),'austin-special-events');fs.mkdirSync(screenshots,{recursive:true});
 browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const width of [1280,390])for(const member of [false,true]){
  const active=session(member),context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});let remote=null;const saves=[];
  await context.addInitScript(({member,active})=>{
   if(member&&!localStorage.getItem('event-fixture-seeded')){localStorage.setItem('event-fixture-seeded','yes');localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(active));}
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition:(success,error)=>{window.gps=pt=>success({coords:{longitude:pt[0],latitude:pt[1]}});window.gpsError=error;return 1;},clearWatch(){},getCurrentPosition:success=>success({coords:{longitude:-97.7431,latitude:30.2672}})}});
   let identity;window.testChannels=[];window.testMessages=[];
   Object.defineProperty(window,'ChatIdentity',{configurable:true,get:()=>identity,set:value=>{const original=value.client;value.client=()=>new Proxy(original(),{get(target,key){if(key==='channel')return name=>{let sync;const c={state:{},on(type,filter,fn){if(type==='presence')sync=fn;return this;},subscribe(fn){queueMicrotask(()=>fn('SUBSCRIBED'));},presenceState(){return this.state;},track:async person=>{c.state[person.handle]=[person];sync?.();},untrack:async()=>{c.state={};sync?.();},send:async msg=>{window.testMessages.push(msg.payload);}};window.testChannels.push(name);return c;};if(key==='removeChannel')return async()=>{};const property=Reflect.get(target,key);return typeof property==='function'?property.bind(target):property;}});identity=value;}});
  },{member,active});
  await context.route('https://*.supabase.co/**',route=>{const p=new URL(route.request().url()).pathname,body=route.request().postDataJSON();
   if(p==='/auth/v1/signup'||p==='/auth/v1/token')return route.fulfill({json:active});if(p==='/auth/v1/user')return route.fulfill({json:active.user});
   if(p==='/rest/v1/rpc/member_load')return route.fulfill({json:{profile:{handle:'Fixture',emoji:'ðŸŽ¨',show_avatar:false},favorites:[],preferences:{},progress:[]}});
   if(p==='/rest/v1/rpc/planner_load')return route.fulfill({json:remote});
   if(p==='/rest/v1/rpc/planner_save'){saves.push(body);remote={plan:{id:body.p_id,...body.p_settings,items:body.p_items},revision:(remote?.revision||0)+1,dirty:false};return route.fulfill({json:{revision:remote.revision}});}
   if(p==='/rest/v1/rpc/planner_routing_status')return route.fulfill({json:{status:'ready',networkVersion:2}});
   if(p==='/rest/v1/rpc/planner_route_leg')return route.fulfill({json:{status:'ready',driveMinutes:6,accessMinutes:1,distanceMeters:1600,networkVersion:2,geometry:{type:'LineString',coordinates:[body.p_from,body.p_to]}}});
   if(p==='/rest/v1/messages')return route.fulfill({json:[]});
   return route.fulfill({status:400,json:{message:'Production requests blocked in event test: '+p}});
  });
  // Directory comes from this checkout, not the live fallback.
  await context.route('https://raw.githubusercontent.com/**',r=>r.abort());
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
  await page.goto(base+'/maps/austin-studio-tour/');const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(()=>window.chatMap&&window.AustinEvent?.data&&window.gps);await f.evaluate(()=>PlanStore.ready());
  assert.deepEqual(await f.locator('#stack > button').evaluateAll(bs=>bs.map(b=>b.id)),['ctrlStops','ctrlDayPlan','ctrlChat']);assert.equal(await f.locator('#ctrlExplore').count(),0);
  assert.equal(await f.locator('#event-date option').count(),4);assert.equal(await f.locator('#event-panel').isVisible(),true);
  assert.equal(await f.evaluate(async()=>(await chatMap.getSource('event-stops').getData()).features.length),307);
  await f.locator('#event-search').fill('Canopy');assert.ok(await f.locator('#event-results > li').count()>0);await f.locator('#event-search').fill('');
  await f.locator('#event-results .plan-select input').nth(0).check();await f.locator('#event-results .plan-select input').nth(1).check();
  assert.equal(await f.evaluate(()=>PlanStore.plan.date),'2026-11-14');assert.equal(await f.evaluate(()=>PlanStore.plan.items.length),2);
  await f.evaluate(()=>{const scroll=document.querySelector('.event-scroll');if(scroll)scroll.scrollTop=0;});await page.screenshot({path:path.join(screenshots,`${width}-${member?'member':'guest'}-stops.png`)});
  await f.locator('#event-close').click();await f.locator('#ctrlDayPlan').click();await f.locator('#build-day').click();
  await f.waitForFunction(()=>PlanStore.plan.items.every(i=>i.schedule.start));assert.equal(await f.locator('.map-stop').count(),2);
  assert.equal(await f.evaluate(async()=>(await chatMap.getSource('event-stops').getData()).features.length),0);
  await f.locator('#plan-route').click();await f.waitForFunction(()=>chatMap.getLayer('planner-route-lines')&&chatMap.queryRenderedFeatures({layers:['planner-route-lines']}).length>0);
  if(await f.locator('#plan-panel').isHidden())await f.locator('#planner-map-edit').click();await f.locator('#export-plan').click();const downloadPromise=page.waitForEvent('download');await f.locator('#export-action').click();const download=await downloadPromise;const text=fs.readFileSync(await download.path(),'utf8');assert.match(text,/DTSTART:20261114T170000Z/);assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,2);
  for(const format of ['google-maps','apple-maps']){await f.locator(`[name=export-format][value=${format}]`).check();await f.locator('#export-action').click();assert.ok(await f.locator('#export-results a').count()>0);}
  await f.locator('#export-close').click();await f.locator('[data-plan-explore]').first().click();
  await f.locator('#event-date').selectOption('2026-11-21');await f.locator('#event-results .plan-select input').nth(0).check();assert.equal(await f.evaluate(()=>PlanStore.plan.items.length),1);
  await f.locator('#event-date').selectOption('2026-11-14');assert.equal(await f.locator('#event-results .plan-select input:checked').count(),2);
  await f.locator('#event-close').click();await f.locator('#ctrlChat').click();await f.evaluate(()=>gps([-97.7431,30.2672]));
  await f.waitForFunction(()=>ChatEngine.room==='event-austin-studio-tour-2026'&&document.querySelectorAll('#placeList .plan-select').length>0);
  const before=await f.evaluate(()=>({neighborhood:ChatRoom.neighborhood.properties.id,channels:testChannels.length}));
  await f.locator('#visibleBtn').click();await f.locator('#chatBtn').click();await f.locator('#chatText').fill('Event chat fixture');await f.locator('#chatSend').click();assert.equal(await f.evaluate(()=>testMessages.at(-1).room),'event-austin-studio-tour-2026');await f.locator('#chatClose').click();
  await f.evaluate(()=>gps([-97.73,30.307]));await f.waitForFunction(id=>ChatRoom.neighborhood?.properties.id!==id&&document.querySelectorAll('#placeList .plan-select').length>0,before.neighborhood);
  assert.equal(await f.evaluate(()=>testChannels.length),before.channels);assert.equal(await f.evaluate(()=>ChatEngine.room),'event-austin-studio-tour-2026');
  await f.locator('#placeList .place-group:not(.users-fold)').first().locator('summary').first().click();await f.locator('#placeList .place-category').first().locator('summary').click();await f.locator('#placeList [data-place]').first().click();assert.equal(await f.evaluate(()=>ChatEngine.room),'event-austin-studio-tour-2026');
  await f.evaluate(()=>gps([-98.1,30.7]));await f.waitForFunction(()=>ChatEngine.room===null);assert.equal(await f.locator('#chatBtn').isDisabled(),true);
  await f.evaluate(()=>gps([-97.7431,30.2672]));await f.waitForFunction(()=>ChatEngine.room==='event-austin-studio-tour-2026');
  await f.evaluate(()=>gpsError({code:1}));await f.waitForFunction(()=>ChatEngine.room===null);assert.equal(await f.locator('#chatBtn').isDisabled(),true);await f.evaluate(()=>gps([-97.7431,30.2672]));await f.waitForFunction(()=>ChatEngine.room==='event-austin-studio-tour-2026');await f.locator('#ctrlMapLayers').click();await f.locator('#ctrlExtent').click();await f.waitForFunction(()=>!chatMap.isMoving());await page.evaluate(()=>{localStorage.setItem('theme','dark');document.documentElement.dataset.theme='dark';});await f.evaluate(()=>{document.documentElement.dataset.theme='dark';AustinEvent.open();});await f.evaluate(()=>{const scroll=document.querySelector('.event-scroll');if(scroll)scroll.scrollTop=0;});await page.screenshot({path:path.join(screenshots,`${width}-${member?'member':'guest'}-dark.png`)});
  const box=await f.locator('#event-panel').boundingBox();assert.ok(box.width>230&&box.x>=0&&box.x+box.width<=width,'event panel fits');
  assert.deepEqual(errors,[]);if(!member)assert.equal(saves.length,0);else{await f.evaluate(()=>AustinVisit.settled());assert.ok(saves.length>0);}
  await page.goto(base+'/');const main=await(await page.locator('#app-window').elementHandle()).contentFrame();await main.waitForFunction(()=>window.austinExplore);await main.locator('#ctrlExplore').click();await main.locator('#ctrlSpecialEvents').click();await main.locator('a.special-event-link').waitFor();assert.match(await main.locator('a.special-event-link').getAttribute('href'),/\/maps\/austin-studio-tour\//);
  assert.deepEqual(await main.locator('#stack > button').evaluateAll(bs=>bs.map(b=>b.id)),['ctrlExplore','ctrlDayPlan','ctrlChat','ctrlApps']);
  console.log(`${width}px ${member?'member':'guest'}: event extent/pins, search, dated selection, route rendering, calendar/map export, GPS directory, event chat, outside-area gating, themes and main Explore link passed.`);await context.close();
 }
}finally{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
