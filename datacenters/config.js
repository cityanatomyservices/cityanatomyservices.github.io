// config.js — where the data centers map's data lives and how it is drawn.
//
// Two small GeoJSON files sit next to the page in ./data/:
//   datacenters.geojson            47 sites, exported from the GIS library
//                                  (C:\GISData\austin\planning.gpkg, layer
//                                  data_centers; research snapshot 2026-09-12,
//                                  source note in the private qgis-lab repo)
//   austin_energy_service_area.geojson  Austin Energy's electric service
//                                  boundary (City of Austin open data w5fd-ctq4)
// They are small enough (about 80 KB together) to live on GitHub Pages; no
// tiles and no database are involved.
window.DC_CONFIG = {
  sites: './data/datacenters.geojson?v=20260912a',

  // reference overlays in the Layers box, in this order. Each is a GeoJSON
  // file next to the page, exported from C:\GISData\austin\boundaries.gpkg
  // with ogr2ogr (see docs/STATUS.md). `on` is the starting state (owner
  // 2026-09-12: Austin Energy on, the rest off). `label` names the field
  // written in the middle of each polygon; leave it out for no labels.
  overlays: {
    service: { file: './data/austin_energy_service_area.geojson?v=20260912a', color: '#7b3294', on: true,  fill: 0.06 },
    city:    { file: './data/city_limits.geojson?v=20260912b',                color: '#1f6f8b', on: false, fill: 0.10 },
    council: { file: './data/council_districts.geojson?v=20260912b',          color: '#d95f02', on: false, fill: 0.08, label: 'district_number' }
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
  status: {
    operational:          '#1b7837',
    under_construction:   '#f28e2b',
    approved_planned:     '#edc948',
    announced_proposed:   '#4e79a7',
    rumored_unconfirmed:  '#bab0ac',
    cancelled_stalled:    '#d62728'
  },

  // dot radius in pixels by planned or built MW; sites with no MW on record
  // get the smallest dot
  radiusByMw: [0, 5, 50, 8, 200, 11, 600, 15, 1500, 20],
  sizeLegendMw: [50, 500, 1500]
};
