/* Read-only checks against the same validation/filter model used by Explore. */
const fs = require('node:fs');
const path = require('node:path');
const model = require('../../chat/explore/model.js');
const root = path.resolve(__dirname, '../..');
const feeds = ['free-cheap', 'movies', 'live-music', 'live-comedy', 'pop-up-markets', 'events-festivals'];
const options = { when: 'all', price: 20, kind: 'all', where: 'all' };

function inspectFeed(name, feed, now = Date.now(), sourceAlerts = 'error') {
  const issues = [], warnings = [];
  if (feed?.type !== 'FeatureCollection' || !Array.isArray(feed.features) ||
      !Array.isArray(feed.sources) || !feed.sources.length ||
      !feed.sources.every(s => typeof s?.name === 'string' && s.name.trim() && typeof s.ok === 'boolean') ||
      !Number.isFinite(Date.parse(feed.generated))) {
    return { name, active: 0, week: 0, issues: ['Invalid feed or missing source health'], warnings, sources: [] };
  }
  const age = (now - Date.parse(feed.generated)) / 3600000;
  if (age > 6) issues.push(`Refresh delayed: snapshot is ${age.toFixed(1)} hours old (limit 6h)`);
  if (age < -1 / 12) issues.push('Snapshot timestamp is in the future');
  const active = model.filter(feed.features, options, now);
  const week = model.filter(feed.features, { ...options, when: 'week' }, now);
  if (!active.length) issues.push('No active listings');
  const sourceMessages = sourceAlerts === 'warn' ? warnings : issues;
  const sources = feed.sources.map(source => {
    const count = active.filter(f => f.properties.source === source.name).length;
    const failed = source.ok !== true || Number(source.failures || 0) > 0;
    const error = source.error?.includes('/.well-known/sgcaptcha/')
      ? 'calendar host requires a CAPTCHA for this runner; host approval or an approved feed is needed'
      : source.error;
    if (failed) sourceMessages.push(`${source.name}: ${error || 'source update unavailable'} (${count} active listings)`);
    return { name: source.name, active: count, ok: !failed };
  });
  if (feed.sources.every(source => !source.ok)) issues.push('All sources failed to update');
  const horizon = Math.max(...active.map(f => Date.parse(f.properties.expires)), 0);
  if (active.length && horizon - now < 3 * 3600000) warnings.push('All active listings expire within 3 hours');
  return { name, generated: feed.generated, age, total: feed.features.length, active: active.length,
    week: week.length, sources, issues, warnings };
}

function reviewWarnings(items, now = Date.now()) {
  return items.flatMap(item => {
    const until = Date.parse(item.validUntil);
    if (!Number.isFinite(until) || until <= now) return [`${item.title}: curated review overdue; listings remain hidden until reverified`];
    if (until - now <= 72 * 3600000) return [`${item.title}: curated review due by ${item.validUntil}`];
    return [];
  });
}

const escape = value => String(value).replace(/[\r\n|<>]/g, ' ');
function report(results, reviews, target, now) {
  const lines = [`## Explore feed health`, '', `Checked ${new Date(now).toISOString()} against ${target}.`, '',
    '| Category | Snapshot age | Active | This week | Status |', '| --- | ---: | ---: | ---: | --- |'];
  for (const r of results) {
    const status = r.issues.length ? 'FAIL' : r.warnings.length ? 'WARN' : 'OK';
    lines.push(`| ${r.name} | ${Number.isFinite(r.age) ? r.age.toFixed(1) + 'h' : '?'} | ${r.active} | ${r.week || 0} | ${status} |`);
  }
  lines.push('', 'Active counts apply expiry and date validation, before visitor search/location filters.', '');
  for (const r of results) {
    for (const issue of r.issues) lines.push(`- **${r.name}:** ${escape(issue)}`);
    for (const warning of r.warnings) lines.push(`- ${r.name}: ${escape(warning)}`);
  }
  lines.push('', '### Source coverage', '', '| Category | Source | Active | Update |', '| --- | --- | ---: | --- |');
  for (const r of results) for (const s of r.sources) lines.push(`| ${r.name} | ${escape(s.name)} | ${s.active} | ${s.ok ? 'OK' : 'FAILED'} |`);
  if (reviews.length) lines.push('', '### Curated activities needing review', '', ...reviews.map(s => '- ' + escape(s)));
  lines.push('', 'Recovery: run **Refresh Explore map layers**, then check **Publish Austin.chat** and this report.',
    'A failed source must recover or be investigated; do not extend cached expiry timestamps.', '');
  return lines.join('\n');
}

async function loadFeed(name, base) {
  if (!base) return JSON.parse(fs.readFileSync(path.join(root, 'chat/data/explore', name + '.geojson'), 'utf8'));
  const url = new URL(`/chat/data/explore/${name}.geojson`, base);
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return await res.json();
    } catch (e) {
      error = e;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  throw error;
}

async function main() {
  const base = process.argv[2], now = Date.now();
  if (base && !/^https?:\/\//.test(base)) throw new Error('Usage: node tools/explore/check-health.cjs [https://austin.chat]');
  const results = await Promise.all(feeds.map(async name => {
    try { return inspectFeed(name, await loadFeed(name, base), now, process.env.EXPLORE_SOURCE_ALERTS); }
    catch (e) { return { name, active: 0, issues: [e.message], warnings: [], sources: [] }; }
  }));
  const reviews = reviewWarnings(JSON.parse(fs.readFileSync(path.join(__dirname, 'curated.json'), 'utf8')), now);
  const text = report(results, reviews, base || 'local checkout', now);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  if (process.env.GITHUB_ACTIONS) {
    for (const r of results) {
      for (const issue of r.issues) console.log(`::error::${escape(r.name + ': ' + issue).replace(/%/g, '%25')}`);
      for (const warning of r.warnings) console.log(`::warning::${escape(r.name + ': ' + warning).replace(/%/g, '%25')}`);
    }
    for (const warning of reviews) console.log(`::warning::${escape(warning)}`);
  }
  if (results.some(r => r.issues.length)) process.exitCode = 1;
}
module.exports = { inspectFeed, reviewWarnings, report };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
