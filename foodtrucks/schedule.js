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
  // Walks minute-by-minute up to 7 days ahead — bounded and fast (<1ms).
  function nextChange(schedule, now) {
    now = now || new Date();
    if (!schedule || !schedule.windows || !schedule.windows.length) return null;
    const current = isActive(schedule, now);
    const MAX_MIN = 7 * 24 * 60;
    for (let i = 1; i <= MAX_MIN; i++) {
      const t = new Date(now.getTime() + i * 60000);
      if (isActive(schedule, t) !== current) return t;
    }
    return null;
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

  // Returns { day: 'mon'|..|'sun', minutes: 0..1439 } in the given timezone.
  function localTimeIn(tz, date) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    let weekday = 'mon', hour = 0, minute = 0;
    for (const p of parts) {
      if (p.type === 'weekday') weekday = p.value.toLowerCase();
      else if (p.type === 'hour') hour = parseInt(p.value, 10);
      else if (p.type === 'minute') minute = parseInt(p.value, 10);
    }
    if (hour === 24) hour = 0; // some locales render midnight as 24
    return { day: weekday, minutes: hour * 60 + minute };
  }

  window.PubchatSchedule = { isActive, nextChange };
})();
