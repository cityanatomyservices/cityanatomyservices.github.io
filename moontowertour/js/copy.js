// Every word this page shows on its own, in one place.
//
// RULE: the owner writes all copy. Nothing here was invented for the web page:
// each string is lifted verbatim from the CityAnatomyAustin app (the
// moontowertour module, src/modules/moontowertour/*.tsx and src/ui/*.tsx),
// where the owner already approved it. The tower text itself (names,
// corners, stories) comes from vendor/ and never passes through this file.
// To change a label, edit it here.
export const COPY = {
  // Page title = the app's splash title (the owner's).
  title: 'Moontower',

  // Progress chip: "3 of 17 towers lit". Hold to reset.
  progressLabel: 'towers lit',
  progressHint: 'Opens the tower list. Long press to reset all tour progress.',
  progressResetHint: 'hold to reset',
  resetProgressTitle: 'Reset tour progress?',
  resetProgressBody: 'Every tower goes back to unlit and saved progress is erased. This cannot be undone.',

  // Walked-distance pill.
  distanceIdle: 'track distance',
  distanceResetHint: 'hold to reset',
  distanceStart: 'Start distance tracking',
  distanceHint: 'Tap to start or pause tracking. Long press to reset the walked distance.',
  resetTitle: 'Reset walked distance?',
  resetBody: 'The distance total goes back to zero. This cannot be undone.',

  // The tower card on the map.
  stopKicker: (order, leg) => 'Stop ' + order + ' · ' + leg + ' leg',
  erected: (erected, status) => 'Erected ' + erected + ' · ' + status,
  notStandingCard: 'No tower stands at this corner today — the story is told at the site.',
  closeCard: 'Close tower card',
  readStory: "This tower's story →",
  readStoryA11y: (corner) => 'Read the story of the ' + corner + ' tower',
  lit: '✦ Lit',
  striking: 'Striking the arc…',
  light: "I'm here — light this tower",

  // Messages in the banner.
  locationDenied:
    'Location access is needed to light towers as you reach them. You can enable it any time in your phone settings.',
  noFix: "Couldn't get a GPS fix. Step outside or into the open and try again.",
  dismiss: 'Dismiss message',

  // The tower's story page.
  erectedLine: (erected) => 'Erected ' + erected,
  notStandingStory:
    'No tower stands at this corner today. The story plays at the site and narrates the absence — lighting it on your map is a promise, not a restoration.',
  listen: "Listen (2–3 min) — this tower's narration is coming soon.",
  in1895: 'Under its light, 1895',
  today: 'In its light today',
  sourceLine: (p) =>
    p.portal_address + ' · landmark case ' + p.landmark_case + '\nconfidence: ' + p.confidence + ' · ' + p.source,
  backToMap: 'Back to map',
  notFound: 'This tower could not be found.',
  goBack: 'Go back',

  // Credits drawer.
  aboutTitle: 'About this map',
  aboutOpen: 'Map credits and data sources',
  aboutClose: 'Close the map credits panel',
  close: 'Close',

  // Screen-reader labels for the round buttons.
  home: 'Back to the CityAnatomy home screen',
  locate: 'Show my location on the map',
  toDay: 'Switch map to day mode',
  toNight: 'Switch map to night mode',
  toBike: 'Showing walking paths. Switch to biking paths',
  toFoot: 'Showing biking paths. Switch to walking paths',
  to2d: 'Map is tilted 3D. Switch to flat 2D view',
  to3d: 'Map is flat. Switch to tilted 3D view',
  extents: 'Zoom out to show all towers',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  flyTo: (corner, visited, lit) =>
    'Fly to ' + corner + ', ' + (visited ? 'visited in person' : 'not yet visited') + (lit ? ', lit' : ''),
};

// The credits rows, in display order: the app's MAP_CREDITS followed by the
// brand links (src/content/brand.ts). Labels are the owner's handles.
export const CREDITS = [
  { label: '© OpenStreetMap contributors', detail: 'map data', url: 'https://www.openstreetmap.org/copyright' },
  { label: 'OpenFreeMap', detail: 'map tiles', url: 'https://openfreemap.org' },
  { label: 'MapLibre', detail: 'map engine', url: 'https://maplibre.org' },
  { label: 'City of Austin Open Data Portal', detail: 'moonlight tower locations', url: 'https://data.austintexas.gov' },
  { label: 'City Anatomy', detail: 'anatomy.city', url: 'https://anatomy.city' },
  { label: 'TikTok', detail: '@anatomy.city', url: 'https://www.tiktok.com/@anatomy.city' },
  { label: 'X', detail: '@anatomycity', url: 'https://x.com/anatomycity' },
  { label: 'Substack', detail: '@cityanatomy', url: 'https://cityanatomy.substack.com' },
  { label: 'Patreon', detail: '/cityanatomy', url: 'https://www.patreon.com/cityanatomy' },
];
