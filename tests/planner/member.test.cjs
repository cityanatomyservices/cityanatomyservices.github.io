const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../shared/member.js'),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function harness(){
  const callbacks=new Set(),values=new Map();let id='A',blockedSave=null,blockedLoad=null;
  const snapshot=owner=>({profile:{handle:'Name'+owner,emoji:'🙂',avatar_path:null,show_avatar:false},favorites:[{key:owner,title:owner}],preferences:{},progress:[]});
  const client={rpc:async name=>{const owner=id;if(blockedLoad){const wait=blockedLoad;blockedLoad=null;await wait.promise;}return {data:snapshot(owner)};},from:()=>({upsert:async()=>{if(blockedSave)await blockedSave.promise;return {error:null};},delete:()=>{throw new Error('Not used');}})};
  const session={get registered(){return id!==null;},get user(){return id?{id,is_anonymous:false}:null;},peek:async()=>{},client:()=>client,subscribe:fn=>callbacks.add(fn)};
  const window={AustinSession:session,AustinVisit:{get:k=>values.get(k)||null,set:(k,v)=>values.set(k,v),track:p=>{p.catch(()=>{});return p;}},addEventListener(){}};window.parent=window;
  new Function('window','BroadcastChannel',source)(window,undefined);
  return {M:window.AustinMember,session,change(next){id=next;callbacks.forEach(fn=>fn());},blockSave(){blockedSave=deferred();return blockedSave;},blockLoad(){blockedLoad=deferred();return blockedLoad;}};
}
test('sign-out clears private account data before pending writes finish',async()=>{
  const h=harness();await h.M.ready();const gate=h.blockSave();
  const writing=h.M.favorite({key:'new',title:'Saved privately'},true);await new Promise(resolve=>setImmediate(resolve));
  h.change(null);assert.equal(h.M.state,null);assert.equal(h.M.has('A'),false);gate.resolve();
  await assert.rejects(writing,/account changed/);assert.equal(h.M.state,null);
});
test('an old account response cannot overwrite a newly signed-in account',async()=>{
  const h=harness();await h.M.ready();const gate=h.blockLoad(),loading=h.M.reload();await new Promise(resolve=>setImmediate(resolve));
  h.change('B');await h.M.ready();gate.resolve();await assert.rejects(loading,/account changed/);
  assert.deepEqual(h.M.state.favorites,[{key:'B',title:'B'}]);
});
test('guests cannot start a saved Favorite mutation',async()=>{
  const h=harness();await h.M.ready();h.change(null);
  await assert.rejects(h.M.favorite({key:'guest',title:'Temporary'},true),/Sign in/);assert.equal(h.M.state,null);
});
test('a cross-tab reload during a save keeps the completed edit',async()=>{
  const h=harness();await h.M.ready();const save=h.blockSave();
  const writing=h.M.favorite({key:'new',title:'New favorite'},true);await new Promise(resolve=>setImmediate(resolve));
  const load=h.blockLoad(),loading=h.M.reload();await new Promise(resolve=>setImmediate(resolve));
  save.resolve();await new Promise(resolve=>setImmediate(resolve));load.resolve();await loading;await writing;
  assert.equal(h.M.has('new'),true);assert.equal(h.M.has('A'),true);
});
test('source snapshots are detached from caller-owned objects',async()=>{
  const h=harness();await h.M.ready();const item={key:'place',title:'Coffee',coordinates:[-97.7,30.2]};
  const copied=h.M.cleanSource(item);item.coordinates[0]=0;assert.equal(copied.coordinates[0],-97.7);
  assert.throws(()=>h.M.cleanSource({key:'missing-title'}),/cannot be saved/);
});
