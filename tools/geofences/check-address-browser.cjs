/* Published form, real session and regional lookup; no saved circles or purchases. */
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs');
(async()=>{
 let input='';for await(const part of process.stdin)input+=part;
 const session=JSON.parse(input);
 const browser=await chromium.launch({headless:true,executablePath:executablePath(),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700});
   await context.addInitScript(session=>{if(location.origin==='https://austin.chat')localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(session));},session);
   const actions=[],errors=[];
   await context.route('**/functions/v1/geofences',route=>{
    const action=route.request().method()==='POST'?route.request().postDataJSON()?.action:null;
    if(action)actions.push(action);
    if(action&&!['list','suggest','geocode'].includes(action))return route.abort();
    return route.continue();
   });
   const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',error=>errors.push(error.message));
   page.on('response',response=>{if(response.url().includes('/functions/v1/geofences')&&response.status()>=400)console.error('Geofence lookup response: HTTP '+response.status());});
   await page.goto('https://austin.chat/geofences/manage/',{waitUntil:'domcontentloaded'});
   await page.locator('#geo-member').waitFor();
   await page.locator('[name=name]').fill('Address preview verification');await page.locator('[name=description]').fill('Check this circle on the map.');
   const address=page.locator('#geo-address'),options=page.getByRole('option');
   await address.fill('301 W 2nd Austin');
   await options.first().waitFor();
   assert.match(await options.first().innerText(),/301 W 2ND ST, AUSTIN, TX/i);
   if(width<700)await options.first().tap();else{await address.press('ArrowDown');await address.press('Enter');}
   assert.match(await address.inputValue(),/301 W 2ND ST, AUSTIN, TX/i);
   const diameter=page.locator('[name=diameter]');assert.equal(await diameter.getAttribute('max'),'500');
   await diameter.fill('501');assert.equal(await page.locator('#geo-preview').isHidden(),true);assert.equal(await diameter.evaluate(el=>el.validity.rangeOverflow),true);assert.equal(await page.locator('#geo-pay').isDisabled(),true);
   await diameter.fill('500');await page.locator('[name=invitation]').first().fill('preview@example.invalid');
   await page.locator('#geo-preview').click();
   await page.locator('#geo-form-status').filter({hasText:'Check the circle'}).waitFor();
   assert.match(await page.locator('#geo-preview-caption').innerText(),/500 meters across/);
   await page.locator('#geo-confirm').check();assert.equal(await page.locator('#geo-pay').isEnabled(),true);
   await address.fill('200 E Main Round Rock');assert.equal(await page.locator('#geo-pay').isDisabled(),true);
   await options.first().waitFor();assert.match(await options.first().innerText(),/ROUND ROCK, TX/i);
   await address.scrollIntoViewIfNeeded();
   await page.screenshot({path:path.resolve('..','.tmp','geofence-address-live-'+width+'.png'),fullPage:true});
   if(width<700)await options.first().tap();else await options.first().click();
   assert.match(await address.inputValue(),/ROUND ROCK, TX/i);
   await address.fill('1500 Marilla Dallas TX');
   await page.locator('#geo-address-status').filter({hasText:'No Austin metro matches'}).waitFor().catch(async()=>{throw Error('Address empty-state check failed: '+await page.locator('#geo-address-status').innerText());});
   assert.equal(await page.locator('#geo-results').isHidden(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(actions.filter(a=>!['list','suggest','geocode'].includes(a)).length,0);assert.deepEqual(errors,[]);
   console.log(width+'px published form: 500-meter preview, 501-meter rejection, regional suggestions, '+(width<700?'touch':'keyboard')+' selection, preview invalidation and Dallas exclusion passed.');
   await context.close();
   // Both viewports share an account and therefore its server rate limit.
   await new Promise(resolve=>setTimeout(resolve,3300));
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message.replace(/https?:\/\/\S+/g,'[private URL]'));process.exitCode=1;});
