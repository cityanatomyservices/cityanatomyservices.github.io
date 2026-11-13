/* Published UI, disposable account supplied via stdin. GPS is a controlled fixture. */
const assert=require('node:assert/strict'),os=require('node:os'),path=require('node:path');
const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs');
(async()=>{
 let input='';for await(const part of process.stdin)input+=part;const session=JSON.parse(input);
 const browser=await chromium.launch({executablePath:executablePath(),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['geolocation'],geolocation:{latitude:30.2672,longitude:-97.7431,accuracy:5}});
  await context.addInitScript(session=>{if(location.origin==='https://austin.chat')localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(session));},session);
  let stripeRequests=0;await context.route('https://*.stripe.com/**',r=>{stripeRequests++;return r.abort();});
  const page=await context.newPage();page.setDefaultTimeout(45000);
  await page.goto('https://austin.chat/geofences/manage/',{waitUntil:'domcontentloaded'});
  await page.locator('#geo-pricing').filter({hasText:'Free while testing'}).waitFor();
  await page.getByRole('button',{name:'Account',exact:true}).click();await page.locator('.membership-upgrade').filter({hasText:'Free while testing'}).waitFor();
  assert.match(await page.locator('.membership-price').innerText(),/normally \$5\/month/);
  await page.locator('.membership-upgrade').click();await page.locator('.membership-current').filter({hasText:'Pro — free while testing'}).waitFor();
  assert.equal(await page.locator('.membership-manage').isHidden(),true);await page.screenshot({path:path.join(os.tmpdir(),'austin-pro-free-live.png')});await page.locator('.account-close').click();
  await page.locator('[name=name]').fill('Disposable free testing check');await page.locator('[name=description]').fill('Temporary verification fixture. Removed after this check.');
  await page.locator('#geo-gps').click();await page.locator('#geo-form-status').filter({hasText:'Current location selected'}).waitFor();
  assert.equal(await page.locator('[name=latitude]').inputValue(),'30.267200');assert.equal(await page.locator('[name=longitude]').inputValue(),'-97.743100');
  await page.locator('#geo-gps').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(os.tmpdir(),'austin-geofence-gps-live.png')});
  await page.locator('#geo-preview').click();await page.locator('#geo-confirm').check();await page.locator('#geo-pay').click();
  await page.locator('#geo-owned').filter({hasText:'Active · Free while testing'}).waitFor();assert.equal(await page.locator('#geo-owned .geofence-qr svg').count(),1);
  assert.equal(new URL(page.url()).pathname,'/geofences/manage/');await page.screenshot({path:path.join(os.tmpdir(),'austin-geofence-free-live.png')});
  const link=await page.locator('#geo-owned .geofence-link').getAttribute('href');await page.goto(link,{waitUntil:'domcontentloaded'});await page.locator('#geo-room').waitFor();
  await page.locator('#geo-manage').waitFor();await page.locator('#geo-chat-toggle').click();await page.locator('#geo-join').click();await page.locator('#geo-chat-content').waitFor();await page.locator('#geo-message').fill('Free testing verification');await page.locator('#geo-send').click();await page.locator('#geo-messages').filter({hasText:'Free testing verification'}).waitFor();await page.locator('#geo-leave').click();
  await page.goto('https://austin.chat/apps/moontower/',{waitUntil:'domcontentloaded'});await page.locator('#app-window').waitFor();
  const frame=await(await page.locator('#app-window').elementHandle()).contentFrame();await frame.waitForFunction(()=>document.title==='Moontower'&&document.querySelector('#map'),null,{timeout:60000});assert.equal(await page.locator('.pro-app-gate').isHidden(),true);
  await page.goto('https://austin.chat/',{waitUntil:'domcontentloaded'});const main=await(await page.locator('#app-window').elementHandle()).contentFrame();await main.locator('#ctrlProApps').waitFor({state:'attached'});if(await main.locator('#ctrlProApps').isHidden())await main.locator('#ctrlExplore').click();await main.locator('#ctrlProApps').click();await main.waitForFunction(()=>document.querySelectorAll('[data-pro-app][href]').length===9);
  assert.equal(stripeRequests,0);console.log('Published phone UI passed: GPS center, free creation and QR, live geofence chat, free Pro activation, protected app and all nine menu links. No Stripe navigation.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message.replace(/https?:\/\/\S+/g,'[private URL]'));process.exitCode=1;});
