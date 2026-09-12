// copy.js — EVERY WORD THAT APPEARS ON THE DATA CENTERS MAP PAGE LIVES HERE.
//
// OWNER WRITES ALL COPY. The strings below were put in by Claude on 2026-09-12
// as working placeholders so the page could be built and tested; the owner
// replaces them. Nothing else in /datacenters/ contains on-screen text — the
// popups show the research data itself (names, notes, source links).
window.DC_COPY = {
  pageTitle: 'Austin Data Centers',
  home: 'anatomy.city',

  legendTitle: 'Data centers in and around Austin',
  legendSub: 'Snapshot of 2026-09-12. Tick a status off to hide it.',

  // legend rows, one per status, in this order
  status: {
    operational:          'Operational',
    under_construction:   'Under construction',
    approved_planned:     'Approved / planned',
    announced_proposed:   'Announced / proposed',
    rumored_unconfirmed:  'Rumored / unconfirmed',
    cancelled_stalled:    'Cancelled / stalled'
  },
  sizeLegend: 'Dot size is the planned or built power in MW',
  mwUnknown: 'not reported',

  // the Layers box
  overlays: 'Layers',
  serviceArea: 'Austin Energy service area',

  // popup labels
  popup: {
    operator: 'Operator', status: 'Status', address: 'Address', place: 'Place',
    power: 'Power', size: 'Size', acres: 'Acres', year: 'Year',
    precision: 'Point precision', notes: 'Notes', utility: 'Power, water, politics', sources: 'Sources',
    mw: 'MW', sqft: 'sq ft',
    precisionWords: { address: 'street address', parcel_or_site: 'parcel or site', neighborhood: 'neighborhood, not a parcel', city_centroid: 'city centre only' }
  },

  ui: {
    satellite: 'Satellite', zoomInBtn: 'Zoom in', zoomOutBtn: 'Zoom out', extents: 'Fit to region',
    about: 'About this map', aboutClose: 'Hide', sources: 'Sources.', caveats: 'Caveats.'
  },

  about: {
    what: 'Every data center that is running, being built, approved, proposed, rumored or cancelled in Travis, Williamson, Hays, Bastrop and Caldwell counties, plus a few just beyond the ring in Temple and Rockdale. The number on each dot matches the site list in the research note.',
    sources: 'Company announcements, city council records, and local reporting (Community Impact, Austin Business Journal, Austin Free Press, KUT, Texas Tribune, Data Center Dynamics, the Central Texas Data Center Tracker). Each popup lists the links used for that site. Austin Energy service area from City of Austin open data.',
    caveats: 'Rural campuses are placed by road or tract description, not by parcel; see the point precision line in each popup. Statuses are as reported on 2026-09-12 and change fast.'
  },

  attribution: 'Research snapshot 2026-09-12 · Austin Energy service area: City of Austin open data'
};
