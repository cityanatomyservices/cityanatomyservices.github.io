// config.js — Austin Parcels app configuration.
//
// 2026-09-09: points at the paid cityanatomyservices Supabase project
// (aqbyxpiwugcvoephsvpm, the parcel database shared with WhatCanIBuildHere).
// The browser reads the parcels_public view + two RPCs; see docs/STATUS.md.
//
// Both keys below are PUBLIC by design:
//   - supabase.anonKey is Supabase's publishable client key; access is gated
//     by RLS policies on the parcels tables.
//   - The PMTiles URL points at a public Storage bucket.
// The service-role key MUST never appear here or anywhere in /parcels/.

window.PARCELS_CONFIG = {
  supabase: {
    url:     'https://aqbyxpiwugcvoephsvpm.supabase.co',
    anonKey: 'sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN'
  },

  pmtiles: {
    // Served by Supabase Storage; range requests supported.
    url:         'pmtiles://https://aqbyxpiwugcvoephsvpm.supabase.co/storage/v1/object/public/tiles/parcels.pmtiles?v=20260614',
    sourceLayer: 'parcels',
    minzoom:     12,
    maxzoom:     16
  },

  // Map view — center on Austin; override once you pick a specific ZIP.
  // [lng, lat]
  center:    [-97.7431, 30.2672],
  zoom:      13,
  maxBounds: [[-98.20, 30.00], [-97.40, 30.65]],

  // Below this zoom we hide parcels (they smear) and show the banner.
  zoomHintThreshold: 12
};
