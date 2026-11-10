import {service} from './geofence-billing.mjs';
import {problem,API_VERSION} from './billing.mjs';
export function runtime(env,Stripe,fetcher=fetch){
 const mode=env('GEOFENCE_BILLING_MODE')||'live',key=env(mode==='live'?'AUSTIN_STRIPE_LIVE_KEY':'AUSTIN_STRIPE_KEY');
 const price=env('GEOFENCE_STRIPE_PRICE'),portal=env('GEOFENCE_STRIPE_PORTAL'),signing=env('GEOFENCE_STRIPE_WEBHOOK_SECRET');
 const base=env('SUPABASE_URL'),admin=env('SUPABASE_SERVICE_ROLE_KEY');
 const stripe=key&&new RegExp(`^[rs]k_${mode}_`).test(key)?new Stripe(key,{apiVersion:API_VERSION,httpClient:Stripe.createFetchHttpClient(),timeout:10000,maxNetworkRetries:0}):null;
 async function request(path,{token=admin,body}={}){
  const r=await fetcher(base+path,{method:body===undefined?'GET':'POST',headers:{apikey:admin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!r.ok){let detail;try{detail=await r.json();}catch{}if(/^PT(404|409|422|429)$/.test(detail?.code))throw problem(Number(detail.code.slice(2)),detail.message);throw Error('Backend unavailable');}return r.status===204?null:r.json();
 }
 const rpc=(name,body)=>request('/rest/v1/rpc/'+name,{body});
 const db={claim:(mode,id,owner)=>rpc('geofence_billing_claim',{p_mode:mode,p_id:id,p_owner:owner}),load:(mode,id,customer)=>rpc('geofence_billing_load',{p_mode:mode,p_id:id,p_customer:customer}),save:(mode,id,lease,fields)=>rpc('geofence_billing_save',{p_mode:mode,p_id:id,p_lease:lease,p_fields:fields}),release:(mode,id,lease)=>rpc('geofence_billing_release',{p_mode:mode,p_id:id,p_lease:lease})};
 const enabled=env('GEOFENCE_CHECKOUT_ENABLED')==='true'&&!!price&&!!portal&&!!signing&&!!stripe;
 return {mode,enabled,rpc,fetcher,service:stripe?service({stripe,db,mode,price,portal,enabled}):null,
  async user(req){const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!token)throw problem(401,'Sign in to manage geofences.');let u;try{u=await request('/auth/v1/user',{token});}catch{throw problem(401,'Please sign in again.');}if(u.is_anonymous!==false||!u.email_confirmed_at||!u.id)throw problem(403,'A confirmed account is required.');if(mode==='test'&&!(env('GEOFENCE_TEST_USERS')||'').split(',').includes(u.id))throw problem(403,'Test account required.');return u;},
  webhookReady:()=>!!stripe&&!!signing&&!!price,
  verify:(body,sig)=>stripe.webhooks.constructEventAsync(body,sig,signing,300,Stripe.createSubtleCryptoProvider())};
}
