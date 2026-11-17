const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectFeed, reviewWarnings } = require('./check-health.cjs');
const now = Date.parse('2026-11-17T18:00:00Z');
const iso = hours => new Date(now + hours * 3600000).toISOString();
const item = (overrides = {}) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [-97.74, 30.27] },
  properties: { id: 'test', title: 'Test', url: 'https://example.org/event', source: 'Library',
    kind: 'event', price: 0, start: iso(1), end: iso(2), expires: iso(2), ...overrides } });
const feed = (features = [item()], overrides = {}) => ({ type: 'FeatureCollection', generated: iso(0), features,
  sources: [{ name: 'Library', ok: true, failures: 0, count: features.length }], ...overrides });

test('fresh-looking snapshot cannot hide expired listings or failed sources', () => {
  const r = inspectFeed('free-cheap', feed([item({ expires: iso(-1) })], {
    sources: [{ name: 'Library', ok: false, count: 197, failures: 1, error: 'timed out' }]
  }), now);
  assert.equal(r.active, 0);
  assert.equal(r.sources[0].active, 0);
  assert.ok(r.issues.includes('No active listings'));
  assert.ok(r.issues.some(s => s.includes('timed out')));
});
test('detects partial failures even if a source was labelled OK', () => {
  const r = inspectFeed('free-cheap', feed([item()], { sources: [{ name: 'Library', ok: true, failures: 1 }] }), now);
  assert.equal(r.active, 1);
  assert.equal(r.issues.length, 1);
});
test('existing CAPTCHA errors are summarized without challenge details', () => {
  const r = inspectFeed('live-comedy', feed([item()], { sources: [{ name: 'Library', ok: false,
    error: 'markup <meta content="/.well-known/sgcaptcha/?y=private-challenge">' }] }), now);
  assert.match(r.issues[0], /requires a CAPTCHA/);
  assert.ok(!r.issues[0].includes('private-challenge'));
});
test('counts upcoming movie screenings and catches stale snapshots', () => {
  const movie = item({ kind: 'movie', price: null, showtimes: [{ start: iso(-1), url: 'https://example.org/ticket' }] });
  assert.equal(inspectFeed('movies', feed([movie]), now).active, 0);
  movie.properties.showtimes.push({ start: iso(1), url: 'https://example.org/ticket' });
  assert.equal(inspectFeed('movies', feed([movie]), now).active, 1);
  assert.match(inspectFeed('movies', feed([movie], { generated: iso(-7) }), now).issues[0], /Refresh delayed/);
});
test('validates feed structure, separates week from all dates, and permits a healthy empty source', () => {
  assert.equal(inspectFeed('bad', {}, now).issues.length, 1);
  const r = inspectFeed('events', feed([item({ start: iso(192), end: iso(193), expires: iso(24) })], {
    sources: [{ name: 'Library', ok: true }, { name: 'Seasonal', ok: true, count: 0 }]
  }), now);
  assert.equal(r.active, 1); assert.equal(r.week, 0); assert.deepEqual(r.issues, []);
});
test('curated deadlines are reported without being renewed', () => {
  const items = [{ title: 'Expired', validUntil: iso(-1) }, { title: 'Soon', validUntil: iso(48) }, { title: 'Later', validUntil: iso(96) }];
  const before = JSON.stringify(items), warnings = reviewWarnings(items, now);
  assert.equal(warnings.length, 2); assert.match(warnings[0], /overdue/);
  assert.equal(JSON.stringify(items), before);
});
