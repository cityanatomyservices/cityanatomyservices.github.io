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
 const management=fs.readFileSync(path.join(os.homedir(),'.supabase/access-token'),'utf8').trim();const keys=await json(`https://api.supabase.com/v1/projects/${ref}/api-keys`,undefined,{Authorization:'Bearer '+management});const service=keys.find(k=>k.name==='service_role').api_key;admin={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 browser=await chromium.launch({executablePath:path.join(os.homedir(),'.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await contextFor(),page=await context.newPage();page.setDefaultTimeout(45000);
 const routes=process.env.MAP_ROUTES?.split(',')||['/apps/austin-pizza/','/apps/moontower/','/apps/1885/','/maps/datacenters/','/maps/aisd/','/maps/models/','/maps/budget/','/apps/parcels/','/maps/news/','/maps/moontower-demo/'];
 for(const route of routes){const errors=[];const listener=e=>errors.push(e.message);page.on('pageerror',listener);await page.goto(base+route);await page.getByRole('button',{name:/^(Sign In|Account)$/}).waitFor();assert.equal(await page.locator('.nav-toggle,.menu-toggle').count(),0);const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.locator('[data-map-ui-ready=true]').waitFor();if(await f.locator('.intro-nav').isVisible())await f.locator('.intro-nav').click();
  for(const id of ['ctrlApps','ctrlMedia','ctrlDayPlan','ctrlExplore']){await f.locator('#'+id).click();assert.equal(await f.locator('#'+id).getAttribute('aria-expanded'),'true');}
  await f.locator('.explore-close').click();
  if(route==='/apps/moontower/'||route==='/apps/1885/'){
    await f.locator('#ctrlTour').click();await f.locator('#btn-mode').click();await f.waitForFunction(()=>austinMap.getSource('explore-free-cheap')&&austinMap.isStyleLoaded());await f.locator('#ctrlTour').click();await f.locator('#ctrlChat').click();assert.equal(await f.locator('#planner-chat-host').isVisible(),true);await f.locator('#planner-chat-host').getByRole('button',{name:'Close',exact:true}).click();
  }
  assert.equal(await f.locator('.maplibregl-ctrl-top-left .maplibregl-ctrl-zoom-in').count(),1);assert.equal(await f.locator('.austin-map-ui button').filter({hasText:/^GPS$/}).count(),1);
  await page.screenshot({path:'/tmp/austin-'+route.split('/').filter(Boolean).join('-')+'.png'});assert.deepEqual(errors,[]);page.off('pageerror',listener);console.log(route+' frame, menus, GPS label, zoom position and phone layout passed.');
 }
 for(const route of ['/apps/','/maps/','/contact/','/content/','/apps/reports/','/budget/summary.html','/apps/reports/austin-bike-shops/report.html']){
  await page.goto(base+route);await page.getByRole('button',{name:/^(Sign In|Account)$/}).waitFor();assert.equal(await page.locator('.nav-toggle,.menu-toggle').count(),0);assert.equal(await page.locator('.topbar-home').count(),1);assert.equal(await page.locator('.home-footer').count(),1);
 }console.log('Directory, contact, content and reading-page frames passed.');
 // Guest plan selection from an auxiliary map must survive the switch to Day Planner.
 await page.goto(base+'/apps/austin-pizza/');let f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.locator('[data-map-ui-ready=true]').waitFor();await f.evaluate(async()=>{await PlanStore.ready();await PlanStore.select({key:'place:qa-map-transfer',title:'Guest transfer test',kind:'place',timing:'unknown',coordinates:[-97.743,30.267]},true);});await f.locator('#ctrlDayPlan').click();await f.locator('.plan-open').click();await page.waitForURL('**/myplanmap/');f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(()=>window.PlanStore?.plan.items.some(i=>i.source.key==='place:qa-map-transfer'));console.log('Guest plan survives catalog-map → Day Planner navigation.');
}finally{if(browser)await browser.close();if(admin)for(const id of users){const r=await fetch(api+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:admin});if(!r.ok)throw new Error('Disposable account cleanup failed');}console.log('Disposable guests removed.');}})().catch(e=>{console.error(e.stack);process.exitCode=1;});