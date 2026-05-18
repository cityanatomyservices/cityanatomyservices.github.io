// chat.js — Supabase Realtime Broadcast + Presence wrapper.
// One channel per hotspot. Broadcast messages are pass-through (nothing is
// written to a table). Presence tracks who is currently inside the hotspot.
//
// If config.js has no Supabase URL/key, falls back to a local-only mock so
// the UI still runs for visual development.

(function () {
  const CITY_ID = 'atx';
  const MAX_TEXT_LEN = 240;
  const MIN_SEND_INTERVAL_MS = 900;

  let client = null;
  let activeChannel = null;
  let activeHotspotId = null;
  let activeIdentity = null;
  let onMessageCb = null;
  let onPresenceCb = null;
  let lastSendAt = 0;

  function supaReady() {
    return typeof window.__supabaseCreateClient === 'function';
  }

  function waitForSupabase(timeoutMs = 4000) {
    if (supaReady()) return Promise.resolve(true);
    return new Promise((resolve) => {
      let done = false;
      const onReady = () => { if (!done) { done = true; resolve(true); } };
      window.addEventListener('pubchat:supabase-ready', onReady, { once: true });
      setTimeout(() => { if (!done) { done = true; resolve(supaReady()); } }, timeoutMs);
    });
  }

  function configured() {
    const cfg = window.PUBCHAT_CONFIG;
    return !!(cfg && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  }

  async function ensureClient() {
    if (client) return client;
    if (!configured()) return null;
    const ready = await waitForSupabase();
    if (!ready) return null;
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.PUBCHAT_CONFIG;
    client = window.__supabaseCreateClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 5 } },
    });
    return client;
  }

  function channelName(hotspotId) {
    return `${appId()}:${CITY_ID}:${hotspotId}`;
  }

  // Namespace realtime channels by URL pathname segment so multiple apps
  // served from the same repo (e.g. /pubchat/, /homelesschat/, /festivals/)
  // never cross-talk, even if they share hotspotIds. Callers (like the
  // homepage mini-popup viewer) can override via setAppNamespace().
  let appNamespaceOverride = null;
  function appId() {
    if (appNamespaceOverride) return appNamespaceOverride;
    const seg = window.location.pathname.split('/').filter(Boolean)[0];
    return seg || 'pubchat';
  }
  function setAppNamespace(id) { appNamespaceOverride = id || null; }

  async function joinHotspot(hotspotId, identity, onMessage, onPresence) {
    await leaveHotspot();
    activeHotspotId = hotspotId;
    activeIdentity = identity;
    onMessageCb = onMessage;
    onPresenceCb = onPresence;

    const c = await ensureClient();
    if (!c) {
      // Mock mode: no remote, but still emit an empty presence so UI renders.
      if (onPresenceCb) {
        onPresenceCb(identity ? [{ handle: identity.handle, emoji: identity.emoji, self: true }] : []);
      }
      return { mock: true };
    }

    const name = channelName(hotspotId);
    const channelConfig = { broadcast: { self: false, ack: false } };
    // Only join presence if caller provided an identity. Silent viewers
    // (e.g. the homepage mini-popup) pass identity=null and just listen.
    if (identity) channelConfig.presence = { key: identity.handle };
    const channel = c.channel(name, { config: channelConfig });

    channel.on('broadcast', { event: 'msg' }, (payload) => {
      if (!onMessageCb) return;
      onMessageCb(payload?.payload ?? null);
    });

    channel.on('presence', { event: 'sync' }, () => {
      if (!onPresenceCb) return;
      const state = channel.presenceState();
      const list = [];
      for (const key of Object.keys(state)) {
        const entries = state[key];
        if (!entries?.length) continue;
        // Merge duplicates across multiple tabs from same handle.
        const first = entries[0];
        list.push({
          handle: first.handle ?? key,
          emoji: first.emoji ?? '🙂',
          vibe: first.vibe ?? null,
          home: first.home ?? null,
          self: identity ? (key === identity.handle) : false,
        });
      }
      onPresenceCb(list);
    });

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && identity) {
        await channel.track({
          handle: identity.handle,
          emoji: identity.emoji,
          home: identity.home || null,
          joinedAt: Date.now(),
        });
      }
    });

    activeChannel = channel;
    return channel;
  }

  async function leaveHotspot() {
    const c = client;
    const ch = activeChannel;
    activeChannel = null;
    activeHotspotId = null;
    activeIdentity = null;
    onMessageCb = null;
    onPresenceCb = null;
    if (!c || !ch) return;
    try {
      await ch.untrack();
    } catch (e) { /* ignore */ }
    try {
      await c.removeChannel(ch);
    } catch (e) { /* ignore */ }
  }

  async function sendMessage(text, vibe) {
    const trimmed = String(text ?? '').trim().slice(0, MAX_TEXT_LEN);
    if (!trimmed || !activeIdentity) return false;

    const now = Date.now();
    if (now - lastSendAt < MIN_SEND_INTERVAL_MS) return false;
    lastSendAt = now;

    const payload = {
      handle: activeIdentity.handle,
      emoji: activeIdentity.emoji,
      home: activeIdentity.home || null,
      text: trimmed,
      vibe: vibe || null,
      t: now,
    };

    // Local echo so the sender sees their own bubble immediately.
    if (onMessageCb) onMessageCb({ ...payload, __self: true });

    if (!activeChannel || activeChannel.mock) return true;

    try {
      await activeChannel.send({
        type: 'broadcast',
        event: 'msg',
        payload,
      });
      return true;
    } catch (e) {
      console.warn('pubchat: send failed', e);
      return false;
    }
  }

  function isConfigured() { return configured(); }
  function currentHotspotId() { return activeHotspotId; }

  // Parallel subscription to a specific hotspot channel. Independent of
  // the singleton activeChannel, so callers can hold many at once (the
  // homepage opens one per popup). When `identity` is provided, also
  // tracks presence and exposes a `send()` so the user can chat there.
  // When omitted, behaves as a read-only viewer.
  async function subscribeHotspot(hotspotId, appId, callbacks) {
    const { onMessage, onPresence, identity } = callbacks || {};
    const c = await ensureClient();
    if (!c) {
      if (onPresence) onPresence(identity
        ? [{ handle: identity.handle, emoji: identity.emoji, home: identity.home || null, self: true }]
        : []);
      return { leave: () => {}, send: async () => false };
    }
    const prevNs = appNamespaceOverride;
    if (appId) appNamespaceOverride = appId;
    const name = channelName(hotspotId);
    appNamespaceOverride = prevNs;

    const channelConfig = { broadcast: { self: false, ack: false } };
    if (identity) channelConfig.presence = { key: identity.handle };
    const channel = c.channel(name, { config: channelConfig });
    channel.on('broadcast', { event: 'msg' }, (payload) => {
      if (onMessage) onMessage(payload?.payload ?? null);
    });
    channel.on('presence', { event: 'sync' }, () => {
      if (!onPresence) return;
      const state = channel.presenceState();
      const list = [];
      for (const key of Object.keys(state)) {
        const entries = state[key];
        if (!entries?.length) continue;
        const first = entries[0];
        list.push({
          handle: first.handle ?? key,
          emoji: first.emoji ?? '🙂',
          vibe: first.vibe ?? null,
          home: first.home ?? null,
          self: identity ? (key === identity.handle) : false,
        });
      }
      onPresence(list);
    });
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && identity) {
        await channel.track({
          handle: identity.handle,
          emoji: identity.emoji,
          home: identity.home || null,
          joinedAt: Date.now(),
        });
      }
    });
    let subLastSendAt = 0;
    return {
      leave: async () => {
        try { await channel.untrack(); } catch (e) { /* ignore */ }
        try { await c.removeChannel(channel); } catch (e) { /* ignore */ }
      },
      send: async (text, vibe) => {
        if (!identity) return false;
        const trimmed = String(text ?? '').trim().slice(0, MAX_TEXT_LEN);
        if (!trimmed) return false;
        const now = Date.now();
        if (now - subLastSendAt < MIN_SEND_INTERVAL_MS) return false;
        subLastSendAt = now;
        const payload = {
          handle: identity.handle,
          emoji: identity.emoji,
          home: identity.home || null,
          text: trimmed,
          vibe: vibe || null,
          t: now,
        };
        if (onMessage) onMessage({ ...payload, __self: true });
        try {
          await channel.send({ type: 'broadcast', event: 'msg', payload });
          return true;
        } catch (e) {
          console.warn('pubchat: subscribe send failed', e);
          return false;
        }
      },
    };
  }

  window.PubchatChat = {
    joinHotspot,
    leaveHotspot,
    sendMessage,
    subscribeHotspot,
    isConfigured,
    currentHotspotId,
    setAppNamespace,
  };
})();
