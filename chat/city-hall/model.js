/* Dates and filtering are independent of the visitor's computer time zone. */
(() => {
  const dates = typeof module !== 'undefined' ? require('../explore/model.js') : window.ExploreModel;
  const day = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  const shift = (value, days) => new Date(Date.parse(value + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
  function current(record, now = Date.now()) {
    if (!Number.isFinite(Date.parse(record.date)) || !(Date.parse(record.expires) > now) || record.cancelled) return false;
    const today = day(now), when = day(record.date);
    if (record.category === 'meetings') return when >= today && when < shift(today, 7) && (record.dateOnly || Date.parse(record.date) >= now);
    if (record.hearingDate) return record.hearingDate >= today;
    return when <= today && when >= shift(today, record.category === 'permits' ? -6 : -29);
  }
  function filter(records, state, now = Date.now()) {
    const query = (state.query || '').trim().toLowerCase();
    return records.filter(r => current(r, now) && r.category === state.category &&
      matchesDate(r, state, now) &&
      (!state.district || r.scope === 'citywide' || r.districts?.includes(state.district)) &&
      (!state.board || state.category !== 'meetings' || r.board === state.board) &&
      (!query || [r.title, r.description, r.location, r.board, r.number, r.type, r.status].join(' ').toLowerCase().includes(query)))
      .sort((a, b) => state.sort === 'asc' || state.sort === 'desc'
        ? (Date.parse(a.date) - Date.parse(b.date)) * (state.sort === 'desc' ? -1 : 1) || a.title.localeCompare(b.title)
        : state.category === 'meetings'
        ? day(a.date).localeCompare(day(b.date)) || Number(a.dateOnly) - Number(b.dateOnly) || Date.parse(a.date) - Date.parse(b.date) || a.title.localeCompare(b.title)
        : Date.parse(b.date) - Date.parse(a.date) || a.title.localeCompare(b.title));
  }
  function matchesDate(record, state, now) {
    if (!state.when || state.when === 'all') return true;
    const past = record.category !== 'meetings' && !record.hearingDate;
    const [first, last] = dates.dateWindow(state, now, past);
    // Date-only official records overlap a calendar day, never an invented time.
    if (record.dateOnly || record.hearingDate) {
      const [start, end] = dates.dateWindow({ when: 'date', date: record.hearingDate || day(record.date) }, now);
      return start < last && end > first;
    }
    const value = Date.parse(record.date);
    return value >= first && value < last;
  }
  function safeURL(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && (u.hostname === 'austintexas.gov' || u.hostname.endsWith('.austintexas.gov')) ? u.href : null; } catch (_) { return null; }
  }
  const model = { day, shift, current, filter, matchesDate, safeURL };
  if (typeof module !== 'undefined') module.exports = model;
  else window.CityHallModel = model;
})();
