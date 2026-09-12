// config.js — where the budget map's data lives and how each map is drawn.
//
// Tiles: three PMTiles files (the project's storage limit is 50 MB per file,
// so the two parcel layers travel separately) in the cityanatomyservices
// Supabase project's public "tiles" Storage bucket (the same bucket the parcels app uses; it supports the
// HTTP range requests PMTiles needs). Built by
// projects/atxmapdata/Austin2026Budget/scripts/92_export_pmtiles.py.
// Parcel history on click comes from the parcel database that is already there
// (parcel_appraisal_history, read with the public anon key; nothing was added).
window.BUDGET_CONFIG = {
  tiles: {
    budget:   'pmtiles://https://aqbyxpiwugcvoephsvpm.supabase.co/storage/v1/object/public/tiles/budget_fy27.pmtiles?v=20260912a',
    tax_bill: 'pmtiles://https://aqbyxpiwugcvoephsvpm.supabase.co/storage/v1/object/public/tiles/budget_fy27_tax_bill.pmtiles?v=20260912a',
    drainage: 'pmtiles://https://aqbyxpiwugcvoephsvpm.supabase.co/storage/v1/object/public/tiles/budget_fy27_drainage.pmtiles?v=20260912a'
  },
  supabase: {
    url: 'https://aqbyxpiwugcvoephsvpm.supabase.co',
    anonKey: 'sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN'
  },
  basemap: 'https://tiles.openfreemap.org/styles/positron',
  // the same satellite imagery the report maps use
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  center: [-97.7431, 30.2672],   // downtown
  zoom: 13,                       // close in on downtown so the parcels draw at once (owner 2026-09-12)
  // the map cannot leave the Austin area: this box, a little wider than the
  // full-purpose city, is both the pan limit and what the extents button fits
  austin: [[-98.05, 30.02], [-97.45, 30.56]],
  minZoom: 9.5,
  parcelMinZoom: 11,          // the two parcel layers are only in the tiles from here

  // colour ramps; blue = down, red = up
  diverging: ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'],
  pctBreaks: [-15, -5, -1, 1, 5, 15],
  drainageColors: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
  drainageBreaks: [10, 20, 40, 100],
  permitColors: ['#fff5eb', '#fdd0a2', '#fd8d3c', '#d94801', '#7f2704'],
  permitBreaks: [2, 5, 10, 20],
  cipColors: { bond: '#b2182b', current: '#2166ac', grant: '#1b7837', othergo: '#762a83', debt: '#e08214', other: '#555555' },

  permitMonths: { first: '2021-01', last: '2026-07' },

  // reference overlays: GeoJSON files next to the page (budget repo script 96).
  // Each polygon gets a see-through tint from the palette below, picked by its
  // number modulo 10 so neighbours differ; outline and bold haloed label use
  // the layer's own colour. Both off until the viewer ticks them. The same
  // palette is in the budget repo's script 90 for the QGIS project.
  overlays: {
    zip:     { file: './data/zipcodes.geojson?v=20260912h',          label: 'zipcode',         color: '#6b4c9a' },
    council: { file: './data/council_districts.geojson?v=20260912h', label: 'district_number', color: '#1f6f8b' }
  },
  overlayPalette: ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'],
  overlayFillOpacity: 0.25
};
