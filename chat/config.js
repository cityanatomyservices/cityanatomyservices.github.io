// config.js — where the chat map's data lives and how it is drawn.
//
// geofences.geojson: one polygon per neighborhood, 65 of them, merged by
// name from the City of Austin Neighborhoods layer (chat/data/README.md says
// how; `bash tools/make-geofences.sh` rebuilds it). Each has `id` (URL-safe,
// the future chat room key) and `name`.
window.MAP_CONFIG = {
  geofences: './data/geofences.geojson?v=20261022k',
  nameField: 'name',
  // the businesses in each neighborhood, one file per neighborhood id
  // (tools/fetch-places.py, from OpenStreetMap); absolute so the apps under
  // /apps/ could load them too
  places: '/chat/data/places/',

  basemap: 'https://tiles.openfreemap.org/styles/positron',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',

  // how the geofences draw (owner 2026-10-22: "attractive when someone
  // visits"): every neighborhood gets its own colour from this palette,
  // chosen so that no two touching neighborhoods share one (map.js); a
  // soft fill, stronger under the pointer and strongest for your own room;
  // thin pale borders, a dark border on the neighborhood you tapped, the
  // accent border on your room; the name written in the middle.
  palette: ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#86bcb6', '#d4a6c8', '#a0cbe8'],
  fill: 0.38,
  fillHover: 0.55,
  fillRoom: 0.7,
  lineColor: '#ffffff',
  selectedColor: '#1f2933',
  roomColor: '#0067c5',
  labelSize: 11,

  // the map opens fitted to the geofences and the City button refits them.
  // Nobody can zoom out past that view, and nobody can push the map off the
  // screen: this much of the screen (a tenth) must always still show it
  // (owner 2026-10-22; map.js keepInView)
  fitPadding: 24,
  keepOnScreen: 0.1,

  // the chat's Supabase project (the paid one, the same as /budget/ and
  // /parcels/). The publishable key is public by design: it opens Realtime
  // channels, and row security guards every table.
  supabase: {
    url: 'https://aqbyxpiwugcvoephsvpm.supabase.co',
    anonKey: 'sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN'
  },
  // the three links in a business's popup (owner 2026-10-22: plain web
  // addresses, no API keys). {lat} {lng} {name} are filled in by map.js.
  placeLinks: {
    google: 'https://www.google.com/maps/search/?api=1&query={lat},{lng}',
    apple:  'https://maps.apple.com/?ll={lat},{lng}&q={name}',
    yelp:   'https://www.yelp.com/search?find_desc={name}&find_loc=Austin,+TX'
  },

  // 3D: the map OPENS tilted (owner 2026-10-22), rising to this pitch over
  // the first moment (the walking-tour apps use 57; past that the horizon
  // washes out), with the buildings drawn as blocks from the basemap's own
  // building data (OpenMapTiles `render_height`) while tilted
  pitch: 57,
  // where the map opens (owner's reference picture 2026-10-22): over this
  // neighborhood at this zoom, close enough for the buildings to show, then
  // it flies to your own neighborhood once the phone finds it
  openView: { room: 'downtown' },
  // the three view buttons (owner 2026-10-22), bottom right above the info
  // button: Street = flat, block level; Neighborhood = the opening view,
  // tilted; City = all of Austin, flat (same as the extents button). The
  // page opens on the Neighborhood view over `openView.room`.
  views: {
    street:       { zoom: 17,   pitch: 0 },
    neighborhood: { zoom: 16.4, pitch: 57 }
  },
  openTiltMs: 1800,
  buildingColor: '#d6d9dd'
};
