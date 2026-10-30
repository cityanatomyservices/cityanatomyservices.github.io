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
// OpenStreetMap) and are listed on the card by group, then category
// (owner 2026-10-22: six groups); tapping one moves
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
  // must not make you visible by itself), then remembered during this visit
  let visible = window.AustinVisit.get('chat:visible') === 'on';
  let room = null;              // the neighborhood (geofence feature) you are in
  let place = null;             // the business you picked in it, or null
  let others = [];              // the visible people in YOUR room who are not you
  let geofences = null;
  let placesById = {};          // the neighborhood's businesses, by id (for the users list)
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
    b.title = COPY.visibleHint;
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
    el.placeList.querySelectorAll('[data-room]:not(.user-row)').forEach((row) => {
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
    showUsers(list);
    if (hooks.onPeople) hooks.onPeople(list, room);      // the map shows everyone in the neighborhood
    // the window never opens by itself (owner 2026-10-22): the Chat button
    // lights up when someone else is visible, and you open it
  }

  // the business a person is standing at or next to, from the position
  // they share while visible (within NEAR metres), else null
  const NEAR = 80;
  function nearest(pt) {
    let best = null, bestD = NEAR;
    Object.values(placesById).forEach((p) => {
      const d = window.ChatLocate.metres(pt, [p.lng, p.lat]);
      if (d < bestD) { best = p; bestD = d; }
    });
    return best;
  }

  // ── "Users visible": everyone visible in the neighborhood and where they
  // are — the business they picked, else the one they are standing near,
  // else the whole neighborhood. Tapping a person takes you to their room.
  // Rebuilt on every presence change.
  function showUsers(list) {
    const fold = el.placeList && el.placeList.querySelector('.users-fold');
    if (!fold) return;
    fold.querySelector('summary').textContent = COPY.places.usersVisible + ' · ' + list.length;
    fold.querySelectorAll('.user-row').forEach((r) => r.remove());
    list.forEach((person) => {
      const placeId = person.room.split('/')[1];
      const at = placeId ? placesById[placeId] : null;
      const near = !at && person.pos ? nearest(person.pos) : null;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'place-row user-row';
      b.dataset.room = person.room;
      if (at) b.dataset.place = JSON.stringify(at);
      const name = document.createElement('span'); name.className = 'place-name';
      const where = at ? at.name : near ? fill(COPY.places.near, { place: near.name }) : COPY.places.neighborhoodRow;
      name.textContent = person.emoji + ' ' + person.handle + (person.self ? ' ' + COPY.places.you : '') + ' · ' + where;
      const here = document.createElement('span'); here.className = 'here';   // keeps the row shape; showCounts leaves it empty
      b.append(name, here);
      fold.appendChild(b);
    });
  }

  // ── the business list on the card: group → category → business ───────────
  const allPlaces = (data) => (data ? data.groups : []).flatMap((g) => g.categories.flatMap((c) => c.places));
  function showPlaces(data) {
    const list = el.placeList;
    list.innerHTML = '';
    placesById = {};
    allPlaces(data).forEach((p) => {
      placesById[p.id] = p;
      (p.aliases || []).forEach((id) => { placesById[id] = p; });
    });
    if (!data) return;
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
    const fold = (title, count, cls) => {
      const d = document.createElement('details');
      d.className = cls;
      const s = document.createElement('summary');
      s.textContent = title + ' · ' + count;
      d.appendChild(s);
      return d;
    };
    list.appendChild(fold(COPY.places.usersVisible, 0, 'place-group users-fold'));
    list.appendChild(row(COPY.places.neighborhoodRow, room.properties.id, 'place-row is-neighborhood is-current'));
    data.groups.forEach((g) => {
      const total = g.categories.reduce((n, c) => n + c.places.length, 0);
      const gd = fold(g.name, total, 'place-group');
      g.categories.forEach((cat) => {
        const cd = fold(cat.name, cat.places.length, 'place-category');
        cat.places.forEach((p) => {
          const b = row(p.name, room.properties.id + '/' + p.id, 'place-row');
          b.title = p.address || p.name;
          b.dataset.place = JSON.stringify(p);
          const wrapper = document.createElement('div'); wrapper.className = 'plan-place-row';
          wrapper.appendChild(b); cd.appendChild(wrapper);
          window.dispatchEvent(new CustomEvent('austin:planner-target', { detail: { container: wrapper, provider: 'place', data: p } }));
        });
        gd.appendChild(cd);
      });
      list.appendChild(gd);
    });
    const credit = document.createElement('div');
    credit.className = 'place-credit';
    const sources = document.createElement('a');
    sources.href = 'https://github.com/cityanatomyservices/cityanatomyservices.github.io/blob/main/chat/data/README.md#business-directory';
    sources.target = '_blank';
    sources.rel = 'noopener noreferrer';
    sources.textContent = COPY.places.credit;
    credit.appendChild(sources);
    if (data.fetched) credit.appendChild(document.createTextNode(' · ' + fill(COPY.places.updated, { date: data.fetched })));
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
    if (!feature || !me) { await window.ChatEngine.leave(); return; }
    await window.ChatEngine.join(feature.properties.id, me, visible, { onPeople, onMessage: (m) => window.ChatPanel.addMessage(m) });
    if (!el.placeList) return;                         // the tour apps: no list, no fetch
    const file = feature.properties.id + '.json';
    const urls = [CFG.places + file];
    if (CFG.placesLive) urls.push(CFG.placesLive + file);
    // Scheduled bot commits do not trigger GitHub Pages. Read the current
    // repository copy as well, keeping Pages as a fallback if it is unavailable.
    const results = await Promise.allSettled(urls.map(async (url) => {
      const response = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Directory unavailable');
      const value = await response.json();
      if (value.id !== feature.properties.id || !Array.isArray(value.groups)) throw new Error('Invalid directory');
      return value;
    }));
    const data = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
      .sort((a, b) => String(b.fetched).localeCompare(String(a.fetched)))[0] || null;
    if (room !== feature) return;                      // you moved on while it loaded
    if (hooks.onPlaces) hooks.onPlaces(data);
    showPlaces(data);
    showCounts(window.ChatEngine.people());
    showUsers(window.ChatEngine.people());
    if (testPlace && data) {
      const found = allPlaces(data).find((p) => p.id === testPlace || (p.aliases || []).includes(testPlace));
      if (found) await choose(found);
    }
  }

  const status = (s) => { if (s !== 'inside' && el.roomLine) el.roomLine.textContent = COPY.room[s]; };

  // where you are: the phone's GPS, or ?room=<id> for testing at a desk —
  // the room is then fixed, but your marker still follows the GPS if the
  // browser has one
  const sharePosition = (pt) => window.ChatEngine.setPosition(pt);
  function locate() {
    if (testRoom) {
      enter(geofences.features.find((f) => f.properties.id === testRoom) || null);
      window.ChatLocate.start(geofences, () => {}, () => {}, sharePosition);
    } else window.ChatLocate.start(geofences, enter, status, sharePosition);
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
      me = await window.ChatIdentity.ready();
      if (window.AustinSession.registered) { try { visible = localStorage.getItem('austinchat:visible:' + window.ChatIdentity.userId()) === 'on'; } catch (_) {} }
      showMe(); showVisible(); showPeople();

      window.addEventListener('austin:identity-changing',()=>{
        me=null;visible=false;
        window.AustinVisit.set('chat:visible','off');
        window.ChatEngine.leave();
        window.ChatPanel.close();window.ChatPanel.clear();
        showMe();showVisible();onPeople([]);
      });
      window.addEventListener('austin:identity-changed',async event=>{
        me=event.detail;
        visible=false;
        if(window.AustinSession.registered) {
          try {visible=localStorage.getItem('austinchat:visible:'+window.ChatIdentity.userId())==='on';}catch(_){}
        }
        window.AustinVisit.set('chat:visible',visible?'on':'off');
        window.ChatPanel.close();window.ChatPanel.clear();
        showMe();showVisible();showPeople();
        if(room)await enter(room);
      });

      if (el.chatBtn) el.chatBtn.addEventListener('click', () => {
        if (window.ChatPanel.isOpen()) window.ChatPanel.close();
        else window.ChatPanel.open(roomName());
      });
      if (el.visibleBtn) el.visibleBtn.addEventListener('click', async () => {
        visible = !visible;
        window.AustinVisit.set('chat:visible', visible ? 'on' : 'off');
        if (window.AustinSession.registered) { try { localStorage.setItem('austinchat:visible:' + window.ChatIdentity.userId(), visible ? 'on' : 'off'); } catch (_) {} }
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
