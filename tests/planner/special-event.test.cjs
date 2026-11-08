const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../../special-events/model.js'),M=require('../../planner/model.js'),S=require('../../planner/sources.js'),X=require('../../planner/export.js');
const data=()=>E.validate(JSON.parse(fs.readFileSync(require.resolve('../../special-events/data/austin-studio-tour-2026.geojson'),'utf8')));
test('official tour data contains unique numbered stops inside the event, with source links',()=>{
 const e=data();assert.equal(e.features.length,307);assert.equal(new Set(e.features.map(f=>f.properties.number)).size,307);
 for(const f of e.features){assert.ok(f.properties.address);assert.match(f.properties.url,/^https:\/\/atxstudiotour.com\/location\//);}
 assert.equal(e.features.filter(f=>f.properties.participants.length).length,303);
 const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../../chat/locate.js'),'utf8'),{window});
 assert.equal(window.ChatLocate.find({features:[e.area]},[-97.7431,30.2672]).properties.id,'event-austin-studio-tour-2026');
 assert.equal(window.ChatLocate.find({features:[e.area]},[-98.1,30.2672]),null);
 const small=structuredClone(e);small.features=[small.features[0]];const [x,y]=small.features[0].geometry.coordinates;small.bounds=[[x-.001,y-.001],[x+.001,y+.001]];assert.doesNotThrow(()=>E.validate(small));
 const bad=structuredClone(e);bad.features[0].geometry.coordinates=[0,0];assert.throws(()=>E.validate(bad),/outside/);
});
test('event dates produce separate flexible visits within tour hours and usable exports',()=>{
 const e=data(),date=e.dates[0],source=E.source(e,e.features[0],date),other=E.source(e,e.features[0],e.dates[1]);
 assert.notEqual(source.key,other.key);assert.equal(M.targetDay(source,'2026-11-08'),date);
 const plan=M.empty('event-plan');M.ensureDay(plan,date);plan.items=[S.item(source,'one'),S.item(E.source(e,e.features[1],date),'two')];
 const built=M.build(plan);assert.ok(built.items.every(i=>M.day(i.schedule.start)===date));
 for(const item of built.items){assert.ok(Date.parse(item.schedule.start)>=Date.parse(source.start));assert.ok(Date.parse(item.schedule.start)+item.schedule.duration*60000<=Date.parse(source.end));assert.equal(item.schedule.durationConfirmed,false);}
 const calendar=X.calendar(built);assert.match(calendar.text||calendar,/DTSTART:20261114T170000Z/);
 assert.equal(X.prepare(built,'google-maps').items.length,2);assert.equal(X.prepare(built,'apple-maps').items.length,2);
 assert.throws(()=>E.source(e,e.features[0],'2026-11-16'),/not listed/);
});

function chatHarness(){
 const callbacks={},received=[],channels=[],history=[];let release;
 const client={channel(name){const c={name,handlers:{},on(type,filter,fn){this.handlers[type]=fn;return this;},presenceState:()=>({}),track:async()=>{},untrack:async()=>{},subscribe(fn){fn('SUBSCRIBED');},send:async payload=>{c.last=payload;}};channels.push(c);return c;},removeChannel:async()=>{},from(){return {select(){return this;},eq(){return this;},order(){return this;},limit(){return new Promise(resolve=>history.push(resolve));}};}};
 const window={ChatIdentity:{client:()=>client,userId:()=> 'fixture'},AustinSession:{registered:false},ChatLocate:{metres:()=>0},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../chat/chat.js'),'utf8'),{window,Date,console});
 return {engine:window.ChatEngine,channels,history,received,join:()=>window.ChatEngine.join('event-fixture',{handle:'Visitor',emoji:'*'},true,{onMessage:m=>received.push(m)})};
}
test('leaving event coverage during a history load cannot rejoin or show late messages',async()=>{
 const h=chatHarness(),join=h.join();await new Promise(resolve=>setImmediate(resolve));await h.engine.leave();
 h.history[0]({data:[{text:'stale',created_at:new Date().toISOString()}]});await join;
 assert.equal(h.engine.room,null);assert.equal(h.received.length,0);assert.equal(await h.engine.send('outside'),false);
});
test('event broadcasts accept only the event room and send the same event key',async()=>{
 const h=chatHarness(),join=h.join();await new Promise(resolve=>setImmediate(resolve));h.history[0]({data:[]});await join;
 h.channels[0].handlers.broadcast({payload:{room:'downtown',text:'neighborhood'}});assert.equal(h.received.length,0);
 h.channels[0].handlers.broadcast({payload:{room:'event-fixture',text:'event'}});assert.equal(h.received.length,1);
 assert.equal(await h.engine.send('hello'),true);assert.equal(h.channels[0].last.payload.room,'event-fixture');
});
