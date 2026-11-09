/* Real MapLibre + planner UI; all account, routing and chat traffic is mocked. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');let browser,server;
async function serve(){const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,body)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(body);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`;}
function session(member){const id=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+3600,enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return {access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,exp,role:'authenticated',is_anonymous:!member})+'.fixture',refresh_token:crypto.randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user:{id,is_anonymous:!member,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}};}
(async()=>{try{
 const base=process.argv[2]||await serve(),screenshots=process.env.EVENT_SCREENSHOTS||path.join(require('node:os').tmpdir(),'austin-special-events');fs.mkdirSync(screenshots,{recursive:true});
 for(const width of (process.env.EVENT_WIDTH?[Number(process.env.EVENT_WIDTH)]:[1280,390]))for(const member of (process.env.EVENT_MEMBER?[process.env.EVENT_MEMBER==='true']:[false,true])){
  // Release software-WebGL memory between variants on smaller laptops.
  browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const active=session(member),context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});const remotes=new Map();let remote=null;const saves=[],watercolorTiles=[],stopSaves=new Map();let failStopSave=false,guestAfterSignOut=false;const signedOutSession=session(false);
  context.on('response',response=>{if(response.url().includes('/special-events/tiles/stamen-watercolor-austin/')&&response.url().endsWith('.jpg'))watercolorTiles.push(response.status());});
  await context.addInitScript(({member,active})=>{
   if(member&&!localStorage.getItem('event-fixture-seeded')){localStorage.setItem('event-fixture-seeded','yes');localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(active));}
   window.printedMapText=[];const drawText=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(this.canvas.width===2400)window.printedMapText.push(String(text));return drawText.call(this,text,...args);};
   let sample;
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition:(success,error,options)=>{window.gpsOptions=options;window.gps=(pt,accuracy=5,age=0)=>{sample={coords:{longitude:pt[0],latitude:pt[1],accuracy},timestamp:Date.now()-age};success(sample);};window.gpsError=e=>{sample=null;error(e);};return 1;},clearWatch(){},getCurrentPosition:success=>{if(sample&&!window.freezeGPS)success({...sample,timestamp:Date.now()});}}});
   let identity;window.testChannels=[];window.testMessages=[];window.testSockets=[];
   Object.defineProperty(window,'ChatIdentity',{configurable:true,get:()=>identity,set:value=>{const original=value.client;value.client=()=>new Proxy(original(),{get(target,key){if(key==='channel')return name=>{const c={state:{},handlers:{},on(type,filter,fn){this.handlers[type]=fn;return this;},subscribe(fn){queueMicrotask(()=>fn('SUBSCRIBED'));},presenceState(){return this.state;},track:async person=>{c.state[person.handle]=[person];c.handlers.presence?.();},untrack:async()=>{c.state={};c.handlers.presence?.();},send:async msg=>{window.testMessages.push(msg.payload);return 'ok';}};window.testChannels.push(name);window.testSockets.push(c);return c;};if(key==='removeChannel')return async()=>{};const property=Reflect.get(target,key);return typeof property==='function'?property.bind(target):property;}});identity=value;}});
   window.testPeer=(on=true,room=window.ChatEngine.room)=>{const c=testSockets.at(-1);if(on)c.state.Neighbor=[{handle:'Neighbor',emoji:'*',room,expiresAt:Date.now()+60000}];else delete c.state.Neighbor;c.handlers.presence();};
  },{member,active});
  await context.route('https://*.supabase.co/**',route=>{const p=new URL(route.request().url()).pathname,body=route.request().postDataJSON();
   if(p==='/auth/v1/logout')return route.fulfill({json:{}});
   if(p==='/auth/v1/signup'||p==='/auth/v1/token')return route.fulfill({json:guestAfterSignOut?signedOutSession:active});if(p==='/auth/v1/user')return route.fulfill({json:active.user});
   if(p==='/rest/v1/rpc/member_load')return route.fulfill({json:{profile:{handle:'Fixture',emoji:'ðŸŽ¨',show_avatar:false},favorites:[],preferences:{},progress:[]}});
   if(p==='/rest/v1/rpc/special_event_stops_load')return route.fulfill({json:member?[...stopSaves.values()]:[]});
   if(p==='/rest/v1/rpc/special_event_stop_set'){
     if(!member||body.p_owner!==active.user.id)return route.fulfill({status:401,json:{code:'PT401'}});
     if(failStopSave){failStopSave=false;return route.fulfill({status:503,json:{code:'OFFLINE'}});}
     const row=stopSaves.get(body.p_stop)||{stop_id:body.p_stop,note:'',favorite:false};
     if(row[body.p_field]!==body.p_expected)return route.fulfill({status:409,json:{code:'PT409'}});
     const next={...row,[body.p_field]:body.p_value};stopSaves.set(body.p_stop,next);return route.fulfill({json:next});
   }
   if(p==='/rest/v1/rpc/planner_load_scoped')return route.fulfill({json:remotes.get(body.p_scope)||null});
   if(p==='/rest/v1/rpc/planner_save_scoped'){saves.push(body);remote={plan:{id:body.p_id,...body.p_settings,items:body.p_items},revision:(remotes.get(body.p_scope)?.revision||0)+1,dirty:false};remotes.set(body.p_scope,remote);return route.fulfill({json:{revision:remote.revision}});}
   if(p==='/rest/v1/rpc/planner_routing_status')return route.fulfill({json:{status:'ready',networkVersion:2}});
   if(p==='/rest/v1/rpc/planner_route_leg')return route.fulfill({json:{status:'ready',driveMinutes:6,accessMinutes:1,distanceMeters:1600,networkVersion:2,geometry:{type:'LineString',coordinates:[body.p_from,body.p_to]}}});
   if(p==='/rest/v1/messages')return route.fulfill({json:[]});
   return route.fulfill({status:400,json:{message:'Production requests blocked in event test: '+p}});
  });
  // Directory comes from this checkout, not the live fallback.
  await context.route('https://raw.githubusercontent.com/**',r=>r.abort());
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});await page.clock.install();
  await page.goto(base+'/');
  let main=await(await page.locator('#app-window').elementHandle()).contentFrame();await main.waitForFunction(()=>window.PlanStore&&window.austinExplore);await main.evaluate(async()=>{
    await PlanStore.chooseDay('2026-11-14');await PlanStore.select({key:'place:scope-fixture',title:'Separate main coffee',kind:'place',timing:'unknown',coordinates:[-97.74,30.27]},true);
    await PlanStore.edit(p=>{p.items[0].schedule.note='Keep my main plan';p.bufferMinutes=31;});await PlanStore.sync();
  });
  const visitId=await page.evaluate(()=>AustinVisit.id);
  await main.locator('#ctrlExplore').click();await main.locator('#ctrlSpecialEvents').click();await main.locator('a.special-event-link').click();
  await page.waitForFunction(()=>document.getElementById('app-window').contentWindow.location.pathname==='/special-events/map.html');
  const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(()=>window.chatMap&&window.AustinEvent?.data&&window.gps);await f.evaluate(()=>PlanStore.ready());
  await f.waitForFunction(()=>!chatMap.isMoving());assert.ok(await f.evaluate(()=>chatMap.getPitch())>50,'Event opens tilted like the main map');assert.ok(await f.evaluate(()=>chatMap.getZoom())>=13,'Opening zoom shows 3D buildings');assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('buildings-3d','visibility')),'visible');assert.equal(await f.locator('#ctrlTilt').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>AustinVisit.id),visitId,'Event navigation preserves the guest visit');assert.equal(await f.evaluate(()=>PlanStore.scope),'austin-studio-tour-2026');assert.equal(await f.evaluate(()=>PlanStore.book.items.length),0,'Main stops never enter the event');
  assert.deepEqual(await f.locator('#stack > button').evaluateAll(bs=>bs.map(b=>b.id)),['ctrlStops','ctrlDayPlan','ctrlChat']);assert.equal(await f.locator('#ctrlExplore').count(),0);
  assert.equal(await f.locator('#event-date option').count(),4);assert.equal(await f.locator('#event-panel').isVisible(),true);
  await f.locator('#event-toggle').click();assert.equal(await f.locator('#event-panel').isHidden(),true);assert.equal(await f.locator('#event-toggle').getAttribute('aria-expanded'),'false');
  await f.locator('#event-toggle').click();assert.equal(await f.locator('#event-panel').isVisible(),true);assert.equal(await f.locator('#event-toggle').getAttribute('aria-expanded'),'true');
  assert.equal(await f.evaluate(()=>gpsOptions.enableHighAccuracy),true);
  assert.equal(await f.evaluate(async()=>(await chatMap.getSource('event-chat-zones').getData()).features.length),307);
  assert.equal(await f.evaluate(async()=>(await chatMap.getSource('event-stops').getData()).features.length),258,'Only first-day stops with published hours appear');
  assert.equal(await f.locator('#event-kind').count(),0,'Venue type is removed');assert.equal(await f.locator('.event-plan-label').count(),0);assert.equal(await f.locator('#event-print-map').isHidden(),true,'Print is offered only in Plan view');
  await f.waitForFunction(()=>chatMap.getLayer('event-watercolor')&&chatMap.isSourceLoaded('event-watercolor'));
  assert.equal(await f.locator('#event-basemap-select').inputValue(),'watercolor','Initial watercolor tile responses: '+JSON.stringify(watercolorTiles));assert.ok(watercolorTiles.includes(200),'The hosted Watercolor tiles load');
  await f.locator('#event-close').click();await f.evaluate(()=>chatMap.jumpTo({center:[-97.744,30.279],zoom:12.5,pitch:0}));await f.waitForFunction(()=>chatMap.isSourceLoaded('event-watercolor'));
  await page.screenshot({path:path.join(screenshots,`${width}-${member?'member':'guest'}-watercolor.png`)});
  const camera=await f.evaluate(()=>[chatMap.getCenter().lng,chatMap.getCenter().lat,chatMap.getZoom()]);
  await f.locator('#ctrlMapLayers').click();await f.locator('#event-basemap-select').selectOption('streets');
  assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('event-watercolor','visibility')),'none');
  await f.locator('#event-basemap-select').selectOption('watercolor');await f.locator('#ctrlSatellite').click();
  assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('event-watercolor','visibility')),'none');assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('satellite','visibility')),'visible');
  await f.locator('#ctrlSatellite').click();assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('event-watercolor','visibility')),'visible');
  assert.deepEqual(await f.evaluate(()=>[chatMap.getCenter().lng,chatMap.getCenter().lat,chatMap.getZoom()]),camera,'Background choices preserve the camera');
  assert.equal(await f.evaluate(()=>{const layers=chatMap.getStyle().layers;return layers.findIndex(l=>l.id==='event-watercolor')<layers.findIndex(l=>l.id==='event-points');}),true);
  // Move beyond the overview's cached tiles to exercise a real network failure.
  await context.route('**/special-events/tiles/stamen-watercolor-austin/**/*.jpg',route=>route.fulfill({status:503,body:'Fixture tile outage'}));
  await f.evaluate(()=>chatMap.jumpTo({center:[-97.89,30.48],zoom:16,pitch:0}));
  await f.waitForFunction(()=>document.querySelector('#event-basemap-select').value==='streets');assert.match(await f.locator('#event-basemap-note').innerText(),/could not load/);assert.ok(watercolorTiles.includes(503));
  await context.unroute('**/special-events/tiles/stamen-watercolor-austin/**/*.jpg');await f.locator('#event-basemap-select').selectOption('watercolor');
  await f.waitForFunction(()=>chatMap.isSourceLoaded('event-watercolor'));assert.equal(await f.locator('#event-basemap-select').inputValue(),'watercolor');
  assert.match(await f.locator('.maplibregl-ctrl-attrib').innerHTML(),/Stamen Design/);assert.match(await f.locator('.maplibregl-ctrl-attrib').innerHTML(),/Cooper Hewitt/);
  await f.locator('#ctrlTilt').click();await f.waitForFunction(()=>!chatMap.isMoving());assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('buildings-3d','visibility')),'none');await f.locator('#ctrlTilt').click();await f.waitForFunction(()=>!chatMap.isMoving());assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('buildings-3d','visibility')),'visible');
  await f.locator('#ctrlStops').click();
  // Private notes and Favorites never select a plan day or enter main Favorites.
  const noteText='Ask about the blue painting <private> & price.';
  const firstStop=await f.evaluate(()=>String(AustinEvent.data.features.find(f=>f.properties.number===1).properties.id));
  await f.locator('#event-search').fill('1');await f.locator('#event-results .event-stop').click();
  const notebook=f.locator('.event-popup .event-stop-save'),textarea=notebook.locator('textarea');await notebook.waitFor();
  if(!member){assert.equal(await textarea.isDisabled(),true);assert.equal(await notebook.locator('.event-stop-favorite').isDisabled(),true);assert.equal(await notebook.locator('.event-note-save').isDisabled(),true);assert.equal(await notebook.locator('.event-save-hint').textContent(),'Sign In to save');}
  else{
    await f.waitForFunction(()=>SpecialEventSavedStore.loaded);await textarea.fill(noteText);await notebook.locator('.event-note-save').click();await notebook.locator('.event-save-status').filter({hasText:'Note saved.'}).waitFor();
    await notebook.locator('.event-stop-favorite').click();await f.waitForFunction(()=>document.querySelector('.event-popup .event-stop-favorite').getAttribute('aria-pressed')==='true');
    failStopSave=true;await textarea.fill('Draft retained after failure');await notebook.locator('.event-note-save').click();await notebook.locator('.event-save-status').filter({hasText:'Could not save'}).waitFor();assert.equal(await textarea.inputValue(),'Draft retained after failure');assert.equal(stopSaves.get(firstStop).note,noteText);
    await textarea.fill(noteText);await textarea.fill('My stale draft');stopSaves.set(firstStop,{...stopSaves.get(firstStop),note:'A newer note from another device'});await notebook.locator('.event-note-save').click();await notebook.locator('.event-note-reload').waitFor();assert.equal(await textarea.inputValue(),'My stale draft');
    await notebook.locator('.event-note-reload').click();await f.waitForFunction(()=>document.querySelector('.event-popup textarea').value==='A newer note from another device');
    await textarea.fill(noteText);await notebook.locator('.event-note-save').click();await notebook.locator('.event-save-status').filter({hasText:'Note saved.'}).waitFor();
    assert.equal(await f.evaluate(()=>PlanStore.book.items.length),0,'Saving a stop does not add it to a plan');assert.equal(await f.evaluate(()=>AustinMember.state.favorites.length),0,'Event Favorites stay outside main Favorites');
    if(process.env.EVENT_SAVED_AUTH_CHECK==='true'){
      await textarea.fill('Unsaved draft must clear at sign-out');guestAfterSignOut=true;await f.evaluate(()=>AustinSession.signOut());
      await f.waitForFunction(()=>!AustinSession.registered&&document.querySelector('.event-popup textarea').disabled);assert.equal(await textarea.inputValue(),'');assert.equal(await notebook.locator('.event-save-hint').textContent(),'Sign In to save');
      await f.locator('.event-popup .maplibregl-popup-close-button').click();await f.locator('#ctrlStops').click();await f.locator('#event-search').fill('1');await f.locator('#event-results .event-stop').click();assert.equal(await textarea.inputValue(),'','Reopening a popup cannot restore signed-out notes');
      guestAfterSignOut=false;await f.evaluate(tokens=>AustinSession.client().auth.setSession(tokens),{access_token:active.access_token,refresh_token:active.refresh_token});
      await f.waitForFunction(()=>AustinSession.registered&&SpecialEventSavedStore.loaded&&!document.querySelector('.event-popup textarea').disabled);assert.equal(await textarea.inputValue(),noteText,'Signing in restores saved notes without the discarded draft');await f.evaluate(()=>PlanStore.ready());
    }

  }
  await textarea.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(screenshots,`${width}-${member?'member':'guest'}-notebook.png`)});
  await f.locator('.event-popup .maplibregl-popup-close-button').click();await f.locator('#ctrlStops').click();await f.locator('#event-clear').click();
  if(member){
    await f.locator('#event-favorites').check();assert.equal(await f.locator('#event-results .event-stop').count(),1);await f.locator('#event-date').selectOption('2026-11-15');await f.locator('#event-results .event-stop').click();
    assert.equal(await f.locator('.event-popup textarea').inputValue(),noteText,'A note belongs to the stop across tour dates');
    await f.locator('.event-popup .event-stop-favorite').click();await f.waitForFunction(()=>document.querySelector('.event-popup .event-stop-favorite').getAttribute('aria-pressed')==='false');assert.equal(await f.locator('.event-popup textarea').inputValue(),noteText,'Removing Favorite keeps note');
    await f.locator('.event-popup .maplibregl-popup-close-button').click();await f.locator('#ctrlStops').click();await f.locator('#event-clear').click();await f.locator('#event-date').selectOption('2026-11-14');
  }
  // Organizer dates, unknown hours and the all-day option affect both list and pins.
  await f.locator('#event-search').fill('1');assert.equal(await f.locator('#event-results .event-stop').count(),1);
  await f.locator('#event-date').selectOption('2026-11-21');assert.equal(await f.locator('#event-results .event-stop').count(),0);
  await f.waitForFunction(async()=>!(await chatMap.getSource('event-stops').getData()).features.length);
  await f.locator('#event-date').selectOption('2026-11-14');await f.locator('#event-search').fill('125');assert.equal(await f.locator('#event-results .event-stop').count(),0);
  await f.locator('#event-availability > summary').click();await f.locator('#event-unknown').check();assert.equal(await f.locator('#event-results .event-stop').count(),1);assert.match(await f.locator('#event-results .event-hours').innerText(),/need checking/);
  await f.locator('#event-clear').click();await f.locator('#event-search').fill('72');assert.equal(await f.locator('#event-results .event-stop').count(),1);
  await f.locator('#event-all-day').check();assert.equal(await f.locator('#event-results .event-stop').count(),0);await f.locator('#event-clear').click();
  // Chosen mediums and a time window survive selection, planning and calendar export.
  await f.locator('#event-search').fill('2');await f.locator('#event-filters > summary').click();
  const medium=f.locator('.event-facet').filter({has:f.locator('[data-event-facet="mediums"]')});await medium.locator('summary').click();await f.locator('[data-event-facet="mediums"][value="Painting"]').check();
  await f.locator('#event-from').fill('13:00');await f.locator('#event-until').fill('15:00');await f.locator('#event-until').dispatchEvent('change');
  assert.equal(await f.locator('#event-results .event-stop').count(),1);await f.locator('#event-results .plan-select input').check();
  assert.deepEqual(await f.evaluate(()=>PlanStore.plan.items[0].source.eventFilters.facets.mediums),['Painting']);
  await f.locator('#event-close').click();await f.locator('#ctrlDayPlan').click();await f.locator('#build-day').click();
  await f.waitForFunction(()=>PlanStore.plan.items[0].schedule.start);assert.equal(await f.evaluate(()=>PlanModel.clock(PlanStore.plan.items[0].schedule.start)),'13:00');
  assert.match(await f.locator('.plan-item').innerText(),/Art mediums: Painting/);
  await f.locator('#export-plan').click();const filteredDownload=page.waitForEvent('download');await f.locator('#export-action').click();const filtered=fs.readFileSync(await(await filteredDownload).path(),'utf8');assert.match(filtered,/Painting/);assert.match(filtered,/DTSTART:20261114T190000Z/);await f.locator('#export-close').click();
  await f.locator('[data-plan-explore]').first().click();await f.locator('#event-from').fill('14:00');await f.locator('#event-from').dispatchEvent('change');await f.locator('.event-update-plan').click();
  assert.equal(await f.evaluate(()=>PlanModel.clock(PlanStore.plan.items[0].source.start)),'14:00');assert.equal(await f.evaluate(()=>PlanStore.plan.items[0].schedule.start),null);
  await f.locator('#event-close').click();await f.locator('#ctrlDayPlan').click();await f.locator('.plan-item').getByRole('button',{name:/^Remove /}).click();await f.locator('[data-plan-explore]').first().click();
  // Old plans used uniform hours. Refresh their source without dropping the visit or notes.
  await f.evaluate(async()=>{
    const legacy={...AustinEvent.data};delete legacy.availabilityChecked;
    const stop=legacy.features.find(f=>f.properties.number===1),source=SpecialEventModel.source(legacy,stop,'2026-11-21');
    await PlanStore.chooseDay('2026-11-21');await PlanStore.edit(plan=>{const item=PlanSources.item(source,crypto.randomUUID());item.day=plan.date;item.schedule.note='Keep my existing note';item.schedule.start=source.start;item.schedule.locked=true;plan.items.push(item);});
  });
  await f.waitForFunction(()=>PlanStore.plan.items[0]?.source.eventUnavailable===true);
  assert.equal(await f.evaluate(()=>PlanStore.plan.items[0].schedule.note),'Keep my existing note');assert.equal(await f.evaluate(()=>PlanExport.prepare(PlanStore.plan,'google-calendar').items.length),0);
  await f.locator('#event-close').click();await f.locator('#ctrlDayPlan').click();assert.match(await f.locator('.plan-item').innerText(),/Availability needs updating/);
  await f.locator('.plan-item').getByRole('button',{name:/^Remove /}).click();await f.locator('[data-plan-explore]').first().click();await f.locator('#event-date').selectOption('2026-11-14');
  await f.locator('#event-clear').click();await f.locator('#event-from').fill('16:00');await f.locator('#event-until').fill('12:00');await f.locator('#event-until').dispatchEvent('change');assert.match(await f.locator('#event-filter-message').innerText(),/later/);await f.locator('#event-clear').click();
  await f.locator('#event-filters > summary').click();await f.locator('#event-availability > summary').click();
  await f.locator('#event-search').fill('Canopy');assert.ok(await f.locator('#event-results > li').count()>0);await f.locator('#event-search').fill('');
  await f.locator('#event-results .plan-select input').nth(0).check();await f.locator('#event-results .plan-select input').nth(1).check();
  assert.equal(await f.evaluate(()=>PlanStore.plan.date),'2026-11-14');assert.equal(await f.evaluate(()=>PlanStore.plan.items.length),2);
  await f.evaluate(()=>{const scroll=document.querySelector('.event-scroll');if(scroll)scroll.scrollTop=0;});await page.screenshot({path:path.join(screenshots,`${width}-${member?'member':'guest'}-stops.png`)});
  await f.locator('#event-close').click();await f.locator('#ctrlDayPlan').click();await f.locator('#build-day').click();
  await f.waitForFunction(()=>PlanStore.plan.items.every(i=>i.schedule.start));assert.equal(await f.locator('.map-stop').count(),2);
  assert.equal(await f.locator('.event-plan-label').count(),2);assert.match(await f.locator('.event-plan-label').first().innerText(),/Nov 14, 2026/);assert.match(await f.locator('.event-plan-label').first().innerText(),/CT/);
  assert.equal(await f.locator('.event-planned-visit').count(),2);
  await f.evaluate(()=>PlanMap.focus(PlanStore.plan.items.find(i=>String(i.source.sourceId)===String(AustinEvent.data.features.find(f=>f.properties.number===1).properties.id)).id));
  await f.locator('.planner-popup .event-stop-save').waitFor();assert.equal(await f.locator('.planner-popup .event-stop-save textarea').isDisabled(),!member);
  if(member)assert.equal(await f.locator('.planner-popup .event-stop-save textarea').inputValue(),noteText,'Plan popup shares the stop notebook');
  await f.locator('.planner-popup .maplibregl-popup-close-button').click();await f.evaluate(()=>PlanPanel.open());
  if(process.env.EVENT_PRINT_CHECK==='true'){
    if(member)await f.evaluate(()=>PlanStore.edit(p=>{p.items[0].schedule.note='Bring measurements for this visit.';}));
    await f.waitForFunction(()=>!chatMap.isMoving());
    const beforePrint=await f.evaluate(()=>({plan:PlanStore.plan,camera:[chatMap.getCenter().lng,chatMap.getCenter().lat,chatMap.getZoom(),chatMap.getPitch()]}));
    await f.locator('#event-print-plan').click();await f.waitForFunction(()=>!document.getElementById('event-print-download').disabled,{}, {timeout:45000});
    const downloading=page.waitForEvent('download');await f.locator('#event-print-download').click();const pdf=await downloading;assert.match(pdf.suggestedFilename(),/austin-studio-tour-2026-2026-11-14-map.pdf/);
    const pdfBytes=fs.readFileSync(await pdf.path());assert.equal(pdfBytes.subarray(0,8).toString(),'%PDF-1.4');assert.ok(pdfBytes.length>30000,'PDF contains a rendered map');fs.writeFileSync(path.join(screenshots,`${width}-${member?'member':'guest'}-plan.pdf`),pdfBytes);
    const preview=await(await f.locator('#event-print-preview').elementHandle()).contentFrame();await preview.locator('img').first().waitFor();assert.ok(await preview.locator('img').first().evaluate(i=>i.naturalWidth>=2000));
    const printed=await f.evaluate(()=>printedMapText.join(' '));if(member){assert.ok(printed.includes(noteText),'Saved stop notes appear in the printed callout');assert.ok(printed.includes('Bring measurements for this visit.'),'Visit notes also appear');}else assert.ok(!printed.includes('My notes'),'Guest PDFs contain no saved private notes');
    await preview.locator('img').first().screenshot({path:path.join(screenshots,`${width}-${member?'member':'guest'}-print.png`)});
    await preview.evaluate(()=>{window.print=()=>{window.didPrint=true;};});await f.locator('#event-print-paper').click();assert.equal(await preview.evaluate(()=>window.didPrint),true);
    assert.deepEqual(await f.evaluate(()=>PlanStore.plan),beforePrint.plan,'Printing never edits the plan');assert.deepEqual(await f.evaluate(()=>[chatMap.getCenter().lng,chatMap.getCenter().lat,chatMap.getZoom(),chatMap.getPitch()]),beforePrint.camera,'Print extent does not change the interactive camera');
    await f.evaluate(()=>PlanStore.chooseDay('2026-11-15'));await f.waitForFunction(()=>document.getElementById('event-print-download').disabled);assert.match(await f.locator('#event-print-status').innerText(),/plan changed/);await f.locator('#event-print-close').click();await f.evaluate(()=>PlanStore.chooseDay('2026-11-14'));
    await f.locator('[data-plan-map]').first().click();await f.locator('#fit-plan').evaluate(b=>b.click());await f.waitForFunction(()=>!chatMap.isMoving());await page.screenshot({path:path.join(screenshots,`${width}-${member?'member':'guest'}-labels.png`)});await f.locator('#planner-map-edit').click();
    assert.equal(await f.locator('.event-plan-label').count(),2);
    const covered=await f.locator('.map-stop').evaluateAll(markers=>markers.some(m=>{const a=m.getBoundingClientRect(),b=m.querySelector('.event-plan-label').getBoundingClientRect();return Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);}));assert.equal(covered,false,'Location titles do not cover their own markers');
    if(process.env.EVENT_PRINT_EDGE_CHECK==='true'){
      // Unknown visit times remain explicit and loading failure never offers a blank PDF.
      await f.evaluate(()=>PlanStore.edit(p=>{p.items[0].schedule.start=null;}));assert.match((await f.locator('.event-plan-label').allTextContents()).join(' '),/Visit time not set/);
      await context.route('**/special-events/tiles/stamen-watercolor-austin/**/*.jpg',r=>r.fulfill({status:503,body:'Print tile fixture outage'}));
      await f.locator('#event-print-plan').click();await f.waitForFunction(()=>/could not load/.test(document.getElementById('event-print-status').textContent),{}, {timeout:45000});assert.equal(await f.locator('#event-print-download').isDisabled(),true);assert.equal(await f.locator('.event-print-render').count(),0);
      await context.unroute('**/special-events/tiles/stamen-watercolor-austin/**/*.jpg');await f.locator('#event-print-refresh').click();await f.waitForFunction(()=>!document.getElementById('event-print-download').disabled,{}, {timeout:45000});await f.locator('#event-print-close').click();
      // Crowded locations and long Unicode titles continue across readable sheets.
      await f.evaluate(async()=>{await PlanStore.edit(p=>{const event=AustinEvent.data;p.items=event.features.filter(feature=>SpecialEventModel.matching(event,feature,p.date,{}).length).slice(0,24).map((feature,i)=>{const source=SpecialEventModel.source(event,feature,p.date);if(i===0)source.title='Atelier María & friends — '+('A very long location title '.repeat(8));const item=PlanSources.item(source,crypto.randomUUID());item.day=p.date;return item;});});});
      await f.locator('#event-print-plan').click();await f.waitForFunction(()=>!document.getElementById('event-print-download').disabled,{}, {timeout:45000});
      const manyPreview=await(await f.locator('#event-print-preview').elementHandle()).contentFrame();assert.ok(await manyPreview.locator('img').count()>1);
      const manyDownload=page.waitForEvent('download');await f.locator('#event-print-download').click();const manyBytes=fs.readFileSync(await(await manyDownload).path());fs.writeFileSync(path.join(screenshots,'crowded-plan.pdf'),manyBytes);await manyPreview.locator('img').first().screenshot({path:path.join(screenshots,'crowded-preview.png')});
      await f.locator('#event-print-close').click();await f.evaluate(p=>PlanStore.edit(day=>{day.items=p.items;}),beforePrint.plan);
      if(member){
        const longNote=('Bring the fabric swatches and ask about framing options. '.repeat(40)).slice(0,1900)+' END OF PRIVATE NOTES';
        await f.evaluate(({id,note,previous})=>SpecialEventSavedStore.set(id,'note',note,previous),{id:firstStop,note:longNote,previous:noteText});
        await f.locator('#event-print-plan').click();await f.waitForFunction(()=>!document.getElementById('event-print-download').disabled,{}, {timeout:45000});
        const notesPreview=await(await f.locator('#event-print-preview').elementHandle()).contentFrame();assert.ok(await notesPreview.locator('img').count()>1,'Long notes continue on another map sheet');
        assert.ok((await f.evaluate(()=>printedMapText.join(' '))).includes('END OF PRIVATE NOTES'),'The end of the full note is printed');
        const notesDownload=page.waitForEvent('download');await f.locator('#event-print-download').click();fs.copyFileSync(await(await notesDownload).path(),path.join(screenshots,'long-notes.pdf'));
        await f.evaluate(({id,note,previous})=>SpecialEventSavedStore.set(id,'note',note,previous),{id:firstStop,note:noteText,previous:longNote});
        assert.equal(await f.locator('#event-print-download').isDisabled(),true);assert.match(await f.locator('#event-print-status').innerText(),/notes or account changed/);await f.locator('#event-print-close').click();
      }
      await f.locator('#event-print-plan').click();await f.locator('#event-print-close').click();assert.equal(await f.locator('.event-print-render').count(),0,'Cancel releases the export map');
    }

  }

  assert.equal(await f.evaluate(async()=>(await chatMap.getSource('event-stops').getData()).features.length),0);
  await f.locator('#plan-route').click();await f.waitForFunction(()=>chatMap.getLayer('planner-route-lines')&&chatMap.queryRenderedFeatures({layers:['planner-route-lines']}).length>0);
  if(await f.locator('#plan-panel').isHidden())await f.locator('#planner-map-edit').click();await f.locator('#export-plan').click();const downloadPromise=page.waitForEvent('download');await f.locator('#export-action').click();const download=await downloadPromise;const text=fs.readFileSync(await download.path(),'utf8');assert.match(text,/DTSTART:20261114T170000Z/);assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,2);
  for(const format of ['google-maps','apple-maps']){await f.locator(`[name=export-format][value=${format}]`).check();await f.locator('#export-action').click();assert.ok(await f.locator('#export-results a').count()>0);}
  await f.locator('#export-close').click();await f.locator('[data-plan-explore]').first().click();
  await f.locator('#event-date').selectOption('2026-11-21');await f.locator('#event-results .plan-select input').nth(0).check();assert.equal(await f.evaluate(()=>PlanStore.plan.items.length),1);
  await f.locator('#event-date').selectOption('2026-11-14');assert.equal(await f.locator('#event-results .plan-select input:checked').count(),2);
  await f.locator('#event-close').click();await f.locator('#ctrlChat').click();
  const at=await f.evaluate(()=>{const byNumber=n=>AustinEvent.data.features.find(f=>f.properties.number===n);return [47,233,1].map(n=>{const f=byNumber(n);return {point:f.geometry.coordinates,room:`event-${AustinEvent.data.id}-stop-${f.properties.id}`};});});
  await f.evaluate(pt=>gps(pt),at[0].point);await f.waitForFunction(()=>ChatRoom.room&&document.querySelectorAll('#placeList .plan-select').length>0);
  assert.equal(await f.evaluate(()=>ChatEngine.room),null,'Hidden visitors do not subscribe to event chat');
  await f.locator('#visibleBtn').click();await f.waitForFunction(room=>ChatEngine.room===room,at[0].room);assert.equal(await f.locator('#chatBtn').isDisabled(),true,'Chat needs another visible attendee');
  await f.evaluate(pt=>{AustinChatCard.close();chatMap.jumpTo({center:pt,zoom:18,pitch:0});},at[0].point);
  await f.waitForFunction(()=>chatMap.queryRenderedFeatures({layers:['event-chat-line']}).length>=2&&chatMap.queryRenderedFeatures({layers:['event-chat-current']}).length>0);
  await page.screenshot({path:path.join(screenshots,`${width}-${member?'member':'guest'}-zones.png`)});await f.locator('#ctrlChat').click();
  await f.evaluate(()=>testPeer(true,'downtown'));assert.equal(await f.locator('#chatBtn').isDisabled(),true);
  await f.evaluate(()=>testPeer());await f.locator('#chatBtn').click();await f.locator('#chatText').fill('Stop chat fixture');await f.locator('#chatSend').click();assert.equal(await f.evaluate(()=>testMessages.at(-1).room),at[0].room);
  await f.evaluate(()=>testSockets.at(-1).handlers.broadcast({payload:{room:ChatEngine.room,handle:'Neighbor',text:'At this studio',t:Date.now()}}));assert.match(await f.locator('#chatLines').innerText(),/At this studio/);
  const before=await f.evaluate(()=>({neighborhood:ChatRoom.neighborhood.properties.id,channels:testChannels.length}));
  await f.evaluate(pt=>gps(pt),at[1].point);await f.waitForFunction(room=>ChatEngine.room===room,at[1].room);
  assert.equal(await f.evaluate(()=>ChatRoom.neighborhood.properties.id),before.neighborhood,'Shared building stops stay in the same GPS neighborhood');
  assert.equal(await f.evaluate(()=>testChannels.length),before.channels+1);assert.equal(await f.locator('#chatLines li').count(),0);assert.equal(await f.locator('#chatBtn').isDisabled(),true);
  await f.evaluate(()=>testSockets.at(-2).handlers.broadcast({payload:{room:testChannels.at(-2).slice(5),handle:'Neighbor',text:'Old room',t:Date.now()}}));assert.equal(await f.locator('#chatLines li').count(),0);
  await f.evaluate(()=>testPeer());await f.locator('#placeList .place-group:not(.users-fold)').first().locator('summary').first().click();await f.locator('#placeList .place-category').first().locator('summary').click();await f.locator('#placeList [data-place]').first().click();assert.equal(await f.evaluate(()=>ChatEngine.room),at[1].room);
  // A different neighborhood changes the directory and the stop room independently.
  await f.evaluate(pt=>gps(pt),at[2].point);await f.waitForFunction(room=>ChatEngine.room===room,at[2].room);await f.waitForFunction(id=>ChatRoom.neighborhood?.properties.id!==id,before.neighborhood);
  await f.evaluate(()=>gps([-98.1,30.7]));await f.waitForFunction(()=>ChatEngine.room===null);assert.equal(await f.locator('#chatBtn').isDisabled(),true);assert.equal(await f.locator('.avatars').count(),0);
  await f.evaluate(pt=>gps(pt,100),at[0].point);assert.equal(await f.evaluate(()=>ChatEngine.room),null,'Inaccurate fixes cannot join');
  await f.evaluate(pt=>gps(pt,5,70000),at[0].point);assert.equal(await f.evaluate(()=>ChatEngine.room),null,'Cached old fixes cannot join');
  await f.evaluate(pt=>gps(pt),at[0].point);await f.waitForFunction(room=>ChatEngine.room===room,at[0].room);
  await f.evaluate(()=>gpsError({code:1}));await f.waitForFunction(()=>ChatEngine.room===null);assert.equal(await f.locator('#chatBtn').isDisabled(),true);
  await f.evaluate(pt=>gps(pt),at[0].point);await f.waitForFunction(room=>ChatEngine.room===room,at[0].room);
  // Advance real page timers without a new GPS fix: presence and send both expire.
  await f.evaluate(()=>{freezeGPS=true;testPeer();});await page.clock.fastForward(61000);await f.waitForFunction(()=>ChatEngine.room===null);assert.equal(await f.evaluate(()=>ChatEngine.send('stale GPS')),false);
  await f.evaluate(pt=>{freezeGPS=false;gps(pt);},at[0].point);await f.waitForFunction(room=>ChatEngine.room===room,at[0].room);
  await f.locator('#ctrlChat').click();await f.locator('#visibleBtn').click();await f.waitForFunction(()=>ChatEngine.room===null);assert.equal(await f.locator('#chatLines li').count(),0);
  await f.locator('#ctrlMapLayers').click();await f.locator('#ctrlExtent').click();await f.waitForFunction(()=>!chatMap.isMoving());await page.evaluate(()=>{localStorage.setItem('theme','dark');document.documentElement.dataset.theme='dark';});await f.evaluate(()=>{document.documentElement.dataset.theme='dark';AustinEvent.open();});await f.evaluate(()=>{const scroll=document.querySelector('.event-scroll');if(scroll)scroll.scrollTop=0;});await page.screenshot({path:path.join(screenshots,`${width}-${member?'member':'guest'}-dark.png`)});
  const box=await f.locator('#event-panel').boundingBox();assert.ok(box.width>230&&box.x>=0&&box.x+box.width<=width,'event panel fits');
  assert.deepEqual(errors,[]);if(!member)assert.equal(saves.length,0);else{await f.evaluate(()=>AustinVisit.settled());assert.ok(saves.length>0);}
  const eventBook=await f.evaluate(async()=>{await PlanStore.sync();return PlanStore.book;});
  await page.evaluate(()=>AustinVisit.navigate(new URL('/',location.origin)));
  await page.waitForFunction(()=>document.getElementById('app-window').contentWindow.location.pathname==='/chat/');
  main=await(await page.locator('#app-window').elementHandle()).contentFrame();await main.waitForFunction(()=>window.austinExplore&&window.PlanStore);await main.evaluate(()=>PlanStore.ready());assert.equal(await main.locator('.event-plan-label,#event-print-map').count(),0,'Main map has no event print or title overlays');
  assert.equal(await page.evaluate(()=>AustinVisit.id),visitId);assert.equal(await main.evaluate(()=>PlanStore.scope),'main');
  assert.deepEqual(await main.evaluate(()=>PlanStore.plan.items.map(i=>[i.source.title,i.schedule.note])),[['Separate main coffee','Keep my main plan']]);
  assert.equal(await main.evaluate(()=>PlanStore.plan.bufferMinutes),31);assert.equal(await main.evaluate(()=>PlanExport.prepare(PlanStore.plan,'google-maps').items.length),1);
  await main.locator('#ctrlExplore').click();await main.locator('#ctrlSpecialEvents').click();await main.locator('a.special-event-link').waitFor();assert.match(await main.locator('a.special-event-link').getAttribute('href'),/\/maps\/austin-studio-tour\//);
  assert.deepEqual(await main.locator('#stack > button').evaluateAll(bs=>bs.map(b=>b.id)),['ctrlExplore','ctrlDayPlan','ctrlChat','ctrlApps']);
  await main.locator('a.special-event-link').click();await page.waitForFunction(()=>document.getElementById('app-window').contentWindow.location.pathname==='/special-events/map.html');
  let back=await(await page.locator('#app-window').elementHandle()).contentFrame();await back.waitForFunction(()=>window.AustinEvent?.data&&window.PlanStore);await back.evaluate(()=>PlanStore.ready());
  assert.deepEqual(await back.evaluate(()=>PlanStore.book.items),eventBook.items,'Returning to event recovers only its selections and notes');
  if(member){await page.reload();back=await(await page.locator('#app-window').elementHandle()).contentFrame();await back.waitForFunction(()=>window.AustinEvent?.data&&window.PlanStore);await back.evaluate(()=>PlanStore.ready());assert.deepEqual(await back.evaluate(()=>PlanStore.book.items),eventBook.items,'Registered event collection survives reload independently');}
  if(member){await back.evaluate(()=>SpecialEventSavedStore.ready());assert.equal(await back.evaluate(id=>SpecialEventSavedStore.row(id).note,firstStop),noteText,'Private stop note survives navigation and reload');}
  // A retained tab expires, clears its own cache, and cannot expose the map.
  await page.clock.setSystemTime(new Date('2026-11-25T04:00:00Z'));await back.evaluate(()=>PlanContext.check());
  await back.waitForURL('**/special-events/expired.html');assert.ok(await back.locator('h1').isVisible());
  if(member){const caches=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('austin:planner:v2:')));assert.ok(caches.some(k=>k.endsWith(':main')));assert.ok(!caches.some(k=>k.endsWith(':austin-studio-tour-2026')));}
  assert.deepEqual(errors,[]);
  console.log(`${width}px ${member?'member':'guest'}: organizer dates, filters, unknown/all-day hours, visit-window planning/export/update, Watercolor/fallback, 307 chat zones, GPS gating, separate main/event plans, navigation, reload, expiry event plan labels/printing, private stop notes and Favorites passed.`);await context.close();await browser.close();browser=null;
 }
}finally{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
