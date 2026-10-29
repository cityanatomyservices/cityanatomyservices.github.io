const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
const M = require('../../planner/model.js'), Sources = require('../../planner/sources.js');
const code=fs.readFileSync(require.resolve('../../planner/store.js'),'utf8');
const uuid=()=>crypto.randomUUID();
const place=n=>({key:n,title:n,kind:'place',timing:'unknown',coordinates:[-97.7,30.2]});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(options={}) {
 const owner=options.owner||uuid(), memory=options.memory||new Map(), timers=new Set(), events={};
 let remote=options.remote||null, saveFn=options.save, writes=0, quota=false;
 const w={PlanModel:M,PlanSources:Sources,addEventListener:(event,fn)=>{events[event]=fn;}};
 const client={auth:{onAuthStateChange:fn=>{events.auth=fn;}}};
 w.AustinSession={client:()=>client,ready:async()=>{if(options.offline)throw new Error('offline');return {user:{id:owner}};}};
 w.PlanRepository={
  load:async(_c,_owner,id)=>remote&&(!id||remote.plan.id===id)?structuredClone(remote):null,
  save:async(_c,e)=>{writes++;if(saveFn)return saveFn(e);if(remote&&remote.revision!==e.revision)throw {code:'PT409',message:'planner_revision_conflict'};remote={...structuredClone(e),revision:e.revision+1,dirty:false};return {revision:remote.revision};}
 };
 const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>{if(quota)throw new Error('quota');memory.set(k,v);},removeItem:k=>memory.delete(k)};
 vm.runInNewContext(code,{window:w,document:{hidden:false,addEventListener:(event,fn)=>{events[event]=fn;}},navigator:{},crypto,structuredClone,localStorage:storage,
  setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();timers.add(t);return t;},clearTimeout,console});
 return {store:w.PlanStore,owner,memory,events,get writes(){return writes;},set quota(v){quota=v;},set remote(v){remote=v;},get remote(){return remote;},set save(fn){saveFn=fn;},dispose:()=>{for(const t of timers)clearTimeout(t);}};
}
test('offline selections persist, deduplicate and restore without requiring chat',async()=>{
 const a=fixture({offline:true});try{
  await a.store.select(place('coffee'),true);await a.store.select(place('coffee'),true);
  assert.equal(a.store.plan.items.length,1);
  const b=fixture({offline:true,memory:a.memory});try{await b.store.ready();assert.equal(b.store.plan.items[0].source.title,'coffee');}finally{b.dispose();}
 }finally{a.dispose();}
});
test('guest recovery keeps the date and schedule when first signing in',async()=>{
 const a=fixture({offline:true});try{
  await a.store.select(place('coffee'),true);await a.store.edit(p=>{p.date='2026-12-25';p.dayStart='11:00';});
  const b=fixture({memory:a.memory});try{await b.store.ready();assert.equal(b.store.plan.date,'2026-12-25');assert.equal(b.store.plan.dayStart,'11:00');assert.equal(b.store.plan.items.length,1);await b.store.sync();assert.equal(b.remote.plan.items.length,1);}finally{b.dispose();}
 }finally{a.dispose();}
});
test('edits during an in-flight save survive and use the returned revision',async()=>{
 const pending=deferred(),began=deferred(),f=fixture();try{
  await f.store.select(place('first'),true);
  f.save=async()=>{began.resolve();await pending.promise;return {revision:1};};
  const saving=f.store.sync();await began.promise;
  await f.store.select(place('second'),true);pending.resolve();await saving;
  assert.equal(f.store.plan.items.length,2);
  f.save=async e=>{assert.equal(e.revision,1);assert.equal(e.plan.items.length,2);return {revision:2};};
  await f.store.sync();assert.match(f.store.status,/Saved privately/);
 }finally{f.dispose();}
});
test('a stale save preserves local edits until the user chooses a copy',async()=>{
 const f=fixture();try{
  await f.store.select(place('local'),true);await f.store.sync();
  f.remote={...f.remote,revision:2,plan:{...f.remote.plan,name:'Other tab'}};
  await f.store.edit(p=>{p.name='My unsynced edit';});await f.store.sync();
  assert.equal(f.store.conflict,true);assert.equal(f.store.plan.name,'My unsynced edit');
  await f.store.resolve(false);assert.equal(f.store.plan.name,'Other tab');assert.equal(f.store.conflict,false);
 }finally{f.dispose();}
});
test('saving this copy resolves an explicit conflict without deleting its selections',async()=>{
 const f=fixture();try{
  await f.store.select(place('local'),true);await f.store.sync();f.remote={...f.remote,revision:2};
  await f.store.select(place('new'),true);await f.store.sync();assert.equal(f.store.conflict,true);
  await f.store.resolve(true);await f.store.sync();assert.equal(f.remote.plan.items.length,2);assert.equal(f.remote.revision,3);
 }finally{f.dispose();}
});
test('storage quota failure does not replace new in-memory edits with an older cache',async()=>{
 const f=fixture();try{
  await f.store.select(place('first'),true);await f.store.sync();f.quota=true;
  await f.store.select(place('second'),true);await f.store.select(place('third'),true);await f.store.sync();
  assert.equal(f.remote.plan.items.length,3);assert.equal(f.store.plan.items.length,3);assert.match(f.store.status,/storage is unavailable/);
 }finally{f.dispose();}
});
test('sign-out separates planner state from the next account',async()=>{
 const f=fixture();try{
  await f.store.select(place('private'),true);f.events.auth('SIGNED_OUT',null);
  assert.equal(f.store.plan.items.length,0);assert.match(f.store.status,/Account changed/);
 }finally{f.dispose();}
});
test('a memory-only guest plan survives first login after connectivity returns',async()=>{
 const options={offline:true},f=fixture(options);try{
  f.quota=true;await f.store.select(place('memory-only'),true);
  options.offline=false;await f.store.retry();await f.store.sync();
  assert.equal(f.remote.plan.items[0].source.title,'memory-only');
 }finally{f.dispose();}
});
test('completion of an old account upload cannot replace signed-out state',async()=>{
 const pending=deferred(),began=deferred(),f=fixture();try{
  await f.store.select(place('private'),true);
  f.save=async()=>{began.resolve();await pending.promise;return {revision:1};};
  const saving=f.store.sync();await began.promise;f.events.auth('SIGNED_OUT',null);
  pending.resolve();await saving;assert.equal(f.store.plan.items.length,0);
  assert.match(f.store.status,/Account changed/);
 }finally{f.dispose();}
});
