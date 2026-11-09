const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../../special-events/model.js'),M=require('../../planner/model.js'),S=require('../../planner/sources.js'),X=require('../../planner/export.js');
const data=()=>E.validate(JSON.parse(fs.readFileSync(require.resolve('../../special-events/data/austin-studio-tour-2026.geojson'),'utf8')));
test('official tour data contains unique numbered stops inside the event, with source links',()=>{
 const e=data();assert.equal(e.features.length,307);assert.equal(new Set(e.features.map(f=>f.properties.number)).size,307);
 for(const f of e.features){assert.ok(f.properties.address);assert.match(f.properties.url,/^https:\/\/atxstudiotour.com\/location\//);}
 assert.equal(e.features.filter(f=>f.properties.participants.length).length,307);
 const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../../chat/locate.js'),'utf8'),{window});
 assert.equal(e.chatGeofences.features.length,307);
 for(const f of e.features){const containing=e.chatGeofences.features.filter(zone=>window.ChatLocate.find({features:[zone]},f.geometry.coordinates));assert.equal(containing.length,1);assert.equal(containing[0].properties.stopId,f.properties.id);}
 assert.equal(window.ChatLocate.find(e.chatGeofences,[-98.1,30.2672]),null);
 const missing=structuredClone(e);delete missing.features[0].properties.chatBoundary;assert.throws(()=>E.validate(missing),/boundary/);
 const small=structuredClone(e);small.features=[small.features[0]];const [x,y]=small.features[0].geometry.coordinates;small.bounds=[[x-.001,y-.001],[x+.001,y+.001]];assert.doesNotThrow(()=>E.validate(small));
 const bad=structuredClone(e);bad.features[0].geometry.coordinates=[0,0];assert.throws(()=>E.validate(bad),/outside/);
});
test('all 307 published chat zones are disjoint, including shared buildings',()=>{
 const e=data();const rings=g=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).flat();
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const intersect=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
 const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../../chat/locate.js'),'utf8'),{window});
 const zones=e.chatGeofences.features.map(f=>{const r=rings(f.geometry),pts=r.flat();return {f,r,box:[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))]};});
 for(let i=0;i<zones.length;i++)for(let j=0;j<i;j++){
  const a=zones[i],b=zones[j],label=`stops ${a.f.properties.number}/${b.f.properties.number}`;
  if(a.box[2]<b.box[0]||b.box[2]<a.box[0]||a.box[3]<b.box[1]||b.box[3]<a.box[1])continue;
  for(const r of a.r)for(const p of r)assert.equal(window.ChatLocate.find({features:[b.f]},p),null,label);
  for(const r of b.r)for(const p of r)assert.equal(window.ChatLocate.find({features:[a.f]},p),null,label);
  for(const r of a.r)for(const s of b.r)for(let k=1;k<r.length;k++)for(let n=1;n<s.length;n++)assert.equal(intersect(r[k-1],r[k],s[n-1],s[n]),false,label);
 }
 assert.equal(e.chat.buildingMatched,301);assert.equal(e.chat.sharedBuildingStops.length,8);
});
test('precise GPS refreshes stationary fixes and ignores older or abandoned readings',()=>{
 const window={},readings=[],watches=[],timers=new Map();let seq=0,refreshes=0;
 const navigator={geolocation:{watchPosition(success,error,options){watches.push({success,error,options});return watches.length;},clearWatch(){},getCurrentPosition(){refreshes++;}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../chat/locate.js'),'utf8'),{window,navigator,setInterval:fn=>{timers.set(++seq,fn);return seq;},clearInterval:id=>timers.delete(id)});
 const onFix=(pt,fix)=>readings.push(fix.timestamp),empty={features:[]};
 window.ChatLocate.start(empty,()=>{},()=>{},onFix,{precise:true});assert.equal(watches[0].options.enableHighAccuracy,true);assert.equal(watches[0].options.maximumAge,0);
 const fix=timestamp=>({coords:{longitude:-97.7,latitude:30.3,accuracy:5},timestamp});
 watches[0].success(fix(200));watches[0].success(fix(100));assert.deepEqual(readings,[200]);
 [...timers.values()][0]();assert.equal(refreshes,1);
 window.ChatLocate.start(empty,()=>{},()=>{},onFix);assert.equal(watches[1].options.enableHighAccuracy,false);assert.equal(timers.size,0);
 watches[0].success(fix(300));assert.deepEqual(readings,[200]);
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

function chatHarness(registered=false){
 const callbacks={},received=[],channels=[],history=[];let release;
 const client={channel(name){const c={name,handlers:{},state:{},on(type,filter,fn){this.handlers[type]=fn;return this;},presenceState(){return this.state;},track:async()=>{},untrack:async()=>{},subscribe(fn){fn('SUBSCRIBED');},send:async payload=>{c.last=payload;return 'ok';}};channels.push(c);return c;},removeChannel:async()=>{},from(){return {select(){return this;},eq(){return this;},order(){return this;},limit(){return new Promise(resolve=>history.push(resolve));},insert(){throw Error('Live-only event messages must not be saved');}};}};
 const window={ChatIdentity:{client:()=>client,userId:()=> 'fixture'},AustinSession:{registered},ChatLocate:{metres:()=>0},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../chat/chat.js'),'utf8'),{window,Date,console,setInterval,clearInterval});
 return {engine:window.ChatEngine,channels,history,received,join:()=>window.ChatEngine.join('event-fixture',{handle:'Visitor',emoji:'*'},true,{onMessage:m=>received.push(m)})};
}
test('leaving event coverage during a history load cannot rejoin or show late messages',async()=>{
 const h=chatHarness(),join=h.join();await new Promise(resolve=>setImmediate(resolve));await h.engine.leave();
 h.history[0]({data:[{text:'stale',created_at:new Date().toISOString()}]});await join;
 assert.equal(h.engine.room,null);assert.equal(h.received.length,0);assert.equal(await h.engine.send('outside'),false);
});
test('stop chat is live-only and accepts only current visible peers at that stop',async()=>{
 const h=chatHarness(true),identity={handle:'Visitor',emoji:'*'};let allowed=true;
 const callbacks={onMessage:m=>h.received.push(m)},options={liveOnly:true,canParticipate:()=>allowed,expiresAt:()=>Date.now()+60000};
 await h.engine.join('event-fixture-stop-1',identity,true,callbacks,options);
 const c=h.channels[0];assert.equal(h.history.length,0);assert.equal(await h.engine.send('alone'),false);
 const peer=(room,expiresAt=Date.now()+60000)=>{c.state={Neighbor:[{handle:'Neighbor',room,expiresAt}]};};
 const incoming=(room='event-fixture-stop-1')=>c.handlers.broadcast({payload:{room,handle:'Neighbor',text:'hello'}});
 peer('downtown');incoming();assert.equal(h.received.length,0);assert.equal(await h.engine.send('wrong room'),false);
 peer('event-fixture-stop-1',Date.now()-1);incoming();assert.equal(h.received.length,0);
 peer('event-fixture-stop-1');incoming('event-fixture-stop-2');assert.equal(h.received.length,0);
 incoming();assert.equal(h.received.length,1);assert.equal(await h.engine.send('hello stop'),true);assert.equal(c.last.payload.room,'event-fixture-stop-1');
 allowed=false;incoming();assert.equal(h.received.length,2);assert.equal(await h.engine.send('expired GPS'),false);
 allowed=true;await h.engine.join('event-fixture-stop-2',identity,true,callbacks,options);incoming();assert.equal(h.received.length,2);
 await h.engine.leave();assert.equal(await h.engine.send('outside'),false);
 await h.engine.join('event-fixture-stop-1',identity,false,callbacks,options);assert.equal(h.engine.room,null);
});
test('event broadcasts accept only the event room and send the same event key',async()=>{
 const h=chatHarness(),join=h.join();await new Promise(resolve=>setImmediate(resolve));h.history[0]({data:[]});await join;
 h.channels[0].handlers.broadcast({payload:{room:'downtown',text:'neighborhood'}});assert.equal(h.received.length,0);
 h.channels[0].handlers.broadcast({payload:{room:'event-fixture',text:'event'}});assert.equal(h.received.length,1);
 assert.equal(await h.engine.send('hello'),true);assert.equal(h.channels[0].last.payload.room,'event-fixture');
});
