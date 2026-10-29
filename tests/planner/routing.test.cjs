const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../../planner/model.js'),R=require('../../planner/routing.js');
const at=t=>M.instant(`2026-10-31T${t}`);
function stop(name,time,point=[-97.74,30.27]) {return {id:crypto.randomUUID(),day:'2026-10-31',source:{key:name,title:name,kind:'place',timing:'unknown',coordinates:point},schedule:{start:at(time),duration:60,locked:false,durationConfirmed:true}};}
function plan(items) {return {...M.empty(crypto.randomUUID()),date:'2026-10-31',days:['2026-10-31'],daySettings:{'2026-10-31':{name:'Trip',bufferMinutes:20}},routing:{enabled:true,avoidTolls:false,arrivalMinutes:10},items};}
const estimate={status:'ready',driveMinutes:20,accessMinutes:2,networkVersion:2,distanceMeters:10000};
function provider(handler) {return R.create({session:async()=>({}),rpc:async(_c,name,args,signal)=>name==='planner_routing_status'?{status:'ready',networkVersion:2}:handler(args,signal)});}
test('road estimate, road access and arrival allowance are distinct; old manual buffer is not added',async()=>{
  const a=stop('A','10:00'),b=stop('B','11:00',[-97.72,30.3]),p=plan([a,b]),r=provider(async()=>estimate);
  b.schedule.bufferBefore=75;
  await r.calculate(p);
  assert.equal(r.leg(a,b,p).minutes,32);
  b.schedule.arrivalMinutes=5;assert.equal(r.leg(a,b,p).minutes,27);
  assert.equal(M.check(p,r).issues.get(b.id).find(i=>i.code==='buffer').severity,'error');
});
test('unavailable journeys keep manual allowance and cannot silently fit a day',async()=>{
  const a=stop('A','10:00'),b=stop('B','11:00'),p=plan([a,b]),r=provider(async()=>({status:'needs_entrance'}));
  await r.calculate(p);
  assert.equal(r.leg(a,b,p).minutes,20);
  assert.equal(r.leg(a,b,p).status,'needs_entrance');
  assert.throws(()=>M.fitTravel(p,r),/every scheduled journey/);
});
test('fitting moves flexible visits within their order and preserves a fixed show',async()=>{
  const a=stop('Market','10:00'),b=stop('Show','11:15',[-97.7,30.3]);
  b.source.timing='fixed';b.source.start=at('11:15');
  const p=plan([a,b]),r=provider(async()=>estimate);await r.calculate(p);
  const fitted=M.fitTravel(p,r).plan;
  assert.equal(fitted.items[0].schedule.start,at('09:43'));
  assert.equal(fitted.items[1].schedule.start,at('11:15'));
  assert.equal(p.items[0].schedule.start,at('10:00'));
  assert.equal(M.check(fitted,r).conflicts,0);
});
test('infeasible locked activities leave the entire original itinerary untouched',async()=>{
  const a=stop('A','10:00'),b=stop('B','11:00');a.schedule.locked=b.schedule.locked=true;
  const p=plan([a,b]),copy=structuredClone(p),r=provider(async()=>estimate);await r.calculate(p);
  assert.throws(()=>M.fitTravel(p,r),/cannot fit|not enough time/);
  assert.deepEqual(p,copy);
});
test('fitting respects availability and the 5 AM boundary',async()=>{
  const a=stop('Late','02:30'),b=stop('Later','04:15',[-97.7,30.3]);
  a.schedule.start=M.timeOnDay('2026-10-31','02:30');a.schedule.locked=true;
  b.schedule.start=M.timeOnDay('2026-10-31','04:15');b.schedule.windowStart=M.timeOnDay('2026-10-31','04:15');
  const p=plan([a,b]),r=provider(async()=>estimate);await r.calculate(p);
  assert.throws(()=>M.fitTravel(p,r),/availability/);
});
test('changing times reuses static road estimates; toll and entrance changes invalidate them',async()=>{
  let calls=0;const a=stop('A','10:00'),b=stop('B','12:00',[-97.7,30.3]),p=plan([a,b]);
  const r=provider(async()=>{calls++;return estimate;});await r.calculate(p);
  b.schedule.start=at('12:30');await r.calculate(p);assert.equal(calls,1);
  p.routing.avoidTolls=true;assert.notEqual(r.leg(a,b,p).status,'ready');await r.calculate(p);assert.equal(calls,2);
  b.schedule.routeCoordinates=[-97.71,30.31];assert.notEqual(r.leg(a,b,p).status,'ready');await r.calculate(p);assert.equal(calls,3);
});
test('late results from an abandoned day cannot replace the active request',async()=>{
  let release;const p=plan([stop('A','10:00'),stop('B','12:00',[-97.7,30.3])]);
  let calls=0;const r=provider(async()=>{if(++calls===1)return new Promise(resolve=>{release=resolve;});return {...estimate,driveMinutes:30};});
  const first=r.calculate(p);while(!release)await new Promise(resolve=>setImmediate(resolve));
  const newer=structuredClone(p);newer.date='2026-11-01';newer.items.forEach(i=>i.day=newer.date);
  await r.calculate(newer);release({...estimate,driveMinutes:1});await first;
  assert.equal(r.leg(newer.items[0],newer.items[1],newer).driveMinutes,30);
});
test('unknown or malformed backend estimates never become zero-minute journeys',async()=>{
  const p=plan([stop('A','10:00'),stop('B','12:00')]),r=provider(async()=>({...estimate,driveMinutes:-1}));
  await r.calculate(p);const leg=r.leg(...p.items,p);assert.equal(leg.status,'unavailable');assert.equal(leg.minutes,20);
});
test('navigation links target the driving entrance and work without paid API keys',()=>{
  const item=stop('A','10:00');item.schedule.routeCoordinates=[-97.71,30.31];
  const google=new URL(R.navigation(item)),apple=new URL(R.navigation(item,'apple')),waze=new URL(R.navigation(item,'waze'));
  assert.equal(google.searchParams.get('destination'),'30.31,-97.71');
  assert.equal(apple.searchParams.get('daddr'),'30.31,-97.71');assert.equal(waze.searchParams.get('ll'),'30.31,-97.71');
  assert.equal(google.searchParams.get('api'),'1');
});
test('per-day routing preferences persist separately and invalid overrides are rejected',()=>{
  const p=plan([stop('A','10:00')]);M.replaceDay(p,M.dayView(p));
  assert.equal(p.daySettings[p.date].routing.arrivalMinutes,10);
  p.items[0].schedule.routeCoordinates=[-97.7,NaN];assert.equal(M.valid(p),false);
});
