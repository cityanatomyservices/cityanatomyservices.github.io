/**
 * Wiring only: map + sources + tour + card. Each piece lives in its own file.
 */
import { buildTowers, buildIllumination } from './map-bits.js';
import { createTour } from './tour.js';
import { createCard } from './card.js';
import { createTowers3D } from './towers-3d.js';

const stops = window.MOONTOWER_STOPS;
const routes = window.MOONTOWER_ROUTES;
const style = window.ARCLIGHT_1895_STYLE;

const fallback = document.getElementById('fallback');
if (!stops || !style) {
  // Never fail silently to a black rectangle — say what is missing.
  fallback.textContent = 'Map data did not load. Run: node scripts/sync-web.js';
  fallback.hidden = false;
} else {
  const features = stops.features;
  const lit = new Set();          // which towers are alight right now
  let towers3d = null;            // the 3D models, once the map is up
  const card = createCard(document.getElementById('story-card'));

  const map = new maplibregl.Map({
    container: 'map',
    style,
    center: [-97.7441, 30.2728],
    zoom: 11.6,
    attributionControl: { compact: true },
    // The tour drives the camera; the visitor watches. Clicking a tower is the
    // one interaction, handled below.
    interactive: false,
  });

  // The style ships "towers"/"illumination" EMPTY on purpose — fill them now,
  // and again after any style reload, or the map renders a city with no towers.
  function redraw() {
    const t = map.getSource('towers');
    const i = map.getSource('illumination');
    if (t) t.setData(buildTowers(features, lit));
    if (i) i.setData(buildIllumination(features, lit));
    // The 3D towers light from the same set, in the same breath as the 2D ones.
    if (towers3d) towers3d.update(lit);
  }

  // The walking trails are STATIC — the same lines the app shows, drawn once and
  // never touched again. They sit below the light pools and the towers, so a
  // tower coming alight still reads on top of them. The style already carries
  // the six route layers (foot / bike / bike-on-street, each with a glow); all
  // this does is hand them their data.
  function drawTrails() {
    const r = map.getSource('routes');
    if (r && routes) r.setData(routes);
  }

  map.on('load', () => {
    drawTrails();

    // The models stand on the map itself. They are added on top of the existing
    // 2D dots and light pools rather than replacing them: the dot marks the
    // exact corner at any zoom, the pool is the light, the model is the tower.
    towers3d = createTowers3D({ map, features });
    map.addLayer(towers3d.layer);

    redraw();
    document.body.classList.add('ready');

    const tour = createTour({
      map,
      features,
      lit,
      onArrive: (f) => card.show(f),
      onRedraw: redraw,
    });
    tour.start();

    // Clicking a tower pins it; clicking anywhere else lets the tour go on.
    map.getCanvas().style.cursor = 'default';
    map.on('click', (e) => {
      const hit = map.queryRenderedFeatures(e.point).find((f) => f.source === 'towers');
      if (hit) {
        const full = features.find((f) => f.properties.id === hit.properties.id);
        if (full) tour.pin(full);
      } else {
        tour.release();
      }
    });
  });

  map.on('error', (e) => {
    console.warn('map error', e && e.error);
  });
}
