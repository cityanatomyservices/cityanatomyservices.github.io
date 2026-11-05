/* Real catalog renderer: guest, Free, Pro, expiry and sign-out. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:executablePath()});
 try{
  const page=await browser.newPage();
  await page.route('https://fixture.test/**',route=>{
   const name=new URL(route.request().url()).pathname;
   if(name.endsWith('.json'))return route.fulfill({contentType:'application/json',body:fs.readFileSync(path.join(root,name),'utf8')});
   return route.fulfill({contentType:'text/html',body:'<div class="page"><button id="ctrlApps">Apps</button></div>'});
  });
  await page.goto('https://fixture.test/');
  await page.evaluate(()=>{
   const callbacks=[],members=[];
   window.AustinSession={registered:false,subscribe:fn=>callbacks.push(fn),peek:async()=>{}};
   window.AustinMembership={state:null,subscribe:fn=>members.push(fn),load:async()=>AustinMembership.state};
   window.setMember=(registered,plan,expired=false)=>{AustinSession.registered=registered;AustinMembership.state={plan,paidThrough:new Date(Date.now()+(expired?-1:1)*3600000).toISOString()};callbacks.forEach(fn=>fn());members.forEach(fn=>fn());};
  });
  await page.addScriptTag({path:path.join(root,'chat/catalog-menu.js')});
  assert.equal(await page.locator('#ctrlApps').isDisabled(),true);
  await page.evaluate(()=>setMember(true,'free'));await page.locator('#ctrlApps').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-pro-app]').length===9);
  assert.equal(await page.locator('[data-pro-app][aria-disabled=true]').count(),9);
  assert.equal(await page.locator('[data-pro-app][href]').count(),0);
  assert.ok((await page.locator('[data-pro-app]').allTextContents()).every(s=>s.endsWith('Pro App')));
  await page.evaluate(()=>setMember(true,'pro'));
  assert.equal(await page.locator('[data-pro-app][href]').count(),9);
  await page.evaluate(()=>setMember(true,'pro',true));assert.equal(await page.locator('[data-pro-app][href]').count(),0);
  await page.evaluate(()=>setMember(false,'free'));
  assert.equal(await page.locator('#ctrlApps').isDisabled(),true);assert.equal(await page.locator('#apps-panel').isHidden(),true);
  console.log('Apps catalog: guest disabled; Free locks all nine Pro Apps; paid Pro enables them; expiry and sign-out revoke links.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
