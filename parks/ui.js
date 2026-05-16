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
  const urlSimulate = new URLSearchParams(window.location.search).get('simulate') === '1';
  if (urlSimulate) {
    permModal.hidden = true;
    engine.enableSimulateMode();
    showBanner('Simulate mode — drag the SIM marker into a hotspot circle to drop into its chat.');
  }

  allowBtn?.addEventListener('click', () => {
    permModal.hidden = true;
    engine.requestGeolocation();
  });
  previewBtn?.addEventListener('click', () => {
    permModal.hidden = true;
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
    messagesEl.innerHTML = '';
    presenceRow.innerHTML = '';
    presenceChip.textContent = '1 here';
    sheet.hidden = false;
    inputEl.focus({ preventScroll: true });

    if (!window.PubchatChat.isConfigured()) {
      appendSystemBubble('Chat is in local-only mode. Paste Supabase creds into config.js to connect other people.');
    }

    await window.PubchatChat.joinHotspot(
      hotspot.id,
      currentIdentity,
      handleIncoming,
      handlePresence
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
    li.className = 'pc-bubble' + (isSelf ? ' is-self' : '');
    const meta = document.createElement('span');
    meta.className = 'pc-bubble-meta';
    meta.textContent = `${payload.emoji ?? '🙂'} ${payload.handle ?? 'someone'}`;
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

    messagesEl.appendChild(li);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendSystemBubble(text) {
    const li = document.createElement('li');
    li.className = 'pc-bubble is-system';
    li.textContent = text;
    messagesEl.appendChild(li);
  }

  sheetClose.addEventListener('click', () => {
    closeHotspot();
    // If in simulate mode, sheet re-opens if SIM still inside the circle.
    // Otherwise we trust geolocation to re-fire on re-entry.
  });

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
