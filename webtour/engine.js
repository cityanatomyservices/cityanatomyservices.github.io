// The geofence engine: pure maths, no DOM, no map. Shared by every tour
// web app on the site (see webtour/README.md).
//
// A plain-JS copy of the app's src/engine/tour-engine.ts, trimmed to what a
// web page needs. A stop "fires" when the visitor has been inside its radius
// for READINGS_TO_TRIGGER consecutive GPS readings (that debounces GPS jitter).
// Done stops never fire again. Any pending stop may fire in any order: the
// tour suggests an order, it does not enforce one.

// Consecutive in-radius readings required before a stop fires (about 5 s).
export const READINGS_TO_TRIGGER = 3;

const EARTH_RADIUS_M = 6371008.8; // mean Earth radius (IUGG)
const DEG_TO_RAD = Math.PI / 180;

// Great-circle distance between two {latitude, longitude} points, in metres.
export function haversineMeters(a, b) {
  const lat1 = a.latitude * DEG_TO_RAD;
  const lat2 = b.latitude * DEG_TO_RAD;
  const dLat = lat2 - lat1;
  const dLon = (b.longitude - a.longitude) * DEG_TO_RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Distance from a reading to a stop feature, in metres.
export function metersToStop(coords, stop) {
  const [lon, lat] = stop.geometry.coordinates;
  return haversineMeters(coords, { latitude: lat, longitude: lon });
}

// One GPS reading in, the updated counters and any fired stop ids out.
//
//   coords   {latitude, longitude}
//   stops    the stop features
//   isDone   (id) => true when the stop is already done
//   counters {stopId: consecutive in-radius readings so far}; keep the
//            returned object and pass it back in with the next reading.
//            Reset it to {} whenever the GPS watch pauses.
//
// Leaving the radius resets a stop's count to zero simply by not carrying it
// over. Radii do not overlap in these tours, so more than one id firing at
// once is a degenerate case; the caller may act on just the first.
export function evaluatePosition(coords, stops, isDone, counters, readingsToTrigger = READINGS_TO_TRIGGER) {
  const next = {};
  const fired = [];
  for (const stop of stops) {
    const id = stop.properties.id;
    if (isDone(id)) continue;
    if (metersToStop(coords, stop) > stop.properties.geofence_radius_m) continue;
    const count = (counters[id] || 0) + 1;
    if (count >= readingsToTrigger) fired.push(id);
    else next[id] = count;
  }
  return { counters: next, fired };
}

// The nearest not-done stop within maxDistanceM of the reading, or null.
// Drives an approach hint (a pulse as you near a stop) well outside the
// geofence, so the pulse begins before the trigger.
export function nearestPendingStop(coords, stops, isDone, maxDistanceM) {
  let best = null;
  let bestDistance = Infinity;
  for (const stop of stops) {
    if (isDone(stop.properties.id)) continue;
    const d = metersToStop(coords, stop);
    if (d <= maxDistanceM && d < bestDistance) {
      best = stop;
      bestDistance = d;
    }
  }
  return best;
}

// A metre-accurate circle around [lon, lat] as a closed GeoJSON polygon
// ring, using the geodesic destination formula. A plain circle in degrees
// would visibly squash at Austin's latitude.
export function ringCoordinates([lon, lat], radiusM, segments = 64) {
  const lat1 = lat * DEG_TO_RAD;
  const lon1 = lon * DEG_TO_RAD;
  const angular = radiusM / EARTH_RADIUS_M;
  const ring = [];
  for (let i = 0; i < segments; i++) {
    const bearing = (i / segments) * 2 * Math.PI;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
    const lon2 = lon1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );
    ring.push([lon2 / DEG_TO_RAD, lat2 / DEG_TO_RAD]);
  }
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}
