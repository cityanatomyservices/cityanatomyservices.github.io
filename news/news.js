// news.js — the map-based news feed. Reads feed.geojson (written daily by the
// Action), pins every placed story on the Moontower night basemap, lists all
// stories newest first, and links the two: click a pin, the story lights up;
// click a story, the map flies there. Every word on screen comes from the
// news outlets' own feeds.
(function () {
  const style = window.ARCLIGHT_1895_STYLE;
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');

  const map = new maplibregl.Map({
    container: 'map',
    style,
    center: [-97.7431, 30.2672],
    zoom: 10.8,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

  const when = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  let popup = null;
  const cards = new Map();   // story link -> list element

  function highlight(link) {
    cards.forEach((el, key) => el.classList.toggle('active', key === link));
    const el = cards.get(link);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function showPopup(f) {
    const p = f.properties;
    if (popup) popup.remove();
    popup = new maplibregl.Popup({ offset: 12 })
      .setLngLat(f.geometry.coordinates)
      .setHTML(`<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${p.color}">${esc(p.outlet)}</div>
                <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)}</a>`)
      .addTo(map);
  }

  function render(fc) {
    const placed = fc.features.filter((f) => f.geometry);

    // Pins: one circle per placed story, coloured by outlet, with a soft halo.
    map.addSource('news', { type: 'geojson', data: { type: 'FeatureCollection', features: placed } });
    map.addLayer({ id: 'news-halo', type: 'circle', source: 'news',
      paint: { 'circle-radius': 14, 'circle-color': ['get', 'color'], 'circle-opacity': 0.18, 'circle-blur': 0.6 } });
    map.addLayer({ id: 'news-dot', type: 'circle', source: 'news',
      paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#070a12', 'circle-stroke-width': 1.5 } });

    map.on('click', 'news-dot', (e) => {
      const f = e.features[0];
      // Layer features lose their original geometry object; rebuild it.
      const feat = { geometry: { coordinates: f.geometry.coordinates }, properties: f.properties };
      showPopup(feat);
      highlight(f.properties.link);
    });
    map.on('mouseenter', 'news-dot', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'news-dot', () => { map.getCanvas().style.cursor = ''; });

    // The list: every story, newest first, placed or not.
    fc.features.forEach((f) => {
      const p = f.properties;
      const el = document.createElement(f.geometry ? 'div' : 'a');
      el.className = 'story';
      el.style.setProperty('--c', p.color);
      if (!f.geometry) { el.href = p.link; el.target = '_blank'; el.rel = 'noopener'; }
      el.innerHTML = `<div class="meta">${esc(p.outlet)}<span class="when">${when(p.published)}</span></div>
                      <h3>${esc(p.title)}</h3>
                      ${p.place ? `<div class="place">${esc(p.place)}</div>` : ''}`;
      if (f.geometry) {
        el.addEventListener('click', () => {
          map.flyTo({ center: f.geometry.coordinates, zoom: Math.max(map.getZoom(), 13), duration: 1200 });
          showPopup(f);
          highlight(p.link);
        });
      }
      cards.set(p.link, el);
      list.appendChild(el);
    });

    if (!fc.features.length) { empty.style.display = 'block'; }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  map.on('load', () => {
    fetch('feed.geojson', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : { type: 'FeatureCollection', features: [] }))
      .then(render)
      .catch(() => { empty.style.display = 'block'; });
  });
}());
