/* Live access-control and scheduling checks. Disposable confirmed accounts only;
   no provider calls, no actual email, no access to existing members' data. */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const ref='aqbyxpiwugcvoephsvpm',base=`https://${ref}.supabase.co`,users=[];
const publishable='sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN';let admin;
const headers=token=>({apikey:publishable,Authorization:'Bearer '+token,'Content-Type':'application/json'});
async function request(url,body,h,method=body===undefined?'GET':'POST'){
  const r=await fetch(url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
  if(!r.ok)throw new Error(`Backend test ${new URL(url).pathname}: HTTP ${r.status}`);
  return r.status===204?null:r.json();
}
const rest=(route,body,method)=>request(base+'/rest/v1/'+route,body,admin,method);
const rpc=(name,body)=>rest('rpc/'+name,body);
async function account(){
  const email='qa-reminder-'+crypto.randomUUID()+'@example.invalid';
  const user=await request(base+'/auth/v1/admin/users',{email,email_confirm:true,user_metadata:{austin_auth_qa:true}},admin);users.push(user.id);
  const link=await request(base+'/auth/v1/admin/generate_link',{type:'magiclink',email},admin);
  const session=await request(base+'/auth/v1/verify',{type:'email',email,token:link.email_otp||link.properties.email_otp},{apikey:publishable,'Content-Type':'application/json'});
  return {id:user.id,h:headers(session.access_token)};
}
(async()=>{try{
  const management=fs.readFileSync(path.join(os.homedir(),'.supabase/access-token'),'utf8').trim();
  const keys=await request(`https://api.supabase.com/v1/projects/${ref}/api-keys`,undefined,{Authorization:'Bearer '+management});
  const service=keys.find(k=>k.name==='service_role').api_key;admin={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const a=await account(),b=await account();
  const edge=(member,body)=>request(base+'/functions/v1/reminders',body,member.h);
  const {eventKey}=await import('../../shared/reminder-model.mjs');
  const event=hours=>{const start=new Date(Date.now()+hours*3600000).toISOString(),id='qa-'+crypto.randomUUID();return {provider:'explore',id,key:eventKey('explore',id,start),start,title:'Disposable reminder check',url:'https://example.invalid/test'};};
  const early=event(48),late=event(20);
  const first=await rpc('reminder_enroll',{p_owner:a.id,p_event:early});
  assert.equal(await rpc('reminder_enroll',{p_owner:a.id,p_event:early}),first,'Repeated selection is idempotent');
  let jobs=await rest('event_reminder_jobs?reminder_id=eq.'+first);assert.deepEqual(jobs.map(j=>j.lead_hours).sort((a,b)=>a-b),[2,24]);
  for(const job of jobs)assert.equal(Date.parse(early.start)-Date.parse(job.due_at),job.lead_hours*3600000);
  const second=await rpc('reminder_enroll',{p_owner:b.id,p_event:late});
  jobs=await rest('event_reminder_jobs?reminder_id=eq.'+second);assert.deepEqual(jobs.map(j=>j.lead_hours),[2]);
  const mine=await edge(a,{action:'status'});assert.equal(mine.reminders.length,1);assert.equal(mine.reminders[0].id,first);assert.equal(mine.reminders[0].unsubscribe_token,undefined);
  assert.equal((await edge(b,{action:'status'})).reminders[0].id,second);
  // Arbitrary owner IDs cannot grant access or cancel another person's selection.
  await edge(a,{action:'cancel',id:second,owner_id:b.id});assert.equal((await edge(b,{action:'status'})).reminders.length,1);
  for(const [route,body,method] of [['event_reminders',undefined,'GET'],['event_reminder_jobs',undefined,'GET'],['event_reminders',{owner_id:a.id,event_key:'forged',event:early,starts_at:early.start},'POST'],['rpc/reminder_enroll',{p_owner:a.id,p_event:early},'POST'],['rpc/reminder_claim',{},'POST']]){
    const r=await fetch(base+'/rest/v1/'+route,{method,headers:a.h,body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,403,'Members cannot bypass trusted enrollment or read delivery tokens');
  }
  const anon=await fetch(base+'/functions/v1/reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status'})});assert.equal(anon.status,401);
  assert.equal((await fetch(base+'/functions/v1/reminder-send',{method:'POST',headers:a.h})).status,401);
  await edge(a,{action:'cancel',id:first});assert.equal((await edge(a,{action:'status'})).reminders.length,0);
  assert.ok((await rest('event_reminder_jobs?reminder_id=eq.'+first)).every(j=>j.state==='cancelled'));
  await rpc('reminder_enroll',{p_owner:a.id,p_event:early});assert.equal((await rest('event_reminder_jobs?reminder_id=eq.'+first)).length,2);
  const [row]=await rest('event_reminders?id=eq.'+first);
  const unsubscribe=base+'/functions/v1/reminders?unsubscribe='+row.unsubscribe_token;
  assert.equal((await fetch(unsubscribe,{redirect:'manual'})).status,303);assert.equal((await edge(a,{action:'status'})).reminders.length,1,'GET never cancels');
  assert.equal((await fetch(unsubscribe,{method:'POST'})).status,200);assert.equal((await edge(a,{action:'status'})).reminders.length,0);
  // Claim only while delivery is paused and no other due jobs exist.
  if(!mine.enabled){
    const due=await rest('event_reminder_jobs?state=in.(pending,processing)&due_at=lte.'+encodeURIComponent(new Date().toISOString())+'&select=id');
    if(!due.length){
      await rest('event_reminder_jobs?reminder_id=eq.'+second,{due_at:new Date(Date.now()-1000).toISOString()},'PATCH');
      const claims=await Promise.all([rpc('reminder_claim',{}),rpc('reminder_claim',{})]);assert.equal(claims.flat().length,1,'Concurrent workers cannot claim the same delivery');
    }
  }
  await edge(b,{action:'cancel',id:null});assert.equal((await edge(b,{action:'status'})).reminders.length,0);
  console.log('Live backend: private access, trusted enrollment, exact lead times, duplicate selection, late selection, cross-account isolation, cancellation, unsubscribe and worker authentication passed. No email sent.');
}finally{
  for(const id of users)await request(base+'/auth/v1/admin/users/'+id,undefined,admin,'DELETE');
}})().catch(e=>{console.error(e.message);process.exitCode=1;});
