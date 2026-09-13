// app.js — the data centers map.
//
// One GeoJSON of 47 sites (config.js) drawn as circles: colour = status,
// size = MW, label = the site's row number. The legend has a checkbox per
// status that hides or shows those dots. The Layers box has a checkbox per
// reference overlay (Austin Energy service area, city limits, council
// districts, ZIP codes); only Austin Energy starts on. Clicking a dot opens
// a popup with the facts and the source links for that site.
//
// The sites file is read first so the map can open fitted to the dots
// (owner 2026-09-12: "have the extent of the map be the mapped datacenters").
(function () {
  const CFG = window.DC_CONFIG;
  const COPY = window.DC_COPY;
  const $ = (id) => document.getElementById(id);
  const STATUSES = Object.keys(CFG.status);

  document.title = COPY.pageTitle;
  $('title').textContent = COPY.pageTitle;
  $('home').textContent = COPY.home;
  $('legendTitle').textContent = COPY.legendTitle;
  $('legendSub').textContent = COPY.legendSub;
  $('overlaysTitle').textContent = COPY.overlays;

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

  // ── paint expressions ─────────────────────────────────────────────────────
  const statusColor = ['match', ['get', 'status']];
  STATUSES.forEach((s) => statusColor.push(s, CFG.status[s]));
  statusColor.push('#999999');
  const radius = ['interpolate', ['linear'], ['coalesce', ['to-number', ['get', 'size_mw']], 0]].concat(CFG.radiusByMw);
  const radiusPx = (mw) => {                      // same curve, for the size legend
    const r = CFG.radiusByMw;
    for (let i = 0; i < r.length - 2; i += 2) {
      if (mw <= r[i + 2]) return r[i + 1] + (mw - r[i]) / (r[i + 2] - r[i]) * (r[i + 3] - r[i + 1]);
    }
    return r[r.length - 1];
  };

  // ── popups ────────────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v) => Number(v).toLocaleString();
  const rowsHtml = (pairs) => '<table>' + pairs.filter(([, v]) => v !== '' && v != null && v !== 0)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('') + '</table>';
  const P = COPY.popup;

  function popupHtml(p) {
    const mw = Number(p.size_mw) > 0 ? num(p.size_mw) + ' ' + P.mw : COPY.mwUnknown;
    const size = [Number(p.size_sqft) > 0 ? num(p.size_sqft) + ' ' + P.sqft : '', Number(p.acres) > 0 ? num(p.acres) + ' ' + P.acres.toLowerCase() : '']
      .filter(Boolean).join(', ');
    let html = `<h3>${esc(p.id)}. ${esc(p.name)}</h3>`;
    html += rowsHtml([
      [P.operator, esc(p.operator)],
      [P.status, `<span class="swatch" style="display:inline-block;vertical-align:-2px;background:${CFG.status[p.status]}"></span> ${esc(COPY.status[p.status] || p.status_label)}`],
      [P.address, esc(p.address)],
      [P.place, esc(p.city) + ', ' + esc(p.county)],
      [P.power, mw],
      [P.size, size],
      [P.year, esc(p.year)],
      [P.precision, esc(P.precisionWords[p.coord_precision] || p.coord_precision)]
    ]);
    if (p.notes) html += `<p class="notes"><strong>${esc(P.notes)}.</strong> ${esc(p.notes)}</p>`;
    if (p.power_water_notes) html += `<p class="notes"><strong>${esc(P.utility)}.</strong> ${esc(p.power_water_notes)}</p>`;
    if (p.sources) {
      const links = String(p.sources).split(' | ').filter(Boolean).map((u) => {
        let host = u; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* keep the raw text */ }
        return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host)}</a>`;
      });
      html += `<div class="sources"><strong>${esc(P.sources)}</strong>${links.join('')}</div>`;
    }
    return html;
  }

  // ── legend: one checkbox per status; unticking hides those dots ───────────
  const shown = new Set(STATUSES);
  function buildLegend(map, counts) {
    const applyFilter = () => {
      const f = ['in', ['get', 'status'], ['literal', Array.from(shown)]];
      map.setFilter('dc-points', f);
      map.setFilter('dc-labels', f);
    };
    const ul = $('legendRows');
    ul.innerHTML = '';
    STATUSES.forEach((s) => {
      const li = document.createElement('li');
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox'; box.checked = true;
      box.addEventListener('change', () => { box.checked ? shown.add(s) : shown.delete(s); applyFilter(); });
      const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.background = CFG.status[s];
      const txt = document.createElement('span'); txt.textContent = COPY.status[s];
      label.append(box, sw, txt);
      const n = document.createElement('span'); n.className = 'count'; n.textContent = counts[s] || 0;
      li.append(label, n);
      ul.appendChild(li);
    });
    const size = $('legendSize');
    size.textContent = COPY.sizeLegend;
    const dots = document.createElement('div'); dots.className = 'dots';
    CFG.sizeLegendMw.forEach((mw) => {
      const d = radiusPx(mw) * 2;
      const span = document.createElement('span');
      const i = document.createElement('i'); i.style.width = d + 'px'; i.style.height = d + 'px';
      span.append(i, document.createTextNode(mw + ' ' + COPY.popup.mw));
      dots.appendChild(span);
    });
    size.appendChild(dots);
  }

  // ── the Layers box: one checkbox per overlay in config.js ─────────────────
  function buildOverlays(map) {
    const rows = $('overlayRows');
    rows.innerHTML = '';
    Object.entries(CFG.overlays).forEach(([key, o]) => {
      const vis = (on) => on ? 'visible' : 'none';
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
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox'; box.checked = !!o.on;
      box.addEventListener('change', () => {
        ['fill', 'line', 'label'].forEach((k) => {
          const id = 'overlay-' + key + '-' + k;
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(box.checked));
        });
      });
      const txt = document.createElement('span'); txt.textContent = COPY.overlay[key] || key;
      label.append(box, txt);
      rows.appendChild(label);
    });
  }

  // ── the bounding box of the sites: what the map opens on and refits to ────
  function boundsOf(gj) {
    const b = [[Infinity, Infinity], [-Infinity, -Infinity]];
    gj.features.forEach((f) => {
      const [x, y] = f.geometry.coordinates;
      b[0][0] = Math.min(b[0][0], x); b[0][1] = Math.min(b[0][1], y);
      b[1][0] = Math.max(b[1][0], x); b[1][1] = Math.max(b[1][1], y);
    });
    return b;
  }

  // ── start: read the sites, then build the map fitted to them ──────────────
  fetch(CFG.sites).then((r) => r.json()).then((sites) => {
    const box = boundsOf(sites);
    const pad = CFG.cagePad;
    const cage = [[box[0][0] - pad, box[0][1] - pad], [box[1][0] + pad, box[1][1] + pad]];
    const counts = {};
    sites.features.forEach((f) => { counts[f.properties.status] = (counts[f.properties.status] || 0) + 1; });

    const map = new maplibregl.Map({
      container: 'map',
      style: CFG.basemap,
      bounds: box,
      fitBoundsOptions: { padding: CFG.fitPadding },
      minZoom: CFG.minZoom,
      maxBounds: cage,                // cannot pan far from the sites
      attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: COPY.attribution }));

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

      // the sites, on top of every overlay
      map.addSource('dc', { type: 'geojson', data: sites });
      map.addLayer({ id: 'dc-points', type: 'circle', source: 'dc',
        paint: { 'circle-color': statusColor, 'circle-radius': radius, 'circle-opacity': 0.9,
                 'circle-stroke-color': '#222222', 'circle-stroke-width': 1 } });
      map.addLayer({ id: 'dc-labels', type: 'symbol', source: 'dc',
        layout: { 'text-field': ['to-string', ['get', 'id']], 'text-font': ['Noto Sans Bold'], 'text-size': 10, 'text-allow-overlap': true },
        paint: { 'text-color': '#111111', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 } });

      buildLegend(map, counts);

      map.on('click', 'dc-points', (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        new maplibregl.Popup({ maxWidth: '340px' }).setLngLat(f.geometry.coordinates).setHTML(popupHtml(f.properties)).addTo(map);
      });
      map.on('mouseenter', 'dc-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'dc-points', () => { map.getCanvas().style.cursor = ''; });
    });
  });
})();
