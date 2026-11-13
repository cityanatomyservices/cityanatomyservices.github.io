import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../shared/membership.js',import.meta.url),'utf8');
function fixture(){
  let callback;const redirects=[],calls=[];
  const config={api:{plan:'free',mode:'live',checkoutEnabled:true,hasBilling:false},rpc:{plan:'free',hasBilling:false},error:null};
  const session={registered:true,user:{id:'alice'},peek:async()=>{},subscribe:fn=>callback=fn,
    client:()=>({functions:{invoke:async(name,{body})=>{
      calls.push(body.action);if(config.invoke)return config.invoke(body.action);
      return {data:body.action==='status'?config.api:{url:config.url||'https://checkout.stripe.com/test-session'},error:config.error};
    }},rpc:async name=>{assert.equal(name,'membership_read');return {data:config.rpc,error:null};}})};
  const window={AustinSession:session,location:{assign:url=>redirects.push(url)}};window.parent=window;
  vm.runInNewContext(source,{window,URL,Set,Error,setTimeout:fn=>setImmediate(fn)});
  return {model:window.AustinMembership,session,config,calls,redirects,switch(id){session.user=id?{id}:null;session.registered=!!id;callback();}};
}
test('Test Pro never overrides the live entitlement exposed to apps',async()=>{
  const f=fixture();f.config.api={plan:'pro',mode:'test',checkoutEnabled:true,hasBilling:true};
  const state=await f.model.load();assert.equal(state.plan,'free');assert.equal(state.testPlan,'pro');assert.equal(state.testMode,true);
});

test('Free activation refreshes membership without a payment redirect',async()=>{
  const f=fixture();f.config.rpc={plan:'pro',temporaryAccess:true,source:'testing',paidThrough:null};
  f.config.invoke=async action=>({data:action==='checkout'?{activated:true,temporaryAccess:true}:{mode:'live',freeTesting:true,checkoutEnabled:true}});
  await f.model.checkout();assert.equal(f.model.state.plan,'pro');assert.equal(f.model.state.temporaryAccess,true);assert.equal(f.redirects.length,0);
});
test('Members can read Free while checkout is unavailable to them during testing',async()=>{
  const f=fixture();f.config.error={context:{status:403,clone:()=>({json:async()=>({error:'Pro is being tested.'})})}};
  const state=await f.model.load();assert.equal(state.plan,'free');assert.equal(state.checkoutEnabled,false);
});
test('Changing account clears membership immediately and rejects stale responses',async()=>{
  const f=fixture();f.config.rpc={plan:'pro',hasBilling:true};await f.model.load();assert.equal(f.model.state.plan,'pro');
  let finish;f.config.invoke=()=>new Promise(resolve=>finish=resolve);
  const pending=f.model.load();await new Promise(resolve=>setImmediate(resolve));f.switch('bob');assert.equal(f.model.state,null);
  finish({data:{mode:'live',plan:'pro'},error:null});await assert.rejects(pending,/account changed/);assert.equal(f.model.state,null);
});
test('Signing out removes membership and performs no billing requests',async()=>{
  const f=fixture();await f.model.load();f.switch(null);const before=f.calls.length;
  assert.equal(await f.model.load(),null);assert.equal(f.model.state,null);assert.equal(f.calls.length,before);
  await assert.rejects(f.model.checkout(),/Sign in/);
});
test('Checkout only navigates to the expected Stripe origins',async()=>{
  const f=fixture();await f.model.checkout();assert.equal(f.redirects.length,1);
  for(const url of ['https://evil.invalid/','javascript:alert(1)','https://checkout.stripe.com.evil.invalid/']){
    f.config.url=url;await assert.rejects(f.model.checkout());
  }
  f.config.url='https://checkout.stripe.com/test';await assert.rejects(f.model.manage());
  f.config.url='https://billing.stripe.com/test';await f.model.manage();assert.equal(f.redirects.length,2);
});
test('An account switch during checkout prevents redirecting the new user to old billing',async()=>{
  const f=fixture();let finish;f.config.invoke=()=>new Promise(resolve=>finish=resolve);
  const pending=f.model.checkout();await new Promise(resolve=>setImmediate(resolve));f.switch('bob');
  finish({data:{url:'https://checkout.stripe.com/private-alice'},error:null});await assert.rejects(pending,/account changed/);assert.equal(f.redirects.length,0);
});
test('Repeated loads share one in-flight billing request',async()=>{
  const f=fixture();await Promise.all([f.model.load(),f.model.load()]);assert.equal(f.calls.filter(a=>a==='status').length,1);
});
test('A concurrent webhook update is retried briefly before displaying membership',async()=>{
  const f=fixture();let attempts=0;
  f.config.invoke=async()=>++attempts<3?{error:{context:{status:409}}}:{data:{mode:'live',checkoutEnabled:true}};
  assert.equal((await f.model.load()).plan,'free');assert.equal(attempts,3);
});
