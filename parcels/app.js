// app.js — Parcelizer viewer.
//
// Data flow:
//   PMTiles vector tileset (Supabase Storage, public bucket)
//     -> MapLibre vector source -> fill+line layers
//   Click a parcel -> read parcel_id from the MVT feature
//     -> if the report drawer is mounted: open it (Constraints tab loads)
//     -> else (embed page): show the legacy popup with parcel_id + zoning
//
// The split: app.js only owns the map and click routing; the drawer owns
// per-tab data loading via ParcelAPI.

(function () {
  const CFG = window.PARCELS_CONFIG;
  if (!CFG) {
    console.error('PARCELS_CONFIG missing; did config.js load?');
    return;
  }

  // --- PMTiles protocol registration ---------------------------------------
  const pmProtocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', pmProtocol.tile);

  // --- Supabase client + API wiring ----------------------------------------
  const { createClient } = window.supabase;
  const sb = createClient(CFG.supabase.url, CFG.supabase.anonKey, {
    auth: { persistSession: false }
  });
  if (window.ParcelAPI) window.ParcelAPI.init(sb);

  // Mount the drawer (no-op on /parcels/embed.html where #drawer is absent).
  const drawerMounted = !!(window.ParcelDrawer && window.ParcelDrawer.mount());

  // --- Map ------------------------------------------------------------------
  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        basemap: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        },
        parcels: {
          type: 'vector',
          url: CFG.pmtiles.url,
          promoteId: 'parcel_id'
        }
      },
      layers: [
        { id: 'basemap', type: 'raster', source: 'basemap' },
        {
          id: 'parcels-fill',
          type: 'fill',
          source: 'parcels',
          'source-layer': CFG.pmtiles.sourceLayer,
          minzoom: CFG.pmtiles.minzoom,
          paint: {
            'fill-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#ffb703',
              ['boolean', ['feature-state', 'hover'],    false], '#8ecae6',
              '#cfd8dc'
            ],
            'fill-opacity': 0.55,
            'fill-outline-color': '#455a64'
          }
        },
        {
          id: 'parcels-line',
          type: 'line',
          source: 'parcels',
          'source-layer': CFG.pmtiles.sourceLayer,
          minzoom: CFG.pmtiles.minzoom,
          paint: {
            'line-color': '#37474f',
            'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.2, 16, 1.2]
          }
        }
      ]
    },
    center:    CFG.center,
    zoom:      CFG.zoom,
    maxBounds: CFG.maxBounds
  });

  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'imperial' }), 'bottom-left');

  window.AustinMapUI?.mount(map);
  // --- Zoom-hint banner -----------------------------------------------------
  const zoomHint = document.getElementById('zoom-hint');
  function updateZoomHint() {
    if (!zoomHint) return;
    zoomHint.hidden = map.getZoom() >= CFG.zoomHintThreshold;
  }
  map.on('load', updateZoomHint);
  map.on('zoomend', updateZoomHint);

  // --- Hover feature-state --------------------------------------------------
  const SRC = { source: 'parcels', sourceLayer: CFG.pmtiles.sourceLayer };
  let hoverId = null;

  map.on('mousemove', 'parcels-fill', (e) => {
    if (!e.features || e.features.length === 0) return;
    const id = e.features[0].id;
    if (id == null) return;
    if (hoverId !== null && hoverId !== id) {
      map.setFeatureState({ ...SRC, id: hoverId }, { hover: false });
    }
    hoverId = id;
    map.setFeatureState({ ...SRC, id }, { hover: true });
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'parcels-fill', () => {
    if (hoverId !== null) {
      map.setFeatureState({ ...SRC, id: hoverId }, { hover: false });
    }
    hoverId = null;
    map.getCanvas().style.cursor = '';
  });

  // --- Selection feature-state (cleared by drawer close or click elsewhere)
  let selectedId = null;
  function clearSelection() {
    if (selectedId !== null) {
      map.setFeatureState({ ...SRC, id: selectedId }, { selected: false });
      selectedId = null;
    }
  }
  function selectFeature(id) {
    if (selectedId !== null && selectedId !== id) {
      map.setFeatureState({ ...SRC, id: selectedId }, { selected: false });
    }
    selectedId = id;
    map.setFeatureState({ ...SRC, id }, { selected: true });
  }

  // --- Legacy popup (used only when the drawer is not mounted, i.e. embed) -
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function renderEmbedPopup(data) {
    const rows = [['Parcel ID', data.parcel_id], ['Zoning', data.zoning || '—']];
    if (data.metadata && typeof data.metadata === 'object') {
      for (const [k, v] of Object.entries(data.metadata)) {
        if (v == null || v === '') continue;
        rows.push([k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
      }
    }
    const dl = rows.map(([k, v]) =>
      `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`
    ).join('');
    return `<div class="parcel-popup"><dl>${dl}</dl></div>`;
  }

  async function showEmbedPopup(id, lngLat) {
    const popup = new maplibregl.Popup({ maxWidth: '320px', offset: 8 })
      .setLngLat(lngLat)
      .setHTML(`<div class="parcel-popup"><em>Loading parcel ${escapeHtml(id)}…</em></div>`)
      .addTo(map);
    popup.on('close', clearSelection);
    try {
      const data = await window.ParcelAPI.getParcel(id);
      if (!data) {
        popup.setHTML(
          `<div class="parcel-popup"><strong>Parcel ${escapeHtml(id)}</strong>` +
          `<p class="err">No attribute row found in Supabase.</p></div>`
        );
        return;
      }
      popup.setHTML(renderEmbedPopup(data));
    } catch (err) {
      popup.setHTML(
        `<div class="parcel-popup"><strong>Parcel ${escapeHtml(id)}</strong>` +
        `<p class="err">${escapeHtml(err.message || String(err))}</p></div>`
      );
    }
  }

  // --- Click handler --------------------------------------------------------
  map.on('click', 'parcels-fill', (e) => {
    if (!e.features || e.features.length === 0) return;
    const f  = e.features[0];
    const id = f.id != null ? f.id : f.properties && f.properties.parcel_id;
    if (id == null) return;
    selectFeature(id);

    if (drawerMounted) {
      window.ParcelDrawer.openForParcel(id);
    } else {
      showEmbedPopup(id, e.lngLat);
    }
  });

  // --- Filter integration ---------------------------------------------------
  // filter.js emits `parcelfilterchange` when the user adjusts the search
  // panel. We translate the active filter into a server query (search_parcels
  // RPC, scoped to the current viewport) and de-emphasise non-matching
  // parcels with a paint expression. Every parcel stays present and clickable,
  // so the existing click -> drawer flow is unaffected.
  const FILL_OPACITY = 0.55;
  let activeFilter = null;
  let filterSeq = 0;

  function clearParcelHighlight() {
    if (!map.getLayer('parcels-fill')) return;
    map.setPaintProperty('parcels-fill', 'fill-opacity', FILL_OPACITY);
    map.setPaintProperty('parcels-line', 'line-opacity', 1);
  }

  function applyParcelHighlight(ids) {
    if (!map.getLayer('parcels-fill')) return;
    const match = ['in', ['id'], ['literal', ids]];
    map.setPaintProperty('parcels-fill', 'fill-opacity',
      ['case', match, 0.72, 0.06]);
    map.setPaintProperty('parcels-line', 'line-opacity',
      ['case', match, 1, 0.1]);
  }

  async function runParcelFilter() {
    if (!activeFilter) { clearParcelHighlight(); return; }
    const seq = ++filterSeq;
    document.dispatchEvent(new CustomEvent('parcelfilterresult',
      { detail: { loading: true } }));
    const b = map.getBounds();
    try {
      const ids = await window.ParcelAPI.searchParcels({
        categories: activeFilter.categories,
        farMin:     activeFilter.farMin,
        farMax:     activeFilter.farMax,
        heightMin:  activeFilter.heightMin,
        heightMax:  activeFilter.heightMax,
        west: b.getWest(),  south: b.getSouth(),
        east: b.getEast(),  north: b.getNorth()
      });
      if (seq !== filterSeq) return;          // a newer request superseded us
      applyParcelHighlight(ids);
      document.dispatchEvent(new CustomEvent('parcelfilterresult',
        { detail: { count: ids.length } }));
    } catch (err) {
      if (seq !== filterSeq) return;
      console.warn('[parcels] search failed', err);
      document.dispatchEvent(new CustomEvent('parcelfilterresult',
        { detail: { error: (err && err.message) || 'Search failed' } }));
    }
  }

  document.addEventListener('parcelfilterchange', (e) => {
    activeFilter = (e.detail && e.detail.active) ? e.detail : null;
    if (activeFilter) {
      runParcelFilter();
    } else {
      clearParcelHighlight();
      document.dispatchEvent(new CustomEvent('parcelfilterresult',
        { detail: { count: null } }));
    }
  });

  // Re-scope the search to the viewport whenever the user pans or zooms.
  map.on('moveend', () => { if (activeFilter) runParcelFilter(); });

  // --- Source-load diagnostics ---------------------------------------------
  map.on('error', (e) => {
    console.warn('[parcels] map error', e && e.error ? e.error : e);
  });
}());
