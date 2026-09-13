// copy.js — EVERY WORD THAT APPEARS ON THE DATA CENTERS MAP PAGE LIVES HERE.
//
// OWNER WRITES ALL COPY. The strings below were put in by Claude on 2026-09-12
// as working placeholders so the page could be built and tested; the owner
// replaces them. Nothing else in /datacenters/ contains on-screen text — the
// popups show the research data itself (names, notes, source links).
window.DC_COPY = {
  pageTitle: 'Austin Data Centers',
  player: {
    name: 'Name', location: 'City / Area', zoomTo: 'Zoom to this site',
    play: 'Play', pause: 'Pause', back: 'Back', next: 'Next', stop: 'Finish',
    autoplay: 'Autoplay', timeline: 'Map animation', ready: 'Ready', done: 'Complete',
    city: 'Austin city limits', cityText: 'Austin city limits are now shown.',
    overview: 'Regional overview', corridor: 'Round Rock to Taylor',
    corridorText: 'This is placeholder text for the Round Rock to Taylor area. This paragraph will be replaced with the story you want to tell about the locations shown on the map. Use this space to introduce the area, explain the pattern of development, and describe the details viewers should notice.',
    // The electric and water steps (added 2026-09-13). Each turns on the layers
    // named in player.js and shows the paragraph below. PLACEHOLDER TEXT: the
    // owner writes what viewers should understand about power and water here.
    electric: 'Electric grid',
    electricText: 'Placeholder for the electric grid step. This paragraph will explain what the transmission lines, substations and power plants now on the map mean for the data centers: which utility serves each campus, where the 345 kV backbone runs, how much generation sits nearby, and what the important considerations are.',
    water: 'Water resources',
    waterText: 'Placeholder for the water step. This paragraph will explain what the aquifers, groundwater districts, planning regions, intakes and outfalls now on the map mean for the data centers: where their water would come from, who regulates it, and what the important considerations are.',
    empty: 'No sites in this category.', unknownCity: 'City not reported'
  },
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

  // the Layers box: title, then one label per overlay (keys match config.js)
  overlays: 'Layers',
  overlayGroup: { electric: 'Electric', water: 'Water', boundaries: 'Boundaries' },
  overlay: {
    service:      'Austin Energy service area',
    transmission: 'Transmission lines (thicker = higher kV)',
    plants:       'Power plants (hollow = planned)',
    substations:  'Substations, 69 kV and up',
    aquifers:     'Major aquifers',
    gcd:          'Groundwater conservation districts',
    rwpa:         'Regional water planning areas',
    huc8:         'Watersheds (HUC-8)',
    intakes:      'Surface water intakes',
    outfalls:     'Wastewater outfalls',
    city:         'Austin city limits',
    council:      'Council districts',
    zip:          'ZIP codes'
  },
  // labels for the fields shown when a context feature (line or point) is clicked
  fields: {
    kv: 'Voltage (kV)', owner: 'Owner', status: 'Status', name: 'Name', entity: 'Operator',
    technology: 'Technology', mw: 'Nameplate MW', phase: 'Phase', year: 'Year', county: 'County',
    operator: 'Operator', kind: 'Kind', system: 'Water system', waterbody: 'Water body', intake: 'Intake',
    permittee: 'Permittee', permit: 'Permit', outfall: 'Outfall', segment: 'Stream segment', dtype: 'Discharge type'
  },

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
    sources: 'Company announcements, city council records, and local reporting (Community Impact, Austin Business Journal, Austin Free Press, KUT, Texas Tribune, Data Center Dynamics, the Central Texas Data Center Tracker). Each popup lists the links used for that site. Austin Energy service area from City of Austin open data. Transmission lines from HIFLD; power plants from the EIA-860M inventory (July 2026); substations from OpenStreetMap contributors; aquifers, groundwater districts and planning areas from the Texas Water Development Board; watersheds from the USGS; intakes and outfalls from TCEQ.',
    caveats: 'Rural campuses are placed by road or tract description, not by parcel; see the point precision line in each popup. Statuses are as reported on 2026-09-12 and change fast.'
  },

  attribution: 'Research snapshot 2026-09-12 · City of Austin open data · HIFLD · EIA · © OpenStreetMap contributors · TWDB · USGS · TCEQ'
};
