/* Real UI with fixture accounts/feeds. Every Supabase request is intercepted. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');let browser,server;
async function serve(){
  const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
  server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;
}
function session(member){const id=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+3600,enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return {access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,exp,role:'authenticated',is_anonymous:!member})+'.fixture',refresh_token:crypto.randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user:{id,email:member?'fixture@example.invalid':undefined,is_anonymous:!member,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}};}
(async()=>{try{
  const base=process.argv[2]||await serve(),M=await import('../../shared/reminder-model.mjs'),now=Date.now(),at=h=>new Date(now+h*3600000).toISOString();
  const feature=(id,patch={})=>({type:'Feature',geometry:{type:'Point',coordinates:[-97.74,30.27]},properties:{id,title:id,venue:'Fixture venue',kind:'event',price:0,priceLabel:'Free',url:'https://example.invalid/'+id,source:'Fixture',checked:at(0),start:at(72),end:at(74),expires:at(24),...patch}});
  const features=[feature('Timed event'),feature('Opening hours',{kind:'activity'}),feature('All day',{allDay:true}),feature('Starting soon',{start:at(1),end:at(3)})];
  const movie=feature('Test movie',{kind:'movie',price:null,tags:['dine-in'],showtimes:[{start:at(60),url:'https://example.invalid/first'},{start:at(62),url:'https://example.invalid/second'}],start:at(60),end:at(64)});
  const meeting=(id,dateOnly=false)=>({id,title:id,category:'meetings',source:'fixture',url:'https://www.austintexas.gov/events/'+id.replaceAll(' ','-'),date:at(72),dateOnly,expires:at(24),scope:'citywide',districts:[],board:'Fixture Board',location:'Austin City Hall'});
  const meetings=[meeting('Council meeting'),meeting('Time pending',true)],events=[...features,...[movie]].flatMap(f=>M.occurrences('explore',f)).concat(meetings.flatMap(r=>M.occurrences('city-hall',r)));
  browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500}),active=session(true),guest=session(false);
    let rows=[],enabled=true,subscriptions=0,holdStatus=false,releaseStatus=null,failNext=false,cancellations=0;
    await context.addInitScript(active=>{if(window===window.top&&!sessionStorage.getItem('fixture-seeded')){sessionStorage.setItem('fixture-seeded','yes');localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(active));}},active);
    await context.route('https://*.supabase.co/**',async route=>{
      const req=route.request(),p=new URL(req.url()).pathname,body=req.postDataJSON();
      if(p==='/functions/v1/reminders'&&new URL(req.url()).searchParams.has('unsubscribe')){cancellations++;return route.fulfill({json:{cancelled:true}});}
      if(p==='/functions/v1/reminders'){
        if(body.action==='status'&&holdStatus){holdStatus=false;const snapshot=structuredClone(rows);await new Promise(resolve=>{releaseStatus=resolve;});return route.fulfill({json:{enabled,email:active.user.email,reminders:snapshot}});}
        if(body.action==='subscribe'&&failNext){failNext=false;return route.fulfill({status:503,json:{error:'Try again later.'}});}
        if(body.action==='availability')return route.fulfill({json:{enabled}});
        if(body.action==='subscribe'){
          subscriptions++;const e=events.find(e=>e.key===M.eventKey(body.provider,body.id,body.start));assert.ok(e);
          if(!rows.some(r=>r.event_key===e.key))rows.push({id:crypto.randomUUID(),event:e,event_key:e.key,starts_at:e.start,event_reminder_jobs:M.leadHours(e.start).map(h=>({lead_hours:h,state:'pending'}))});
        }
        if(body.action==='cancel')rows=body.id===null?[]:rows.filter(r=>r.id!==body.id);
        return route.fulfill({json:{enabled,email:active.user.email,reminders:rows}});
      }
      if(p==='/auth/v1/signup')return route.fulfill({json:guest});
      if(p==='/auth/v1/user')return route.fulfill({json:active.user});
      if(p==='/auth/v1/logout')return route.fulfill({status:204});
      if(p==='/auth/v1/settings')return route.fulfill({json:{external:{google:true,email:true}}});
      if(p==='/rest/v1/rpc/member_load')return route.fulfill({json:{profile:{handle:'Fixture',emoji:'🦊',show_avatar:false},favorites:[],preferences:{explore:{enabled:['free-cheap'],when:'week'}},progress:[]}});
      if(['/rest/v1/rpc/member_preference_set','/rest/v1/rpc/planner_load'].includes(p))return route.fulfill({json:null});
      return route.fulfill({status:400,json:{message:'Production requests blocked in this test'}});
    });
    await context.route(/\/chat\/data\/explore\/[^?]+\.geojson/,route=>route.fulfill({json:{type:'FeatureCollection',generated:at(0),features:route.request().url().includes('/movies.')?[movie]:features}}));
    await context.route('**/chat/data/city-hall.json',route=>route.fulfill({json:{version:1,generated:at(0),records:meetings,sources:[{id:'fixture',title:'Fixture city calendar',url:'https://www.austintexas.gov/boards-commissions/events',category:'meetings',checked:at(0),ok:true}]}}));
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/');await page.waitForFunction(()=>window.AustinAccount&&window.AustinReminders);
    const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(()=>window.AustinCityHall?.close&&window.austinExplore&&window.AustinReminders);
    await f.locator('#ctrlExplore').click();
    const result=title=>f.locator('#explore-panel .explore-results > li').filter({has:f.locator('.explore-result').filter({hasText:title})});
    const timed=result('Timed event').locator('.email-reminder input'),soon=result('Starting soon').locator('.email-reminder input');
    await timed.waitFor();await f.waitForFunction(()=>[...document.querySelectorAll('.email-reminder input')].some(n=>!n.disabled));
    assert.equal(await result('Opening hours').locator('.email-reminder').count(),0);assert.equal(await result('All day').locator('.email-reminder').count(),0);assert.equal(await soon.isDisabled(),true);
    holdStatus=true;await f.evaluate(()=>{window.oldReminderLoad=AustinReminderStore.load(true);});
    for(let i=0;i<100&&!releaseStatus;i++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(releaseStatus);
    await timed.check();await f.waitForFunction(()=>AustinReminderStore.state.reminders.length===1);
    releaseStatus();await f.evaluate(()=>oldReminderLoad);assert.equal(await timed.isChecked(),true,'An older load must not undo a saved selection');
    assert.equal(subscriptions,1);assert.match(await result('Timed event').innerText(),/24 hours before and 2 hours before/);
    await result('Timed event').locator('.explore-result').click();await f.locator('.explore-popup .email-reminder input').waitFor();assert.equal(await f.locator('.explore-popup .email-reminder input').isChecked(),true);
    await f.locator('.maplibregl-popup-close-button').click();
    if(await f.locator('#explore-panel').isHidden())await f.locator('#ctrlExplore').click();await f.locator('#ctrlCityHall').click();await f.locator('#city-hall-panel [data-filter=category]').selectOption('meetings');
    await f.locator('#city-hall-list .email-reminder input').check();assert.equal(await f.locator('#city-hall-list .email-reminder input').count(),1);
    await f.waitForFunction(()=>AustinReminderStore.state.reminders.length===2);
    await page.getByRole('button',{name:'Account',exact:true}).click();await page.locator('[data-member-tab=reminders]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.reminder-account-item').length===2);
    assert.match(await page.locator('#member-reminders').innerText(),/fixture@example.invalid/);
    await page.screenshot({path:`/tmp/reminder-account-${width}.png`});
    await page.locator('#member-reminders').getByRole('button',{name:'Cancel all reminders',exact:true}).click();await page.waitForFunction(()=>AustinReminderStore.state.reminders.length===0);
    await page.locator('.account-close').click();assert.equal(await f.locator('#city-hall-list .email-reminder input').isChecked(),false);
    await f.locator('#explore-panel .explore-close').click();await f.locator('#ctrlExplore').click();await f.locator('#ctrlCityHall').click();
    failNext=true;await timed.click();await result('Timed event').getByText('Try again later.').waitFor();assert.equal(await timed.isChecked(),false,'Failed saves roll back the checkbox');
    await f.locator('[data-layer=movies]').check();await f.locator('#explore-panel .email-reminder select').waitFor();
    const movieRow=result('Test movie'),selector=movieRow.locator('.email-reminder select'),check=movieRow.locator('.email-reminder input');
    await check.check();await f.waitForFunction(()=>AustinReminderStore.state.reminders.length===1);
    await selector.selectOption({index:1});assert.equal(await check.isChecked(),false);await check.check();await f.waitForFunction(()=>AustinReminderStore.state.reminders.length===2);
    await selector.selectOption({index:0});assert.equal(await check.isChecked(),true);
    await page.screenshot({path:`/tmp/reminder-explore-${width}.png`});
    enabled=false;await f.evaluate(()=>AustinReminderStore.load(true));assert.equal(await timed.isDisabled(),true);assert.match(await result('Timed event').innerText(),/being set up/);
    assert.equal(await check.isDisabled(),false,'Saved selections remain cancellable during sender outage');await check.uncheck();
    await page.evaluate(()=>AustinSession.signOut());await page.waitForFunction(()=>!AustinSession.registered);await f.waitForFunction(()=>!AustinReminderStore.state?.reminders?.length);
    if(!await f.locator('[data-layer=movies]').isVisible())await f.locator('#ctrlExplore').click();
    await f.locator('[data-layer=movies]').check();await movieRow.locator('.email-reminder input').waitFor();
    assert.equal(await movieRow.locator('.email-reminder input').isChecked(),false);
    enabled=true;await f.evaluate(()=>AustinReminderStore.load(true));await movieRow.getByRole('button',{name:'Sign in for email reminders'}).click();await page.locator('#account-guest').waitFor({state:'visible'});
    await page.goto(base+'/reminders/#00000000-0000-4000-8000-000000000001');await page.locator('#reminder-cancel').waitFor();assert.equal(cancellations,0);assert.equal(new URL(page.url()).hash,'');
    await page.locator('#reminder-cancel').click();await page.getByText('Event reminders cancelled. You can close this page.').waitFor();assert.equal(cancellations,1);
    assert.deepEqual(errors,[]);await context.close();
    console.log(`${width}px: timed-only controls, late cutoff, popup sync, City Hall, account cancellation, independent movie showtimes, provider readiness and sign-out privacy passed.`);
  }
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
