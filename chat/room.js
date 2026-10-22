// room.js — the wiring that makes a page part of the chat, shared by the
// chat map (/chat/) and by every app under /apps/ (owner 2026-10-22: use
// one app, show up in the others). A page loads the chat files, puts the
// chat window markup and a Visible button and a Chat button in its HTML,
// and calls ChatRoom.start. This file then: finds the neighborhood the
// phone is in (locate.js), joins its room (chat.js) under your name
// (auth.js), keeps the buttons and lines up to date, and opens the chat
// window (panel.js) when you press Chat. The page can pass hooks to draw
// the room and the people on its own map; the tour apps pass none.
//
// PLACES (owner 2026-10-22): inside a neighborhood you can narrow the chat
// to one business. The neighborhood's businesses come from
// chat/data/places/<neighborhood id>.json (tools/fetch-places.py, from
// OpenStreetMap) and are listed on the card by category; tapping one moves
// you to that business's room. Anyone standing in the neighborhood may pick
// any of its businesses. A room is named "<neighborhood>" or
// "<neighborhood>/<place id>"; everyone shares the neighborhood's one
// channel and only sees the lines of their own room. A business room opens
// even when empty, so a line can be left for the next person; the
// neighborhood room still needs someone else to be there.
//
// Elements, by id (any may be missing): visibleBtn, chatBtn, roomLine,
// peopleLine, youHandle, newName, placeList. A button with data-glyph="💬"
// shows that glyph (and a count) instead of the words from copy.js.
(function () {
  const CFG = window.MAP_CONFIG;
  const COPY = window.MAP_COPY;
  const $ = (id) => document.getElementById(id);
  const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

  let me = null;                // set by start(), once auth.js has signed you in
  // visibility: off until you turn it on (owner 2026-10-22: GPS for a tour
  // must not make you visible by itself), then remembered in this browser
  let visible = localStorage.getItem('austinchat:visible') === 'on';
  let room = null;              // the neighborhood (geofence feature) you are in
  let place = null;             // the business you picked in it, or null
  let others = [];              // the visible people in YOUR room who are not you
  let geofences = null;
  let hooks = {};
  const el = {};
  let testRoom = null;          // ?room=<id> joins a neighborhood without GPS (testing)
  let testPlace = null;         // ?place=<id> then picks that business

  const neighborhoodName = () => (room ? room.properties[CFG.nameField] : '');
  const roomName = () => (place ? place.name + ' · ' + neighborhoodName() : neighborhoodName());
  // the room string: "<neighborhood>" or "<neighborhood>/<place>"
  const roomId = () => (room ? room.properties.id + (place ? '/' + place.id : '') : null);

  function showMe() { if (el.youHandle) el.youHandle.textContent = me ? me.emoji + ' ' + me.handle : '…'; }

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
      if (place) line = (fill(COPY.people.atPlace, { place: place.name }) + ' ' + line).trim();
      el.peopleLine.textContent = room ? line : '';
    }
    const b = el.chatBtn;
    if (b) {
      // a business room opens even when empty; the neighborhood room needs someone else
      b.disabled = !(room && visible && (n > 0 || place));
      const base = b.dataset.glyph || COPY.chatButton;
      b.textContent = n > 0 ? base + ' ' + n : base;
    }
  }

  // "N here" beside the neighborhood row and each business, from the whole
  // channel's presence; only text changes, so open categories stay open
  function showCounts(list) {
    if (!el.placeList) return;
    const counts = {};
    list.forEach((p) => { counts[p.room] = (counts[p.room] || 0) + 1; });
    el.placeList.querySelectorAll('[data-room]').forEach((row) => {
      const n = counts[row.dataset.room] || 0;
      row.querySelector('.here').textContent = n ? fill(COPY.places.here, { n }) : '';
    });
  }

  function onPeople(list) {
    const mine = list.filter((p) => p.room === roomId());
    others = mine.filter((p) => !p.self);
    window.ChatPanel.setPeople(mine);
    showPeople();
    showCounts(list);
    if (hooks.onPeople) hooks.onPeople(list, room);      // the map shows everyone in the neighborhood
    // the window never opens by itself (owner 2026-10-22): the Chat button
    // lights up when someone else is visible, and you open it
  }

  // ── the business list on the card ─────────────────────────────────────────
  function showPlaces(data) {
    const list = el.placeList;
    list.innerHTML = '';
    if (!data || !data.categories.length) return;
    const row = (text, roomString, cls) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.dataset.room = roomString;
      const name = document.createElement('span'); name.className = 'place-name'; name.textContent = text;
      const here = document.createElement('span'); here.className = 'here';
      b.append(name, here);
      return b;
    };
    list.appendChild(row(COPY.places.neighborhoodRow, room.properties.id, 'place-row is-neighborhood is-current'));
    data.categories.forEach((cat) => {
      const d = document.createElement('details');
      const s = document.createElement('summary');
      s.textContent = cat.name + ' · ' + cat.places.length;
      d.appendChild(s);
      cat.places.forEach((p) => {
        const b = row(p.name, room.properties.id + '/' + p.id, 'place-row');
        b.title = p.address || p.name;
        b.dataset.place = JSON.stringify(p);
        d.appendChild(b);
      });
      list.appendChild(d);
    });
    const credit = document.createElement('div');
    credit.className = 'place-credit';
    credit.textContent = COPY.places.credit;
    list.appendChild(credit);
  }

  // move to a business room (or back to the neighborhood: picked = null)
  async function choose(picked) {
    place = picked;
    window.ChatPanel.close();
    window.ChatPanel.clear();
    if (el.placeList) el.placeList.querySelectorAll('[data-room]').forEach((r) => r.classList.toggle('is-current', r.dataset.room === roomId()));
    showPeople();
    if (hooks.onPlace) hooks.onPlace(place);
    await window.ChatEngine.setRoom(roomId());
  }

  // ── the neighborhood ──────────────────────────────────────────────────────
  // join a neighborhood's room (null = you are outside them all)
  async function enter(feature) {
    const before = room;
    room = feature;
    place = null;
    others = [];
    window.ChatPanel.close();
    window.ChatPanel.clear();
    if (el.placeList) el.placeList.innerHTML = '';
    if (hooks.onRoom) hooks.onRoom(feature, before);
    if (hooks.onPlace) hooks.onPlace(null);
    if (el.roomLine) el.roomLine.textContent = feature ? fill(COPY.room.inside, { name: neighborhoodName() }) : '';
    showPeople();
    if (!feature) { await window.ChatEngine.leave(); return; }
    await window.ChatEngine.join(feature.properties.id, me, visible, { onPeople, onMessage: (m) => window.ChatPanel.addMessage(m) });
    if (!el.placeList) return;                         // the tour apps: no list, no fetch
    const data = await fetch(CFG.places + feature.properties.id + '.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (room !== feature) return;                      // you moved on while it loaded
    if (hooks.onPlaces) hooks.onPlaces(data);
    showPlaces(data);
    showCounts(window.ChatEngine.people());
    if (testPlace && data) {
      const found = data.categories.flatMap((c) => c.places).find((p) => p.id === testPlace);
      if (found) await choose(found);
    }
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

    // options: { ids: { visibleBtn, chatBtn, ... },
    //            hooks: { onRoom(feature, before), onPeople(list, room), onPlaces(data), onPlace(place) } }
    async start(gj, options) {
      geofences = gj;
      hooks = (options && options.hooks) || {};
      const ids = Object.assign({ visibleBtn: 'visibleBtn', chatBtn: 'chatBtn', roomLine: 'roomLine', peopleLine: 'peopleLine', youHandle: 'youHandle', newName: 'newName', placeList: 'placeList' }, options && options.ids);
      Object.keys(ids).forEach((k) => { el[k] = $(ids[k]); });
      const params = new URLSearchParams(location.search);
      testRoom = params.get('room');
      testPlace = params.get('place');

      showMe();
      showVisible();
      showPeople();
      window.ChatPanel.init((text) => window.ChatEngine.send(text));
      me = await window.ChatIdentity.ready();       // the anonymous account, or the browser-only name
      showMe();

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
        me = await window.ChatIdentity.regenerate();
        showMe();
        if (room) await enter(room);          // rejoin under the new name
      });
      // one listener for the whole list: a tap on a row picks that room
      if (el.placeList) el.placeList.addEventListener('click', (e) => {
        const rowEl = e.target.closest('[data-room]');
        if (!rowEl || !room) return;
        choose(rowEl.dataset.place ? JSON.parse(rowEl.dataset.place) : null);
      });
      locate();
    },

    locate,                                   // find me again (after a refusal)
    get room() { return room; },
    get place() { return place; }
  };
})();
