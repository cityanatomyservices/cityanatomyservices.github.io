// build-gazetteer.js — turns the austin.chat place data into one small lookup
// file of Austin place names with a point each, used by build-feed.js to put
// a news story on the map.
//
// Source: the archived austin.chat repo, data/<bucket>/hotspots.json (1,202
// curated places, OpenStreetMap lineage). Run by hand when that data changes:
//
//   node tools/news/build-gazetteer.js /mnt/c/Dev/projects/cityanatomyservices/austin-chat-archive/data
//
// Output: tools/news/gazetteer.json  (committed; ~60 KB). Merges tools/news/landmarks.json first.
'use strict';
const fs = require('fs');
const path = require('path');

const dataDir = process.argv[2];
if (!dataDir) { console.error('usage: node build-gazetteer.js <austin-chat-archive/data>'); process.exit(1); }

// Buckets worth matching in news text. Chains (H-E-B, Target...) and
// transient event lists are left out: they would match everything or nothing.
const BUCKETS = {
  neighborhoods: 'neighborhood', parks: 'park', campuses: 'campus', capital: 'landmark',
  museums: 'museum', artgalleries: 'gallery', culturespots: 'landmark', sports: 'venue',
  airport: 'airport', malls: 'mall', golf: 'golf course', clinics: 'clinic', hotels: 'hotel',
  pubchat: 'venue', concertsshows: 'venue',
};
// Names too generic to pin a story on.
// ...and neighbourhood names that are also first names or plain words.
const SKIP = new Set(['downtown', 'austin', 'the domain', 'central', 'north', 'south', 'east', 'west',
  'holly', 'jester', 'hancock', 'dawson', 'gateway', 'highland', 'chestnut', 'wooten', 'westgate']);

function centroid(coords) {
  // Average of the outer ring's vertices — plenty for "where is this place".
  let ring = coords;
  while (Array.isArray(ring[0]) && Array.isArray(ring[0][0])) ring = ring[0];
  const n = ring.length;
  const s = ring.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [s[0] / n, s[1] / n];
}

function pointOf(g) {
  if (!g) return null;
  if (g.center) return g.center;                     // circle: {center:[lng,lat], radiusMeters}
  if (g.coordinates) return centroid(g.coordinates); // polygon / multipolygon
  if (g.geometry && g.geometry.coordinates) return centroid(g.geometry.coordinates);
  return null;
}

const out = [];
const seen = new Set();
// Hand-kept landmarks first (tools/news/landmarks.json): the names news uses
// that the curated data spells differently or not at all.
for (const l of JSON.parse(fs.readFileSync(path.join(__dirname, 'landmarks.json'), 'utf8')).places) {
  seen.add(l.name.toLowerCase());
  out.push({ name: l.name, kind: l.kind, lng: l.lng, lat: l.lat });
}
for (const [bucket, kind] of Object.entries(BUCKETS)) {
  const f = path.join(dataDir, bucket, 'hotspots.json');
  if (!fs.existsSync(f)) continue;
  const list = JSON.parse(fs.readFileSync(f, 'utf8')).hotspots || [];
  for (const h of list) {
    const name = String(h.title || '').trim();
    const pt = pointOf(h.geofence);
    if (!name || !pt || name.length < 5) continue;
    if (SKIP.has(name.toLowerCase())) continue;
    // A one-word bar name like "Frank" or "Plush" matches people and adjectives,
    // not places. Venues must be two words or a long distinctive word.
    if ((kind === 'venue' || kind === 'hotel' || kind === 'gallery') && !/\s/.test(name) && name.length < 9) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;   // first bucket wins (neighborhoods come first)
    seen.add(key);
    out.push({ name, kind, lng: +pt[0].toFixed(5), lat: +pt[1].toFixed(5) });
  }
}
// Longest names first so "Zilker Metropolitan Park" beats "Zilker" when both match.
out.sort((a, b) => b.name.length - a.name.length);
const dest = path.join(__dirname, 'gazetteer.json');
fs.writeFileSync(dest, JSON.stringify({ generated: new Date().toISOString(), places: out }, null, 0) + '\n');
console.log(`${out.length} places -> ${dest}`);
