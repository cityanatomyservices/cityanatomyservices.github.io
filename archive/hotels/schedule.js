// schedule.js — pure helpers for temporal geofences.
// No DOM, no globals modified. Exposes window.PubchatSchedule with two
// functions: isActive(schedule, now) and nextChange(schedule, now).
//
// A "schedule" is an optional object on a hotspot:
//   {
//     "timezone": "America/Chicago",      // IANA tz, optional
//     "windows": [                         // recurring weekly windows
//       { "days": ["mon","tue"], "from": "07:00", "to": "19:00" }
//     ]
//   }
//
// A hotspot with no schedule (or with an empty windows[]) is ALWAYS active.
// Multiple windows compose with OR. Overnight windows wrap (e.g. 20:00–02:00).

(function () {
  const DEFAULT_TZ = 'America/Chicago';

  function isActive(schedule, now) {
    now = now || new Date();
    if (!schedule || !schedule.windows || !schedule.windows.length) return true;
    const tz = schedule.timezone || DEFAULT_TZ;
    const { day, minutes } = localTimeIn(tz, now);
    return schedule.windows.some(w => windowIncludes(w, day, minutes));
  }

  // Returns the next Date when isActive() will flip, or null if no schedule.
  // Walks minute-by-minute up to 7 days ahead. Results are memoised per
  // (schedule, minute) so 300 hotspots sharing a category schedule cost
  // one walk, not 300.
  const _nextCache = new Map();
  function nextChange(schedule, now) {
    now = now || new Date();
    if (!schedule || !schedule.windows || !schedule.windows.length) return null;
    const minuteKey = Math.floor(now.getTime() / 60000);
    const key = minuteKey + '|' + JSON.stringify(schedule);
    if (_nextCache.has(key)) return _nextCache.get(key);
    if (_nextCache.size > 256) _nextCache.clear(); // bound growth

    const current = isActive(schedule, now);
    const MAX_MIN = 7 * 24 * 60;
    let result = null;
    for (let i = 1; i <= MAX_MIN; i++) {
      const t = new Date(now.getTime() + i * 60000);
      if (isActive(schedule, t) !== current) { result = t; break; }
    }
    _nextCache.set(key, result);
    return result;
  }

  function windowIncludes(win, dayName, minutes) {
    if (!win.days || !win.days.includes(dayName)) {
      // Allow overnight wrap: if "from > to", the window also covers early
      // morning of the NEXT day. Check yesterday's window applied to today.
      if (!win.days) return false;
      const yesterday = prevDay(dayName);
      if (!win.days.includes(yesterday)) return false;
      const from = parseHHMM(win.from);
      const to   = parseHHMM(win.to);
      return from > to && minutes < to;
    }
    const from = parseHHMM(win.from);
    const to   = parseHHMM(win.to);
    if (from <= to) return minutes >= from && minutes < to;
    // overnight on its starting day: from <= minutes < 24:00
    return minutes >= from;
  }

  const DAY_ORDER = ['sun','mon','tue','wed','thu','fri','sat'];
  function prevDay(d) {
    const i = DAY_ORDER.indexOf(d);
    return DAY_ORDER[(i + 6) % 7];
  }
  function parseHHMM(s) {
    const [h, m] = String(s).split(':').map(n => parseInt(n, 10));
    return (h || 0) * 60 + (m || 0);
  }

  // Human-readable summary of a schedule for popups, e.g.
  //   "Mon-Fri 5am-9pm · Sat-Sun 6am-9pm"
  //   "Daily 6am-11pm"
  //   "Always open"  (no schedule)
  function formatSchedule(schedule) {
    if (!schedule || !schedule.windows || !schedule.windows.length) {
      return 'Always open';
    }
    return schedule.windows.map(w => {
      const days = formatDays(w.days || []);
      const time = formatTime(w.from) + '-' + formatTime(w.to);
      return days ? `${days} ${time}` : time;
    }).join(' · ');
  }

  const WEEK = ['mon','tue','wed','thu','fri','sat','sun'];
  const DAY_LABELS = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };
  function formatDays(days) {
    if (!days.length) return '';
    const sorted = WEEK.filter(d => days.includes(d));
    if (sorted.length === 7) return 'Daily';
    // Group into consecutive runs (Mon-Fri vs Mon, Wed, Fri).
    const runs = [];
    let start = sorted[0], end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (WEEK.indexOf(sorted[i]) === WEEK.indexOf(end) + 1) {
        end = sorted[i];
      } else {
        runs.push([start, end]);
        start = end = sorted[i];
      }
    }
    runs.push([start, end]);
    return runs.map(([a, b]) => a === b ? DAY_LABELS[a] : `${DAY_LABELS[a]}-${DAY_LABELS[b]}`).join(', ');
  }
  function formatTime(hhmm) {
    const [h, m] = String(hhmm).split(':').map(n => parseInt(n, 10) || 0);
    if (h === 0 && m === 0) return '12am';
    if (h === 12 && m === 0) return '12pm';
    const period = h < 12 ? 'am' : 'pm';
    const h12 = h % 12 || 12;
    return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2,'0')}${period}`;
  }

  // Returns { day: 'mon'|..|'sun', minutes: 0..1439 } in the given timezone.
  // Intl.DateTimeFormat construction is expensive; cache one per tz so a
  // 10,000-iteration nextChange loop builds it once, not 10,000 times.
  const _fmtCache = new Map();
  function getFmt(tz) {
    let fmt = _fmtCache.get(tz);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      _fmtCache.set(tz, fmt);
    }
    return fmt;
  }
  function localTimeIn(tz, date) {
    const parts = getFmt(tz).formatToParts(date);
    let weekday = 'mon', hour = 0, minute = 0;
    for (const p of parts) {
      if (p.type === 'weekday') weekday = p.value.toLowerCase();
      else if (p.type === 'hour') hour = parseInt(p.value, 10);
      else if (p.type === 'minute') minute = parseInt(p.value, 10);
    }
    if (hour === 24) hour = 0; // some locales render midnight as 24
    return { day: weekday, minutes: hour * 60 + minute };
  }

  window.PubchatSchedule = { isActive, nextChange, formatSchedule };
})();
