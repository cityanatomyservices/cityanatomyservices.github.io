/* Pure filtering shared by the map and regression checks. All calendar days are Austin time. */
(function (root) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
  function dayKey(value) {
    const p = parts.formatToParts(new Date(value));
    return ['year', 'month', 'day'].map(k => p.find(v => v.type === k).value).join('-');
  }
  const dayNumber = value => Date.parse(dayKey(value) + 'T00:00:00Z') / 86400000;
  const localParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
  function austinInstant(day, hour = 0) {
    const target = day * 86400000 + hour * 3600000;
    let guess = target;
    for (let i = 0; i < 3; i++) {
      const p = Object.fromEntries(localParts.formatToParts(new Date(guess)).map(x => [x.type, x.value]));
      const local = Date.UTC(+p.year, +p.month-1, +p.day, +p.hour, +p.minute, +p.second);
      guess += target - local;
    }
    return guess;
  }
  function windowDays(when, now) {
    const today = dayNumber(now);
    if (when === 'today') return [today, today];
    if (when === 'weekend') {
      const weekday = new Date(today * 86400000).getUTCDay();
      const saturday = today + (weekday === 0 ? -1 : (6 - weekday));
      return [saturday, saturday + 1];
    }
    return [today, today + 6];
  }
  function timeWindow(when, now) {
    if (when === 'now') return [now, now + 2 * 3600000];
    if (when === 'tonight') {
      let day = dayNumber(now);
      const hour = +localParts.formatToParts(new Date(now)).find(p => p.type === 'hour').value;
      if (hour < 3) day--;
      return [austinInstant(day,18), austinInstant(day+1,3)];
    }
    const [first,last] = windowDays(when,now);
    return [austinInstant(first), austinInstant(last+1)];
  }
  function miles(a, b) {
    const r = Math.PI / 180;
    const s = Math.sin((b[1] - a[1]) * r / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
    return 3958.8 * 2 * Math.asin(Math.sqrt(Math.min(1, s)));
  }
  function valid(f, now = Date.now()) {
    const p = f?.properties, c = f?.geometry?.coordinates;
    if (!p || f.geometry?.type !== 'Point' || !Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite)) return false;
    const base = typeof p.id === 'string' && typeof p.title === 'string' && typeof p.url === 'string' && /^https?:\/\//.test(p.url);
    if (p.kind === 'park') return base && p.theme === 'parks';
    return base
      && (p.kind === 'movie' ? p.price === null && Array.isArray(p.showtimes) && p.showtimes.length > 0
        && p.showtimes.every(s => Number.isFinite(Date.parse(s?.start)) && typeof s.url === 'string' && /^https?:\/\//.test(s.url))
        : p.kind === 'listing' ? typeof p.theme === 'string' && (p.price === null || Number.isFinite(p.price) && p.price >= 0)
        : ['event', 'activity', 'offer'].includes(p.kind) && Number.isFinite(p.price) && p.price >= 0 && p.price <= 20)
      && Number.isFinite(Date.parse(p.start)) && Date.parse(p.end) > Date.parse(p.start)
      && Date.parse(p.end) > now && Date.parse(p.expires) > now;
  }
  function filter(features, options, now = Date.now()) {
    const [first, last] = timeWindow(options.when, now);
    return features.map(f => {
      if (f?.properties?.kind !== 'movie' || !Array.isArray(f.properties.showtimes)) return f;
      const showtimes = f.properties.showtimes.filter(s => Date.parse(s?.start) > now && Date.parse(s.start) >= first && Date.parse(s.start) < last);
      return { ...f, properties: { ...f.properties, showtimes, start: showtimes[0]?.start } };
    }).filter(f => {
      if (!valid(f, now)) return false;
      const p = f.properties, c = f.geometry.coordinates;
      if (p.kind !== 'park' && (Date.parse(p.start) >= last || Date.parse(p.end) <= first)) return false;
      const query = (options.query || '').trim().toLocaleLowerCase();
      if (query && !`${p.title} ${p.venue || ''}`.toLocaleLowerCase().includes(query)) return false;
      if (p.kind === 'movie') {
        if (options.movieType && options.movieType !== 'all' && !p.tags?.includes(options.movieType)) return false;
        const query = (options.movieSearch || '').trim().toLocaleLowerCase();
        if (query && !`${p.title} ${p.venue}`.toLocaleLowerCase().includes(query)) return false;
      } else if (!['park','listing'].includes(p.kind) && (p.price > Number(options.price) || (options.kind !== 'all' && p.kind !== options.kind))) return false;
      if (options.where === 'map' && options.bounds) {
        const [w, s, e, n] = options.bounds;
        if (c[0] < w || c[0] > e || c[1] < s || c[1] > n) return false;
      }
      if (options.where === 'near' && (!options.position || miles(options.position, c) > options.radius)) return false;
      return true;
    }).sort((a, b) => {
      if (options.where === 'near' && options.position) {
        const delta = miles(options.position, a.geometry.coordinates) - miles(options.position, b.geometry.coordinates);
        if (Math.abs(delta) > .05) return delta;
      }
      const timeA = a.properties.kind === 'park' ? Infinity : Date.parse(a.properties.start);
      const timeB = b.properties.kind === 'park' ? Infinity : Date.parse(b.properties.start);
      return timeA - timeB || a.properties.title.localeCompare(b.properties.title);
    });
  }
  function venues(features) {
    const groups = new Map();
    for (const f of features) {
      const key = f.geometry.coordinates.map(n => n.toFixed(5)).join(',');
      if (!groups.has(key)) groups.set(key, { type: 'Feature', geometry: f.geometry, properties: { key, ids: [], eventCount: 0, kind: f.properties.kind, theme: f.properties.theme } });
      const p = groups.get(key).properties;
      p.ids.push(f.properties.id); p.eventCount++;
    }
    for (const f of groups.values()) {
      const p = f.properties;
      p.label = p.eventCount > 1 ? String(p.eventCount) : ({ event: 'E', activity: 'A', offer: '$', movie: 'M', park: 'P' }[p.kind] || { 'live-music':'L', 'live-comedy':'C', 'pop-up-markets':'S', festivals:'F', events:'E' }[p.theme] || 'E');
      p.ids = JSON.stringify(p.ids);
    }
    return { type: 'FeatureCollection', features: [...groups.values()] };
  }
  const api = { dayKey, windowDays, timeWindow, miles, valid, filter, venues };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ExploreModel = api;
})(typeof window === 'undefined' ? globalThis : window);
