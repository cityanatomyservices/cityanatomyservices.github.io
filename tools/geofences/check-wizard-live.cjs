/* Real published wizard, test-recipient invitations and profile/guest chat. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs');
(async()=>{
 let input='';for await(const part of process.stdin)input+=part;
 const {session,invitees,profileName}=JSON.parse(input),guestIds=[];
 const browser=await chromium.launch({headless:true,executablePath:executablePath(),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700,permissions:['geolocation'],geolocation:{latitude:30.2672,longitude:-97.7431,accuracy:5}});
   await context.addInitScript(session=>{if(location.origin==='https://austin.chat')localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(session));},session);
   const page=await context.newPage();page.setDefaultTimeout(45000);const mutations=[];
   page.on('request',request=>{if(request.url().includes('/functions/v1/geofences')&&request.method()==='POST'&&['save','checkout'].includes(request.postDataJSON()?.action))mutations.push(request.postDataJSON().action);});
   await page.goto('https://austin.chat/geofences/manage/',{waitUntil:'domcontentloaded'});await page.locator('#geo-member').waitFor();
   assert.equal(await page.locator('#geo-step-description').isHidden(),true);assert.equal(await page.locator('#geo-preview').isHidden(),true);
   await page.screenshot({path:path.resolve('..','.tmp','geofence-wizard-live-start-'+width+'.png'),fullPage:true});
   const title='Disposable wizard verification '+width;
   await page.locator('[name=name]').fill(title);await page.locator('[name=description]').fill('A temporary chat for automated verification. Removed after this check.');
   if(width>700){await page.locator('#geo-address').fill('301 W 2nd Austin');await page.getByRole('option').first().click();}
   else{await page.locator('[name=mode][value=gps]').check();await page.locator('#geo-gps').click();await page.locator('#geo-gps-result').filter({hasText:'Current location selected'}).waitFor();}
   await page.locator('[name=diameter]').fill('500');
   const inputs=page.locator('[name=invitation]');assert.equal(await inputs.count(),1);
   await inputs.first().fill(invitees[0]);assert.equal(await inputs.count(),2);await inputs.nth(1).fill(invitees[1]);assert.equal(await inputs.count(),3);
   await page.locator('#geo-preview').click();await page.locator('#geo-review').waitFor();assert.equal(await page.locator('#geo-pay').isDisabled(),true);assert.deepEqual(mutations,[]);
   await page.waitForFunction(()=>window.geofenceMap?.loaded()&&!geofenceMap.isMoving());
   await page.screenshot({path:path.resolve('..','.tmp','geofence-wizard-live-review-'+width+'.png'),fullPage:true});
   await page.locator('#geo-confirm').check();assert.match(await page.locator('#geo-pay').innerText(),/Create geofence & send invitations/);
   await page.locator('#geo-pay').click();await page.locator('#geo-form-status').filter({hasText:'Your geofence is ready'}).waitFor();
   const card=page.locator('#geo-owned article').filter({has:page.getByRole('heading',{name:title,exact:true})});await card.waitFor();
   const url=await card.locator('.geofence-link').getAttribute('href'),id=new URL(url).searchParams.get('id');
   assert.equal(await page.locator('[name=name]').inputValue(),'');assert.equal(await page.locator('#geo-step-description').isHidden(),true);assert.deepEqual(mutations,['save','checkout']);
   const location=await page.evaluate(async id=>(await AustinSession.client().rpc('geofence_read',{p_id:id})).data,id);
   assert.equal(location.diameter,500);await context.setGeolocation({latitude:location.latitude,longitude:location.longitude,accuracy:5});
   await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('#geo-room').waitFor();await page.locator('#geo-chat-toggle').click();
   await page.locator('#geo-use-profile').check();await page.locator('#geo-join').click();await page.locator('#geo-people').filter({hasText:profileName+' (you)'}).waitFor();
   await page.locator('#geo-message').fill('A profile chat message for verification.');await page.locator('#geo-send').click();await page.locator('#geo-messages').filter({hasText:'A profile chat message for verification.'}).waitFor();
   const download=page.waitForEvent('download');await page.locator('#geo-export').click();const exported=await download;const filename=path.resolve('..','.tmp','geofence-wizard-live-chat-'+width+'.txt');await exported.saveAs(filename);
   const text=fs.readFileSync(filename,'utf8');assert.ok(text.includes(profileName));assert.match(text,/A profile chat message/);assert.ok(!text.includes(session.user.email));await page.locator('#geo-leave').click();
   if(width===390){
    const guest=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true,permissions:['geolocation'],geolocation:{latitude:location.latitude,longitude:location.longitude,accuracy:5}});
    const visitor=await guest.newPage();visitor.setDefaultTimeout(45000);await visitor.goto(url,{waitUntil:'domcontentloaded'});await visitor.locator('#geo-room').waitFor();await visitor.locator('#geo-chat-toggle').click();
    assert.equal(await visitor.locator('#geo-use-profile').isDisabled(),true);await visitor.locator('#geo-anon-name').fill('Park QA');await visitor.locator('#geo-join').click();
    try{await visitor.locator('#geo-people').filter({hasText:'Park QA (you)'}).waitFor();assert.equal(await visitor.locator('#geo-messages li').count(),0);assert.equal(await visitor.evaluate(()=>AustinSession.registered),false);
     await visitor.locator('#geo-message').fill('An anonymous chat message for verification.');await visitor.locator('#geo-send').click();await visitor.locator('#geo-messages').filter({hasText:'An anonymous chat message'}).waitFor();await visitor.locator('#geo-leave').click();
    }finally{const guestId=await visitor.evaluate(()=>AustinSession.user?.id);if(guestId)guestIds.push(guestId);await guest.close();}
   }
   console.log(width+'px: real guided creation, two private invitations, 500-meter preview, profile name and text export passed.');await context.close();
  }
  console.log('Phone guest: chosen anonymous name, no sign-in and no previous-conversation history passed.');
 }finally{console.log('__QA_GUESTS__'+JSON.stringify(guestIds));await browser.close();}
})().catch(error=>{console.error(error.message.replace(/https?:\/\/\S+/g,'[private URL]'));process.exitCode=1;});
