// Wiring only: the map, the tour engine, GPS, the strike, and the chrome
// around them. Each piece lives in its own file; this one connects them.
//
// The map style is the app's own arclight-1895 style, loaded verbatim. It
// ships its "towers", "illumination" and "routes" sources EMPTY; this page
// fills them with the vendor data after every style load (the night/day
// toggle reloads the style). ALL map styling stays in the style file, never
// here. What the page adds on top: the approach pulse, the strike overlay
// and the visitor's own location dot, all drawn only in the style's reserved
// arc colours.

import { COPY, CREDITS } from './copy.js';
import { esc } from '../../webtour/text.js';
import { evaluatePosition, nearestPendingStop, ringCoordinates } from '../../webtour/engine.js';
import { createStore } from '../../webtour/store.js';
import { createDistanceSession, advanceDistance, resetDistanceSession, clearLastReading, formatMiles } from '../../webtour/distance.js';
import { PERMISSION_DENIED, createWatch, createWakeLock, geolocationAvailable, getFix } from '../../webtour/geo.js';
import { createBanner, createDrawer, createPicker, tapOrHold } from '../../webtour/controls.js';
import { createCard } from './card.js';
import { createStory } from './story.js';
import { buildIllumination, RING_RADII_M, scheduleStrike, buzz, NEARBY_PULSE_FRAMES, NEARBY_PULSE_STEP_MS } from './strike.js';

const $ = (id) => document.getElementById(id);

const towersJson = window.MOONTOWER_STOPS;
const routesJson = window.MOONTOWER_ROUTES;
const STYLE = { night: window.MOONTOWER_STYLE_NIGHT, day: window.MOONTOWER_STYLE_DAY };

if (!towersJson || !routesJson || !STYLE.night) {
  // Never fail silently to a black rectangle: say what is missing.
  const fallback = $('fallback');
  fallback.textContent = 'Map data did not load. Run: node tools/sync-webapps.js';
  fallback.hidden = false;
} else {
  boot();
}

// The style's reserved arc accents (palette.ts ArcAccents): used ONLY by the
// transient pulse and strike overlays, so they speak the same language as
// the style's permanent lit state.
const ARC = { core: '#e9e6ff', glow: '#b9a8f0', pool: '#8f7fd4', arc: '#cdd9ff', ink: '#070a12' };
const EMPTY = { type: 'FeatureCollection', features: [] };

function boot() {
  // ------------------------------------------------------------- data
  const towers = [...towersJson.features];
  const towerById = (id) => towers.find((t) => t.properties.id === id);
  const dayAvailable = typeof (STYLE.day && STYLE.day.version) === 'number';

  // The picker groups towers by leg, in order of first appearance, each
  // leg's towers in tour order.
  const legGroups = [];
  for (const t of towers) {
    let g = legGroups.find((x) => x.leg === t.properties.leg);
    if (!g) { g = { leg: t.properties.leg, towers: [] }; legGroups.push(g); }
    g.towers.push(t);
  }
  for (const g of legGroups) g.towers.sort((a, b) => a.properties.order - b.properties.order);

  const lngs = towers.map((t) => t.geometry.coordinates[0]);
  const lats = towers.map((t) => t.geometry.coordinates[1]);
  const towerBounds = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];

  // Opening view: over the downtown cluster (the biggest bunch of towers),
  // tilted like the picker flights. Zoom-to-extents gives the overview.
  const downtown = towers.filter((t) => t.properties.leg === 'downtown');
  const DOWNTOWN_CENTER = downtown.length
    ? [downtown.reduce((s, t) => s + t.geometry.coordinates[0], 0) / downtown.length,
       downtown.reduce((s, t) => s + t.geometry.coordinates[1], 0) / downtown.length]
    : [-97.7431, 30.2705];
  const OPENING_ZOOM = 14.2;
  const FLY_ZOOM = 16.3;
  const FLY_PITCH = 57;      // beyond this the horizon washes out
  const FLY_MS = 2200;
  const EXTENT_PADDING = { top: 110, right: 56, bottom: 120, left: 56 };
  const APPROACH_RADIUS_M = 400; // the pulse begins well outside the geofence
  const TAP_PADDING_PX = 22;     // half-size of the box queried around a tap
  const TOWER_LAYERS = ['tower-core', 'tower-halo', 'tower-label'];

  // ------------------------------------------------------------ state
  // Lit towers (the tour) and towers whose geofence really fired (the
  // honest record of being there). Lighting is playable from anywhere, on
  // purpose: the strike is the fun. The ✦ in the picker reads from visits.
  const store = createStore('cityanatomy:moontowertour:tour-v1');
  const visits = createStore('cityanatomy:moontowertour:visits-v1');
  let mapMode = 'night';
  let travelMode = 'foot';
  let tilted = true;
  let locationEnabled = false;
  let locating = false;
  let following = false;   // camera follows the visitor after a locate
  let followTimer = null;
  let tracking = false;
  let distance = createDistanceSession();
  let counters = {};
  let lastReading = null;
  let pickTimer = null;
  const nearbyIds = new Set(); // geofence fired, not yet lit (this session)
  let approachId = null;       // nearest unlit tower within APPROACH_RADIUS_M
  let strikingId = null;       // the one strike allowed at a time
  let cancelStrike = null;
  let pulseTimer = null;
  let pulseStep = 0;

  // ------------------------------------------------------------ chrome
  const banner = createBanner($('banner'));
  const drawer = createDrawer($('drawer'), $('drawer-backdrop'), CREDITS);
  const picker = createPicker($('picker'), towers, { rows: pickerRows, onPick: pickTower });
  const card = createCard($('card'), {
    onClose: () => setActive(null),
    onReadStory: (t) => openStory(t.properties.id),
    onLight: (t) => lightTower(t.properties.id),
  });
  const story = createStory($('story'), {
    onBack: closeStory,
    onBackToMap: closeStory,
    onLight: (t) => lightTower(t.properties.id),
  });
  const wakeLock = createWakeLock();

  // --------------------------------------------------------------- map
  const map = new maplibregl.Map({
    container: 'map',
    style: cloneStyle(STYLE.night),
    center: DOWNTOWN_CENTER,
    zoom: OPENING_ZOOM,
    pitch: FLY_PITCH,
    attributionControl: false, // the ⓘ drawer carries the credits instead
  });

  // The style's "towers" contract: every tower with `lit` merged in.
  function towersWithLit() {
    return {
      type: 'FeatureCollection',
      features: towers.map((t) => ({ ...t, properties: { ...t.properties, lit: store.isDone(t.properties.id) } })),
    };
  }

  function visibleRoutes() {
    return {
      type: 'FeatureCollection',
      features: routesJson.features.filter((f) => f.properties && f.properties.mode === travelMode),
    };
  }

  function pointsFor(ids) {
    return { type: 'FeatureCollection', features: ids.map((id) => towerById(id)).filter(Boolean)
      .map((t) => ({ type: 'Feature', properties: {}, geometry: t.geometry })) };
  }

  function userDot() {
    if (!lastReading || !locationEnabled) return EMPTY;
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {},
      geometry: { type: 'Point', coordinates: [lastReading.longitude, lastReading.latitude] } }] };
  }

  function setData(sourceId, data) {
    const s = map.getSource(sourceId);
    if (s) s.setData(data);
  }

  // Fill the style's empty sources and add the page's own overlays. Runs
  // after every style load, because a style swap throws the old ones away.
  function fillSources() {
    setData('towers', towersWithLit());
    setData('illumination', buildIllumination(towers, store.isDone));
    setData('routes', visibleRoutes());
    if (map.getSource('nearby-pulse')) {
      redrawOverlays();
      return;
    }
    map.addSource('nearby-pulse', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'nearby-pulse-glow', type: 'circle', source: 'nearby-pulse',
      paint: { 'circle-color': ARC.glow, 'circle-radius': 10, 'circle-blur': 1, 'circle-opacity': 0.12, 'circle-pitch-alignment': 'map' } });
    map.addSource('strike-bloom', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'strike-bloom-fill', type: 'fill', source: 'strike-bloom',
      paint: { 'fill-antialias': false, 'fill-color': ARC.pool, 'fill-opacity': 0 } });
    map.addLayer({ id: 'strike-bloom-edge', type: 'line', source: 'strike-bloom',
      paint: { 'line-color': ARC.glow, 'line-opacity': 0, 'line-width': 1.1, 'line-dasharray': [3, 2] } });
    map.addSource('strike-core', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'strike-core-glow', type: 'circle', source: 'strike-core',
      paint: { 'circle-color': ARC.glow, 'circle-radius': 6, 'circle-blur': 1, 'circle-opacity': 0 } });
    map.addLayer({ id: 'strike-core-dot', type: 'circle', source: 'strike-core',
      paint: { 'circle-color': ARC.core, 'circle-radius': 3, 'circle-opacity': 0 } });
    // The visitor's dot: a white core with a dark ring stays legible over
    // both the night ink and the day paper, and over the route lines.
    map.addSource('user', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'user-location-glow', type: 'circle', source: 'user',
      paint: { 'circle-radius': 18, 'circle-blur': 1, 'circle-color': ARC.arc, 'circle-opacity': 0.4, 'circle-pitch-alignment': 'map' } });
    map.addLayer({ id: 'user-location-core', type: 'circle', source: 'user',
      paint: { 'circle-radius': 7.5, 'circle-color': '#ffffff', 'circle-stroke-color': ARC.ink, 'circle-stroke-width': 3, 'circle-pitch-alignment': 'map' } });
    redrawOverlays();
  }

  function redrawTowers() {
    setData('towers', towersWithLit());
    setData('illumination', buildIllumination(towers, store.isDone));
  }

  function redrawOverlays() {
    setData('user', userDot());
    redrawPulse();
  }

  map.on('style.load', fillSources);
  map.on('load', () => {
    document.body.classList.add('ready');
    map.getCanvas().style.cursor = 'default';
  });
  map.on('error', (e) => console.warn('map error', e && e.error));
  // A drag means the visitor wants the camera: stop following them.
  map.on('dragstart', () => { following = false; });

  // Towers are drawn by the style's own layers, so a tap is resolved by
  // querying a small box around it. A hit opens the card; a miss closes it.
  map.on('click', (e) => {
    picker.hide();
    chipChevron();
    if (pickTimer) { clearTimeout(pickTimer); pickTimer = null; }
    const { x, y } = e.point;
    const hit = map.queryRenderedFeatures(
      [[x - TAP_PADDING_PX, y - TAP_PADDING_PX], [x + TAP_PADDING_PX, y + TAP_PADDING_PX]],
      { layers: TOWER_LAYERS }
    ).find((f) => typeof f.properties.id === 'string');
    setActive(hit ? hit.properties.id : null);
  });
  for (const layer of TOWER_LAYERS) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = 'default'; });
  }

  // ------------------------------------------------------------- card
  function setActive(id) {
    if (!id) { card.hide(); return; }
    const tower = towerById(id);
    if (!tower) return;
    card.show(tower, { lit: store.isDone(id), striking: strikingId === id });
  }

  function refreshCard() {
    if (card.stopId) setActive(card.stopId);
  }

  // Fly to a tower from the picker: a close swoop with a strong pitch so the
  // flight reads as 3D; the card opens once it lands. The offset parks the
  // tower in the top part of the screen so the card never covers it (the
  // phone app centres it; on a phone that hid the tower behind the card).
  function pickTower(tower) {
    picker.hide();
    chipChevron();
    setActive(null);
    stopFollowing();
    if (pickTimer) clearTimeout(pickTimer);
    map.flyTo({
      center: tower.geometry.coordinates,
      zoom: FLY_ZOOM,
      pitch: tilted ? FLY_PITCH : 0,
      offset: [0, -Math.round(map.getContainer().clientHeight * 0.2)],
      duration: FLY_MS,
    });
    pickTimer = setTimeout(() => { pickTimer = null; setActive(tower.properties.id); }, FLY_MS + 150);
  }

  // ------------------------------------------------------- pulse + strike
  function pulseIds() {
    const ids = new Set(nearbyIds);
    if (approachId) ids.add(approachId);
    if (strikingId) ids.delete(strikingId); // the strike outshines the pulse
    for (const id of ids) if (store.isDone(id)) ids.delete(id);
    return [...ids];
  }

  // The breathe: step through the frames while any tower is nearby.
  function redrawPulse() {
    const ids = pulseIds();
    setData('nearby-pulse', pointsFor(ids));
    if (ids.length && !pulseTimer) {
      pulseTimer = setInterval(() => {
        pulseStep = (pulseStep + 1) % NEARBY_PULSE_FRAMES.length;
        const f = NEARBY_PULSE_FRAMES[pulseStep];
        if (map.getLayer('nearby-pulse-glow')) {
          map.setPaintProperty('nearby-pulse-glow', 'circle-radius', f.radius);
          map.setPaintProperty('nearby-pulse-glow', 'circle-opacity', f.glow);
        }
      }, NEARBY_PULSE_STEP_MS);
    } else if (!ids.length && pulseTimer) {
      clearInterval(pulseTimer);
      pulseTimer = null;
    }
  }

  // One keyframe of the strike: the spark at the tower and the blooming pool.
  function renderStrikeFrame(tower, frame) {
    if (!map.getLayer('strike-core-dot')) return;
    setData('strike-core', pointsFor([tower.properties.id]));
    const radiusM = frame.radius * RING_RADII_M[0];
    setData('strike-bloom', radiusM > 1
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {},
          geometry: { type: 'Polygon', coordinates: [ringCoordinates(tower.geometry.coordinates, radiusM)] } }] }
      : EMPTY);
    map.setPaintProperty('strike-core-glow', 'circle-radius', 6 + 18 * frame.core);
    map.setPaintProperty('strike-core-glow', 'circle-opacity', 0.6 * frame.core);
    map.setPaintProperty('strike-core-dot', 'circle-radius', 3 + 3 * frame.core);
    map.setPaintProperty('strike-core-dot', 'circle-opacity', frame.core);
    map.setPaintProperty('strike-bloom-fill', 'fill-opacity', 0.16 * frame.bloom);
    map.setPaintProperty('strike-bloom-edge', 'line-opacity', 0.35 * frame.bloom);
  }

  function clearStrikeOverlay() {
    setData('strike-core', EMPTY);
    setData('strike-bloom', EMPTY);
  }

  // The strike-alight moment. Unlit -> the choreographed carbon-arc sequence
  // plays as a transient overlay -> lit, which flips `lit` in the towers
  // source so the style's permanent treatment takes over in place. One
  // strike at a time; taps during a strike are ignored.
  function lightTower(id) {
    if (strikingId || store.isDone(id)) return;
    const tower = towerById(id);
    if (!tower) return;
    strikingId = id;
    refreshCard();
    refreshStory();
    redrawPulse();
    cancelStrike = scheduleStrike({
      onFrame: (frame) => renderStrikeFrame(tower, frame),
      onHaptic: buzz,
      onComplete: () => {
        strikingId = null;
        cancelStrike = null;
        nearbyIds.delete(id);
        clearStrikeOverlay();
        store.markDone(id); // onChange redraws towers, chip, card, story
      },
    });
  }

  function abortStrike() {
    if (cancelStrike) cancelStrike();
    cancelStrike = null;
    strikingId = null;
    clearStrikeOverlay();
  }

  // ------------------------------------------------------------ arrive
  // The geofence fired: the tower's card opens and the visit is recorded.
  // Lighting it is a separate, deliberate tap on the card.
  function arrive(id) {
    nearbyIds.add(id);
    visits.markDone(id);
    setActive(id);
    redrawPulse();
  }

  // ---------------------------------------------------------------- GPS
  const watch = createWatch({
    onReading(reading) {
      lastReading = reading;
      setData('user', userDot());
      if (following) map.easeTo({ center: [reading.longitude, reading.latitude], duration: 500 });
      const isPending = (id) => store.isDone(id) || nearbyIds.has(id);
      const result = evaluatePosition(reading, towers, isPending, counters);
      counters = result.counters;
      if (result.fired[0]) arrive(result.fired[0]);
      const near = nearestPendingStop(reading, towers, store.isDone, APPROACH_RADIUS_M);
      const nearId = near ? near.properties.id : null;
      if (nearId !== approachId) { approachId = nearId; redrawPulse(); }
      if (tracking) {
        const before = distance.totalMeters;
        distance = advanceDistance(distance, reading);
        if (distance.totalMeters !== before) renderDistance();
      }
    },
    onError(err) {
      if (err && err.code === PERMISSION_DENIED) {
        setLocationEnabled(false);
        banner.show(COPY.locationDenied);
      } else {
        banner.show(COPY.noFix);
      }
    },
  });

  function setLocationEnabled(on) {
    locationEnabled = on;
    $('btn-locate').classList.toggle('active', on);
    if (on) {
      watch.start();
      wakeLock.acquire();
    } else {
      watch.stop();
      wakeLock.release();
      stopFollowing();
      counters = {};
      approachId = null;
      distance = clearLastReading(distance);
      lastReading = null;
      redrawOverlays();
    }
  }

  function stopFollowing() {
    following = false;
    if (followTimer) { clearTimeout(followTimer); followTimer = null; }
  }

  // Foreground only, like the app: the watch pauses while the tab is hidden
  // and resumes on return. Partial debounce counts and the distance anchor
  // drop on a pause so pause -> resume never counts as walking.
  document.addEventListener('visibilitychange', () => {
    if (!locationEnabled) return;
    if (document.hidden) {
      watch.stop();
      counters = {};
      approachId = null;
      distance = clearLastReading(distance);
      redrawPulse();
    } else {
      watch.start();
      wakeLock.acquire();
    }
  });

  async function locate() {
    if (locating) return;
    locating = true;
    $('btn-locate').classList.add('busy');
    picker.hide();
    chipChevron();
    if (pickTimer) { clearTimeout(pickTimer); pickTimer = null; }
    setActive(null);
    banner.hide();
    try {
      if (!geolocationAvailable()) throw new Error('no geolocation');
      const fix = await getFix(); // this is what shows the permission prompt
      setLocationEnabled(true);
      lastReading = fix;
      setData('user', userDot());
      map.flyTo({ center: [fix.longitude, fix.latitude], zoom: 14.5, pitch: 0, bearing: 0, duration: 1400 });
      // Follow the visitor once the flight lands; a drag lets go again.
      stopFollowing();
      followTimer = setTimeout(() => { followTimer = null; following = true; }, 1400 + 120);
    } catch (err) {
      banner.show(err && err.code === PERMISSION_DENIED ? COPY.locationDenied : COPY.noFix);
    } finally {
      locating = false;
      $('btn-locate').classList.remove('busy');
    }
  }

  // ---------------------------------------------------------- distance
  const pill = $('distance');
  function renderDistance() {
    const value = pill.querySelector('.pill-value');
    const hint = pill.querySelector('.pill-hint');
    pill.classList.toggle('active', tracking);
    if (tracking || distance.totalMeters > 0) {
      value.textContent = formatMiles(distance.totalMeters);
      value.hidden = false;
      hint.textContent = tracking ? COPY.distanceResetHint : '';
      hint.hidden = !tracking;
    } else {
      value.hidden = true;
      hint.textContent = COPY.distanceIdle;
      hint.hidden = false;
    }
    pill.setAttribute('aria-label', tracking
      ? 'Distance tracking on, ' + formatMiles(distance.totalMeters) + ' walked'
      : COPY.distanceStart);
  }
  tapOrHold(pill, {
    onTap() {
      tracking = !tracking;
      if (tracking && !locationEnabled) locate();
      renderDistance();
    },
    onHold() {
      if (window.confirm(COPY.resetTitle + '\n\n' + COPY.resetBody)) {
        distance = resetDistanceSession();
        renderDistance();
      }
    },
  });
  pill.title = COPY.distanceHint;
  renderDistance();

  // -------------------------------------------------- progress + picker
  const chip = $('chip');
  chip.title = COPY.progressHint;
  $('chip-hint').textContent = COPY.progressResetHint;
  function renderChip() {
    $('chip-count').textContent = String(store.doneIds.length);
    $('chip-total').textContent = String(towers.length);
    $('chip-label').textContent = COPY.progressLabel;
    chip.setAttribute('aria-label', store.doneIds.length + ' of ' + towers.length + ' ' + COPY.progressLabel);
  }
  function chipChevron() {
    $('chip-chevron').textContent = picker.open ? '▴' : '▾';
    chip.setAttribute('aria-expanded', String(picker.open));
  }
  // Rows grouped by leg: the ✦ marks a tower whose geofence really fired.
  function pickerRows() {
    return legGroups.map((g) => `
      <div class="picker-leg">${esc(g.leg)}</div>
      ${g.towers.map((t) => {
        const p = t.properties;
        const visited = visits.isDone(p.id);
        return `
          <button class="picker-row" type="button" data-id="${esc(p.id)}" aria-label="${esc(COPY.flyTo(p.corner, visited, store.isDone(p.id)))}">
            <span class="picker-glyph${visited ? ' visited' : ''}">${visited ? '✦' : '○'}</span>
            <span class="picker-text">
              <span class="picker-name">${esc(p.corner)}</span>
              <span class="picker-corner">${esc(p.tower_name)}</span>
            </span>
          </button>`;
      }).join('')}`).join('');
  }
  tapOrHold(chip, {
    onTap() {
      if (picker.open) picker.hide();
      else picker.show();
      chipChevron();
    },
    // Hold: confirm, then back to a fresh start. The strike is cancelled
    // FIRST so its completion cannot re-light a tower after the wipe.
    onHold() {
      if (!window.confirm(COPY.resetProgressTitle + '\n\n' + COPY.resetProgressBody)) return;
      abortStrike();
      counters = {};
      approachId = null;
      nearbyIds.clear();
      store.reset();
    },
  });
  renderChip();

  store.onChange(() => {
    redrawTowers();
    redrawPulse();
    renderChip();
    refreshCard();
    refreshStory();
    if (picker.open) picker.show();
  });
  visits.onChange(() => { if (picker.open) picker.show(); });

  // ------------------------------------------------------------ buttons
  $('btn-home').setAttribute('aria-label', COPY.home);
  $('btn-locate').setAttribute('aria-label', COPY.locate);
  $('btn-locate').addEventListener('click', locate);

  const modeBtn = $('btn-mode');
  modeBtn.hidden = !dayAvailable;
  function renderMode() {
    modeBtn.textContent = mapMode === 'night' ? '☀' : '☾';
    modeBtn.setAttribute('aria-label', mapMode === 'night' ? COPY.toDay : COPY.toNight);
  }
  modeBtn.addEventListener('click', () => {
    mapMode = mapMode === 'night' ? 'day' : 'night';
    renderMode();
    abortStrike();
    map.setStyle(cloneStyle(STYLE[mapMode])); // 'style.load' refills everything
  });
  renderMode();

  const travelBtn = $('btn-travel');
  function renderTravel() {
    travelBtn.textContent = travelMode === 'foot' ? '🚶' : '🚲';
    travelBtn.setAttribute('aria-label', travelMode === 'foot' ? COPY.toBike : COPY.toFoot);
  }
  travelBtn.addEventListener('click', () => {
    travelMode = travelMode === 'foot' ? 'bike' : 'foot';
    renderTravel();
    setData('routes', visibleRoutes());
  });
  renderTravel();

  const tiltBtn = $('btn-tilt');
  function renderTilt() {
    tiltBtn.textContent = tilted ? '2D' : '3D';
    tiltBtn.classList.toggle('active', tilted);
    tiltBtn.setAttribute('aria-label', tilted ? COPY.to2d : COPY.to3d);
  }
  tiltBtn.addEventListener('click', () => {
    tilted = !tilted;
    renderTilt();
    map.easeTo({ pitch: tilted ? FLY_PITCH : 0, duration: 600 });
  });
  renderTilt();

  // Every tower in frame, flat and north-up: the way back after wandering.
  $('btn-extents').setAttribute('aria-label', COPY.extents);
  $('btn-extents').addEventListener('click', () => {
    picker.hide();
    chipChevron();
    if (pickTimer) { clearTimeout(pickTimer); pickTimer = null; }
    stopFollowing();
    setActive(null);
    const cam = map.cameraForBounds(towerBounds, { padding: EXTENT_PADDING, bearing: 0 });
    if (cam) map.easeTo({ ...cam, pitch: 0, duration: 1600 });
  });

  $('btn-zoom-in').setAttribute('aria-label', COPY.zoomIn);
  $('btn-zoom-in').addEventListener('click', () => map.zoomTo(map.getZoom() + 1, { duration: 250 }));
  $('btn-zoom-out').setAttribute('aria-label', COPY.zoomOut);
  $('btn-zoom-out').addEventListener('click', () => map.zoomTo(map.getZoom() - 1, { duration: 250 }));

  $('btn-info').setAttribute('aria-label', COPY.aboutOpen);
  $('btn-info').addEventListener('click', drawer.open);
  $('drawer-title').textContent = COPY.aboutTitle;
  $('drawer-backdrop').setAttribute('aria-label', COPY.aboutClose);
  $('drawer').querySelector('.drawer-close').setAttribute('aria-label', COPY.close);
  $('banner').querySelector('.banner-close').setAttribute('aria-label', COPY.dismiss);

  // -------------------------------------------------------------- story
  // The story page is addressed by the URL hash (#tower-01-22nd-nueces), so
  // a tower's story can be linked to and the phone's back button closes it.
  // Opening from the map pushes ONE history entry.
  let pushedStory = false;

  function renderStory(id) {
    const tower = towerById(id);
    if (!tower) { story.show(null, {}); return; }
    story.show(tower, { lit: store.isDone(id), striking: strikingId === id });
  }

  function refreshStory() {
    if (story.open && story.stopId) renderStory(story.stopId);
  }

  function openStory(id) {
    const url = location.pathname + location.search + '#' + id;
    if (story.open) history.replaceState(null, '', url);
    else { history.pushState(null, '', url); pushedStory = true; }
    renderStory(id);
  }

  function closeStory() {
    if (pushedStory) {
      history.back(); // the hashchange handler below does the hiding
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      story.hide();
    }
  }

  function applyHash() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (id) renderStory(id);
    else { story.hide(); pushedStory = false; }
  }
  window.addEventListener('hashchange', applyHash);
  applyHash(); // a link straight to a story opens on it
}

// MapLibre keeps and may edit the style object it is given; hand it a fresh
// copy each time so the vendor original stays clean for the next toggle.
function cloneStyle(style) {
  return JSON.parse(JSON.stringify(style));
}
