import test from 'node:test';
import assert from 'node:assert/strict';
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
