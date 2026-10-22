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
  let pos = null;                       // your [lng, lat], rounded; shared only while visible
  let sentPos = null;                   // the last one the others were told
  const MOVE = 15;                      // metres you must move before they are told again

  const getClient = () => window.ChatIdentity.client();

  // everyone whose presence is on the neighborhood's channel, with the room
  // each is in; one entry per handle even when the same person has two tabs
  // open (an entry with no room is an older page: the neighborhood room)
  function people() {
    const state = channel ? channel.presenceState() : {};
    return Object.keys(state).map((key) => {
      const first = state[key][0] || {};
      return { handle: first.handle || key, emoji: first.emoji || '🙂', room: first.room || nbhd, pos: first.pos || null, self: !!ident && key === ident.handle };
    });
  }
  const announce = () => { if (cbs.onPeople) cbs.onPeople(people()); };
  const track = () => { sentPos = pos; return channel.track({ handle: ident.handle, emoji: ident.emoji, room: roomId, pos, joinedAt: Date.now() }); };

  // the room's recent lines from the table (nothing when signed out or the
  // table is not there yet — the live chat works either way)
  async function history(room) {
    const uid = window.ChatIdentity.userId();
    if (!uid || !cbs.onMessage) return;
    const { data } = await getClient().from('messages').select('user_id, handle, emoji, text, created_at')
      .eq('room', room).order('created_at', { ascending: false }).limit(HISTORY);
    (data || []).reverse().forEach((r) => cbs.onMessage({ handle: r.handle, emoji: r.emoji, text: r.text, t: Date.parse(r.created_at), self: r.user_id === uid }));
  }

  window.ChatEngine = {
    // join a neighborhood room. Visible = put yourself in Presence so the
    // others see you; hidden = listen only. callbacks: onPeople(list), onMessage(m)
    async join(neighborhood, identity, isVisible, callbacks) {
      await this.leave();
      nbhd = roomId = neighborhood; ident = identity; visible = isVisible; cbs = callbacks || {};
      channel = getClient().channel('chat:' + neighborhood, { config: { broadcast: { self: false }, presence: { key: identity.handle } } });
      channel.on('broadcast', { event: 'msg' }, (p) => {
        const m = p.payload;
        if (cbs.onMessage && m && (m.room || nbhd) === roomId) cbs.onMessage(m);   // only your room's lines
      });
      channel.on('presence', { event: 'sync' }, announce);
      await history(roomId);
      await new Promise((resolve) => channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { if (visible) await track(); resolve(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve();
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
      if (!channel) return;
      const c = channel; channel = null; nbhd = roomId = null;
      try { await c.untrack(); } catch (e) { /* already gone */ }
      try { await getClient().removeChannel(c); } catch (e) { /* already gone */ }
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
      if (sentPos && window.ChatLocate.metres(sentPos, pos) < MOVE) return;
      await track();
    },
    // send a line to the room; false when it was not sent (empty, too soon, hidden)
    async send(text) {
      const trimmed = String(text || '').trim().slice(0, MAX_TEXT);
      const now = Date.now();
      if (!trimmed || !channel || !visible || now - lastSend < MIN_GAP) return false;
      lastSend = now;
      const payload = { handle: ident.handle, emoji: ident.emoji, text: trimmed, t: now, room: roomId };
      if (cbs.onMessage) cbs.onMessage({ ...payload, self: true });     // your own line shows at once
      try { await channel.send({ type: 'broadcast', event: 'msg', payload }); } catch (e) { return false; }
      // and into the table for the next person; a failure here changes nothing live
      const uid = window.ChatIdentity.userId();
      if (uid) getClient().from('messages').insert({ room: roomId, user_id: uid, handle: ident.handle, emoji: ident.emoji, text: trimmed })
        .then(({ error }) => { if (error) console.warn('austin.chat: message not kept', error.message); });
      return true;
    },
    people,
    get room() { return roomId; },
    maxText: MAX_TEXT
  };
})();
