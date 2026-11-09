// chat.js — the connection: one Supabase Realtime channel per neighborhood
// (`chat:<geofence id>`), the same pattern as the archived austin.chat
// engine. Presence says who is in the neighborhood and which room each
// person is in ("<neighborhood>" or "<neighborhood>/<place id>", see
// room.js); Broadcast carries the messages live, each tagged with its room,
// and a page only shows the lines of the room it is in. Each message is also written to the `messages` table (kept 30 days,
// supabase/migrations/0001_chat.sql), and a room's last lines are read back
// when you join it, so a room is not empty when you arrive. The Supabase
// client comes from auth.js, so the reads and writes carry your sign-in.
(function () {
  const MAX_TEXT = 240;                 // characters per message
  const MIN_GAP = 1000;                 // ms between two sends
  const HISTORY = 100;                  // lines read back on joining a room
  let channel = null, nbhd = null, roomId = null, ident = null, visible = false, cbs = {}, lastSend = 0;
  let generation = 0, roomGeneration = 0, policy = {}, presenceTimer = null;
  let closing = Promise.resolve(), connected = false;
  let pos = null;                       // your [lng, lat], rounded; shared only while visible
  let sentPos = null;                   // the last one the others were told
  const MOVE = 15;                      // metres you must move before they are told again

  const getClient = () => window.ChatIdentity.client();

  // everyone whose presence is on the neighborhood's channel, with the room
  // each is in; one entry per handle even when the same person has two tabs
  // open (an entry with no room is an older page: the neighborhood room)
  function people() {
    if (policy.liveOnly && !connected) return [];
    const state = channel ? channel.presenceState() : {};
    return Object.keys(state).map((key) => {
      const first = (policy.liveOnly ? state[key].find(p => p.room === roomId && p.expiresAt > Date.now()) : state[key][0]) || {};
      return { handle: first.handle || key, emoji: first.emoji || '🙂', room: first.room || nbhd, pos: first.pos || null, expiresAt: first.expiresAt, self: !!ident && key === ident.handle };
    }).filter(p => !policy.liveOnly || (p.room === roomId && p.expiresAt > Date.now()));
  }
  const allowed = () => !policy.canParticipate || policy.canParticipate();
  const announce = () => { if (cbs.onPeople) cbs.onPeople(people()); };
  const track = () => { if (!channel || !connected || !ident || !allowed()) return Promise.resolve(); sentPos = pos; return channel.track({ handle: ident.handle, emoji: ident.emoji, room: roomId, pos, joinedAt: Date.now(), ...(policy.liveOnly ? {expiresAt: policy.expiresAt()} : {}) }); };

  // the room's recent lines from the table (nothing when signed out or the
  // table is not there yet — the live chat works either way)
  async function history(room) {
    const attempt = generation, selection = ++roomGeneration;
    const uid = window.ChatIdentity.userId();
    if (policy.liveOnly || !uid || !cbs.onMessage) return;
    const { data } = await getClient().from('messages').select('user_id, handle, emoji, text, created_at')
      .eq('room', room).order('created_at', { ascending: false }).limit(HISTORY);
    if (attempt !== generation || selection !== roomGeneration || room !== roomId) return;
    (data || []).reverse().forEach((r) => cbs.onMessage?.({ handle: r.handle, emoji: r.emoji, text: r.text, t: Date.parse(r.created_at), self: r.user_id === uid }));
  }

  async function disconnect() {
    clearInterval(presenceTimer); presenceTimer = null; policy = {};
    const previous = channel; channel = null; connected = false; nbhd = roomId = null; cbs = {};
    // The SDK reuses channels by topic until removeChannel finishes. A new
    // GPS fix must wait even if an earlier leave already cleared `channel`.
    if (previous) {
      const client = getClient();
      closing = closing.then(async () => {
        try { await previous.untrack(); } catch (_) {}
        try { await client.removeChannel(previous); } catch (_) {}
      });
    }
    await closing;
  }

  window.addEventListener('pagehide', () => window.ChatEngine.leave());
  window.ChatEngine = {
    // join a neighborhood room. Visible = put yourself in Presence so the
    // others see you; hidden = listen only. callbacks: onPeople(list), onMessage(m)
    async join(neighborhood, identity, isVisible, callbacks, options = {}) {
      const attempt = ++generation;
      await disconnect();
      if (attempt !== generation) return;
      if (options.liveOnly && (!isVisible || !options.canParticipate())) return;
      policy = options;
      nbhd = roomId = neighborhood; ident = identity; visible = isVisible; cbs = callbacks || {};
      channel = getClient().channel('chat:' + neighborhood, { config: { broadcast: { self: false, ack: !!options.liveOnly }, presence: { key: identity.handle } } });
      const joined = channel;
      channel.on('broadcast', { event: 'msg' }, (p) => {
        if (attempt !== generation) return;
        const m = p.payload;
        if (policy.liveOnly && (!visible || !allowed() || !people().some(person => !person.self && person.handle === m?.handle))) return;
        if (cbs.onMessage && m && (m.room || nbhd) === roomId) cbs.onMessage(m);   // only your room's lines
      });
      channel.on('presence', { event: 'sync' }, () => { if (attempt === generation) announce(); });
      await history(roomId);
      if (attempt !== generation) return;
      await new Promise((resolve) => joined.subscribe(async (status) => {
        if (attempt !== generation) { resolve(); return; }
        if (status === 'SUBSCRIBED') {
          connected = true;
          if (visible) { try { await track(); } catch (_) {} }
          if (attempt === generation && policy.liveOnly && !presenceTimer) presenceTimer = setInterval(announce, 5000);
          resolve();
        }
        else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
          connected = false;
          announce();
          resolve();
        }
      }));
    },
    // move to another room in the same neighborhood ("<neighborhood>/<place>"
    // or back to "<neighborhood>"): tell the others, read that room's lines
    async setRoom(room) {
      roomId = room;
      if (!channel) return;
      if (visible) await track();
      announce();
      await history(roomId);
    },
    async leave() {
      generation++; roomGeneration++;
      await disconnect();
    },
    async setVisible(on) {
      visible = on;
      if (!channel) return;
      if (on) await track(); else await channel.untrack();
      announce();
    },
    // where you are (from locate.js): kept here, and told to the room while
    // you are visible, once you have moved far enough to matter
    async setPosition(pt) {
      pos = [Math.round(pt[0] * 1e4) / 1e4, Math.round(pt[1] * 1e4) / 1e4];   // 4 decimals ≈ 10 m
      if (!channel || !visible) return;
      if (!policy.liveOnly && sentPos && window.ChatLocate.metres(sentPos, pos) < MOVE) return;
      await track();
    },
    // send a line to the room; false when it was not sent (empty, too soon, hidden)
    async send(text) {
      const trimmed = String(text || '').trim().slice(0, MAX_TEXT);
      const now = Date.now();
      if (!trimmed || !channel || !visible || !allowed() || now - lastSend < MIN_GAP) return false;
      if (policy.liveOnly && (!connected || !people().some(p => !p.self))) return false;
      lastSend = now;
      const liveOnly = policy.liveOnly, uid = window.ChatIdentity.userId();
      const payload = { handle: ident.handle, emoji: ident.emoji, text: trimmed, t: now, room: roomId };
      const sending = channel, attempt = generation, selection = roomGeneration;
      if (!liveOnly && cbs.onMessage) cbs.onMessage({ ...payload, self: true });
      try {
        const result = await sending.send({ type: 'broadcast', event: 'msg', payload });
        if (liveOnly && result !== 'ok') return false;
      } catch (e) { return false; }
      if (liveOnly) {
        if (attempt !== generation || selection !== roomGeneration || channel !== sending || roomId !== payload.room || !visible || !allowed()) return false;
        // Acknowledgement confirms server receipt, not that every peer read it.
        if (cbs.onMessage) cbs.onMessage({ ...payload, self: true });
      }
      // Only registered accounts leave saved messages; guest chat is live-only.
      if (!liveOnly && uid && window.AustinSession.registered) getClient().from('messages').insert({ room: payload.room, user_id: uid, handle: payload.handle, emoji: payload.emoji, text: trimmed })
        .then(({ error }) => { if (error) console.warn('austin.chat: message not kept', error.message); });
      return true;
    },
    people,
    get room() { return roomId; },
    get position() { return pos; },     // your own last reading (null at a desk)
    maxText: MAX_TEXT
  };
})();
