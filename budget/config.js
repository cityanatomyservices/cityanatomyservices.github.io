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
  center: [-97.7431, 30.2872],
  zoom: 11,
  minZoom: 9,
  maxBounds: [[-98.25, 29.95], [-97.30, 30.70]],
  parcelMinZoom: 11,          // the two parcel layers are only in the tiles from here

  // colour ramps; blue = down, red = up
  diverging: ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'],
  pctBreaks: [-15, -5, -1, 1, 5, 15],
  drainageColors: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
  drainageBreaks: [10, 20, 40, 100],
  permitColors: ['#fff5eb', '#fdd0a2', '#fd8d3c', '#d94801', '#7f2704'],
  permitBreaks: [2, 5, 10, 20],
  cipColors: { bond: '#b2182b', current: '#2166ac', grant: '#1b7837', othergo: '#762a83', debt: '#e08214', other: '#555555' },

  permitMonths: { first: '2021-01', last: '2026-07' }
};
