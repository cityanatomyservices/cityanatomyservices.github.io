import test from 'node:test';
import assert from 'node:assert/strict';
import {service,entitlement,membership,PRICES,problem} from '../../supabase/functions/_shared/billing.mjs';
import {handler} from '../../supabase/functions/billing/handler.mjs';
const NOW=Date.parse('2026-11-04T12:00:00Z'),end=Math.floor(NOW/1000)+86400;
const paid=(overrides={})=>({id:'sub_site',status:'active',items:{data:[{price:{id:PRICES.test},current_period_end:end}]},latest_invoice:{status:'paid'},...overrides});

function fixture({rows=[],subscriptions=[],enabled=true,mode='test',substack=null}={}) {
  const records=new Map(rows.map(row=>[row.owner_id,{...row}])),calls=[];let creates=0,failSave=false;
  const db={
    async substack(owner){calls.push(['substack',owner]);return substack;},
    async load(mode,owner,customer){const row=owner?records.get(owner):[...records.values()].find(r=>r.customer_id===customer);return row?{...row}:null;},
    async claim(mode,owner){let row=records.get(owner);if(!row){row={owner_id:owner,mode,checkout_nonce:'nonce',status:'none'};records.set(owner,row);}if(row.lease_id)throw problem(409,'Busy');row.lease_id='lease';return {...row};},
    async save(mode,owner,lease,fields){if(failSave&&fields.checkout_id){failSave=false;throw new Error('Database disconnected');}const row=records.get(owner);assert.equal(row.lease_id,lease);Object.assign(row,fields);return {...row};},
    async release(mode,owner){records.get(owner).lease_id=null;}
  };
  const sessions=new Map(),idempotency=new Map();
  const stripe={
    prices:{async retrieve(id){return {id,active:true,livemode:mode==='live',currency:'usd',unit_amount:800,recurring:{interval:'month',interval_count:1}};}},
    customers:{async create(params,options){calls.push(['customer',params,options]);return {id:'cus_'+params.metadata.supabase_user_id};}},
    subscriptions:{list(params){calls.push(['list',params]);return (async function*(){yield*subscriptions;})();}},
    checkout:{sessions:{async retrieve(id){return sessions.get(id);},async create(params,options){calls.push(['checkout',params,options]);if(idempotency.has(options.idempotencyKey))return idempotency.get(options.idempotencyKey);const session={id:'cs_'+(++creates),status:'open',expires_at:end,url:'https://checkout.stripe.com/'+creates};sessions.set(session.id,session);idempotency.set(options.idempotencyKey,session);return session;}}},
    billingPortal:{configurations:{async retrieve(){return {active:true,livemode:mode==='live',features:{subscription_cancel:{enabled:true,mode:'at_period_end'}}};}},
      sessions:{async create(params){calls.push(['portal',params]);return {url:'https://billing.stripe.com/portal'};}}}
  };
  return {service:service({stripe,db,mode,portal:'bpc_site',checkoutEnabled:enabled,now:()=>NOW,uuid:()=> 'next-nonce'}),
    stripe,db,records,calls,sessions,subscriptions,failNextSave:()=>{failSave=true;},creates:()=>creates};
}

test('Free default, paid Pro, and expiration are determined by server time',()=>{
  assert.equal(membership(null,NOW).plan,'free');
  const row=entitlement([paid()],PRICES.test,NOW);
  assert.equal(membership(row,NOW).plan,'pro');
  assert.equal(membership(row,end*1000).plan,'free');
});

test('Verified Substack access blocks live checkout before any Stripe or billing mutation',async()=>{
  const f=fixture({mode:'live',substack:{paidThrough:new Date(end*1000).toISOString()}});
  await assert.rejects(f.service.checkout({id:'alice'}),{status:409});
  assert.deepEqual(f.calls,[['substack','alice']]);assert.equal(f.records.size,0);assert.equal(f.creates(),0);
});
test('Missing or expired Substack access permits live checkout at the existing price',async()=>{
  const f=fixture({mode:'live'});await f.service.checkout({id:'alice'});
  assert.equal(f.creates(),1);assert.equal(f.calls.find(c=>c[0]==='checkout')[1].line_items[0].price,PRICES.live);
});
test('Substack lookup failure cannot bypass duplicate-payment protection',async()=>{
  const f=fixture({mode:'live'});f.db.substack=async()=>{throw new Error('Unavailable');};
  await assert.rejects(f.service.checkout({id:'alice'}));assert.equal(f.records.size,0);assert.equal(f.creates(),0);
});
test('Substack live access does not alter isolated sandbox billing',async()=>{
  const f=fixture({substack:{paidThrough:new Date(end*1000).toISOString()}});await f.service.checkout({id:'alice'});
  assert.equal(f.creates(),1);assert.equal(f.calls.some(c=>c[0]==='substack'),false);
});
for(const state of ['trialing','past_due','unpaid','incomplete','incomplete_expired','canceled','paused'])test(state+' does not grant Pro',()=>{
  assert.equal(membership(entitlement([paid({status:state})],PRICES.test,NOW),NOW).plan,'free');
});
test('Unpaid invoice, paused collection, unrelated prices and expired periods stay Free',()=>{
  for(const sub of [paid({latest_invoice:{status:'open'}}),paid({latest_invoice:'in_unexpanded'}),paid({pause_collection:{behavior:'void'}}),
    paid({items:{data:[{price:{id:'price_substack'},current_period_end:end}]}}),paid({items:{data:[{price:{id:PRICES.test},current_period_end:1}]}})])
    assert.equal(entitlement([sub],PRICES.test,NOW).pro_until,null);
});
test('Cancellation at period end keeps paid access until that date',()=>{
  const row=entitlement([paid({cancel_at_period_end:true})],PRICES.test,NOW);
  assert.equal(membership(row,NOW).plan,'pro');assert.equal(row.cancel_at_period_end,true);
});
test('Checkout uses verified owner, fixed monthly price and fixed site return URL',async()=>{
  const f=fixture();await f.service.checkout({id:'alice',email:'alice@example.invalid'});
  const [,params]=f.calls.find(c=>c[0]==='checkout');
  assert.equal(params.customer,'cus_alice');assert.equal(params.client_reference_id,'alice');
  assert.deepEqual(params.line_items,[{price:PRICES.test,quantity:1}]);assert.equal(params.mode,'subscription');
  assert.equal(params.success_url,'https://austin.chat/?billing=success');
  assert.equal('payment_method_types' in params,false);assert.equal('trial_period_days' in params.subscription_data,false);
  assert.equal(f.records.get('alice').pro_until,null);
});
test('Repeated clicks reuse one open checkout session',async()=>{
  const f=fixture();const a=await f.service.checkout({id:'alice'}),b=await f.service.checkout({id:'alice'});
  assert.deepEqual(a,b);assert.equal(f.creates(),1);
});
test('Lost checkout database write retries the same Stripe idempotency key',async()=>{
  const f=fixture();f.failNextSave();await assert.rejects(f.service.checkout({id:'alice'}));
  await f.service.checkout({id:'alice'});assert.equal(f.creates(),1);
});
test('Concurrent clicks cannot start a second purchase',async()=>{
  const f=fixture();const pending=f.service.checkout({id:'alice'});
  await assert.rejects(f.service.checkout({id:'alice'}),{status:409});await pending;assert.equal(f.creates(),1);
});
for(const state of ['active','past_due','unpaid','incomplete','paused'])test('Existing '+state+' subscription goes to the portal',async()=>{
  const f=fixture({rows:[{owner_id:'alice',customer_id:'cus_alice'}],subscriptions:[paid({status:state})]});
  const result=await f.service.checkout({id:'alice'});assert.match(result.url,/billing.stripe.com/);assert.equal(f.creates(),0);
});
test('Expired sessions rotate the persisted checkout nonce',async()=>{
  const f=fixture();await f.service.checkout({id:'alice'});f.sessions.get('cs_1').status='expired';
  await f.service.checkout({id:'alice'});assert.equal(f.creates(),2);assert.equal(f.records.get('alice').checkout_nonce,'next-nonce');
});
test('Completed asynchronous checkout blocks duplicate purchase before subscription exists',async()=>{
  const f=fixture();await f.service.checkout({id:'alice'});f.sessions.get('cs_1').status='complete';
  await assert.rejects(f.service.checkout({id:'alice'}),{status:409});assert.equal(f.creates(),1);
});
test('Checkout cannot run before activation or when price configuration is wrong',async()=>{
  const f=fixture({enabled:false});await assert.rejects(f.service.checkout({id:'alice'}),{status:503});assert.equal(f.creates(),0);
  const g=fixture();g.stripe.prices.retrieve=async()=>({active:true,livemode:true});await assert.rejects(g.service.checkout({id:'alice'}));assert.equal(g.creates(),0);
});
test('Portal uses only the authenticated account customer',async()=>{
  const f=fixture({rows:[{owner_id:'alice',customer_id:'cus_alice'},{owner_id:'bob',customer_id:'cus_bob'}]});
  await f.service.manage({id:'alice'});assert.equal(f.calls[0][1].customer,'cus_alice');
  await assert.rejects(f.service.manage({id:'mallory'}),{status:409});
});
test('Replayed and reversed webhook snapshots use fresh Stripe state',async()=>{
  const f=fixture({rows:[{owner_id:'alice',customer_id:'cus_alice'}],subscriptions:[paid({status:'canceled'})]});
  const stale={type:'customer.subscription.updated',livemode:false,data:{object:{customer:'cus_alice',status:'active'}}};
  await f.service.webhook(stale);await f.service.webhook(stale);assert.equal(f.records.get('alice').pro_until,null);
  f.subscriptions[0]=paid();await f.service.webhook({...stale,type:'customer.subscription.deleted'});
  assert.equal(membership(f.records.get('alice'),NOW).plan,'pro');
  f.subscriptions[0]=paid({latest_invoice:{status:'open'},status:'past_due'});await f.service.webhook({...stale,type:'invoice.payment_failed'});
  assert.equal(membership(f.records.get('alice'),NOW).plan,'free');
});
test('Foreign customers, unrelated event types and other modes cannot grant membership',async()=>{
  const f=fixture();
  for(const event of [{type:'invoice.paid',livemode:false,data:{object:{customer:'cus_substack'}}},
    {type:'invoice.paid',livemode:true,data:{object:{customer:'cus_alice'}}},
    {type:'payment_intent.succeeded',livemode:false,data:{object:{customer:'cus_alice'}}}])await f.service.webhook(event);
  assert.equal(f.records.size,0);assert.equal(f.calls.length,0);
});
test('Deleted customer loses entitlement',async()=>{
  const f=fixture({rows:[{owner_id:'alice',customer_id:'cus_alice',...entitlement([paid()],PRICES.test,NOW)}]});
  await f.service.webhook({type:'customer.deleted',livemode:false,data:{object:{id:'cus_alice'}}});
  assert.equal(membership(f.records.get('alice'),NOW).plan,'free');
});

test('HTTP endpoint rejects foreign identity, price, return URL and checkout-return claims',async()=>{
  let called=0;const handle=handler({user:async()=>({id:'alice'}),ready:()=>true,allowed:()=>true,service:{checkout:async()=>{called++;return {};}}});
  for(const payload of [{action:'checkout',user_id:'bob'},{action:'checkout',price:'cheap'},{action:'checkout',url:'https://evil.invalid'},
    {action:'status',session_id:'cs_forged'},{action:'grantPro'},null,[],{action:'checkout',plan:'pro'}]){
    const response=await handle(new Request('https://edge.invalid',{method:'POST',body:JSON.stringify(payload)}));assert.equal(response.status,400);
  }
  assert.equal(called,0);
});
test('HTTP endpoint authenticates, blocks foreign origins and hides internal errors',async()=>{
  const handle=handler({user:async()=>{throw problem(401,'Sign in.');},ready:()=>true});
  const req=(origin,body='{"action":"checkout"}')=>new Request('https://edge.invalid',{method:'POST',headers:{Origin:origin},body});
  assert.equal((await handle(req('https://evil.invalid'))).status,403);
  assert.equal((await handle(req('https://austin.chat'))).status,401);
  const internal=handler({user:async()=>{throw new Error('secret must never appear');}});
  const response=await internal(req('https://austin.chat'));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/secret/);
});
