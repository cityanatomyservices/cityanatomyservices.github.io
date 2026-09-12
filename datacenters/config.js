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
  serviceArea: { file: './data/austin_energy_service_area.geojson?v=20260912a', color: '#7b3294' },

  basemap: 'https://tiles.openfreemap.org/styles/positron',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',

  // opens on the five-county ring; the box is both the pan limit and what the
  // extents button fits. Wide enough to keep Temple and Rockdale in view.
  center: [-97.62, 30.28],
  zoom: 8.6,
  region: [[-98.35, 29.55], [-96.85, 31.35]],
  minZoom: 7.5,

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
