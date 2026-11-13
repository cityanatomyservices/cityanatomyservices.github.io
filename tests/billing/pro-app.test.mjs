import test from 'node:test';
import assert from 'node:assert/strict';
import {handler} from '../../supabase/functions/pro-app/handler.mjs';
import {runtime} from '../../supabase/functions/pro-app/runtime.mjs';
const req=(path='/apps/1885/app.html',extra={})=>new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json',...extra},body:JSON.stringify({path})});
test('Private asset delivery checks membership before reading any file',async()=>{
  let reads=0;const api={authorize:async()=>{throw Object.assign(new Error('Pro required'),{publicMessage:'Pro required',status:403});},asset:async()=>{reads++;}};
  assert.equal((await handler(api)(req())).status,403);assert.equal(reads,0);
});
test('Paid requests receive private bytes with explicit MIME and no shared caching',async()=>{
  const handle=handler({authorize:async()=>{},asset:async()=>({body:'<html>private</html>',mime:'text/html; charset=utf-8'})});
  const result=await handle(req());assert.equal(result.status,200);assert.equal(await result.text(),'<html>private</html>');
  assert.equal(result.headers.get('X-App-Content-Type'),'text/html; charset=utf-8');assert.equal(result.headers.get('Cache-Control'),'private, no-store');
});
test('Traversal, unrecognized fields and foreign origins are rejected',async()=>{
  let calls=0;const handle=handler({authorize:async()=>{calls++;}});
  for(const path of ['/../secrets','/apps/%2e%2e/private','https://evil.invalid','/apps/a?token=x'])assert.equal((await handle(req(path))).status,400);
  assert.equal((await handle(req('/apps/x',{Origin:'https://evil.invalid'}))).status,403);assert.equal(calls,0);
});
test('Unknown files are not fetched from storage',async()=>{
  const handle=handler({authorize:async()=>{},asset:async()=>null});assert.equal((await handle(req())).status,404);
});
test('Runtime uses the caller token and live membership RPC, never a browser account ID',async()=>{
  const env={SUPABASE_URL:'https://backend.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-fixture',PRO_APPS_RELEASE:'a'.repeat(64)};
  const api=runtime(k=>env[k],async(url,options)=>{
    assert.equal(url,'https://backend.invalid/rest/v1/rpc/membership_read');assert.equal(options.headers.Authorization,'Bearer fixture');assert.equal(options.body,'{}');
    return Response.json({plan:'pro',paidThrough:new Date(Date.now()+3600000).toISOString()});
  });await api.authorize(req());
});
test('Free, expired and invalid-token requests never gain private access',async()=>{
  const env={SUPABASE_URL:'https://backend.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-fixture'};
  for(const result of [Response.json({plan:'free'}),Response.json({plan:'pro',paidThrough:'2000-01-01'}),Response.json({error:'bad token'},{status:401})]){
    await assert.rejects(runtime(k=>env[k],async()=>result).authorize(req()));
  }
  await assert.rejects(runtime(k=>env[k]).authorize(new Request('https://edge.invalid')),{status:401});
});
test('Temporary Pro grants allow files only while the authoritative RPC returns access',async()=>{
  const env={SUPABASE_URL:'https://backend.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-fixture'};
  let temporaryAccess=true;
  const api=runtime(k=>env[k],async()=>Response.json({plan:temporaryAccess?'pro':'free',paidThrough:null,temporaryAccess}));
  await api.authorize(req());temporaryAccess=false;
  await assert.rejects(api.authorize(req()),{status:403});
});
test('Storage reads are restricted to the immutable manifest and current release',async()=>{
  const release='a'.repeat(64),calls=[];
  const env={SUPABASE_URL:'https://backend.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-fixture',PRO_APPS_RELEASE:release};
  const api=runtime(k=>env[k],async(url,options)=>{
    calls.push(url);assert.equal(options.headers.Authorization,'Bearer server-fixture');
    if(url.endsWith('/manifest.json'))return Response.json({release,files:{'/apps/x/data.json':{mime:'application/json'}}});
    return new Response('{"private":true}');
  });
  assert.equal(await api.asset('/unlisted.json'),null);assert.equal(calls.length,1);
  const asset=await api.asset('/apps/x/data.json');assert.equal(asset.mime,'application/json');assert.equal(calls.length,2);
  assert.match(calls[1],/\/pro-apps\/a{64}\/apps\/x\/data\.json$/);
});
