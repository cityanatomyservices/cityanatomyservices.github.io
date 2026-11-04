import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {runtime} from '../../supabase/functions/_shared/billing-runtime.mjs';
import {handler} from '../../supabase/functions/stripe-webhook/handler.mjs';
const require=createRequire(new URL('../../tools/billing/package.json',import.meta.url));
const Stripe=require('stripe');
const secret='whsec_'+randomBytes(24).toString('hex');
const key='rk_test_'+randomBytes(24).toString('hex');
const env={BILLING_MODE:'test',AUSTIN_STRIPE_KEY:key,AUSTIN_STRIPE_WEBHOOK_SECRET:secret,SUPABASE_URL:'https://backend.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only-placeholder'};
const body=JSON.stringify({id:'evt_fixture',livemode:false,type:'invoice.paid',data:{object:{customer:'cus_fixture'}}});
const signed=(payload=body,overrides={})=>Stripe.webhooks.generateTestHeaderString({payload,secret,...overrides});
const request=(payload=body,signature=signed())=>new Request('https://edge.invalid',{method:'POST',body:payload,headers:{'Stripe-Signature':signature}});

test('Real Stripe SDK verifies raw body, rejects tampering, wrong signatures and old timestamps',async()=>{
  let delivered=0;const api=runtime(k=>env[k],Stripe);api.service={webhook:async()=>{delivered++;return {received:true};}};
  const handle=handler(api);
  assert.equal((await handle(request())).status,200);
  assert.equal((await handle(request(body+' '))).status,400);
  assert.equal((await handle(request(body,signed(body,{secret:'wrong'})))).status,400);
  assert.equal((await handle(request(body,signed(body,{timestamp:1})))).status,400);
  assert.equal((await handle(request(body,''))).status,400);assert.equal(delivered,1);
});
test('Failed processing requests a retry instead of acknowledging a lost event',async()=>{
  const api=runtime(k=>env[k],Stripe);api.service={webhook:async()=>{throw new Error('private failure');}};
  const response=await handler(api)(request());assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private failure/);
});
test('Missing signing secret and mismatched mode keys fail closed',async()=>{
  for(const changes of [{AUSTIN_STRIPE_WEBHOOK_SECRET:''},{BILLING_MODE:'live'},{AUSTIN_STRIPE_KEY:''}]){
    const settings={...env,...changes};assert.equal((await handler(runtime(k=>settings[k],Stripe))(request())).status,503);
  }
});
test('Sandbox is restricted to explicitly listed account IDs',()=>{
  assert.equal(runtime(k=>env[k],Stripe).allowed({id:'alice'}),false);
  const settings={...env,BILLING_TEST_USERS:'alice, bob'};
  assert.equal(runtime(k=>settings[k],Stripe).allowed({id:'alice'}),true);
  assert.equal(runtime(k=>settings[k],Stripe).allowed({id:'mallory'}),false);
});
test('Backend verifies registered identity with Supabase and never accepts an anonymous account',async()=>{
  const req=new Request('https://edge.invalid',{headers:{Authorization:'Bearer user-token'}});
  for(const user of [{id:'alice',is_anonymous:true,email:'alice@example.invalid',email_confirmed_at:'date'},
    {id:'alice',is_anonymous:false,email:'alice@example.invalid'}]){
    const api=runtime(k=>env[k],Stripe,async()=>Response.json(user));await assert.rejects(api.user(req),{status:403});
  }
  const api=runtime(k=>env[k],Stripe,async(url,options)=>{
    assert.equal(url,'https://backend.invalid/auth/v1/user');assert.equal(options.headers.Authorization,'Bearer user-token');
    return Response.json({id:'alice',is_anonymous:false,email:'alice@example.invalid',email_confirmed_at:'date'});
  });
  assert.equal((await api.user(req)).id,'alice');await assert.rejects(api.user(new Request('https://edge.invalid')),{status:401});
});
