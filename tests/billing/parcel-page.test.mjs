import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {handler} from '../../supabase/functions/parcel-page/handler.mjs';
const request = (action, signed = false) => new Request('https://example.test/', {
  method:'POST',headers:signed ? {Authorization:'Bearer fixture'} : {}, body:JSON.stringify({action})
});
test('Parcel testing opens for a guest and rejects all payment actions',async()=>{
  const handle=handler({accessMode:'testing',bundle:()=> 'parcel code'});
  const response=await handle(request('open'));
  assert.equal((await response.json()).script,'parcel code');
  assert.match(response.headers.get('Cache-Control'),/no-store/);
  for(const action of ['checkout','manage'])assert.equal((await handle(request(action,true))).status,409);
});
test('Only an entitled account receives the parcel workspace after launch',async()=>{
  let plan='free';const api={ready:()=>true,allowed:()=>true,user:async()=>({id:'alice'}),service:{status:async()=>({plan,hasBilling:true})}};
  const handle=handler({accessMode:'paid',api,bundle:()=> 'private'});
  assert.deepEqual(await (await handle(request('open'))).json(),{access:'sign-in'});
  assert.deepEqual(await (await handle(request('open',true))).json(),{access:'subscribe',hasBilling:true});
  plan='pro';assert.equal((await (await handle(request('open',true))).json()).script,'private');
  assert.equal((await handler({api,accessMode:'unconfigured'})(request('open'))).status,503);
});

test('Existing parcel customers can manage billing without starting checkout',async()=>{
  const elements=new Map(),actions=[];
  const element=id=>{
    if(!elements.has(id))elements.set(id,{hidden:true});
    return elements.get(id);
  };
  const user={id:'alice',is_anonymous:false};
  const window={top:{location:{}},PARCELS_CONFIG:{supabase:{url:'https://example.test'}},
    AustinSession:{user,peek:async()=>({user,access_token:'fixture'}),subscribe(){}}};
  const fetch=async (_url,{headers,body})=>{
    const {action}=JSON.parse(body);actions.push(action);
    const data=action==='manage'?{url:'https://billing.stripe.com/session'}:
      action==='checkout'?{url:'https://checkout.stripe.com/session'}:
      headers.Authorization?{access:'subscribe',hasBilling:true}:{access:'sign-in'};
    return {ok:true,json:async()=>data};
  };
  const script=readFileSync(new URL('../../what-can-i-build-here/access.js',import.meta.url),'utf8');
  runInNewContext(script,{window,document:{getElementById:element},fetch,AbortSignal,URL});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(actions,['open','open']);
  assert.equal(element('access-manage').hidden,false);
  assert.equal(element('access-action').textContent,'Subscribe for $10/month');
  await element('access-manage').onclick();
  assert.deepEqual(actions,['open','open','manage']);
  assert.equal(window.top.location.href,'https://billing.stripe.com/session');
  await element('access-action').onclick();
  assert.equal(actions.at(-1),'checkout');
});
