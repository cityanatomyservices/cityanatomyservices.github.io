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
  const email='qa-member-'+crypto.randomUUID()+'@example.invalid';
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
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(os.homedir(),'.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await contextFor(a),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/');let frame=await ready(page);await profileOpen(page);
  const nickname='AustinTester'+crypto.randomBytes(4).toString('hex');
  await page.locator('#member-handle').fill(nickname);await page.locator('#member-emoji').selectOption('🌵');await page.locator('#member-save-profile').click();
  await page.waitForFunction(()=>document.getElementById('member-profile-status').textContent==='Profile saved.');
  assert.equal((await rpc(a,'member_load',{})).profile.handle,nickname);
  const duplicate=await fetch(api+'/rest/v1/profiles',{method:'POST',headers:{...headers(b.session.access_token),Prefer:'resolution=merge-duplicates'},body:JSON.stringify({id:b.id,handle:nickname.toUpperCase(),emoji:'🙂'})});assert.equal(duplicate.status,409,'Nicknames are unique regardless of case');
  await frame.waitForFunction(name=>document.getElementById('youHandle').textContent.includes(name),nickname);
  await page.locator('#member-handle').fill('bad@email');await page.locator('#member-save-profile').click();
  await page.waitForFunction(()=>document.getElementById('member-profile-status').textContent.includes('3–30'));
  assert.equal((await rpc(a,'member_load',{})).profile.handle,nickname);await page.locator('#member-handle').fill(nickname);
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='#078570';ctx.fillRect(0,0,800,600);ctx.fillStyle='#fff';ctx.fillRect(320,180,160,240);return c.toDataURL('image/png').split(',')[1];});
  await page.locator('#member-photo').setInputFiles({name:'qa-avatar.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>document.getElementById('member-profile-status').textContent.startsWith('Picture uploaded.'));
  let snapshot=await rpc(a,'member_load',{});assert.equal(snapshot.profile.show_avatar,false);assert.equal(snapshot.profile.avatar_path,a.id+'/avatar.webp');
  let display=await rpc(b,'profile_display',{p_handle:nickname});assert.deepEqual(Object.keys(display).sort(),['avatar_path','emoji','handle']);assert.equal(display.avatar_path,null);
  const ownPath=api+'/storage/v1/object/authenticated/avatars/'+a.id+'/avatar.webp';
  const privateGet=await fetch(ownPath,{headers:headers(b.session.access_token)});assert.ok(!privateGet.ok,'Hidden photo cannot be downloaded by another account');
  const publicGet=await fetch(api+'/storage/v1/object/public/avatars/'+a.id+'/avatar.webp');assert.ok(!publicGet.ok,'Avatar bucket stays private');
  const ownGet=await fetch(ownPath,{headers:headers(a.session.access_token)});assert.ok(ownGet.ok);const picture=Buffer.from(await ownGet.arrayBuffer());assert.equal(picture.subarray(8,12).toString(),'WEBP');assert.ok(picture.length<=131072);
  const dimensions=await page.evaluate(async()=>{const url=await AustinMember.avatar(AustinMember.state.profile.handle,true),image=new Image();image.src=url;await image.decode();return [image.naturalWidth,image.naturalHeight];});assert.deepEqual(dimensions,[256,256]);
  const overwrite=await fetch(api+'/storage/v1/object/avatars/'+a.id+'/avatar.webp',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+b.session.access_token,'Content-Type':'image/webp','x-upsert':'true'},body:picture});assert.ok(!overwrite.ok,'Another user cannot replace an avatar');
  const oversize=await fetch(api+'/storage/v1/object/avatars/'+b.id+'/avatar.webp',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+b.session.access_token,'Content-Type':'image/webp'},body:Buffer.alloc(131073)});assert.ok(!oversize.ok,'Bucket enforces size limit');
  const htmlFile=await fetch(api+'/storage/v1/object/avatars/'+b.id+'/avatar.webp',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+b.session.access_token,'Content-Type':'text/html'},body:'<script>alert(1)</script>'});assert.ok(!htmlFile.ok,'Bucket rejects non-image MIME');
  await page.locator('#member-show-photo').check();await page.locator('#member-save-profile').click();await page.waitForFunction(()=>document.getElementById('member-profile-status').textContent==='Profile saved.');
  await frame.waitForFunction(()=>document.querySelector('#youHandle img')?.naturalWidth===256);
  display=await rpc(b,'profile_display',{p_handle:nickname});assert.equal(display.avatar_path,a.id+'/avatar.webp');assert.ok((await fetch(ownPath,{headers:headers(b.session.access_token)})).ok);
  const foreignProfile=await json(api+'/rest/v1/profiles?id=eq.'+a.id+'&select=*',undefined,headers(b.session.access_token));assert.deepEqual(foreignProfile,[],'Public nickname lookup must not open the private profile table');
  await page.locator('#member-show-photo').uncheck();await page.locator('#member-save-profile').click();await page.waitForFunction(()=>document.getElementById('member-profile-status').textContent==='Profile saved.');
  assert.equal((await rpc(a,'member_load',{})).profile.show_avatar,false,'Hidden flag reached the database');
  await frame.waitForFunction(()=>!document.querySelector('#youHandle img'));
  assert.equal((await rpc(b,'profile_display',{p_handle:nickname})).avatar_path,null,'Hidden photo not returned by public projection');
  const hiddenRead=await fetch(ownPath+'?check='+crypto.randomUUID(),{headers:headers(b.session.access_token)});
  assert.ok(!hiddenRead.ok,'Turning photo off blocks fresh authenticated downloads');
  console.log('Profile save, shared chat nickname, image processing, private bucket, visibility controls, upload limits and owner-only writes passed.');

  await page.locator('.account-close').click();
  await frame.locator('#ctrlApps').click();await frame.locator('#apps-panel .favorite-select').first().waitFor({state:'attached'});
  assert.ok((await frame.locator('#apps-panel .favorite-select').first().textContent()).includes('Favorite'),'Detached catalog cards initialize their Favorite labels');await frame.locator('#apps-panel .catalog-close').click();
  await frame.evaluate(()=>{const host=document.createElement('div');host.id='qa-favorite';host.style='position:fixed;bottom:10px;left:10px;z-index:9999;background:white';document.body.append(host);window.dispatchEvent(new CustomEvent('austin:planner-target',{detail:{container:host,provider:'place',data:{id:'qa-coffee',name:'Coffee for later',lat:30.27,lng:-97.74,website:'https://example.com'}}}));});
  assert.equal(await frame.evaluate(()=>PlanStore.plan.items.length),0);await frame.locator('#qa-favorite .favorite-select').click();
  await frame.waitForFunction(()=>document.querySelector('#qa-favorite .favorite-select').getAttribute('aria-pressed')==='true');assert.equal(await frame.evaluate(()=>PlanStore.plan.items.length),0);
  await profileOpen(page);await page.locator('[data-member-tab=favorites]').click();await page.getByRole('button',{name:'Add to Day Planner',exact:true}).click();
  await frame.waitForFunction(()=>PlanStore.plan.items.length===1);
  await page.locator('[data-member-tab=settings]').click();await page.locator('#member-theme').selectOption('dark');await page.locator('#member-navigation').selectOption('apple');await page.evaluate(()=>AustinVisit.settled());
  snapshot=await rpc(a,'member_load',{});assert.equal(snapshot.favorites.length,1);assert.equal(snapshot.preferences.theme,'dark');assert.equal(snapshot.preferences.navigation,'apple');
  const privateFavorites=await json(api+'/rest/v1/member_favorites?owner_id=eq.'+a.id,undefined,headers(b.session.access_token));assert.deepEqual(privateFavorites,[]);
  await page.locator('.account-close').click();
  await frame.evaluate(async()=>{const {createStore}=await import('/webtour/store.js?v=20261030c');window.qaTour=createStore('cityanatomy:1885murdertour:tour-v1');qaTour.markDone('qa-stop');});await page.evaluate(()=>AustinVisit.settled());
  assert.ok((await rpc(a,'member_load',{})).progress.some(p=>p.tour==='1885'&&p.stop_id==='qa-stop'));
  const fresh=await contextFor(a),restored=await fresh.newPage();await restored.goto(base+'/myplanmap/');const rf=await ready(restored);
  assert.equal(await restored.evaluate(()=>AustinMember.state.favorites.length),1);assert.equal(await restored.evaluate(()=>localStorage.getItem('theme')),'dark');assert.equal(await rf.evaluate(()=>PlanStore.plan.items.length),1);
  assert.ok(await restored.evaluate(()=>AustinMember.state.progress.some(p=>p.stop_id==='qa-stop')));
  await rf.evaluate(async()=>{await PlanStore.select({key:'qa-route-end',title:'The Domain',kind:'place',timing:'unknown',coordinates:[-97.7236,30.4019]},true);});
  await rf.locator('#build-day').click();await rf.locator('#plan-route').click();
  await rf.waitForFunction(()=>PlanRouting.state.done===1&&!PlanRouting.state.busy,{},{timeout:45000});
  await rf.waitForFunction(()=>window.__memberTestMap?.getLayer('planner-route-lines')&&__memberTestMap.queryRenderedFeatures(undefined,{layers:['planner-route-lines']}).length>0,{},{timeout:15000});
  assert.ok((await rf.locator('#route-status').textContent()).includes('1 of 1 journeys estimated'));
  console.log('Actual road calculation and rendered route line still work with the account modules.');
  await profileOpen(restored);await restored.screenshot({path:'/tmp/austin-member-phone.png'});await restored.setViewportSize({width:1440,height:950});await restored.screenshot({path:'/tmp/austin-member-desktop.png'});
  for(const width of [320,390]){await restored.setViewportSize({width,height:844});assert.ok(await restored.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await restored.locator('.account-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth));}
  console.log('Favorite buttons, independent planner selection, private saves, new-browser restore, synced preferences, tour progress and mobile layouts passed.');

  await page.getByRole('button',{name:'Account',exact:true}).click();await page.locator('#account-signout').click();await page.waitForFunction(()=>!AustinSession.registered&&AustinMember.state===null);await page.locator('.account-close').click();
  assert.equal(await page.evaluate(()=>AustinMember.has('place:qa-coffee')),false);
  assert.equal(await page.locator('#member-preview').textContent(),'','Sign-out clears even the closed profile preview');
  await frame.evaluate(async()=>{const {createStore}=await import('/webtour/store.js?v=20261030c');window.qaGuestTour=createStore('cityanatomy:1885murdertour:tour-v1');qaGuestTour.markDone('guest-only');});
  assert.equal(await frame.evaluate(()=>localStorage.getItem('cityanatomy:1885murdertour:tour-v1')),null);
  await page.reload();frame=await ready(page);assert.equal(await page.evaluate(()=>AustinSession.registered),false);
  assert.deepEqual(await frame.evaluate(async()=>{const {createStore}=await import('/webtour/store.js?v=20261030c');return createStore('cityanatomy:1885murdertour:tour-v1').doneIds;}),[]);
  const guestToken=await page.evaluate(async()=>(await AustinSession.ready()).access_token);
  const guestWrite=await fetch(api+'/rest/v1/member_favorites',{method:'POST',headers:headers(guestToken),body:JSON.stringify({owner_id:await page.evaluate(()=>AustinSession.user.id),source_key:'guest',source:{key:'guest',title:'Guest'}})});assert.ok(!guestWrite.ok);
  const rows=Array.from({length:200},(_,i)=>({owner_id:b.id,source_key:'qa-'+i,source:{key:'qa-'+i,title:'Cap test '+i}}));await json(api+'/rest/v1/member_favorites',rows,{...headers(b.session.access_token),Prefer:'return=representation'});
  const limit=await fetch(api+'/rest/v1/member_favorites',{method:'POST',headers:headers(b.session.access_token),body:JSON.stringify({owner_id:b.id,source_key:'qa-over-limit',source:{key:'qa-over-limit',title:'Over limit'}})});assert.ok(!limit.ok,'Favorite limit is enforced in Postgres');
  assert.equal((await rpc(b,'member_load',{})).favorites.length,200);
  await restored.locator('#member-remove-photo').click();await restored.waitForFunction(()=>document.getElementById('member-profile-status').textContent==='Picture deleted. Your emoji is shown instead.');
  assert.ok(!(await fetch(ownPath+'?deleted='+crypto.randomUUID(),{headers:headers(a.session.access_token)})).ok);assert.equal((await rpc(a,'member_load',{})).profile.avatar_path,null);
  const remaining=await json(api+'/storage/v1/object/list/avatars',{prefix:a.id,limit:10},headers(a.session.access_token));assert.equal(remaining.length,0,'Storage metadata is removed, not just the profile reference');
  assert.deepEqual(errors,[]);console.log('Sign-out isolation, guest reset, guest write denial, database Favorite cap and physical avatar deletion passed.');
  for(const [route,tour,global] of [['/apps/1885/','1885','MT1885_STOPS'],['/apps/moontower/','moontower','MOONTOWER_STOPS']]){
    const tourErrors=[];restored.on('pageerror',e=>tourErrors.push(e.message));await restored.goto(base+route);
    const tf=await(await restored.locator('#app-window').elementHandle()).contentFrame();
    await tf.waitForFunction(()=>document.querySelector('.maplibregl-canvas')&&document.querySelector('#chip-count')?.textContent);
    const stop=await tf.evaluate(g=>window[g].features[0].properties.id,global);
    await restored.evaluate(async({tour,stop})=>{await AustinMember.ready();await AustinMember.progress(tour,stop,true);},{tour,stop});
    await tf.waitForFunction(()=>Number(document.querySelector('#chip-count').textContent)>0);assert.deepEqual(tourErrors,[]);
  }
  console.log('Both actual tour pages load and react to saved account progress.');
}finally{
  if(browser)await browser.close();
  if(admin)for(const id of users){
    const remove=await fetch(api+'/storage/v1/object/avatars',{method:'DELETE',headers:admin,body:JSON.stringify({prefixes:[id+'/avatar.webp']})});if(!remove.ok)throw new Error('Disposable avatar cleanup failed');
    const r=await fetch(api+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:admin});if(!r.ok)throw new Error('Disposable member cleanup failed');
  }
  console.log('Disposable accounts and avatar files removed.');
}})().catch(error=>{console.error(error.message);process.exitCode=1;});
