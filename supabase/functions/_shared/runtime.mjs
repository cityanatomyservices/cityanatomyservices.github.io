import {FEEDS,catalog} from '../../../shared/reminder-model.mjs';
export function runtime(env, fetcher=fetch) {
  const base=env('SUPABASE_URL'), key=env('SUPABASE_SERVICE_ROLE_KEY');
  const ready=()=>env('REMINDERS_ENABLED')==='true' && !!env('RESEND_API_KEY') && !!env('REMINDER_FROM');
  const request=async(path,{method='GET',body,token=key,prefer}={})=>{
    const response=await fetcher(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    if(!response.ok){const error=new Error('Reminder service is temporarily unavailable. Please try again.');error.status=response.status;throw error;}
    return response.status===204?null:response.json();
  };
  const rpc=(name,body)=>request('/rest/v1/rpc/'+name,{method:'POST',body});
  async function user(req) {
    const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if(!token)throw Object.assign(new Error('Sign in to select email reminders.'),{status:401});
    let u;try{u=await request('/auth/v1/user',{token});}catch{throw Object.assign(new Error('Please sign in again.'),{status:401});}
    if(u.is_anonymous || !u.email || !u.email_confirmed_at)throw Object.assign(new Error('Sign in with a confirmed email to select reminders.'),{status:403});
    return u;
  }
  async function events(provider) {
    const paths=provider==='explore'?FEEDS.map(id=>`explore/${id}.geojson`):provider==='city-hall'?['city-hall.json']:[];
    if(!paths.length)throw Object.assign(new Error('Unknown event source.'),{status:400});
    const feeds=await Promise.all(paths.map(async path=>{
      const response=await fetcher('https://raw.githubusercontent.com/cityanatomyservices/cityanatomyservices.github.io/main/chat/data/'+path,{signal:AbortSignal.timeout(15000),cache:'no-store'});
      if(!response.ok)throw new Error('Event listings are unavailable. Please try again later.');
      return response.json();
    }));
    return catalog(provider,feeds);
  }
  return {env,fetcher,base,ready,request,rpc,user,events};
}
export const uuid = value => typeof value==='string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
