import {message} from '../_shared/geofence-email.mjs';
export function handler(api){return async req=>{
 if(req.method!=='POST'||!api.env('GEOFENCE_CRON_SECRET')||req.headers.get('x-geofence-cron')!==api.env('GEOFENCE_CRON_SECRET'))return new Response('Unauthorized',{status:401});
 if(!api.ready())return Response.json({enabled:false});
 try{
  const jobs=await api.rpc('geofence_mail_claim',{});let accepted=0,skipped=0,failed=0;const deadline=Date.now()+90000;
  for(const job of jobs){
   if(Date.now()>deadline)break;
   const update=fields=>api.rpc('geofence_mail_update',{p_id:job.id,p_lease:job.lease_id,...fields});
   try{
    const context=await api.rpc('geofence_mail_context',{p_id:job.id,p_lease:job.lease_id});
    if(!context||context.email.endsWith('.invalid')){await update({p_state:'skipped',p_result:'Recipient or access unavailable'});skipped++;continue;}
    const payload=job.payload||{from:api.env('REMINDER_FROM'),to:[context.email],...await message(job,context,api.qrPNG)};
    if(payload.to[0]!==context.email){await update({p_state:'skipped',p_result:'Recipient changed'});skipped++;continue;}
    if(!await update({p_payload:payload})){skipped++;continue;}
    const current=await api.rpc('geofence_mail_context',{p_id:job.id,p_lease:job.lease_id});
    if(!current||current.email!==payload.to[0]){await update({p_state:'skipped',p_result:'Settings changed'});skipped++;continue;}
    const result=await api.fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+api.env('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':'austin-geofence/'+job.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
    if(!result.ok){await update({p_state:(result.status===429||result.status>=500)&&job.attempts<5?'pending':'failed',p_result:'Email provider HTTP '+result.status});failed++;continue;}
    const receipt=await result.json();await update({p_state:'sent',p_provider:receipt.id});accepted++;
    await api.pause(700);
   }catch{await update({p_state:job.attempts<5?'pending':'failed',p_result:'Temporary delivery error'}).catch(()=>{});failed++;}
  }
  return Response.json({accepted,skipped,failed});
 }catch{return Response.json({error:'Email worker unavailable'},{status:503});}
};}
