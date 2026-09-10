// Every word this page shows on its own, in one place.
//
// RULE: the owner writes all copy. Nothing here was invented for the web page:
// each string is lifted verbatim from the CityAnatomyAustin app (the
// servantgirlmurdertour module, src/modules/servantgirlmurdertour/*.tsx and
// src/ui/*.tsx), where the owner already approved it. The stop text itself
// (names, addresses, stories) comes from vendor/ and never passes through
// this file. To change a label, edit it here.
export const COPY = {
  // Page title = the owner's product name (home.json).
  title: 'The 1885 Murder Tour',

  // Progress chip: "3 of 8 sites visited".
  progressLabel: 'sites visited',
  progressHint: 'Opens the stop list.',

  // Walked-distance pill.
  distanceIdle: 'track distance',
  distanceResetHint: 'hold to reset',
  distanceStart: 'Start distance tracking',
  distanceHint: 'Tap to start or pause tracking. Long press to reset the walked distance.',
  resetTitle: 'Reset walked distance?',
  resetBody: 'The distance total goes back to zero. This cannot be undone.',

  // The stop card on the map.
  stopKicker: (order, title) => 'Stop ' + order + ' · ' + title,
  memorialName: 'Memorial',
  closeCard: 'Close stop card',
  readStory: 'Read the full story →',
  visited: '✓ Visited',
  imHere: "I'm here — start this stop",
  imHereHint: 'Checks your GPS location; the visit records only at the site',
  checkingIn: 'Checking your location…',

  // Messages in the banner.
  locationDenied:
    'Location access is needed to guide you along the tour. You can enable it any time in your phone settings.',
  noFix: "Couldn't get a GPS fix. Step outside or into the open and try again.",
  noFixCheckIn:
    "Couldn't get a GPS fix to record your visit. Step into the open and try again.",
  tooFar: (miles) =>
    "You're " + miles + ' from this site — visits are recorded at the location itself. Worth the walk.',
  dismiss: 'Dismiss message',

  // The full-story page.
  comingSoon: 'Full story coming soon.',
  lore: 'Lore',
  siteToday: 'The site today',
  survived: 'Survived that night: ',
  nextStop: (name) => 'Next stop: ' + name + ' →',
  backToMap: 'Back to map',
  notFound: 'This stop could not be found.',
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
  extents: 'Zoom out to show all stops',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  flyTo: (name, visited) => 'Fly to ' + name + ', ' + (visited ? 'visited' : 'not yet visited'),
};

// The credits rows, in display order: the app's MAP_CREDITS followed by the
// brand links (src/content/brand.ts). Labels are the owner's handles.
export const CREDITS = [
  { label: '© OpenStreetMap contributors', detail: 'map data', url: 'https://www.openstreetmap.org/copyright' },
  { label: 'OpenFreeMap', detail: 'map tiles', url: 'https://openfreemap.org' },
  { label: 'MapLibre', detail: 'map engine', url: 'https://maplibre.org' },
  { label: 'Original historical research', detail: 'stop locations & narratives', url: 'https://atxmapdata.github.io' },
  { label: 'City Anatomy', detail: 'anatomy.city', url: 'https://anatomy.city' },
  { label: 'TikTok', detail: '@anatomy.city', url: 'https://www.tiktok.com/@anatomy.city' },
  { label: 'X', detail: '@anatomycity', url: 'https://x.com/anatomycity' },
  { label: 'Substack', detail: '@cityanatomy', url: 'https://cityanatomy.substack.com' },
  { label: 'Patreon', detail: '/cityanatomy', url: 'https://www.patreon.com/cityanatomy' },
];
