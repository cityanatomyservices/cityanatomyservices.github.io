const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../../chat/explore/model.js'),C=require('../../classifieds/model.js'),H=require('../../chat/city-hall/model.js');
const now=Date.parse('2026-11-04T12:00:00-06:00');
test('This week uses past posting dates and upcoming meeting dates in Austin',()=>{
  const [pastStart,pastEnd]=D.dateWindow({when:'week'},now,true),[nextStart,nextEnd]=D.dateWindow({when:'week'},now);
  assert.equal(new Date(pastStart).toISOString(),'2026-10-29T05:00:00.000Z');
  assert.equal(new Date(pastEnd).toISOString(),'2026-11-05T06:00:00.000Z');
  assert.equal(new Date(nextStart).toISOString(),'2026-11-04T06:00:00.000Z');
  assert.equal(new Date(nextEnd).toISOString(),'2026-11-11T06:00:00.000Z');
});
test('exact dates span the full Austin day through both DST changes',()=>{
  for(const [date,hours] of [['2026-11-01',25],['2026-03-08',23]]){
    const [first,last]=D.dateWindow({when:'date',date},now);assert.equal((last-first)/3600000,hours);
    const ads=[{id:'start',created_at:new Date(first).toISOString()},{id:'end',created_at:new Date(last).toISOString()},{id:'inside',created_at:new Date(last-1).toISOString()}];
    assert.deepEqual(C.filter(ads,{first,last,sort:'asc'}).map(a=>a.id),['start','inside']);
  }
});
test('classified dates sort original posts, not later edits, and all dates includes old ads',()=>{
  const ads=[{id:'old',created_at:'2025-01-01T12:00:00Z',updated_at:'2026-11-04T12:00:00Z'},{id:'new',created_at:'2026-11-04T12:00:00Z'}, {id:'invalid',created_at:'not a date'}];
  assert.deepEqual(C.filter(ads).map(a=>a.id),['new','old']);assert.deepEqual(C.filter(ads,{sort:'asc'}).map(a=>a.id),['old','new']);
  const [first,last]=D.dateWindow({when:'week'},now,true);assert.deepEqual(C.filter(ads,{first,last}).map(a=>a.id),['new']);
});
test('City Hall retains date-only meetings and filters archived news by publication date',()=>{
  const base={expires:'2026-11-05T20:00:00Z',districts:[],scope:'citywide',title:'Record'};
  const rows=[{...base,id:'tomorrow',category:'meetings',date:'2026-11-05T00:00:00-06:00',dateOnly:true},{...base,id:'yesterday',category:'announcements',date:'2026-11-03T10:00:00-06:00'}, {...base,id:'older',category:'announcements',date:'2026-10-25T10:00:00-05:00'}];
  assert.deepEqual(H.filter(rows,{category:'meetings',when:'date',date:'2026-11-05'},now).map(r=>r.id),['tomorrow']);
  assert.deepEqual(H.filter(rows,{category:'announcements',when:'week'},now).map(r=>r.id),['yesterday']);
  assert.deepEqual(H.filter(rows,{category:'announcements',when:'all',sort:'asc'},now).map(r=>r.id),['older','yesterday']);
  assert.equal(H.filter(rows,{category:'announcements',when:'date',date:'2026-10-25'},now).length,1);
});
