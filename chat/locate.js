// locate.js — which neighborhood geofence the visitor is standing in.
//
// Watches the phone's GPS and tests the point against the 65 polygons in
// the browser (ray casting on the outer ring; no server sees the position).
// Reports a room when the point enters a polygon, `null` when it is outside
// them all, and a status word the card can show. The coordinates never
// leave the device: the chat only ever learns the geofence id.
(function () {
  let watchId = null;

  // true when [lng, lat] is inside the ring (an array of [lng, lat] points)
  function inRing(pt, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // the first geofence whose outer ring holds the point (they do not overlap)
  function find(geofences, pt) {
    return geofences.features.find((f) => {
      const g = f.geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;   // MultiPolygon, just in case
      return polys.some((rings) => inRing(pt, rings[0]));
    }) || null;
  }

  window.ChatLocate = {
    find,
    // onRoom(feature or null) each time the answer changes; onStatus('off' |
    // 'asking' | 'denied' | 'outside' | 'inside')
    start(geofences, onRoom, onStatus) {
      if (!navigator.geolocation) { onStatus('off'); return; }
      onStatus('asking');
      let lastId;
      watchId = navigator.geolocation.watchPosition((pos) => {
        const f = find(geofences, [pos.coords.longitude, pos.coords.latitude]);
        const id = f ? f.properties.id : null;
        onStatus(f ? 'inside' : 'outside');
        if (id !== lastId) { lastId = id; onRoom(f); }
      }, () => onStatus('denied'), { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 });
    },
    stop() { if (watchId !== null) navigator.geolocation.clearWatch(watchId); watchId = null; }
  };
})();
