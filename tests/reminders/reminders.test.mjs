import test from 'node:test';
import assert from 'node:assert/strict';
import {occurrences,leadHours,message,catalog,eventKey,HOUR} from '../../shared/reminder-model.mjs';
import {handler as endpoint} from '../../supabase/functions/reminders/handler.mjs';
import {handler as worker} from '../../supabase/functions/reminder-send/handler.mjs';
import {runtime} from '../../supabase/functions/_shared/runtime.mjs';
const now=Date.now(),at=hours=>new Date(now+hours*HOUR).toISOString();
const feature=(patch={})=>({properties:{id:'test-event',title:'Austin concert',kind:'listing',start:at(72),url:'https://example.org/event',expires:at(24),...patch}});
const event=occurrences('explore',feature())[0];
const owner='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002';
const post=body=>new Request('https://test.example/reminders',{method:'POST',body:JSON.stringify(body)});

test('only published timed events qualify, never hours, date-only or cancelled listings',()=>{
  for(const patch of [{kind:'activity'},{kind:'park'},{allDay:true},{dateOnly:true},{cancelled:true},{start:'2026-11-03'},{start:'2026-11-03T12:00:00'}])assert.deepEqual(occurrences('explore',feature(patch)),[]);
  assert.equal(occurrences('explore',feature()).length,1);
  const meeting={id:'meeting',title:'Public meeting',category:'meetings',date:at(72),dateOnly:false,url:'https://www.austintexas.gov/meeting'};
  assert.equal(occurrences('city-hall',meeting).length,1);
  for(const patch of [{dateOnly:true},{category:'announcements'},{category:'permits'},{cancelled:true}])assert.deepEqual(occurrences('city-hall',{...meeting,...patch}),[]);
});
test('showtimes have separate stable occurrences and duplicates collapse',()=>{
  const f=feature({kind:'movie',showtimes:[{start:at(80),url:'https://example.org/late'},{start:at(72)},{start:at(72)}]});
  const shows=occurrences('explore',f);assert.equal(shows.length,2);assert.equal(shows[0].start,at(72));assert.notEqual(shows[0].key,shows[1].key);
  assert.equal(shows[1].url,'https://example.org/late');
  assert.equal(eventKey('explore','same','2026-11-03T12:00:00-06:00'),eventKey('explore','same','2026-11-03T18:00:00Z'));
});
test('late selections skip the 24-hour send; within two hours never send immediately',()=>{
  assert.deepEqual(leadHours(at(25),now),[24,2]);assert.deepEqual(leadHours(at(24),now),[2]);
  assert.deepEqual(leadHours(at(23),now),[2]);assert.deepEqual(leadHours(at(2),now),[]);assert.deepEqual(leadHours(at(-1),now),[]);
});
test('elapsed-hour timing survives the Austin DST fold',()=>{
  const start='2026-11-01T08:00:00Z';
  assert.deepEqual(leadHours(start,Date.parse('2026-10-31T07:59:00Z')),[24,2]);
  assert.deepEqual(leadHours(start,Date.parse('2026-11-01T05:59:00Z')),[2]);
  assert.deepEqual(leadHours(start,Date.parse('2026-11-01T06:01:00Z')),[]);
});
test('catalog excludes stale, cancelled and expired entries; stale feed fails closed',()=>{
  const feed={generated:at(-1),features:[feature(),feature({id:'expired',expires:at(-1)}),feature({id:'cancelled',cancelled:true})]};
  assert.equal(catalog('explore',[feed],now).size,1);
  assert.throws(()=>catalog('explore',[{...feed,generated:at(-25)}],now));
  const meeting={id:'meeting',title:'Board',category:'meetings',date:at(72),dateOnly:false,url:'https://www.austintexas.gov/meeting',expires:at(24),source:'boards'};
  const city={generated:at(-1),records:[meeting],sources:[{id:'boards',ok:true,checked:at(-1)}]};
  assert.equal(catalog('city-hall',[city],now).size,1);city.sources[0].ok=false;assert.equal(catalog('city-hall',[city],now).size,0);
});
test('plain-text email uses card details, Austin time, source and unsubscribe',()=>{
  const mail=message({...event,title:'Arts\r\nshow',venue:'City Hall',address:'301 W 2nd',description:'Public discussion',conditions:'Check agenda'},2,'https://example.org/unsubscribe');
  assert.equal(mail.subject,'Reminder: Arts show — 2 hours to go');
  for(const line of ['City Hall','301 W 2nd','Public discussion','Check agenda','Austin time',event.url,'https://example.org/unsubscribe'])assert.ok(mail.text.includes(line));
  assert.equal(mail.html,undefined);
});

function apiFixture(){
  const calls=[];return {calls,ready:()=>true,user:async()=>({id:owner,email:'fixture@example.invalid'}),
    events:async()=>new Map([[event.key,event]]),request:async()=>[],rpc:async(name,body)=>{calls.push({name,body});}};
}
test('API authenticates before subscriptions and only enrolls the server catalog snapshot',async()=>{
  const api=apiFixture(),call=endpoint(api);
  let r=await call(post({action:'subscribe',provider:event.provider,id:event.id,start:event.start,to:'other@example.invalid',title:'Untrusted message'}));
  assert.equal(r.status,200);assert.deepEqual(api.calls[0].body,{p_owner:owner,p_event:event});
  r=await call(post({action:'subscribe',provider:'explore',id:'fake',start:event.start}));assert.equal(r.status,409);assert.equal(api.calls.length,1);
  api.user=async()=>{throw Object.assign(new Error('Sign in'),{status:401});};r=await call(post({action:'status'}));assert.equal(r.status,401);
});
test('missing sender disables enrollment but permits cancellation and readiness',async()=>{
  const api=apiFixture();api.ready=()=>false;const call=endpoint(api);
  assert.deepEqual(await(await call(post({action:'availability'}))).json(),{enabled:false});
  assert.equal((await call(post({action:'subscribe',provider:'explore',id:event.id,start:event.start}))).status,503);
  assert.equal((await call(post({action:'cancel',id}))).status,200);assert.equal(api.calls[0].body.p_owner,owner);
  assert.equal((await call(post({action:'cancel',id:'invalid'}))).status,400);
  assert.equal((await call(post(null))).status,400);
});
test('email link scanners cannot unsubscribe with GET; explicit POST cancels only token owner',async()=>{
  const api=apiFixture();api.request=async()=>[{id,owner_id:owner}];const call=endpoint(api),url='https://test.example/reminders?unsubscribe='+id;
  const landing=await call(new Request(url));assert.equal(landing.status,303);assert.equal(landing.headers.get('Location'),'https://austin.chat/reminders/#'+id);assert.equal(api.calls.length,0);
  await call(new Request(url,{method:'POST'}));assert.deepEqual(api.calls[0],{name:'reminder_cancel',body:{p_owner:owner,p_id:id}});
});
test('runtime refuses guest or unverified recipients; feed requests stay on fixed allowlist',async()=>{
  let user={id:owner,email:'fixture@example.invalid',is_anonymous:true,email_confirmed_at:at(-1)};const urls=[];
  const api=runtime(key=>({SUPABASE_URL:'https://test.example',SUPABASE_SERVICE_ROLE_KEY:'test'}[key]),async(url)=>{urls.push(url);return Response.json(url.includes('/auth/')?user:{generated:at(-1),features:[feature()]});});
  const request=new Request('https://test.example',{headers:{Authorization:'Bearer fixture'}});
  await assert.rejects(api.user(request));user={...user,is_anonymous:false,email_confirmed_at:null};await assert.rejects(api.user(request));
  await assert.rejects(api.events('https://evil.example'));assert.equal(urls.filter(u=>u.includes('evil')).length,0);
  assert.equal((await api.events('explore')).size,1);assert.equal(urls.filter(u=>u.startsWith('https://raw.githubusercontent.com/')).length,6);
});

function workerFixture(){
  const job={id,reminder_id:id,due_at:at(-0.01),lead_hours:24,state:'processing',attempts:1,payload:null};
  const reminder={id,owner_id:owner,enabled:true,event,event_key:event.key,unsubscribe_token:id};
  const sends=[],updates=[];
  const api={base:'https://test.example',env:key=>({REMINDER_CRON_SECRET:'cron',REMINDER_FROM:'sender@example.invalid',RESEND_API_KEY:'fixture'}[key]),ready:()=>true,
    rpc:async()=>[job],events:async()=>new Map([[event.key,event]]),
    request:async(path,opts)=>{
      if(opts?.method==='PATCH'){updates.push(opts.body);Object.assign(job,opts.body);return null;}
      if(path.includes('/event_reminders?'))return [reminder];
      if(path.includes('/admin/users/'))return {email:'fixture@example.invalid',email_confirmed_at:at(-1),is_anonymous:false};
      if(path.includes('/event_reminder_jobs?'))return [{state:job.state}];throw Error('Unexpected request');
    },fetcher:async(url,opts)=>{sends.push({url,...opts});return Response.json({id:'receipt'});}};
  return {job,reminder,sends,updates,api,call:()=>worker(api)(new Request('https://test.example',{method:'POST',headers:{'x-reminder-cron':'cron'}}))};
}
test('worker requires private Cron secret and sends to confirmed account email once per job key',async()=>{
  const f=workerFixture();assert.equal((await worker(f.api)(post({}))).status,401);
  assert.deepEqual(await(await f.call()).json(),{accepted:1,skipped:0,failed:0});assert.equal(f.job.state,'sent');
  assert.equal(f.sends[0].headers['Idempotency-Key'],'austin-reminder/'+id);assert.deepEqual(JSON.parse(f.sends[0].body).to,['fixture@example.invalid']);
  assert.ok(f.updates[0].payload);assert.match(f.job.payload.headers['List-Unsubscribe'],/unsubscribe=/);
});
test('provider timeout retry reuses exact payload and key',async()=>{
  const f=workerFixture();f.api.fetcher=async(url,opts)=>{f.sends.push({url,...opts});throw Error('timeout');};
  await f.call();const first=f.sends[0];f.job.state='processing';f.job.attempts=2;
  f.api.events=async()=>new Map([[event.key,{...event,title:'Changed title'}]]);await f.call();
  assert.equal(f.sends[1].body,first.body);assert.equal(f.sends[1].headers['Idempotency-Key'],first.headers['Idempotency-Key']);
});
test('cancelled, removed and stale jobs never send; account email changes abort retry',async()=>{
  let f=workerFixture();f.reminder.enabled=false;await f.call();assert.equal(f.sends.length,0);
  f=workerFixture();f.api.events=async()=>new Map();await f.call();assert.equal(f.job.state,'skipped');assert.equal(f.sends.length,0);
  f=workerFixture();f.job.due_at=at(-1);await f.call();assert.equal(f.job.state,'skipped');assert.equal(f.sends.length,0);
  f=workerFixture();f.job.payload={to:['previous@example.invalid']};await f.call();assert.equal(f.sends.length,0);assert.equal(f.job.state,'skipped');
});
test('provider rate-limit errors retry, permanent rejections stop',async()=>{
  const f=workerFixture();f.api.fetcher=async()=>new Response('',{status:429});await f.call();assert.equal(f.job.state,'pending');
  f.job.state='processing';f.api.fetcher=async()=>new Response('',{status:422});await f.call();assert.equal(f.job.state,'failed');
});
