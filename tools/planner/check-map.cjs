/* Planner map ownership, real rendering and route transport with auth fixtures. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),crypto=require('node:crypto');
const M=require('../../planner/model.js'),root=path.resolve(__dirname,'../..');
let browser,server;
async function serve(){
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
 server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;
}
function session(member){const id=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+3600,enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return {access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,exp,role:'authenticated',is_anonymous:!member})+'.fixture',refresh_token:crypto.randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user:{id,is_anonymous:!member,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}};}
async function frame(page,planner=false){const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(planner?()=>window.testPlannerMap&&window.austinExplore&&window.PlanStore:()=>window.chatMap&&window.austinExplore&&window.PlanStore,{}, {timeout:45000});await f.evaluate(()=>PlanStore.ready());return f;}
async function ownMap(f,count){
 await f.waitForFunction(n=>document.querySelectorAll('#plan-map .map-stop').length===n,count);
 assert.equal(await f.locator('#plan-map .maplibregl-marker').count(),count,'all map markers belong to selected stops');
 assert.deepEqual(await f.evaluate(()=>testPlannerMap.getStyle().layers.filter(l=>l.id.startsWith('explore-')).map(l=>l.id)),[],'Explore must never create planner map layers');
}
async function routeCount(f,count){
 // This Playwright version does not await asynchronous polling predicates.
 let actual;
 for(let i=0;i<300;i++){
  actual=await f.evaluate(async()=>(await testPlannerMap.getSource('planner-routes')?.getData())?.features.length);
  if(actual===count)return;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.equal(actual,count,'route geometry matches the selected day');
}
(async()=>{try{
 const base=process.argv[2]||await serve(),now=Date.now(),day=M.nextDay(M.day(now)),otherDay=M.nextDay(day);
 const points=[[-97.7431,30.2672],[-97.7408,30.279],[-97.712,30.3]];
 const features=points.map((coordinates,i)=>({type:'Feature',geometry:{type:'Point',coordinates},properties:{id:'map-fixture-'+i,title:['Selected first stop','Selected second stop','Unselected listing'][i],venue:'Fixture venue',address:'Austin',kind:'event',price:0,priceLabel:'Free',url:'https://example.invalid/event-'+i,source:'Fixture calendar',checked:new Date(now).toISOString(),start:M.instant(`${day}T${[10,12,14][i]}:00`),end:M.instant(`${day}T${[11,13,15][i]}:00`),expires:new Date(now+86400000).toISOString()}}));
 const feed={type:'FeatureCollection',generated:new Date(now).toISOString(),sources:[],features};
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(os.homedir(),'.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const width of [1280,390])for(const member of [false,true]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500}),active=session(member),rpcCalls=[];
  let remote=null,held=null,holdNext=false;
  await context.addInitScript(({member,active})=>{
   let controls;Object.defineProperty(window,'PlanControls',{configurable:true,get:()=>controls,set:value=>{const init=value.init;value.init=function(map,...args){window.testPlannerMap=map;return init.call(this,map,...args);};controls=value;}});
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:success=>success({coords:{longitude:-97.75,latitude:30.28}}),watchPosition:()=>1,clearWatch:()=>{}}});
   if(window===window.top&&!sessionStorage.getItem('fixture-seeded')){sessionStorage.setItem('fixture-seeded','yes');localStorage.setItem('austin-explore-v1',JSON.stringify({enabled:['free-cheap'],when:'week'}));if(member)localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(active));}
  },{member,active});
  await context.route('https://*.supabase.co/**',async route=>{
   const p=new URL(route.request().url()).pathname,body=route.request().postDataJSON();
   if(['/auth/v1/signup','/auth/v1/token'].includes(p))return route.fulfill({json:active});
   if(p==='/auth/v1/user')return route.fulfill({json:active.user});
   if(p==='/auth/v1/logout')return route.fulfill({status:204});
   if(p==='/rest/v1/rpc/member_load')return route.fulfill({json:{profile:{handle:'Fixture',emoji:'🦊',show_avatar:false},favorites:[],preferences:{explore:{enabled:['free-cheap'],when:'week'}},progress:[]}});
   if(p==='/rest/v1/rpc/member_preference_set')return route.fulfill({json:null});
   if(p==='/rest/v1/rpc/planner_load')return route.fulfill({json:remote});
   if(p==='/rest/v1/rpc/planner_save'){remote={plan:{id:body.p_id,...body.p_settings,items:body.p_items},revision:(remote?.revision||0)+1,dirty:false};return route.fulfill({json:{revision:remote.revision}});}
   if(p==='/rest/v1/rpc/planner_routing_status')return route.fulfill({json:{status:'ready',networkVersion:2}});
   if(p==='/rest/v1/rpc/planner_route_leg'){
    rpcCalls.push(body);if(holdNext){holdNext=false;await new Promise(resolve=>{held=resolve;});}
    return route.fulfill({json:{status:'ready',driveMinutes:6,accessMinutes:1,distanceMeters:1600,networkVersion:2,geometry:{type:'LineString',coordinates:[body.p_from,body.p_to]}}}).catch(()=>{});
   }
   return route.fulfill({status:400,json:{message:'No production requests in this test: '+p}});
  });
  await context.route(/\/chat\/data\/explore\/[^?]+\.geojson/,route=>route.fulfill({json:feed}));
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);let f=await frame(page);
  await f.locator('#ctrlExplore').click();if(!await f.locator('[data-layer=free-cheap]').isChecked())await f.locator('[data-layer=free-cheap]').check();
  await f.waitForFunction(()=>austinExplore.visibleItems.length===3);
  for(const name of ['Selected first stop','Selected second stop'])await f.getByRole('checkbox',{name:`Add ${name} to Day Planner`,exact:true}).check();
  await f.locator('#explore-panel .explore-close').click();await f.locator('#ctrlDayPlan').click();await f.locator('.plan-open').click();await page.waitForURL('**/dayplan/');f=await frame(page,true);
  await f.waitForFunction(()=>austinExplore.visibleItems.length===3);
  await ownMap(f,2);await routeCount(f,0);
  await f.locator('#plan-route').click();await routeCount(f,1);
  assert.deepEqual(rpcCalls[0].p_from,points[0]);assert.deepEqual(rpcCalls[0].p_to,points[1]);
  await f.waitForFunction(()=>testPlannerMap.queryRenderedFeatures({layers:['planner-route-lines']}).length>0);
  await f.evaluate(()=>PlanPanel.showMap());await f.locator('#ctrlExplore').click();
  const extra=f.locator('#explore-panel .explore-results > li').filter({has:f.locator('.explore-result strong',{hasText:'Unselected listing'})});
  await f.waitForFunction(()=>!testPlannerMap.isMoving());
  const camera=await f.evaluate(()=>({center:testPlannerMap.getCenter().toArray(),zoom:testPlannerMap.getZoom()}));
  await extra.locator('.explore-result').click();
  assert.equal(await extra.locator('.explore-inline-details').isVisible(),true);
  assert.deepEqual(await f.evaluate(()=>({center:testPlannerMap.getCenter().toArray(),zoom:testPlannerMap.getZoom()})),camera,'browsing an unselected listing does not move the plan map');
  assert.equal(await f.locator('.explore-popup').count(),0);
  await extra.locator(':scope > .plan-select input').check();await ownMap(f,3);await routeCount(f,2);
  await extra.locator(':scope > .plan-select input').uncheck();await ownMap(f,2);await routeCount(f,1);
  await f.evaluate(()=>{testPlannerMap.fire('style.load');austinExplore.refresh();});await ownMap(f,2);
  await f.locator('#explore-panel .explore-close').click();await f.locator('#ctrlLocate').click();await f.waitForFunction(()=>!document.querySelector('#ctrlLocate').disabled);await ownMap(f,2);
  await f.evaluate(()=>PlanPanel.open());holdNext=true;await f.locator('#plan-route').click();
  for(let i=0;!held&&i<100;i++)await new Promise(resolve=>setTimeout(resolve,50));assert.ok(held,'a route request is in flight');
  await f.evaluate(day=>PlanStore.chooseDay(day),otherDay);await ownMap(f,0);await routeCount(f,0);held();
  await f.waitForFunction(()=>!PlanRouting.state.busy);await ownMap(f,0);await routeCount(f,0);
  await f.evaluate(day=>PlanStore.chooseDay(day),day);await ownMap(f,2);await routeCount(f,1);
  await f.getByRole('button',{name:'Remove Selected second stop',exact:true}).click();await ownMap(f,1);await routeCount(f,0);
  await f.evaluate(async feature=>{await PlanStore.select(PlanSources.feature(feature),true);},features[1]);await ownMap(f,2);await routeCount(f,1);
  await page.screenshot({path:`/tmp/planner-selected-map-${width}-${member?'member':'guest'}.png`});
  await page.locator('.brand').click();await page.waitForURL(base+'/');f=await frame(page);await f.waitForFunction(()=>austinExplore.visibleItems.length===3);
  assert.ok(await f.evaluate(async()=>(await chatMap.getSource('explore-free-cheap').getData()).features.length>0),'main-map discovery pins still work');
  await f.locator('#ctrlExplore').click();await f.locator('.explore-result').filter({hasText:'Selected first stop'}).click();
  await f.locator('.explore-popup').waitFor({state:'visible'});
  assert.equal(await f.locator('.explore-popup h3').textContent(),'Selected first stop');
  assert.equal(await f.locator('.explore-popup .plan-select input').isChecked(),true);
  await f.locator('.explore-popup .maplibregl-popup-close-button').click();
  await f.locator('#ctrlDayPlan').click();await f.locator('.plan-open').click();await page.waitForURL('**/dayplan/');f=await frame(page,true);await ownMap(f,2);
  if(member)await f.evaluate(()=>PlanStore.sync());
  await page.reload();f=await frame(page,true);await ownMap(f,member?2:0);
  if(member){await page.evaluate(()=>AustinSession.signOut());await ownMap(f,0);await routeCount(f,0);}
  assert.deepEqual(errors,[]);await context.close();
  console.log(`${width}px ${member?'registered':'guest'}: selected stops only, Explore browse/add/remove, GPS, routes, late response, day switching, removal, navigation, refresh and sign-out passed.`);
 }
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}})().catch(error=>{console.error(error.stack);process.exitCode=1;});
