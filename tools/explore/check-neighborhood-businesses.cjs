/* Real main-map UI with fixture identity/presence. No production account,
   conversation or planner writes. Pass the deployed origin for a live check. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),output=path.resolve(process.env.TEMP||'/tmp','austin-neighborhood-businesses');
const directory=JSON.parse(fs.readFileSync(path.join(root,'chat/data/places/downtown.json'),'utf8'));
const place=directory.groups[0].categories[0].places[0];
let browser,server;
async function serve(){
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
 server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;
}
const engine=`(()=>{
 let hooks={},me,visible=false,room=null,neighborhood=null;
 const peers=()=>neighborhood?[{handle:'River',emoji:'🌳',room:neighborhood,self:false},{handle:'Sky',emoji:'☀️',room:neighborhood+'/${place.id}',self:false}]:[];
 const people=()=>[...peers(),...(visible&&room?[{...me,room,self:true}]:[])];
 const update=()=>hooks.onPeople?.(people());
 window.ChatEngine={maxText:1000,people,get room(){return room;},
  async join(id,identity,on,callbacks){neighborhood=id;room=id;me=identity;visible=on;hooks=callbacks;update();},
  async leave(){room=null;neighborhood=null;update();},
  async setRoom(id){room=id;update();},async setVisible(on){visible=on;update();},
  setPosition(pt){this.position=pt;},async send(text){if(!visible||!room)return false;hooks.onMessage({...me,text,t:Date.now(),self:true});return true;}
 };
})();`;
async function ready(page){const f=await(await page.locator('#app-window').elementHandle()).contentFrame();try{await f.waitForFunction(()=>window.austinExplore&&window.ChatRoom?.room?.properties.id==='downtown'&&document.querySelector('#placeList .place-category'));}catch(error){console.error(await f.evaluate(()=>({url:location.href,map:!!window.chatMap,explore:!!window.austinExplore,room:window.ChatRoom?.room?.properties.id,status:document.getElementById('roomLine')?.textContent,directory:document.getElementById('directoryStatus')?.textContent})));await page.screenshot({path:path.join(output,'failure.png')});throw error;}return f;}
async function bounds(f,selector){return f.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:el.scrollWidth,client:el.clientWidth};});}
(async()=>{try{
 fs.mkdirSync(output,{recursive:true});const base=process.argv[2]||await serve();
 browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,permissions:['geolocation'],geolocation:{longitude:-97.7431,latitude:30.2672}});
  await context.route('https://*.supabase.co/**',route=>{
   if(new URL(route.request().url()).pathname!=='/auth/v1/signup')return route.fulfill({status:400,json:{message:'Fixture-only check'}});
   const id=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+3600,encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
   return route.fulfill({json:{access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:id,exp,role:'authenticated',is_anonymous:true})+'.fixture',refresh_token:crypto.randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user:{id,is_anonymous:true,app_metadata:{},user_metadata:{},aud:'authenticated'}}});
  });
  await context.route('**/chat/chat.js?*',route=>route.fulfill({contentType:'text/javascript',body:engine}));
  await context.route('**/chat/data/places/downtown.json*',route=>route.fulfill({json:directory}));
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);let f=await ready(page);
  assert.equal(await f.locator('#legend #placeList').count(),0);
  assert.equal(await f.locator('#legend #chatwin').count(),1);
  assert.equal(await f.locator('#explore-panel #placeList').count(),1);
  assert.equal(await f.locator('#placeList .users-fold,#placeList .is-neighborhood').count(),0);
  assert.equal(await f.locator('#neighborhoodBusinesses').evaluate(el=>el.open),false);
  assert.equal(await f.locator('#placeList details[open]').count(),0);
  await f.locator('#ctrlChat').click();
  assert.equal(await f.locator('#chatBtn').isDisabled(),true);
  await f.locator('#roomList .users-fold > summary').click();
  assert.equal(await f.locator('#roomList .user-row').count(),2);
  await f.locator('#roomList .user-row').filter({hasText:'Sky'}).click();
  await f.waitForFunction(id=>ChatRoom.place?.id===id,place.id);
  await f.locator('#ctrlChat').click();assert.equal(await f.locator('#chatBtn').isDisabled(),true);
  await f.locator('#roomList .is-neighborhood').click();
  await f.waitForFunction(()=>ChatRoom.place===null&&ChatEngine.room==='downtown');
  await f.locator('#visibleBtn').click();await f.locator('#chatBtn').click();
  await f.locator('#chatText').fill('Neighborhood conversation');await f.locator('#chatSend').click();
  assert.match(await f.locator('#chatLines').innerText(),/Neighborhood conversation/);
  assert.equal(await f.locator('#chatText').inputValue(),'');
  await f.locator('#roomList .users-fold > summary').click();
  await page.screenshot({path:path.join(output,`chat-${width}.png`)});
  const chat=await bounds(f,'#chatwin'),legend=await bounds(f,'#legend');
  assert.ok(chat.left>=legend.left&&chat.right<=legend.right&&chat.top>=legend.top&&chat.bottom<=legend.bottom,'conversation stays inside Chat');
  assert.ok(chat.scroll<=chat.client,'chat has no horizontal overflow');
  await f.locator('#ctrlExplore').click();assert.equal(await f.locator('#chatwin').isVisible(),false);
  assert.equal(await f.locator('#neighborhoodBusinesses').evaluate(el=>el.open),false);
  await page.screenshot({path:path.join(output,`explore-closed-${width}.png`)});
  await f.locator('#neighborhoodBusinesses > summary').click();
  assert.equal(await f.locator('#placeList details[open]').count(),0);
  const group=f.locator('#placeList > .place-group').first(),category=group.locator('.place-category').first();
  await group.locator(':scope > summary').click();assert.equal(await category.evaluate(el=>el.open),false);
  assert.equal(await category.locator(':scope > summary').evaluate(el=>getComputedStyle(el,'::before').content),'"▸"');
  await category.locator(':scope > summary').click();
  const row=category.locator('.plan-place-row').first();
  assert.match(await row.innerText(),new RegExp(place.name));
  assert.equal(await row.locator('.here').innerText(),'1 here');
  assert.equal(await row.locator('.favorite-select').count(),1);
  await row.locator('.plan-select input').check();
  await f.waitForFunction(id=>PlanStore.plan.items.some(item=>item.source.key==='place:'+id),place.id);
  assert.equal(await f.evaluate(()=>ChatRoom.place),null,'planning does not change the room');
  await row.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`explore-open-${width}.png`)});
  const explore=await bounds(f,'#explore-panel');assert.ok(explore.left>=0&&explore.right<=explore.width&&explore.bottom<=explore.height,'Explore fits the viewport');
  assert.ok(explore.scroll<=explore.client,'Explore has no horizontal overflow');
  await row.locator('.place-row').click();
  await f.waitForFunction(id=>ChatRoom.place?.id===id,place.id);
  assert.equal(await f.locator('#explore-panel').isHidden(),true);
  await f.locator('#ctrlChat').click();await f.locator('#chatBtn').click();
  assert.match(await f.locator('#chatRoom').innerText(),new RegExp(place.name));
  await f.locator('#chatText').fill('Business conversation');await f.locator('#chatText').press('Enter');
  assert.match(await f.locator('#chatLines').innerText(),/Business conversation/);
  await f.locator('#roomList .is-neighborhood').click();
  await f.waitForFunction(()=>ChatRoom.place===null&&ChatEngine.room==='downtown');
  await f.locator('#chatBtn').click();
  assert.equal(await f.locator('#chatLines li').count(),0,'room change clears previous messages');
  await f.locator('#visibleBtn').click();assert.equal(await f.locator('#chatwin').isHidden(),true);assert.equal(await f.locator('#chatBtn').isDisabled(),true);
  await f.locator('#visibleBtn').click();await f.locator('#chatBtn').click();
  await f.evaluate(()=>{document.documentElement.dataset.theme='dark';});await page.screenshot({path:path.join(output,`chat-dark-${width}.png`)});
  await f.locator('#chatClose').click();assert.equal(await f.locator('#chatwin').isHidden(),true);assert.equal(await f.locator('#legend').isVisible(),true);
  await f.locator('#chatBtn').press('Escape');assert.equal(await f.locator('#legend').isHidden(),true);
  await context.setGeolocation({longitude:-98,latitude:31});
  await f.waitForFunction(()=>!ChatRoom.room&&!document.querySelector('#placeList .place-group'));
  assert.match(await f.locator('#directoryStatus').innerText(),/outside/);
  await context.setGeolocation({longitude:-97.7431,latitude:30.2672});await ready(page);
  await page.reload();f=await ready(page);
  assert.equal(await f.locator('#neighborhoodBusinesses').evaluate(el=>el.open),false);assert.equal(await f.locator('#placeList details[open]').count(),0);
  assert.equal(await f.locator('#visibleBtn').getAttribute('aria-pressed'),'false');assert.equal(await f.locator('#chatwin').isHidden(),true);
  assert.deepEqual(errors,[]);console.log(`${width}px: collapsed business hierarchy, users/counts, room selection, inline messages, visibility, planner, popup, panel switching, GPS exit/return, refresh and layout passed.`);
  await context.close();
 }
 console.log('Screenshots: '+output);
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
