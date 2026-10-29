/* Pure scheduling, with all local dates interpreted in Austin, never in the
   visitor's device timezone. Node exports allow deterministic domain tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlanModel = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const zone = 'America/Chicago', minute = 60000;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function local(value) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    const p = Object.fromEntries(parts.formatToParts(d).map(p => [p.type, p.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  }
  const day = (value = Date.now()) => local(value).slice(0, 10);
  function localCandidates(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')) return [];
    // Chicago's modern offsets are UTC-5/-6. Round-tripping rejects nonexistent
    // spring-forward times and invalid dates; a repeated fall hour is explicit.
    const wall = Date.parse(value + 'Z');
    return [5, 6].map(h => wall + h * 3600000).filter(t => local(t) === value).map(t => new Date(t).toISOString());
  }
  const instant = value => localCandidates(value)[0] || null;
  function nextDay(date) { return new Date(Date.parse(date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10); }
  function previousDay(date) { return new Date(Date.parse(date + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10); }
  const clock = value => local(value).slice(11,16);
  function planDay(value = Date.now()) { return clock(value) < '05:00' ? previousDay(day(value)) : day(value); }
  function timeCandidates(date, time, closing = false) {
    return localCandidates(`${time < '05:00' || closing && time === '05:00' ? nextDay(date) : date}T${time}`);
  }
  const timeOnDay = (date, time, closing = false) => timeCandidates(date,time,closing)[0] || null;
  const iso = t => new Date(t).toISOString();
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const duration = item => Math.max(1, Number(item.schedule.duration) || 60);
  function bounds(plan) {
    return [instant(`${plan.date}T05:00`), instant(`${nextDay(plan.date)}T05:00`)].map(Date.parse);
  }
  const onDay = (date, value) => { const [a,b] = bounds({date}), t=Date.parse(value); return t >= a && t < b; };
  function targetDay(source, preferred) {
    if (source.kind === 'movie') {
      const shows = source.showtimes || [];
      if (shows.some(s => onDay(preferred,s.start))) return preferred;
      return shows.length ? planDay(shows[0].start) : preferred;
    }
    if (source.timing === 'fixed' && source.start) return planDay(source.start);
    const from = source.start || source.validFrom, until = source.endKnown ? source.end : source.validUntil;
    if (from) {
      const [a,b] = bounds({date:preferred});
      if (Date.parse(from) < b && (!until || Date.parse(until) > a)) return preferred;
      return source.timing === 'window' ? planDay(from) : day(from);
    }
    return preferred;
  }
  function upgrade(plan) {
    const p = structuredClone(plan);
    if (!p || !Array.isArray(p.items)) return p;
    if (p.schemaVersion !== 2) {
      p.days = [p.date]; p.daySettings = {};
      for (const item of p.items) {
        const at = fixedStart(item) || item.schedule?.start || item.schedule?.windowStart;
        item.day = at ? planDay(at) : targetDay(item.source,p.date);
        if (!p.days.includes(item.day)) p.days.push(item.day);
      }
      for (const date of p.days) p.daySettings[date] = {name:p.name,bufferMinutes:p.bufferMinutes};
      if (p.items.length && !p.items.some(i => i.day === p.date)) p.date = [...new Set(p.items.map(i => i.day))].sort()[0];
      p.schemaVersion = 2;
    }
    p.dayStart = '05:00'; p.dayEnd = '05:00';
    return p;
  }
  function dayView(book, date = book.date) {
    return {...structuredClone(book),...book.daySettings?.[date],date,items:structuredClone(book.items.filter(i => !i.day || i.day === date))};
  }
  function ensureDay(book,date) {
    if (!instant(date+'T12:00')) throw new Error('Choose a valid plan day.');
    if (!book.days.includes(date)) book.days.push(date);
    book.daySettings[date] ||= {name:'My Austin day',bufferMinutes:20};
    book.date = date;
  }
  function replaceDay(book, view) {
    if (view.date !== book.date || view.id !== book.id) throw new Error('Choose the day using the plan day selector.');
    book.items = book.items.filter(i => i.day !== view.date).concat(view.items.map(i => ({...i,day:view.date})));
    book.daySettings[view.date] = {name:view.name,bufferMinutes:view.bufferMinutes};
    return book;
  }
  function fixedStart(item) {
    return item.source.kind === 'movie' ? item.schedule.showtime : item.source.timing === 'fixed' ? item.source.start : null;
  }
  function windows(item, plan) {
    const [a,b] = bounds(plan), s = item.source, u = item.schedule;
    let start = a, end = b;
    if (s.timing === 'window' || s.timing === 'fixed') {
      if (s.start) start = Math.max(start, Date.parse(s.start));
      if (s.endKnown && s.end) end = Math.min(end, Date.parse(s.end));
    }
    // All-day/curated listings supply valid dates, NOT confirmed business hours.
    if (s.validFrom) start = Math.max(start, Date.parse(s.validFrom));
    if (s.validUntil) end = Math.min(end, Date.parse(s.validUntil));
    if (u.windowStart) start = Math.max(start, Date.parse(u.windowStart));
    if (u.windowEnd) end = Math.min(end, Date.parse(u.windowEnd));
    return [start, end];
  }
  const interval = item => [Date.parse(item.schedule.start), Date.parse(item.schedule.start) + duration(item) * minute];
  function buffer(plan, before, after, provider) {
    const leg = provider?.leg?.(before, after, plan);
    return Math.max(0, Number(leg?.minutes ?? after?.schedule.bufferBefore ?? plan.bufferMinutes) || 0) * minute;
  }
  function build(plan, provider) {
    const result = structuredClone(plan);
    const items = result.items.filter(i => !i.day || i.day === result.date);
    const placed = [];
    for (const item of items) {
      if (item.schedule.locked && item.schedule.start) placed.push(item);
      else if (fixedStart(item)) { item.schedule.start = fixedStart(item); placed.push(item); }
      else item.schedule.start = null;
    }
    for (const item of items) {
      if (placed.includes(item) || (item.source.kind === 'movie' && !item.schedule.showtime)) continue;
      const [from, until] = windows(item, result), length = duration(item) * minute;
      if (!finite(from) || !finite(until) || until <= from) continue;
      let cursor = from;
      const occupied = placed.filter(p => p.schedule.start).sort((x,y) => interval(x)[0] - interval(y)[0]);
      for (const other of occupied) {
        const [a,b] = interval(other);
        if (b + buffer(result, other, item, provider) <= cursor) continue;
        if (cursor + length + buffer(result, item, other, provider) <= a) break;
        cursor = Math.max(cursor, b + buffer(result, other, item, provider));
      }
      if (cursor + length <= until) { item.schedule.start = iso(cursor); placed.push(item); }
    }
    return result;
  }
  function check(plan, provider) {
    const items = plan.items.filter(i => !i.day || i.day === plan.date);
    const issues = new Map(items.map(i => [i.id, []]));
    const add = (i, code, text, severity = 'warning') => issues.get(i.id).push({ code, text, severity });
    const [dayStart,dayEnd] = bounds(plan);
    for (const item of items) {
      const s = item.source, u = item.schedule, [a,b] = interval(item), [opens,closes] = windows(item, plan);
      if (!u.start) add(item, 'unscheduled', s.kind === 'movie' && !u.showtime ? 'Choose a movie showtime.' : 'Not scheduled. Build your day or set an arrival time.', 'error');
      else if (!Number.isFinite(a)) add(item, 'invalid-time', 'Choose a valid arrival time.', 'error');
      else {
        if (a < dayStart || b > dayEnd) add(item, 'outside-day', 'This visit goes outside the 5 AM–5 AM plan day. Adjust its time or length.', 'error');
        if (a < opens || b > closes) add(item, 'outside-hours', 'This visit falls outside the listed or entered availability.', 'error');
        const fixed = fixedStart(item);
        if (fixed && a !== Date.parse(fixed)) add(item, 'fixed-time', 'Arrival differs from the published start or selected showtime.', 'error');
      }
      if (!u.durationConfirmed) add(item, 'duration', 'Visit length is an estimate; check or adjust it.');
      if (s.kind === 'movie') add(item, 'trailers', 'Allow for trailers and arrival. Confirm the finish time with the cinema.');
      if (s.hoursUnknown && !(u.windowStart && u.windowEnd)) add(item, 'hours', s.hoursText ? 'Published hours need checking for this date; enter an availability window.' : 'Opening hours are unknown. Check the venue and enter an availability window.');
      if (s.timing === 'fixed' && !s.endKnown && s.kind !== 'movie') add(item, 'end', 'The organizer has not supplied a finish time.');
    }
    const scheduled = items.filter(i => i.schedule.start && Number.isFinite(interval(i)[0])).sort((a,b) => interval(a)[0] - interval(b)[0]);
    // Check every overlapping pair, including a long event enclosing several stops.
    for (let x = 0; x < scheduled.length; x++) for (let y = x + 1; y < scheduled.length; y++) {
      const a = scheduled[x], b = scheduled[y];
      if (interval(a)[1] > interval(b)[0]) {
        add(a, 'overlap', `Overlaps ${b.source.title}.`, 'error');
        add(b, 'overlap', `Overlaps ${a.source.title}.`, 'error');
      }
    }
    for (let i = 1; i < scheduled.length; i++) {
      const before = scheduled[i - 1], after = scheduled[i], gap = interval(after)[0] - interval(before)[1];
      if (gap >= 0 && gap < buffer(plan, before, after, provider)) add(after, 'buffer', 'Not enough room for your travel buffer.', 'error');
    }
    return { issues, scheduled, conflicts: items.filter(i => issues.get(i.id).some(x => x.severity === 'error')).length };
  }
  function empty(id) {
    const date = planDay();
    return { id, schemaVersion:2, name: 'My Austin day', date, days:[date],daySettings:{[date]:{name:'My Austin day',bufferMinutes:20}},dayStart: '05:00', dayEnd: '05:00', bufferMinutes: 20, items: [] };
  }
  function valid(plan) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!plan || !uuid.test(plan.id || '') || typeof plan.name !== 'string' || plan.name.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(plan.date || '') || !Array.isArray(plan.items) || plan.items.length > 150) return false;
    if (!instant(plan.date + 'T12:00')) return false;
    if (plan.schemaVersion === 2 && (!Array.isArray(plan.days) || !plan.days.includes(plan.date) || plan.days.length > 60 || new Set(plan.days).size !== plan.days.length || !plan.days.every(d => instant(d+'T12:00')) || !plan.daySettings || !plan.days.every(d => typeof plan.daySettings[d]?.name === 'string' && plan.daySettings[d].name.length <= 100 && finite(plan.daySettings[d].bufferMinutes) && plan.daySettings[d].bufferMinutes >= 0 && plan.daySettings[d].bufferMinutes <= 240))) return false;
    if (!bounds(plan).every(Number.isFinite) || !finite(plan.bufferMinutes) || plan.bufferMinutes < 0 || plan.bufferMinutes > 240) return false;
    const ids = new Set(), keys = new Set();
    return plan.items.every(i => {
      if (!i || !uuid.test(i.id || '') || ids.has(i.id) || typeof i.source?.title !== 'string' || !i.source.title || typeof i.source?.key !== 'string' || !i.source.key || !i.schedule || !finite(i.schedule.duration) || i.schedule.duration < 1 || i.schedule.duration > 1440) return false;
      if (i.schedule.bufferBefore != null && (!finite(i.schedule.bufferBefore) || i.schedule.bufferBefore < 0 || i.schedule.bufferBefore > 240)) return false;
      if (!['fixed','window','unknown'].includes(i.source.timing) || !['start','end','validFrom','validUntil','checked'].every(k => i.source[k] == null || Number.isFinite(Date.parse(i.source[k])))) return false;
      if (i.source.showtimes != null && (!Array.isArray(i.source.showtimes) || !i.source.showtimes.every(s => s && Number.isFinite(Date.parse(s.start))))) return false;
      if (i.schedule.note != null && (typeof i.schedule.note !== 'string' || i.schedule.note.length > 2000)) return false;
      if (i.source.kind === 'movie' && i.schedule.showtime && !i.source.showtimes?.some(s => Date.parse(s.start) === Date.parse(i.schedule.showtime))) return false;
      if (plan.schemaVersion === 2 && !plan.days.includes(i.day)) return false;
      const key = `${i.day || plan.date}:${i.source.key}`;
      if (keys.has(key)) return false;
      ids.add(i.id);
      keys.add(key);
      return ['start','showtime','windowStart','windowEnd'].every(k => i.schedule[k] == null || Number.isFinite(Date.parse(i.schedule[k]))) &&
        (!i.source.coordinates || (Array.isArray(i.source.coordinates) && i.source.coordinates.length === 2 && i.source.coordinates.every(finite) && Math.abs(i.source.coordinates[0]) <= 180 && Math.abs(i.source.coordinates[1]) <= 90));
    });
  }
  return { zone, day, local, localCandidates, instant, nextDay, previousDay, clock, planDay, timeCandidates, timeOnDay, bounds, onDay, targetDay, upgrade, dayView, ensureDay, replaceDay, interval, windows, fixedStart, duration, buffer, build, check, empty, valid };
});
