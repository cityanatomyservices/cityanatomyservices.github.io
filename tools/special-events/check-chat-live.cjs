/* Manual hosted check: real guest Auth + Realtime, isolated event rooms.
   Requires the Supabase CLI login to delete only the test guests afterwards.
   Never sends into a real event room, persists messages, or emails anyone. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),project='aqbyxpiwugcvoephsvpm',backend=`https://${project}.supabase.co`;
const base=process.argv[2]||'https://austin.chat',run='chat-qa-'+crypto.randomUUID();
const output=process.env.EVENT_CHAT_OUTPUT||path.join(require('node:os').tmpdir(),'austin-event-chat');
const users=new Set(),devices=[],blocked=[],errors=[],checks=[];
let browser,admin;
function pass(message){checks.push(message);console.log('PASS '+message);}
async function until(fn,label,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,150));}throw Error('Timed out: '+label);}
async function count(device,n){await until(()=>device.f.evaluate(n=>ChatEngine.people().filter(p=>!p.self).length===n,n),`${device.name}: ${n} peers`);}
async function snapshot(device){return device.f.evaluate(()=>({room:ChatEngine.room,people:ChatEngine.people(),open:ChatPanel.isOpen(),disabled:document.querySelector('#chatBtn').disabled,lines:document.querySelector('#chatLines').innerText,status:document.querySelector('#roomLine').textContent,visibility:document.visibilityState,connection:ChatIdentity.client().realtime.connectionState(),channels:ChatIdentity.client().getChannels().map(c=>({topic:c.topic,state:c.state,presence:c.presenceState()})),diagnostics:window.chatDiagnostics}));}
async function position(device,point){await device.f.evaluate(point=>qaGPS(point),point);}
async function gps(device,stop){await position(device,stop.geometry.coordinates);await device.f.waitForFunction(room=>ChatEngine.room===room,`event-${run}-stop-${stop.properties.id}`);}
async function visible(device,on){if(await device.f.locator('#legend').isHidden())await device.f.locator('#ctrlChat').click();if((await device.f.locator('#visibleBtn').getAttribute('aria-pressed')==='true')!==on)await device.f.locator('#visibleBtn').click();}
async function open(device){if(!await device.f.evaluate(()=>ChatPanel.isOpen()))await device.f.locator('#chatBtn').click();}
async function send(device,text){await open(device);await device.f.locator('#chatText').fill(text);await device.f.locator('#chatSend').click();}
async function received(device,text){await until(()=>device.f.locator('#chatLines').innerText().then(s=>s.includes(text)),`${device.name} receives ${text}`);}
(async()=>{
 try{
  // Capture secret-bearing CLI output in memory; never echo it or its errors.
  let keys;try{keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref',project,'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000}));}catch(_){throw Error('Supabase CLI access is needed for disposable guest cleanup; no browsers started.');}
  admin=keys.find(k=>k.name==='service_role')?.api_key;assert.ok(admin,'Cleanup credential unavailable; no browsers started');
  fs.mkdirSync(output,{recursive:true});
  const source=JSON.parse(fs.readFileSync(path.join(root,'special-events/data/austin-studio-tour-2026.geojson'),'utf8'));
  const stop=n=>source.features.find(f=>f.properties.number===n),one=stop(47),two=stop(233);
  browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  async function device(name,where,width=390){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,permissions:['geolocation'],geolocation:{longitude:where.geometry.coordinates[0],latitude:where.geometry.coordinates[1],accuracy:5}});
   if(process.env.EVENT_CHAT_LOCAL==='true')for(const file of ['chat/chat.js','chat/panel.js','special-events/style.css'])await context.route(`**/${file}?*`,route=>route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(path.join(root,file),'utf8')}));
   const d={name,context};
   // Only the GPS readings and event ID are simulated. Auth, subscription,
   // presence, broadcasts and acknowledgements use the deployed service.
   await context.addInitScript(point=>{
    let sample={coords:{longitude:point[0],latitude:point[1],accuracy:5},timestamp:Date.now()};
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
     watchPosition(success,error,options){window.qaGPS=(point,accuracy=5,age=0)=>{sample={coords:{longitude:point[0],latitude:point[1],accuracy},timestamp:Date.now()-age};success(sample);};window.qaGPSError=()=>error({code:1});queueMicrotask(()=>success({...sample,timestamp:Date.now()}));return 1;},
     clearWatch(){},getCurrentPosition(success){if(!window.qaFreezeGPS)success({...sample,timestamp:Date.now()});}
    }});
    window.chatDiagnostics=[];let identity;
    Object.defineProperty(window,'ChatIdentity',{configurable:true,get:()=>identity,set:value=>{
     const original=value.client;value.client=()=>{const client=original();if(!client.chatObserved){client.chatObserved=true;const channel=client.channel.bind(client);client.channel=(...args)=>{
      const c=channel(...args),subscribe=c.subscribe.bind(c),track=c.track.bind(c);
      c.subscribe=fn=>subscribe((status,error)=>{window.chatDiagnostics.push({status,error:error?.message});return fn(status,error);});
      c.track=async p=>{window.chatDiagnostics.push({trackStart:true});const result=await track(p);window.chatDiagnostics.push({track:result});return result;};
      c.on('system',{},payload=>window.chatDiagnostics.push({system:payload}));return c;
     };}return client;};identity=value;
    }});
   },where.geometry.coordinates);
   await context.route('**/special-events/data/austin-studio-tour-2026.geojson?*',async route=>{
    const response=await route.fetch(),data=await response.json();assert.equal(data.features.length,307);data.id=run;
    await route.fulfill({response,json:data});
   });
   await context.route(backend+'/**',async route=>{
    const request=route.request(),p=new URL(request.url()).pathname;
    if(p==='/auth/v1/signup'){
     const response=await route.fetch(),data=await response.json();
     if(data.user?.is_anonymous&&data.user.id)users.add(data.user.id);
     assert.equal(response.status(),200,'Guest sign-in failed');assert.ok(data.user?.is_anonymous,'Expected a new guest');
     await route.fulfill({response});return;
    }
    if(p.startsWith('/auth/v1/')||p.startsWith('/realtime/'))return route.continue();
    if(p==='/rest/v1/rpc/profile_display')return route.fulfill({json:null});
    if(p==='/rest/v1/messages'){blocked.push('Unexpected saved-message request');return route.abort();}
    // No account/business data mutations or unrelated production requests.
    if(p==='/rest/v1/rpc/membership_read')return route.fulfill({json:{plan:'free',status:'none'}});
    return route.fulfill({status:400,json:{message:'Unrelated request blocked in chat check'}});
   });
   const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
   await page.goto(base+'/maps/austin-studio-tour/');const f=await(await page.locator('#app-window').elementHandle()).contentFrame();
   await f.waitForFunction(()=>window.ChatRoom?.room&&window.AustinSession?.user?.is_anonymous);
   Object.assign(d,{page,f});devices.push(d);assert.equal(await f.evaluate(()=>ChatEngine.room),null,'Hidden guest must not connect');
   assert.equal(await f.evaluate(()=>AustinEvent.data.id),run);
   await f.locator('#ctrlChat').click();return d;
  }
  const a=await device('Phone A',one),b=await device('Phone B',one);
  pass('Independent real guest sessions load the hosted map and begin hidden.');
  await visible(a,true);await gps(a,one);await count(a,0);assert.equal(await a.f.locator('#chatBtn').isDisabled(),true);
  await visible(b,true);await gps(b,one);await count(a,1);await count(b,1);
  await b.f.evaluate(point=>{qaGPSError();qaGPS(point);},one.geometry.coordinates);
  await count(a,1);await count(b,1);
  pass('Rapid GPS loss/recovery at the same stop safely replaces the closing channel.');
  const c=await device('Phone C',two),d=await device('Desktop D',one,1280);
  await visible(c,true);await gps(c,two);await count(c,0);await count(a,1);
  pass('Two visible phones at stop 47 discover one another; hidden visitors and adjacent stop 233 are excluded.');
  await send(a,'QA: hello from phone A');await received(b,'QA: hello from phone A');
  await send(b,'QA: hello from phone B');await received(a,'QA: hello from phone B');
  assert.equal((await snapshot(c)).lines,'');assert.equal((await snapshot(d)).lines,'');
  await open(a);await open(b);await a.page.screenshot({path:path.join(output,'phone-a-chat.png')});await b.page.screenshot({path:path.join(output,'phone-b-chat.png')});
  pass('Both directions deliver actual Realtime messages, and the chat window lists the two random nicknames.');
  await visible(d,true);await gps(d,one);await count(a,2);await count(b,2);await count(d,2);
  assert.equal((await snapshot(d)).lines,'','New arrivals must not see earlier lines');
  await send(d,'QA: third participant');await received(a,'QA: third participant');await received(b,'QA: third participant');
  assert.equal(await a.f.locator('#chatPeople > span').count(),3);
  assert.ok(await a.f.locator('#chatPeople').evaluate(el=>el.scrollWidth<=el.clientWidth),'Roster must wrap instead of cutting off names');
  await a.page.screenshot({path:path.join(output,'phone-three-person-chat.png')});
  pass('Three participants share the stop group; a new arrival receives new messages without historical messages.');
  await gps(b,two);await count(a,1);await count(d,1);await count(b,1);await count(c,1);
  assert.equal((await snapshot(b)).lines,'','Moving clears the old conversation');
  await send(c,'QA: adjacent studio only');await received(b,'QA: adjacent studio only');assert.ok(!(await snapshot(a)).lines.includes('adjacent studio'));
  pass('Moving between the shared-building stops changes rooms and prevents cross-stop delivery.');
  await visible(d,false);await count(a,0);assert.equal((await snapshot(a)).open,false);assert.equal((await snapshot(d)).lines,'');
  await position(c,[-98.1,30.7]);await c.f.waitForFunction(()=>ChatEngine.room===null);await count(b,0);
  pass('Hiding or leaving the zone removes presence and disables chatting when nobody else remains.');
  await gps(c,two);await count(b,1);await count(c,1);
  // Wait through more than one 60-second lease, using the browser GPS API.
  await until(async()=>{await count(b,1);await count(c,1);return true;},'stationary presence');
  const start=Date.now();while(Date.now()-start<65000){await new Promise(r=>setTimeout(r,5000));assert.equal((await snapshot(b)).people.filter(p=>!p.self).length,1);}
  await send(b,'QA: still here after a minute');await received(c,'QA: still here after a minute');
  pass('Stationary visitors stay connected beyond the 60-second lease through fresh GPS fixes.');
  // Loss of browser connectivity must not show a successful unsent message.
  await b.context.setOffline(true);await new Promise(r=>setTimeout(r,1500));
  const offline=await b.f.evaluate(async()=>({sent:await ChatEngine.send('QA: offline send'),lines:document.querySelector('#chatLines').innerText}));
  assert.equal(offline.sent,false);assert.ok(!offline.lines.includes('QA: offline send'));
  pass('An offline send is rejected without displaying an undelivered message.');
  await b.context.setOffline(false);
  await until(()=>b.f.evaluate(()=>ChatEngine.people().some(p=>!p.self)),'reconnect peers',45000);
  await new Promise(r=>setTimeout(r,1200));await send(b,'QA: reconnected');await received(c,'QA: reconnected');
  pass('Browser reconnect restores actual message delivery.');
  await c.context.close();await count(b,0);assert.equal(await b.f.locator('#chatBtn').isDisabled(),true);
  pass('Closing the other visitor’s browser removes their presence.');
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({base,checks,offline,errors,blocked},null,2));
 }catch(error){
  console.log('Browser errors:',JSON.stringify(errors));
  for(const device of devices){try{console.log(device.name,JSON.stringify(await snapshot(device)));}catch(_) {}}
  throw error;
 }finally{
  await browser?.close();
  const failures=[];
  for(const id of users){try{const response=await fetch(backend+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:{apikey:admin,Authorization:'Bearer '+admin},signal:AbortSignal.timeout(15000)});if(!response.ok)failures.push(response.status);}catch(_){failures.push('network');}}
  if(failures.length)throw Error('Disposable guest cleanup failed: '+failures.join(','));
  console.log(`Cleanup: ${users.size} disposable guests removed; only isolated test rooms were used.`);
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
