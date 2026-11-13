import {service,problem,API_VERSION} from './billing.mjs';
export function runtime(env,Stripe,fetcher=fetch) {
  const mode=env('BILLING_MODE')||'test',prefix='AUSTIN_STRIPE_'+mode.toUpperCase()+'_';
  const key=env(prefix+'KEY')||env('AUSTIN_STRIPE_KEY'),signing=env(prefix+'WEBHOOK_SECRET')||env('AUSTIN_STRIPE_WEBHOOK_SECRET');
  const portal=env(prefix+'PORTAL')||env('AUSTIN_STRIPE_PORTAL');
  const base=env('SUPABASE_URL'),admin=env('SUPABASE_SERVICE_ROLE_KEY');
  const ready=()=>['test','live'].includes(mode)&&!!key&&new RegExp(`^[rs]k_${mode}_`).test(key)&&!!base&&!!admin;
  const request=async(path,{token=admin,body}={})=>{
    const response=await fetcher(base+path,{method:body===undefined?'GET':'POST',
      headers:{apikey:admin,Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    if(!response.ok){let detail;try{detail=await response.json();}catch{}if(detail?.code==='PT409')throw problem(409,detail.message);if(response.status===409)throw problem(409,'A billing update is in progress. Please try again shortly.');throw new Error('Backend unavailable');}
    return response.status===204?null:response.json();
  };
  const rpc=(name,body)=>request('/rest/v1/rpc/'+name,{body});
  const db={substack:owner=>rpc('billing_substack_access',{p_owner:owner}),
    testing:()=>rpc('access_testing_status',{}),grantTesting:owner=>rpc('access_testing_grant',{p_kind:'pro',p_owner:owner}),
    load:(mode,owner,customer)=>rpc('billing_load',{p_mode:mode,p_owner:owner,p_customer:customer}),
    claim:(mode,owner)=>rpc('billing_claim',{p_mode:mode,p_owner:owner}),
    save:(mode,owner,lease,fields)=>rpc('billing_save',{p_mode:mode,p_owner:owner,p_lease:lease,p_fields:fields}),
    release:(mode,owner,lease)=>rpc('billing_release',{p_mode:mode,p_owner:owner,p_lease:lease})};
  const stripe=ready()?new Stripe(key,{apiVersion:API_VERSION,httpClient:Stripe.createFetchHttpClient(),timeout:10000,maxNetworkRetries:0}):null;
  const billing=stripe?service({stripe,db,mode,portal,
    checkoutEnabled:env('BILLING_CHECKOUT_ENABLED')==='true'&&!!signing&&!!portal}):null;
  async function user(req) {
    const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if(!token)throw problem(401,'Sign in to manage your membership.');
    let u;try{u=await request('/auth/v1/user',{token});}catch{throw problem(401,'Please sign in again.');}
    if(u.is_anonymous!==false||!u.email_confirmed_at||!u.email||!u.id)throw problem(403,'Sign in with a confirmed email to manage your membership.');
    return u;
  }
  return {service:billing,ready,user,
    allowed:u=>mode==='live'||(env('BILLING_TEST_USERS')||'').split(',').map(s=>s.trim()).includes(u.id),
    webhookReady:()=>ready()&&!!signing,
    verify:(body,signature)=>stripe.webhooks.constructEventAsync(body,signature,signing,300,Stripe.createSubtleCryptoProvider())};
}
