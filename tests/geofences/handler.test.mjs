import {test} from 'node:test';import assert from 'node:assert/strict';import {handler} from '../../supabase/functions/geofences/handler.mjs';
const id='68d071c2-ac2d-449b-ac02-0caf2e17efcd';
function fixture(){const calls=[],api={mode:'live',enabled:true,user:async()=>({id:'owner'}),rpc:async(n,b)=>{calls.push({n,b});return [];},service:{checkout:async(u,i)=>({url:'checkout:'+i})},fetcher:async()=>new Response(JSON.stringify({result:{addressMatches:[{matchedAddress:'CITY HALL',coordinates:{x:-97.74,y:30.26}}]}}))};return {calls,api,send:body=>handler(api)(new Request('https://example.test',{method:'POST',headers:{Origin:'https://austin.chat'},body:JSON.stringify(body)}))};}
test('owner identity and fixed price cannot be supplied by browser',async()=>{const f=fixture();for(const extra of [{price:'free'},{owner:'victim'},{success_url:'https://bad.test'}])assert.equal((await f.send({action:'checkout',id,...extra})).status,400);await f.send({action:'list'});assert.deepEqual(f.calls.find(c=>c.n==='geofence_owner_list').b,{p_owner:'owner',p_mode:'live'});});
test('invalid location cannot reach storage; geocoding accepts only submitted addresses',async()=>{const f=fixture();assert.equal((await f.send({action:'save',id,fields:{name:'x',latitude:0,longitude:0,diameter:101}})).status,422);assert.equal(f.calls.length,0);const r=await f.send({action:'geocode',address:'301 W 2nd St Austin TX'});assert.equal(r.status,200);assert.equal((await r.json()).matches[0].latitude,30.26);assert.equal(f.calls[0].n,'geofence_geocode_limit');});
test('anonymous and unconfirmed users cannot start billing',async()=>{const f=fixture();f.api.user=async()=>{throw {status:403,publicMessage:'Sign in'};};assert.equal((await f.send({action:'checkout',id})).status,403);assert.equal(f.calls.length,0);});
test('origin, method and malformed bodies are rejected',async()=>{const {api}=fixture(),h=handler(api);assert.equal((await h(new Request('https://x',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}))).status,403);assert.equal((await h(new Request('https://x'))).status,405);assert.equal((await h(new Request('https://x',{method:'POST',body:'['}))).status,400);});

test('Free geofence activation uses authenticated ownership without Stripe',async()=>{
 const f=fixture();f.api.enabled=false;f.api.service=null;
 f.api.rpc=async(n,b)=>{f.calls.push({n,b});return n==='access_testing_status'?{geofencesEnabled:true}:n==='access_testing_grant'?{activated:true,temporaryAccess:true}:[];};
 const list=await(await f.send({action:'list'})).json();assert.equal(list.freeTesting,true);assert.equal(list.checkoutEnabled,true);
 const r=await f.send({action:'checkout',id});assert.equal(r.status,200);assert.equal((await r.json()).activated,true);
 assert.deepEqual(f.calls.find(c=>c.n==='access_testing_grant').b,{p_kind:'geofence',p_owner:'owner',p_id:id});
 f.api.mode='test';assert.equal((await f.send({action:'checkout',id})).status,503);
});
test('Settings lookup errors fail closed instead of creating a charge',async()=>{
 const f=fixture();let checkout=false;f.api.rpc=async()=>{throw Error('Offline');};f.api.service.checkout=async()=>{checkout=true;};
 assert.equal((await f.send({action:'checkout',id})).status,503);assert.equal(checkout,false);
});
