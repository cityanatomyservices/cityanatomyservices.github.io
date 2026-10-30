/* Real Storage/RLS/account integration using only disposable accounts.
   No email is sent. Never logs session tokens or touches an owner's profile. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const base=process.argv[2]||'http://127.0.0.1:8765',ref='aqbyxpiwugcvoephsvpm',api=`https://${ref}.supabase.co`;
const key='sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN',users=new Set();let admin,browser;
const headers=token=>({apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'});
async function json(url,body,h,method=body===undefined?'GET':'POST'){
  const r=await fetch(url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
  if(!r.ok)throw new Error(`Test request ${new URL(url).pathname}: HTTP ${r.status}`);
  return r.status===204?null:r.json();
}
async function account(){
  const email='qa-comments-'+crypto.randomUUID()+'@example.invalid';
  const u=await json(api+'/auth/v1/admin/users',{email,email_confirm:true,user_metadata:{austin_auth_qa:true}},admin);users.add(u.id);
  const link=await json(api+'/auth/v1/admin/generate_link',{type:'magiclink',email},admin);
  const session=await json(api+'/auth/v1/verify',{type:'email',email,token:link.email_otp||link.properties.email_otp},{apikey:key,'Content-Type':'application/json'});
  return {id:u.id,email,session};
}
async function contextFor(member){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/planner/map.js?*',async route=>{const response=await route.fetch();await route.fulfill({response,body:'const TestMap=maplibregl.Map;maplibregl.Map=class extends TestMap{constructor(...args){super(...args);window.__memberTestMap=this;}};\n'+await response.text()});});
  if(member)await context.addInitScript(s=>{if(window===window.top&&!sessionStorage.getItem('qa-initialized')){localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(s));sessionStorage.setItem('qa-initialized','yes');}},member.session);
  context.on('response',async r=>{if(r.url().includes('/auth/v1/signup'))try{const d=await r.json();if(d.user?.id)users.add(d.user.id);}catch(_){};});
  return context;
}
async function ready(page){await page.waitForFunction(()=>window.AustinMember);await page.evaluate(()=>AustinMember.ready());const frame=await(await page.locator('#app-window').elementHandle()).contentFrame();await frame.waitForFunction(()=>window.PlanStore);await frame.evaluate(()=>PlanStore.ready());return frame;}
async function profileOpen(page){await page.getByRole('button',{name:'Account',exact:true}).click();await page.locator('#member-profile-fields').waitFor();await page.waitForFunction(()=>!document.getElementById('member-profile-fields').disabled);}
const rpc=(member,name,body)=>json(api+'/rest/v1/rpc/'+name,body,headers(member.session.access_token));
(async()=>{try{
  const management=fs.readFileSync(path.join(os.homedir(),'.supabase/access-token'),'utf8').trim();
  const keys=await json(`https://api.supabase.com/v1/projects/${ref}/api-keys`,undefined,{Authorization:'Bearer '+management});
  const service=keys.find(k=>k.name==='service_role').api_key;admin={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const a=await account(),b=await account();
  browser=await chromium.launch({executablePath:path.join(os.homedir(),'.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const ctx=await contextFor(a),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));page.on('dialog',d=>d.accept());
  await page.goto(base+'/myplanmap/');let f=await ready(page);
  const business={id:'qa-comments-'+crypto.randomUUID(),name:'Comments test place',lat:30.2672,lng:-97.7431,address:'Austin TX'},sourceKey='place:'+business.id;
  await f.evaluate(async business=>{await PlanStore.select(PlanSources.place(business),true);await PlanStore.edit(p=>{p.items[0].schedule.note='Private planning note';});},business);
  const comments=f.locator('.plan-item > .place-comments');await comments.locator('summary').click();await comments.locator('textarea').fill('Helpful public tip <img src=x onerror=alert(1)>');await comments.getByRole('button',{name:'Post comment',exact:true}).click();
  await comments.getByText('Comment posted.',{exact:true}).waitFor();
  assert.equal(await comments.locator('.comment-body img').count(),0);
  let rows=await rpc(b,'place_comments_list',{p_source_key:sourceKey});assert.equal(rows.length,1);assert.equal(rows[0].mine,false);assert.ok(!JSON.stringify(rows).includes(a.id));assert.ok(!JSON.stringify(rows).includes(a.email));assert.ok(!JSON.stringify(rows).includes('Private planning note'));
  const id=rows[0].id;
  const otherRead=await json(api+'/rest/v1/place_comments?id=eq.'+id,undefined,headers(b.session.access_token));assert.deepEqual(otherRead,[]);
  const otherEdit=await json(api+'/rest/v1/place_comments?id=eq.'+id,{body:'Not mine'},{...headers(b.session.access_token),Prefer:'return=representation'},'PATCH');assert.deepEqual(otherEdit,[]);
  const otherDelete=await json(api+'/rest/v1/place_comments?id=eq.'+id,undefined,{...headers(b.session.access_token),Prefer:'return=representation'},'DELETE');assert.deepEqual(otherDelete,[]);
  for(const body of [{source_key:sourceKey,body:'   '},{source_key:sourceKey,body:'x'.repeat(2001)},{source_key:sourceKey,body:'spoof',author_id:b.id}]){const denied=await fetch(api+'/rest/v1/place_comments',{method:'POST',headers:headers(a.session.access_token),body:JSON.stringify(body)});assert.ok(!denied.ok);}
  await comments.getByRole('button',{name:'Edit',exact:true}).click();await comments.locator('textarea').fill('Updated helpful tip');await comments.getByRole('button',{name:'Save comment',exact:true}).click();await comments.getByText('Comment updated.',{exact:true}).waitFor();
  await comments.locator('textarea').fill('Draft survives schedule edits');await f.locator('#build-day').click();assert.equal(await comments.locator('textarea').inputValue(),'Draft survives schedule edits');
  await f.locator('.stop-details summary').click();await f.locator('.share-note').click();assert.equal(await comments.locator('textarea').inputValue(),'Private planning note');assert.equal((await rpc(a,'place_comments_list',{p_source_key:sourceKey})).length,1);
  await comments.getByRole('button',{name:'Post comment',exact:true}).click();await comments.getByText('Comment posted.',{exact:true}).waitFor();assert.equal((await rpc(a,'place_comments_list',{p_source_key:sourceKey})).length,2);
  await f.evaluate(()=>PlanMap.focus(PlanStore.plan.items[0].id));const popup=f.locator('.planner-popup');await popup.waitFor();const directions=popup.getByRole('link',{name:/Directions/});assert.equal(await directions.getAttribute('target'),'_blank');assert.match(await directions.getAttribute('href'),/google.com\/maps\/dir\/.*destination=30.2672%2C-97.7431/);
  await popup.locator('summary').click();await popup.getByText('Updated helpful tip',{exact:true}).waitFor();await popup.locator('.maplibregl-popup-close-button').click();
  for(const id of ['ctrlApps','ctrlMedia','ctrlDayPlan','ctrlExplore']){await f.locator('#'+id).click();assert.equal(await f.locator('#'+id).getAttribute('aria-expanded'),'true');}
  await f.locator('.explore-close').click();await f.waitForFunction(()=>austinExplore.visibleItems.length>0);await f.locator('#ctrlSatellite').click();assert.equal(await f.evaluate(()=>__memberTestMap.getLayoutProperty('satellite','visibility')),'visible');await f.locator('#ctrlSatellite').click();await f.locator('#ctrlTilt').click();assert.equal(await f.locator('#ctrlTilt').textContent(),'2D');await f.locator('#ctrlExtent').click();
  assert.equal(await f.locator('#fit-plan,#chat-launch').count(),0);assert.equal(await f.locator('#map-caption').isVisible(),false);assert.equal(await f.locator('.maplibregl-ctrl-top-left .maplibregl-ctrl-zoom-in').count(),1);
  await f.evaluate(async()=>PlanStore.select({key:'place:qa-domain',title:'The Domain',kind:'place',timing:'unknown',coordinates:[-97.7236,30.4019]},true));await f.locator('#plan-panel-toggle').click();await f.locator('#build-day').click();await f.locator('#plan-route').click();await f.waitForFunction(()=>__memberTestMap.queryRenderedFeatures({layers:['planner-route-lines']}).length>0,{},{timeout:60000});await f.locator('#plan-panel-toggle').click();await f.locator('#ctrlSatellite').click();await f.waitForFunction(()=>__memberTestMap.queryRenderedFeatures({layers:['planner-route-lines']}).length>0);await page.screenshot({path:'/tmp/austin-planner-controls-phone.png'});
  console.log('Comments create/edit/read, private notes, explicit sharing, permissions, validation, route rendering and planner controls passed.');
  const guestCtx=await contextFor(),guestPage=await guestCtx.newPage();await guestPage.goto(base+'/myplanmap/');const gf=await ready(guestPage);await gf.evaluate(async business=>PlanStore.select(PlanSources.place(business),true),business);await gf.locator('.plan-item .place-comments summary').click();await gf.getByText('Updated helpful tip',{exact:true}).waitFor();assert.equal(await gf.locator('.place-comments form').isVisible(),false);const token=await guestPage.evaluate(async()=>(await AustinSession.ready()).access_token);const denied=await fetch(api+'/rest/v1/place_comments',{method:'POST',headers:headers(token),body:JSON.stringify({source_key:sourceKey,body:'Guest'})});assert.ok(!denied.ok);
  const anonRows=await json(api+'/rest/v1/rpc/place_comments_list',{p_source_key:sourceKey},{apikey:key,'Content-Type':'application/json'});assert.equal(anonRows.length,2);assert.ok(anonRows.every(x=>!x.mine));
  // Main business popup mounts the same thread. Use the existing room UI with
  // a synthetic test business, so no real public listing gets a test comment.
  await ctx.grantPermissions(['geolocation']);await ctx.setGeolocation({latitude:30.2672,longitude:-97.7431});await page.goto(base+'/');f=await ready(page);await f.waitForFunction(()=>window.ChatRoom?.room);await f.locator('#ctrlChat').click();await f.evaluate(business=>{const b=document.createElement('button');b.dataset.room='qa';b.innerHTML='<span class=here></span>';b.dataset.place=JSON.stringify(business);document.getElementById('placeList').append(b);b.click();},business);
  await f.locator('.place-popup .place-comments summary').click();await f.locator('.place-popup').getByText('Updated helpful tip',{exact:true}).waitFor();
  await f.locator('.place-popup .place-comments textarea').fill('Draft must clear on sign out');await page.evaluate(()=>AustinSession.signOut());await f.waitForFunction(()=>!document.querySelector('.place-popup .place-comments textarea')?.value);assert.equal(await f.locator('.place-popup .place-comments form').isVisible(),false);
  console.log('Guest read/denied writes, shared neighborhood popup thread and sign-out draft isolation passed.');
  // An account cannot bypass the posting cap through the raw REST API.
  await json(api+'/rest/v1/place_comments',Array.from({length:20},(_,i)=>({source_key:sourceKey,body:'Limit test '+i})),{...headers(b.session.access_token),Prefer:'return=representation'});const limited=await fetch(api+'/rest/v1/place_comments',{method:'POST',headers:headers(b.session.access_token),body:JSON.stringify({source_key:sourceKey,body:'Over limit'})});assert.ok(!limited.ok);
  await json(api+'/rest/v1/place_comments?id=eq.'+id,undefined,{...headers(a.session.access_token),Prefer:'return=representation'},'DELETE');assert.ok(!(await rpc(a,'place_comments_list',{p_source_key:sourceKey})).some(x=>x.id===id));assert.deepEqual(errors,[]);
  console.log('Database posting limit and owner deletion passed.');
}finally{if(browser){for(const context of browser.contexts())await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();}if(admin)for(const id of users){const r=await fetch(api+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:admin});if(!r.ok)throw new Error('Disposable account cleanup failed');}console.log('Disposable accounts/comments removed.');}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
