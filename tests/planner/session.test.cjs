const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../../shared/session.js'),'utf8');
const key='sb-aqbyxpiwugcvoephsvpm-auth-token';
function fixture({local=new Map(),visit}={}) {
 const values=new Map();visit||={id:crypto.randomUUID(),get:k=>values.get(k)||null,set:(k,v)=>values.set(k,v),remove:k=>values.delete(k)};
 let signups=0;
 const storage=new Proxy({getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)}, {ownKeys:()=>[...local.keys()],getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
 const window={AustinVisit:visit,addEventListener(){},supabase:{createClient(_url,_key,{auth}){
  const callbacks=[];
  return {auth:{
   onAuthStateChange(fn){callbacks.push(fn);},stopAutoRefresh(){},
   async getSession(){return {data:{session:JSON.parse(auth.storage.getItem(auth.storageKey))}};},
   async signInAnonymously(){signups++;const session={user:{id:crypto.randomUUID(),is_anonymous:true},access_token:'test-only',refresh_token:'test-only'};auth.storage.setItem(auth.storageKey,JSON.stringify(session));callbacks.forEach(fn=>fn('SIGNED_IN',session));return {data:{session}};}
  }};
 }}};
 vm.runInNewContext(code,{window,localStorage:storage,navigator:{},crypto,console});
 return {api:window.AustinSession,local,visit,get signups(){return signups;}};
}
test('anonymous credentials stay in memory across map switches and reset on refresh',async()=>{
 const a=fixture(),first=await a.api.ready();assert.equal(a.signups,1);assert.equal(a.local.size,0);
 const otherMap=fixture({local:a.local,visit:a.visit});assert.equal((await otherMap.api.ready()).user.id,first.user.id);assert.equal(otherMap.signups,0);
 const refreshed=fixture({local:a.local});assert.notEqual((await refreshed.api.ready()).user.id,first.user.id);assert.equal(refreshed.local.size,0);
});
test('legacy guest tokens, names, visibility and plans are removed; display settings remain',async()=>{
 const local=new Map([[key,JSON.stringify({user:{id:'old-guest',is_anonymous:true}})],['austinchat:identity','old name'],['austinchat:visible','on'],['austin:planner:v1:old-guest','old itinerary'],['theme','dark'],['austin-explore-v1','display filters']]);
 const f=fixture({local});await f.api.ready();assert.deepEqual([...local.keys()].sort(),['austin-explore-v1','theme']);assert.equal(f.api.registered,false);
});
test('registered sessions still survive a new page visit without creating a guest',async()=>{
 const session={user:{id:'registered-user',is_anonymous:false},access_token:'test-only',refresh_token:'test-only'};
 const local=new Map([[key,JSON.stringify(session)],['austin:planner:v1:registered-user','saved itinerary']]);
 const a=fixture({local}),b=fixture({local});
 assert.equal((await a.api.ready()).user.id,'registered-user');assert.equal((await b.api.ready()).user.id,'registered-user');assert.equal(a.signups+b.signups,0);assert.equal(b.api.registered,true);assert.ok(local.has('austin:planner:v1:registered-user'));
});
