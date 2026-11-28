const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{let input='';for await(const chunk of process.stdin)input+=chunk;const {session,circle,closed}=JSON.parse(input),{localTime}=await import('../../geofences/schedule.mjs');
 const browser=await chromium.launch({executablePath:executablePath(),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500,permissions:['geolocation'],geolocation:{latitude:circle.latitude,longitude:circle.longitude,accuracy:5}});
  await context.addInitScript(s=>{if(location.origin==='https://austin.chat')localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(s));},session);
  const page=await context.newPage();page.setDefaultTimeout(45000);await page.goto('https://austin.chat/');const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(()=>window.chatMap&&window.AustinChatMap);
  assert.deepEqual(await f.locator('#stack>.round').evaluateAll(es=>es.map(e=>e.id)),['ctrlDayPlan','ctrlChat','ctrlGeoFence','ctrlParcels','ctrlAroundMe']);await f.locator('#ctrlChat').click();
  let found=false;for(let i=0;i<150;i++){found=await f.evaluate(async id=>(await chatMap.getSource('chat-circles')?.getData())?.features?.some(f=>f.properties.id===id),circle.id);if(found)break;await page.waitForTimeout(200);}assert.ok(found,'Real active circle appears on Chat map');
  await f.waitForFunction(()=>chatMap.getZoom()===16);await f.locator('#ctrlChat').click();await page.screenshot({path:path.resolve('..','.tmp','chat-map-live-'+width+'.png')});
  await page.goto('https://austin.chat/geofences/?id='+circle.id);await page.locator('#geo-room').waitFor();assert.equal(await page.locator('#geo-join').isEnabled(),true);assert.match(await page.locator('#geo-public-status').textContent(),/Austin time/);
  if(width===390){
   await page.goto('https://austin.chat/geofences/manage/');const card=page.locator('#geo-owned article').filter({has:page.getByRole('heading',{name:circle.name,exact:true})});await card.waitFor();await card.locator('.geofence-schedule-settings summary').click();
   await card.locator('[name=starts_at]').fill(localTime(closed.starts_at));await card.locator('[name=ends_at]').fill(localTime(closed.ends_at));await card.getByRole('button',{name:'Save chat times',exact:true}).click();await card.filter({hasText:'This chat window has ended'}).waitFor();
   await page.goto('https://austin.chat/geofences/?id='+circle.id);await page.locator('#geo-room').waitFor();assert.match(await page.locator('#geo-public-status').textContent(),/Chat is closed/);await page.locator('#geo-chat-toggle').click();assert.equal(await page.locator('#geo-join').isDisabled(),true);
  }
  await context.close();console.log(`${width}px: published Chat map centered on GPS and showed the real active circle; public schedule displayed${width===390?', owner time edit closed the chat':''}.`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
