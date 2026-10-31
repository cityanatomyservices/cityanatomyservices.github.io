const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../../shared/session.js'),'utf8');
const key='sb-aqbyxpiwugcvoephsvpm-auth-token';
function fixture({local=new Map(),visit,parent}={}) {
 const values=new Map();visit||={id:crypto.randomUUID(),get:k=>values.get(k)||null,set:(k,v)=>values.set(k,v),remove:k=>values.delete(k)};
 let signups=0,authOptions,callbacks=[];const events={};
 const storage=new Proxy({getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)}, {ownKeys:()=>[...local.keys()],getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
 const window={AustinVisit:visit,parent,addEventListener:(event,fn)=>{events[event]=fn;},supabase:{createClient(_url,_key,{auth}){
  authOptions=auth;
  return {auth:{
   onAuthStateChange(fn){callbacks.push(fn);return {data:{subscription:{unsubscribe(){}}}};},stopAutoRefresh(){},
   async getSession(){return {data:{session:JSON.parse(auth.storage.getItem(auth.storageKey))}};},
   async setSession(){const session=JSON.parse(local.get(key));auth.storage.setItem(auth.storageKey,JSON.stringify(session));callbacks.forEach(fn=>fn('SIGNED_IN',session));return {data:{session}};},
   async signOut(){auth.storage.removeItem(auth.storageKey);callbacks.forEach(fn=>fn('SIGNED_OUT',null));return {error:null};},
   async signInAnonymously(){signups++;const session={user:{id:crypto.randomUUID(),is_anonymous:true},access_token:'test-only',refresh_token:'test-only'};auth.storage.setItem(auth.storageKey,JSON.stringify(session));callbacks.forEach(fn=>fn('SIGNED_IN',session));return {data:{session}};}
  }};
 }}};
 vm.runInNewContext(code,{window,localStorage:storage,navigator:{},crypto,console,queueMicrotask});
 return {api:window.AustinSession,local,visit,window,events,get authOptions(){return authOptions;},get signups(){return signups;},
  signIn(session){authOptions.storage.setItem(authOptions.storageKey,JSON.stringify(session));callbacks.forEach(fn=>fn('SIGNED_IN',session));}};
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
test('frames reuse their parent client without adding another authentication lifetime',async()=>{
 const parent=fixture();await parent.api.ready();const frame=fixture({local:parent.local,visit:parent.visit,parent:parent.window});
 assert.equal(frame.api,parent.api);assert.equal(frame.authOptions,undefined);
});
test('explicit sign-in persists only a member session; sign-out clears private browser state',async()=>{
 const f=fixture();await f.api.ready();f.visit.set('planner:guest','temporary stops');f.visit.set('chat:identity','nickname');f.visit.set('explore:guest','temporary layers');
 const member={user:{id:'member',is_anonymous:false,email:'test@example.invalid'},access_token:'member-access',refresh_token:'member-refresh',provider_token:'unused-google-access'};
 f.signIn(member);assert.equal(f.api.registered,true);assert.equal(JSON.parse(f.local.get(key)).provider_token,undefined);
 f.local.set('austin:planner:v1:member','private stops');f.local.set('theme','dark');
 await f.api.signOut();assert.equal(f.local.has(key),false);assert.equal(f.visit.get('planner:guest'),null);assert.equal(f.visit.get('chat:identity'),null);
 assert.equal(f.local.has('austin:planner:v1:member'),false);assert.equal(f.local.get('theme'),'dark');
 assert.equal(f.visit.get('explore:guest'),null);
 assert.equal((await f.api.ready()).user.is_anonymous,true);assert.equal(f.local.has(key),false);
 assert.equal(f.authOptions.flowType,'pkce');assert.equal(f.authOptions.detectSessionInUrl,false);
});
test('registered sessions follow storage changes across visits without reviving signed-out credentials',async()=>{
 const a=fixture(),b=fixture({local:a.local});await a.api.ready();await b.api.ready();
 assert.notEqual(a.authOptions.storageKey,b.authOptions.storageKey);
 a.signIn({user:{id:'member',is_anonymous:false},access_token:'member-access',refresh_token:'member-refresh'});
 b.events.storage({key});await new Promise(resolve=>setImmediate(resolve));assert.equal(b.api.registered,true);
 await a.api.signOut();b.events.storage({key});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(b.api.registered,false);assert.equal(await b.api.peek(),null);assert.equal(a.local.has(key),false);
});
test('a late refresh from an old tab cannot undo logout or replace another account',async()=>{
 const f=fixture();await f.api.ready();const first={user:{id:'first',is_anonymous:false},access_token:'first-access',refresh_token:'first-refresh'};
 f.signIn(first);f.local.delete(key);
 f.authOptions.storage.setItem(f.authOptions.storageKey,JSON.stringify({...first,access_token:'late-refresh'}));assert.equal(f.local.has(key),false);
 f.local.set(key,JSON.stringify({user:{id:'second',is_anonymous:false},access_token:'second-access',refresh_token:'second-refresh'}));
 f.authOptions.storage.setItem(f.authOptions.storageKey,JSON.stringify({...first,access_token:'late-refresh'}));assert.equal(JSON.parse(f.local.get(key)).user.id,'second');
 f.authOptions.storage.removeItem(f.authOptions.storageKey);assert.equal(JSON.parse(f.local.get(key)).user.id,'second');
});
