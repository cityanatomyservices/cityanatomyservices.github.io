/* Source snapshots are separate from editable scheduling. Expiring from an
   Explore feed never removes a person's selected stop. No network or chat. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlanSources = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  function place(p) {
    return { key: `place:${p.id}`, sourceId: p.id, kind: 'place', timing: 'unknown', title: p.name,
      venue: p.name, address: p.address || '', coordinates: [p.lng,p.lat], url: p.website || '',
      hoursText: p.opening_hours || '', hoursUnknown: true, provenance: p.sources || [], captured: new Date().toISOString() };
  }
  function feature(f) {
    const p = f.properties;
    const availability = ['activity','offer','park'].includes(p.kind) || p.allDay;
    const timing = availability ? 'unknown' : (p.theme === 'pop-up-markets' || p.exploreLayer === 'pop-up-markets') ? 'window' : 'fixed';
    const source = { key: `explore:${p.id}`, sourceId: p.id, kind: p.kind, timing, title: p.title,
      venue: p.venue || '', address: p.address || '', coordinates: f.geometry.coordinates.slice(0,2),
      description: p.description || '', conditions: p.conditions || '', url: p.url, ticketsUrl: p.ticketsUrl || '',
      provider: p.source, checked: p.checked, captured: new Date().toISOString(), priceLabel: p.priceLabel,
      start: availability ? null : p.start, end: availability ? null : p.end,
      endKnown: !availability && p.endKnown !== false && p.kind !== 'movie', hoursUnknown: availability,
      validFrom: availability ? p.start : null, validUntil: availability ? p.end : null,
      showtimes: p.kind === 'movie' ? p.showtimes.map(s => ({ start:s.start, url:s.url, format:s.format || '' })) : [] };
    if (p.kind === 'movie') {
      const runtime = /\b(\d{2,3})\s*min\b/i.exec(p.conditions || '');
      if (runtime) source.runtime = Number(runtime[1]);
    }
    return source;
  }
  function item(source, id) {
    const known = source.timing === 'fixed' && source.endKnown;
    const duration = known ? Math.round((Date.parse(source.end) - Date.parse(source.start)) / 60000) : source.runtime || (source.kind === 'movie' ? 120 : 60);
    return { id, source, schedule: { start: source.kind === 'movie' ? null : source.timing === 'fixed' ? source.start : null,
      duration: Math.max(1, Math.min(1440, duration || 60)), durationConfirmed: !!known, locked: false,
      showtime: null, windowStart: null, windowEnd: null, bufferBefore: null, note: '' } };
  }
  function meeting(p) {
    return { key: `meeting:${p.url}`, sourceId: p.id, kind: 'meeting',
      timing: p.dateOnly ? 'unknown' : 'fixed', title: p.title,
      venue: p.board || '', address: p.location || '', coordinates: null,
      description: p.description || '', url: p.url, provider: 'City of Austin',
      checked: p.checked || null, captured: new Date().toISOString(),
      start: p.dateOnly ? null : p.date, end: null, endKnown: false,
      validFrom: p.dateOnly ? p.date : null, hoursUnknown: false };
  }
  return { place, feature, meeting, item };
});
