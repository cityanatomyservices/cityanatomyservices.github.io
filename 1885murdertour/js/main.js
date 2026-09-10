// Wiring only: the map, the tour engine, GPS, and the chrome around them.
// Each piece lives in its own file; this one connects them.
//
// The map style is the app's own midnight-1885 style, loaded verbatim. It
// ships its "stops" and "routes" sources EMPTY; this page fills them with
// the vendor data after every style load (the night/day toggle reloads the
// style). ALL map styling stays in the style file, never here. The one thing
// the page adds to the map is the visitor's own location dot.

import { COPY, CREDITS } from './copy.js';
import { stopDisplayName } from './names.js';
import { esc } from '../../webtour/text.js';
import { evaluatePosition, metersToStop } from '../../webtour/engine.js';
import { createStore } from '../../webtour/store.js';
import { createDistanceSession, advanceDistance, resetDistanceSession, clearLastReading, formatMiles } from '../../webtour/distance.js';
import { PERMISSION_DENIED, createWatch, createWakeLock, geolocationAvailable, getFix } from '../../webtour/geo.js';
import { createCard } from './card.js';
import { createStory } from './story.js';
import { createBanner, createDrawer, createPicker, tapOrHold } from '../../webtour/controls.js';

const $ = (id) => document.getElementById(id);

const stopsJson = window.MT1885_STOPS;
const routesJson = window.MT1885_ROUTES;
const storiesJson = window.MT1885_STORIES;
const STYLE = { night: window.MT1885_STYLE_NIGHT, day: window.MT1885_STYLE_DAY };

if (!stopsJson || !routesJson || !STYLE.night) {
  // Never fail silently to a black rectangle: say what is missing.
  const fallback = $('fallback');
  fallback.textContent = 'Map data did not load. Run: node tools/sync-webapps.js';
  fallback.hidden = false;
} else {
  boot();
}

function boot() {
  // ------------------------------------------------------------- data
  const stops = [...stopsJson.features].sort((a, b) => a.properties.order - b.properties.order);
  const stopById = (id) => stops.find((s) => s.properties.id === id);
  const stories = (storiesJson && storiesJson.stops) || {};
  // A "day" file that never synced is written as {} by the app; no version
  // means no day mode, and the ☀ button stays hidden.
  const dayAvailable = typeof (STYLE.day && STYLE.day.version) === 'number';

  // Bounds around every stop: [west, south, east, north].
  const lngs = stops.map((s) => s.geometry.coordinates[0]);
  const lats = stops.map((s) => s.geometry.coordinates[1]);
  const stopBounds = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
  const EXTENT_PADDING = { top: 90, right: 56, bottom: 120, left: 56 };
  const PICK_PITCH = 57; // tilt for picker flights; beyond this the horizon washes out

  // ------------------------------------------------------------ state
  // Progress key: this tour's own, so no other tour can share it.
  const store = createStore('cityanatomy:1885murdertour:tour-v1');
  let mapMode = 'night';
  let travelMode = 'foot';
  let tilted = true;
  let locationEnabled = false;
  let locating = false;
  let checkingIn = false;
  let tracking = false;
  let distance = createDistanceSession();
  let counters = {};      // geofence debounce, per stop id
  let lastReading = null; // the visitor's latest fix, for the dot
  let pickTimer = null;

  // ------------------------------------------------------------ chrome
  const banner = createBanner($('banner'));
  const drawer = createDrawer($('drawer'), $('drawer-backdrop'), CREDITS);
  const picker = createPicker($('picker'), stops, { rows: pickerRows, onPick: pickStop });
  const card = createCard($('card'), {
    onClose: () => setActive(null),
    onReadStory: (stop) => openStory(stop.properties.id),
    onImHere: imHere,
  });
  const story = createStory($('story'), {
    onBack: closeStory,
    onBackToMap: closeStory,
    onNext: (stop) => openStory(stop.properties.id),
    onImHere: (stop) => arrive(stop.properties.id, { openCard: false }),
  });
  const wakeLock = createWakeLock();

  // --------------------------------------------------------------- map
  const map = new maplibregl.Map({
    container: 'map',
    style: cloneStyle(STYLE.night),
    bounds: stopBounds,
    fitBoundsOptions: { padding: EXTENT_PADDING },
    attributionControl: false, // the ⓘ drawer carries the credits instead
  });

  // What the style's stop layers read: `lit` = visited (the series-wide word
  // for "done"), `corner` = the label text, drawn verbatim by the style.
  function stopsWithVisited() {
    return {
      type: 'FeatureCollection',
      features: stops.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          visited: store.isDone(f.properties.id),
          lit: store.isDone(f.properties.id),
          corner: stopDisplayName(f.properties),
        },
      })),
    };
  }

  // Only the chosen travel mode's paths: the style's route layers filter by
  // mode, so handing them everything would draw walking and biking at once.
  function visibleRoutes() {
    return {
      type: 'FeatureCollection',
      features: routesJson.features.filter((f) => f.properties && f.properties.mode === travelMode),
    };
  }

  function userDot() {
    return {
      type: 'FeatureCollection',
      features: lastReading && locationEnabled
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lastReading.longitude, lastReading.latitude] } }]
        : [],
    };
  }

  // Fill the style's empty sources. Runs after every style load, because a
  // style swap (night/day) throws the old sources away.
  function fillSources() {
    const s = map.getSource('stops');
    const r = map.getSource('routes');
    if (s) s.setData(stopsWithVisited());
    if (r) r.setData(visibleRoutes());
    if (!map.getSource('user')) {
      // The visitor's dot: amber, same two circles as the app.
      map.addSource('user', { type: 'geojson', data: userDot() });
      map.addLayer({
        id: 'user-location-glow', type: 'circle', source: 'user',
        paint: { 'circle-radius': 14, 'circle-blur': 1, 'circle-color': '#e8a13c', 'circle-opacity': 0.35, 'circle-pitch-alignment': 'map' },
      });
      map.addLayer({
        id: 'user-location-core', type: 'circle', source: 'user',
        paint: { 'circle-radius': 5.5, 'circle-color': '#e8a13c', 'circle-stroke-color': '#0b0f14', 'circle-stroke-width': 2, 'circle-pitch-alignment': 'map' },
      });
    } else {
      map.getSource('user').setData(userDot());
    }
  }

  function redrawStops() {
    const s = map.getSource('stops');
    if (s) s.setData(stopsWithVisited());
  }

  function redrawUser() {
    const u = map.getSource('user');
    if (u) u.setData(userDot());
  }

  map.on('style.load', fillSources);
  map.on('load', () => {
    document.body.classList.add('ready');
    map.getCanvas().style.cursor = 'default';
  });
  map.on('error', (e) => console.warn('map error', e && e.error));

  // Tap a stop: open its card. Tap empty map: close it.
  const STOP_LAYERS = ['stop-core', 'stop-halo'];
  map.on('click', (e) => {
    const hit = map.queryRenderedFeatures(e.point, { layers: STOP_LAYERS })[0];
    if (hit) setActive(hit.properties.id);
    else setActive(null);
  });
  for (const layer of STOP_LAYERS) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = 'default'; });
  }

  // ------------------------------------------------------------- card
  function setActive(id) {
    if (!id) { card.hide(); return; }
    const stop = stopById(id);
    if (!stop) return;
    card.show(stop, { visited: store.isDone(id), checkingIn });
  }

  function refreshCard() {
    if (card.stopId) setActive(card.stopId);
  }

  // Fly to a stop from the picker, then open its card once the flight
  // lands (a card riding along a flight reads badly). The offset parks the
  // stop in the top part of the screen so the card never covers it.
  function pickStop(stop) {
    picker.hide();
    chipChevron();
    setActive(null);
    if (pickTimer) clearTimeout(pickTimer);
    map.flyTo({
      center: stop.geometry.coordinates,
      zoom: 16.2,
      pitch: tilted ? PICK_PITCH : 0,
      offset: [0, -Math.round(map.getContainer().clientHeight * 0.275)],
      duration: 1600,
    });
    pickTimer = setTimeout(() => { pickTimer = null; setActive(stop.properties.id); }, 1750);
  }

  // ------------------------------------------------------------ arrive
  // The single arrival path: geofence fire, "I'm here" on the card, or
  // "I'm here" on the story page. Visited is terminal.
  function arrive(id, { openCard = true } = {}) {
    store.markDone(id);
    if (openCard) setActive(id);
  }

  // Verified check-in: "I'm here" counts only inside the geofence, because
  // the tour exists to get people OUT to the sites. GPS accuracy (capped at
  // 50 m) is added as grace so a good-faith check-in at the curb still lands.
  async function imHere(stop) {
    if (checkingIn) return;
    checkingIn = true;
    refreshCard();
    try {
      const fix = await getFix();
      const meters = metersToStop(fix, stop);
      const grace = Math.min(fix.accuracyM || 0, 50);
      if (meters <= stop.properties.geofence_radius_m + grace) arrive(stop.properties.id);
      else banner.show(COPY.tooFar(formatMiles(meters)));
    } catch {
      banner.show(COPY.noFixCheckIn);
    } finally {
      checkingIn = false;
      refreshCard();
    }
  }

  // ---------------------------------------------------------------- GPS
  const watch = createWatch({
    onReading(reading) {
      lastReading = reading;
      redrawUser();
      const result = evaluatePosition(reading, stops, store.isDone, counters);
      counters = result.counters;
      if (result.fired[0]) arrive(result.fired[0]);
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
      counters = {};
      distance = clearLastReading(distance);
      lastReading = null;
      redrawUser();
    }
  }

  // Foreground only, like the app: the watch pauses while the tab is hidden
  // and resumes on return. Partial debounce counts and the distance anchor
  // drop on a pause so pause -> resume never counts as walking.
  document.addEventListener('visibilitychange', () => {
    if (!locationEnabled) return;
    if (document.hidden) {
      watch.stop();
      counters = {};
      distance = clearLastReading(distance);
    } else {
      watch.start();
      wakeLock.acquire();
    }
  });

  async function locate() {
    if (locating) return;
    locating = true;
    $('btn-locate').classList.add('busy');
    banner.hide();
    try {
      if (!geolocationAvailable()) throw new Error('no geolocation');
      const fix = await getFix(); // this is what shows the permission prompt
      setLocationEnabled(true);
      lastReading = fix;
      redrawUser();
      map.flyTo({ center: [fix.longitude, fix.latitude], zoom: 15.5, duration: 1400 });
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
    // Tap: start / pause. Starting with location off runs the locate flow
    // first, since tracking needs the GPS watch to feed it.
    onTap() {
      tracking = !tracking;
      if (tracking && !locationEnabled) locate();
      renderDistance();
    },
    // Hold: confirm, then reset to zero.
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
  // Rows in tour order (= case order): a glyph, the name, the modern corner.
  function pickerRows() {
    return stops.map((stop) => {
      const p = stop.properties;
      const visited = store.isDone(p.id);
      const name = stopDisplayName(p, p.title);
      return `
        <button class="picker-row" type="button" data-id="${esc(p.id)}" aria-label="${esc(COPY.flyTo(name, visited))}">
          <span class="picker-glyph${visited ? ' visited' : ''}">${visited ? '✦' : '○'}</span>
          <span class="picker-text">
            <span class="picker-name">${esc(name)}</span>
            ${p.modern_corner ? `<span class="picker-corner">${esc(p.modern_corner)}</span>` : ''}
          </span>
        </button>`;
    }).join('');
  }
  const chip = $('chip');
  chip.title = COPY.progressHint;
  function renderChip() {
    $('chip-count').textContent = String(store.doneIds.length);
    $('chip-total').textContent = String(stops.length);
    $('chip-label').textContent = COPY.progressLabel;
    chip.setAttribute('aria-label', store.doneIds.length + ' of ' + stops.length + ' ' + COPY.progressLabel);
  }
  function chipChevron() {
    $('chip-chevron').textContent = picker.open ? '▴' : '▾';
    chip.setAttribute('aria-expanded', String(picker.open));
  }
  chip.addEventListener('click', () => {
    if (picker.open) picker.hide();
    else picker.show();
    chipChevron();
  });
  renderChip();

  store.onChange(() => {
    redrawStops();
    renderChip();
    refreshCard();
    if (picker.open) picker.show();
    if (story.open && story.stopId) renderStory(story.stopId);
  });

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
    // setStyle throws the sources away; 'style.load' refills them.
    map.setStyle(cloneStyle(STYLE[mapMode]));
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
    const r = map.getSource('routes');
    if (r) r.setData(visibleRoutes());
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
    map.easeTo({ pitch: tilted ? PICK_PITCH : 0, duration: 600 });
  });
  renderTilt();

  // Every stop in frame, flat and north-up: the way back after wandering.
  $('btn-extents').setAttribute('aria-label', COPY.extents);
  $('btn-extents').addEventListener('click', () => {
    setActive(null);
    const cam = map.cameraForBounds(stopBounds, { padding: EXTENT_PADDING, bearing: 0 });
    if (cam) map.easeTo({ ...cam, pitch: 0, duration: 700 });
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
  // The story page is addressed by the URL hash (#stop-03-mary-ramey), so a
  // stop's story can be linked to and the phone's back button closes it.
  // Opening from the map pushes ONE history entry; "Next stop" replaces it,
  // so a chain of stories collapses back to the map in one step.
  let pushedStory = false;

  function renderStory(id) {
    const stop = stopById(id);
    if (!stop) { story.show(null, {}); return; }
    const p = stop.properties;
    story.show(stop, {
      content: stories[id],
      nextStop: p.next_stop_id ? stopById(p.next_stop_id) : null,
      visited: store.isDone(id),
    });
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
