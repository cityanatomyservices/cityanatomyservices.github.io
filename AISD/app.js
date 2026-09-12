// app.js — the AISD school changes map.
//
// campuses.geojson is read first so the map can open fitted to the dots.
// Dots are coloured by role (closing, receiving, ...) and the legend has a
// checkbox per role. Under the dots: the attendance zones of the affected
// schools (tinted by the same role colour) and a line from each closing
// school to where its students go. The Layers box switches those and two
// reference overlays. Clicking a dot opens a popup with the facts and the
// source links for that campus.
(function () {
  const CFG = window.AISD_CONFIG;
  const COPY = window.AISD_COPY;
  const $ = (id) => document.getElementById(id);
  const ROLES = Object.keys(CFG.role);

  document.title = COPY.pageTitle;
  $('title').textContent = COPY.pageTitle;
  $('home').textContent = COPY.home;
  $('legendTitle').textContent = COPY.legendTitle;
  $('legendSub').textContent = COPY.legendSub;
  $('overlaysTitle').textContent = COPY.overlays;

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

  // ── legend: one checkbox per role; unticking hides those campuses ─────────
  const shown = new Set(ROLES);
  function buildLegend(map, counts) {
    const applyFilter = () => {
      const f = ['in', ['get', 'role'], ['literal', Array.from(shown)]];
      map.setFilter('campus-points', f);
      map.setFilter('campus-labels', f);
      if (map.getLayer('plan-zones-fill')) { map.setFilter('plan-zones-fill', f); map.setFilter('plan-zones-line', f); map.setFilter('plan-zones-label', f); }
    };
    const ul = $('legendRows');
    ul.innerHTML = '';
    ROLES.forEach((r) => {
      if (!counts[r]) return;                       // only roles that occur
      const li = document.createElement('li');
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox'; box.checked = true;
      box.addEventListener('change', () => { box.checked ? shown.add(r) : shown.delete(r); applyFilter(); });
      const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.background = CFG.role[r];
      const txt = document.createElement('span'); txt.textContent = COPY.role[r];
      label.append(box, sw, txt);
      const n = document.createElement('span'); n.className = 'count'; n.textContent = counts[r];
      li.append(label, n);
      ul.appendChild(li);
    });
  }

  // ── the Layers box: the plan's own layers, then the reference overlays ────
  function overlayRow(text, on, onChange) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox'; box.checked = on;
    box.addEventListener('change', () => onChange(box.checked));
    const txt = document.createElement('span'); txt.textContent = text;
    label.append(box, txt);
    $('overlayRows').appendChild(label);
  }
  const vis = (on) => on ? 'visible' : 'none';
  function setVis(map, ids, on) { ids.forEach((id) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(on)); }); }

  function buildPlanLayers(map) {
    const z = CFG.planLayers.zones;
    map.addSource('plan-zones', { type: 'geojson', data: z.file });
    map.addLayer({ id: 'plan-zones-fill', type: 'fill', source: 'plan-zones', layout: { visibility: vis(z.on) },
      paint: { 'fill-color': roleColor, 'fill-opacity': z.fill } });
    map.addLayer({ id: 'plan-zones-line', type: 'line', source: 'plan-zones', layout: { visibility: vis(z.on) },
      paint: { 'line-color': roleColor, 'line-width': 1.2 } });
    map.addLayer({ id: 'plan-zones-label', type: 'symbol', source: 'plan-zones',
      layout: { visibility: vis(z.on), 'symbol-placement': 'point', 'text-field': ['get', z.label], 'text-font': ['Noto Sans Regular'], 'text-size': 11 },
      paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
    overlayRow(COPY.layer.zones, z.on, (on) => setVis(map, ['plan-zones-fill', 'plan-zones-line', 'plan-zones-label'], on));

    const l = CFG.planLayers.links;
    map.addSource('plan-links', { type: 'geojson', data: l.file });
    map.addLayer({ id: 'plan-links', type: 'line', source: 'plan-links', layout: { visibility: vis(l.on), 'line-cap': 'round' },
      paint: { 'line-color': l.color, 'line-width': 2.5, 'line-dasharray': [1, 1.5] } });
    overlayRow(COPY.layer.links, l.on, (on) => setVis(map, ['plan-links'], on));
  }

  function buildOverlays(map) {
    Object.entries(CFG.overlays).forEach(([key, o]) => {
      map.addSource('overlay-' + key, { type: 'geojson', data: o.file });
      map.addLayer({ id: 'overlay-' + key + '-fill', type: 'fill', source: 'overlay-' + key, layout: { visibility: vis(o.on) },
        paint: { 'fill-color': o.color, 'fill-opacity': o.fill } });
      map.addLayer({ id: 'overlay-' + key + '-line', type: 'line', source: 'overlay-' + key, layout: { visibility: vis(o.on) },
        paint: { 'line-color': o.color, 'line-width': 1.6, 'line-dasharray': [3, 2] } });
      if (o.label) {
        map.addLayer({ id: 'overlay-' + key + '-label', type: 'symbol', source: 'overlay-' + key,
          layout: { visibility: vis(o.on), 'symbol-placement': 'point', 'text-field': ['get', o.label], 'text-font': ['Noto Sans Bold'], 'text-size': 12 },
          paint: { 'text-color': o.color, 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
      }
      overlayRow(COPY.layer[key] || key, !!o.on, (on) => setVis(map, ['fill', 'line', 'label'].map((k) => 'overlay-' + key + '-' + k), on));
    });
  }

  // ── the bounding box of the campuses: what the map opens on and refits to ─
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
    const cage = [[box[0][0] - pad, box[0][1] - pad], [box[1][0] + pad, box[1][1] + pad]];
    const counts = {};
    campuses.features.forEach((f) => { counts[f.properties.role] = (counts[f.properties.role] || 0) + 1; });

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
      map.addSource('satellite', { type: 'raster', tiles: [CFG.satellite], tileSize: 256, attribution: 'Tiles &copy; Esri' });
      map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });

      buildPlanLayers(map);
      buildOverlays(map);

      // the campuses, on top of everything
      map.addSource('campuses', { type: 'geojson', data: campuses });
      map.addLayer({ id: 'campus-points', type: 'circle', source: 'campuses',
        paint: { 'circle-color': roleColor, 'circle-radius': CFG.pointRadius, 'circle-opacity': 0.95,
                 'circle-stroke-color': '#222222', 'circle-stroke-width': 1 } });
      map.addLayer({ id: 'campus-labels', type: 'symbol', source: 'campuses',
        layout: { 'text-field': ['get', 'name_short'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top' },
        paint: { 'text-color': '#111111', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });

      buildLegend(map, counts);

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
