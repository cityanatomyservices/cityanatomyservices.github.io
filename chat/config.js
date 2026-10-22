// config.js — where the chat map's data lives and how it is drawn.
//
// geofences.geojson: one polygon per neighborhood, 65 of them, merged by
// name from the City of Austin Neighborhoods layer (chat/data/README.md says
// how; `bash tools/make-geofences.sh` rebuilds it). Each has `id` (URL-safe,
// the future chat room key) and `name`.
window.MAP_CONFIG = {
  geofences: './data/geofences.geojson?v=20261022k',
  nameField: 'name',

  basemap: 'https://tiles.openfreemap.org/styles/positron',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',

  // how the geofences draw: one colour, a light fill, a stronger fill under
  // the pointer, the name written in the middle of each polygon
  color: '#0067c5',
  fill: 0.08,
  fillHover: 0.28,
  labelSize: 11,

  // the map opens fitted to the geofences and the fit button refits them;
  // the pan cage keeps the visitor within a margin of that box (degrees)
  fitPadding: 24,
  cagePad: 0.5,
  minZoom: 9,

  // the chat's Supabase project (the paid one, the same as /budget/ and
  // /parcels/). The publishable key is public by design: it opens Realtime
  // channels, and row security guards every table.
  supabase: {
    url: 'https://aqbyxpiwugcvoephsvpm.supabase.co',
    anonKey: 'sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN'
  },
  // the room's polygon: a stronger fill while you are in it
  fillRoom: 0.22,

  // 3D: the tilt the 3D button eases to (the walking-tour apps use 57; past
  // that the horizon washes out) and the buildings, drawn as blocks from the
  // basemap's own building data (OpenMapTiles `render_height`) while tilted
  pitch: 57,
  buildingColor: '#d6d9dd'
};
