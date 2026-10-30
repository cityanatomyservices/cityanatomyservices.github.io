/* Editorial snapshots use the actual Explore filters, not a second calendar implementation. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const Model = require('../../chat/explore/model.js');
const ROOT = path.resolve(__dirname, '../..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'chat/explore/config.js'), 'utf8'), context);
const layers = JSON.parse(JSON.stringify(context.window.EXPLORE_LAYERS));
const zone = 'America/Chicago';
const fmt = value => value ? new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
const text = value => value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : value;
const options = when => ({ when, where: 'all', price: '20', kind: 'all', movieType: 'all', query: '', movieSearch: '' });
const directions = coordinates => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(coordinates[1] + ',' + coordinates[0]);
const safeJSON = value => JSON.stringify(value).replace(/</g, '\\u003c');

function snapshot(feeds, when, now = Date.now()) {
  if (!['tonight', 'weekend'].includes(when) || !Number.isFinite(now)) throw new Error('Choose tonight or weekend and a valid export time.');
  const variants = new Map(), selected = new Map(), sources = [], warnings = [];
  for (const layer of layers) {
    const feed = feeds[layer.id];
    if (!feed || feed.type !== 'FeatureCollection' || !Array.isArray(feed.features) || !Number.isFinite(Date.parse(feed.generated))) {
      throw new Error(`Missing or invalid ${layer.title} snapshot; refusing an incomplete export.`);
    }
    const matches = Model.filter(feed.features, options(when), now);
    const originals = new Map(feed.features.map(f => [f.properties?.id, f]));
    for (const f of matches) {
      const id = f.properties.id;
      if (!variants.has(id)) variants.set(id, []);
      variants.get(id).push({ layer, feature: originals.get(id) });
      // Same last-category-wins behavior as Explore's combined results list.
      selected.set(id, { ...f, properties: { ...f.properties, exploreLayer: layer.id } });
    }
    const stale = now - Date.parse(feed.generated) > 6 * 3600000;
    if (stale) warnings.push(`${layer.title}: source snapshot is over six hours old.`);
    for (const source of feed.sources || []) {
      if (!source.ok || source.failures) warnings.push(`${layer.title}: ${source.name} has delayed or incomplete updates.`);
      sources.push([layer.title, fmt(feed.generated), source.name || '', source.url || '', !!source.ok,
        source.failures || 0, source.count ?? '', matches.filter(f => f.properties.source === source.name).length,
        stale ? 'Refresh delayed' : '', JSON.stringify(source), JSON.stringify(Object.fromEntries(Object.entries(feed).filter(([k]) => !['features', 'sources'].includes(k))))]);
    }
  }
  const features = Model.filter([...selected.values()], options(when), now);
  const venueMap = new Map();
  const records = features.map((feature, i) => {
    const key = feature.geometry.coordinates.map(n => n.toFixed(5)).join(',');
    if (!venueMap.has(key)) venueMap.set(key, { number: venueMap.size + 1, coordinates: feature.geometry.coordinates, records: [] });
    const venue = venueMap.get(key);
    const record = { number: i + 1, pin: venue.number, feature, variants: variants.get(feature.properties.id) };
    venue.records.push(record.number);
    return record;
  });
  const [start, end] = Model.timeWindow(when, now);
  return { schemaVersion: 1, when, exported: new Date(now).toISOString(), day: Model.dayKey(start),
    title: `Austin.chat — ${when === 'tonight' ? 'Tonight' : 'Weekend'} — ${Model.dayKey(start)}`,
    windowStart: new Date(start).toISOString(), windowEnd: new Date(end).toISOString(), zone,
    layers, warnings: [...new Set(warnings)], sources, records, venues: [...venueMap.values()] };
}

function tables(data) {
  const listings = [], shows = [], raw = [];
  for (const record of data.records) {
    const p = record.feature.properties;
    const category = layers.find(l => l.id === p.exploreLayer).title;
    const memberships = record.variants.map(v => v.layer.title);
    const prices = [...new Set(record.variants.map(v => `${v.layer.title}: ${v.feature.properties.priceLabel || 'Not published'}`))];
    const coords = record.feature.geometry.coordinates;
    listings.push([record.number, record.pin, category, p.title, '', '', '', '', memberships.join('; '), p.venue || '', p.address || '',
      Model.dayKey(p.start), fmt(p.start), p.endKnown === false ? '' : fmt(p.end), p.endKnown === false ? false : true,
      !!p.allDay, text(p.price), p.priceLabel || '', prices.join('; '), p.description || '', p.conditions || '', p.url,
      directions(coords), (p.showtimes || []).map(s => `${fmt(s.start)}${s.format ? ' · ' + s.format : ''}`).join('\n'),
      (p.showtimes || []).map(s => s.url).join('\n'), (p.tags || []).join('; '), p.source || '', fmt(p.checked), fmt(p.expires),
      coords[1], coords[0], p.kind, p.theme || '', p.id, p.start, p.end, p.checked || '', p.expires]);
    for (const show of p.showtimes || []) shows.push([record.number, record.pin, p.title, p.venue, fmt(show.start),
      show.format || '', show.url, show.start, JSON.stringify(show)]);
    for (const variant of record.variants) {
      const f = variant.feature;
      raw.push({ 'Listing #': record.number, 'Map pin': record.pin, 'Category': variant.layer.title,
        'Feature ID': f.id || '', 'Geometry type': f.geometry.type, 'Longitude': f.geometry.coordinates[0],
        'Latitude': f.geometry.coordinates[1], ...Object.fromEntries(Object.entries(f.properties).map(([k,v]) => ['property.'+k, text(v)])),
        'Complete feature JSON': JSON.stringify(f) });
    }
  }
  const rawHeaders = [...new Set(raw.flatMap(r => Object.keys(r)))];
  if (!rawHeaders.length) rawHeaders.push('Listing #', 'Map pin', 'Category', 'Complete feature JSON');
  const listingHeaders = ['Listing #','Map pin','Primary category','Title','My research','Additional sources','Substack draft','Editorial status','All categories','Venue','Address','Date (Austin)',
    'Starts (Austin)','Ends (Austin)','End time published?','All day?','Price amount','Price details','Prices from all categories',
    'Description','Conditions','Official link','Google directions','Matching movie showtimes','Matching ticket links','Tags',
    'Source','Checked (Austin)','Expires (Austin)','Latitude','Longitude','Kind','Theme','Item ID','Start ISO','End ISO',
    'Checked ISO','Expires ISO'];
  return [
    { name: 'Listings', headers: listingHeaders, rows: listings, wide: ['Title','Description','Conditions','My research','Additional sources','Substack draft'], notes: ['My research','Additional sources','Substack draft','Editorial status'] },
    { name: 'Movie showtimes', headers: ['Listing #','Map pin','Movie','Theater','Starts (Austin)','Format','Ticket link','Start ISO','Complete showtime JSON'], rows: shows, wide: ['Movie','Theater'] },
    { name: 'Map places', headers: ['Map pin','Place','Address','Listing numbers','Categories','Latitude','Longitude','Google directions'], rows: data.venues.map(v => {
      const records = v.records.map(n => data.records[n-1]);
      return [v.number, [...new Set(records.map(r => r.feature.properties.venue))].join('; '), [...new Set(records.map(r => r.feature.properties.address))].join('; '),
        v.records.join(', '), [...new Set(records.map(r => layers.find(l => l.id === r.feature.properties.exploreLayer).title))].join('; '),
        v.coordinates[1], v.coordinates[0], directions(v.coordinates)];
    }), wide: ['Place','Address','Categories'] },
    { name: 'Sources', headers: ['Category','Snapshot (Austin)','Source','Source URL','Healthy?','Failed requests','Source entries','Matches before deduplication','Freshness note','Complete source JSON','Snapshot metadata JSON'], rows: data.sources, wide: ['Source','Freshness note'] },
    { name: 'Collected data', headers: rawHeaders, rows: raw.map(row => rawHeaders.map(k => row[k] ?? '')), wide: ['Complete feature JSON'], technical: true }
  ];
}

function build({ when, out, now = Date.now(), runId }) {
  const destination = path.resolve(out);
  if (destination === ROOT || destination.startsWith(ROOT + path.sep)) throw new Error('Exports must be saved outside the public repository.');
  const feeds = Object.fromEntries(layers.map(l => [l.id, JSON.parse(fs.readFileSync(path.join(ROOT, l.url), 'utf8'))]));
  const data = snapshot(feeds, when, now);
  data.runId = runId || `local-${crypto.randomUUID()}`;
  data.tables = tables(data);
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'snapshot.json'), JSON.stringify(data, null, 2));
  const geo = { type: 'FeatureCollection', generated: data.exported, selection: when,
    features: data.records.map(r => ({ ...r.feature, properties: { ...r.feature.properties, listingNumber: r.number, mapPin: r.pin,
      categories: r.variants.map(v => v.layer.title) } })) };
  fs.writeFileSync(path.join(destination, 'Listings.geojson'), JSON.stringify(geo, null, 2));
  const embedded = safeJSON({ ...data, tables: undefined, sources: undefined });
  fs.writeFileSync(path.join(destination, 'Map.html'), fs.readFileSync(path.join(__dirname, 'map.html'), 'utf8').replace('/*SNAPSHOT_DATA*/null', embedded));
  console.log(`Prepared ${when}: ${data.records.length} listings at ${data.venues.length} map pins across ${layers.length} categories.`);
  for (const warning of data.warnings) console.log('Source note: ' + warning);
  return data;
}

if (require.main === module) {
  const args = process.argv.slice(2), get = name => args[args.indexOf(name) + 1];
  if (!args.includes('--out') || !args.includes('--when')) throw new Error('Usage: node export.cjs --when tonight|weekend --out /private/output');
  build({ when: get('--when'), out: get('--out'), runId: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}` : undefined });
}
module.exports = { snapshot, tables, build, layers, Model, safeJSON };
