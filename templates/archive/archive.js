// austin.chat archive page renderer.
//
// Each per-bucket index.html (under /<bucket>/) sets window.ARCHIVE
// with { appId, label, color, tagline, categories: [{slug, label,
// dataUrls: [...]}, ...] } and includes config.js for Supabase
// credentials. This script renders a header, a category / location
// / date-range filter bar (with light/dark toggle), and the chat
// thread itself. Posts persist in public.chats forever — every chat
// posted on the live map shows up here.

(async function () {
  const cfg = window.ARCHIVE;
  const sb  = window.PUBCHAT_CONFIG;
  if (!cfg || !sb || !sb.SUPABASE_URL) {
    document.body.innerHTML = '<main class="archive"><p class="status">Archive misconfigured.</p></main>';
    return;
  }

  document.title = `${cfg.label} chat archive · austin.chat`;
  document.documentElement.style.setProperty('--bucket', cfg.color || '#4cc3ff');
  document.documentElement.style.setProperty('--bucket-on', pickContrast(cfg.color || '#4cc3ff'));

  // ── Theme (light / dark) ───────────────────────────────────────
  const THEME_KEY = 'austinchat-archive-theme';
  function getInitialTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
    const btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.innerHTML = t === 'dark' ? sunSvg() + ' Light' : moonSvg() + ' Dark';
      btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }
  let theme = getInitialTheme();

  // ── Hotspot lookup (resolve hotspot_id → title + category) ─────
  // The category list in cfg.categories gives us every venue file
  // under this bucket grouped by user-facing category. Build two
  // indexes: hotspotsByCategory (for the location dropdown) and
  // a flat hotspot_id → {title, categorySlug} map for row rendering.
  const hotspotsByCategory = new Map();   // catSlug -> [{ id, title }]
  const titleByHotspot     = new Map();   // hotId   -> string
  const categoryByHotspot  = new Map();   // hotId   -> catSlug
  await Promise.all((cfg.categories || []).flatMap(cat =>
    (cat.dataUrls || []).map(async (u) => {
      try {
        const r = await fetch(u);
        if (!r.ok) return;
        const j = await r.json();
        const list = hotspotsByCategory.get(cat.slug) || [];
        for (const h of (j.hotspots || [])) {
          const t = h.title || h.id;
          list.push({ id: h.id, title: t });
          titleByHotspot.set(h.id, t);
          categoryByHotspot.set(h.id, cat.slug);
        }
        hotspotsByCategory.set(cat.slug, list);
      } catch (_) { /* ignore */ }
    })
  ));
  // Sort each category's locations alphabetically for the dropdown.
  for (const [k, list] of hotspotsByCategory) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }
  const categoryLabel = new Map((cfg.categories || []).map(c => [c.slug, c.label]));

  // ── DOM scaffold ───────────────────────────────────────────────
  document.body.innerHTML = '';

  const hero = document.createElement('section');
  hero.className = 'hero';
  hero.innerHTML = `
    <div class="hero-inner">
      <div class="hero-top">
        <nav class="crumb">
          <a href="/">austin.chat</a>
          <span class="sep">/</span>
          <span class="cur">${escText(cfg.label.toLowerCase())}</span>
        </nav>
        <button class="theme-toggle" type="button"></button>
      </div>
      <div class="hero-icon-row">
        <span class="hero-mark" aria-hidden="true">${bucketSvg(cfg.appId)}</span>
        <h1>${escText(cfg.label)} chat archive</h1>
      </div>
      <p class="lede">${escText(cfg.tagline || ('Recent public chats from every ' + cfg.label.toLowerCase() + ' geofence on austin.chat. Walk into one to join the live conversation.'))}</p>
    </div>
  `;
  document.body.appendChild(hero);

  const filters = document.createElement('section');
  filters.className = 'filters';
  filters.innerHTML = `
    <div class="filter-group">
      <label for="f-cat">Category</label>
      <select id="f-cat">
        <option value="">All categories</option>
        ${(cfg.categories || []).map(c =>
          `<option value="${escAttr(c.slug)}">${escText(c.label)}</option>`).join('')}
      </select>
    </div>
    <div class="filter-group">
      <label for="f-loc">Location</label>
      <select id="f-loc">
        <option value="">All locations</option>
      </select>
    </div>
    <div class="filter-group">
      <label for="f-from">From</label>
      <input type="date" id="f-from">
    </div>
    <div class="filter-group">
      <label for="f-to">To</label>
      <input type="date" id="f-to">
    </div>
    <button class="filter-clear" type="button">Clear filters</button>
  `;
  document.body.appendChild(filters);

  const main = document.createElement('main');
  main.className = 'archive';
  main.innerHTML = `
    <p class="summary" hidden></p>
    <p class="status">Loading…</p>
  `;
  document.body.appendChild(main);

  const foot = document.createElement('footer');
  foot.className = 'foot';
  foot.innerHTML = `
    <span class="foot-note"></span>
    <a href="/">← back to the live map</a>
  `;
  document.body.appendChild(foot);

  applyTheme(theme);
  document.querySelector('.theme-toggle').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
  });

  // ── Filter state + handlers ────────────────────────────────────
  const els = {
    cat:   document.getElementById('f-cat'),
    loc:   document.getElementById('f-loc'),
    from:  document.getElementById('f-from'),
    to:    document.getElementById('f-to'),
    clear: document.querySelector('.filter-clear'),
  };

  function populateLocationDropdown(catSlug) {
    const cur = els.loc.value;
    const list = catSlug
      ? (hotspotsByCategory.get(catSlug) || [])
      : [...titleByHotspot.entries()]
          .map(([id, title]) => ({ id, title }))
          .sort((a, b) => a.title.localeCompare(b.title));
    els.loc.innerHTML =
      '<option value="">All locations</option>' +
      list.map(h => `<option value="${escAttr(h.id)}">${escText(h.title)}</option>`).join('');
    // Preserve selection if still valid under the new category.
    if (cur && list.some(h => h.id === cur)) els.loc.value = cur;
    else els.loc.value = '';
  }
  populateLocationDropdown('');

  els.cat.addEventListener('change', () => {
    populateLocationDropdown(els.cat.value);
    refresh();
  });
  els.loc.addEventListener('change', refresh);
  els.from.addEventListener('change', refresh);
  els.to.addEventListener('change', refresh);
  els.clear.addEventListener('click', () => {
    els.cat.value = '';
    populateLocationDropdown('');
    els.from.value = '';
    els.to.value = '';
    refresh();
  });

  // ── Fetch + render ─────────────────────────────────────────────
  let fetchSeq = 0;
  async function refresh() {
    const seq = ++fetchSeq;
    main.querySelector('.summary').hidden = true;
    main.querySelector('.status, .empty')?.remove();
    [...main.querySelectorAll('article.entry, h2.day')].forEach(n => n.remove());
    const status = document.createElement('p');
    status.className = 'status';
    status.textContent = 'Loading…';
    main.appendChild(status);

    // Build query. Category narrows to the union of its venues'
    // hotspot_ids (since chats has no `category` column). Location
    // pins one venue. Dates are inclusive on both ends.
    const params = new URLSearchParams();
    params.set('app', 'eq.' + cfg.appId);
    params.set('select', 'hotspot_id,handle,emoji,text,created_at');
    params.set('order', 'created_at.desc');
    params.set('limit', '2000');
    if (els.loc.value) {
      params.set('hotspot_id', 'eq.' + els.loc.value);
    } else if (els.cat.value) {
      const ids = (hotspotsByCategory.get(els.cat.value) || []).map(h => h.id);
      if (ids.length) {
        // PostgREST `in.()` expects parenthesized comma list. URLSearchParams
        // will percent-encode the comma; that's fine.
        params.append('hotspot_id', 'in.(' + ids.join(',') + ')');
      } else {
        // Category has no venues yet → return nothing rather than
        // accidentally listing the whole bucket.
        params.append('hotspot_id', 'eq.__none__');
      }
    }
    if (els.from.value) {
      params.append('created_at', 'gte.' + new Date(els.from.value + 'T00:00:00').toISOString());
    }
    if (els.to.value) {
      const d = new Date(els.to.value + 'T00:00:00');
      d.setDate(d.getDate() + 1); // inclusive end
      params.append('created_at', 'lt.' + d.toISOString());
    }

    let chats = [];
    try {
      const r = await fetch(`${sb.SUPABASE_URL}/rest/v1/chats?${params.toString()}`, {
        headers: {
          apikey: sb.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + sb.SUPABASE_ANON_KEY,
        },
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      chats = await r.json();
    } catch (e) {
      if (seq !== fetchSeq) return;
      status.textContent = 'Could not load archive: ' + (e.message || e);
      return;
    }
    if (seq !== fetchSeq) return;
    status.remove();

    // Summary line
    const summary = main.querySelector('.summary');
    if (chats.length) {
      const bits = [`<strong>${chats.length}</strong> message${chats.length === 1 ? '' : 's'}`];
      if (els.cat.value)  bits.push('in <strong>' + escText(categoryLabel.get(els.cat.value) || els.cat.value) + '</strong>');
      if (els.loc.value)  bits.push('at <strong>' + escText(titleByHotspot.get(els.loc.value) || els.loc.value) + '</strong>');
      if (els.from.value || els.to.value) {
        const a = els.from.value ? friendlyDateStr(els.from.value) : '∞';
        const b = els.to.value   ? friendlyDateStr(els.to.value)   : 'now';
        bits.push(`from <strong>${a}</strong> to <strong>${b}</strong>`);
      }
      summary.innerHTML = bits.join(' · ');
      summary.hidden = false;
    } else {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = anyFilterSet()
        ? 'No messages match these filters. Try widening the date range or clearing a filter.'
        : 'No chats yet. Walk into a geofence to start one.';
      main.appendChild(empty);
      foot.querySelector('.foot-note').textContent = '';
      return;
    }

    // Render
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
      const catSlug = categoryByHotspot.get(c.hotspot_id);
      const cat = document.createElement('span');
      cat.className = 'cat';
      cat.textContent = catSlug ? (categoryLabel.get(catSlug) || catSlug) : '';
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = ((c.emoji || '') + ' ' + (c.handle || '')).trim();
      meta.append(time, loc, cat, who);
      entry.appendChild(meta);

      if (c.text) {
        const msg = document.createElement('p');
        msg.className = 'msg';
        msg.textContent = c.text;
        entry.appendChild(msg);
      }
      main.appendChild(entry);
    }
    foot.querySelector('.foot-note').textContent =
      `${chats.length} message${chats.length === 1 ? '' : 's'} shown. The full thread lives here permanently.`;
  }

  function anyFilterSet() {
    return !!(els.cat.value || els.loc.value || els.from.value || els.to.value);
  }

  refresh();

  // ── Helpers ─────────────────────────────────────────────────────
  function escText(s) {
    return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }
  function escAttr(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
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
  function friendlyDateStr(yyyymmdd) {
    const d = new Date(yyyymmdd + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function pickContrast(hex) {
    // White text for everything except pale/yellow buckets.
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#ffffff';
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.65 ? '#0e1117' : '#ffffff';
  }
  function moonSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  function sunSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  }
  function bucketSvg(slug) {
    // Per-bucket icon. Hand-rolled to stay under a few hundred bytes.
    const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    switch (slug) {
      case 'shopping':
        return `<svg ${common}><path d="M3 6h2l2 12h12l2-9H7"/><circle cx="9" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/></svg>`;
      case 'services':
        return `<svg ${common}><path d="M12 3l3.5 7 7.5 1-5.5 5.5 1.5 7.5L12 20l-7 4 1.5-7.5L1 11l7.5-1z"/></svg>`;
      case 'rec':
        return `<svg ${common}><path d="M3 21l4-8 4 4 6-10 4 6"/><path d="M3 21h18"/></svg>`;
      case 'social':
        return `<svg ${common}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.4 8.4 0 0 1 8.5-8.5A8.4 8.4 0 0 1 21 11.5z"/></svg>`;
      case 'events':
        return `<svg ${common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>`;
      default:
        return `<svg ${common}><circle cx="12" cy="12" r="9"/></svg>`;
    }
  }
})();
