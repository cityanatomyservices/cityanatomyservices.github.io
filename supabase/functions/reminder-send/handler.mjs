import {message} from '../../../shared/reminder-model.mjs';
export function handler(api) {
  const update=(id,body)=>api.request('/rest/v1/event_reminder_jobs?id=eq.'+id+'&state=eq.processing',{method:'PATCH',body});
  return async req=>{
    if(req.method!=='POST'||!api.env('REMINDER_CRON_SECRET')||req.headers.get('x-reminder-cron')!==api.env('REMINDER_CRON_SECRET'))return new Response('Unauthorized',{status:401});
    if(!api.ready())return Response.json({enabled:false});
    try {
      const jobs=await api.rpc('reminder_claim',{}),feeds=new Map(),deadline=Date.now()+90000;let accepted=0,skipped=0,failed=0;
      for(const job of jobs){
        if(Date.now()>deadline)break; // Remaining leases expire and another tick picks them up.
        try {
          const [row]=await api.request('/rest/v1/event_reminders?id=eq.'+job.reminder_id+'&select=*');
          if(!row?.enabled){await update(job.id,{state:'cancelled'});skipped++;continue;}
          if(!feeds.has(row.event.provider))feeds.set(row.event.provider,api.events(row.event.provider));
          const current=(await feeds.get(row.event.provider)).get(row.event_key);
          if(!current || Date.parse(current.start)<=Date.now()){
            await update(job.id,{state:'skipped',result:'Event removed, expired, cancelled or rescheduled'});skipped++;continue;
          }
          const u=await api.request('/auth/v1/admin/users/'+row.owner_id);
          if(!u?.email_confirmed_at || !u.email || u.is_anonymous || u.deleted_at || (u.banned_until&&Date.parse(u.banned_until)>Date.now())){
            await update(job.id,{state:'skipped',result:'Confirmed account email unavailable'});skipped++;continue;
          }
          // Persist the exact request before sending; retries reuse its idempotency
          // key and body even if a feed or account changes between attempts.
          const unsubscribe=api.base+'/functions/v1/reminders?unsubscribe='+row.unsubscribe_token;
          const payload=job.payload || {from:api.env('REMINDER_FROM'),to:[u.email],...message(current,job.lead_hours,'https://austin.chat/reminders/#'+row.unsubscribe_token),
            headers:{'List-Unsubscribe':`<${unsubscribe}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}};
          if(payload.to[0]!==u.email){await update(job.id,{state:'skipped',result:'Account email changed'});skipped++;continue;}
          if(!job.payload)await update(job.id,{payload});
          const [check]=await api.request('/rest/v1/event_reminder_jobs?id=eq.'+job.id+'&select=state');
          if(check?.state!=='processing'){skipped++;continue;}
          if(Date.parse(job.due_at)<Date.now()-15*60000){await update(job.id,{state:'skipped',result:'Delivery window passed'});skipped++;continue;}
          const response=await api.fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+api.env('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':'austin-reminder/'+job.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
          if(!response.ok){
            const retry=response.status===429||response.status>=500;
            await update(job.id,{state:retry&&job.attempts<5?'pending':'failed',result:'Email provider HTTP '+response.status});failed++;continue;
          }
          const receipt=await response.json();
          await update(job.id,{state:'sent',provider_id:receipt.id,sent_at:new Date().toISOString(),result:null});accepted++;
          // Resend's default rate limit is shared with other senders.
          await new Promise(resolve=>setTimeout(resolve,600));
        }catch{
          // Do not log addresses, event choices, unsubscribe tokens or secrets.
          await update(job.id,{state:job.attempts<5?'pending':'failed',result:'Temporary delivery or source error'}).catch(()=>{});failed++;
        }
      }
      return Response.json({accepted,skipped,failed});
    }catch{return Response.json({error:'Reminder worker unavailable'},{status:503});}
  };
}
