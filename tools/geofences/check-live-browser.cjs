/* Real published phone form/session/backend; never initiates live Checkout. */
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs');
(async()=>{
 let input='';for await(const part of process.stdin)input+=part;
 const session=JSON.parse(input);
 const browser=await chromium.launch({headless:true,executablePath:executablePath(),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(session=>{if(location.origin==='https://austin.chat')localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(session));},session);
  let checkoutRequests=0;
  await context.route('**/functions/v1/geofences',route=>{
   if(route.request().method()==='POST'&&route.request().postDataJSON()?.action==='checkout'){
    checkoutRequests++;return route.abort();
   }
   return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(45000);
  await page.goto('https://austin.chat/geofences/manage/',{waitUntil:'domcontentloaded'});
  await page.locator('#geo-member').waitFor();
  await page.locator('#geo-owned .geofence-qr svg').waitFor();
  assert.equal(await page.locator('#geo-owned').getByRole('button',{name:'Continue to payment · $10/month',exact:true}).isEnabled(),true);
  assert.doesNotMatch(await page.locator('#geo-form-status').innerText(),/payments are being set up/i);
  await page.getByRole('button',{name:'Account',exact:true}).click();
  await page.locator('.account-geofences').waitFor();
  assert.match(await page.locator('.account-geofences').innerText(),/\$10\/month/);
  await page.locator('.account-close').click();
  await page.locator('[name=name]').fill('Live preview verification');
  await page.locator('[name=mode][value=coordinates]').check();
  assert.equal(await page.locator('[name=address]').isDisabled(),true);
  await page.locator('[name=latitude]').fill('30.2672');
  await page.locator('[name=longitude]').fill('-97.7431');
  await page.locator('[name=diameter]').fill('50');
  await page.locator('#geo-preview').click();
  await page.locator('#geo-form-status').filter({hasText:'Check the circle'}).waitFor();
  assert.equal(await page.locator('#geo-pay').isDisabled(),true);
  await page.locator('#geo-confirm').check();
  assert.equal(await page.locator('#geo-pay').isEnabled(),true);
  assert.match(await page.locator('#geo-pay').innerText(),/\$10\/month/);
  await page.waitForFunction(()=>window.geofenceMap?.getSource('custom-circle')&&geofenceMap.loaded()&&!geofenceMap.isMoving());
  await page.screenshot({path:path.join(os.tmpdir(),'austin-geofence-live-ready.png'),fullPage:true});
  assert.equal(checkoutRequests,0);
  console.log('Published 390px form: real signed-in account, $10 Account card, saved draft/QR, location preview and confirmation-gated payment button verified. No purchase initiated.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message.replace(/https?:\/\/\S+/g,'[private URL]'));process.exitCode=1;});
