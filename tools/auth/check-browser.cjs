/* Explicit integration check against disposable Supabase accounts.
   Email delivery and Google consent are simulated; Supabase OTP verification,
   private saves, restored sessions and logout are real. No email is sent. */
const {chromium}=require('../video/node_modules/playwright-core');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const M=require('../../planner/model.js'),Sources=require('../../planner/sources.js');
const base=process.argv[2]||'http://127.0.0.1:8765',ref='aqbyxpiwugcvoephsvpm',api=`https://${ref}.supabase.co`;
const publishable='sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN';
const users=new Set();let adminKey,browser;
const chromiumPath=process.env.CHROMIUM_PATH||path.join(os.homedir(),'.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');
async function request(url,body,headers={}){
 const response=await fetch(url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok)throw new Error(`Test service request failed: HTTP ${response.status} at ${new URL(url).pathname}`);
 return response.status===204?null:response.json();
}
const adminHeaders=()=>({apikey:adminKey,Authorization:'Bearer '+adminKey});
async function account(label){
 const email=`qa-austin-auth-${crypto.randomUUID()}@example.invalid`;
 const user=await request(api+'/auth/v1/admin/users',{email,email_confirm:true,user_metadata:{austin_auth_qa:true}},adminHeaders());
 users.add(user.id);
 const response=await fetch(api+'/rest/v1/profiles',{method:'POST',headers:{...adminHeaders(),'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify({id:user.id,handle:label,emoji:'🙂'})});
 assert.ok(response.ok,'Test nickname could be created');return {email,id:user.id};
}
async function code(email){const data=await request(api+'/auth/v1/admin/generate_link',{type:'magiclink',email},adminHeaders());const value=data.email_otp||data.properties?.email_otp;assert.equal(typeof value,'string');return value;}
async function tokenFor(email){return request(api+'/auth/v1/verify',{email,token:await code(email),type:'email'},{apikey:publishable});}
const frameOf=async page=>(await page.locator('#app-window').elementHandle()).contentFrame();
async function ready(page){const frame=await frameOf(page);await frame.waitForFunction(()=>window.PlanStore);await frame.evaluate(()=>PlanStore.ready());return frame;}
async function addStop(frame,title){await frame.evaluate(title=>PlanStore.select({key:title,title,kind:'place',timing:'unknown',coordinates:[-97.75,30.26]},true),title);}
async function emailSignIn(page,email,getCode){
 await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.locator('#account-email').fill(email);
 await page.locator('#account-send').click();await page.locator('#account-code-form').waitFor({state:'visible'});
 await page.locator('#account-code').fill(getCode());await page.locator('#account-verify').click();
 await page.waitForFunction(()=>AustinSession.registered);await page.waitForFunction(()=>!document.querySelector('#account-signout').disabled);
 await page.locator('.account-close').click();
}
async function signOut(page){await page.getByRole('button',{name:'Account',exact:true}).click();await page.locator('#account-signout').click();await page.waitForFunction(()=>!AustinSession.registered);await page.locator('.account-close').click();}
(async()=>{try{
 const management=fs.readFileSync(path.join(os.homedir(),'.supabase/access-token'),'utf8').trim();
 const keys=await request(`https://api.supabase.com/v1/projects/${ref}/api-keys`,undefined,{Authorization:'Bearer '+management});adminKey=keys.find(key=>key.name==='service_role').api_key;
 const a=await account('AuthTestOne'+Date.now()),b=await account('AuthTestTwo'+Date.now());
 const bSession=await tokenFor(b.email),saved=M.empty(crypto.randomUUID());saved.items=[{...Sources.item({key:'account-b-saved',title:'Already saved in B',kind:'place',timing:'unknown',coordinates:[-97.7,30.3]},crypto.randomUUID()),day:saved.date}];
 const {items,...settings}=saved;await request(api+'/rest/v1/rpc/planner_save',{p_id:saved.id,p_revision:0,p_settings:settings,p_items:items},{apikey:publishable,Authorization:'Bearer '+bSession.access_token});
 browser=await chromium.launch({executablePath:chromiumPath,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:950}}),errors=[];let sentCode='',sentEmail='';
 context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
 context.on('response',async response=>{if(response.url().includes('/auth/v1/signup'))try{const data=await response.json();if(data.user?.id)users.add(data.user.id);}catch(_){};});
 await context.route('**/auth/v1/signup',route=>{const body=route.request().postDataJSON();body.data={...body.data,austin_auth_qa:true};return route.continue({postData:JSON.stringify(body)});});
 await context.route('**/auth/config.json',route=>route.fulfill({json:{emailEnabled:true}}));
 await context.route('**/auth/v1/settings',async route=>{const response=await route.fetch(),json=await response.json();json.external.google=true;await route.fulfill({json});});
 await context.route('**/auth/v1/otp',async route=>{sentEmail=route.request().postDataJSON().email;sentCode=await code(sentEmail);await route.fulfill({json:{}});});
 const page=await context.newPage();await page.goto(base+'/');let frame=await ready(page);
 assert.equal(await frame.evaluate(()=>AustinSession===parent.AustinSession),true);
 await addStop(frame,'Guest coffee');await addStop(frame,'Guest concert');
 await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.locator('#account-email').fill(a.email);await page.locator('#account-send').click();await page.locator('#account-code-form').waitFor({state:'visible'});
 assert.equal(sentEmail,a.email);assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('auth-token')||k.startsWith('austin:planner:'))),false);
 const wrong=(Number(sentCode[0])+1)%10+sentCode.slice(1);await page.locator('#account-code').fill(wrong);await page.locator('#account-verify').click();await page.waitForFunction(()=>document.querySelector('#account-status').textContent.includes('invalid or expired'));
 assert.equal(await frame.evaluate(()=>PlanStore.plan.items.length),2);
 await page.locator('#account-code').fill(sentCode);await page.locator('#account-verify').click();await page.waitForFunction(()=>AustinSession.registered);await page.waitForFunction(()=>!document.querySelector('#account-signout').disabled);await page.locator('.account-close').click();
 await frame.waitForFunction(()=>!PlanStore.temporary&&!PlanStore.unsaved);assert.equal(await frame.evaluate(()=>PlanStore.plan.items.length),2);
 await frame.waitForFunction(()=>document.querySelector('#youHandle').textContent.includes('AuthTestOne'));
 assert.equal(await frame.evaluate(email=>document.body.innerText.includes(email),a.email),false);
 await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('austin:planner:'))localStorage.removeItem(key);});
 await page.reload();frame=await ready(page);assert.equal(await frame.evaluate(()=>PlanStore.plan.items.length),2);assert.equal(await page.evaluate(()=>AustinSession.registered),true);
 const other=await context.newPage();await other.goto(base+'/myplanmap/');const otherFrame=await ready(other);assert.equal(await otherFrame.evaluate(()=>PlanStore.plan.items.length),2);
 await signOut(page);await frame.waitForFunction(()=>PlanStore.temporary&&PlanStore.plan.items.length===0);await otherFrame.waitForFunction(()=>PlanStore.temporary&&PlanStore.plan.items.length===0);
 await addStop(frame,'Guest addition for B');await emailSignIn(page,b.email,()=>sentCode);await frame.waitForFunction(()=>!PlanStore.temporary&&!PlanStore.unsaved);
 assert.deepEqual((await frame.evaluate(()=>PlanStore.book.items.map(i=>i.source.title))).sort(),['Already saved in B','Guest addition for B']);
 await frame.waitForFunction(()=>document.querySelector('#youHandle').textContent.includes('AuthTestTwo'));
 await other.close();await signOut(page);
 console.log('Real Supabase email-code verification, guest-to-account merge, cloud restore, cross-tab logout and two-account isolation passed. No email sent.');

 // Google uses the real SDK and callback transport, with consent/token exchange mocked.
 let authorize,exchangeCount=0,hold=true,release;
 const held=new Promise(resolve=>{release=resolve;});
 await context.route('**/auth/v1/authorize?*',async route=>{
   const url=new URL(route.request().url());authorize=url;if(hold)await held;
   const target=new URL(url.searchParams.get('redirect_to'));target.searchParams.set('code','qa-google-code');
   try{await route.fulfill({status:302,headers:{location:target.href}});}catch(_){}
 });
 await context.route('**/auth/v1/token?grant_type=pkce',async route=>{
   exchangeCount++;const body=route.request().postDataJSON();assert.equal(body.auth_code,'qa-google-code');
   assert.ok(crypto.createHash('sha256').update(body.code_verifier).digest('base64url')===authorize.searchParams.get('code_challenge'),'The SDK must supply the matching PKCE verifier');
   await route.fulfill({json:await tokenFor(a.email)});
 });
 await addStop(frame,'Google guest stop');await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.locator('#account-google').click();
 while(!authorize)await new Promise(resolve=>setTimeout(resolve,50));
 const attempt=new URL(authorize.searchParams.get('redirect_to')).searchParams.get('attempt');
 await page.evaluate(attempt=>{const channel=new BroadcastChannel('austin-sign-in:'+attempt);channel.postMessage({type:'austin-oauth-callback',attempt:'wrong-attempt',code:'bad-code',error:''});channel.close();window.dispatchEvent(new MessageEvent('message',{origin:'https://example.invalid',source:window,data:{type:'austin-oauth-callback',attempt,code:'bad-code',error:''}}));},attempt);
 await page.waitForTimeout(200);assert.equal(exchangeCount,0);await page.locator('#account-cancel-google').click();assert.equal(await page.evaluate(()=>AustinSession.registered),false);assert.equal(await frame.evaluate(()=>PlanStore.plan.items.length),1);release();hold=false;authorize=null;
 await page.locator('#account-google').click();await page.waitForFunction(()=>AustinSession.registered);await page.waitForFunction(()=>!document.querySelector('#account-signout').disabled);
 assert.equal(exchangeCount,1);await frame.waitForFunction(()=>!PlanStore.temporary&&!PlanStore.unsaved);assert.equal(await frame.evaluate(()=>PlanStore.plan.items.length),3);
 await page.locator('.account-close').click();
 console.log('Google popup cancellation, nonce/origin rejection, PKCE verifier and callback completion passed with simulated Google consent.');
 await context.unroute('**/auth/v1/authorize?*');await context.unroute('**/auth/v1/token?grant_type=pkce');
 await context.route('**/auth/v1/logout?*',route=>route.fulfill({status:503,json:{message:'simulated offline'}}));await signOut(page);assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('auth-token'))),false);
 await page.getByRole('button',{name:'Sign In',exact:true}).click();
 for(const [width,height,theme] of [[1440,950,'light'],[390,844,'light'],[320,667,'dark']]){
   await page.setViewportSize({width,height});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;localStorage.setItem('theme',theme);},theme);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('.account-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
   await page.screenshot({path:`/tmp/austin-account-${width}.png`});
 }
 await page.keyboard.press('Escape');assert.equal(await page.locator('.account-dialog').isVisible(),false);assert.deepEqual(errors,[]);
 console.log('Offline local sign-out, dialog keyboard behavior and responsive layouts passed.');
}finally{
 if(browser)await browser.close();
 if(adminKey)for(const id of users){const response=await fetch(api+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:adminHeaders()});if(!response.ok)throw new Error('Disposable auth test account cleanup failed');}
 console.log('Disposable auth review accounts removed.');
}})().catch(error=>{console.error(error.message);process.exitCode=1;});
