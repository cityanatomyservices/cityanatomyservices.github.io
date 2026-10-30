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
 let remote=options.remote||null, saveFn=options.save, writes=0, loads=0, quota=false;
 const values=new Map(),subscribers=new Set();
 const visit=options.visit||{get:k=>values.get(k)||null,set:(k,v)=>{values.set(k,v);subscribers.forEach(fn=>fn(k));},remove:k=>values.delete(k),subscribe:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);}};
 const w={AustinVisit:visit,PlanModel:M,PlanSources:Sources,addEventListener:(event,fn)=>{events[event]=fn;}};
 const client={auth:{onAuthStateChange:fn=>{events.auth=fn;}}};
 w.AustinSession={client:()=>client,ready:async()=>{if(options.offline)throw new Error('offline');return {user:options.user||{id:owner,is_anonymous:options.anonymous??false}};}};
 w.PlanRepository={
  load:async(_c,_owner,id)=>{loads++;if(options.loadError)throw new Error('offline');if(options.load)await options.load();return remote&&(!id||remote.plan.id===id)?structuredClone(remote):null;},
  save:async(_c,e)=>{writes++;if(saveFn)return saveFn(e);if(remote&&remote.revision!==e.revision)throw {code:'PT409',message:'planner_revision_conflict'};remote={...structuredClone(e),revision:e.revision+1,dirty:false};return {revision:remote.revision};}
 };
 const storage=new Proxy({getItem:k=>memory.get(k)||null,setItem:(k,v)=>{if(quota)throw new Error('quota');memory.set(k,v);},removeItem:k=>memory.delete(k)},{ownKeys:()=>[...memory.keys()],getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
 vm.runInNewContext(code,{window:w,document:{hidden:false,addEventListener:(event,fn)=>{events[event]=fn;}},navigator:{},crypto,structuredClone,localStorage:storage,
  setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();timers.add(t);return t;},clearTimeout,queueMicrotask,console});
 return {store:w.PlanStore,owner,memory,visit,events,get loads(){return loads;},get writes(){return writes;},set quota(v){quota=v;},set remote(v){remote=v;},get remote(){return remote;},set save(fn){saveFn=fn;},dispose:()=>{for(const t of timers)clearTimeout(t);}};
}
test('guest selections stay in visit memory and do not survive refresh',async()=>{
 const a=fixture({anonymous:true});try{
  await a.store.select(place('coffee'),true);await a.store.select(place('coffee'),true);await a.store.sync();
  assert.equal(a.store.plan.items.length,1);assert.equal(a.loads,0);assert.equal(a.writes,0);assert.equal(a.memory.size,0);
  const next=fixture({anonymous:true,memory:a.memory,visit:a.visit});try{await next.store.ready();assert.equal(next.store.plan.items[0].source.title,'coffee');}finally{next.dispose();}
  const refreshed=fixture({anonymous:true,memory:a.memory});try{await refreshed.store.ready();assert.equal(refreshed.store.plan.items.length,0);}finally{refreshed.dispose();}
 }finally{a.dispose();}
});
test('guest recovery keeps the current visit date and schedule when first signing in',async()=>{
 const options={offline:true},a=fixture(options);try{
  await a.store.chooseDay('2026-12-25');await a.store.select(place('coffee'),true);
  options.offline=false;await a.store.retry();assert.equal(a.store.plan.date,'2026-12-25');assert.equal(a.store.plan.dayStart,'05:00');assert.equal(a.store.plan.items.length,1);await a.store.sync();assert.equal(a.remote.plan.items.length,1);
 }finally{a.dispose();}
});
test('guest mode rejects legacy browser and remote plans and an unclassified identity',async()=>{
 const plan=M.empty(uuid());plan.items=[Sources.item(place('old private stop'),uuid())];
 const owner=uuid(),old={plan,revision:1,dirty:false,stamp:''};
 const memory=new Map([['austin:planner:v1:'+owner,JSON.stringify(old)],['austin:planner:v1:last-owner',owner]]);
 const f=fixture({owner,user:{id:owner},memory,remote:old});try{
  await f.store.ready();assert.equal(f.store.plan.items.length,0);assert.equal(f.loads,0);assert.equal(memory.size,0);assert.equal(f.store.temporary,true);
 }finally{f.dispose();}
});
test('registered account plans still persist across a new visit',async()=>{
 const a=fixture();try{
  await a.store.select(place('saved'),true);await a.store.sync();
  const b=fixture({owner:a.owner,memory:a.memory,remote:a.remote});try{await b.store.ready();assert.equal(b.store.plan.items[0].source.title,'saved');assert.equal(b.store.temporary,false);}finally{b.dispose();}
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
  const newer=structuredClone(f.remote);newer.revision=2;newer.plan.daySettings[newer.plan.date].name='Other tab';f.remote=newer;
  await f.store.edit(p=>{p.name='My unsynced edit';});await f.store.sync();
  assert.equal(f.store.conflict,true);assert.equal(f.store.plan.name,'My unsynced edit');
  await f.store.resolve(false);assert.equal(f.store.plan.name,'Other tab');assert.equal(f.store.conflict,false);
 }finally{f.dispose();}
});
test('multiple days keep independent selections, durations, buffers and names',async()=>{
 const f=fixture({offline:true});try{
  await f.store.chooseDay('2026-10-31');await f.store.select(place('Cafe'),true);
  await f.store.edit(p=>{p.name='Saturday';p.bufferMinutes=35;p.items[0].schedule.duration=30;});
  const first=f.store.plan.items[0].id;
  await f.store.chooseDay('2026-11-01');assert.equal(f.store.plan.items.length,0);
  await f.store.select(place('Cafe'),true);await f.store.edit(p=>{p.items[0].schedule.duration=90;});
  assert.notEqual(f.store.plan.items[0].id,first);assert.equal(f.store.plan.bufferMinutes,20);
  await f.store.chooseDay('2026-10-31');assert.equal(f.store.plan.name,'Saturday');assert.equal(f.store.plan.bufferMinutes,35);assert.equal(f.store.plan.items[0].schedule.duration,30);
  await f.store.select(place('Cafe'),false);assert.equal(f.store.plan.items.length,0);
  await f.store.chooseDay('2026-11-01');assert.equal(f.store.plan.items.length,1);assert.equal(f.store.plan.items[0].schedule.duration,90);
  assert.equal(M.valid(f.store.book),true);
 }finally{f.dispose();}
});
test('dated event selection creates its published day rather than moving the event',async()=>{
 const f=fixture({offline:true});try{
  await f.store.chooseDay('2026-11-10');await f.store.select(place('Cafe'),true);
  const show={...place('Concert'),kind:'event',timing:'fixed',start:'2026-11-01T01:00:00-05:00'};
  assert.equal(await f.store.select(show,true),'2026-10-31');assert.equal(f.store.plan.date,'2026-10-31');assert.equal(f.store.plan.items[0].schedule.start,show.start);
  await f.store.chooseDay('2026-11-10');assert.equal(f.store.plan.items[0].source.title,'Cafe');
 }finally{f.dispose();}
});
test('a stale editor cannot edit another selected day or change a stop date',async()=>{
 const f=fixture({offline:true});try{
  await f.store.chooseDay('2026-10-31');await f.store.select(place('Cafe'),true);
  await f.store.chooseDay('2026-11-01');
  await assert.rejects(f.store.edit(p=>{p.name='Wrong day';},'2026-10-31'),/selected day changed/);
  await assert.rejects(f.store.edit(p=>{p.date='2026-11-02';}),/day selector/);
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
  assert.equal(f.store.plan.items.length,0);assert.match(f.store.status,/Temporary plan/);
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
  assert.match(f.store.status,/Temporary plan/);
 }finally{f.dispose();}
});
test('signing in combines guest days with saved account days and keeps the day being planned',async()=>{
 const options={anonymous:true},f=fixture(options);try{
  await f.store.chooseDay('2026-12-25');await f.store.select(place('guest stop'),true);
  const account=M.empty(uuid());M.ensureDay(account,'2026-12-24');account.items=[{...Sources.item(place('saved stop'),uuid()),day:account.date}];
  f.remote={plan:account,revision:1,dirty:false};options.user={id:uuid(),is_anonymous:false};f.events.auth('SIGNED_IN',{user:options.user});
  await new Promise(resolve=>setImmediate(resolve));await f.store.ready();await f.store.sync();
  assert.equal(f.store.temporary,false);assert.equal(f.store.plan.date,'2026-12-25');assert.equal(f.remote.plan.items.length,2);assert.equal(f.store.unsaved,false);
 }finally{f.dispose();}
});
test('a failed account load keeps the guest plan through refresh and combines it before saving',async()=>{
 const options={anonymous:true},f=fixture(options);try{
  await f.store.select(place('guest stop'),true);options.user={id:uuid(),is_anonymous:false};options.loadError=true;
  f.events.auth('SIGNED_IN',{user:options.user});await new Promise(resolve=>setImmediate(resolve));await f.store.ready();await f.store.sync();
  assert.equal(f.store.plan.items.length,1);assert.equal(f.writes,0);assert.match(f.store.status,/retry to combine/);
  const account=M.empty(uuid());account.items=[{...Sources.item(place('saved stop'),uuid()),day:account.date}];
  const reopened=fixture({owner:options.user.id,memory:f.memory,remote:{plan:account,revision:1,dirty:false}});try{
   await reopened.store.ready();await reopened.store.sync();assert.equal(reopened.remote.plan.items.length,2);assert.equal(reopened.remote.revision,2);
  }finally{reopened.dispose();}
 }finally{f.dispose();}
});
test('account login preserves a different tab’s guest merge completed during the cloud load',async()=>{
 const options={anonymous:true},f=fixture(options),started=deferred(),resume=deferred();try{
  await f.store.select(place('this tab'),true);options.user={id:uuid(),is_anonymous:false};options.load=async()=>{started.resolve();await resume.promise;};
  f.events.auth('SIGNED_IN',{user:options.user});await started.promise;
  const other=M.empty(uuid());other.items=[{...Sources.item(place('other tab'),uuid()),day:other.date}];
  f.memory.set('austin:planner:v1:'+options.user.id,JSON.stringify({plan:other,revision:0,dirty:true,stamp:uuid()}));
  resume.resolve();await f.store.ready();await f.store.sync();assert.equal(f.remote.plan.items.length,2);
 }finally{f.dispose();}
});
