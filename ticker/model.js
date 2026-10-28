/* Shared, deterministic ticker selection. No storage, network or map side effects. */
(function (root) {
  'use strict';
  const topics = {
    headlines: 'Austin headlines', culture: 'Food, arts & culture', weather: 'Weather',
    sports: 'Texas sports', property: 'Property', city: 'City updates',
    transport: 'Getting around', national: 'National / Austin', stocks: 'Austin-area stocks'
  };
  const publishers = {
    chronicle: 'Austin Chronicle', current: 'Austin Current', 'community-impact': 'Community Impact',
    kut: 'KUT', kxan: 'KXAN', kvue: 'KVUE', monthly: 'Austin Monthly',
    'daily-texan': 'The Daily Texan', city: 'City of Austin', tribune: 'Texas Tribune'
  };
  const defaults = [...Object.keys(topics).filter(id => id !== 'stocks'), 'free-cheap', 'events'];
  function preferences(saved, categories) {
    return {
      enabled: [...new Set((Array.isArray(saved?.enabled) ? saved.enabled : defaults).filter(id => Object.hasOwn(categories, id)))],
      excludedPublishers: [...new Set((Array.isArray(saved?.excludedPublishers) ? saved.excludedPublishers : []).filter(id => Object.hasOwn(publishers, id)))],
      when: ['now', 'tonight', 'weekend', 'week'].includes(saved?.when) ? saved.when : 'week'
    };
  }
  function publisher(item) {
    if (item.publisher) return item.publisher;
    // Older deployed snapshots still work during the transition to publisher IDs.
    if (/^KUT\b/.test(item.source || '')) return 'kut';
    return { KXAN: 'kxan', 'City of Austin': 'city', 'Texas Tribune': 'tribune' }[item.source];
  }
  function valid(item, categories, now = Date.now()) {
    try {
      return Boolean(item && typeof item.title === 'string' && item.title.trim() && Object.hasOwn(categories, item.category)
        && ['https:', 'http:'].includes(new URL(item.url).protocol)
        && (!item.starts || Number.isFinite(Date.parse(item.starts)))
        && (!item.published || Number.isFinite(Date.parse(item.published)))
        && (!item.expires || Date.parse(item.expires) > now));
    } catch (_) { return false; }
  }
  function interleave(groups) {
    const result = [], length = Math.max(0, ...groups.map(group => group.length));
    for (let i = 0; i < length; i++) for (const group of groups) if (group[i]) result.push(group[i]);
    return result;
  }
  function mix(items, prefs, categories, now = Date.now()) {
    const enabled = new Set(prefs.enabled), excluded = new Set(prefs.excludedPublishers), seen = new Set();
    const filtered = items.filter(item => {
      if (!valid(item, categories, now) || !enabled.has(item.category) || excluded.has(publisher(item))) return false;
      const key = item.occurrence || item.url;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    return interleave(Object.keys(categories).map(category => {
      const group = filtered.filter(item => item.category === category);
      if (!['headlines', 'culture'].includes(category)) return group;
      // A larger publisher's feed must not crowd every other source out of the strip.
      const names = [...new Set(group.map(item => publisher(item) || item.source))];
      return interleave(names.map(name => group.filter(item => (publisher(item) || item.source) === name)));
    }));
  }
  function exploreItems(feeds, layers, prefs, mapModel, now = Date.now()) {
    const items = [];
    const options = { when: prefs.when, price: '20', kind: 'all', movieType: 'all', where: 'all' };
    for (const layer of layers.filter(layer => prefs.enabled.includes(layer.id))) {
      const feed = feeds.get(layer.id);
      if (!feed) continue;
      for (const f of mapModel.filter(feed.features, options, now)) {
        const p = f.properties;
        const expires = Math.min(Date.parse(p.expires), Date.parse(p.end), p.kind === 'movie' ? Date.parse(p.start) : Infinity);
        items.push({ category: layer.id, title: p.title, source: p.source, url: p.url,
          starts: p.start, allDay: p.allDay, location: p.venue, detail: p.priceLabel,
          expires: new Date(expires).toISOString(),
          occurrence: `${p.url.split('?')[0].replace(/\/$/, '')}|${Date.parse(p.start)}|${f.geometry.coordinates.map(n => n.toFixed(4)).join(',')}` });
      }
    }
    return items;
  }
  const api = { topics, publishers, defaults, preferences, valid, mix, exploreItems };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TickerModel = api;
})(typeof window === 'undefined' ? globalThis : window);
