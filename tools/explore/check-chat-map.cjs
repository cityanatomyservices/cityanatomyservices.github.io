/* Three-button navigation, embedded discovery and isolated Chat map. No production writes. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');let browser,server;
async function serve(){const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;}
async function count(f,source,n){for(let i=0;i<150;i++){const got=await f.evaluate(async source=>(await chatMap.getSource(source)?.getData())?.features?.length,source);if(got===n)return;await new Promise(r=>setTimeout(r,100));}const state=await f.evaluate(()=>({chat:window.AustinChatMap?.active,hidden:document.hidden,style:chatMap.isStyleLoaded(),status:document.getElementById('chat-circles-status')?.textContent}));assert.fail(`${source} did not reach ${n} features: ${JSON.stringify(state)}`);}
(async()=>{try{
 const base=process.argv[2]||await serve();browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500}),id=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+3600,enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const session={access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,exp,role:'authenticated',is_anonymous:false})+'.fixture',refresh_token:crypto.randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user:{id,is_anonymous:false,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}};
  const circle={id:crypto.randomUUID(),name:'Current park chat',description:'A currently open test circle',latitude:30.2682,longitude:-97.7421,diameter:150,active:true,startsAt:new Date(Date.now()-3600000).toISOString(),activeUntil:new Date(Date.now()+3600000).toISOString()};
  const feed={type:'FeatureCollection',generated:new Date().toISOString(),sources:[],features:[{type:'Feature',geometry:{type:'Point',coordinates:[-97.7431,30.2672]},properties:{id:'chat-map-fixture',title:'Day plan listing',kind:'event',price:0,priceLabel:'Free',venue:'Austin',address:'Austin',url:'https://example.invalid',source:'Fixture',checked:new Date().toISOString(),start:new Date(Date.now()+3600000).toISOString(),end:new Date(Date.now()+7200000).toISOString(),expires:new Date(Date.now()+86400000).toISOString()}}]};
  let hold=false,release,reads=0;const rpc=[];
  await context.addInitScript(session=>{
   if(window===window.top)localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(session));
   window.gpsMode='good';const fix=(longitude=-97.7431,latitude=30.2672)=>({coords:{longitude,latitude,accuracy:5},timestamp:Date.now()});
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition:()=>1,clearWatch:()=>{},getCurrentPosition:(ok,bad)=>{if(window.gpsMode==='denied')bad({code:1});else if(window.gpsMode==='hold')window.completeGPS=()=>ok(fix(-97,31));else ok(fix());}}});
  },session);
  await context.route('https://*.supabase.co/**',async route=>{
   const p=new URL(route.request().url()).pathname,b=route.request().postDataJSON();rpc.push(p);
   if(p==='/auth/v1/user')return route.fulfill({json:session.user});if(p==='/auth/v1/token'||p==='/auth/v1/signup')return route.fulfill({json:session});
   if(p==='/rest/v1/rpc/member_load')return route.fulfill({json:{profile:{handle:'Fixture',show_avatar:false},favorites:[],preferences:{},progress:[]}});
   if(p==='/rest/v1/rpc/planner_load_scoped')return route.fulfill({json:null});if(p==='/rest/v1/rpc/planner_save_scoped')return route.fulfill({json:{revision:1}});
   if(p==='/rest/v1/rpc/geofence_map'){assert.deepEqual(b,{},'map lookup never sends device coordinates');reads++;if(hold){hold=false;await new Promise(r=>release=r);}return route.fulfill({json:{circles:[circle,{...circle,id:crypto.randomUUID(),name:'Future',startsAt:new Date(Date.now()+3600000).toISOString()},{...circle,id:crypto.randomUUID(),name:'Expired',activeUntil:new Date(Date.now()-1000).toISOString()}],serverNow:new Date().toISOString()}}).catch(()=>{});}
   return route.fulfill({status:400,json:{message:'Fixture-only check'}});
  });
  await context.route('**/chat/chat.js?*',r=>r.fulfill({contentType:'text/javascript',body:"window.ChatEngine={maxText:1000,people:()=>[],join:async()=>{},leave:async()=>{},setRoom:async()=>{},setVisible:async()=>{},setPosition:()=>{},send:async()=>false};"}));
  await context.route(/\/chat\/data\/explore\/[^?]+\.geojson/,r=>r.fulfill({json:feed}));
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(()=>window.chatMap&&window.austinExplore&&window.PlanWizard);await f.evaluate(()=>PlanStore.ready());
  assert.deepEqual(await f.locator('#stack>.round').evaluateAll(es=>es.map(e=>e.id)),['ctrlDayPlan','ctrlChat','ctrlGeoFence']);assert.equal(await f.locator('#ctrlExplore').count(),0);
  await f.locator('#ctrlDayPlan').click();await f.locator('#plan-start #explore-panel').waitFor();
  assert.equal(await f.locator('#plan-explore-host #ctrlClassifieds,#plan-explore-host #ctrlSpecialEvents,#plan-explore-host #ctrlProApps').count(),3);
  const choice=f.locator('[data-layer=free-cheap]');if(!await choice.isChecked())await choice.check();await f.locator('[data-filter=when]').selectOption('all');await count(f,'explore-free-cheap',1);
  await f.getByRole('checkbox',{name:'Add Day plan listing to Day Planner',exact:true}).check();assert.equal(await f.evaluate(()=>PlanStore.plan.items.length),1);
  await page.screenshot({path:path.resolve('..','.tmp',`day-planner-categories-${width}.png`)});
  await f.locator('#plan-panel').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.resolve('..','.tmp',`day-planner-categories-top-${width}.png`)});
  await f.locator('#plan-panel-close').click();await f.locator('#ctrlChat').click();await count(f,'explore-free-cheap',0);await count(f,'chat-circles',1);
  await f.waitForFunction(()=>chatMap.getZoom()===16&&Math.abs(chatMap.getCenter().lng+97.7431)<.00001);assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('geofence-fill','visibility')),'none');
  assert.equal(await f.locator('#plan-panel').isHidden(),true);assert.equal(await f.evaluate(()=>PlanStore.plan.items.length),1);assert.ok(reads>0);
  await f.locator('#ctrlChat').click();await f.evaluate(()=>chatMap.fire('style.load'));await count(f,'chat-circles',1);await count(f,'explore-free-cheap',0);
  await f.waitForFunction(()=>chatMap.queryRenderedFeatures({layers:['chat-circle-fill']}).length>0);
  await f.evaluate(c=>chatMap.fire('click',{point:chatMap.project([c.longitude,c.latitude]),lngLat:new maplibregl.LngLat(c.longitude,c.latitude),originalEvent:{target:chatMap.getCanvas()}}),circle);
  await f.locator('.chat-circle-popup').waitFor();assert.equal(await f.locator('.chat-circle-popup a').getAttribute('href'),'https://austin.chat/geofences/?id='+circle.id);
  await f.waitForFunction(()=>!chatMap.isMoving());await page.screenshot({path:path.resolve('..','.tmp',`chat-only-map-${width}.png`)});
  // Expiration removes the circle and its popup without a reload.
  circle.activeUntil=new Date(Date.now()+1500).toISOString();await f.locator('.chat-circle-popup .maplibregl-popup-close-button').click();await f.locator('#ctrlChat').click();await count(f,'chat-circles',0);
  await f.evaluate(()=>PlanPanel.browse());await count(f,'explore-free-cheap',1);assert.equal(await choice.isChecked(),true);assert.equal(await f.getByRole('checkbox',{name:'Add Day plan listing to Day Planner',exact:true}).isChecked(),true);
  // Late fetch and GPS callbacks cannot repaint or recenter another mode.
  await f.locator('#plan-panel-close').click();hold=true;await f.evaluate(()=>window.gpsMode='hold');await f.locator('#ctrlChat').click();for(let i=0;!release&&i<100;i++)await new Promise(r=>setTimeout(r,50));assert.ok(release);
  await f.evaluate(()=>PlanPanel.browse());const before=await f.evaluate(()=>chatMap.getCenter().toArray());await f.evaluate(()=>window.completeGPS());release();release=null;await page.waitForTimeout(500);await count(f,'chat-circles',0);assert.deepEqual(await f.evaluate(()=>chatMap.getCenter().toArray()),before);
  await f.locator('#plan-panel-close').click();await f.evaluate(()=>window.gpsMode='denied');await f.locator('#ctrlChat').click();await f.locator('#chat-map-status').filter({hasText:'Allow device location'}).waitFor();await count(f,'chat-circles',0);
  assert.equal(await f.evaluate(async()=>(await chatMap.getSource('chat-location').getData()).features.length),0);assert.equal(rpc.some(p=>p.endsWith('/geofence_chat_v2')),false,'Viewing circles never joins their chats');assert.deepEqual(errors,[]);
  assert.equal(await f.locator('#plan-panel').evaluate(el=>el.scrollWidth>el.clientWidth),false);await context.close();console.log(`${width}px: three controls, embedded categories/selection, isolated Chat map, GPS, active circles, expiration, restored choices and late-response guards passed.`);
 }
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
