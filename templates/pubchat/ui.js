// ui.js — wires DOM to PubchatEngine + PubchatChat via CustomEvents.
// No chat or geofence logic here; state lives in pubchat-engine.js + chat.js.

function initPubchatUI(engine) {
  const permModal  = document.getElementById('pc-permission');
  const allowBtn   = document.getElementById('pc-allow-gps');
  const previewBtn = document.getElementById('pc-preview');
  const banner     = document.getElementById('pc-banner');
  const recenterBtn = document.getElementById('pc-recenter');

  const identityEl     = document.getElementById('pc-identity');
  const identityEmoji  = identityEl.querySelector('.pc-identity-emoji');
  const identityHandle = identityEl.querySelector('.pc-identity-handle');
  const rerollBtn      = document.getElementById('pc-reroll');

  const sheet        = document.getElementById('pc-sheet');
  const sheetTitle   = document.getElementById('pc-sheet-title');
  const presenceChip = document.getElementById('pc-sheet-presence');
  const presenceRow  = document.getElementById('pc-presence-row');
  const messagesEl   = document.getElementById('pc-messages');
  const composeForm  = document.getElementById('pc-compose');
  const inputEl      = document.getElementById('pc-input');
  const vibeEl       = document.getElementById('pc-vibe');
  const sheetClose   = document.getElementById('pc-sheet-close');

  // ── Identity ────────────────────────────────────────────────────
  function renderIdentity() {
    const ident = window.PubchatIdentity.getIdentity();
    identityEmoji.textContent = ident.emoji;
    identityHandle.textContent = ident.handle;
    identityEl.hidden = false;
    return ident;
  }
  let currentIdentity = renderIdentity();

  rerollBtn.addEventListener('click', async () => {
    // If in a hotspot, leave + rejoin under new identity so others see churn.
    const activeId = window.PubchatChat.currentHotspotId();
    if (activeId) await window.PubchatChat.leaveHotspot();
    currentIdentity = window.PubchatIdentity.regenerate();
    identityEmoji.textContent = currentIdentity.emoji;
    identityHandle.textContent = currentIdentity.handle;
    if (activeId) {
      const h = engine.getHotspotById(activeId);
      if (h) openHotspot(h);
    }
  });

  // ── Permission modal / simulate ─────────────────────────────────
  // Supabase is loaded on demand so the cold page paint doesn't block on a
  // ~30 KB ESM import. chat.js already waits for the 'pubchat:supabase-ready'
  // event before creating its client, so this is a pure deferral.
  let supabaseLoading = null;
  function ensureSupabaseLoaded() {
    if (window.__supabaseCreateClient) return Promise.resolve();
    if (supabaseLoading) return supabaseLoading;
    supabaseLoading = import('https://esm.sh/@supabase/supabase-js@2')
      .then(mod => {
        window.__supabaseCreateClient = mod.createClient;
        window.dispatchEvent(new CustomEvent('pubchat:supabase-ready'));
      })
      .catch(err => {
        console.warn('Supabase load failed; chat will be local-only.', err);
        supabaseLoading = null;
      });
    return supabaseLoading;
  }

  const urlSimulate = new URLSearchParams(window.location.search).get('simulate') === '1';
  if (urlSimulate) {
    permModal.hidden = true;
    ensureSupabaseLoaded();
    engine.enableSimulateMode();
    showBanner('Simulate mode — drag the SIM marker into a hotspot circle to drop into its chat.');
  }

  allowBtn?.addEventListener('click', () => {
    permModal.hidden = true;
    ensureSupabaseLoaded();
    engine.requestGeolocation();
  });
  previewBtn?.addEventListener('click', () => {
    permModal.hidden = true;
    ensureSupabaseLoaded();
    engine.enableSimulateMode();
    showBanner('Preview mode — drag the SIM marker onto a hotspot to try out the chat.');
  });

  recenterBtn.addEventListener('click', () => engine.recenter());

  // ── Banner helper ───────────────────────────────────────────────
  function showBanner(msg, ms = 6000) {
    if (!banner) return;
    banner.textContent = msg;
    banner.hidden = false;
    clearTimeout(showBanner._t);
    if (ms > 0) showBanner._t = setTimeout(() => { banner.hidden = true; }, ms);
  }

  // ── Hotspot enter/leave ─────────────────────────────────────────
  let currentPresence = [];

  async function openHotspot(hotspot) {
    sheetTitle.textContent = hotspot.title ?? hotspot.id;
    renderHotspotInfo(hotspot);
    messagesEl.innerHTML = '';
    presenceRow.innerHTML = '';
    presenceChip.textContent = '1 here';
    sheet.hidden = false;
    inputEl.focus({ preventScroll: true });
    resetPollsPane();

    if (!window.PubchatChat.isConfigured()) {
      appendSystemBubble('Chat is in local-only mode. Paste Supabase creds into config.js to connect other people.');
    }

    // Replay last hour of history before live messages stream in. Best
    // effort — if Supabase is down we just open empty.
    try {
      const roomId = window.PubchatChat.roomIdFor(undefined, hotspot.id);
      const history = await window.PubchatChat.recentMessages(roomId);
      for (const m of history) appendMessageBubble(m);
    } catch (_) { /* ignore */ }

    await window.PubchatChat.joinHotspot(
      hotspot.id,
      currentIdentity,
      handleIncoming,
      handlePresence,
      removeBubbleByClientId
    );
  }

  async function closeHotspot() {
    sheet.hidden = true;
    presenceRow.innerHTML = '';
    messagesEl.innerHTML = '';
    currentPresence = [];
    await window.PubchatChat.leaveHotspot();
  }

  function handleIncoming(payload) {
    if (!payload) return;
    appendMessageBubble(payload);
  }

  function handlePresence(list) {
    currentPresence = list ?? [];
    const n = currentPresence.length;
    presenceChip.textContent = n === 1 ? '1 here' : `${n} here`;
    presenceRow.innerHTML = '';
    for (const p of currentPresence) {
      const pill = document.createElement('span');
      pill.className = 'pc-presence-pill' + (p.self ? ' is-you' : '');
      pill.innerHTML = `<span class="pc-presence-emoji" aria-hidden="true">${escapeHTML(p.emoji)}</span><span>${escapeHTML(p.handle)}${p.self ? ' · you' : ''}</span>`;
      presenceRow.appendChild(pill);
    }
    const id = window.PubchatChat.currentHotspotId();
    if (id) engine.setPresenceCount(id, n);
  }

  function appendMessageBubble(payload) {
    const li = document.createElement('li');
    const isSelf = payload.__self === true || payload.handle === currentIdentity.handle;
    li.className = 'pc-bubble'
      + (isSelf ? ' is-self' : '')
      + (payload.__historical ? ' is-historical' : '');
    if (payload.clientId) li.dataset.cid = payload.clientId;
    const meta = document.createElement('span');
    meta.className = 'pc-bubble-meta';
    let metaText = `${payload.emoji ?? '🙂'} ${payload.handle ?? 'someone'}`;
    if (payload.__historical && payload.t) metaText += ` · ${formatAgo(payload.t)}`;
    meta.textContent = metaText;
    li.appendChild(meta);

    const body = document.createElement('span');
    body.className = 'pc-bubble-body';
    if (payload.vibe) {
      const v = document.createElement('span');
      v.className = 'pc-bubble-vibe';
      v.textContent = payload.vibe;
      body.appendChild(v);
    }
    body.appendChild(document.createTextNode(payload.text ?? ''));
    li.appendChild(body);

    // Sender-only delete affordance. The server enforces a 5-minute
    // window via RLS, so click-after-that is a graceful no-op.
    if (isSelf && payload.clientId) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'pc-bubble-del';
      del.setAttribute('aria-label', 'Delete this message');
      del.title = 'Delete';
      del.textContent = '×';
      del.addEventListener('click', async () => {
        del.disabled = true;
        await window.PubchatChat.deleteMessage(payload.clientId);
      });
      li.appendChild(del);
    }

    messagesEl.appendChild(li);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeBubbleByClientId(cid) {
    if (!cid) return;
    const li = messagesEl.querySelector(`li[data-cid="${CSS.escape(cid)}"]`);
    if (li) li.remove();
  }

  function appendSystemBubble(text) {
    const li = document.createElement('li');
    li.className = 'pc-bubble is-system';
    li.textContent = text;
    messagesEl.appendChild(li);
  }

  // Render the optional `info` block (hours, description, menu, phone, website)
  // beneath the sheet title. Removes any prior info node first.
  function renderHotspotInfo(hotspot) {
    const headText = document.querySelector('.pc-sheet-head-text');
    const prev = document.getElementById('pc-sheet-info');
    if (prev) prev.remove();
    const info = hotspot.info;
    if (!info || !headText) return;
    const wrap = document.createElement('div');
    wrap.id = 'pc-sheet-info';
    wrap.className = 'pc-sheet-info';
    if (info.description) {
      const p = document.createElement('p');
      p.className = 'pc-info-desc';
      p.textContent = info.description;
      wrap.appendChild(p);
    }
    if (info.hours) wrap.appendChild(infoLine('Hours', info.hours));
    if (info.phone) wrap.appendChild(infoLine('Phone', info.phone));
    if (info.website) {
      const p = document.createElement('p');
      p.className = 'pc-info-line';
      const a = document.createElement('a');
      a.href = info.website;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Website ↗';
      p.appendChild(a);
      wrap.appendChild(p);
    }
    if (Array.isArray(info.menu) && info.menu.length) {
      const ul = document.createElement('ul');
      ul.className = 'pc-info-menu';
      for (const item of info.menu) {
        const li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
      }
      wrap.appendChild(ul);
    }
    if (wrap.childNodes.length) headText.appendChild(wrap);
  }

  function infoLine(label, value) {
    const p = document.createElement('p');
    p.className = 'pc-info-line';
    const strong = document.createElement('strong');
    strong.textContent = label + ': ';
    p.appendChild(strong);
    p.appendChild(document.createTextNode(value));
    return p;
  }

  sheetClose.addEventListener('click', () => {
    closeHotspot();
    // If in simulate mode, sheet re-opens if SIM still inside the circle.
    // Otherwise we trust geolocation to re-fire on re-entry.
  });

  // Tab switch — toggle .is-active on tab buttons and hidden on panes.
  // Listening on the static parent works fine since tabs aren't recreated.
  sheet.querySelector('.pc-sheet-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.pc-sheet-tab');
    if (!btn) return;
    const which = btn.dataset.tab;
    for (const tab of sheet.querySelectorAll('.pc-sheet-tab')) {
      const on = tab.dataset.tab === which;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    for (const pane of sheet.querySelectorAll('.pc-sheet-pane')) {
      pane.hidden = pane.dataset.pane !== which;
    }
    if (which === 'chat') inputEl.focus({ preventScroll: true });
    if (which === 'polls') loadPollsPane();
  });

  // ── Polls pane ─────────────────────────────────────────────────
  let pollsDefinitions = null;       // cached per-app
  let pollsLoadedForRoom = null;     // last hotspot we rendered for

  function resetPollsPane() {
    pollsLoadedForRoom = null;
    const list = document.getElementById('pc-polls');
    const empty = sheet.querySelector('.pc-polls-empty');
    if (list) list.innerHTML = '';
    if (empty) empty.hidden = true;
  }

  async function loadPollsPane() {
    const activeId = window.PubchatChat.currentHotspotId();
    if (!activeId) return;
    if (pollsLoadedForRoom === activeId) return;
    pollsLoadedForRoom = activeId;

    const list = document.getElementById('pc-polls');
    const empty = sheet.querySelector('.pc-polls-empty');
    if (!list) return;
    list.innerHTML = '';
    empty.hidden = true;

    // App-derived URL — mirror chat.js: first path segment, fallback "pubchat".
    const app = window.location.pathname.split('/').filter(Boolean)[0] || 'pubchat';
    let defs = pollsDefinitions;
    if (!defs) {
      try {
        const res = await fetch('polls.json', { cache: 'no-cache' });
        if (res.ok) defs = pollsDefinitions = await res.json();
      } catch (_) { /* swallow */ }
    }
    const polls = defs?.polls || [];
    if (!polls.length) { empty.hidden = false; return; }

    const roomId = window.PubchatChat.roomIdFor(app, activeId);
    const results = await window.PubchatChat.fetchPollResults(roomId);
    const byPoll = aggregateResults(results);

    for (const def of polls) {
      list.appendChild(renderPoll(def, byPoll.get(def.id) || {}, roomId));
    }
  }

  function aggregateResults(rows) {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.poll_id)) map.set(r.poll_id, {});
      map.get(r.poll_id)[r.option_index] = r.votes;
    }
    return map;
  }

  function renderPoll(def, counts, roomId) {
    const li = document.createElement('li');
    li.className = 'pc-poll';
    const q = document.createElement('p');
    q.className = 'pc-poll-q';
    q.textContent = def.question;
    li.appendChild(q);

    const total = def.options.reduce((s, _, i) => s + (counts[i] || 0), 0);
    const opts = document.createElement('div');
    opts.className = 'pc-poll-opts';
    def.options.forEach((label, i) => {
      const votes = counts[i] || 0;
      const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pc-poll-opt';
      btn.style.setProperty('--pct', pct + '%');
      btn.innerHTML = `<span class="pc-poll-opt-label">${escapeHTML(label)}</span>`
        + `<span class="pc-poll-opt-pct">${pct}%</span>`;
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        opts.querySelectorAll('.pc-poll-opt').forEach(b => b.disabled = true);
        const res = await window.PubchatChat.submitPollVote(
          def.id, roomId, currentIdentity.handle, i
        );
        if (res.ok || res.alreadyVoted) {
          pollsLoadedForRoom = null;
          loadPollsPane();
        } else {
          opts.querySelectorAll('.pc-poll-opt').forEach(b => b.disabled = false);
        }
      });
      opts.appendChild(btn);
    });
    li.appendChild(opts);
    const tot = document.createElement('p');
    tot.className = 'pc-poll-total';
    tot.textContent = total === 1 ? '1 vote' : `${total} votes`;
    li.appendChild(tot);
    return li;
  }

  function formatAgo(t) {
    const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    return `${hr}h ago`;
  }

  composeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = inputEl.value;
    const vibe = vibeEl.value || null;
    const ok = await window.PubchatChat.sendMessage(text, vibe);
    if (ok) {
      inputEl.value = '';
      vibeEl.value = '';
    }
  });

  // ── Engine events ───────────────────────────────────────────────
  window.addEventListener('pubchat:hotspot-changed', (e) => {
    const { enteredId, leftId, hotspot } = e.detail;
    if (leftId && enteredId !== leftId) {
      // Closing the previous hotspot's chat; joinHotspot also calls leave first,
      // but if we're leaving entirely (enteredId === null) do a clean close.
      if (!enteredId) closeHotspot();
    }
    if (enteredId && hotspot) {
      openHotspot(hotspot);
    }
  });

  window.addEventListener('pubchat:geolocation-denied', () => {
    showBanner('Location permission denied — switching to preview mode.', 8000);
    engine.enableSimulateMode();
  });

  window.addEventListener('pubchat:geolocation-unavailable', () => {
    showBanner('This browser does not support geolocation — using preview mode.', 8000);
    engine.enableSimulateMode();
  });
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
