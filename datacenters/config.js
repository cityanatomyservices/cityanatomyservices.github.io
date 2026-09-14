// config.js — where the data centers map's data lives and how it is drawn.
//
// Small GeoJSON files sit next to the page in ./data/:
//   datacenters.geojson            47 sites, exported from the GIS library
//                                  (C:\GISData\austin\planning.gpkg, layer
//                                  data_centers; research snapshot 2026-09-12,
//                                  source note in the private qgis-lab repo)
//   austin_energy_service_area.geojson  Austin Energy's electric service
//                                  boundary (City of Austin open data w5fd-ctq4)
//   the electric and water context layers (added 2026-09-13) come from
//                                  C:\GISData\austin\energy.gpkg and water.gpkg,
//                                  filled by C:\GISData\scripts\fetch_energy_water.py
//                                  and exported by scripts/build-datacenters-layers.sh
// They are small enough to live on GitHub Pages; no tiles and no database.
window.MAP_CONFIG = {
  points: './data/datacenters.geojson?v=20260912a',
  // the property that gives each dot its colour and legend row
  categoryField: 'status',

  // The Layers box shows the overlays in these groups, in this order. The
  // group names come from copy.js (overlayGroup).
  groups: ['electric', 'water', 'boundaries'],

  // reference overlays. Each is a GeoJSON file next to the page. Fields:
  //   group   which heading it sits under in the Layers box
  //   kind    'polygon' (default), 'line' or 'point' — decides how it draws
  //   on      the starting state (owner 2026-09-14: Austin city limits on, the rest off)
  //   color   the one colour for the layer; `fill` is the polygon fill opacity
  //   label   for polygons: the field written in the middle of each shape
  //   width   for lines: [field, value, px, value, px...] steps, or a number
  //   radius  for points: a number, or [field, value, px, value, px...] steps
  //   popup   for lines and points: the fields shown when clicked (labels in copy.js `fields`)
  // Polygons draw under lines, lines under points, and everything under the sites.
  overlays: {
    // ── electric ──
    service:      { group: 'electric', file: './data/austin_energy_service_area.geojson?v=20260912a', color: '#7b3294', on: false, fill: 0.06 },
    transmission: { group: 'electric', kind: 'line', file: './data/transmission_lines.geojson?v=20260913a', color: '#b30000', on: false,
                    width: ['kv', 115, 1, 138, 1.4, 161, 1.8, 345, 3], popup: ['kv', 'owner', 'status'] },
    plants:       { group: 'electric', kind: 'point', file: './data/power_plants.geojson?v=20260913a', color: '#e6550d', on: false,
                    radius: ['mw', 0, 3, 100, 6, 500, 10, 1500, 15], hollow: ['phase', 'planned'], popup: ['name', 'entity', 'technology', 'mw', 'phase', 'year', 'county'] },
    substations:  { group: 'electric', kind: 'point', file: './data/substations.geojson?v=20260913a', color: '#54278f', on: false,
                    radius: ['kv', 69, 2.5, 138, 3.5, 345, 5.5], popup: ['name', 'operator', 'kv', 'kind'] },
    // ── water ──
    aquifers:     { group: 'water', file: './data/major_aquifers.geojson?v=20260913a', color: '#2b8cbe', on: false, fill: 0.14, label: 'name' },
    gcd:          { group: 'water', file: './data/groundwater_districts.geojson?v=20260913a', color: '#016c59', on: false, fill: 0.05, label: 'name' },
    rwpa:         { group: 'water', file: './data/water_planning_areas.geojson?v=20260913a', color: '#045a8d', on: false, fill: 0.03, label: 'name' },
    huc8:         { group: 'water', file: './data/watersheds_huc8.geojson?v=20260913a', color: '#3690c0', on: false, fill: 0.03, label: 'name' },
    intakes:      { group: 'water', kind: 'point', file: './data/surface_water_intakes.geojson?v=20260913a', color: '#0570b0', on: false,
                    radius: 4, popup: ['system', 'waterbody', 'intake'] },
    outfalls:     { group: 'water', kind: 'point', file: './data/wastewater_outfalls.geojson?v=20260913a', color: '#8c6d31', on: false,
                    radius: 2.5, popup: ['permittee', 'permit', 'outfall', 'county', 'segment', 'status', 'dtype'] },
    // ── boundaries ──
    city:         { group: 'boundaries', file: './data/city_limits.geojson?v=20260912b', color: '#1f6f8b', on: true,  fill: 0.10 },
    council:      { group: 'boundaries', file: './data/council_districts.geojson?v=20260912b', color: '#d95f02', on: false, fill: 0.08, label: 'district_number' }
  },

  basemap: 'https://tiles.openfreemap.org/styles/positron',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',

  // the map opens fitted to the mapped sites and the extents button refits
  // them (owner 2026-09-12); app.js works the box out from the data. The pan
  // cage adds separate horizontal and vertical margins for recording frames.
  fitPadding: 40,
  cagePad: 0.75,
  cagePadLng: 2,
  minZoom: 6.5,

  // one colour per status, in legend order (same palette as the QGIS project)
  categories: {
    operational:          '#1b7837',
    under_construction:   '#f28e2b',
    approved_planned:     '#edc948',
    announced_proposed:   '#4e79a7',
    rumored_unconfirmed:  '#bab0ac',
    cancelled_stalled:    '#d62728'
  },

  // dot radius in pixels by planned or built MW ([field, MW, px, MW, px...]);
  // sites with no MW on record get the smallest dot
  pointRadius: ['size_mw', 0, 5, 50, 8, 200, 11, 600, 15, 1500, 20],
  sizeLegendMw: [50, 500, 1500],          // the size key under the legend (map.js)
  // the number on each dot is the row id in the research note
  pointLabel: { field: 'id', size: 10, overlap: true }
};
