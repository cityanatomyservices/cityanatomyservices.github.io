// app.js — the 3D models page: the map, the project picker, the Layers box
// and the About panel. The models themselves are drawn by model-layer.js;
// where they go comes from data/placements.json (made by
// tools/models/place.py); the files from config.js; the words from copy.js.
import { createModelLayer } from './model-layer.js?v=20261026b';

const CFG = window.MODELS_CONFIG;
const COPY = window.MODELS_COPY;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── words on the static parts of the page ──
document.title = COPY.title;
$('title').textContent = COPY.title;
$('home').textContent = COPY.home;
$('ctrlSatellite').textContent = COPY.satellite;
$('ctrlExtent').title = COPY.extentTitle;
$('projectsTitle').textContent = COPY.projectsTitle;
$('projectsSub').textContent = COPY.projectsSub;
$('layersTitle').textContent = COPY.layersTitle;
$('aboutToggle').textContent = COPY.aboutOpen;

// ── the placements, then the map ──
const placements = (await (await fetch(CFG.placements)).json()).projects;
const projects = CFG.projects.filter((p) => placements[p.id]);

// the box around every project's footprint: how the page opens
const all = projects.map((p) => placements[p.id].bounds);
const allBox = [
  Math.min(...all.map((b) => b[0])), Math.min(...all.map((b) => b[1])),
  Math.max(...all.map((b) => b[2])), Math.max(...all.map((b) => b[3]))
];

const map = new maplibregl.Map({
  container: 'map',
  style: CFG.basemap,
  bounds: allBox,
  fitBoundsOptions: { padding: CFG.fitPadding },
  minZoom: CFG.minZoom,
  maxPitch: 70,
  // MapLibre draws without antialiasing unless asked; the models' edges then
  // come out stepped, which reads as blur (owner, 2026-10-26)
  antialias: true,
  attributionControl: { compact: true }
});
const models = createModelLayer({ map });
let current = null;

function fitAll() {
  map.fitBounds(allBox, { padding: CFG.fitPadding, pitch: 0, bearing: 0, duration: 1200 });
}

// ── picking a project: show its layers, hide the others', fly there ──
function keyOf(project, layer) { return project.id + '/' + layer.id; }

async function syncLayers() {
  for (const p of projects) {
    for (const l of p.layers) {
      const wanted = current && p.id === current.id && l.on;
      const key = keyOf(p, l);
      if (wanted && !models.has(key)) {
        const row = document.querySelector(`.project-row[data-id="${p.id}"]`);
        row?.classList.add('is-loading');
        try { await models.add(key, l.file, placements[p.id]); }
        catch (e) { console.error('model failed to load', l.file, e); alert(COPY.loadFailed); }
        row?.classList.remove('is-loading');
      }
      models.show(key, wanted);
    }
  }
}

function pick(id, fly = true) {
  current = projects.find((p) => p.id === id) || null;
  for (const b of document.querySelectorAll('.project-row')) b.setAttribute('aria-current', current && b.dataset.id === current.id ? 'true' : 'false');
  renderLayers();
  renderAbout();
  if (current && fly) {
    const pl = placements[current.id];
    map.fitBounds(pl.bounds, { padding: CFG.fitPadding, pitch: CFG.pitch, bearing: pl.heading_deg, duration: 2200 });
  }
  if (current) history.replaceState(null, '', '#' + current.id);
  syncLayers();
}

// ── the picker rows ──
for (const p of projects) {
  const words = COPY.projects[p.id] || { name: p.id };
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'project-row';
  b.dataset.id = p.id;
  b.setAttribute('aria-current', 'false');
  b.innerHTML = `<span class="swatch" style="background:${p.color}"></span><span>${esc(words.name)}<small>${esc(words.short || '')}</small></span>`;
  b.addEventListener('click', () => pick(p.id));
  $('projectRows').appendChild(b);
}

// ── the Layers box ──
let buildingsOn = false;
function renderLayers() {
  const rows = $('layerRows');
  rows.innerHTML = '';
  if (current) {
    const words = (COPY.projects[current.id] || {}).layers || {};
    for (const l of current.layers) {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" ${l.on ? 'checked' : ''}><span class="overlay-swatch is-polygon" style="color:${current.color}"></span><span>${esc(words[l.id] || l.id)}</span>`;
      label.querySelector('input').addEventListener('change', (e) => { l.on = e.target.checked; syncLayers(); });
      rows.appendChild(label);
    }
  }
  const label = document.createElement('label');
  label.innerHTML = `<input type="checkbox" ${buildingsOn ? 'checked' : ''}><span class="overlay-swatch is-polygon" style="color:#8a8f99"></span><span>${esc(COPY.buildings)}</span>`;
  label.querySelector('input').addEventListener('change', (e) => {
    buildingsOn = e.target.checked;
    map.setLayoutProperty('buildings-3d', 'visibility', buildingsOn ? 'visible' : 'none');
  });
  rows.appendChild(label);
}

// ── the About panel: what the model shows, what it is not, and the placement
//    reasoning straight out of placements.json ──
function renderAbout() {
  const toggle = $('aboutToggle');
  const about = $('about');
  toggle.hidden = !current;
  if (!current) { about.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = COPY.aboutOpen; return; }
  const words = COPY.projects[current.id] || {};
  const pl = placements[current.id];
  const L = COPY.labels;
  const d = pl.derivation || {};
  about.innerHTML = `
    <p class="draft">${esc(COPY.draft)}</p>
    <h4>${esc(L.what)}</h4><p>${esc(words.what)}</p>
    <h4>${esc(L.caveats)}</h4><p>${esc(words.caveats)}</p>
    <h4>${esc(L.placement)}</h4>
    <ul><li>${esc(d.anchor)}</li><li>${esc(d.heading)}</li><li>${esc(d.ground_offset)}</li></ul>
    <h4>${esc(L.accuracy)}</h4><p>${esc(pl.accuracy)}</p>
    <h4>${esc(L.sources)}</h4>
    <ul>${(words.sources || []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul>`;
}
$('aboutToggle').addEventListener('click', () => {
  const open = $('about').hidden;
  $('about').hidden = !open;
  $('aboutToggle').setAttribute('aria-expanded', String(open));
  $('aboutToggle').textContent = open ? COPY.aboutClose : COPY.aboutOpen;
});

// ── fold cards (same behaviour as the topic maps) ──
for (const [btn, body, card] of [['projectsTitle', 'projectsBody', 'projects'], ['layersTitle', 'layerRows', 'layers']]) {
  $(btn).addEventListener('click', () => {
    const open = $(body).hidden;
    $(body).hidden = !open;
    $(btn).setAttribute('aria-expanded', String(open));
    $(card).classList.toggle('is-collapsed', !open);
  });
}
// on a phone the Layers box starts folded so the picker has the room
if (window.innerWidth < 640) $('layersTitle').click();

// ── map controls ──
$('ctrlZoomIn').addEventListener('click', () => map.zoomIn());
$('ctrlZoomOut').addEventListener('click', () => map.zoomOut());
$('ctrlExtent').addEventListener('click', fitAll);
$('ctrlSatellite').addEventListener('click', () => {
  const on = $('ctrlSatellite').getAttribute('aria-pressed') !== 'true';
  $('ctrlSatellite').setAttribute('aria-pressed', String(on));
  $('ctrlSatellite').classList.toggle('is-on', on);
  map.setLayoutProperty('satellite', 'visibility', on ? 'visible' : 'none');
});

map.on('load', () => {
  map.addSource('satellite', { type: 'raster', tiles: [CFG.satellite], tileSize: 256, attribution: 'Tiles &copy; Esri' });
  map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });

  // the city's existing buildings, from the basemap's own data; off until asked
  map.addLayer({ id: 'buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
    layout: { visibility: 'none' },
    paint: { 'fill-extrusion-color': '#d6d9dd', 'fill-extrusion-opacity': 0.8,
             'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
             'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] } });

  // a dot and name at each project's anchor, so the overview shows where to go
  const anchors = { type: 'FeatureCollection', features: projects.map((p) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: placements[p.id].anchor },
    properties: { id: p.id, name: (COPY.projects[p.id] || {}).name || p.id, color: p.color } })) };
  map.addSource('anchors', { type: 'geojson', data: anchors });
  map.addLayer({ id: 'anchors', type: 'circle', source: 'anchors',
    paint: { 'circle-color': ['get', 'color'], 'circle-radius': 7, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } });
  map.addLayer({ id: 'anchor-labels', type: 'symbol', source: 'anchors',
    layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top' },
    paint: { 'text-color': '#1f2933', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
  map.on('click', 'anchors', (e) => { const f = e.features && e.features[0]; if (f) pick(f.properties.id); });
  map.on('mouseenter', 'anchors', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'anchors', () => { map.getCanvas().style.cursor = ''; });

  // the models, last, so they draw over everything else
  map.addLayer(models.layer);

  // #drainage in the address opens on that project
  const wanted = location.hash.replace('#', '');
  renderLayers();
  renderAbout();
  if (projects.some((p) => p.id === wanted)) pick(wanted);
  window.modelsMap = map;
  window.modelsLayer = models;   // for checks from the console
});
