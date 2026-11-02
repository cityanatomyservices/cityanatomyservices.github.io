const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../../planner/export.js'),M=require('../../planner/model.js');
const date='2026-10-31',now='2026-10-30T12:00:00Z';
const stop=(id,time='10:00',options={})=>({id,day:date,source:{key:id,title:id,venue:'Austin venue',address:'100 Main St, Austin, TX',coordinates:[-97.74,30.27],url:'https://example.com/event',...options},schedule:{start:time?M.timeOnDay(date,time):null,duration:60,durationConfirmed:true,note:''}});
const plan=items=>({id:'fixture-plan',date,name:'My Austin day',items,routing:{avoidTolls:true}});
const unfold=text=>text.replace(/\r\n[ \t]/g,'');
test('calendar contains only this day, uses edited times and durations, and keeps stable event identities',()=>{
  const a=stop('first','09:00'),b=stop('second','14:00'),other=stop('tomorrow');other.day=M.nextDay(date);
  a.schedule.duration=37;b.schedule.note='Bring a camera';
  const p=plan([b,other,a]),before=JSON.stringify(p),file=E.calendar(p,now),text=unfold(file.text);
  assert.equal(file.filename,'austin-day-2026-10-31.ics');assert.equal(file.type,'text/calendar;charset=utf-8');
  assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,2);assert.ok(!text.includes('tomorrow'));
  assert.ok(text.indexOf('SUMMARY:first')<text.indexOf('SUMMARY:second'));
  assert.match(text,/DTSTART:20261031T140000Z\r\nDTEND:20261031T143700Z/);
  assert.match(text,/Bring a camera/);assert.match(text,/CLASS:PRIVATE/);assert.match(text,/GEO:30.27;-97.74/);
  const ids=text.match(/^UID:.*$/gm);a.schedule.start=M.timeOnDay(date,'11:00');
  assert.deepEqual(unfold(E.calendar(p,'2026-10-31T12:00:00Z').text).match(/^UID:.*$/gm),ids);
  a.schedule.start=M.timeOnDay(date,'09:00');assert.equal(JSON.stringify(p),before,'export does not mutate the plan');
});
test('calendar preserves actual instants through the repeated fall hour and next-morning boundary',()=>{
  const a=stop('late','01:30');a.schedule.duration=90;
  const text=unfold(E.calendar(plan([a]),now).text);
  assert.match(text,/DTSTART:20261101T063000Z/);assert.match(text,/DTEND:20261101T080000Z/);
  a.schedule.start=M.localCandidates('2026-11-01T01:30')[1];
  assert.match(unfold(E.calendar(plan([a]),now).text),/DTSTART:20261101T073000Z/);
});
test('spring-forward export keeps the entered elapsed duration',()=>{
  const a=stop('spring');a.day='2027-03-13';a.schedule.start=M.timeOnDay(a.day,'01:30');a.schedule.duration=90;
  const p={...plan([a]),date:a.day};
  assert.match(unfold(E.calendar(p,now).text),/DTSTART:20270314T073000Z\r\nDTEND:20270314T090000Z/);
});
test('missing or wrong-day times are reported, never invented as all-day calendar events',()=>{
  const a=stop('untimed',null),b=stop('outside');b.schedule.start=M.instant('2026-11-02T10:00');
  const p=plan([a,b]);assert.deepEqual(E.prepare(p,'apple-calendar').skipped.map(i=>i.id),['outside','untimed']);
  assert.throws(()=>E.calendar(p,now),/arrival time/);
  a.schedule.start=M.timeOnDay(date,'12:00');a.schedule.durationConfirmed=false;
  assert.match(unfold(E.calendar(p,now).text),/Visit length is unconfirmed/);
});
test('calendar escapes arbitrary text, folds UTF-8 safely and rejects executable source URLs',()=>{
  const a=stop('unicode','10:00',{title:'Café 🦊; music, art \\ notes\r\nBEGIN:VEVENT',url:'javascript:alert(1)'});
  a.schedule.note='日本語 🦊 '.repeat(60)+'\r\nA,B;C\\D';
  const file=E.calendar(plan([a]),now),text=unfold(file.text);
  assert.ok(file.text.endsWith('\r\n'));assert.equal(file.text.replace(/\r\n/g,'').includes('\n'),false);
  for(const line of file.text.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);
  assert.match(text,/SUMMARY:Café 🦊\\; music\\, art \\\\ notes\\nBEGIN:VEVENT/);
  assert.equal(text.split('\r\n').filter(l=>l==='BEGIN:VEVENT').length,1);
  assert.ok(!text.includes('URL:javascript'));assert.ok(!text.includes('\uFFFD'));
  assert.ok(text.includes('日本語 🦊 '.repeat(60)));
});
test('Google and Apple exports have identical calendar content; maps use only valid points',()=>{
  const located=stop('located'),missing=stop('missing',null,{coordinates:null}),invalid=stop('invalid','11:00',{coordinates:[200,30]});
  const p=plan([located,missing,invalid]);
  assert.deepEqual(E.prepare(p,'google-calendar'),E.prepare(p,'apple-calendar'));
  assert.deepEqual(E.prepare(p,'google-maps').skipped.map(i=>i.id),['invalid','missing']);
  assert.throws(()=>E.prepare(p,'bad-format'),/destination/);
});
test('map links preserve schedule order and driving entrance overrides without sending notes',()=>{
  const early=stop('early','09:00'),late=stop('late','15:00'),untimed=stop('untimed',null);
  early.schedule.routeCoordinates=[-97.71,30.21];late.source.coordinates=[-97.72,30.22];untimed.source.coordinates=[-97.73,30.23];
  early.schedule.note='Private note';const p=plan([untimed,late,early]);
  const google=new URL(E.maps(p,'google')[0].url),apple=new URL(E.maps(p,'apple')[0].url);
  assert.equal(google.searchParams.get('origin'),'30.21,-97.71');assert.equal(google.searchParams.get('waypoints'),'30.22,-97.72');assert.equal(google.searchParams.get('destination'),'30.23,-97.73');
  assert.equal(google.searchParams.get('api'),'1');assert.equal(google.searchParams.get('travelmode'),'driving');
  assert.equal(apple.pathname,'/directions');assert.equal(apple.searchParams.get('source'),'30.21,-97.71');assert.deepEqual(apple.searchParams.getAll('waypoint'),['30.22,-97.72']);assert.equal(apple.searchParams.get('destination'),'30.23,-97.73');assert.equal(apple.searchParams.get('avoid'),'tolls');
  assert.ok(!google.href.includes('Private'));assert.ok(!apple.href.includes('Private'));
});
test('long map exports retain every stop and leg while obeying platform limits',()=>{
  for(const count of [1,2,5,6,9,15,16,29,150])for(const service of ['google','apple']){
    const p=plan(Array.from({length:count},(_,i)=>stop('stop-'+i,null,{coordinates:[-97.7+i*.0001,30.2]}))),parts=E.maps(p,service),limit=service==='google'?5:15;
    assert.deepEqual(parts.flatMap((part,i)=>part.items.slice(i?1:0).map(s=>s.id)),p.items.map(s=>s.id));
    for(let i=0;i<parts.length;i++){
      assert.ok(parts[i].items.length<=limit);assert.ok(parts[i].url.length<2048);
      if(i)assert.equal(parts[i-1].items.at(-1).id,parts[i].items[0].id);
      if(service==='google')assert.ok((new URL(parts[i].url).searchParams.get('waypoints')?.split('|').length||0)<=3);
    }
  }
});
test('empty maps have no links; a single stop opens directions from the visitor location',()=>{
  assert.deepEqual(E.maps(plan([]),'google'),[]);
  for(const service of ['google','apple']){
    const url=new URL(E.maps(plan([stop('only')]),service)[0].url);
    assert.equal(url.searchParams.get('destination'),'30.27,-97.74');
    assert.equal(url.searchParams.has(service==='google'?'origin':'source'),false);
  }
});
