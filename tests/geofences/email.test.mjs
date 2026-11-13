import test from 'node:test';import assert from 'node:assert/strict';
import {message} from '../../supabase/functions/_shared/geofence-email.mjs';
import {handler as worker} from '../../supabase/functions/geofence-send/handler.mjs';
import {handler as confirm} from '../../supabase/functions/geofence-email/handler.mjs';
const id='68d071c2-ac2d-449b-ac02-0caf2e17efcd',context={id,name:'<script>Circle</script>',description:'<img src=x onerror=alert(1)>',email:'owner@example.test',verifyToken:id,stopToken:id};
test('Share email contains the permanent link and embedded PNG QR, escapes user text and has no private alert token',async()=>{
 const m=await message({kind:'welcome'},context,async url=>{assert.equal(url,'https://austin.chat/geofences/?id='+id);return 'png-fixture';});assert.match(m.text,/Joining is free/);assert.equal(m.attachments[0].content_id,'geofence-qr');assert.equal(m.attachments[0].content,'png-fixture');assert.match(m.html,/&lt;script&gt;/);assert.doesNotMatch(m.html,/<script>|<img src=x/);assert.doesNotMatch(m.text,/notifications\/#/);
});
test('Activity reports each transition, explains disconnected departures and includes the private stop link',async()=>{
 const m=await message({kind:'activity',events:[{kind:'enter',name:'Visitor A',at:'2026-11-13T12:00:00Z'},{kind:'leave',name:'Visitor A',at:'2026-11-13T12:01:00Z'}]},context);assert.match(m.text,/entered/);assert.match(m.text,/left.*disconnected/);assert.match(m.text,/notifications\/#stop\//);assert.match(m.text,/Austin time/);
});
function fixture(){const updates=[],requests=[];let current={...context},jobs=[{id,lease_id:id,kind:'welcome',attempts:1}],response=Response.json({id:'receipt'});
 const api={env:n=>({GEOFENCE_CRON_SECRET:'secret',REMINDER_FROM:'sender@example.test',RESEND_API_KEY:'key'})[n],ready:()=>true,qrPNG:async()=> 'png',pause:async()=>{},rpc:async(n,b)=>{if(n==='geofence_mail_claim')return jobs;if(n==='geofence_mail_context')return current;if(n==='geofence_mail_update'){updates.push(b);return true;}throw Error('unexpected');},fetcher:async(url,options)=>{requests.push({url,options});return response;}};
 return {api,updates,requests,setContext:v=>current=v,setJobs:v=>jobs=v,setResponse:v=>response=v,send:(header='secret')=>worker(api)(new Request('https://x',{method:'POST',headers:{'x-geofence-cron':header}}))};}
test('Worker authentication, readiness, private payload and stable idempotency',async()=>{const f=fixture();assert.equal((await f.send('wrong')).status,401);assert.equal(f.requests.length,0);assert.equal((await f.send()).status,200);assert.equal(f.requests.length,1);assert.equal(f.requests[0].options.headers['Idempotency-Key'],'austin-geofence/'+id);assert.ok(f.updates.some(v=>v.p_payload));assert.ok(f.updates.some(v=>v.p_state==='sent'&&v.p_provider==='receipt'));});
test('Cancelled/unverified/changed recipients cannot send, and provider retry uses the saved payload',async()=>{
 const f=fixture();f.setContext(null);await f.send();assert.equal(f.requests.length,0);
 f.setContext(context);const payload={from:'old-sender',to:[context.email],subject:'frozen',text:'exact payload'};f.setJobs([{id,lease_id:id,kind:'welcome',attempts:2,payload}]);f.setResponse(Response.json({}, {status:429}));await f.send();assert.deepEqual(JSON.parse(f.requests[0].options.body),payload);assert.equal(f.updates.at(-1).p_state,'pending');
 f.setContext({...context,email:'changed@example.test'});await f.send();assert.equal(f.requests.length,1);
});
test('Email token endpoint never acts on GET, rejects foreign origins/fields and sends only the submitted capability',async()=>{
 const calls=[],h=confirm({rpc:async(n,b)=>{calls.push({n,b});return {ok:true};}});
 assert.equal((await h(new Request('https://x'))).status,405);
 for(const [body,origin,status] of [[{action:'verify',token:id},'https://evil.test',403],[{action:'verify',token:id,email:'victim'},'https://austin.chat',400],[{action:'verify',token:id},'https://austin.chat',200]])assert.equal((await h(new Request('https://x',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}))).status,status);
 assert.deepEqual(calls,[{n:'geofence_email_token',b:{p_token:id,p_action:'verify'}}]);
});
