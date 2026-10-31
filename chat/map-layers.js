/* Main-map controls only. Boundary overlays are opt-in and never persisted. */
window.AustinMapLayers = {
  init(map) {
    const button = document.getElementById('ctrlMapLayers');
    const panel = document.getElementById('map-layers-panel');
    const close = document.getElementById('map-layers-close');
    function show(on, returnFocus = false) {
      if (on) for (const name of ['AustinExplore', 'AustinDayPlan', 'AustinChatCard', 'AustinApps']) window[name]?.close?.();
      panel.hidden = !on;
      button.setAttribute('aria-expanded', String(on));
      button.classList.toggle('is-on', on);
      if (on) close.focus({ preventScroll: true });
      else if (returnFocus || panel.contains(document.activeElement)) button.focus({ preventScroll: true });
    }
    window.AustinMapLayers.close = () => show(false);
    button.addEventListener('click', () => show(panel.hidden));
    close.addEventListener('click', () => show(false, true));
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') show(false, true); });
    // This listener belongs only to the main map. Other maps keep their menus.
    document.getElementById('stack').addEventListener('click', event => {
      const control = event.target.closest('button');
      if (control && control !== button) show(false);
    }, true);

    const boundaries = [
      { id: 'zip', url: '/chat/data/zipcodes.geojson?v=20261031d', field: 'zipcode', color: '#7543aa', prefix: '', name: 'ZIP codes' },
      { id: 'council', url: '/budget/data/council_districts.geojson?v=20260912h', field: 'district_number', color: '#b54b12', prefix: 'District ', name: 'council districts' }
    ];
    function draw(layer) {
      const source = 'boundary-' + layer.id;
      if (layer.data && layer.input.checked && !map.getSource(source)) {
        map.addSource(source, { type: 'geojson', data: layer.data });
        // Listings remain above the boundary shading and lines.
        const before = map.getStyle().layers.find(item => item.id.startsWith('explore-'))?.id;
        const add = definition => map.addLayer({ ...definition, source }, before);
        add({ id: source + '-fill', type: 'fill', paint: { 'fill-color': layer.color, 'fill-opacity': 0.04 } });
        add({ id: source + '-halo', type: 'line', paint: { 'line-color': '#ffffff', 'line-opacity': 0.8, 'line-width': 4.5 } });
        add({ id: source + '-line', type: 'line', paint: { 'line-color': layer.color, 'line-width': 2.2, ...(layer.id === 'zip' ? { 'line-dasharray': [3, 2] } : {}) } });
        add({ id: source + '-labels', type: 'symbol', minzoom: layer.id === 'zip' ? 8 : 7,
          layout: { 'text-field': ['concat', layer.prefix, ['to-string', ['get', layer.field]]], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-padding': 12 },
          paint: { 'text-color': layer.color, 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
      }
      for (const suffix of ['fill', 'halo', 'line', 'labels']) {
        const id = source + '-' + suffix;
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', layer.input.checked ? 'visible' : 'none');
      }
    }
    async function toggle(layer) {
      draw(layer);
      if (!layer.input.checked) { layer.status.textContent = ''; return; }
      if (layer.data) return;
      layer.status.textContent = `Loading ${layer.name}…`;
      if (!layer.pending) layer.pending = (async () => {
        const response = await fetch(layer.url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('Boundary data unavailable');
        const data = await response.json();
        if (data.type !== 'FeatureCollection' || !data.features?.length || !data.features.every(f => ['Polygon', 'MultiPolygon'].includes(f.geometry?.type) && f.properties?.[layer.field])) throw new Error('Invalid boundary data');
        layer.data = data;
      })().finally(() => { layer.pending = null; });
      try {
        await layer.pending;
        layer.status.textContent = '';
        draw(layer); // A late response must respect a toggle switched off meanwhile.
      } catch (_) {
        const wanted = layer.input.checked;
        layer.input.checked = false;
        layer.status.textContent = wanted ? `Could not load ${layer.name}. Turn on to retry.` : '';
        draw(layer);
      }
    }
    for (const layer of boundaries) {
      layer.input = panel.querySelector(`[data-boundary="${layer.id}"]`);
      layer.status = panel.querySelector(`[data-boundary-status="${layer.id}"]`);
      layer.input.checked = false;
      layer.input.addEventListener('change', () => toggle(layer));
    }
    map.on('style.load', () => boundaries.forEach(draw));
    const session = window.AustinSession;
    let owner = session?.registered ? session.user.id : null;
    const unsubscribe = session?.subscribe(() => {
      const nextOwner = session.registered ? session.user.id : null;
      if (owner === nextOwner) return;
      owner = nextOwner;
      boundaries.forEach(layer => { layer.input.checked = false; layer.status.textContent = ''; draw(layer); });
      show(false);
    });
    window.addEventListener('pagehide', () => unsubscribe?.(), { once: true });
  }
};
