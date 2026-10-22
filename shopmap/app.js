// shopmap/app.js — the engine every shopping app runs on (owner 2026-10-22:
// the shopping apps live at /apps/<id>/, carry the site's own header and
// footer, and look like the map on the home page).
//
// A shopping app folder holds three files:
//   index.html   the page: the site frame (shell.js) around this map
//   config.js    window.SHOP_CONFIG — title, subtitle, the data file, which
//                property is the name, which one the category, the popup rows
//   data.geojson the places, one Point feature each
//
// What the page does: the places are pins coloured by category on the same
// basemap as the home map, with the same round control stack (find me,
// 2D/3D, satellite, extents, zoom) and the Street / Neighborhood / City
// view buttons. The card top-left holds the title and the list: a fold per
// category with its colour and count (untick its box to hide those pins),
// a row per place. Tap a row and the map goes there at street level, flat, with a
// popup: the place's rows from config.js and Google Maps / Apple Maps /
// Yelp links (plain web addresses). Tapping a pin opens the same popup.
// Nobody can zoom out past the City view or push the map off the screen.
//
// The control and view code is the same as chat/map.js (the home map), kept
// as a twin here on purpose so each page can be read on its own.
(function () {
  const CFG = window.SHOP_CONFIG;
  const W = window.SHOP_WORDS;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

  // the look shared with the home map: basemap, imagery, palette, views
  const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';
  const SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#86bcb6', '#d4a6c8', '#a0cbe8'];
  const PITCH = 57;
  const VIEWS = { street: { zoom: 17, pitch: 0 }, neighborhood: { zoom: 15.4, pitch: PITCH } };
  const FIT_PADDING = 40;
  const KEEP_ON_SCREEN = 0.1;        // this much of the screen must always show the map
  const LINKS = {
    google: 'https://www.google.com/maps/search/?api=1&query={lat},{lng}',
    apple: 'https://maps.apple.com/?ll={lat},{lng}&q={name}',
    yelp: 'https://www.yelp.com/search?find_desc={name}&find_loc=Austin,+TX'
  };

  document.title = CFG.title;
  $('legendTitle').textContent = CFG.title;
  $('legendSub').textContent = CFG.subtitle || '';

  // the card folds with the arrow in its title; it starts open on a desktop
  // and closed on a phone, where it would cover the map
  let placePopup = null;
  const setCard = (open) => {
    $('legendTitle').setAttribute('aria-expanded', String(open));
    $('legendBody').hidden = !open;
    $('legend').classList.toggle('is-collapsed', !open);
    if (open && placePopup) { placePopup.remove(); placePopup = null; }
  };
  setCard(window.innerWidth > 640);
  $('legendTitle').addEventListener('click', () => setCard($('legendTitle').getAttribute('aria-expanded') !== 'true'));

  function boundsOf(features) {
    const b = [[Infinity, Infinity], [-Infinity, -Infinity]];
    features.forEach((f) => {
      const [x, y] = f.geometry.coordinates;
      b[0][0] = Math.min(b[0][0], x); b[0][1] = Math.min(b[0][1], y);
      b[1][0] = Math.max(b[1][0], x); b[1][1] = Math.max(b[1][1], y);
    });
    return b;
  }

  // ── start: read the places, then build the map fitted to them ────────────
  fetch(CFG.data).then((r) => r.json()).then((data) => {
    const features = data.features.filter((f) => f.geometry && f.geometry.type === 'Point');
    features.forEach((f, i) => { f.id = i; });                          // a stable id per pin
    const name = (f) => String(f.properties[CFG.nameField] || '');
    const category = (f) => String(f.properties[CFG.categoryField] || '') || '—';
    const categories = [];                                              // in first-seen order
    features.forEach((f) => { if (!categories.includes(category(f))) categories.push(category(f)); });
    const colorOf = {};
    categories.forEach((c, i) => { colorOf[c] = PALETTE[i % PALETTE.length]; });
    features.forEach((f) => { f.properties._color = colorOf[category(f)]; f.properties._name = name(f); });
    const box = boundsOf(features);

    const map = new maplibregl.Map({
      container: 'map',
      style: BASEMAP,
      bounds: box,
      fitBoundsOptions: { padding: FIT_PADDING },
      attributionControl: false
    });
    // the map sits inside the site frame, which shell.js draws after this
    // script starts: re-measure whenever the frame around it changes size
    new ResizeObserver(() => map.resize()).observe(map.getContainer());
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: CFG.credit || W.attribution }));
    const attribution = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
    if (attribution) { attribution.classList.remove('maplibregl-compact-show'); attribution.removeAttribute('open'); }

    // the limits: no zooming out past the City view; the map can be pushed
    // almost off the screen but never all the way
    const keepInView = () => {
      const b = map.getBounds();
      const w = (b.getEast() - b.getWest()) * (1 - KEEP_ON_SCREEN);
      const h = (b.getNorth() - b.getSouth()) * (1 - KEEP_ON_SCREEN);
      map.setMaxBounds([[box[0][0] - w, box[0][1] - h], [box[1][0] + w, box[1][1] + h]]);
    };
    const limitZoom = () => {
      const cam = map.cameraForBounds(box, { padding: FIT_PADDING });
      if (cam) map.setMinZoom(cam.zoom);
    };
    map.on('zoomend', keepInView);
    map.on('resize', () => { limitZoom(); keepInView(); });

    // ── the control stack: find me, 2D/3D, satellite, extents, zoom ────────
    let tilted = false;
    const showTilt = () => {
      $('ctrlTilt').textContent = tilted ? '2D' : '3D';
      $('ctrlTilt').title = tilted ? W.to2d : W.to3d;
      $('ctrlTilt').setAttribute('aria-pressed', String(tilted));
      $('ctrlTilt').classList.toggle('is-on', tilted);
    };
    const setTilt = (on) => {
      tilted = on;
      showTilt();
      if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', tilted ? 'visible' : 'none');
    };
    $('ctrlTilt').addEventListener('click', () => { setTilt(!tilted); map.easeTo({ pitch: tilted ? PITCH : 0, duration: 600 }); });
    $('ctrlLocate').title = W.locate;
    $('ctrlSatellite').title = W.satellite;
    $('ctrlExtent').title = W.extents;
    $('ctrlZoomIn').title = W.zoomIn;
    $('ctrlZoomOut').title = W.zoomOut;
    $('ctrlZoomIn').addEventListener('click', () => map.zoomTo(map.getZoom() + 1, { duration: 250 }));
    $('ctrlZoomOut').addEventListener('click', () => map.zoomTo(map.getZoom() - 1, { duration: 250 }));
    let satelliteOn = false;
    $('ctrlSatellite').addEventListener('click', () => {
      satelliteOn = !satelliteOn;
      map.setLayoutProperty('satellite', 'visibility', satelliteOn ? 'visible' : 'none');
      $('ctrlSatellite').setAttribute('aria-pressed', String(satelliteOn));
      $('ctrlSatellite').classList.toggle('is-on', satelliteOn);
    });
    // find me: the browser's location, shown as a dot
    let meMarker = null;
    $('ctrlLocate').addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((pos) => {
        const at = [pos.coords.longitude, pos.coords.latitude];
        if (!meMarker) { meMarker = new maplibregl.Marker({ element: document.createElement('div') }); meMarker.getElement().className = 'me-dot'; }
        meMarker.setLngLat(at).addTo(map);
        map.easeTo({ center: at, zoom: Math.max(map.getZoom(), VIEWS.street.zoom - 1), duration: 900 });
      });
    });

    // ── the three views ────────────────────────────────────────────────────
    const cityView = () => {
      setTilt(false);
      const cam = map.cameraForBounds(box, { padding: FIT_PADDING, bearing: 0 });
      if (cam) map.easeTo({ ...cam, pitch: 0, duration: 700 });
    };
    const neighborhoodView = (duration) => {
      setTilt(true);
      map.easeTo({ zoom: VIEWS.neighborhood.zoom, pitch: VIEWS.neighborhood.pitch, bearing: 0, duration });
    };
    const streetView = () => {
      setTilt(false);
      map.easeTo({ zoom: VIEWS.street.zoom, pitch: 0, bearing: 0, duration: 700 });
    };
    $('ctrlExtent').addEventListener('click', cityView);
    $('viewStreet').textContent = W.street;
    $('viewNeighborhood').textContent = W.neighborhood;
    $('viewCity').textContent = W.city;
    $('viewStreet').addEventListener('click', streetView);
    $('viewNeighborhood').addEventListener('click', () => neighborhoodView(900));
    $('viewCity').addEventListener('click', cityView);

    // ── the popup: the place's rows, then the three links ──────────────────
    const isUrl = (v) => /^https?:\/\//i.test(String(v));
    function popupHtml(f) {
      const p = f.properties;
      const rows = (CFG.popupFields || []).map(({ property, label }) => {
        const v = p[property];
        if (v == null || v === '') return '';
        const shown = isUrl(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(String(v).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>` : esc(v);
        return `<tr><td>${esc(label || property)}</td><td>${shown}</td></tr>`;
      }).join('');
      const [lng, lat] = f.geometry.coordinates;
      const vars = { lat, lng, name: encodeURIComponent(name(f)) };
      const link = (key) => `<a href="${esc(fill(LINKS[key], vars))}" target="_blank" rel="noopener">${esc(W[key])}</a>`;
      return `<div class="place-popup"><h3>${esc(name(f))}</h3>` + (rows ? `<table>${rows}</table>` : '') +
             `<div class="place-links">${link('google')}${link('apple')}${link('yelp')}</div></div>`;
    }
    function showPopup(f) {
      if (placePopup) placePopup.remove();
      placePopup = new maplibregl.Popup({ offset: 14, maxWidth: '300px', closeOnClick: false })
        .setLngLat(f.geometry.coordinates).setHTML(popupHtml(f)).addTo(map);
    }
    // tapping a row: the map goes there at street level, flat, the card folds
    function goTo(f) {
      setTilt(false);
      map.easeTo({ center: f.geometry.coordinates, zoom: VIEWS.street.zoom, pitch: 0, bearing: 0, duration: 900 });
      showPopup(f);
      setCard(false);
    }

    // ── the list on the card: a fold per category (its colour, its count, a
    // box to hide its pins), a row per place ──────────────────────────────
    const hidden = new Set();
    const applyFilter = () => {
      const f = ['!', ['in', ['get', CFG.categoryField], ['literal', Array.from(hidden)]]];
      map.setFilter('places', f);
      map.setFilter('place-labels', f);
    };
    const list = $('placeList');
    categories.forEach((c) => {
      const mine = features.filter((f) => category(f) === c).sort((a, b) => name(a).localeCompare(name(b)));
      const d = document.createElement('details');
      const s = document.createElement('summary');
      const box = document.createElement('input');
      box.type = 'checkbox'; box.checked = true; box.title = c;
      box.addEventListener('click', (e) => e.stopPropagation());             // the box must not fold the list
      box.addEventListener('change', () => { box.checked ? hidden.delete(c) : hidden.add(c); applyFilter(); d.classList.toggle('is-hidden', !box.checked); });
      const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.background = colorOf[c];
      const txt = document.createElement('span'); txt.className = 'cat-name'; txt.textContent = c;
      const count = document.createElement('span'); count.className = 'count'; count.textContent = mine.length;
      s.append(box, sw, txt, count);
      d.appendChild(s);
      mine.forEach((f) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'place-row';
        b.textContent = name(f);
        b.addEventListener('click', () => goTo(f));
        d.appendChild(b);
      });
      list.appendChild(d);
    });

    map.on('load', () => {
      limitZoom();
      keepInView();
      map.addSource('satellite', { type: 'raster', tiles: [SATELLITE], tileSize: 256, attribution: 'Tiles &copy; Esri' });
      map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });
      map.addLayer({ id: 'buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
        layout: { visibility: 'none' },
        paint: { 'fill-extrusion-color': '#d6d9dd', 'fill-extrusion-opacity': 0.8,
                 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
                 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] } });

      // the places: a coloured dot each, the name beside it once close enough
      map.addSource('places', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      map.addLayer({ id: 'places', type: 'circle', source: 'places',
        paint: { 'circle-color': ['get', '_color'], 'circle-radius': 7, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5, 'circle-opacity': 0.95 } });
      map.addLayer({ id: 'place-labels', type: 'symbol', source: 'places', minzoom: 12,
        layout: { 'text-field': ['get', '_name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top' },
        paint: { 'text-color': '#1f2933', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
      map.on('click', 'places', (e) => { const f = e.features && e.features[0]; if (f) showPopup(features[f.id]); });
      map.on('mouseenter', 'places', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'places', () => { map.getCanvas().style.cursor = ''; });

      // the opening move: the City view, tilting up like the home map
      setTilt(true);
      map.easeTo({ pitch: PITCH, duration: 1800 });
      window.shopMap = map;
    });
  });
})();
