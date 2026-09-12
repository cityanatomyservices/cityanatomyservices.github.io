// config.js — where the AISD school changes map's data lives and how it is drawn.
//
// Three GeoJSON files next to the page in ./data/, all exported from the GIS
// library (C:\GISData\austin\boundaries.gpkg, layers aisd_changes_campuses,
// aisd_changes_zones, aisd_changes_links; research snapshot 2026-09-12, source
// note in the private qgis-lab repo). Reference overlays are copies of the
// files the data centers page uses. Small enough for GitHub Pages; no tiles,
// no database.
window.AISD_CONFIG = {
  campuses: './data/campuses.geojson?v=20260912a',
  timeline: './data/timeline.json?v=20260912a',

  basemap: 'https://tiles.openfreemap.org/styles/positron',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',

  // the map opens fitted to the campuses and the extents button refits them;
  // the pan cage is that box grown by `cagePad` degrees on each side
  fitPadding: 40,
  cagePad: 0.35,
  minZoom: 9,

  // one colour per role, in legend order
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

  // the plan's own layers, drawn under the campus dots, on by default
  planLayers: {
    zones: { file: './data/zones.geojson?v=20260912a', on: true, fill: 0.18, label: 'campus_name' },
    links: { file: './data/links.geojson?v=20260912a', on: true, color: '#d62728' }
  },
  // reference overlays, off by default
  overlays: {
    city:    { file: './data/city_limits.geojson?v=20260912a',       color: '#1f6f8b', on: false, fill: 0.08 },
    council: { file: './data/council_districts.geojson?v=20260912a', color: '#d95f02', on: false, fill: 0.06, label: 'district_number' }
  }
};
