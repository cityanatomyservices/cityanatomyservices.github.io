// chat.js — the connection: one Supabase Realtime channel per neighborhood
// (`chat:<geofence id>`), the same pattern as the archived austin.chat
// engine. Presence says who is in the room; Broadcast carries the messages.
// Nothing is stored (docs/CHAT-PLAN.md §4 proposes a 30-day `messages`
// table later). The anon key is public by design: it opens channels, not
// tables. Loaded from supabase-js (UMD build, index.html), which puts
// `supabase.createClient` on the window.
(function () {
  const CFG = window.MAP_CONFIG;
  const MAX_TEXT = 240;                 // characters per message
  const MIN_GAP = 1000;                 // ms between two sends
  let client = null, channel = null, ident = null, visible = false, cbs = {}, lastSend = 0;

  function getClient() {
    if (!client) client = window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey, { realtime: { params: { eventsPerSecond: 5 } } });
    return client;
  }

  // everyone whose presence is on the channel; one entry per handle even
  // when the same person has two tabs open
  function people() {
    const state = channel ? channel.presenceState() : {};
    return Object.keys(state).map((key) => {
      const first = state[key][0] || {};
      return { handle: first.handle || key, emoji: first.emoji || '🙂', self: !!ident && key === ident.handle };
    });
  }
  const announce = () => { if (cbs.onPeople) cbs.onPeople(people()); };
  const track = () => channel.track({ handle: ident.handle, emoji: ident.emoji, joinedAt: Date.now() });

  window.ChatEngine = {
    // join a neighborhood room. Visible = put yourself in Presence so the
    // others see you; hidden = listen only. callbacks: onPeople(list), onMessage(m)
    async join(roomId, identity, isVisible, callbacks) {
      await this.leave();
      ident = identity; visible = isVisible; cbs = callbacks || {};
      channel = getClient().channel('chat:' + roomId, { config: { broadcast: { self: false }, presence: { key: identity.handle } } });
      channel.on('broadcast', { event: 'msg' }, (p) => { if (cbs.onMessage && p.payload) cbs.onMessage(p.payload); });
      channel.on('presence', { event: 'sync' }, announce);
      await new Promise((resolve) => channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { if (visible) await track(); resolve(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve();
      }));
    },
    async leave() {
      if (!channel) return;
      const c = channel; channel = null;
      try { await c.untrack(); } catch (e) { /* already gone */ }
      try { await getClient().removeChannel(c); } catch (e) { /* already gone */ }
    },
    async setVisible(on) {
      visible = on;
      if (!channel) return;
      if (on) await track(); else await channel.untrack();
      announce();
    },
    // send a line to the room; false when it was not sent (empty, too soon, hidden)
    async send(text) {
      const trimmed = String(text || '').trim().slice(0, MAX_TEXT);
      const now = Date.now();
      if (!trimmed || !channel || !visible || now - lastSend < MIN_GAP) return false;
      lastSend = now;
      const payload = { handle: ident.handle, emoji: ident.emoji, text: trimmed, t: now };
      if (cbs.onMessage) cbs.onMessage({ ...payload, self: true });     // your own line shows at once
      try { await channel.send({ type: 'broadcast', event: 'msg', payload }); } catch (e) { return false; }
      return true;
    },
    people,
    maxText: MAX_TEXT
  };
})();
