// schedule.js — pure helpers for temporal geofences.
// No DOM, no globals modified. Exposes window.PubchatSchedule with:
//   isActive(schedule, now)
//   nextChange(schedule, now)
//   isFullyExpired(schedule, now)
//   formatSchedule(schedule)
//
// A "schedule" is an optional object on a hotspot. Three ways to be active:
//
//   1. Recurring weekly windows (existing):
//      {
//        "timezone": "America/Chicago",      // IANA tz, optional
//        "windows": [
//          { "days": ["mon","tue"], "from": "07:00", "to": "19:00" }
//        ],
//        "dateRange": {                       // optional gate on windows
//          "start": "2026-07-01",             // YYYY-MM-DD, inclusive
//          "end":   "2026-09-30"              // YYYY-MM-DD, inclusive
//        }
//      }
//
//   2. One-off dated events (sessions):
//      {
//        "timezone": "America/Chicago",
//        "sessions": [
//          { "start": "2026-07-11T11:00", "end": "2026-07-11T18:00" },
//          { "start": "2026-07-12T11:00", "end": "2026-07-12T18:00" }
//        ]
//      }
//
//   3. No schedule → always active.
//
// `sessions[]` takes precedence over `windows[]` when present. The render
// pipeline can call isFullyExpired() to drop one-off events whose last
// session has ended (and dateRange-gated recurring events whose season
// has passed) so they vanish from the map without a commit.

(function () {
  const DEFAULT_TZ = 'America/Chicago';

  function isActive(schedule, now) {
    now = now || new Date();
    if (!schedule) return true;
    const tz = schedule.timezone || DEFAULT_TZ;

    // One-off dated sessions take precedence.
    if (schedule.sessions && schedule.sessions.length) {
      return schedule.sessions.some(s => {
        const a = parseLocalISO(s.start, tz);
        const b = parseLocalISO(s.end,   tz);
        if (!a || !b) return false;
        const t = now.getTime();
        return t >= a.getTime() && t < b.getTime();
      });
    }

    // Recurring windows, optionally gated by an outer dateRange.
    if (!schedule.windows || !schedule.windows.length) return true;
    if (!inDateRange(schedule.dateRange, now, tz)) return false;
    const { day, minutes } = localTimeIn(tz, now);
    return schedule.windows.some(w => windowIncludes(w, day, minutes));
  }

  // True iff this event will never become active again.
  //  - sessions[] non-empty AND every end < now AND no windows[]
  //  - dateRange.end exists AND end-of-that-day < now
  function isFullyExpired(schedule, now) {
    now = now || new Date();
    if (!schedule) return false;
    const tz = schedule.timezone || DEFAULT_TZ;

    if (schedule.sessions && schedule.sessions.length && !(schedule.windows && schedule.windows.length)) {
      const t = now.getTime();
      const stillFuture = schedule.sessions.some(s => {
        const b = parseLocalISO(s.end, tz);
        return b && b.getTime() > t;
      });
      if (!stillFuture) return true;
    }

    if (schedule.dateRange && schedule.dateRange.end) {
      const endOfDay = parseLocalISO(schedule.dateRange.end + 'T23:59:59', tz);
      if (endOfDay && endOfDay.getTime() < now.getTime()) return true;
    }

    return false;
  }

  // Returns the next Date when isActive() will flip, or null if no schedule.
  const _nextCache = new Map();
  function nextChange(schedule, now) {
    now = now || new Date();
    if (!schedule) return null;
    const tz = schedule.timezone || DEFAULT_TZ;

    // sessions[] → next boundary among all session starts/ends.
    if (schedule.sessions && schedule.sessions.length) {
      const t = now.getTime();
      let nextT = Infinity;
      for (const s of schedule.sessions) {
        const a = parseLocalISO(s.start, tz);
        const b = parseLocalISO(s.end,   tz);
        if (a && a.getTime() > t && a.getTime() < nextT) nextT = a.getTime();
        if (b && b.getTime() > t && b.getTime() < nextT) nextT = b.getTime();
      }
      return nextT === Infinity ? null : new Date(nextT);
    }

    if (!schedule.windows || !schedule.windows.length) return null;

    const minuteKey = Math.floor(now.getTime() / 60000);
    const key = minuteKey + '|' + JSON.stringify(schedule);
    if (_nextCache.has(key)) return _nextCache.get(key);
    if (_nextCache.size > 256) _nextCache.clear();

    const current = isActive(schedule, now);
    const MAX_MIN = 7 * 24 * 60;
    let result = null;
    // Cap walk at dateRange.end if set.
    const rangeEnd = schedule.dateRange && schedule.dateRange.end
      ? parseLocalISO(schedule.dateRange.end + 'T23:59:59', tz)
      : null;
    for (let i = 1; i <= MAX_MIN; i++) {
      const t = new Date(now.getTime() + i * 60000);
      if (rangeEnd && t.getTime() > rangeEnd.getTime()) {
        if (current) result = rangeEnd;
        break;
      }
      if (isActive(schedule, t) !== current) { result = t; break; }
    }
    _nextCache.set(key, result);
    return result;
  }

  function inDateRange(dr, now, tz) {
    if (!dr) return true;
    const t = now.getTime();
    if (dr.start) {
      const a = parseLocalISO(dr.start + 'T00:00:00', tz);
      if (a && t < a.getTime()) return false;
    }
    if (dr.end) {
      const b = parseLocalISO(dr.end + 'T23:59:59', tz);
      if (b && t > b.getTime()) return false;
    }
    return true;
  }

  function windowIncludes(win, dayName, minutes) {
    if (!win.days || !win.days.includes(dayName)) {
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

  // Parse "YYYY-MM-DDTHH:MM[:SS]" as wall time in `tz`, return a UTC Date.
  function parseLocalISO(s, tz) {
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    const Y = +m[1], M = +m[2], D = +m[3];
    const h = +(m[4] || 0), mn = +(m[5] || 0), sc = +(m[6] || 0);
    const naiveUtc = Date.UTC(Y, M - 1, D, h, mn, sc);
    const offsetMin = tzOffsetMinutes(tz || DEFAULT_TZ, new Date(naiveUtc));
    return new Date(naiveUtc - offsetMin * 60000);
  }

  // Minutes east of UTC for `tz` at the given UTC instant. DST-aware.
  function tzOffsetMinutes(tz, date) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const v = {};
    for (const p of fmt.formatToParts(date)) v[p.type] = p.value;
    if (v.hour === '24') v.hour = '00';
    const asUtc = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second);
    return (asUtc - date.getTime()) / 60000;
  }

  // Human-readable summary, e.g.:
  //   "Mon-Fri 5am-9pm"
  //   "Daily 6am-11pm"
  //   "Jul 11-12, 11am-6pm"
  //   "Always open"
  function formatSchedule(schedule) {
    if (!schedule) return 'Always open';
    if (schedule.sessions && schedule.sessions.length) {
      return formatSessions(schedule.sessions, schedule.timezone || DEFAULT_TZ);
    }
    if (!schedule.windows || !schedule.windows.length) return 'Always open';
    const wins = schedule.windows.map(w => {
      const days = formatDays(w.days || []);
      const time = formatTime(w.from) + '-' + formatTime(w.to);
      return days ? `${days} ${time}` : time;
    }).join(' · ');
    if (schedule.dateRange && (schedule.dateRange.start || schedule.dateRange.end)) {
      return wins + ' · ' + formatRange(schedule.dateRange);
    }
    return wins;
  }

  function formatSessions(sessions, tz) {
    // Group consecutive sessions sharing the same wall-clock from-to into
    // one "Jul 11-12, 11am-6pm" line; everything else gets its own line.
    const parsed = sessions.map(s => {
      const a = parseLocalISO(s.start, tz);
      const b = parseLocalISO(s.end, tz);
      const fromHHMM = s.start.split('T')[1]?.slice(0, 5) || '';
      const toHHMM   = s.end.split('T')[1]?.slice(0, 5)   || '';
      return { a, b, fromHHMM, toHHMM, startDay: s.start.split('T')[0] };
    }).filter(x => x.a && x.b).sort((p, q) => p.a - q.a);
    if (!parsed.length) return 'Scheduled';
    const groups = [[parsed[0]]];
    for (let i = 1; i < parsed.length; i++) {
      const last = groups[groups.length - 1];
      const prev = last[last.length - 1];
      const curr = parsed[i];
      const dayDiff = (Date.parse(curr.startDay) - Date.parse(prev.startDay)) / 86400000;
      if (dayDiff <= 1 && curr.fromHHMM === prev.fromHHMM && curr.toHHMM === prev.toHHMM) {
        last.push(curr);
      } else {
        groups.push([curr]);
      }
    }
    return groups.map(g => {
      const first = g[0], last = g[g.length - 1];
      const time = formatTime(first.fromHHMM) + '-' + formatTime(first.toHHMM);
      const date = g.length === 1
        ? formatDayLabel(first.a, tz)
        : formatDayLabel(first.a, tz) + '-' + formatDayLabel(last.a, tz, true);
      return `${date}, ${time}`;
    }).join(' · ');
  }

  function formatRange(dr) {
    const tz = DEFAULT_TZ;
    const a = dr.start ? parseLocalISO(dr.start + 'T12:00:00', tz) : null;
    const b = dr.end   ? parseLocalISO(dr.end   + 'T12:00:00', tz) : null;
    if (a && b) return `${formatDayLabel(a, tz)}-${formatDayLabel(b, tz)}`;
    if (a) return `from ${formatDayLabel(a, tz)}`;
    if (b) return `through ${formatDayLabel(b, tz)}`;
    return '';
  }

  function formatDayLabel(d, tz, dayOnlyIfSameMonth) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz });
  }

  const WEEK = ['mon','tue','wed','thu','fri','sat','sun'];
  const DAY_LABELS = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };
  function formatDays(days) {
    if (!days.length) return '';
    const sorted = WEEK.filter(d => days.includes(d));
    if (sorted.length === 7) return 'Daily';
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
    if (hour === 24) hour = 0;
    return { day: weekday, minutes: hour * 60 + minute };
  }

  window.PubchatSchedule = { isActive, nextChange, isFullyExpired, formatSchedule };
})();
