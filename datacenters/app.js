// app.js — the data centers map.
//
// One GeoJSON of 47 sites (config.js) drawn as circles: colour = status,
// size = MW, label = the site's row number. The legend has a checkbox per
// status that hides or shows those dots. The Austin Energy service area is
// a dashed outline the reader can switch off. Clicking a dot opens a popup
// with the facts and the source links for that site.
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
  $('ovServiceLabel').textContent = COPY.serviceArea;

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

  const map = new maplibregl.Map({
    container: 'map',
    style: CFG.basemap,
    center: CFG.center,
    zoom: CFG.zoom,
    minZoom: CFG.minZoom,
    maxBounds: CFG.region,          // cannot pan away from the region
    attributionControl: false
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: COPY.attribution }));

  // ── the control stack: satellite, zoom in, zoom out, extents ──────────────
  $('ctrlSatellite').textContent = COPY.ui.satellite;
  $('ctrlSatellite').title = COPY.ui.satellite;
  $('ctrlZoomIn').title = COPY.ui.zoomInBtn;
  $('ctrlZoomOut').title = COPY.ui.zoomOutBtn;
  $('ctrlExtent').title = COPY.ui.extents;
  $('ctrlZoomIn').addEventListener('click', () => map.zoomIn());
  $('ctrlZoomOut').addEventListener('click', () => map.zoomOut());
  $('ctrlExtent').addEventListener('click', () => map.easeTo({ center: CFG.center, zoom: CFG.zoom, pitch: 0, bearing: 0 }));
  let satelliteOn = false;
  $('ctrlSatellite').addEventListener('click', () => {
    satelliteOn = !satelliteOn;
    map.setLayoutProperty('satellite', 'visibility', satelliteOn ? 'visible' : 'none');
    $('ctrlSatellite').setAttribute('aria-pressed', String(satelliteOn));
    $('ctrlSatellite').classList.toggle('is-on', satelliteOn);
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

  // ── legend: one checkbox per status; unticking hides those dots ───────────
  const shown = new Set(STATUSES);
  const counts = {};
  function applyFilter() {
    const f = ['in', ['get', 'status'], ['literal', Array.from(shown)]];
    map.setFilter('dc-points', f);
    map.setFilter('dc-labels', f);
  }
  function buildLegend() {
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

  // ── popups ────────────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v) => Number(v).toLocaleString();
  const rowsHtml = (pairs) => '<table>' + pairs.filter(([, v]) => v !== '' && v != null && v !== 0)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('') + '</table>';
  const P = COPY.popup;

  function popupHtml(p) {
    const mw = Number(p.size_mw) > 0 ? num(p.size_mw) + ' ' + P.mw : P.mwUnknown;
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

  map.on('load', () => {
    // satellite imagery sits above the basemap and below every data layer
    map.addSource('satellite', { type: 'raster', tiles: [CFG.satellite], tileSize: 256, attribution: 'Tiles &copy; Esri' });
    map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });

    // Austin Energy service area: faint tint plus a dashed outline
    map.addSource('service', { type: 'geojson', data: CFG.serviceArea.file });
    map.addLayer({ id: 'service-fill', type: 'fill', source: 'service', paint: { 'fill-color': CFG.serviceArea.color, 'fill-opacity': 0.06 } });
    map.addLayer({ id: 'service-line', type: 'line', source: 'service', paint: { 'line-color': CFG.serviceArea.color, 'line-width': 2, 'line-dasharray': [3, 2] } });
    $('ovService').addEventListener('change', (e) => {
      const v = e.target.checked ? 'visible' : 'none';
      map.setLayoutProperty('service-fill', 'visibility', v);
      map.setLayoutProperty('service-line', 'visibility', v);
    });

    // the sites
    map.addSource('dc', { type: 'geojson', data: CFG.sites });
    map.addLayer({ id: 'dc-points', type: 'circle', source: 'dc',
      paint: { 'circle-color': statusColor, 'circle-radius': radius, 'circle-opacity': 0.9,
               'circle-stroke-color': '#222222', 'circle-stroke-width': 1 } });
    map.addLayer({ id: 'dc-labels', type: 'symbol', source: 'dc',
      layout: { 'text-field': ['to-string', ['get', 'id']], 'text-font': ['Noto Sans Bold'], 'text-size': 10, 'text-allow-overlap': true },
      paint: { 'text-color': '#111111', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 } });

    // count sites per status for the legend once the data is in
    fetch(CFG.sites).then((r) => r.json()).then((gj) => {
      gj.features.forEach((f) => { counts[f.properties.status] = (counts[f.properties.status] || 0) + 1; });
      buildLegend();
    }).catch(() => buildLegend());

    map.on('click', 'dc-points', (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      new maplibregl.Popup({ maxWidth: '340px' }).setLngLat(f.geometry.coordinates).setHTML(popupHtml(f.properties)).addTo(map);
    });
    map.on('mouseenter', 'dc-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'dc-points', () => { map.getCanvas().style.cursor = ''; });
  });
})();
