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
    } catch (e) {
      console.warn('pubchat: send failed', e);
      return false;
    }
    // Best-effort persistence — never blocks UI success.
    persistChatRow(channelName(activeHotspotId), appId(), activeHotspotId, payload);
    return true;
  }

  function isConfigured() { return configured(); }
  function currentHotspotId() { return activeHotspotId; }

  // ── Persistence layer (additive — never blocks broadcast) ───────────
  // Every send tries to also write to public.chats so the room has a
  // rolling 30-day history. Failures (rate limit, network, missing
  // table) are logged and swallowed; the live broadcast already
  // delivered, so the user experience is unchanged.
  async function persistChatRow(roomId, app, hotspotId, payload) {
    const c = await ensureClient();
    if (!c) return;
    try {
      const row = {
        room_id: roomId,
        app,
        hotspot_id: hotspotId,
        handle: payload.handle,
        emoji: payload.emoji,
        home_hotspot: payload.home?.hotspotId || null,
        home_title: payload.home?.hotspotTitle || null,
        text: payload.text,
        vibe: payload.vibe || null,
      };
      const { error } = await c.from('chats').insert(row);
      if (error && error.code !== 'P0001') {
        console.warn('pubchat: chat persist failed', error.message || error);
      }
    } catch (e) {
      console.warn('pubchat: chat persist threw', e);
    }
  }

  // Load the last `sinceMs` of chat history for a room. Returns [] on
  // any error so callers can render their UI either way.
  async function recentMessages(roomId, sinceMs) {
    const window = sinceMs || 60 * 60 * 1000; // default 1 hour
    const c = await ensureClient();
    if (!c) return [];
    try {
      const cutoff = new Date(Date.now() - window).toISOString();
      const { data, error } = await c
        .from('chats')
        .select('handle, emoji, home_hotspot, home_title, text, vibe, created_at')
        .eq('room_id', roomId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) {
        console.warn('pubchat: history fetch failed', error.message || error);
        return [];
      }
      return (data || []).map(r => ({
        handle: r.handle,
        emoji: r.emoji,
        home: r.home_hotspot
          ? { hotspotId: r.home_hotspot, hotspotTitle: r.home_title }
          : null,
        text: r.text,
        vibe: r.vibe,
        t: new Date(r.created_at).getTime(),
        __historical: true,
      }));
    } catch (e) {
      console.warn('pubchat: history fetch threw', e);
      return [];
    }
  }

  // ── Polls ──────────────────────────────────────────────────────────
  // Definitions live in /data/<app>/polls.json (fetched + cached
  // per-app by the caller). Only votes go to the DB.
  async function fetchPollResults(roomId) {
    const c = await ensureClient();
    if (!c) return [];
    try {
      const { data, error } = await c
        .from('poll_results')
        .select('poll_id, option_index, votes')
        .eq('room_id', roomId);
      if (error) {
        console.warn('pubchat: poll results fetch failed', error.message || error);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('pubchat: poll results fetch threw', e);
      return [];
    }
  }

  // Returns { ok: true } or { ok: false, alreadyVoted: bool, error: any }.
  async function submitPollVote(pollId, roomId, handle, optionIndex) {
    const c = await ensureClient();
    if (!c) return { ok: false, error: new Error('no client') };
    try {
      const { error } = await c.from('poll_votes').insert({
        poll_id: pollId,
        room_id: roomId,
        handle,
        option_index: optionIndex,
      });
      if (!error) return { ok: true };
      // 23505 = unique_violation = primary key collision = already voted.
      if (error.code === '23505') return { ok: false, alreadyVoted: true };
      console.warn('pubchat: vote insert failed', error.message || error);
      return { ok: false, error };
    } catch (e) {
      console.warn('pubchat: vote insert threw', e);
      return { ok: false, error: e };
    }
  }

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
    const resolvedApp = appId || (prevNs ?? (window.location.pathname.split('/').filter(Boolean)[0] || 'pubchat'));
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
        } catch (e) {
          console.warn('pubchat: subscribe send failed', e);
          return false;
        }
        persistChatRow(name, resolvedApp, hotspotId, payload);
        return true;
      },
    };
  }

  // Public room-id helper so callers (homepage history loader, polls
  // tab) build the exact same key as the realtime channel + persisted
  // chats.room_id column.
  function roomIdFor(app, hotspotId) {
    const a = app || appId();
    return `${a}:${CITY_ID}:${hotspotId}`;
  }

  window.PubchatChat = {
    joinHotspot,
    leaveHotspot,
    sendMessage,
    subscribeHotspot,
    isConfigured,
    currentHotspotId,
    setAppNamespace,
    recentMessages,
    fetchPollResults,
    submitPollVote,
    roomIdFor,
  };
})();
