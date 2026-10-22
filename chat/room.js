// room.js — the wiring that makes a page part of the chat, shared by the
// chat map (/chat/) and by every app under /apps/ (owner 2026-10-22: use
// one app, show up in the others). A page loads the chat files, puts the
// chat window markup and a Visible button and a Chat button in its HTML,
// and calls ChatRoom.start. This file then: finds the neighborhood the
// phone is in (locate.js), joins its room (chat.js) under your name
// (identity.js), keeps the buttons and lines up to date, and opens the
// chat window (panel.js) when you press Chat. The page can pass hooks to
// draw the room and the people on its own map; the tour apps pass none.
//
// Elements, by id (any may be missing): visibleBtn, chatBtn, roomLine,
// peopleLine, youHandle, newName. A button with data-glyph="💬" shows
// that glyph (and a count) instead of the words from copy.js.
(function () {
  const CFG = window.MAP_CONFIG;
  const COPY = window.MAP_COPY;
  const $ = (id) => document.getElementById(id);
  const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

  let me = window.ChatIdentity.get();
  // visibility: off until you turn it on (owner 2026-10-22: GPS for a tour
  // must not make you visible by itself), then remembered in this browser
  let visible = localStorage.getItem('austinchat:visible') === 'on';
  let room = null;              // the geofence feature you are in
  let others = [];              // the visible people who are not you
  let geofences = null;
  let hooks = {};
  const el = {};
  let testRoom = null;          // ?room=<id> joins a room without GPS (testing)

  const roomName = () => (room ? room.properties[CFG.nameField] : '');

  function showMe() { if (el.youHandle) el.youHandle.textContent = me.emoji + ' ' + me.handle; }

  function showVisible() {
    const b = el.visibleBtn;
    if (!b) return;
    b.setAttribute('aria-pressed', String(visible));
    b.title = visible ? COPY.visible : COPY.hidden;
    if (!b.dataset.glyph) b.textContent = visible ? COPY.visible : COPY.hidden;
  }

  function showPeople() {
    const n = others.length;
    if (el.peopleLine) {
      let line = n === 0 ? '' : n === 1 ? COPY.people.one : fill(COPY.people.many, { n });
      if (room && !visible) line = (line + ' ' + COPY.people.hiddenNote).trim();
      el.peopleLine.textContent = room ? line : '';
    }
    const b = el.chatBtn;
    if (b) {
      b.disabled = !(room && visible && n > 0);
      const base = b.dataset.glyph || COPY.chatButton;
      b.textContent = n > 0 ? base + ' ' + n : base;
    }
    if (hooks.onPeople) hooks.onPeople(window.ChatEngine.people(), room);
  }

  function onPeople(list) {
    others = list.filter((p) => !p.self);
    window.ChatPanel.setPeople(list);
    showPeople();
    // the window never opens by itself (owner 2026-10-22): the Chat button
    // lights up when someone else is visible, and you open it
  }

  // join a neighborhood's room (null = you are outside them all)
  async function enter(feature) {
    const before = room;
    room = feature;
    others = [];
    window.ChatPanel.close();
    window.ChatPanel.clear();
    if (hooks.onRoom) hooks.onRoom(feature, before);
    if (el.roomLine) el.roomLine.textContent = feature ? fill(COPY.room.inside, { name: roomName() }) : '';
    showPeople();
    if (!feature) { await window.ChatEngine.leave(); return; }
    await window.ChatEngine.join(feature.properties.id, me, visible, { onPeople, onMessage: (m) => window.ChatPanel.addMessage(m) });
  }

  const status = (s) => { if (s !== 'inside' && el.roomLine) el.roomLine.textContent = COPY.room[s]; };

  // where you are: the phone's GPS, or ?room=<id> for testing at a desk
  function locate() {
    if (testRoom) enter(geofences.features.find((f) => f.properties.id === testRoom) || null);
    else window.ChatLocate.start(geofences, enter, status);
  }

  window.ChatRoom = {
    // the geofences, for a page that does not load them itself
    load() { return fetch(CFG.geofences).then((r) => r.json()); },

    // options: { ids: { visibleBtn, chatBtn, ... }, hooks: { onRoom(feature, before), onPeople(list, room) } }
    start(gj, options) {
      geofences = gj;
      hooks = (options && options.hooks) || {};
      const ids = Object.assign({ visibleBtn: 'visibleBtn', chatBtn: 'chatBtn', roomLine: 'roomLine', peopleLine: 'peopleLine', youHandle: 'youHandle', newName: 'newName' }, options && options.ids);
      Object.keys(ids).forEach((k) => { el[k] = $(ids[k]); });
      testRoom = new URLSearchParams(location.search).get('room');

      showMe();
      showVisible();
      showPeople();
      window.ChatPanel.init((text) => window.ChatEngine.send(text));

      if (el.chatBtn) el.chatBtn.addEventListener('click', () => {
        if (window.ChatPanel.isOpen()) window.ChatPanel.close();
        else window.ChatPanel.open(roomName());
      });
      if (el.visibleBtn) el.visibleBtn.addEventListener('click', async () => {
        visible = !visible;
        localStorage.setItem('austinchat:visible', visible ? 'on' : 'off');
        showVisible();
        if (!visible) window.ChatPanel.close();
        await window.ChatEngine.setVisible(visible);
        showPeople();
      });
      if (el.newName) el.newName.addEventListener('click', async () => {
        me = window.ChatIdentity.regenerate();
        showMe();
        if (room) await enter(room);          // rejoin under the new name
      });
      locate();
    },

    locate,                                   // find me again (after a refusal)
    get room() { return room; }
  };
})();
