// Parcel vector map, report selection and viewport search.
export function mountMap(onPick) {
  const CFG = window.PARCELS_CONFIG;

  // --- PMTiles protocol registration ---------------------------------------
  const pmProtocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', pmProtocol.tile);

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

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  window.austinMap = map;
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

  let selectedId = null;
  map.once('load', () => {
    if (selectedId !== null) map.setFeatureState({...SRC, id:selectedId}, {selected:true});
  });
  function selectFeature(id) {
    if (!map.getLayer('parcels-fill')) { selectedId = id; return; }
    if (selectedId !== null && selectedId !== id) {
      map.setFeatureState({ ...SRC, id: selectedId }, { selected: false });
    }
    selectedId = id;
    map.setFeatureState({ ...SRC, id }, { selected: true });
  }

  // --- Click handler --------------------------------------------------------
  map.on('click', 'parcels-fill', (e) => {
    if (!e.features || e.features.length === 0) return;
    const f  = e.features[0];
    const id = f.id != null ? f.id : f.properties && f.properties.parcel_id;
    if (id == null) return;
    selectFeature(id);
    onPick(id, e.lngLat.toArray(), null, map.getCanvas());
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
      const limited = ids.length >= (window.ParcelAPI.searchLimit || 1000);
      if (limited) clearParcelHighlight();
      else applyParcelHighlight(ids);
      document.dispatchEvent(new CustomEvent('parcelfilterresult',
        { detail: { count: ids.length, limited } }));
    } catch (err) {
      if (seq !== filterSeq) return;
      clearParcelHighlight();
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
      ++filterSeq;
      clearParcelHighlight();
      document.dispatchEvent(new CustomEvent('parcelfilterresult',
        { detail: { count: null } }));
    }
  });

  map.once('load', () => { if (activeFilter) runParcelFilter(); });
  // Re-scope the search to the viewport whenever the user pans or zooms.
  map.on('moveend', () => { if (activeFilter) runParcelFilter(); });

  // --- Source-load diagnostics ---------------------------------------------
  map.on('error', (e) => {
    console.warn('[parcels] map error', e && e.error ? e.error : e);
  });
  return (id, point) => {
    map.jumpTo({center:point, zoom:17});
    selectFeature(id);
  };
}
