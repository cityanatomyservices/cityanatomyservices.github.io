// build-feed.js — reads the four Austin news feeds, puts each story on the map
// when its text names a known Austin place, and writes news/feed.geojson.
//
// Runs daily in GitHub Actions (.github/workflows/build-news-feed.yml) and
// by hand with:  node tools/news/build-feed.js
//
// No dependencies: Node's own fetch, a small RSS reader, plain string matching.
// Nothing here is a language model — a story is placed only when a place name
// from tools/news/gazetteer.json appears in its headline or summary, longest
// name first, whole words only. Stories that name no place are kept with a
// null geometry so the page can still list them.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTLETS = JSON.parse(fs.readFileSync(path.join(__dirname, 'outlets.json'), 'utf8')).outlets;
const GAZ = JSON.parse(fs.readFileSync(path.join(__dirname, 'gazetteer.json'), 'utf8')).places;
const OUT = path.join(ROOT, 'news', 'feed.geojson');
// Some outlets (Connect CRE, The Real Deal) answer 403 to anything that does
// not look like a browser, so the request identifies as one.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 anatomy.city-news';
const MAX_AGE_DAYS = 14;   // KUT's feed is sparse; a week left it with one story

// ── tiny RSS 2.0 / Atom reader ─────────────────────────────────────────────
function textOf(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
}
function stripHtml(s) {
  return s.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“').replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/\s+/g, ' ').trim();
}
function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    let link = textOf(b, 'link');
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ''; }
    items.push({
      title: stripHtml(textOf(b, 'title')),
      link: link.trim(),
      published: textOf(b, 'pubDate') || textOf(b, 'published') || textOf(b, 'updated') || textOf(b, 'dc:date'),
      summary: stripHtml(textOf(b, 'description') || textOf(b, 'summary') || textOf(b, 'content')).slice(0, 400),
    });
  }
  return items;
}

// ── place matching ────────────────────────────────────────────────────────
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Short one-word names ("Manor", "Holly", "Kyle") must appear capitalised, or
// the common noun would pin the story. Longer names match in any case.
const MATCHERS = GAZ.map((p) => {
  const short = !/\s/.test(p.name) && p.name.length < 9;
  return { p, re: new RegExp(`(^|[^A-Za-z])${escapeRe(p.name)}([^A-Za-z]|$)`, short ? '' : 'i') };
});
function place(text) {
  for (const m of MATCHERS) if (m.re.test(text)) return m.p;   // longest name first
  return null;
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400e3;
  const features = [];
  const seen = new Set();
  for (const o of OUTLETS) {
    let xml = '';
    try {
      const r = await fetch(o.url, { headers: { 'user-agent': UA, 'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8' }, signal: AbortSignal.timeout(20000) });
      if (r.status === 403) {
        // Cloudflare challenges Node's TLS fingerprint on a few sites (Connect
        // CRE) but lets curl through with the same user-agent. Same request,
        // different client; curl is on every GitHub runner.
        xml = execFileSync('curl', ['-sL', '--max-time', '20', '-A', UA, o.url], { encoding: 'utf8', maxBuffer: 16e6 });
        if (!xml.trim()) throw new Error('HTTP 403 (curl fallback empty too)');
      } else {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        xml = await r.text();
      }
    } catch (e) {
      console.log(`  ${o.name}: skipped (${e.message})`);   // fail-soft: one dead feed drops one outlet
      continue;
    }
    let n = 0;
    for (const it of parseFeed(xml)) {
      if (!it.title || !it.link || seen.has(it.link)) continue;
      const when = Date.parse(String(it.published).trim());
      if (Number.isFinite(when) && when < cutoff) continue;
      if (n >= o.max) break;
      seen.add(it.link); n++;
      const hit = place(`${it.title} ${it.summary}`);
      features.push({
        type: 'Feature',
        geometry: hit ? { type: 'Point', coordinates: [hit.lng, hit.lat] } : null,
        properties: {
          title: it.title, link: it.link, outlet: o.name, group: o.group || 'news', color: o.color,
          published: Number.isFinite(when) ? new Date(when).toISOString() : null,
          summary: it.summary,
          place: hit ? hit.name : null, placeKind: hit ? hit.kind : null,
        },
      });
    }
    console.log(`  ${o.name}: ${n} stories`);
  }
  features.sort((a, b) => (b.properties.published || '').localeCompare(a.properties.published || ''));
  const placed = features.filter((f) => f.geometry).length;
  const fc = { type: 'FeatureCollection', generated: new Date().toISOString(), placed, total: features.length, features };
  fs.writeFileSync(OUT, JSON.stringify(fc, null, 1) + '\n');
  console.log(`${features.length} stories, ${placed} placed -> ${path.relative(ROOT, OUT)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
