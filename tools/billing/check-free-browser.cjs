/* Published Free-member UI. Session arrives only via stdin; never click Buy. */
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs');
(async()=>{
 let input='';for await(const part of process.stdin)input+=part;const session=JSON.parse(input);
 const browser=await chromium.launch({headless:true,executablePath:executablePath(),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(session=>{if(location.origin==='https://austin.chat')localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(session));},session);
  const page=await context.newPage();page.setDefaultTimeout(45000);
  await page.goto('https://austin.chat/',{waitUntil:'domcontentloaded'});
  const frame=await(await page.locator('#app-window').elementHandle()).contentFrame();
  await frame.locator('#ctrlApps').click();await frame.waitForFunction(()=>document.querySelectorAll('[data-pro-app]').length===9);
  assert.equal(await frame.locator('[data-pro-app][href]').count(),0);
  assert.equal(await frame.locator('[data-pro-app][aria-disabled=true]').count(),9);
  await frame.locator('#apps-panel details').first().evaluate(e=>e.open=true);
  await page.screenshot({path:path.join(os.tmpdir(),'austin-free-apps-live.png')});
  await page.evaluate(()=>AustinAccount.open('membership'));
  await page.locator('.membership-current').filter({hasText:'Your plan: Free'}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('.membership-upgrade').disabled);
  assert.equal(await page.locator('.membership-levels > div').count(),2);
  assert.match(await page.locator('.membership-upgrade').innerText(),/\$8\/month/);
  await page.screenshot({path:path.join(os.tmpdir(),'austin-free-membership-live.png')});
  await page.goto('https://austin.chat/apps/moontower/',{waitUntil:'domcontentloaded'});
  await page.locator('.pro-app-gate p').filter({hasText:'$8 per month'}).waitFor();
  assert.equal(await page.locator('#app-window').isHidden(),true);
  console.log('Live phone UI: Free opens Apps, nine Pro App links locked, exactly two plans, $8 upgrade enabled, direct app gated. No purchase clicked.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
