const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../../classifieds/client.js');
function setup(member=true){
  let callback,user=member?{id:'account-a',email:'private@example.invalid'}:null;
  const calls=[],tracked=[];
  const session={get registered(){return !!user;},get user(){return user;},subscribe(fn){callback=fn;return()=>{};},async peek(){},client(){return {rpc(name,args){return {abortSignal(signal){return new Promise(resolve=>calls.push({name,args,signal,resolve}));}};}};}};
  const api=create({session,track:p=>{tracked.push(p);return p;}});
  return {api,calls,tracked,change(id){user=id?{id}:null;callback();}};
}
test('guests cannot read, post, or delete',async()=>{
  const h=setup(false);await assert.rejects(h.api.read(),/account/);await assert.rejects(h.api.save('free','Title','Body'),/account/);await assert.rejects(h.api.remove(1),/account/);assert.equal(h.calls.length,0);h.api.destroy();
});
test('writes carry an owner guard and revision, never an account email',async()=>{
  const h=setup(),p=h.api.save('free','Title','Body',3);
  assert.deepEqual(h.calls[0].args,{p_owner_id:'account-a',p_category:'free',p_title:'Title',p_body:'Body',p_expected_revision:3,p_expected_id:null});
  assert.equal(h.tracked.length,1);await assert.rejects(h.api.save('free','Again','Body'),/wait/);
  h.calls[0].resolve({data:{revision:4},error:null});assert.equal((await p).revision,4);
  const removal=h.api.remove(4,'ad-one');assert.deepEqual(h.calls[1].args,{p_owner_id:'account-a',p_expected_revision:4,p_expected_id:'ad-one'});h.calls[1].resolve({data:null});await removal;h.api.destroy();
});
test('late private responses cannot cross sign-out or account changes',async()=>{
  const h=setup(),events=[];h.api.subscribe(e=>events.push(e.type));
  const read=h.api.read('jobs'),write=h.api.save('free','A','Body');
  h.change('account-b');assert.ok(h.calls.every(c=>c.signal.aborted));
  h.calls.forEach(c=>c.resolve({data:{private:'old account data'}}));
  await assert.rejects(read,e=>e.changed);await assert.rejects(write,e=>e.changed);
  assert.deepEqual(events,['identity']);h.api.destroy();
});
test('server conflicts stay visible and allow a later retry',async()=>{
  const h=setup(),p=h.api.save('free','Title','Body',1);h.calls[0].resolve({error:{message:'Your ad changed in another window.'}});
  await assert.rejects(p,/another window/);
  const next=h.api.save('free','Title','Body',2);h.calls[1].resolve({data:{revision:3}});await next;h.api.destroy();
});
