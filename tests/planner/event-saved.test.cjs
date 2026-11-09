const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../special-events/saved-store.js'),'utf8');
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
  let id='A',loadGate,writeGate,expired=false,fail=false;const listeners=new Set(),contextListeners=new Set(),records=new Map(),calls=[];
  const db=(owner,stop)=>records.get(owner+':'+stop)||{stop_id:stop,note:'',favorite:false};
  const client={rpc:async(name,args)=>{calls.push({name,args});
    if(name==='special_event_stops_load'){const data=[...records.entries()].filter(([k])=>k.startsWith(args.p_owner+':')).map(([,v])=>structuredClone(v));const gate=loadGate;loadGate=null;if(gate)await gate.promise;return {data};}
    const gate=writeGate;writeGate=null;if(gate)await gate.promise;
    if(args.p_owner!==id)return {error:{code:'PT401'}};
    if(fail){fail=false;return {error:{code:'NETWORK'}};}
    const value=db(args.p_owner,args.p_stop);if(value[args.p_field]!==args.p_expected)return {error:{code:'PT409'}};
    const next={...value,[args.p_field]:args.p_value};records.set(args.p_owner+':'+args.p_stop,next);return {data:next};
  }};
  const session={get registered(){return !!id;},get user(){return {id};},peek:async()=>{},client:()=>client,subscribe:fn=>listeners.add(fn)};
  const context={id:'tour',ready:Promise.resolve(),assert(){if(expired)throw Error('Expired');},subscribe:fn=>contextListeners.add(fn)};
  const window={AustinSession:session,PlanContext:context,addEventListener(){}};
  new Function('window','BroadcastChannel',source)(window,undefined);
  return {store:window.SpecialEventSavedStore,calls,records,change(next){id=next;listeners.forEach(fn=>fn());},blockLoad(){loadGate=defer();return loadGate;},blockWrite(){writeGate=defer();return writeGate;},fail(){fail=true;},expire(){expired=true;contextListeners.forEach(fn=>fn());}};
}
test('event notes and Favorites are independent and detached from returned snapshots',async()=>{
  const h=harness(),s=h.store;await s.ready();await s.set('one','note','Private','');await s.set('one','favorite',true,false);assert.equal(s.row('one').note,'Private');
  const row=s.row('one');row.note='Tampered';assert.equal(s.row('one').note,'Private');await s.set('one','favorite',false,true);assert.equal(s.row('one').note,'Private');
  assert.ok(h.calls.every(c=>c.args.p_event==='tour'&&c.args.p_owner==='A'));
});
test('stale edits and failed saves preserve the last confirmed note',async()=>{
  const h=harness(),s=h.store;await s.ready();await s.set('one','note','First','');
  await assert.rejects(s.set('one','note','Stale',''),{code:'PT409'});assert.equal(s.row('one').note,'First');
  h.fail();await assert.rejects(s.set('one','note','Second','First'),/Could not save/);assert.equal(s.row('one').note,'First');
  await s.set('one','note','Second','First');await s.reload();assert.equal(s.row('one').note,'Second');
});
test('sign-out clears notes and guests cannot save',async()=>{
  const h=harness(),s=h.store;await s.ready();await s.set('one','note','Private','');h.change(null);assert.equal(s.row('one').note,'');
  await assert.rejects(s.set('one','favorite',true,false),/Sign In/);
});
test('a pending edit is bound to its initiating owner through an account switch',async()=>{
  const h=harness(),s=h.store;await s.ready();const gate=h.blockWrite(),saving=s.set('one','note','Account A only','');await tick();h.change('B');await s.ready();gate.resolve();
  await assert.rejects(saving,/account changed/);assert.equal(s.row('one').note,'');assert.equal(h.records.has('B:one'),false);
});
test('late account loads and superseded reloads cannot restore private stale data',async()=>{
  const h=harness(),s=h.store;await s.ready();await s.set('one','note','A secret','');
  let gate=h.blockLoad(),loading=s.reload();await tick();h.change('B');await s.ready();gate.resolve();await assert.rejects(loading,/account changed/);assert.equal(s.row('one').note,'');
  gate=h.blockLoad();loading=s.reload();await tick();h.records.set('B:one',{stop_id:'one',note:'Newest',favorite:true});await s.reload();gate.resolve();await loading;assert.equal(s.row('one').note,'Newest');
});
test('retirement clears private memory and blocks further writes',async()=>{
  const h=harness(),s=h.store;await s.ready();await s.set('one','note','Temporary','');h.expire();assert.equal(s.row('one').note,'');await assert.rejects(s.set('one','note','Late','Temporary'),/Expired/);
});
