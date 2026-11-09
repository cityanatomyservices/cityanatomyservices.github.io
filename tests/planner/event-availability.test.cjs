const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto');
const E=require('../../special-events/model.js'),M=require('../../planner/model.js'),S=require('../../planner/sources.js'),X=require('../../planner/export.js');
const day='2026-11-14',later='2026-11-21',at=time=>`${day}T${time}:00-06:00`;
const data=()=>E.validate(JSON.parse(fs.readFileSync(require.resolve('../../special-events/data/austin-studio-tour-2026.geojson'),'utf8')));
const profile=(name,facets,days,status='published')=>({id:name,name,url:'https://example.com/'+name,facets,availability:{status,days}});
const hours=(open,close)=>[{open,close}];
function fixture(){const e=data(),f=e.features[0];f.properties.profiles=[
 profile('Painter',{'mediums':['Painting'],'activities':['Artist Talk'],'ada-accessibility':['Accessible Doorways']},{[day]:hours('11:00','12:00'),[later]:hours('14:00','17:00')}),
 profile('Potter',{'mediums':['Ceramics'],'activities':['Drinks'],'ada-accessibility':['Accessible Restrooms']},{[day]:hours('14:00','17:00')}),
 profile('Unconfirmed',{'mediums':['Painting']},{},'unknown')];return {e,f};}
function plan(source){const p=M.empty(randomUUID());M.ensureDay(p,day);p.items=[{...S.item(source,randomUUID()),day}];return p;}

test('official date/hour exceptions and moving groups are attached to the correct stop',()=>{
 const e=data(),by=n=>e.features.find(f=>f.properties.number===n);
 assert.ok(E.matching(e,by(1),day).length);assert.equal(E.matching(e,by(1),later).length,0);
 assert.deepEqual(e.features.filter(f=>E.matching(e,f,day,{query:'1'}).length).map(f=>f.properties.number),[1]);
 assert.equal(E.matching(e,by(151),day).length,0);
 const moved=E.source(e,by(151),later);assert.equal(M.clock(moved.start),'12:00');assert.equal(M.clock(moved.end),'16:00');
 assert.ok(E.matching(e,by(71),day,{query:'Renowned Artists'}).length);assert.equal(E.matching(e,by(71),later,{query:'Renowned Artists'}).length,0);
 assert.equal(E.matching(e,by(125),day).length,0);assert.equal(E.source(e,by(125),day,{includeUnknown:true}).hoursUnknown,true);
 assert.ok(e.features.every(f=>f.properties.profiles.every(p=>p.facets&&p.availability)));
});
test('date, search and category filters match the same participant; accessibility requires every selected feature',()=>{
 const {e,f}=fixture();
 assert.deepEqual(E.matching(e,f,day,{facets:{mediums:['Painting']}}).map(p=>p.profile.name),['Painter']);
 assert.equal(E.matching(e,f,day,{facets:{mediums:['Painting'],activities:['Drinks']}}).length,0);
 assert.equal(E.matching(e,f,later,{facets:{mediums:['Ceramics']}}).length,0);
 assert.equal(E.matching(e,f,day,{facets:{'ada-accessibility':['Accessible Doorways','Accessible Restrooms']}}).length,0);
 assert.equal(E.matching(e,f,day,{query:'Potter'}).length,1);
 assert.equal(E.matching(e,f,day,{facets:{mediums:['Painting','Ceramics']}}).length,2);
});
test('time filters narrow published windows without filling gaps or claiming unknown hours',()=>{
 const {e,f}=fixture();
 assert.equal(E.matching(e,f,day,{from:'12:00',until:'14:00'}).length,0);
 assert.equal(E.matching(e,f,day,{allDay:true}).length,0);
 const source=E.source(e,f,day,{from:'15:00',until:'16:00',facets:{mediums:['Ceramics']}});
 assert.equal(M.clock(source.start),'15:00');assert.equal(M.clock(source.end),'16:00');
 assert.match(source.eventFiltersSummary,/Ceramics/);assert.deepEqual(source.eventProfiles.map(p=>p.name),['Potter']);
 assert.throws(()=>E.visitRange(e,day,{from:'16:00',until:'12:00'}),/later/);
 assert.equal(E.matching(e,f,day,{includeUnknown:true,from:'12:30',until:'13:00'}).length,0);
});
test('building a day skips closed gaps and checks the whole visit fits within one window',()=>{
 const {e,f}=fixture(),p=plan(E.source(e,f,day));
 p.items[0].schedule.duration=90;
 const built=M.build(p);assert.equal(M.clock(built.items[0].schedule.start),'14:00');
 built.items[0].schedule.start=at('12:30');assert.ok(M.check(built).issues.get(built.items[0].id).some(i=>i.code==='outside-hours'));
 assert.equal(X.prepare(built,'google-calendar').items.length,0);assert.equal(X.prepare(built,'google-maps').items.length,0);
 p.items[0].schedule.duration=240;assert.equal(M.build(p).items[0].schedule.start,null);
});
test('unknown event hours require a confirmed manual window before automatic scheduling or export',()=>{
 const {e,f}=fixture(),source=E.source(e,f,day,{query:'Unconfirmed',includeUnknown:true}),p=plan(source);
 assert.equal(M.build(p).items[0].schedule.start,null);
 p.items[0].schedule.start=at('11:00');assert.equal(X.prepare(p,'apple-calendar').items.length,0);
 p.items[0].schedule.windowStart=at('13:00');p.items[0].schedule.windowEnd=at('15:00');
 const built=M.build(p);assert.equal(M.clock(built.items[0].schedule.start),'13:00');assert.equal(X.prepare(built,'apple-calendar').items.length,1);
});
test('a listed day with an omitted closing time needs the unconfirmed-schedule option',()=>{
 const {e,f}=fixture();f.properties.profiles=[profile('Missing end',{}, {[day]:[]})];
 assert.equal(E.matching(e,f,day).length,0);
 assert.equal(E.source(e,f,day,{includeUnknown:true}).hoursUnknown,true);
 assert.equal(E.matching(e,f,later,{includeUnknown:true}).length,0,'Other days are still not listed');
});
test('travel fitting moves to a real opening window and refuses an impossible fit without changing input',()=>{
 const {e,f}=fixture(),p=plan(E.source(e,f,day));
 const anchor=S.item({key:'anchor',title:'Fixed visit',kind:'event',timing:'fixed',start:at('12:00'),end:at('13:00'),endKnown:true},randomUUID());anchor.day=day;
 p.items.unshift(anchor);p.items[1].schedule.start=at('13:00');p.items[1].schedule.duration=60;
 const provider={leg:()=>({status:'ready',minutes:20})};
 const fitted=M.fitTravel(p,provider);assert.equal(M.clock(fitted.plan.items[1].schedule.start),'14:00');
 assert.equal(M.check(fitted.plan,provider).conflicts,0);
 p.items[1].schedule.duration=240;const before=JSON.stringify(p);assert.throws(()=>M.fitTravel(p,provider),/fit|availability/);assert.equal(JSON.stringify(p),before);
});
test('calendar snapshots retain chosen filters and matching artists, and source refresh flags unavailable saved days',()=>{
 const {e,f}=fixture(),source=E.source(e,f,day,{facets:{mediums:['Ceramics']}}),p=M.build(plan(source));
 const calendar=X.calendar(p).text;assert.match(calendar,/Ceramics/);assert.match(calendar,/Potter/);assert.match(calendar,/DTSTART:20261114T200000Z/);
 const removed=E.refresh(e,f,{...source,eventDate:later});assert.equal(removed.eventUnavailable,true);assert.equal(removed.key,source.key);
 const saved=plan(removed);saved.items[0].schedule.start=at('14:00');saved.items[0].schedule.note='Keep my note';
 assert.equal(X.prepare(saved,'google-maps').items.length,0);assert.equal(M.build(saved).items[0].schedule.note,'Keep my note');
});
test('overnight event windows stay on the selected plan day; invalid availability is rejected',()=>{
 const {e,f}=fixture();f.properties.profiles=[profile('Night',{}, {[day]:[{open:'17:00',close:'01:00',nextDay:true}]})];
 const source=E.source(e,f,day,{from:'23:00',until:'01:00'}),p=M.build(plan(source));
 assert.equal(M.planDay(source.end),day);assert.equal(M.clock(p.items[0].schedule.start),'23:00');assert.equal(M.valid(p),true);
 p.items[0].source.availabilityWindows=[{start:at('17:00'),end:at('11:00')}];assert.equal(M.valid(p),false);
});
test('future events with legacy per-stop hours still honor date and visit-time filters',()=>{
 const {e,f}=fixture();delete e.availabilityChecked;f.properties.dates=[day];f.properties.hours={open:'11:00',close:'13:00'};
 assert.equal(E.matching(e,f,later).length,0);assert.equal(E.matching(e,f,day,{allDay:true}).length,0);
 const source=E.source(e,f,day,{from:'12:00',until:'12:30'});assert.equal(M.clock(source.start),'12:00');assert.equal(M.clock(source.end),'12:30');
 f.properties.start=at('12:00');f.properties.end=at('13:00');assert.equal(E.source(e,f,day).timing,'fixed');
 assert.equal(E.matching(e,f,day,{from:'12:30',until:'14:00'}).length,0,'A fixed performance must fit the chosen window');
});
