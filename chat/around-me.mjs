/* Search the published neighborhood directories without joining a business chat. */
import {circle, distance} from '/geofences/model.mjs?v=20261114b';

const dialog = document.getElementById('around-dialog');
const trigger = document.getElementById('ctrlAroundMe');
const status = document.getElementById('around-status');
const results = document.getElementById('around-results');
const clear = document.getElementById('around-clear');
const radii = [...dialog.querySelectorAll('[data-miles]')];
const metresPerMile = 1609.344;
const directoryCache = new Map();
let neighborhoods, map, area, originPoint, bounds, points = [], generation = 0, pending = false;

async function nearbyDirectories() {
  if (!neighborhoods) {
    const data = await window.ChatRoom.load();
    neighborhoods = data.features.map(feature => ({
      id: feature.properties.id, bounds: window.AustinMapGeometry.boundsOf([feature])
    }));
  }
  return neighborhoods;
}

async function directory(id) {
  if (!directoryCache.has(id)) {
    const request = window.ChatRoom.directory(id);
    directoryCache.set(id, request);
    // A failed read can be retried by choosing the same radius again.
    request.then(data => { if (!data) directoryCache.delete(id); }, () => directoryCache.delete(id));
  }
  return directoryCache.get(id);
}

function businesses(directories, center, radius) {
  const matches = new Map();
  for (const data of directories) {
    for (const group of data.groups) {
      for (const category of group.categories) {
        for (const place of category.places) {
          const osm = place.sources?.osm?.find(id => /^(node|way|relation)\/\d+$/.test(id));
          if (!osm || matches.has(place.id)) continue;
          const coordinates = [place.lng, place.lat];
          const metres = distance(center, coordinates);
          if (metres <= radius) matches.set(place.id, {place, category: category.name, coordinates, metres, osm});
        }
      }
    }
  }
  return [...matches.values()].sort((a, b) => a.metres - b.metres || a.place.name.localeCompare(b.place.name));
}

function renderList(matches) {
  const categories = new Map();
  for (const match of matches) {
    if (!categories.has(match.category)) categories.set(match.category, []);
    categories.get(match.category).push(match);
  }
  const fragment = document.createDocumentFragment();
  for (const [category, entries] of categories) {
    const fold = document.createElement('details');
    fold.open = fragment.childElementCount === 0;
    const heading = document.createElement('summary');
    heading.textContent = `${category} (${entries.length})`;
    const list = document.createElement('ul');
    for (const {place, osm, metres} of entries) {
      const row = document.createElement('li');
      const link = document.createElement('a');
      link.textContent = place.name;
      link.href = 'https://www.openstreetmap.org/' + osm;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const info = document.createElement('small');
      info.textContent = [(metres / metresPerMile).toFixed(2) + ' mi', place.address].filter(Boolean).join(' · ');
      row.append(link, info);
      list.append(row);
    }
    fold.append(heading, list);
    fragment.append(fold);
  }
  results.replaceChildren(fragment);
  results.scrollTop = 0;
}

function draw() {
  if (!map) return;
  const features = area ? [area, ...points, originPoint] : [];
  const data = {type: 'FeatureCollection', features};
  const source = map.getSource('around-me');
  if (source) { source.setData(data); return; }
  if (!area) return;
  map.addSource('around-me', {type: 'geojson', data});
  const polygon = ['==', ['geometry-type'], 'Polygon'];
  map.addLayer({id: 'around-area', type: 'fill', source: 'around-me', filter: polygon,
    paint: {'fill-color': '#007c75', 'fill-opacity': 0.16}});
  map.addLayer({id: 'around-edge', type: 'line', source: 'around-me', filter: polygon,
    paint: {'line-color': '#00675f', 'line-width': 3}});
  map.addLayer({id: 'around-businesses', type: 'circle', source: 'around-me',
    filter: ['==', ['get', 'kind'], 'business'],
    paint: {'circle-color': '#00675f', 'circle-radius': 4, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1}});
  map.addLayer({id: 'around-origin', type: 'circle', source: 'around-me', filter: ['==', ['get', 'kind'], 'location'],
    paint: {'circle-color': '#196bce', 'circle-radius': 7, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3}});
}

function fit() {
  if (!map || !bounds) return;
  const {clientWidth: w, clientHeight: h} = map.getContainer();
  if (!w || !h) return;
  const pad = Math.min(24, w / 10, h / 10);
  const padding = {top: pad, bottom: pad, left: pad, right: pad};
  if (dialog.open) {
    if (w <= 640) padding.bottom += Math.min(Math.max(0, h - 2 * pad - 80), dialog.offsetHeight + 8);
    else padding.left += Math.min(w / 2, dialog.offsetWidth);
  }
  map.fitBounds(bounds, {padding, retainPadding: false, pitch: 0, bearing: 0, duration: 0, maxZoom: 17});
}

function clearSearch() {
  generation++;
  pending = false;
  if (area) {
    area = originPoint = bounds = null;
    points = [];
    draw();
    map?.fire('aroundbounds', {bounds: null});
  }
  trigger.classList.remove('is-on');
  radii.forEach(button => button.setAttribute('aria-pressed', 'false'));
  results.replaceChildren();
  clear.hidden = true;
  status.textContent = 'Choose a distance to find nearby businesses.';
}

function failedLocation(error) {
  if (error.code === 1) return 'Allow location access in your browser, then choose a distance again.';
  if (error.code === 3) return 'Finding your location timed out. Choose a distance to try again.';
  return 'Your location is unavailable. Choose a distance to try again.';
}

async function search(button) {
  clearSearch();
  const run = generation;
  const miles = Number(button.dataset.miles), radius = miles * metresPerMile;
  button.setAttribute('aria-pressed', 'true');
  if (!navigator.geolocation) { status.textContent = 'Location is unavailable in this browser.'; return; }
  pending = true;
  status.textContent = 'Finding your location…';
  let fix;
  try {
    fix = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject,
      {enableHighAccuracy: true, maximumAge: 15000, timeout: 12000}));
  } catch (error) {
    if (run === generation) { pending = false; status.textContent = failedLocation(error); }
    return;
  }
  if (run !== generation) return;
  const {latitude, longitude, accuracy} = fix.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
      !Number.isFinite(fix.timestamp) || Math.abs(Date.now() - fix.timestamp) > 45000) {
    pending = false;
    status.textContent = 'A fresh location is unavailable. Choose a distance to try again.';
    return;
  }
  area = circle({latitude, longitude, diameter: radius * 2});
  originPoint = {type: 'Feature', properties: {kind: 'location'}, geometry: {type: 'Point', coordinates: [longitude, latitude]}};
  bounds = window.AustinMapGeometry.boundsOf([area]);
  const searchBounds = bounds;
  map?.fire('aroundbounds', {bounds});
  draw();
  fit();
  trigger.classList.add('is-on');
  clear.hidden = false;
  status.textContent = 'Finding nearby businesses…';
  try {
    const index = await nearbyDirectories();
    if (run !== generation) return;
    // Pad the polygon envelope slightly; the final inclusion test uses the exact circle distance.
    const [[west, south], [east, north]] = searchBounds;
    const envelope = [[west - 0.00001, south - 0.00001], [east + 0.00001, north + 0.00001]];
    const candidates = index.filter(item => window.AustinMapGeometry.overlaps(item.bounds, envelope));
    const files = await Promise.all(candidates.map(item => directory(item.id)));
    if (run !== generation) return;
    const loaded = files.filter(Boolean);
    if (files.length && !loaded.length) throw Error('Directory unavailable');
    const matches = businesses(loaded, [longitude, latitude], radius);
    points = matches.map(({coordinates}) => ({type: 'Feature', properties: {kind: 'business'}, geometry: {type: 'Point', coordinates}}));
    renderList(matches);
    const unit = miles === 1 ? 'mile' : 'miles';
    const count = matches.length === 1 ? '1 mapped business' : matches.length + ' mapped businesses';
    let message = files.length ? `${count} within ${miles} ${unit}.` : 'This area is outside the Austin business directory’s coverage.';
    if (loaded.length < files.length) message += ' Some neighborhoods could not load. Choose the radius again to retry.';
    if (accuracy > radius) message += ' Your reported location is less precise than this radius.';
    status.textContent = message;
    draw();
    fit();
  } catch {
    if (run === generation) status.textContent = 'The business directory could not load. Choose a distance to try again.';
  } finally {
    if (run === generation) pending = false;
  }
}

function attach(value) {
  if (!value || map === value) return;
  map = value;
  map.on('style.load', draw);
  if (area) { map.fire('aroundbounds', {bounds}); draw(); fit(); }
}

trigger.addEventListener('click', () => {
  window.AustinChatCard?.close();
  window.AustinChatMap?.leave();
  if (!document.getElementById('plan-panel').hidden || !document.getElementById('planner-map-toolbar').hidden) window.AustinDayPlan?.close();
  dialog.showModal();
});
for (const button of radii) button.addEventListener('click', () => search(button));
clear.addEventListener('click', () => { clearSearch(); radii[0].focus(); });
document.getElementById('around-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { if (pending && !dialog.open) clearSearch(); });
function leave() {
  if (dialog.open) dialog.close();
  clearSearch();
}
window.addEventListener('austin:chat-view', event => { if (event.detail.active) leave(); });
window.addEventListener('pagehide', leave);
window.AustinAroundMe = {attach, close: leave, get active() { return !!area || pending; }};
trigger.disabled = false;
attach(window.chatMap);
