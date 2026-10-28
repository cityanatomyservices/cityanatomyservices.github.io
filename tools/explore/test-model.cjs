const assert = require('node:assert/strict');
const M = require('../../chat/explore/model.js');
const now = Date.parse('2026-10-31T19:00:00Z');
const make = (id, start, end, price=0, coords=[-97.75,30.27]) => ({type:'Feature', geometry:{type:'Point',coordinates:coords},properties:{id,title:id,url:'https://example.org/'+id,kind:'event',price,start,end,expires:end}});
const rows=[
 make('today','2026-10-31T18:00:00Z','2026-10-31T20:00:00Z'),
 make('sunday','2026-11-01T18:00:00Z','2026-11-01T20:00:00Z',15),
 make('monday','2026-11-02T18:00:00Z','2026-11-02T20:00:00Z',10),
 make('expired','2026-10-30T18:00:00Z','2026-10-30T20:00:00Z'),
 make('next-week','2026-11-07T18:00:00Z','2026-11-07T20:00:00Z'),
];
const opts={when:'week',kind:'all',price:20,where:'all'};
assert.deepEqual(M.filter(rows,opts,now).map(f=>f.properties.id),['today','sunday','monday']);
assert.deepEqual(M.filter(rows,{...opts,when:'weekend'},now).map(f=>f.properties.id),['today','sunday']);
assert.deepEqual(M.filter(rows,{...opts,price:0},now).map(f=>f.properties.id),['today']);
assert.equal(M.filter(rows,{...opts,where:'near',position:null,radius:3},now).length,0);
assert.equal(M.filter(rows,{...opts,where:'map',bounds:[-97.8,30.3,-97.7,30.4]},now).length,0);
assert.equal(M.filter(rows,{...opts,where:'near',position:[-97.75,30.27],radius:1},now).length,3);
const grouped=M.venues(M.filter(rows,opts,now));
assert.equal(grouped.features.length,1); assert.equal(grouped.features[0].properties.eventCount,3);
assert.equal(M.dayKey('2026-11-01T04:30:00Z'),'2026-10-31'); // DST weekend: Austin calendar, not browser timezone.
assert.equal(M.filter(rows,{...opts,when:'today'},Date.parse('2026-11-01T04:30:00Z')).length,0);
assert.ok(M.miles([-97.75,30.27],[-97.75,30.27])===0);
console.log('Map filters: date windows/DST, prices, expired records, bounds, distance, and venue aggregation passed.');
