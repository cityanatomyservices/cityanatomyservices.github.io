// app.js — the FY 2026-27 budget map.
//
// Three PMTiles files hold the layers (see config.js): the two parcel layers
// each have their own file, everything else shares one. Each "theme" is a list
// of MapLibre layers drawn from that file; picking a theme shows its layers,
// hides the rest and rebuilds the legend. Clicking a feature opens a popup;
// on the two tax themes the popup also pulls the parcel's 2021-2026 taxable
// values from the parcel database that already exists in Supabase.
(function () {
  const CFG = window.BUDGET_CONFIG;
  const COPY = window.BUDGET_COPY;
  const $ = (id) => document.getElementById(id);

  document.title = COPY.pageTitle;
  $('title').textContent = COPY.pageTitle;
  $('home').textContent = COPY.home;
  $('zoomHint').textContent = COPY.ui.zoomIn;
  $('play').textContent = COPY.ui.play;

  // ── "About this map" panel ────────────────────────────────────────────────
  const EXPLAIN = window.BUDGET_EXPLAIN || { general: {}, themes: {} };
  $('aboutToggle').textContent = COPY.ui.about;
  $('aboutHowLabel').textContent = COPY.ui.how;
  $('aboutSourcesLabel').textContent = COPY.ui.sources;
  $('aboutCaveatsLabel').textContent = COPY.ui.caveats;
  $('aboutGeneral').textContent = EXPLAIN.general.text || '';
  $('aboutToggle').addEventListener('click', () => {
    const open = $('about').hidden;
    $('about').hidden = !open;
    $('aboutToggle').setAttribute('aria-expanded', String(open));
    $('aboutToggle').textContent = open ? COPY.ui.aboutClose : COPY.ui.about;
  });
  function fillAbout(key) {
    const t = EXPLAIN.themes[key] || {};
    $('aboutWhat').textContent = t.what || '';
    $('aboutHow').textContent = t.how || '';
    $('aboutSources').textContent = t.sources || '';
    $('aboutCaveats').textContent = t.caveats || '';
  }

  maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);

  const map = new maplibregl.Map({
    container: 'map',
    style: CFG.basemap,
    center: CFG.center,
    zoom: CFG.zoom,
    minZoom: CFG.minZoom,
    maxBounds: CFG.austin,          // cannot pan away from Austin
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
  $('ctrlExtent').addEventListener('click', () => map.fitBounds(CFG.austin, { padding: 20, pitch: 0, bearing: 0 }));
  // 2D/3D: pitch 0 or 55 degrees, and nothing else changes
  const tiltBtn = $('ctrlTilt');
  tiltBtn.title = COPY.ui.tiltTitle;
  const syncTilt = () => { tiltBtn.textContent = map.getPitch() > 0 ? COPY.ui.tilt2d : COPY.ui.tilt3d; };
  tiltBtn.addEventListener('click', () => map.easeTo({ pitch: map.getPitch() > 0 ? 0 : 55, duration: 500 }));
  map.on('pitchend', syncTilt);
  syncTilt();
  let satelliteOn = false;
  $('ctrlSatellite').addEventListener('click', () => {
    satelliteOn = !satelliteOn;
    map.setLayoutProperty('satellite', 'visibility', satelliteOn ? 'visible' : 'none');
    $('ctrlSatellite').setAttribute('aria-pressed', String(satelliteOn));
    $('ctrlSatellite').classList.toggle('is-on', satelliteOn);
  });

  // ── colour helpers ────────────────────────────────────────────────────────
  // step(value, breaks, colors): colors[0] below breaks[0], ... colors[n] above breaks[n-1]
  function step(field, breaks, colors) {
    const e = ['step', ['coalesce', ['to-number', ['get', field]], 0], colors[0]];
    breaks.forEach((b, i) => e.push(b, colors[i + 1]));
    return e;
  }
  function cipCategory() {
    const f = ['downcase', ['coalesce', ['get', 'funding_source'], '']];
    return ['case',
      ['in', 'bond', f], 'bond',
      ['in', 'current', f], 'current',
      ['in', 'grant', f], 'grant',
      ['in', 'other go', f], 'othergo',
      ['in', 'debt', f], 'debt',
      'other'];
  }
  function cipColor() {
    const m = ['match', cipCategory()];
    Object.entries(CFG.cipColors).forEach(([k, c]) => { if (k !== 'other') m.push(k, c); });
    m.push(CFG.cipColors.other);
    return m;
  }

  // ── the seven themes ──────────────────────────────────────────────────────
  // Each layer: id, MapLibre layer spec (source added by addLayers), popup fields.
  // which tile file a layer reads from: the parcel layers have their own
  const sourceFor = (l) => (l['source-layer'] === 'tax_bill' || l['source-layer'] === 'drainage') ? l['source-layer'] : 'budget';
  const outline = { id: 'city-limits', type: 'line', 'source-layer': 'city_limits', paint: { 'line-color': '#555', 'line-width': 1.2 } };

  const THEMES = {
    value: {
      parcel: true,
      layers: [
        { id: 'nbhd-value', type: 'fill', 'source-layer': 'neighborhoods', maxzoom: CFG.parcelMinZoom,
          paint: { 'fill-color': step('value_pct', CFG.pctBreaks, CFG.diverging), 'fill-opacity': 0.75 } },
        { id: 'parcel-value', type: 'fill', 'source-layer': 'tax_bill', minzoom: CFG.parcelMinZoom,
          paint: { 'fill-color': step('value_pct', CFG.pctBreaks, CFG.diverging), 'fill-opacity': 0.85 } },
        outline
      ],
      legend: CFG.diverging.map((c, i) => ({ color: c, label: COPY.legend.pct[i] }))
    },
    bill: {
      parcel: true,
      layers: [
        { id: 'nbhd-bill', type: 'fill', 'source-layer': 'neighborhoods', maxzoom: CFG.parcelMinZoom,
          paint: { 'fill-color': step('median_homestead_bill_pct', CFG.pctBreaks, CFG.diverging), 'fill-opacity': 0.75 } },
        { id: 'parcel-bill', type: 'fill', 'source-layer': 'tax_bill', minzoom: CFG.parcelMinZoom,
          paint: { 'fill-color': step('bill_pct', CFG.pctBreaks, CFG.diverging), 'fill-opacity': 0.85 } },
        outline
      ],
      legend: CFG.diverging.map((c, i) => ({ color: c, label: COPY.legend.pct[i] }))
    },
    drainage: {
      parcel: true,
      layers: [
        { id: 'parcel-drainage', type: 'fill', 'source-layer': 'drainage', minzoom: CFG.parcelMinZoom,
          paint: { 'fill-color': step('charge_fy27', CFG.drainageBreaks, CFG.drainageColors), 'fill-opacity': 0.85 } },
        outline
      ],
      legend: CFG.drainageColors.map((c, i) => ({ color: c, label: COPY.legend.drainage[i] }))
    },
    permits: {
      months: true,
      layers: [
        { id: 'permits-grid', type: 'fill', 'source-layer': 'permits_grid',
          paint: { 'fill-color': step('permits', CFG.permitBreaks, CFG.permitColors), 'fill-opacity': 0.8 } },
        outline
      ],
      legend: CFG.permitColors.map((c, i) => ({ color: c, label: COPY.legend.permits[i] }))
    },
    cip: {
      layers: [
        outline,
        { id: 'cip-lines', type: 'line', 'source-layer': 'cip_lines',
          paint: { 'line-color': cipColor(), 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.5, 14, 4] } },
        { id: 'cip-points', type: 'circle', 'source-layer': 'cip_points',
          paint: { 'circle-color': cipColor(), 'circle-opacity': 0.85, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1,
                   'circle-radius': ['interpolate', ['linear'], ['sqrt', ['max', ['coalesce', ['to-number', ['get', 'total_5yr']], 0], 1]],
                                     1000, 3, 7000, 14] } }
      ],
      legend: Object.entries(CFG.cipColors).map(([k, c]) => ({ color: c, kind: 'line', label: COPY.legend.cip[k] }))
    },
    flood: {
      layers: [
        { id: 'atlas14', type: 'fill', 'source-layer': 'atlas14', paint: { 'fill-color': '#fdae6b', 'fill-opacity': 0.35 } },
        { id: 'atlas14-line', type: 'line', 'source-layer': 'atlas14', paint: { 'line-color': '#e6550d', 'line-width': 1.5 } },
        outline
      ],
      legend: [{ color: '#fdae6b', label: COPY.legend.flood[0] }]
    },
    landmarks: {
      layers: [
        outline,
        { id: 'landmarks', type: 'circle', 'source-layer': 'landmarks',
          paint: { 'circle-color': ['match', ['get', 'inspection_result'], 'Fail', '#d7301f', '#4d4d4d'],
                   'circle-radius': ['match', ['get', 'inspection_result'], 'Fail', 6, 4],
                   'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } }
      ],
      legend: [{ color: '#4d4d4d', kind: 'dot', label: COPY.legend.landmarks[0] },
               { color: '#d7301f', kind: 'dot', label: COPY.legend.landmarks[1] }]
    }
  };

  // ── topic dropdown (top left, under the home link) ────────────────────────
  $('topicLabel').textContent = COPY.topicLabel;
  $('summaryCard').textContent = COPY.summaryCard;
  const select = $('topic');
  Object.keys(THEMES).forEach((key) => {
    const o = document.createElement('option');
    o.value = key; o.textContent = COPY.themes[key].name;
    select.appendChild(o);
  });
  select.addEventListener('change', () => showTheme(select.value));

  let current = null;
  function showTheme(key) {
    current = key;
    select.value = key;
    Object.entries(THEMES).forEach(([k, t]) => {
      t.layers.forEach((l) => map.setLayoutProperty(l.id, 'visibility', k === key ? 'visible' : 'none'));
    });
    // the city outline is shared by every theme; keep it visible
    map.setLayoutProperty('city-limits', 'visibility', 'visible');
    $('legendTitle').textContent = COPY.themes[key].name;
    $('legendSub').textContent = COPY.themes[key].sub;
    const rows = $('legendRows'); rows.innerHTML = '';
    THEMES[key].legend.forEach((r) => {
      const li = document.createElement('li');
      const sw = document.createElement('span'); sw.className = 'swatch ' + (r.kind || ''); sw.style.background = r.color;
      li.appendChild(sw); li.appendChild(document.createTextNode(r.label)); rows.appendChild(li);
    });
    fillAbout(key);
    $('months').hidden = !THEMES[key].months;
    if (THEMES[key].months) applyMonth();
    updateZoomHint();
    history.replaceState(null, '', '#' + key);
  }

  function updateZoomHint() {
    const t = THEMES[current];
    $('zoomHint').hidden = !(t && t.parcel && map.getZoom() < CFG.parcelMinZoom);
  }
  map.on('zoomend', updateZoomHint);

  // ── month slider for the permits theme ────────────────────────────────────
  const months = [];
  (function () {
    let [y, m] = CFG.permitMonths.first.split('-').map(Number);
    const [ly, lm] = CFG.permitMonths.last.split('-').map(Number);
    while (y < ly || (y === ly && m <= lm)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
  })();
  const slider = $('month');
  slider.max = months.length - 1; slider.value = months.length - 1;
  function applyMonth() {
    const ym = months[Number(slider.value)];
    $('monthLabel').textContent = ym;
    map.setFilter('permits-grid', ['==', ['get', 'year_month'], ym]);
  }
  slider.addEventListener('input', applyMonth);
  let timer = null;
  $('play').addEventListener('click', () => {
    if (timer) { clearInterval(timer); timer = null; $('play').textContent = COPY.ui.play; return; }
    $('play').textContent = COPY.ui.pause;
    if (Number(slider.value) >= months.length - 1) slider.value = 0;
    timer = setInterval(() => {
      slider.value = Number(slider.value) + 1; applyMonth();
      if (Number(slider.value) >= months.length - 1) { clearInterval(timer); timer = null; $('play').textContent = COPY.ui.play; }
    }, 350);
  });

  // ── popups ────────────────────────────────────────────────────────────────
  const money = (v) => v == null || v === '' ? '' : '$' + Math.round(Number(v)).toLocaleString();
  const pct = (v) => v == null || v === '' ? '' : (Number(v) > 0 ? '+' : '') + Number(v).toFixed(1) + '%';
  const rowsHtml = (pairs) => '<table>' + pairs.filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('') + '</table>';
  const P = COPY.popup;

  function popupHtml(layerId, p) {
    switch (layerId) {
      case 'parcel-value':
      case 'parcel-bill':
        return rowsHtml([[P.taxpayer, p.taxpayer_type], [P.taxable2025, money(p.taxable_2025)], [P.taxable2026, money(p.taxable_2026)],
          [P.bill2025, money(p.bill_2025)], [P.bill2026, money(p.bill_2026)], [P.change, pct(p.bill_pct)]]) + '<div class="history" data-parcel="' + (p.prop_id || '') + '"></div>';
      case 'nbhd-value':
      case 'nbhd-bill':
        return rowsHtml([[P.neighborhood, p.planning_area_name], [P.parcels, p.parcels], [P.change, pct(p.value_pct)], [P.medianHomestead, pct(p.median_homestead_bill_pct)]]);
      case 'parcel-drainage':
        return rowsHtml([[P.impervious, Number(p.impervious_sqft).toLocaleString() + ' sq ft'], [P.pctImpervious, p.pct_impervious + '%'],
          [P.chargeFy26, money(p.charge_fy26)], [P.chargeFy27, money(p.charge_fy27)]]);
      case 'permits-grid':
        return rowsHtml([[P.month, p.year_month], [P.permits, p.permits], [P.newConstruction, p.new_construction]]);
      case 'cip-lines':
      case 'cip-points':
        return `<strong>${p.project_name || ''}</strong>` + rowsHtml([[P.department, p.department], [P.program, p.program], [P.funding, p.funding_source],
          [P.fiveYear, money(p.total_5yr)], ['FY27', money(p.fy27)], ['FY28', money(p.fy28)], ['FY29', money(p.fy29)], ['FY30', money(p.fy30)], ['FY31', money(p.fy31)]]);
      case 'atlas14':
        return rowsHtml([[P.studyGroup, p.study_group], [P.watersheds, p.watersheds], [P.parcels, Number(p.parcels).toLocaleString()], [P.acres, Number(p.acres).toLocaleString()]]);
      case 'landmarks':
        return `<strong>${p.landmark_name || ''}</strong>` + rowsHtml([[P.address, p.address], [P.inspection, p.inspection_result]]);
      default:
        return '';
    }
  }

  // the parcel's 2021-2026 taxable values, from the existing parcel database
  async function fillHistory(el) {
    const id = el.dataset.parcel;
    if (!id) return;
    const url = `${CFG.supabase.url}/rest/v1/parcel_appraisal_history?parcel_id=eq.${encodeURIComponent(id)}&select=yr,taxable_val&order=yr`;
    try {
      const r = await fetch(url, { headers: { apikey: CFG.supabase.anonKey, Authorization: 'Bearer ' + CFG.supabase.anonKey } });
      const rows = await r.json();
      if (!Array.isArray(rows) || !rows.length) return;
      el.innerHTML = `<div>${P.history}</div>` + rowsHtml(rows.map((x) => [String(x.yr), money(x.taxable_val)]));
    } catch (e) { /* the popup still works without the history */ }
  }

  const clickable = ['parcel-value', 'parcel-bill', 'nbhd-value', 'nbhd-bill', 'parcel-drainage', 'permits-grid', 'cip-points', 'cip-lines', 'atlas14', 'landmarks'];
  map.on('click', (e) => {
    const feats = map.queryRenderedFeatures(e.point, { layers: clickable.filter((id) => map.getLayer(id)) });
    if (!feats.length) return;
    const f = feats[0];
    const popup = new maplibregl.Popup({ maxWidth: '300px' }).setLngLat(e.lngLat).setHTML(popupHtml(f.layer.id, f.properties)).addTo(map);
    const h = popup.getElement().querySelector('.history');
    if (h) fillHistory(h);
  });
  clickable.forEach((id) => {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
  });

  // ── reference overlays: ZIP codes and council districts ──────────────────
  // Two GeoJSON files (config.js overlays), each drawn as an outline plus a
  // label. Off by default; the checkboxes in the Layers box switch them on.
  $('overlaysTitle').textContent = COPY.ui.overlays;
  $('ovZipLabel').textContent = COPY.ui.overlayZip;
  $('ovCouncilLabel').textContent = COPY.ui.overlayCouncil;
  const OVERLAY_BOX = { zip: 'ovZip', council: 'ovCouncil' };
  // tint by number: palette[number % 10]
  function overlayTint(field) {
    const m = ['match', ['%', ['to-number', ['get', field]], 10]];
    CFG.overlayPalette.forEach((c, i) => m.push(i, c));
    m.push(CFG.overlayPalette[0]);
    return m;
  }
  function addOverlays() {
    Object.entries(CFG.overlays).forEach(([key, o]) => {
      map.addSource('overlay-' + key, { type: 'geojson', data: o.file });
      const ids = ['fill', 'line', 'label'].map((k) => 'overlay-' + key + '-' + k);
      map.addLayer({ id: ids[0], type: 'fill', source: 'overlay-' + key, layout: { visibility: 'none' },
        paint: { 'fill-color': overlayTint(o.label), 'fill-opacity': CFG.overlayFillOpacity } });
      map.addLayer({ id: ids[1], type: 'line', source: 'overlay-' + key, layout: { visibility: 'none' },
        paint: { 'line-color': o.color, 'line-width': 1.5 } });
      map.addLayer({ id: ids[2], type: 'symbol', source: 'overlay-' + key,
        layout: { visibility: 'none', 'symbol-placement': 'point', 'text-field': ['get', o.label],
                  'text-font': ['Noto Sans Bold'], 'text-size': 13 },
        paint: { 'text-color': o.color, 'text-halo-color': '#fff', 'text-halo-width': 2.5 } });
      const box = $(OVERLAY_BOX[key]);
      box.checked = false;
      box.addEventListener('change', () => {
        ids.forEach((id) => map.setLayoutProperty(id, 'visibility', box.checked ? 'visible' : 'none'));
      });
    });
  }

  // ── load ──────────────────────────────────────────────────────────────────
  map.on('load', () => {
    // satellite imagery sits above the basemap and below every data layer
    map.addSource('satellite', { type: 'raster', tiles: [CFG.satellite], tileSize: 256, attribution: 'Tiles &copy; Esri' });
    map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });
    Object.entries(CFG.tiles).forEach(([name, url]) => map.addSource(name, { type: 'vector', url }));
    const added = new Set();
    Object.values(THEMES).forEach((t) => t.layers.forEach((l) => {
      if (added.has(l.id)) return;
      added.add(l.id);
      map.addLayer(Object.assign({ source: sourceFor(l), layout: { visibility: 'none' } }, l));
    }));
    addOverlays();                 // added last so they draw above every theme
    const fromHash = location.hash.replace('#', '');
    showTheme(THEMES[fromHash] ? fromHash : 'bill');
  });
})();
