import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchAddresses,addressQuery,METRO_COUNTIES} from '../../supabase/functions/geofences/address-search.mjs';
const response=data=>new Response(JSON.stringify(data));
const point=(county,city='Austin',extra={})=>({attributes:{A1:'TX',A2:county,FULL_ADDR:'301 W 2ND ST',Post_Comm:city,Post_Code:'78701',...extra},geometry:{x:-97.74,y:30.26}});

test('suggestions admit all five metro counties and reject outside, missing and invalid locations',async()=>{
 const features=METRO_COUNTIES.map((c,i)=>point(c,'Metro City '+i));
 features.push(point('Llano'),point('Burnet'),point('Dallas'),point('Travis','Austin',{A1:'MN'}),point(''),{...point('Travis'),geometry:{x:0,y:0}},point('Travis','Austin',{FULL_ADDR:'W 2ND ST'}));
 const matches=await searchAddresses('301 W 2',async()=>response({features}),true);
 assert.equal(matches.length,5);assert.deepEqual(new Set(matches.map(m=>m.county)),new Set(METRO_COUNTIES));
});

test('partial search is bounded, escapes SQL text, normalizes street words and deduplicates buildings',async()=>{
 let url;
 const matches=await searchAddresses("301 West O'Connor Street",async u=>{url=u;return response({features:[point('Williamson','Taylor'),point('Travis'),point('Travis')]});},true);
 assert.equal(matches.length,2);assert.match(matches[0].label,/, Austin, TX/);
 assert.equal(url.searchParams.get('resultRecordCount'),'40');assert.equal(url.searchParams.get('outSR'),'4326');
 const where=url.searchParams.get('where');assert.match(where,/Add_Number = 301/);assert.ok(where.includes("'O''CONNOR%'"));assert.ok(where.includes("'W %'"));assert.ok(where.includes("'ST%'"));assert.ok(where.includes("UPPER(A2) IN ('TRAVIS','WILLIAMSON','HAYS','BASTROP','CALDWELL')"));
 assert.equal(addressQuery('301'),null);assert.equal(addressQuery('Austin'),null);
 assert.ok(!addressQuery('301 %_% Main').includes('%_%'));
});

test('full-address Census fallback verifies county and state before returning any result',async()=>{
 const requested=[];
 const matches=await searchAddresses('301 W 2nd St Austin TX',async url=>{
  requested.push(url);
  if(requested.length===1)return response({features:[]});
  const make=(STATE,COUNTY)=>({matchedAddress:'301 W 2ND ST, AUSTIN, TX',coordinates:{x:-97.74,y:30.26},geographies:{Counties:[{STATE,COUNTY}]}});
  return response({result:{addressMatches:[make('48','453'),make('48','491'),make('48','209'),make('48','021'),make('48','055'),make('48','053'),make('27','453'),{matchedAddress:'Unknown county',coordinates:{x:-97.74,y:30.26}}]}});
 });
 assert.equal(matches.length,5);assert.match(requested[1].pathname,/geographies/);assert.equal(requested[1].searchParams.get('layers'),'Counties');
});

test('autocomplete never performs nationwide fallback; lookup errors are not shown as empty results',async()=>{
 let count=0;
 assert.deepEqual(await searchAddresses('301 W 2',async()=>{count++;return response({features:[]});},true),[]);assert.equal(count,1);
 await assert.rejects(searchAddresses('301 W 2',async()=>response({error:{message:'Unavailable'}}),true));
 await assert.rejects(searchAddresses('301 W 2',async()=>new Response('',{status:503}),true));
 assert.deepEqual(await searchAddresses('301',async()=>{throw Error('Must not fetch');},true),[]);
});
