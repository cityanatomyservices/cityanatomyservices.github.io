// map.js — the chat map: the neighborhood geofences on a MapLibre map with
// the same controls as the topic maps (Satellite, zoom in, zoom out, fit)
// and a fold card; then the wiring that makes it a chat: your identity
// (identity.js), the neighborhood your phone is in (locate.js), the room's
// channel (chat.js) and the chat window (panel.js).
//
// The controls are the same markup and stylesheet as /datacenters/; their
// few lines of code are repeated here on purpose, because the topic map
// engine (../topicmap/app.js) is built around dots, categories and a story
// timeline, none of which this map has.
//
// What happens: the map opens on all of Austin. The card shows your name.
// Your phone's GPS puts you in one geofence: that polygon tints, the map
// eases to it, and you join its room. Visible (the default) means the
// others in the room see your emoji on the neighborhood; Hidden means you
// only watch. When you are visible and someone else is too, the chat
// window opens by itself; the Chat button opens and closes it after that.
// Leave the geofence and the room changes with you.
(function () {
  const CFG = window.MAP_CONFIG;
  const COPY = window.MAP_COPY;
  const $ = (id) => document.getElementById(id);

  document.title = COPY.pageTitle;
  $('title').textContent = COPY.pageTitle;
  $('legendTitle').textContent = COPY.legendTitle;
  $('legendSub').textContent = COPY.legendSub;
  $('youLabel').textContent = COPY.you;
  $('newName').textContent = COPY.newName;
  $('chatBtn').textContent = COPY.chatButton;
  $('aboutToggle').textContent = COPY.ui.about;
  $('aboutWhat').textContent = COPY.about.what;
  $('aboutSourcesLabel').textContent = COPY.ui.sources;
  $('aboutSources').textContent = COPY.about.sources;

  // the card folds with the arrow in its title (same as the topic maps)
  const setCard = (open) => {
    $('legendTitle').setAttribute('aria-expanded', String(open));
    $('legendBody').hidden = !open;
    $('legend').classList.toggle('is-collapsed', !open);
  };
  $('legendTitle').addEventListener('click', () => setCard($('legendTitle').getAttribute('aria-expanded') !== 'true'));
  $('aboutToggle').addEventListener('click', () => {
    const open = $('about').hidden;
    $('about').hidden = !open;
    $('aboutToggle').setAttribute('aria-expanded', String(open));
    $('aboutToggle').textContent = open ? COPY.ui.aboutClose : COPY.ui.about;
  });

  // the bounding box of a polygon, or of every polygon: what the map opens
  // on, refits to, and eases to when you join a room
  function boundsOf(features) {
    const b = [[Infinity, Infinity], [-Infinity, -Infinity]];
    const walk = (c) => {
      if (typeof c[0] === 'number') {
        b[0][0] = Math.min(b[0][0], c[0]); b[0][1] = Math.min(b[0][1], c[1]);
        b[1][0] = Math.max(b[1][0], c[0]); b[1][1] = Math.max(b[1][1], c[1]);
      } else c.forEach(walk);
    };
    features.forEach((f) => walk(f.geometry.coordinates));
    return b;
  }
  const centreOf = (feature) => { const b = boundsOf([feature]); return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

  // ── you ──────────────────────────────────────────────────────────────────
  let me = window.ChatIdentity.get();
  const showMe = () => { $('youHandle').textContent = me.emoji + ' ' + me.handle; };
  showMe();

  // visibility: remembered per browser, on unless you turned it off
  let visible = localStorage.getItem('austinchat:visible') !== 'off';
  const showVisible = () => {
    $('visibleBtn').textContent = visible ? COPY.visible : COPY.hidden;
    $('visibleBtn').setAttribute('aria-pressed', String(visible));
    $('visibleBtn').classList.toggle('is-on', visible);
  };
  showVisible();

  // ── start: read the geofences, then build the map fitted to them ─────────
  fetch(CFG.geofences).then((r) => r.json()).then((geofences) => {
    const box = boundsOf(geofences.features);
    const pad = CFG.cagePad;
    const cage = [[box[0][0] - pad, box[0][1] - pad], [box[1][0] + pad, box[1][1] + pad]];

    const map = new maplibregl.Map({
      container: 'map',
      style: CFG.basemap,
      bounds: box,
      fitBoundsOptions: { padding: CFG.fitPadding },
      minZoom: CFG.minZoom,
      maxBounds: cage,
      attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: COPY.attribution }));
    const attribution = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
    if (attribution) {                 // start with only the info button, not the open strip
      attribution.classList.remove('maplibregl-compact-show');
      attribution.removeAttribute('open');
    }

    // the control row: satellite, zoom in, zoom out, fit
    $('ctrlSatellite').textContent = COPY.ui.satellite;
    $('ctrlSatellite').title = COPY.ui.satellite;
    $('ctrlZoomIn').title = COPY.ui.zoomInBtn;
    $('ctrlZoomOut').title = COPY.ui.zoomOutBtn;
    $('ctrlExtent').title = COPY.ui.extents;
    $('ctrlZoomIn').addEventListener('click', () => map.zoomIn());
    $('ctrlZoomOut').addEventListener('click', () => map.zoomOut());
    $('ctrlExtent').addEventListener('click', () => map.fitBounds(box, { padding: CFG.fitPadding, pitch: 0, bearing: 0 }));
    let satelliteOn = false;
    $('ctrlSatellite').addEventListener('click', () => {
      satelliteOn = !satelliteOn;
      map.setLayoutProperty('satellite', 'visibility', satelliteOn ? 'visible' : 'none');
      $('ctrlSatellite').setAttribute('aria-pressed', String(satelliteOn));
      $('ctrlSatellite').classList.toggle('is-on', satelliteOn);
    });

    map.on('load', () => {
      // satellite imagery sits above the basemap and below the geofences
      map.addSource('satellite', { type: 'raster', tiles: [CFG.satellite], tileSize: 256, attribution: 'Tiles &copy; Esri' });
      map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });

      // the geofences: fill (stronger under the pointer, strongest for your
      // room), outline, name. promoteId makes each feature's `id` property
      // its feature id, which is what feature-state needs.
      map.addSource('geofences', { type: 'geojson', data: geofences, promoteId: 'id' });
      map.addLayer({ id: 'geofence-fill', type: 'fill', source: 'geofences',
        paint: { 'fill-color': CFG.color,
                 'fill-opacity': ['case', ['boolean', ['feature-state', 'room'], false], CFG.fillRoom,
                                          ['boolean', ['feature-state', 'hover'], false], CFG.fillHover, CFG.fill] } });
      map.addLayer({ id: 'geofence-line', type: 'line', source: 'geofences',
        paint: { 'line-color': CFG.color, 'line-width': ['case', ['boolean', ['feature-state', 'room'], false], 2.5, 1.2] } });
      map.addLayer({ id: 'geofence-label', type: 'symbol', source: 'geofences',
        layout: { 'symbol-placement': 'point', 'text-field': ['get', CFG.nameField], 'text-font': ['Noto Sans Bold'], 'text-size': CFG.labelSize },
        paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });

      // hover: tint the polygon under the pointer
      let hovered = null;
      map.on('mousemove', 'geofence-fill', (e) => {
        const f = e.features && e.features[0];
        if (!f || f.id === hovered) return;
        if (hovered !== null) map.setFeatureState({ source: 'geofences', id: hovered }, { hover: false });
        hovered = f.id;
        map.setFeatureState({ source: 'geofences', id: hovered }, { hover: true });
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'geofence-fill', () => {
        if (hovered !== null) map.setFeatureState({ source: 'geofences', id: hovered }, { hover: false });
        hovered = null;
        map.getCanvas().style.cursor = '';
      });

      // click: the neighborhood's name
      map.on('click', 'geofence-fill', (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        new maplibregl.Popup({ maxWidth: '260px' }).setLngLat(e.lngLat)
          .setHTML(`<h3>${esc(f.properties[CFG.nameField])}</h3>`).addTo(map);
      });

      // ── the room ──────────────────────────────────────────────────────────
      let room = null;                     // the geofence feature you are in
      let others = [];                     // the visible people who are not you
      let openedFor = null;                // the room the window opened itself for
      const avatars = new maplibregl.Marker({ element: document.createElement('div'), anchor: 'bottom' });
      avatars.getElement().className = 'avatars';

      const showPeople = () => {
        const n = others.length;
        let line = n === 0 ? COPY.people.none : n === 1 ? COPY.people.one : fill(COPY.people.many, { n });
        if (!visible) line += ' ' + COPY.people.hiddenNote;
        $('peopleLine').textContent = room ? line : '';
        $('chatBtn').disabled = !(room && visible && n > 0);
        // the emoji row on the neighborhood: everyone visible, you included
        const shown = window.ChatEngine.people();
        if (room && shown.length) {
          avatars.getElement().textContent = shown.map((p) => p.emoji).join('');
          avatars.setLngLat(centreOf(room)).addTo(map);
        } else avatars.remove();
      };

      const onPeople = (list) => {
        others = list.filter((p) => !p.self);
        window.ChatPanel.setPeople(list);
        showPeople();
        // the connection: you are visible, someone else is, the window opens
        if (room && visible && others.length && openedFor !== room.properties.id) {
          openedFor = room.properties.id;
          window.ChatPanel.open(room.properties[CFG.nameField]);
        }
      };

      async function enter(feature) {
        if (room) map.setFeatureState({ source: 'geofences', id: room.properties.id }, { room: false });
        room = feature;
        others = [];
        window.ChatPanel.close();
        window.ChatPanel.clear();
        if (!feature) { await window.ChatEngine.leave(); showPeople(); return; }
        map.setFeatureState({ source: 'geofences', id: feature.properties.id }, { room: true });
        map.fitBounds(boundsOf([feature]), { padding: 60, maxZoom: 14, duration: 900 });
        $('roomLine').textContent = fill(COPY.room.inside, { name: feature.properties[CFG.nameField] });
        showPeople();
        await window.ChatEngine.join(feature.properties.id, me, visible, { onPeople, onMessage: (m) => window.ChatPanel.addMessage(m) });
      }

      // where you are: the phone's GPS, or ?room=<id> for testing at a desk
      const testRoom = new URLSearchParams(location.search).get('room');
      const byId = (id) => geofences.features.find((f) => f.properties.id === id) || null;
      if (testRoom) enter(byId(testRoom));
      else window.ChatLocate.start(geofences, enter, (status) => {
        if (status !== 'inside') $('roomLine').textContent = COPY.room[status];
      });

      // the buttons
      window.ChatPanel.init((text) => window.ChatEngine.send(text));
      $('chatBtn').addEventListener('click', () => {
        if (window.ChatPanel.isOpen()) window.ChatPanel.close();
        else window.ChatPanel.open(room.properties[CFG.nameField]);
      });
      $('visibleBtn').addEventListener('click', async () => {
        visible = !visible;
        localStorage.setItem('austinchat:visible', visible ? 'on' : 'off');
        showVisible();
        if (!visible) window.ChatPanel.close();
        await window.ChatEngine.setVisible(visible);
        showPeople();
      });
      $('newName').addEventListener('click', async () => {
        me = window.ChatIdentity.regenerate();
        showMe();
        if (room) await enter(room);       // rejoin under the new name
      });

      // the map object, so it can be poked at from the browser console
      window.chatMap = map;
    });
  });
})();
