// app.js — the AISD school changes map.
//
// A copy of the data centers page's app (2026-09-14) with this map's data:
// campuses.geojson is read first so the map can open fitted to the dots.
// Dots are coloured by role (closing, receiving, ...) and the legend has a
// checkbox per role that hides those campuses and their attendance zones.
// The Layers box has the plan's own layers (zones tinted by role, a line
// from each closing school to where its students go) and two reference
// overlays. Clicking a dot opens a popup with the facts and source links;
// clicking a line shows where that share of students goes. The timeline
// player (player.js) runs the story along the bottom.
(function () {
  const CFG = window.AISD_CONFIG;
  const COPY = window.AISD_COPY;
  const $ = (id) => document.getElementById(id);
  const ROLES = Object.keys(CFG.role);

  // ?phone in the address: draw the page the way a phone does, whatever the
  // window size. The page is zoomed so it lays out about 393 CSS px wide
  // (a phone's width) and the map draws at matching pixel density, so a
  // 1080x1920 recording looks exactly like the phone view.
  const phone = new URLSearchParams(location.search).has('phone');
  const phoneScale = phone ? window.innerWidth / 393 : 1;
  if (phone) {
    document.documentElement.style.zoom = phoneScale;
    // viewport units ignore zoom, so give the page its phone-sized box by hand
    const pageEl = document.querySelector('.page');
    pageEl.style.width = '393px';
    pageEl.style.height = Math.round(window.innerHeight / phoneScale) + 'px';
  }

  document.title = COPY.pageTitle;
  $('title').textContent = COPY.pageTitle;
  $('home').textContent = COPY.home;
  $('legendTitle').textContent = COPY.legendTitle;
  $('legendSub').textContent = COPY.legendSub;
  $('overlaysTitle').textContent = COPY.overlays;

  // The two cards (Layers, Legend) fold with the arrow in their title.
  // Hiding a body keeps its checkbox states. On load the legend is open and
  // the Layers box folded, behind the intro card; Play folds the legend,
  // Navigate Map keeps it and opens Layers, and the timeline opens and closes
  // them as the story needs.
  const setCard = (id, open) => {
    const toggle = $(id);
    const body = $(toggle.getAttribute('aria-controls'));
    toggle.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
    toggle.parentElement.classList.toggle('is-collapsed', !open);
  };
  window.AISD_SET_CARD = setCard;
  [['overlaysTitle', false], ['legendTitle', true]].forEach(([id, open]) => {
    setCard(id, open);
    $(id).addEventListener('click', () => setCard(id, $(id).getAttribute('aria-expanded') !== 'true'));
  });

  // ── "About this map", with the plan's timeline ────────────────────────────
  $('aboutToggle').textContent = COPY.ui.about;
  $('aboutWhat').textContent = COPY.about.what;
  $('aboutSourcesLabel').textContent = COPY.ui.sources;
  $('aboutSources').textContent = COPY.about.sources;
  $('aboutCaveatsLabel').textContent = COPY.ui.caveats;
  $('aboutCaveats').textContent = COPY.about.caveats;
  $('timelineLabel').textContent = COPY.ui.timeline;
  $('aboutToggle').addEventListener('click', () => {
    const open = $('about').hidden;
    $('about').hidden = !open;
    $('aboutToggle').setAttribute('aria-expanded', String(open));
    $('aboutToggle').textContent = open ? COPY.ui.aboutClose : COPY.ui.about;
  });
  fetch(CFG.timeline).then((r) => r.json()).then((rows) => {
    const ul = $('timeline');
    rows.forEach((t) => {
      const li = document.createElement('li');
      const d = document.createElement('span'); d.className = 'date'; d.textContent = t.date;
      const e = document.createElement('span'); e.textContent = t.event;
      li.append(d, e); ul.appendChild(li);
    });
  }).catch(() => { /* the panel still works without the timeline */ });

  // ── paint expressions ─────────────────────────────────────────────────────
  const roleColor = ['match', ['get', 'role']];
  ROLES.forEach((r) => roleColor.push(r, CFG.role[r]));
  roleColor.push(CFG.role.other);

  // ── popups ────────────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v) => Number(v).toLocaleString();
  const rowsHtml = (pairs) => '<table>' + pairs.filter(([, v]) => v !== '' && v != null && v !== 0)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('') + '</table>';
  const P = COPY.popup;

  function popupHtml(p) {
    let html = `<h3>${esc(p.name)}</h3>`;
    html += rowsHtml([
      [P.type, esc(P.types[p.school_type] || p.school_type)],
      [P.role, `<span class="swatch" style="display:inline-block;vertical-align:-2px;background:${CFG.role[p.role] || CFG.role.other}"></span> ${esc(COPY.role[p.role] || p.role)}`],
      [P.address, esc(p.address)],
      [P.year, esc(p.effective_school_year)],
      [P.enrollment, Number(p.enrollment_current) > 0 ? num(p.enrollment_current) : ''],
      [P.prior, esc(p.enrollment_prior)],
      [P.capacity, Number(p.capacity) > 0 ? num(p.capacity) : ''],
      [P.utilization, Number(p.percent_utilization) > 0 ? num(p.percent_utilization) + '%' : ''],
      [P.linked, esc(p.linked_campuses)],
      [P.future, esc(p.future_use)]
    ]);
    if (p.reason) html += `<p class="notes"><strong>${esc(P.reason)}.</strong> ${esc(p.reason)}</p>`;
    if (p.plan_history) html += `<p class="notes"><strong>${esc(P.history)}.</strong> ${esc(p.plan_history)}</p>`;
    if (p.community_response) html += `<p class="notes"><strong>${esc(P.community)}.</strong> ${esc(p.community_response)}</p>`;
    if (p.demographics_note) html += `<p class="notes"><strong>${esc(P.demographics)}.</strong> ${esc(p.demographics_note)}</p>`;
    if (p.sources) {
      const links = String(p.sources).split(' | ').filter(Boolean).map((u) => {
        let host = u; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* keep the raw text */ }
        return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host)}</a>`;
      });
      html += `<div class="sources"><strong>${esc(P.sources)}</strong>${links.join('')}</div>`;
    }
    return html;
  }

  // ── legend: one checkbox per role; unticking hides those campuses and zones ─
  const shown = new Set(ROLES);
  const roleTinted = () => Object.entries(CFG.overlays).filter(([, o]) => o.colorBy === 'role').map(([key]) => key);
  function buildLegend(map, counts) {
    const applyFilter = () => {
      const f = ['in', ['get', 'role'], ['literal', Array.from(shown)]];
      map.setFilter('campus-points', f);
      map.setFilter('campus-labels', f);
      roleTinted().forEach((key) => ['fill', 'line', 'label'].forEach((k) => {
        const id = 'overlay-' + key + '-' + k;
        if (map.getLayer(id)) map.setFilter(id, f);
      }));
    };
    const ul = $('legendRows');
    ul.innerHTML = '';
    ROLES.forEach((r) => {
      if (!counts[r]) return;                       // only roles that occur
      const li = document.createElement('li');
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox'; box.checked = true;
      box.dataset.status = r;                       // the player reveals roles through these boxes
      box.addEventListener('change', () => { box.checked ? shown.add(r) : shown.delete(r); applyFilter(); });
      const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.background = CFG.role[r];
      const txt = document.createElement('span'); txt.textContent = COPY.role[r];
      label.append(box, sw, txt);
      const n = document.createElement('span'); n.className = 'count'; n.textContent = counts[r];
      li.append(label, n);
      ul.appendChild(li);
    });
  }

  // ── the Layers box: one checkbox per overlay in config.js, under group headings ──
  // Polygons are added to the map first, then lines, then points, so a point
  // layer is never hidden under a polygon whatever order config.js lists them.
  const stepExpr = (steps) => {                 // [field, v1, px1, v2, px2...] -> MapLibre interpolate
    if (!Array.isArray(steps)) return steps;
    return ['interpolate', ['linear'], ['coalesce', ['to-number', ['get', steps[0]]], 0]].concat(steps.slice(1));
  };
  const overlayLayerIds = (key) => ['fill', 'line', 'label', 'point'].map((k) => 'overlay-' + key + '-' + k);

  function contextPopupHtml(o, p) {
    const F = COPY.fields || {};
    const pairs = o.popup.map((f) => [F[f] || f, typeof p[f] === 'number' ? num(p[f]) : esc(p[f])]);
    return rowsHtml(pairs);
  }

  function buildOverlays(map) {
    const vis = (on) => on ? 'visible' : 'none';
    const entries = Object.entries(CFG.overlays);
    const order = { polygon: 0, line: 1, point: 2 };
    const kindOf = (o) => o.kind || 'polygon';
    entries.slice().sort((a, b) => order[kindOf(a[1])] - order[kindOf(b[1])]).forEach(([key, o]) => {
      const src = 'overlay-' + key;
      map.addSource(src, { type: 'geojson', data: o.file });
      const kind = kindOf(o);
      const color = o.colorBy === 'role' ? roleColor : o.color;   // tint by role, or one colour
      if (kind === 'polygon') {
        map.addLayer({ id: src + '-fill', type: 'fill', source: src, layout: { visibility: vis(o.on) },
          paint: { 'fill-color': color, 'fill-opacity': o.fill } });
        map.addLayer({ id: src + '-line', type: 'line', source: src, layout: { visibility: vis(o.on) },
          paint: { 'line-color': color, 'line-width': o.colorBy ? 1.2 : 1.6, 'line-dasharray': o.colorBy ? [1, 0] : [3, 2] } });
        if (o.label) {
          map.addLayer({ id: src + '-label', type: 'symbol', source: src,
            layout: { visibility: vis(o.on), 'symbol-placement': 'point', 'text-field': ['get', o.label],
                      'text-font': [o.colorBy ? 'Noto Sans Regular' : 'Noto Sans Bold'], 'text-size': o.labelSize || 12 },
            paint: { 'text-color': o.colorBy ? '#333333' : o.color, 'text-halo-color': '#ffffff', 'text-halo-width': o.colorBy ? 1.5 : 2 } });
        }
      } else if (kind === 'line') {
        const paint = { 'line-color': color, 'line-width': stepExpr(o.width || 1.5), 'line-opacity': 0.9 };
        if (o.dash) paint['line-dasharray'] = o.dash;
        map.addLayer({ id: src + '-line', type: 'line', source: src, layout: { visibility: vis(o.on), 'line-cap': 'round', 'line-join': 'round' }, paint });
      } else {
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

  // ── start: read the campuses, then build the map fitted to them ───────────
  fetch(CFG.campuses).then((r) => r.json()).then((campuses) => {
    const box = boundsOf(campuses);
    const pad = CFG.cagePad;
    const padLng = CFG.cagePadLng ?? pad;
    const cage = [[box[0][0] - padLng, box[0][1] - pad], [box[1][0] + padLng, box[1][1] + pad]];
    const counts = {};
    campuses.features.forEach((f) => { counts[f.properties.role] = (counts[f.properties.role] || 0) + 1; });

    const map = new maplibregl.Map({
      container: 'map',
      style: CFG.basemap,
      bounds: box,
      fitBoundsOptions: { padding: CFG.fitPadding },
      minZoom: CFG.minZoom,
      maxBounds: cage,                // cannot pan far from the campuses
      pixelRatio: phone ? phoneScale : undefined,   // keep the map sharp under the ?phone zoom
      attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: COPY.attribution }));
    // Compact mode initially opens in MapLibre; start with only the info button.
    const attribution = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
    if (attribution) {
      attribution.classList.remove('maplibregl-compact-show');
      attribution.removeAttribute('open');
    }

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

      // the campuses, on top of every overlay
      map.addSource('campuses', { type: 'geojson', data: campuses });
      map.addLayer({ id: 'campus-points', type: 'circle', source: 'campuses',
        paint: { 'circle-color': roleColor, 'circle-radius': CFG.pointRadius, 'circle-opacity': 0.95,
                 'circle-stroke-color': '#222222', 'circle-stroke-width': 1 } });
      map.addLayer({ id: 'campus-labels', type: 'symbol', source: 'campuses',
        layout: { 'text-field': ['get', 'name_short'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top' },
        paint: { 'text-color': '#111111', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });

      buildLegend(map, counts);

      // the timeline: zoom to a campus from the site list, and re-frame the
      // map at every step so the campuses stay clear of whichever card is up.
      // On phones the site list sits at the top during the reveals and the
      // text card at the bottom during the story, so the framing swaps
      // between the lower and the upper band of the screen; on a desktop the
      // list is top-right and the text card top-centre.
      const framePadding = (phase) => {           // phase: 'reveal' | 'text' | 'plain'
        const el = map.getContainer();
        const narrow = el.clientWidth <= 640;      // phone layout (same break as style.css)
        const wide = el.clientWidth >= 1000;
        const portrait = el.clientHeight > el.clientWidth;
        if (narrow) {
          if (phase === 'reveal') return { left: 20, right: 20, top: 400, bottom: 70 };
          if (phase === 'text') return { left: 20, right: 20, top: 175, bottom: 300 };
          return { left: 20, right: 20, top: 175, bottom: 80 };
        }
        if (portrait) return phase === 'text' ? { left: 40, right: 40, top: 420, bottom: 120 } : { left: 40, right: 40, top: 200, bottom: 100 };
        if (wide) {
          if (phase === 'reveal') return { left: 310, right: 380, top: 70, bottom: 70 };
          if (phase === 'text') return { left: 310, right: 40, top: 250, bottom: 70 };
          return { left: 310, right: 40, top: 70, bottom: 70 };
        }
        return { left: 20, right: 20, top: 220, bottom: 60 };
      };
      window.AISD_PLAYER.init(campuses, (feature) => {
        map.easeTo({ center: feature.geometry.coordinates, zoom: Math.max(map.getZoom(), 13), duration: 700 });
      }, (step) => {
        const names = step.focus && CFG.focus[step.focus];
        const picked = names ? { features: campuses.features.filter(f => names.includes(f.properties.name_short)) } : null;
        const phase = step.status ? 'reveal' : step.text ? 'text' : 'plain';
        map.fitBounds(picked && picked.features.length ? boundsOf(picked) : box,
          { padding: framePadding(phase), bearing: 0, pitch: 0, duration: 900 });
      });

      map.on('click', 'campus-points', (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        new maplibregl.Popup({ maxWidth: '340px' }).setLngLat(f.geometry.coordinates).setHTML(popupHtml(f.properties)).addTo(map);
      });
      map.on('mouseenter', 'campus-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'campus-points', () => { map.getCanvas().style.cursor = ''; });
    });
  });
})();
