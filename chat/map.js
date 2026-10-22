// map.js — the chat map: the neighborhood geofences on a MapLibre map with
// the same controls as the topic maps (Satellite, zoom in, zoom out, fit)
// and a fold card. The chat itself is wired by room.js (shared with the
// apps): your identity (auth.js), the neighborhood your phone is in
// (locate.js), the room's channel (chat.js), the chat window (panel.js);
// this file only draws the room and the people on the map.
//
// The controls are the same markup and stylesheet as /datacenters/; their
// few lines of code are repeated here on purpose, because the topic map
// engine (../topicmap/app.js) is built around dots, categories and a story
// timeline, none of which this map has.
//
// What happens: the map opens on all of Austin, every neighborhood in its
// own colour, and flies in over downtown, tilting up, as it loads (the
// owner's reference view). Tap a neighborhood and its border darkens. Your
// phone's GPS puts you in one geofence: that polygon tints and the map
// eases to it. The rest (the room, the business list, the Visible button,
// the Chat button, the window) is room.js; this file draws the people where
// they are and a pin on the business you picked.
(function () {
  const CFG = window.MAP_CONFIG;
  const COPY = window.MAP_COPY;
  const $ = (id) => document.getElementById(id);

  document.title = COPY.pageTitle;
  $('legendTitle').textContent = COPY.legendTitle;
  $('youLabel').textContent = COPY.you;
  $('newName').textContent = COPY.newName;
  $('chatBtn').textContent = COPY.chatButton;

  // the card folds with the arrow in its title (same as the topic maps);
  // it starts CLOSED (owner 2026-10-22), showing only the title and the
  // people line, which sits outside the fold
  const setCard = (open) => {
    $('legendTitle').setAttribute('aria-expanded', String(open));
    $('legendBody').hidden = !open;
    $('legend').classList.toggle('is-collapsed', !open);
  };
  setCard(false);
  $('legendTitle').addEventListener('click', () => setCard($('legendTitle').getAttribute('aria-expanded') !== 'true'));

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

    const map = new maplibregl.Map({
      container: 'map',
      style: CFG.basemap,
      bounds: box,
      fitBoundsOptions: { padding: CFG.fitPadding },
      attributionControl: false
    });

    // the limits (owner 2026-10-22): no zooming out past the City view, and
    // the map can be pushed almost off the screen but never all the way —
    // a tenth of the screen (keepOnScreen) must still show it. The pan
    // limit is the geofences' box widened by what the screen shows at the
    // current zoom, so it is worked out again after every zoom or resize.
    const keepInView = () => {
      const b = map.getBounds();
      const w = (b.getEast() - b.getWest()) * (1 - CFG.keepOnScreen);
      const h = (b.getNorth() - b.getSouth()) * (1 - CFG.keepOnScreen);
      map.setMaxBounds([[box[0][0] - w, box[0][1] - h], [box[1][0] + w, box[1][1] + h]]);
    };
    const limitZoom = () => {
      const cam = map.cameraForBounds(box, { padding: CFG.fitPadding });
      if (cam) map.setMinZoom(cam.zoom);
    };
    map.on('zoomend', keepInView);
    map.on('resize', () => { limitZoom(); keepInView(); });
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
    const cityView = () => {
      setTilt(false);
      const cam = map.cameraForBounds(box, { padding: CFG.fitPadding, bearing: 0 });
      if (cam) map.easeTo({ ...cam, pitch: 0, duration: 700 });
    };
    $('ctrlExtent').addEventListener('click', cityView);

    // the three view buttons (bottom right). Neighborhood = the opening view
    // (your own neighborhood once the phone has found it, else downtown),
    // tilted; Street = flat, down to the block; City = all of Austin, flat.
    const V = CFG.views;
    const neighborhoodView = (duration) => {
      const target = (window.ChatRoom && window.ChatRoom.room) || byId(CFG.openView.room);
      setTilt(true);
      map.easeTo({ center: target ? centreOf(target) : map.getCenter(), zoom: V.neighborhood.zoom, pitch: V.neighborhood.pitch, bearing: 0, duration });
    };
    const streetView = () => {
      setTilt(false);
      map.easeTo({ zoom: V.street.zoom, pitch: V.street.pitch, bearing: 0, duration: 700 });
    };
    $('viewStreet').textContent = COPY.ui.street;
    $('viewNeighborhood').textContent = COPY.ui.neighborhood;
    $('viewCity').textContent = COPY.ui.city;
    $('viewStreet').addEventListener('click', streetView);
    $('viewNeighborhood').addEventListener('click', () => neighborhoodView(900));
    $('viewCity').addEventListener('click', cityView);
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
    const setTilt = (on) => {               // the button and the buildings follow the state
      tilted = on;
      showTilt();
      if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', tilted ? 'visible' : 'none');
    };
    const applyTilt = (duration) => {
      setTilt(tilted);
      map.easeTo({ pitch: tilted ? CFG.pitch : 0, duration });
    };
    $('ctrlTilt').addEventListener('click', () => { tilted = !tilted; applyTilt(600); });
    // a flight to a box that keeps the current tilt
    const flyTo = (b, padding, maxZoom) => {
      const cam = map.cameraForBounds(b, { padding, maxZoom, bearing: 0 });
      if (cam) map.easeTo({ ...cam, pitch: tilted ? CFG.pitch : 0, duration: 900 });
    };

    map.on('load', () => {
      limitZoom();
      keepInView();

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
      neighborhoodView(CFG.openTiltMs);

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

      // ── the room: room.js does the joining; these hooks draw it ───────────
      // the people: one emoji row per room — on the business they picked, or
      // on the neighborhood for the neighborhood room (owner 2026-10-22: see
      // on the map where everyone visible in your neighborhood is)
      const markers = {};                              // room string -> Marker
      const placePoints = {};                          // place id -> [lng, lat], from the loaded list
      const rowOf = (roomString) => roomString.split('/')[1];
      let placeMarker = null;                          // the business you picked
      let placePopup = null;                           // and its popup
      window.ChatRoom.start(geofences, { hooks: {
        // your room: the old one loses its tint, the new one gains it, the map flies there
        onRoom(feature, before) {
          if (before) map.setFeatureState({ source: 'geofences', id: before.properties.id }, { room: false });
          if (!feature) return;
          map.setFeatureState({ source: 'geofences', id: feature.properties.id }, { room: true });
          flyTo(boundsOf([feature]), 60, V.neighborhood.zoom);
        },
        // the neighborhood's business list arrived: remember where each one is
        onPlaces(data) {
          Object.keys(placePoints).forEach((k) => delete placePoints[k]);
          (data ? data.categories : []).forEach((c) => c.places.forEach((p) => { placePoints[p.id] = [p.lng, p.lat]; }));
        },
        // the business you picked: the map goes there at street level (flat,
        // like the Street button) and a popup names it with Google Maps,
        // Apple Maps and Yelp links (owner 2026-10-22: web addresses only,
        // no API). Picking the neighborhood row again clears it.
        onPlace(place) {
          if (placeMarker) { placeMarker.remove(); placeMarker = null; }
          if (placePopup) { placePopup.remove(); placePopup = null; }
          if (!place) return;
          const at = [place.lng, place.lat];
          placeMarker = new maplibregl.Marker({ color: CFG.roomColor }).setLngLat(at).addTo(map);
          setTilt(false);
          map.easeTo({ center: at, zoom: V.street.zoom, pitch: 0, bearing: 0, duration: 900 });
          const vars = { lat: place.lat, lng: place.lng, name: encodeURIComponent(place.name) };
          const link = (key) => `<a href="${esc(fill(CFG.placeLinks[key], vars))}" target="_blank" rel="noopener">${esc(COPY.places[key])}</a>`;
          placePopup = new maplibregl.Popup({ offset: 36, maxWidth: '280px', closeOnClick: false })
            .setLngLat(at)
            .setHTML(`<div class="place-popup"><h3>${esc(place.name)}</h3>` +
                     (place.address ? `<p class="addr">${esc(place.address)}</p>` : '') +
                     `<div class="place-links">${link('google')}${link('apple')}${link('yelp')}</div></div>`)
            .addTo(map);
        },
        // everyone visible in the neighborhood, grouped by room, drawn where that room is
        onPeople(list, feature) {
          const groups = {};
          list.forEach((p) => { (groups[p.room] = groups[p.room] || []).push(p.emoji); });
          Object.keys(markers).forEach((r) => { if (!groups[r]) { markers[r].remove(); delete markers[r]; } });
          if (!feature) return;
          Object.keys(groups).forEach((r) => {
            const at = placePoints[rowOf(r)] || centreOf(feature);
            if (!markers[r]) {
              const m = new maplibregl.Marker({ element: document.createElement('div'), anchor: 'bottom' });
              m.getElement().className = 'avatars';
              markers[r] = m;
            }
            markers[r].getElement().textContent = groups[r].join('');
            markers[r].setLngLat(at).addTo(map);
          });
        }
      } });

      // find me: back to your neighborhood, or ask for the location again
      $('ctrlLocate').addEventListener('click', () => {
        const r = window.ChatRoom.room;
        if (r) flyTo(boundsOf([r]), 60, V.neighborhood.zoom); else window.ChatRoom.locate();
      });

      // the map object, so it can be poked at from the browser console
      window.chatMap = map;
    });
  });
})();
