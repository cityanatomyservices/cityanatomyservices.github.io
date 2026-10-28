const assert = require('node:assert/strict');
const M = require('../../ticker/model.js');
const mapModel = require('../../chat/explore/model.js');
const categories = { ...M.topics, events: 'Events & Festivals', movies: 'Movies', 'free-cheap': 'Free & cheap' };
const now = Date.parse('2026-10-28T17:00:00-05:00');
const item = (source, n, extra = {}) => ({ title: `${source} ${n}`, source, publisher: source, category: 'headlines', url: `https://example.com/${source}/${n}`, ...extra });
assert.deepEqual(M.preferences({ enabled: [], when: 'bad' }, categories).enabled, [], 'deselecting everything stays empty');
assert.equal(M.preferences({ when: 'bad' }, categories).when, 'week');
assert.deepEqual(M.preferences({ enabled: ['movies', 'movies', 'parks', '__proto__'] }, categories).enabled, ['movies']);
let prefs = M.preferences({ enabled: ['headlines', 'weather'], excludedPublishers: ['kut'] }, categories);
const articles = [...Array.from({length:8}, (_,i) => item('kut',i)), ...Array.from({length:8}, (_,i) => item('chronicle',i)), item('current',0), item('kvue',0)];
assert.deepEqual(M.mix(articles, prefs, categories, now).slice(0,3).map(i => i.publisher), ['chronicle','current','kvue'], 'publishers take turns');
assert.equal(M.mix([item('kut',0, { publisher: undefined, source: 'KUT housing' })], prefs, categories, now).length, 0, 'legacy sources honor preferences');
assert.equal(M.mix([item('kxan',1,{expires:new Date(now-1).toISOString()}),item('kxan',2,{url:'javascript:alert(1)'})], prefs, categories, now).length, 0);
assert.equal(M.mix([item('kxan',1),item('kxan',1)], prefs, categories, now).length, 1);
const feature = (id, extra = {}) => ({ type:'Feature', geometry:{type:'Point',coordinates:[-97.74,30.27]}, properties:{id,title:'Public event',url:'https://example.com/event',venue:'Venue',source:'Organizer',kind:'listing',theme:'events',price:null,priceLabel:'Check admission',start:'2026-10-28T18:00:00-05:00',end:'2026-10-28T20:00:00-05:00',expires:'2026-10-29T00:00:00-05:00',...extra} });
const layers = [{id:'free-cheap'},{id:'events'},{id:'movies'}];
const feeds = new Map([
  ['free-cheap',{features:[feature('a',{kind:'event',price:0})]}],
  ['events',{features:[feature('a'),feature('expired',{expires:'2026-10-28T15:00:00-05:00'}),feature('next-week',{start:'2026-11-10T18:00:00-06:00',end:'2026-11-10T20:00:00-06:00'})]}],
  ['movies',{features:[feature('film',{kind:'movie',showtimes:[{start:'2026-10-28T16:00:00-05:00',url:'https://example.com/past'},{start:'2026-10-28T19:00:00-05:00',url:'https://example.com/future'}]})]}]
]);
prefs=M.preferences({enabled:['free-cheap','events','movies'],when:'tonight'},categories);
let found=M.exploreItems(feeds,layers,prefs,mapModel,now);
assert.equal(found.length,3,'expired and out-of-window events excluded');
assert.equal(found.find(i=>i.category==='movies').starts,'2026-10-28T19:00:00-05:00','advance to next actual showing');
assert.equal(found.find(i=>i.category==='movies').expires,'2026-10-29T00:00:00.000Z','showing expires at start');
assert.equal(M.mix(found,prefs,categories,now).length,2,'shared free/event occurrence appears once');
assert.equal(M.exploreItems(feeds,layers,{...prefs,enabled:[]},mapModel,now).length,0);
assert.equal(M.exploreItems(feeds,layers,{...prefs,enabled:['events'],when:'weekend'},mapModel,now).length,0);
const otherVenue=feature('elsewhere'); otherVenue.geometry.coordinates=[-97.8,30.3]; feeds.get('events').features.push(otherVenue);
found=M.exploreItems(feeds,layers,prefs,mapModel,now);
assert.equal(M.mix(found,prefs,categories,now).length,3,'same title/time at another venue remains distinct');
console.log('Ticker preferences, publisher balance, safety, shared event deduplication, Austin date windows, movie advancement and expiry passed.');
