/**
 * The map plumbing: turning the stop list into the three GeoJSON sources the
 * arclight-1895 style expects ("towers", "illumination", "routes").
 *
 * Lifted from map/preview.html so the page and the preview agree exactly.
 * The style ships those sources EMPTY on purpose; we fill them at runtime and
 * again after any style switch.
 */

// Geodesic circle as a polygon ring (spherical destination formula). A plain
// square-of-degrees circle would visibly squash at Austin's latitude.
const R = 6371008.8;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

export function circleRing([lon, lat], radiusM, steps = 64) {
  const d = radiusM / R;
  const la1 = toRad(lat);
  const lo1 = toRad(lon);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const brg = (2 * Math.PI * i) / steps;
    const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(brg));
    const lo2 =
      lo1 +
      Math.atan2(
        Math.sin(brg) * Math.sin(d) * Math.cos(la1),
        Math.cos(d) - Math.sin(la1) * Math.sin(la2)
      );
    pts.push([toDeg(lo2), toDeg(la2)]);
  }
  return pts;
}

// Illumination contract (see the style's metadata): rings 0|1|2 = 457.2 / 304.8 / 152.4 m.
// 457.2 m is 1,500 ft — each tower's historic arc-light radius.
export const RING_RADII = [457.2, 304.8, 152.4];

export function buildTowers(features, lit) {
  return {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: { ...f.properties, lit: lit.has(f.properties.id) },
    })),
  };
}

export function buildIllumination(features, lit) {
  return {
    type: 'FeatureCollection',
    features: features.flatMap((f) =>
      RING_RADII.map((r, ring) => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [circleRing(f.geometry.coordinates, r)] },
        properties: { tower_id: f.properties.id, lit: lit.has(f.properties.id), ring },
      }))
    ),
  };
}
