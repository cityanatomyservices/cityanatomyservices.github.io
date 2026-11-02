import {eventKey,instant,leadHours} from '../../../shared/reminder-model.mjs';
import {uuid} from '../_shared/runtime.mjs';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Cache-Control':'no-store'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json'}});
export function handler(api) {
  async function status(u) {
    const rows=u?await api.request(`/rest/v1/event_reminders?owner_id=eq.${u.id}&enabled=eq.true&starts_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,event_key,event,starts_at,event_reminder_jobs(lead_hours,state)&order=starts_at.asc`):[];
    return {enabled:api.ready(),email:u?.email||null,reminders:rows};
  }
  return async req=>{
    if(req.method==='OPTIONS')return new Response('ok',{headers});
    try {
      const token=new URL(req.url).searchParams.get('unsubscribe');
      if(token!==null){
        if(!uuid(token))return json({error:'Invalid cancellation link. Manage reminders from your account.'},400);
        // Hosted Supabase endpoints rewrite HTML to plain text. The confirmation
        // page lives on Austin.chat; its fragment keeps the token out of logs.
        if(req.method==='GET')return new Response(null,{status:303,headers:{Location:'https://austin.chat/reminders/#'+token,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
        if(req.method!=='POST')return json({error:'Method not allowed.'},405);
        const rows=await api.request('/rest/v1/event_reminders?unsubscribe_token=eq.'+token+'&select=id,owner_id');
        if(rows[0])await api.rpc('reminder_cancel',{p_owner:rows[0].owner_id,p_id:rows[0].id});
        return json({cancelled:true});
      }
      if(req.method!=='POST')return json({error:'Method not allowed.'},405);
      const raw=await req.text();if(raw.length>2048)return json({error:'Request too large.'},413);
      let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
      if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid request.'},400);
      if(body.action==='availability')return json({enabled:api.ready()});
      const u=await api.user(req);
      if(body.action==='status')return json(await status(u));
      if(body.action==='cancel') {
        if(body.id!==null && !uuid(body.id))return json({error:'Invalid reminder.'},400);
        await api.rpc('reminder_cancel',{p_owner:u.id,p_id:body.id});return json(await status(u));
      }
      if(body.action!=='subscribe')return json({error:'Unknown action.'},400);
      if(!api.ready())return json({error:'Email reminders are not available yet. Please check back soon.'},503);
      if(!['explore','city-hall'].includes(body.provider)||typeof body.id!=='string'||body.id.length>200||!instant(body.start))return json({error:'Choose a timed event.'},400);
      const events=await api.events(body.provider),event=events.get(eventKey(body.provider,body.id,body.start));
      if(!event)return json({error:'This event time is no longer available. Refresh the listings.'},409);
      if(!leadHours(event.start).length)return json({error:'It is too late to select a reminder: this event starts in less than two hours.'},409);
      const existing=await status(u);
      if(existing.reminders.length>=100&&!existing.reminders.some(r=>r.event_key===event.key))return json({error:'You can select up to 100 upcoming event reminders. Cancel one first.'},409);
      // No browser-provided recipient or card text is stored or sent.
      await api.rpc('reminder_enroll',{p_owner:u.id,p_event:event});
      return json(await status(u));
    }catch(error){return json({error:error.status===401||error.status===403?error.message:'Reminders could not update. Please try again later.'},error.status===401||error.status===403?error.status:503);}
  };
}
