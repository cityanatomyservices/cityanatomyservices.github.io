// austin.chat archive page renderer.
//
// Each per-category index.html (under /<appId>/) sets window.ARCHIVE
// with { appId, label, color, dataUrls } and includes config.js for
// Supabase credentials. This script fetches the hotspot title map
// from the data files, then queries the public.chats table directly
// via PostgREST (no Supabase SDK — keeps page weight minimal) and
// renders a reverse-chronological day-grouped list.

(async function () {
  const cfg = window.ARCHIVE;
  const sb  = window.PUBCHAT_CONFIG;
  if (!cfg || !sb || !sb.SUPABASE_URL) {
    document.body.innerHTML = '<main class="archive"><p class="status">Archive misconfigured.</p></main>';
    return;
  }

  document.title = `${cfg.label} chat archive · austin.chat`;

  // Shell
  const main = document.createElement('main');
  main.className = 'archive';
  const header = document.createElement('header');
  const crumb  = document.createElement('nav');
  crumb.className = 'crumb';
  crumb.innerHTML = '';
  const crumbHome = document.createElement('a');
  crumbHome.href = '/';
  crumbHome.textContent = 'austin.chat';
  const slash = document.createTextNode(' / ');
  const crumbCur = document.createElement('span');
  crumbCur.className = 'cur';
  crumbCur.textContent = cfg.appId;
  crumb.append(crumbHome, slash, crumbCur);

  const h1 = document.createElement('h1');
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = cfg.color || '#4cc3ff';
  const h1text = document.createTextNode(cfg.label + ' chat archive');
  h1.append(dot, h1text);

  const lede = document.createElement('p');
  lede.className = 'lede';
  lede.textContent =
    `Recent public chats from every ${cfg.label.toLowerCase()} geofence on austin.chat. ` +
    `Walk into one to join the live conversation.`;

  header.append(crumb, h1, lede);
  main.appendChild(header);

  const status = document.createElement('p');
  status.className = 'status';
  status.textContent = 'Loading…';
  main.appendChild(status);
  document.body.appendChild(main);

  // ── Hotspot title lookup ────────────────────────────────────────
  const titleByHotspot = new Map();
  await Promise.all((cfg.dataUrls || []).map(async (u) => {
    try {
      const r = await fetch(u);
      if (!r.ok) return;
      const j = await r.json();
      for (const h of (j.hotspots || [])) {
        titleByHotspot.set(h.id, h.title || h.id);
      }
    } catch (_) { /* ignore */ }
  }));

  // ── Fetch chats via PostgREST ───────────────────────────────────
  let chats = [];
  try {
    const url = `${sb.SUPABASE_URL}/rest/v1/chats`
              + `?app=eq.${encodeURIComponent(cfg.appId)}`
              + `&select=hotspot_id,handle,emoji,text,created_at`
              + `&order=created_at.desc&limit=2000`;
    const r = await fetch(url, {
      headers: {
        apikey: sb.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + sb.SUPABASE_ANON_KEY,
      },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    chats = await r.json();
  } catch (e) {
    status.textContent = 'Could not load archive: ' + (e.message || e);
    return;
  }

  status.remove();

  if (!chats.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No chats yet. Walk into a geofence to start one.';
    main.appendChild(empty);
    appendFooter(main, 0);
    return;
  }

  // ── Render entries grouped by day ───────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let lastDayKey = null;
  for (const c of chats) {
    const d = new Date(c.created_at);
    const dayKey = d.toDateString();
    if (dayKey !== lastDayKey) {
      const h2 = document.createElement('h2');
      h2.className = 'day';
      h2.textContent = friendlyDay(d, today);
      main.appendChild(h2);
      lastDayKey = dayKey;
    }
    const entry = document.createElement('article');
    entry.className = 'entry';

    const meta = document.createElement('header');
    const time = document.createElement('time');
    time.dateTime = c.created_at;
    time.textContent = friendlyTime(d);

    const loc = document.createElement('span');
    loc.className = 'loc';
    loc.textContent = titleByHotspot.get(c.hotspot_id) || c.hotspot_id;

    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = ((c.emoji || '') + ' ' + (c.handle || '')).trim();

    meta.append(time, loc, who);
    entry.appendChild(meta);

    if (c.text) {
      const msg = document.createElement('p');
      msg.className = 'msg';
      msg.textContent = c.text;
      entry.appendChild(msg);
    }
    main.appendChild(entry);
  }

  appendFooter(main, chats.length);

  // ── Helpers ─────────────────────────────────────────────────────
  function friendlyDay(d, today) {
    const that = new Date(d); that.setHours(0, 0, 0, 0);
    const days = Math.round((today - that) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7)   return d.toLocaleDateString('en-US', { weekday: 'long' });
    const opts = { month: 'long', day: 'numeric' };
    if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('en-US', opts);
  }

  function friendlyTime(d) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            .toLowerCase().replace(/\s+/g, '');
  }

  function appendFooter(parent, count) {
    const foot = document.createElement('footer');
    foot.className = 'foot';
    const note = count
      ? `Showing the ${count} most recent. The full thread lives here permanently. `
      : '';
    foot.innerHTML = note;
    const back = document.createElement('a');
    back.href = '/';
    back.textContent = '← back to the live map';
    foot.appendChild(back);
    parent.appendChild(foot);
  }
})();
