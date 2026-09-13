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
    corridor: 'Round Rock to Taylor',
    // ── the four story paragraphs ─────────────────────────────────────────
    // DRAFTS written by Claude on 2026-09-13 at the owner's request ("put text
    // there about why that area is attractive ... mention the significance").
    // Facts come from the research note (qgis-lab notes/austin-datacenters-2026.md)
    // and the map's own layers. The owner edits or replaces every word.
    corridorText: 'The Round Rock, Hutto and Taylor corridor holds the biggest campuses in the region: Skybox PowerCampus in Hutto, with two buildings running and 600 MW planned, Sabey and Switch in Round Rock, and the KDC, Blueprint and Iron Mountain proposals around Taylor. It lies entirely outside Austin Energy, in Oncor territory, where power is bought from competitive ERCOT retailers rather than a city utility. Samsung\u2019s Taylor fab brought a 345 kV transmission build-out along US 79 and SH 130. Large flat tracts are still cheap compared with Travis County, and the cities compete for projects with tax incentives: Hutto\u2019s Chapter 312 abatement, Round Rock\u2019s Chapter 380 agreements, and rebates in Taylor and Georgetown.',
    serviceArea: 'Austin Energy service area',
    serviceAreaText: 'The purple outline is Austin Energy, the city-owned utility. Inside it, data centers such as the MetCenter campuses, Digital Realty and Tesla\u2019s Cortex cluster buy power from the city, which sets the rates, approves large loads and answers to the city council. Every campus in Williamson County sits outside the line, in Oncor\u2019s part of the ERCOT market, where the wires company only delivers and the customer signs its own supply contract. That boundary is one reason the largest projects cluster to the north and east.',
    electric: 'Transmission and substations',
    electricText: 'Lines are drawn thicker at higher voltage. The 345 kV backbone, Oncor\u2019s Round Rock Northeast to Hutto Switching Station to Taylor and Elgin corridor, is what makes gigawatt-scale campuses possible; the 138 kV lines, mostly Oncor and LCRA here, feed the local substations. The corridor campuses line up along it, and the biggest are building their own substations: two 300 MW units at Skybox Hutto, two more in KDC\u2019s Taylor plan. Where the grid connection is slow, developers propose gas generation on site instead: a 477 MW plant for Project Mustang near Taylor and a 1.2 GW plant for CloudBurst in San Marcos.',
    water: 'Water resources',
    waterText: 'Water is the harder constraint. The blue shading is the major aquifers: the Edwards (Balcones Fault Zone) and Trinity under the west side, the Carrizo-Wilcox to the east. Green outlines are groundwater conservation districts, which permit and limit pumping; the Round Rock to Taylor corridor lies in none, so groundwater there is governed only by the rule of capture. The dots are public surface-water intakes: Round Rock, Georgetown and Brushy Creek MUD draw on Lake Georgetown, Brushy Creek Regional Utility Authority on Lake Travis, Austin on Lake Austin. Hutto\u2019s campuses run on city water blended from wells and surface supply; the tracker estimates 5 to 8 million gallons a day for Skybox at full build with evaporative cooling, while newer projects promise closed-loop or liquid cooling that uses a fraction of that. In Hays County, opposition over the Edwards recharge zone led the county to pause high-water-use projects in June 2026.',
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
