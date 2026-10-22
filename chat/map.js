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
// What happens: the map opens on all of Austin, every neighborhood in its
// own colour, and flies in over downtown, tilting up, as it loads (the
// owner's reference view). Tap a neighborhood and its border
// darkens. The card shows your name.
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

  // a colour per neighborhood: walk the list and give each the first palette
  // colour none of its neighbours has yet (neighbours = polygons whose boxes
  // overlap, close enough for a map of planning areas)
  function colourise(features) {
    const boxes = features.map((f) => boundsOf([f]));
    const touches = (a, b) => !(a[1][0] < b[0][0] || b[1][0] < a[0][0] || a[1][1] < b[0][1] || b[1][1] < a[0][1]);
    features.forEach((f, i) => {
      const taken = new Set(features.filter((g, j) => j < i && touches(boxes[i], boxes[j])).map((g) => g.properties.color));
      f.properties.color = CFG.palette.find((c) => !taken.has(c)) || CFG.palette[i % CFG.palette.length];
    });
  }

  // ── start: read the geofences, then build the map fitted to them ─────────
  fetch(CFG.geofences).then((r) => r.json()).then((geofences) => {
    colourise(geofences.features);
    const box = boundsOf(geofences.features);
    const byId = (id) => geofences.features.find((f) => f.properties.id === id) || null;
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

    // the control stack (right edge, same set as the walking-tour apps):
    // find me, 2D/3D, satellite, extents, zoom in, zoom out
    $('ctrlLocate').title = COPY.ui.locate;
    $('ctrlSatellite').title = COPY.ui.satellite;
    $('ctrlZoomIn').title = COPY.ui.zoomInBtn;
    $('ctrlZoomOut').title = COPY.ui.zoomOutBtn;
    $('ctrlExtent').title = COPY.ui.extents;
    $('ctrlZoomIn').addEventListener('click', () => map.zoomTo(map.getZoom() + 1, { duration: 250 }));
    $('ctrlZoomOut').addEventListener('click', () => map.zoomTo(map.getZoom() - 1, { duration: 250 }));
    // extents: all of Austin, flat and north-up (the way back after wandering)
    $('ctrlExtent').addEventListener('click', () => {
      tilted = false;
      showTilt();
      if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', 'none');
      const cam = map.cameraForBounds(box, { padding: CFG.fitPadding, bearing: 0 });
      if (cam) map.easeTo({ ...cam, pitch: 0, duration: 700 });
    });
    let satelliteOn = false;
    $('ctrlSatellite').addEventListener('click', () => {
      satelliteOn = !satelliteOn;
      map.setLayoutProperty('satellite', 'visibility', satelliteOn ? 'visible' : 'none');
      $('ctrlSatellite').setAttribute('aria-pressed', String(satelliteOn));
      $('ctrlSatellite').classList.toggle('is-on', satelliteOn);
    });
    // 3D: tilt the map and raise the buildings; 2D lays it flat again.
    // The map opens tilted: it rises to the pitch once the style has loaded.
    let tilted = true;
    const showTilt = () => {
      $('ctrlTilt').textContent = tilted ? '2D' : '3D';
      $('ctrlTilt').title = tilted ? COPY.ui.to2d : COPY.ui.to3d;
      $('ctrlTilt').setAttribute('aria-pressed', String(tilted));
      $('ctrlTilt').classList.toggle('is-on', tilted);
    };
    showTilt();
    const applyTilt = (duration) => {
      showTilt();
      if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', tilted ? 'visible' : 'none');
      map.easeTo({ pitch: tilted ? CFG.pitch : 0, duration });
    };
    $('ctrlTilt').addEventListener('click', () => { tilted = !tilted; applyTilt(600); });
    // a flight to a box that keeps the current tilt
    const flyTo = (b, padding, maxZoom) => {
      const cam = map.cameraForBounds(b, { padding, maxZoom, bearing: 0 });
      if (cam) map.easeTo({ ...cam, pitch: tilted ? CFG.pitch : 0, duration: 900 });
    };

    map.on('load', () => {
      // satellite imagery sits above the basemap and below the geofences
      map.addSource('satellite', { type: 'raster', tiles: [CFG.satellite], tileSize: 256, attribution: 'Tiles &copy; Esri' });
      map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });

      // the buildings as blocks, from the basemap's own building tiles
      // (positron carries OpenMapTiles' `building` layer with heights);
      // only shown while the map is tilted
      map.addLayer({ id: 'buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
        layout: { visibility: 'visible' },
        paint: { 'fill-extrusion-color': CFG.buildingColor, 'fill-extrusion-opacity': 0.8,
                 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
                 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] } });

      // the geofences: each in its own colour (fill stronger under the
      // pointer, strongest for your room); pale borders, a dark border on the
      // one you tapped, the accent border on your room; the name on top.
      // promoteId makes each feature's `id` property its feature id, which
      // is what feature-state needs.
      const state = (key) => ['boolean', ['feature-state', key], false];
      map.addSource('geofences', { type: 'geojson', data: geofences, promoteId: 'id' });
      map.addLayer({ id: 'geofence-fill', type: 'fill', source: 'geofences',
        paint: { 'fill-color': ['get', 'color'],
                 'fill-opacity': ['case', state('room'), CFG.fillRoom, state('hover'), CFG.fillHover, CFG.fill] } });
      map.addLayer({ id: 'geofence-line', type: 'line', source: 'geofences',
        layout: { 'line-join': 'round' },
        paint: { 'line-color': ['case', state('room'), CFG.roomColor, state('selected'), CFG.selectedColor, CFG.lineColor],
                 'line-width': ['case', state('room'), 3, state('selected'), 3, 1.5],
                 'line-opacity': ['case', state('room'), 1, state('selected'), 1, 0.9] } });
      map.addLayer({ id: 'geofence-label', type: 'symbol', source: 'geofences',
        layout: { 'symbol-placement': 'point', 'text-field': ['get', CFG.nameField], 'text-font': ['Noto Sans Bold'], 'text-size': CFG.labelSize },
        paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });

      // the opening move: from all of Austin flat, fly in over downtown
      // and tilt up (the owner's reference view); showTilt keeps the button
      // reading 2D while the map is tilted
      const opening = byId(CFG.openView.room);
      showTilt();
      map.easeTo({ center: opening ? centreOf(opening) : map.getCenter(), zoom: CFG.openView.zoom, pitch: CFG.pitch, bearing: 0, duration: CFG.openTiltMs });

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

      // click: the tapped neighborhood's border darkens (one at a time)
      let selected = null;
      map.on('click', 'geofence-fill', (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        if (selected !== null) map.setFeatureState({ source: 'geofences', id: selected }, { selected: false });
        selected = f.id === selected ? null : f.id;
        if (selected !== null) map.setFeatureState({ source: 'geofences', id: selected }, { selected: true });
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
        flyTo(boundsOf([feature]), 60, 14);
        $('roomLine').textContent = fill(COPY.room.inside, { name: feature.properties[CFG.nameField] });
        showPeople();
        await window.ChatEngine.join(feature.properties.id, me, visible, { onPeople, onMessage: (m) => window.ChatPanel.addMessage(m) });
      }

      // where you are: the phone's GPS, or ?room=<id> for testing at a desk
      const testRoom = new URLSearchParams(location.search).get('room');
      if (testRoom) enter(byId(testRoom));
      else window.ChatLocate.start(geofences, enter, (status) => {
        if (status !== 'inside') $('roomLine').textContent = COPY.room[status];
      });

      // find me: back to your neighborhood (or ask for the location again)
      $('ctrlLocate').addEventListener('click', () => {
        if (room) flyTo(boundsOf([room]), 60, 14);
        else if (!testRoom) window.ChatLocate.start(geofences, enter, (status) => { if (status !== 'inside') $('roomLine').textContent = COPY.room[status]; });
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
