/* Real hosted UI/worker with a temporary account supplied only through stdin. */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs');
(async()=>{
 let input='';for await(const part of process.stdin)input+=part;const fixture=JSON.parse(input);
 const browser=await chromium.launch({headless:true,executablePath:executablePath(),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:1100,height:850}});
  await context.addInitScript(session=>{if(location.origin==='https://austin.chat'&&!sessionStorage.getItem('pro-fixture-installed')){localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(session));sessionStorage.setItem('pro-fixture-installed','yes');}},fixture.session);
  const page=await context.newPage();page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [url,app] of Object.entries(fixture.apps)){
   await page.goto('https://austin.chat'+url,{waitUntil:'domcontentloaded'});
   await page.locator('#app-window').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.querySelector('#app-window')?.getAttribute('src')?.startsWith('https://austin.chat/'));
   const frame=await(await page.locator('#app-window').elementHandle()).contentFrame();
   await frame.waitForURL('**'+app.entry+'*');
   await frame.locator('.maplibregl-canvas').waitFor();
   if(app.entry.endsWith('map.html'))await frame.waitForFunction(()=>window.shopMap?.loaded());
   assert.equal(await page.locator('.pro-app-gate').isHidden(),true);
   console.log('Protected app opened: '+url);
  }
  await page.goto('https://austin.chat/',{waitUntil:'domcontentloaded'});
  const frame=await(await page.locator('#app-window').elementHandle()).contentFrame();
  await frame.locator('#ctrlApps').click();await frame.waitForFunction(()=>document.querySelectorAll('[data-pro-app][href]').length===9);
  await frame.locator('#apps-panel details').first().evaluate(e=>e.open=true);
  await page.screenshot({path:path.join(os.tmpdir(),'austin-pro-apps-live.png')});
  assert.deepEqual(await page.evaluate(()=>caches.keys()),[]);
  await page.evaluate(()=>AustinSession.client().auth.signOut());
  await frame.waitForFunction(()=>document.getElementById('ctrlApps').disabled);
  await page.goto('https://austin.chat/apps/1885/',{waitUntil:'domcontentloaded'});
  await page.locator('.pro-app-gate p').filter({hasText:'Sign in'}).waitFor();
  assert.equal(await page.locator('#app-window').isHidden(),true);
  assert.deepEqual(errors,[]);
  console.log('Live Pro catalog enables nine apps; signing out disables Apps and direct wrapper access. No app content cached.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
