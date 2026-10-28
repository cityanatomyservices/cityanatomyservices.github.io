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
const film = make('film', '2026-10-31T18:00:00Z', '2026-10-31T23:00:01Z');
Object.assign(film.properties, {kind:'movie', price:null, venue:'IMAX theater', tags:['imax'], showtimes:[
  {start:'2026-10-31T18:00:00Z', url:'https://example.org/early'},
  {start:'2026-10-31T23:00:00Z', url:'https://example.org/late'}
]});
const mixed = M.filter([...rows, film], {...opts,price:0,kind:'activity'},now);
assert.deepEqual(mixed.map(f=>f.properties.id),['film'],'Free & cheap filters do not hide movie listings');
assert.equal(mixed[0].properties.showtimes.length,1,'started screenings disappear');
assert.equal(mixed[0].properties.start,'2026-10-31T23:00:00Z');
assert.equal(film.properties.showtimes.length,2,'filtering does not mutate the snapshot');
assert.equal(M.filter([film],{...opts,movieType:'dine-in'},now).length,0);
assert.equal(M.filter([film],{...opts,movieSearch:'IMAX'},now).length,1);
assert.deepEqual(M.filter([...rows,film],{...opts,movieSearch:'not-a-film'},now).map(f=>f.properties.id),['today','sunday','monday']);
assert.equal(M.filter([film],opts,Date.parse('2026-10-31T23:00:00Z')).length,0);
assert.equal(M.venues(mixed).features[0].properties.label,'M');
const unsafe = structuredClone(film);unsafe.properties.showtimes[1].url='javascript:alert(1)';
assert.equal(M.filter([unsafe],opts,now).length,0);
console.log('Movies: independent filters, grouped showtimes, expiry, safe links, search and theater types passed.');

// New category and permanent-place behavior, including DST overnight windows.
const park={type:'Feature',geometry:{type:'Point',coordinates:[-97.75,30.27]},properties:{id:'park',title:'Neighborhood Park',venue:'Neighborhood Park',kind:'park',theme:'parks',url:'https://www.austintexas.gov/parks',price:null}};
for(const when of ['now','tonight','today','weekend','week']) {
  assert.equal(M.filter([park],{...opts,when,price:0,kind:'offer',movieType:'imax'},now).length,1);
}
assert.equal(M.filter([park],{...opts,query:'neighborhood'},now).length,1);
assert.equal(M.filter([park],{...opts,query:'missing'},now).length,0);
assert.equal(M.filter([park],{...opts,where:'map',bounds:[-97.8,30.3,-97.7,30.4]},now).length,0);
const concert=make('concert','2026-10-31T23:30:00Z','2026-11-01T07:30:00Z');
Object.assign(concert.properties,{kind:'listing',theme:'live-music',price:null});
assert.equal(M.filter([concert],{...opts,price:0,kind:'offer'},now).length,1);
assert.equal(M.filter([concert],{...opts,when:'now'},now).length,0);
assert.equal(M.filter([concert],{...opts,when:'now'},Date.parse('2026-10-31T22:00:00Z')).length,1);
assert.equal(M.filter([concert],{...opts,when:'tonight'},now).length,1);
assert.deepEqual(M.timeWindow('tonight',now).map(n=>new Date(n).toISOString()),['2026-10-31T23:00:00.000Z','2026-11-01T09:00:00.000Z']);
assert.deepEqual(M.timeWindow('tonight',Date.parse('2026-11-01T07:00:00Z')),M.timeWindow('tonight',now),'after midnight stays with the same evening through the DST repeat');
assert.deepEqual(M.timeWindow('tonight',Date.parse('2026-03-07T19:00:00Z')).map(n=>new Date(n).toISOString()),['2026-03-08T00:00:00.000Z','2026-03-08T08:00:00.000Z']);
assert.equal(M.filter([film],{...opts,when:'now'},now).length,0,'movie sessions must actually start inside the selected window');
assert.equal(M.filter([film],{...opts,when:'tonight'},now).length,1);
assert.equal(M.filter([concert],{...opts,when:'tonight'},Date.parse(concert.properties.end)).length,0);
console.log('New categories: parks ignore dates/prices but respect location/search; now, tonight, DST and movie time windows passed.');

// Nearby markets remain discoverable by their city/address without changing
// the visitor's map-area or distance filter.
const market=make('Sunshine','2026-10-31T15:00:00Z','2026-10-31T20:00:00Z',0,[-97.688743,30.634108]);
Object.assign(market.properties,{kind:'listing',theme:'pop-up-markets',venue:'Floor & Decor parking lot',address:'1101 S Interstate 35, Georgetown TX',price:null});
assert.equal(M.filter([market],{...opts,query:'Georgetown'},now).length,1);
assert.equal(M.filter([market],{...opts,query:'Interstate 35'},now).length,1);
assert.equal(M.filter([market],{...opts,query:'Georgetown',where:'near',position:[-97.75,30.27],radius:3},now).length,0);
assert.equal(M.filter([market],{...opts,where:'map',bounds:[-97.8,30.2,-97.7,30.4]},now).length,0);
console.log('Markets: city/address search, map-area filtering and nearby distance passed.');
