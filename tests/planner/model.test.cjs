const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../planner/model.js'), S = require('../../planner/sources.js');
const id = () => crypto.randomUUID();
const at = time => M.instant(`2026-10-31T${time}`);
const plan = items => ({ ...M.empty(id()), date:'2026-10-31',days:['2026-10-31'],daySettings:{'2026-10-31':{name:'Test day',bufferMinutes:20}},items:items.map(i=>({...i,day:'2026-10-31'})) });
const stop = (name, options = {}) => {
  const item = S.item({ key:name,title:name,kind:'place',timing:'unknown',hoursUnknown:true,coordinates:[-97.74,30.27],...options },id());
  item.schedule.duration = 60; return item;
};
test('Austin timezone is independent of host timezone, including DST gaps and folds', () => {
  assert.equal(M.day('2026-10-31T02:00:00Z'),'2026-10-30');
  assert.equal(M.instant('2027-03-14T02:30'),null);
  assert.deepEqual(M.localCandidates('2026-11-01T01:30'),['2026-11-01T06:30:00.000Z','2026-11-01T07:30:00.000Z']);
  assert.equal(M.instant('2026-02-30T10:00'),null);
});
test('plan days always run 5 AM to 5 AM, following the Austin clock over DST', () => {
  const p = plan([]);
  assert.equal(M.local(M.bounds(p)[0]),'2026-10-31T05:00');
  assert.equal(M.local(M.bounds(p)[1]),'2026-11-01T05:00');
  assert.equal((M.bounds(p)[1]-M.bounds(p)[0])/3600000,25); // fall-back night
  assert.equal((M.bounds({...p,date:'2027-03-13'})[1]-M.bounds({...p,date:'2027-03-13'})[0])/3600000,23);
});
test('fixed shows reserve time before flexible stops are fitted with buffers', () => {
  const show = stop('Show',{timing:'fixed',start:at('10:00'),end:at('11:00'),endKnown:true});
  const coffee=stop('Coffee'),lunch=stop('Lunch');coffee.schedule.windowStart=at('09:00');lunch.schedule.windowStart=at('11:00');
  const p = M.build(plan([coffee,show,lunch]));
  assert.equal(p.items[1].schedule.start,at('10:00'));
  assert.equal(p.items[0].schedule.start,at('11:20')); // 9-10 does not leave buffer before show
  assert.equal(p.items[2].schedule.start,at('12:40'));
  assert.equal(M.check(p).conflicts,0);
});
test('flexible windows constrain arrivals and full visit length', () => {
  const market = stop('Market',{timing:'window',start:at('12:00'),end:at('12:30'),endKnown:true});
  const p = M.build(plan([market]));
  assert.equal(p.items.length,1); assert.equal(p.items[0].schedule.start,null);
  assert.equal(M.check(p).conflicts,1);
});
test('locked appointments stay put and all nested overlaps are reported', () => {
  const a = stop('Long'); Object.assign(a.schedule,{start:at('10:00'),duration:180,locked:true});
  const b = stop('First',{timing:'fixed',start:at('10:30')});
  const c = stop('Second',{timing:'fixed',start:at('12:00')});
  const p = M.build(plan([a,b,c])), result = M.check(p);
  assert.equal(p.items[0].schedule.start,at('10:00'));
  assert.equal(result.issues.get(a.id).filter(i=>i.code==='overlap').length,2);
  assert.equal(result.conflicts,3);
});
test('custom hours and per-stop buffers are respected', () => {
  const a = stop('Breakfast'), b = stop('Shop');
  Object.assign(a.schedule,{start:at('09:00'),locked:true});
  Object.assign(b.schedule,{windowStart:at('10:00'),windowEnd:at('12:00'),bufferBefore:45});
  const p = M.build(plan([a,b]));
  assert.equal(p.items[1].schedule.start,at('10:45'));
  assert.ok(!M.check(p).issues.get(b.id).some(i=>i.code==='hours'));
});
test('movie expiry is not a finish time, and a showtime must be selected', () => {
  const source = S.feature({geometry:{coordinates:[-97.7,30.2]},properties:{id:'film',title:'Film',kind:'movie',start:at('10:00'),end:at('16:00'),endKnown:false,showtimes:[{start:at('10:00')},{start:at('15:00')}],conditions:'PG · 123 min'}});
  const movie = S.item(source,id());
  assert.equal(movie.schedule.duration,123); assert.equal(movie.schedule.durationConfirmed,false);
  let p = M.build(plan([movie])); assert.equal(p.items[0].schedule.start,null);
  movie.schedule.showtime=at('15:00'); p=M.build(plan([movie]));
  assert.equal(p.items[0].schedule.start,at('15:00')); assert.equal(M.check(p).conflicts,0);
});
test('changing plan dates preserves fixed events and flags wrong-day selections', () => {
  const show = stop('Show',{timing:'fixed',start:at('10:00')});
  const p=M.build({...plan([{...show,day:undefined}]),date:'2026-11-01',items:[show]});
  assert.equal(p.items[0].schedule.start,at('10:00'));
  assert.ok(M.check(p).issues.get(show.id).some(i=>i.code==='outside-day'));
});
test('back-to-back visits conflict with buffer but not a zero-minute allowance', () => {
  const a=stop('A'),b=stop('B'); a.schedule.start=at('09:00');b.schedule.start=at('10:00');
  const p=plan([a,b]); assert.ok(M.check(p).issues.get(b.id).some(i=>i.code==='buffer'));
  p.bufferMinutes=0; assert.equal(M.check(p).conflicts,0);
});
test('a future routing adapter can supply travel durations without changing scheduling', () => {
  const a=stop('A'),b=stop('B'); a.schedule.start=at('09:00');a.schedule.locked=true;
  b.schedule.windowStart=at('09:00');
  const p=M.build(plan([a,b]),{leg:()=>({status:'ready',minutes:35})});
  assert.equal(p.items[1].schedule.start,at('10:35'));
});
test('all-day listing is a date constraint, not confirmed all-day opening hours', () => {
  const f={geometry:{coordinates:[-97.7,30.2]},properties:{id:'exhibit',title:'Exhibit',kind:'listing',allDay:true,start:at('00:00'),end:M.instant('2026-11-01T00:00'),endKnown:true}};
  const i=S.item(S.feature(f),id()),p=M.build(plan([i]));
  assert.equal(p.items[0].schedule.start,at('05:00'));assert.equal(p.items[0].schedule.duration,60);
  assert.ok(M.check(p).issues.get(i.id).some(i=>i.code==='hours'));
});
test('the same event in two Explore categories has a stable selection key', () => {
  const f={geometry:{coordinates:[-97.7,30.2]},properties:{id:'shared',title:'Music',kind:'event',start:at('12:00'),end:at('13:00')}};
  const a=S.feature(f);f.properties.exploreLayer='live-music';assert.equal(a.key,S.feature(f).key);
});
test('validation rejects broken imports and unsafe numeric scheduling values', () => {
  const p=plan([stop('Test')]);assert.equal(M.valid(p),true);
  p.items[0].schedule.bufferBefore=-1;assert.equal(M.valid(p),false);
  p.items[0].schedule.bufferBefore=null;p.date='garbage';assert.equal(M.valid(p),false);
  p.date='2026-10-31';p.items[0].source.coordinates=[NaN,30];assert.equal(M.valid(p),false);
});
test('build is pure and repeatable; no selection or source snapshot is lost', () => {
  const p=plan([stop('One'),stop('Two')]),before=JSON.stringify(p);
  assert.deepEqual(M.build(p),M.build(p));assert.equal(JSON.stringify(p),before);
});
test('time-only arrivals before 5 AM belong to the next calendar date',()=>{
  assert.equal(M.local(M.timeOnDay('2026-10-30','01:15')),'2026-10-31T01:15');
  assert.equal(M.local(M.timeOnDay('2026-10-30','05:00')),'2026-10-30T05:00');
  assert.equal(M.local(M.timeOnDay('2026-10-30','05:00',true)),'2026-10-31T05:00');
  assert.equal(M.planDay('2026-10-31T04:59:00-05:00'),'2026-10-30');
  assert.equal(M.planDay('2026-10-31T05:00:00-05:00'),'2026-10-31');
  assert.equal(M.planDay('2027-01-01T01:00:00-06:00'),'2026-12-31');
});
test('late-night visits may finish at the boundary but cannot spill into another day',()=>{
  const p=plan([stop('Late')]),i=p.items[0]; i.schedule.start=M.timeOnDay(p.date,'04:30');i.schedule.duration=30;
  assert.ok(!M.check(p).issues.get(i.id).some(x=>x.code==='outside-day'));
  i.schedule.duration=31;assert.ok(M.check(p).issues.get(i.id).some(x=>x.code==='outside-day'));
});
test('legacy mixed dates are grouped without losing IDs, snapshots, locks or notes',()=>{
  const a=stop('Coffee'),b=stop('Late show',{timing:'fixed',start:'2026-11-02T01:00:00-06:00'});
  a.schedule.start=at('09:00');a.schedule.locked=true;a.schedule.note='Keep this';
  const legacy={id:id(),name:'Saved day',date:'2026-10-31',dayStart:'09:00',dayEnd:'22:00',bufferMinutes:20,items:[a,b]};
  const upgraded=M.upgrade(legacy);
  assert.equal(M.valid(upgraded),true);assert.deepEqual(upgraded.days,['2026-10-31','2026-11-01']);
  assert.equal(upgraded.items[1].day,'2026-11-01');assert.equal(upgraded.items[0].id,a.id);
  assert.equal(upgraded.items[0].schedule.note,'Keep this');assert.equal(upgraded.items[0].schedule.locked,true);
  assert.deepEqual(upgraded.items[1].source,b.source);assert.deepEqual(M.upgrade(upgraded),upgraded);
});
test('a whole saved collection still builds and checks only its selected day',()=>{
  const p=plan([stop('Today')]);M.ensureDay(p,'2026-11-02');
  const other={...stop('Tomorrow'),day:'2026-11-02'};p.items.push(other);p.date='2026-10-31';
  const built=M.build(p);assert.ok(built.items[0].schedule.start);assert.equal(built.items[1].schedule.start,null);
  assert.equal(M.check(built).issues.has(other.id),false);
});
test('movie choices and published events resolve to their actual plan day',()=>{
  const source={kind:'movie',showtimes:[{start:'2026-10-31T02:00:00-05:00'},{start:'2026-10-31T20:00:00-05:00'}]};
  assert.equal(M.targetDay(source,'2026-10-30'),'2026-10-30');
  assert.equal(M.targetDay(source,'2026-10-31'),'2026-10-31');
  assert.equal(M.targetDay({timing:'fixed',start:'2026-10-31T02:00:00-05:00'},'2026-11-10'),'2026-10-30');
});
