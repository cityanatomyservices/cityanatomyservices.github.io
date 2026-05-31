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
  let onDeleteCb = null;
  let lastSendAt = 0;

  // Opaque per-message id stamped on every outgoing payload. Used by
  // the delete-my-own-post feature so peers can find and remove the
  // matching bubble, and so the DB delete query can target one row.
  function newClientId() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (_) { /* fall through */ }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

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

  async function joinHotspot(hotspotId, identity, onMessage, onPresence, onDelete) {
    await leaveHotspot();
    activeHotspotId = hotspotId;
    activeIdentity = identity;
    onMessageCb = onMessage;
    onPresenceCb = onPresence;
    onDeleteCb = onDelete || null;

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

    channel.on('broadcast', { event: 'del' }, (payload) => {
      if (!onDeleteCb) return;
      const cid = payload?.payload?.clientId;
      if (cid) onDeleteCb(cid);
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
    onDeleteCb = null;
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
      clientId: newClientId(),
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
        client_id: payload.clientId || null,
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

  // Delete a message the user just sent. Broadcasts a `del` event to
  // peers so their UI removes the bubble, and best-effort deletes the
  // persisted row so it isn't replayed on history loads. The 5-minute
  // server-side RLS window means stale calls just no-op.
  async function deleteMessage(clientId) {
    if (!clientId || !activeChannel || !activeHotspotId) return false;
    // Echo locally first so the sender's UI updates instantly.
    if (onDeleteCb) onDeleteCb(clientId);
    if (!activeChannel.mock) {
      try {
        await activeChannel.send({
          type: 'broadcast',
          event: 'del',
          payload: { clientId },
        });
      } catch (e) {
        console.warn('pubchat: delete broadcast failed', e);
      }
    }
    const c = await ensureClient();
    if (c) {
      try {
        const roomId = channelName(activeHotspotId);
        const { error } = await c.from('chats').delete()
          .eq('room_id', roomId).eq('client_id', clientId);
        if (error) console.warn('pubchat: row delete failed', error.message || error);
      } catch (e) {
        console.warn('pubchat: row delete threw', e);
      }
    }
    return true;
  }

  // Load the last `sinceMs` of chat history for a room. Returns [] on
  // any error so callers can render their UI either way.
  async function recentMessages(roomId, sinceMs) {
    const window = sinceMs || 24 * 60 * 60 * 1000; // default 24 hours
    const c = await ensureClient();
    if (!c) return [];
    try {
      const cutoff = new Date(Date.now() - window).toISOString();
      const { data, error } = await c
        .from('chats')
        .select('client_id, handle, emoji, home_hotspot, home_title, text, vibe, created_at')
        .eq('room_id', roomId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) {
        console.warn('pubchat: history fetch failed', error.message || error);
        return [];
      }
      return (data || []).map(r => ({
        clientId: r.client_id || null,
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
    const { onMessage, onPresence, onDelete, identity } = callbacks || {};
    const c = await ensureClient();
    if (!c) {
      if (onPresence) onPresence(identity
        ? [{ handle: identity.handle, emoji: identity.emoji, home: identity.home || null, self: true }]
        : []);
      return { leave: () => {}, send: async () => false, deleteMessage: async () => false };
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
    channel.on('broadcast', { event: 'del' }, (payload) => {
      const cid = payload?.payload?.clientId;
      if (cid && onDelete) onDelete(cid);
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
          clientId: newClientId(),
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
      deleteMessage: async (clientId) => {
        if (!clientId) return false;
        if (onDelete) onDelete(clientId); // local echo
        try {
          await channel.send({ type: 'broadcast', event: 'del', payload: { clientId } });
        } catch (e) {
          console.warn('pubchat: subscribe delete broadcast failed', e);
        }
        try {
          const { error } = await c.from('chats').delete()
            .eq('room_id', name).eq('client_id', clientId);
          if (error) console.warn('pubchat: row delete failed', error.message || error);
        } catch (e) {
          console.warn('pubchat: row delete threw', e);
        }
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

  // ── Unified city-wide chat (v2) ────────────────────────────────────
  // All chats for the city live in one room and one Realtime channel.
  // Each message carries the geofence + neighborhood metadata it was
  // posted from, so the UI can filter client-side (location, topic, tag)
  // without per-room rebinding. Votes (👍 / 👎) and applied tags are
  // separate tables with their own broadcast events on this channel.
  const CITY_ROOM_ID    = CITY_ID;          // "atx" — chats.room_id value
  const CITY_CHANNEL    = `chat:${CITY_ID}`; // Realtime channel name

  async function persistCityChatRow(payload, origin) {
    const c = await ensureClient();
    if (!c) return;
    try {
      const row = {
        room_id:         CITY_ROOM_ID,
        app:             origin.app || null,
        hotspot_id:      origin.hotspotId || null,
        bucket:          origin.bucket || null,
        neighborhood_id: origin.neighborhoodId || null,
        tags:            Array.isArray(origin.tagsSnapshot) ? origin.tagsSnapshot : null,
        client_id:       payload.clientId || null,
        handle:          payload.handle,
        emoji:           payload.emoji,
        home_hotspot:    payload.home?.hotspotId || null,
        home_title:      payload.home?.hotspotTitle || null,
        text:            payload.text,
        vibe:            payload.vibe || null,
      };
      const { error } = await c.from('chats').insert(row);
      if (error && error.code !== 'P0001') {
        console.warn('pubchat: chat persist failed', error.message || error);
      }
    } catch (e) {
      console.warn('pubchat: chat persist threw', e);
    }
  }

  // Subscribe to the single city channel. `origin` is the geofence the
  // popup was opened from — its metadata is stamped onto every outgoing
  // message so the UI can filter the whole stream later.
  //   origin = { bucket, app, hotspotId, hotspotTitle,
  //              neighborhoodId, neighborhoodTitle, tagsSnapshot }
  // callbacks = { onMessage, onPresence, onDelete, onVote, onTag, identity }
  async function subscribeCity(callbacks, originInit) {
    const { onMessage, onPresence, onDelete, onVote, onTag, identity } = callbacks || {};
    let origin = { ...(originInit || {}) };

    const c = await ensureClient();
    if (!c) {
      if (onPresence) onPresence(identity
        ? [{ handle: identity.handle, emoji: identity.emoji, home: identity.home || null, self: true }]
        : []);
      return {
        leave: () => {}, send: async () => false, deleteMessage: async () => false,
        updateOrigin: (next) => { origin = { ...origin, ...(next || {}) }; },
      };
    }

    const channelConfig = { broadcast: { self: false, ack: false } };
    if (identity) channelConfig.presence = { key: identity.handle };
    const channel = c.channel(CITY_CHANNEL, { config: channelConfig });

    channel.on('broadcast', { event: 'msg' }, (p) => {
      if (onMessage) onMessage(p?.payload ?? null);
    });
    channel.on('broadcast', { event: 'del' }, (p) => {
      const cid = p?.payload?.clientId;
      if (cid && onDelete) onDelete(cid);
    });
    channel.on('broadcast', { event: 'vote' }, (p) => {
      if (onVote) onVote(p?.payload ?? null);
    });
    channel.on('broadcast', { event: 'tag' }, (p) => {
      if (onTag) onTag(p?.payload ?? null);
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
          emoji:  first.emoji  ?? '🙂',
          home:   first.home   ?? null,
          self:   identity ? (key === identity.handle) : false,
        });
      }
      onPresence(list);
    });

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && identity) {
        await channel.track({
          handle: identity.handle,
          emoji:  identity.emoji,
          home:   identity.home || null,
          joinedAt: Date.now(),
        });
      }
    });

    let subLastSendAt = 0;
    return {
      updateOrigin: (next) => { origin = { ...origin, ...(next || {}) }; },
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
          clientId: newClientId(),
          handle:   identity.handle,
          emoji:    identity.emoji,
          home:     identity.home || null,
          text:     trimmed,
          vibe:     vibe || null,
          t:        now,
          // Origin stamp: where the user posted from. Lets every other
          // subscriber filter without a database round trip.
          o: {
            bucket:           origin.bucket           || null,
            app:              origin.app              || null,
            hotspotId:        origin.hotspotId        || null,
            hotspotTitle:     origin.hotspotTitle     || null,
            neighborhoodId:   origin.neighborhoodId   || null,
            neighborhoodTitle: origin.neighborhoodTitle || null,
            tags:             Array.isArray(origin.tagsSnapshot) ? origin.tagsSnapshot : [],
          },
        };
        if (onMessage) onMessage({ ...payload, __self: true });
        try {
          await channel.send({ type: 'broadcast', event: 'msg', payload });
        } catch (e) {
          console.warn('pubchat: city send failed', e);
          return false;
        }
        persistCityChatRow(payload, origin);
        return true;
      },
      deleteMessage: async (clientId) => {
        if (!clientId) return false;
        if (onDelete) onDelete(clientId);
        try {
          await channel.send({ type: 'broadcast', event: 'del', payload: { clientId } });
        } catch (e) {
          console.warn('pubchat: city delete broadcast failed', e);
        }
        try {
          const { error } = await c.from('chats').delete()
            .eq('room_id', CITY_ROOM_ID).eq('client_id', clientId);
          if (error) console.warn('pubchat: city row delete failed', error.message || error);
        } catch (e) {
          console.warn('pubchat: city row delete threw', e);
        }
        return true;
      },
      // 👍/👎 on a specific message. value ∈ {1, -1, 0}. 0 clears my vote.
      // Anon can't read chat_votes directly, so we delete-then-insert
      // for an upsert; counts come from the chat_vote_counts view.
      castVote: async (clientId, value) => {
        if (!identity || !clientId) return false;
        const v = value === 1 ? 1 : value === -1 ? -1 : 0;
        try {
          await c.from('chat_votes').delete()
            .eq('chat_client_id', clientId).eq('handle', identity.handle);
          if (v !== 0) {
            const { error } = await c.from('chat_votes').insert({
              chat_client_id: clientId, handle: identity.handle, value: v,
            });
            if (error && error.code !== 'P0001') {
              console.warn('pubchat: vote insert failed', error.message || error);
              return false;
            }
          }
        } catch (e) {
          console.warn('pubchat: vote write threw', e);
          return false;
        }
        // Tell peers to refresh that message's count.
        try {
          await channel.send({ type: 'broadcast', event: 'vote',
            payload: { clientId, by: identity.handle, value: v } });
        } catch (e) { /* ignore */ }
        return true;
      },
      // Apply / remove a tag chip on the current geofence. Re-applying
      // is idempotent (PK collision swallowed); removing is a delete of
      // (hotspotId, tag, handle).
      applyTag: async (hotspotId, tag) => {
        if (!identity || !hotspotId || !tag) return false;
        try {
          const { error } = await c.from('geofence_tags').insert({
            hotspot_id: hotspotId, tag, handle: identity.handle,
          });
          // 23505 (unique_violation) = already applied → success.
          if (error && error.code !== '23505' && error.code !== 'P0001') {
            console.warn('pubchat: tag insert failed', error.message || error);
            return false;
          }
        } catch (e) {
          console.warn('pubchat: tag insert threw', e);
          return false;
        }
        try {
          await channel.send({ type: 'broadcast', event: 'tag',
            payload: { hotspotId, tag, by: identity.handle, applied: true } });
        } catch (e) { /* ignore */ }
        return true;
      },
      removeTag: async (hotspotId, tag) => {
        if (!identity || !hotspotId || !tag) return false;
        try {
          await c.from('geofence_tags').delete()
            .eq('hotspot_id', hotspotId).eq('tag', tag).eq('handle', identity.handle);
        } catch (e) {
          console.warn('pubchat: tag delete threw', e);
          return false;
        }
        try {
          await channel.send({ type: 'broadcast', event: 'tag',
            payload: { hotspotId, tag, by: identity.handle, applied: false } });
        } catch (e) { /* ignore */ }
        return true;
      },
    };
  }

  // Load the last `sinceMs` of chat history from the unified room. Items
  // include the origin metadata + tags snapshot so client-side filters
  // can act on them.
  async function recentCityMessages(sinceMs) {
    const winMs = sinceMs || 24 * 60 * 60 * 1000;
    const c = await ensureClient();
    if (!c) return [];
    try {
      const since = new Date(Date.now() - winMs).toISOString();
      const { data, error } = await c
        .from('chats')
        .select('client_id, handle, emoji, home_hotspot, home_title, text, vibe, created_at, bucket, app, hotspot_id, neighborhood_id, tags')
        .eq('room_id', CITY_ROOM_ID)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(400);
      if (error) {
        console.warn('pubchat: city history fetch failed', error.message || error);
        return [];
      }
      return (data || []).map(r => ({
        clientId: r.client_id || null,
        handle: r.handle,
        emoji: r.emoji,
        home: r.home_hotspot ? { hotspotId: r.home_hotspot, hotspotTitle: r.home_title } : null,
        text: r.text,
        vibe: r.vibe,
        t: new Date(r.created_at).getTime(),
        o: {
          bucket: r.bucket, app: r.app, hotspotId: r.hotspot_id,
          neighborhoodId: r.neighborhood_id,
          tags: Array.isArray(r.tags) ? r.tags : [],
        },
        __historical: true,
      }));
    } catch (e) {
      console.warn('pubchat: city history fetch threw', e);
      return [];
    }
  }

  // Aggregated 👍/👎 counts for a set of clientIds. Returns a Map.
  async function fetchVoteCounts(clientIds) {
    const m = new Map();
    if (!clientIds || !clientIds.length) return m;
    const c = await ensureClient();
    if (!c) return m;
    try {
      const { data, error } = await c
        .from('chat_vote_counts')
        .select('chat_client_id, up, down, score')
        .in('chat_client_id', clientIds);
      if (error) {
        console.warn('pubchat: vote counts fetch failed', error.message || error);
        return m;
      }
      for (const r of (data || [])) m.set(r.chat_client_id, { up: r.up || 0, down: r.down || 0, score: r.score || 0 });
    } catch (e) {
      console.warn('pubchat: vote counts threw', e);
    }
    return m;
  }

  // Aggregated tag counts for one hotspot. Returns a Map<tag, votes>.
  async function fetchTagCounts(hotspotId) {
    const m = new Map();
    if (!hotspotId) return m;
    const c = await ensureClient();
    if (!c) return m;
    try {
      const { data, error } = await c
        .from('geofence_tag_counts')
        .select('tag, votes')
        .eq('hotspot_id', hotspotId);
      if (error) {
        console.warn('pubchat: tag counts fetch failed', error.message || error);
        return m;
      }
      for (const r of (data || [])) m.set(r.tag, r.votes || 0);
    } catch (e) {
      console.warn('pubchat: tag counts threw', e);
    }
    return m;
  }

  window.PubchatChat = {
    joinHotspot,
    leaveHotspot,
    sendMessage,
    deleteMessage,
    subscribeHotspot,
    isConfigured,
    currentHotspotId,
    setAppNamespace,
    recentMessages,
    fetchPollResults,
    submitPollVote,
    roomIdFor,
    // Unified city-wide chat v2
    subscribeCity,
    recentCityMessages,
    fetchVoteCounts,
    fetchTagCounts,
    CITY_ROOM_ID,
    CITY_CHANNEL,
  };
})();
