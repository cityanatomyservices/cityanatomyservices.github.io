// config.js — where the AISD school changes map's data lives and how it is drawn.
//
// Four files next to the page in ./data/, exported from the GIS library
// (C:\GISData\austin\boundaries.gpkg, layers aisd_changes_campuses,
// aisd_changes_zones, aisd_changes_links; research snapshot 2026-09-12, source
// note in the private qgis-lab repo) plus timeline.json for the About panel.
// City limits and council districts are copies of the data centers page's
// files. Small enough for GitHub Pages; no tiles, no database.
window.AISD_CONFIG = {
  campuses: './data/campuses.geojson?v=20260912a',
  timeline: './data/timeline.json?v=20260912a',

  // The Layers box shows the overlays in these groups, in this order. The
  // group names come from copy.js (overlayGroup).
  groups: ['plan', 'boundaries'],

  // overlays, same shape as the data centers page (kind polygon / line /
  // point, on, color, fill, label, width, popup). Two extras used here:
  //   colorBy  'role' tints a polygon overlay by the campus role instead of
  //            one colour, and lets the legend checkboxes hide its shapes too
  //   dash     dash pattern for a line overlay
  // Polygons draw under lines, lines under points, and everything under the campuses.
  overlays: {
    // ── the plan's own layers ──
    zones: { group: 'plan', file: './data/zones.geojson?v=20260912a', colorBy: 'role', color: '#555555', on: true, fill: 0.18 },   // no zone labels: the campus dots carry the names
    links: { group: 'plan', kind: 'line', file: './data/links.geojson?v=20260912a', color: '#d62728', on: true, width: 2.5, dash: [1, 1.5],
             popup: ['from', 'to', 'share_pct', 'detail'] },
    // ── boundaries ──
    city:    { group: 'boundaries', file: './data/city_limits.geojson?v=20260912a',       color: '#1f6f8b', on: false, fill: 0.08 },
    council: { group: 'boundaries', file: './data/council_districts.geojson?v=20260912a', color: '#d95f02', on: false, fill: 0.06, label: 'district_number' }
  },

  basemap: 'https://tiles.openfreemap.org/styles/positron',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',

  // the map opens fitted to the campuses and the extents button refits them;
  // the pan cage is that box grown by `cagePad` degrees on each side
  fitPadding: 40,
  cagePad: 0.35,
  cagePadLng: 0.35,
  minZoom: 9,

  // one colour per role, in legend and reveal order (same palette as the QGIS project)
  role: {
    closing:               '#d62728',
    closing_and_receiving: '#ff7f0e',
    receiving:             '#1b7837',
    repurposed:            '#9467bd',
    boundary_change:       '#17becf',
    program_move:          '#8c564b',
    removed_from_plan:     '#bab0ac',
    other:                 '#7f7f7f'
  },
  pointRadius: 7,

  // the timeline's zoom step: the campuses (name_short) it fits the map to
  focus: {
    south: ['Becker', 'Dawson', 'Galindo', 'Zilker', 'Sunset Valley', 'Boone', 'Cunningham', 'Odom', 'Pleasant Hill']
  }
};
