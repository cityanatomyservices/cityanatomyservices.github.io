'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { snapshot, tables, layers, Model, build, safeJSON } = require('./export.cjs');
const now = Date.parse('2026-10-30T17:00:00Z');
const iso = n => new Date(n).toISOString();
function feeds(){return Object.fromEntries(layers.map(l=>[l.id,{type:'FeatureCollection',generated:iso(now),sources:[{name:'Venue',url:'https://example.org',ok:true,count:1,failures:0}],features:[]} ]));}
function feature(id,extra={}){return {type:'Feature',id,geometry:{type:'Point',coordinates:[-97.74,30.27]},properties:{id,title:'Show '+id,venue:'Venue',address:'1 Main St',kind:'listing',theme:'events',url:'https://example.org/'+id,start:'2026-10-30T23:00:00Z',end:'2026-10-31T01:00:00Z',endKnown:true,expires:iso(now+86400000),checked:iso(now),source:'Venue',price:null,priceLabel:'Check admission',...extra}};}

test('all categories, no UI page-size limit, same combined results as Explore',()=>{
 const data=feeds();for(let i=0;i<75;i++)data.events.features.push(feature(String(i)));
 const result=snapshot(data,'tonight',now);
 assert.equal(result.records.length,75);assert.equal(result.venues.length,1);
 const expected=Model.filter(data.events.features,{when:'tonight',where:'all',price:'20',kind:'all',movieType:'all'},now);
 assert.deepEqual(result.records.map(r=>r.feature.properties.id),expected.map(f=>f.properties.id));
 assert.equal(result.venues[0].records.length,75);
});
test('deduplication preserves both source variants, collected price and arbitrary new fields',()=>{
 const data=feeds();data['free-cheap'].features=[feature('same',{kind:'event',price:0,priceLabel:'Free',extraCollected:{detail:'keep me'}})];
 data.events.features=[feature('same')];
 const result=snapshot(data,'tonight',now),sheets=tables(result);
 assert.equal(result.records.length,1);assert.equal(result.records[0].feature.properties.exploreLayer,'events');
 assert.equal(result.records[0].variants.length,2);
 const raw=sheets.find(s=>s.name==='Collected data');assert.equal(raw.rows.length,2);
 assert(raw.headers.includes('property.extraCollected'));
 const listing=sheets[0];assert.equal(listing.rows[0][listing.headers.indexOf('All categories')],'Free & cheap; Events & Festivals');
 assert.match(listing.rows[0][listing.headers.indexOf('Prices from all categories')],/Free & cheap: Free/);
});
test('movie export filters shows but preserves every original showtime in collected data',()=>{
 const data=feeds();const times=['2026-10-30T21:00:00Z','2026-10-30T23:30:00Z','2026-10-31T04:30:00Z','2026-10-31T09:00:00Z'];
 data.movies.features=[feature('movie',{kind:'movie',start:times[0],end:'2026-10-31T10:00:00Z',endKnown:false,showtimes:times.map(start=>({start,url:'https://tickets.example/'+start,format:'IMAX'}))})];
 const result=snapshot(data,'tonight',now),sheets=tables(result);
 assert.equal(result.records[0].feature.properties.showtimes.length,2);
 assert.equal(result.records[0].variants[0].feature.properties.showtimes.length,4);
 assert.equal(sheets.find(s=>s.name==='Movie showtimes').rows.length,2);
 assert.equal(sheets[0].rows[0][sheets[0].headers.indexOf('Ends (Austin)')],'');
 assert.equal(data.movies.features[0].properties.showtimes.length,4,'source objects are not mutated');
});
test('Weekend uses Saturday and Sunday, spans DST, and excludes Friday',()=>{
 const data=feeds();data.events.features=[feature('friday'),feature('saturday',{start:'2026-10-31T19:00:00Z',end:'2026-10-31T21:00:00Z'}),feature('sunday',{start:'2026-11-01T19:00:00Z',end:'2026-11-01T21:00:00Z'})];
 const result=snapshot(data,'weekend',now);
 assert.deepEqual(result.records.map(r=>r.feature.properties.id),['saturday','sunday']);
 assert.equal((Date.parse(result.windowEnd)-Date.parse(result.windowStart))/3600000,49);
});
test('expired data is excluded; missing categories fail; delayed sources are explicit',()=>{
 const data=feeds();data.events.features=[feature('expired',{expires:iso(now-1)}),feature('fresh')];
 data.events.generated=iso(now-7*3600000);data.events.sources[0].ok=false;
 const result=snapshot(data,'tonight',now);
 assert.equal(result.records.length,1);assert.equal(result.warnings.length,2);
 delete data.movies;assert.throws(()=>snapshot(data,'tonight',now),/incomplete export/);
});
test('late-night time rules match main map and research columns start blank',()=>{
 const data=feeds(),late=Date.parse('2026-10-31T06:00:00Z');
 const result=snapshot(data,'tonight',late);assert.equal(result.day,'2026-10-30');
 data.events.features=[feature('fresh')];const listing=tables(snapshot(data,'tonight',now))[0];
 assert.deepEqual(listing.headers.slice(4,8),['My research','Additional sources','Substack draft','Editorial status']);
 assert.deepEqual(listing.rows[0].slice(4,8),['','','','']);
});
test('JSON cannot close the embedded script, and exports cannot enter the public repository',()=>{
 const bad={title:'</script><img src=x onerror=alert(1)>'};const json=safeJSON(bad);
 assert(!json.includes('</script>'));assert.deepEqual(JSON.parse(json),bad);
 assert.throws(()=>build({when:'tonight',out:__dirname}),/outside the public repository/);
});
