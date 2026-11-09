const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const active=new Map(),created=[],messages=[],people=[];let clock=Date.now();
 const client={
  channel(name,options){
   if(active.has(name))return active.get(name);
   const c={name,options,state:{},handlers:{},subscribed:false,tracks:0,
    on(type,filter,fn){if(c.subscribed)throw Error('Cannot add presence after subscribe');c.handlers[type]=fn;return c;},
    subscribe(fn){c.subscribed=true;c.status=fn;fn('SUBSCRIBED');},
    presenceState:()=>c.state,
    track:async()=>{c.tracks++;return 'ok';},untrack:async()=> 'ok',
    send:async()=> 'ok'};
   created.push(c);active.set(name,c);return c;
  },
  removeChannel:async c=>{c.status('CLOSED');active.delete(c.name);},
  from(){throw Error('Event chat must never read or write saved messages');}
 };
 const window={ChatIdentity:{client:()=>client,userId:()=>null},AustinSession:{registered:false},addEventListener(){},ChatLocate:{metres:()=>0}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../chat/chat.js'),'utf8'),{window,Date:{now:()=>clock},setInterval:()=>1,clearInterval(){},console});
 const engine=window.ChatEngine,options={liveOnly:true,canParticipate:()=>true,expiresAt:()=>clock+60000};
 return {engine,created,messages,people,advance:()=>{clock+=1100;},
  join:(room='event-test-stop-1')=>engine.join(room,{handle:'TestVisitor',emoji:'*'},true,{onMessage:m=>messages.push(m),onPeople:p=>people.push(p)},options),
  peer(c=created.at(-1)){c.state.Peer=[{handle:'Peer',room:engine.room,expiresAt:clock+60000}];c.handlers.presence();}
 };
}
test('rapid leave/rejoin waits for removal of the old SDK channel with the same topic',async()=>{
 const h=fixture();await h.join();const old=h.created[0],untrack=deferred();old.untrack=()=>untrack.promise;
 const leaving=h.engine.leave();const joining=h.join();await tick();
 assert.equal(h.created.length,1,'Do not reuse the closing topic');
 untrack.resolve('ok');await Promise.all([leaving,joining]);
 assert.equal(h.created.length,2);assert.equal(h.created[1].tracks,1);h.peer();
 assert.equal(await h.engine.send('rejoined'),true);assert.equal(h.messages[0].text,'rejoined');
 await h.engine.leave();
});
test('only the newest GPS room joins while a previous connection is closing',async()=>{
 const h=fixture();await h.join();const untrack=deferred();h.created[0].untrack=()=>untrack.promise;
 const leaving=h.engine.leave(),first=h.join('event-test-stop-2'),last=h.join('event-test-stop-3');
 await tick();untrack.resolve('ok');await Promise.all([leaving,first,last]);
 assert.equal(h.created.length,2);assert.equal(h.engine.room,'event-test-stop-3');
 await h.engine.leave();
});
test('live sends require acknowledgement and never render failed or stale sends as delivered',async()=>{
 const h=fixture();await h.join();h.peer();const c=h.created[0];
 assert.equal(c.options.config.broadcast.ack,true);
 for(const result of ['error','timed out']){c.send=async()=>result;h.advance();assert.equal(await h.engine.send(result),false);}
 assert.equal(h.messages.length,0);
 const gate=deferred();c.send=()=>gate.promise;h.advance();const sending=h.engine.send('pending');
 assert.equal(h.messages.length,0);gate.resolve('ok');assert.equal(await sending,true);assert.equal(h.messages.length,1);
 const stale=deferred();c.send=()=>stale.promise;h.advance();const old=h.engine.send('old room');
 await h.join('event-test-stop-2');stale.resolve('ok');assert.equal(await old,false);assert.equal(h.messages.length,1);
 await h.engine.leave();
});
test('connection loss clears event peers and blocks sends until subscription recovers',async()=>{
 const h=fixture();await h.join();h.peer();const c=h.created[0];
 assert.equal(h.engine.people().length,1);await c.status('CHANNEL_ERROR');
 assert.equal(h.engine.people().length,0);assert.equal(h.people.at(-1).length,0);assert.equal(await h.engine.send('offline'),false);
 await c.status('SUBSCRIBED');h.peer();assert.equal(c.tracks,2);assert.equal(await h.engine.send('online'),true);
 await h.engine.leave();
});
function panelFixture(){
 const elements=Object.fromEntries(['chatText','chatSend','chatClose','chatwin','chatLines'].map(id=>[id,{value:'',hidden:false,disabled:false,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},setCustomValidity(text){this.validation=text;},reportValidity(){},focus(){}}]));
 const window={MAP_COPY:{chat:{send:'Send',close:'Close',placeholder:'Message'}},ChatEngine:{maxText:240}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../chat/panel.js'),'utf8'),{window,document:{getElementById:id=>elements[id]}});
 return {panel:window.ChatPanel,elements};
}
test('the chat form awaits send results and retains failed text for retry',async()=>{
 const {panel,elements:e}=panelFixture();const result=deferred();let sends=0;panel.init(()=>{sends++;return result.promise;});
 e.chatText.value='Keep my message';const submitting=e.chatSend.listeners.click();
 assert.equal(e.chatText.value,'Keep my message');assert.equal(e.chatSend.disabled,true);
 await e.chatSend.listeners.click();assert.equal(sends,1);
 result.resolve(false);await submitting;assert.equal(e.chatText.value,'Keep my message');assert.match(e.chatText.validation,/not sent/);assert.equal(e.chatSend.disabled,false);
});
test('a completed send cannot erase a new draft or modify a different room',async()=>{
 const {panel,elements:e}=panelFixture();let result=deferred();panel.init(()=>result.promise);
 e.chatText.value='First';const first=e.chatSend.listeners.click();e.chatText.value='Next';result.resolve(true);await first;assert.equal(e.chatText.value,'Next');
 result=deferred();const old=e.chatSend.listeners.click();panel.clear();e.chatText.value='New room draft';result.resolve(false);await old;
 assert.equal(e.chatText.value,'New room draft');assert.equal(e.chatText.validation,'');assert.equal(e.chatSend.disabled,false);
});
