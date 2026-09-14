// topicmap/app.js — the map engine every topic map page runs on.
//
// Shared by /datacenters/ and /AISD/ since 2026-09-14 (each folder had its
// own copy before). One GeoJSON of points is read first so the map opens
// fitted to them; the dots are coloured by a category field; the legend has
// a checkbox per category that hides those dots (and any overlay tinted by
// category); the Layers box has a checkbox per reference overlay in
// config.js; clicking a dot opens a popup; the timeline player (player.js)
// runs the story along the bottom.
//
// Each page supplies three files next to its index.html:
//   config.js  window.MAP_CONFIG  where the data is and how it draws
//   copy.js    window.MAP_COPY    every word on screen
//   map.js     window.MAP_PAGE    what is particular to this map: the popup,
//                                 the timeline steps, how the camera moves
// MAP_PAGE keys (all but popupHtml and steps are optional):
//   popupHtml(properties, helpers)   the HTML inside a dot's popup
//   steps(helpers)                   the timeline steps (see player.js)
//   column(properties)               first column of the timeline's site list
//   frame(step, map, helpers)        move the camera when a step changes
//   legendExtra(helpers)             extra legend rows (e.g. a size key)
//   playDelay                        ms from load to autoplay under ?play
// helpers: { CFG, COPY, esc, num, rowsHtml, boundsOf, box, points, categories, layout, radiusPx }
(function () {
  const CFG = window.MAP_CONFIG;
  const COPY = window.MAP_COPY;
  const PAGE = window.MAP_PAGE;
  const $ = (id) => document.getElementById(id);
  const FIELD = CFG.categoryField;
  const CATEGORIES = Object.keys(CFG.categories);

  // ?phone or ?width= (topicmap/phone.js, loaded before this file) zooms the
  // page to another layout width; the map draws at the matching pixel density
  const phoneScale = window.PHONE_SCALE || 1;
  const phone = phoneScale !== 1;

  document.title = COPY.pageTitle;
  $('title').textContent = COPY.pageTitle;
  $('home').textContent = COPY.home;
  $('legendTitle').textContent = COPY.legendTitle;
  $('legendSub').textContent = COPY.legendSub;
  $('overlaysTitle').textContent = COPY.overlays;

  // The two cards (Layers, legend) fold with the arrow in their title.
  // Hiding a body keeps its checkbox states. On load the legend is open and
  // the Layers box folded, behind the intro card; Navigate Map opens both.
  // On a phone the timeline folds and opens them as the story needs; on a
  // desktop it opens both and leaves them open (owner 2026-09-14).
  const setCard = (id, open) => {
    const toggle = $(id);
    const body = $(toggle.getAttribute('aria-controls'));
    toggle.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
    toggle.parentElement.classList.toggle('is-collapsed', !open);
  };
  [['overlaysTitle', false], ['legendTitle', true]].forEach(([id, open]) => {
    setCard(id, open);
    $(id).addEventListener('click', () => setCard(id, $(id).getAttribute('aria-expanded') !== 'true'));
  });

  // ── "About this map" ──────────────────────────────────────────────────────
  $('aboutToggle').textContent = COPY.ui.about;
  $('aboutWhat').textContent = COPY.about.what;
  $('aboutSourcesLabel').textContent = COPY.ui.sources;
  $('aboutSources').textContent = COPY.about.sources;
  $('aboutCaveatsLabel').textContent = COPY.ui.caveats;
  $('aboutCaveats').textContent = COPY.about.caveats;
  $('aboutToggle').addEventListener('click', () => {
    const open = $('about').hidden;
    $('about').hidden = !open;
    $('aboutToggle').setAttribute('aria-expanded', String(open));
    $('aboutToggle').textContent = open ? COPY.ui.aboutClose : COPY.ui.about;
  });
  // an optional dated list inside About (config.js `timeline`, a JSON array
  // of { date, event }); the page's index.html carries the #timeline list
  if (CFG.timeline && $('timeline')) {
    $('timelineLabel').textContent = COPY.ui.timeline;
    fetch(CFG.timeline).then((r) => r.json()).then((rows) => {
      const ul = $('timeline');
      rows.forEach((t) => {
        const li = document.createElement('li');
        const d = document.createElement('span'); d.className = 'date'; d.textContent = t.date;
        const e = document.createElement('span'); e.textContent = t.event;
        li.append(d, e); ul.appendChild(li);
      });
    }).catch(() => { /* the panel still works without the list */ });
  }

  // ── paint expressions ─────────────────────────────────────────────────────
  const categoryColor = ['match', ['get', FIELD]];
  CATEGORIES.forEach((c) => categoryColor.push(c, CFG.categories[c]));
  categoryColor.push(CFG.categoryFallback || '#999999');
  // [field, v1, px1, v2, px2...] -> a MapLibre interpolate on that field; a plain number passes through
  const stepExpr = (steps) => {
    if (!Array.isArray(steps)) return steps;
    return ['interpolate', ['linear'], ['coalesce', ['to-number', ['get', steps[0]]], 0]].concat(steps.slice(1));
  };
  const radiusPx = (value) => {                   // the same curve as pointRadius, in plain numbers (for a size key)
    const r = CFG.pointRadius;
    if (!Array.isArray(r)) return r;
    for (let i = 1; i < r.length - 2; i += 2) {
      if (value <= r[i + 2]) return r[i + 1] + (value - r[i]) / (r[i + 2] - r[i]) * (r[i + 3] - r[i + 1]);
    }
    return r[r.length - 1];
  };

  // ── popups ────────────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v) => Number(v).toLocaleString();
  const rowsHtml = (pairs) => '<table>' + pairs.filter(([, v]) => v !== '' && v != null && v !== 0)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('') + '</table>';
  const helpers = { CFG, COPY, esc, num, rowsHtml, radiusPx };

  function contextPopupHtml(o, p) {
    const F = COPY.fields || {};
    const pairs = o.popup.map((f) => [F[f] || f, typeof p[f] === 'number' ? num(p[f]) : esc(p[f])]);
    return rowsHtml(pairs);
  }

  // ── legend: one checkbox per category; unticking hides those dots ─────────
  const shown = new Set(CATEGORIES);
  const tinted = () => Object.entries(CFG.overlays).filter(([, o]) => o.colorBy === 'category').map(([key]) => key);
  function buildLegend(map, counts) {
    const applyFilter = () => {
      const f = ['in', ['get', FIELD], ['literal', Array.from(shown)]];
      map.setFilter('points', f);
      map.setFilter('point-labels', f);
      tinted().forEach((key) => ['fill', 'line', 'label'].forEach((k) => {   // overlays tinted by category follow the boxes too
        const id = 'overlay-' + key + '-' + k;
        if (map.getLayer(id)) map.setFilter(id, f);
      }));
    };
    const ul = $('legendRows');
    ul.innerHTML = '';
    CATEGORIES.forEach((c) => {
      if (!counts[c]) return;                       // only categories that occur in the data
      const li = document.createElement('li');
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox'; box.checked = true;
      box.dataset.category = c;                     // the player reveals categories through these boxes
      box.addEventListener('change', () => { box.checked ? shown.add(c) : shown.delete(c); applyFilter(); });
      const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.background = CFG.categories[c];
      const txt = document.createElement('span'); txt.textContent = COPY.category[c];
      label.append(box, sw, txt);
      const n = document.createElement('span'); n.className = 'count'; n.textContent = counts[c];
      li.append(label, n);
      ul.appendChild(li);
    });
    if (PAGE.legendExtra) PAGE.legendExtra(helpers);
  }

  // ── the Layers box: one checkbox per overlay in config.js, under group headings ──
  // Polygons are added to the map first, then lines, then points, so a point
  // layer is never hidden under a polygon whatever order config.js lists them.
  const overlayLayerIds = (key) => ['fill', 'line', 'label', 'point'].map((k) => 'overlay-' + key + '-' + k);

  function buildOverlays(map) {
    const vis = (on) => on ? 'visible' : 'none';
    const entries = Object.entries(CFG.overlays);
    const order = { polygon: 0, line: 1, point: 2 };
    const kindOf = (o) => o.kind || 'polygon';
    entries.slice().sort((a, b) => order[kindOf(a[1])] - order[kindOf(b[1])]).forEach(([key, o]) => {
      const src = 'overlay-' + key;
      map.addSource(src, { type: 'geojson', data: o.file });
      const kind = kindOf(o);
      const byCategory = o.colorBy === 'category';
      const color = byCategory ? categoryColor : o.color;   // tint by category, or one colour
      if (kind === 'polygon') {
        map.addLayer({ id: src + '-fill', type: 'fill', source: src, layout: { visibility: vis(o.on) },
          paint: { 'fill-color': color, 'fill-opacity': o.fill } });
        map.addLayer({ id: src + '-line', type: 'line', source: src, layout: { visibility: vis(o.on) },
          paint: { 'line-color': color, 'line-width': byCategory ? 1.2 : 1.6, 'line-dasharray': byCategory ? [1, 0] : [3, 2] } });
        if (o.label) {
          map.addLayer({ id: src + '-label', type: 'symbol', source: src,
            layout: { visibility: vis(o.on), 'symbol-placement': 'point', 'text-field': ['get', o.label],
                      'text-font': [byCategory ? 'Noto Sans Regular' : 'Noto Sans Bold'], 'text-size': o.labelSize || 12 },
            paint: { 'text-color': byCategory ? '#333333' : o.color, 'text-halo-color': '#ffffff', 'text-halo-width': byCategory ? 1.5 : 2 } });
        }
      } else if (kind === 'line') {
        const paint = { 'line-color': color, 'line-width': stepExpr(o.width || 1.5), 'line-opacity': o.opacity ?? 0.85 };
        if (o.dash) paint['line-dasharray'] = o.dash;
        map.addLayer({ id: src + '-line', type: 'line', source: src, layout: { visibility: vis(o.on), 'line-cap': 'round', 'line-join': 'round' }, paint });
      } else {
        // hollow: [field, value] draws features whose field equals value as rings (e.g. planned plants)
        const hollow = o.hollow ? ['==', ['get', o.hollow[0]], o.hollow[1]] : false;
        map.addLayer({ id: src + '-point', type: 'circle', source: src, layout: { visibility: vis(o.on) },
          paint: { 'circle-color': color, 'circle-radius': stepExpr(o.radius || 4),
                   'circle-opacity': hollow ? ['case', hollow, 0, 0.85] : 0.85,
                   'circle-stroke-color': color, 'circle-stroke-width': hollow ? ['case', hollow, 2, 0.8] : 0.8,
                   'circle-stroke-opacity': 1 } });
      }
      if (o.popup && kind !== 'polygon') {      // click a line or point for its facts
        const id = src + (kind === 'line' ? '-line' : '-point');
        map.on('click', id, (e) => {
          const f = e.features && e.features[0];
          if (!f) return;
          new maplibregl.Popup({ maxWidth: '300px' }).setLngLat(e.lngLat).setHTML(contextPopupHtml(o, f.properties)).addTo(map);
        });
        map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
      }
    });

    // the checkboxes, grouped in config.js order
    const rows = $('overlayRows');
    rows.innerHTML = '';
    const groups = CFG.groups || [''];
    groups.forEach((g) => {
      const mine = entries.filter(([, o]) => (o.group || '') === g);
      if (!mine.length) return;
      if (g) {
        const h = document.createElement('div'); h.className = 'overlay-group';
        h.textContent = (COPY.overlayGroup || {})[g] || g;
        rows.appendChild(h);
      }
      mine.forEach(([key, o]) => {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox'; box.checked = !!o.on;
        box.dataset.overlay = key;
        box.addEventListener('change', () => {
          overlayLayerIds(key).forEach((id) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(box.checked)); });
        });
        const sw = document.createElement('span'); sw.className = 'overlay-swatch is-' + kindOf(o); sw.style.color = o.color;
        const txt = document.createElement('span'); txt.textContent = COPY.overlay[key] || key;
        label.append(box, sw, txt);
        rows.appendChild(label);
      });
    });
  }

  // ── the bounding box of a set of points: what the map opens on and refits to ─
  function boundsOf(gj) {
    const b = [[Infinity, Infinity], [-Infinity, -Infinity]];
    gj.features.forEach((f) => {
      const [x, y] = f.geometry.coordinates;
      b[0][0] = Math.min(b[0][0], x); b[0][1] = Math.min(b[0][1], y);
      b[1][0] = Math.max(b[1][0], x); b[1][1] = Math.max(b[1][1], y);
    });
    return b;
  }

  // ── start: read the points, then build the map fitted to them ─────────────
  fetch(CFG.points).then((r) => r.json()).then((points) => {
    const box = boundsOf(points);
    const pad = CFG.cagePad;
    const padLng = CFG.cagePadLng ?? pad;
    const cage = [[box[0][0] - padLng, box[0][1] - pad], [box[1][0] + padLng, box[1][1] + pad]];
    const counts = {};
    points.features.forEach((f) => { counts[f.properties[FIELD]] = (counts[f.properties[FIELD]] || 0) + 1; });
    // the categories in legend order, only those that occur (the player reveals them one by one)
    const categories = CATEGORIES.filter((c) => counts[c]);
    Object.assign(helpers, { boundsOf, box, points, categories });

    const map = new maplibregl.Map({
      container: 'map',
      style: CFG.basemap,
      bounds: box,
      fitBoundsOptions: { padding: CFG.fitPadding },
      minZoom: CFG.minZoom,
      maxBounds: cage,                // cannot pan far from the points
      pixelRatio: phone ? phoneScale : undefined,   // keep the map sharp under the ?phone / ?width zoom
      attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: COPY.attribution }));
    // Compact mode initially opens in MapLibre; start with only the info button.
    const attribution = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
    if (attribution) {
      attribution.classList.remove('maplibregl-compact-show');
      attribution.removeAttribute('open');
    }
    // which layout the page is in right now, for camera padding in map.js
    // (narrow = the phone layout, same break as style.css)
    helpers.layout = () => {
      const el = map.getContainer();
      return { narrow: el.clientWidth <= 640, wide: el.clientWidth >= 1000, portrait: el.clientHeight > el.clientWidth };
    };

    // the control stack: satellite, zoom in, zoom out, extents
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
      // satellite imagery sits above the basemap and below every data layer
      map.addSource('satellite', { type: 'raster', tiles: [CFG.satellite], tileSize: 256, attribution: 'Tiles &copy; Esri' });
      map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });

      buildOverlays(map);

      // the points, on top of every overlay. pointLabel (config.js): the
      // field written on or under each dot, its size, `below` to hang it
      // under the dot, `overlap` to draw it even when labels collide.
      const L = CFG.pointLabel || {};
      map.addSource('points', { type: 'geojson', data: points });
      map.addLayer({ id: 'points', type: 'circle', source: 'points',
        paint: { 'circle-color': categoryColor, 'circle-radius': stepExpr(CFG.pointRadius), 'circle-opacity': CFG.pointOpacity ?? 0.9,
                 'circle-stroke-color': '#222222', 'circle-stroke-width': 1 } });
      if (L.field) {
        const layout = { 'text-field': ['to-string', ['get', L.field]], 'text-font': ['Noto Sans Bold'], 'text-size': L.size || 11 };
        if (L.below) { layout['text-offset'] = [0, 1.1]; layout['text-anchor'] = 'top'; }
        if (L.overlap) layout['text-allow-overlap'] = true;
        map.addLayer({ id: 'point-labels', type: 'symbol', source: 'points', layout,
          paint: { 'text-color': '#111111', 'text-halo-color': '#ffffff', 'text-halo-width': L.below ? 1.5 : 1.2 } });
      } else {
        // an empty label layer keeps the legend filter code simple
        map.addLayer({ id: 'point-labels', type: 'symbol', source: 'points', layout: { 'text-field': '' } });
      }

      buildLegend(map, counts);

      window.MAP_PLAYER.init(points, {
        copy: COPY,
        steps: PAGE.steps(helpers),
        field: FIELD,
        column: PAGE.column,
        setCard,
        layout: helpers.layout,
        playDelay: PAGE.playDelay,
        onSelect: (feature) => {
          map.easeTo({ center: feature.geometry.coordinates, zoom: Math.max(map.getZoom(), 13), duration: 700 });
        },
        onStep: (step) => { if (PAGE.frame) PAGE.frame(step, map, helpers); }
      });

      map.on('click', 'points', (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        new maplibregl.Popup({ maxWidth: '340px' }).setLngLat(f.geometry.coordinates).setHTML(PAGE.popupHtml(f.properties, helpers)).addTo(map);
      });
      map.on('mouseenter', 'points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'points', () => { map.getCanvas().style.cursor = ''; });
      // the map object, so it can be poked at from the browser console
      // (not window.map: the <div id="map"> already takes that name)
      window.topicMap = map;
    });
  });
})();
