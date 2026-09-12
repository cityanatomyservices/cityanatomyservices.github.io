// copy.js — EVERY WORD THAT APPEARS ON THE BUDGET MAP PAGE LIVES HERE.
//
// OWNER WRITES ALL COPY. The strings below were put in by Claude on 2026-09-12
// as working placeholders so the page could be built and tested; the owner
// replaces them. Nothing else in /budget/ contains on-screen text.
window.BUDGET_COPY = {
  pageTitle: 'Austin FY 2026-27 Budget Map',
  home: 'anatomy.city',

  // owner's own wording (2026-09-12) for the dropdown label and the summary card
  topicLabel: '2027 Budget Topic',
  summaryCard: 'CityAnatomy Budget Summary:',

  // the seven maps, in the order they appear in the dropdown
  themes: {
    value:    { name: 'Tax base',            sub: 'Taxable value, 2025 to 2026' },
    bill:     { name: 'City tax bill',       sub: 'FY26 to FY27, adopted rate' },
    drainage: { name: 'Drainage charge',     sub: 'Monthly, FY27 rate' },
    permits:  { name: 'Building permits',    sub: 'By month, 2021 to 2026' },
    cip:      { name: 'Capital projects',    sub: 'Five-year plan, FY27 to FY31' },
    flood:    { name: 'Flood remapping',     sub: 'Atlas 14 study areas, FY27' },
    landmarks:{ name: 'Landmark exemptions', sub: 'Historic landmarks, FY26 inspection' }
  },

  legend: {
    pct:        ['Down more than 15%', 'Down 5 to 15%', 'Down 1 to 5%', 'About the same', 'Up 1 to 5%', 'Up 5 to 15%', 'Up more than 15%'],
    drainage:   ['Under $10', '$10 to $20', '$20 to $40', '$40 to $100', 'Over $100'],
    permits:    ['1', '2 to 4', '5 to 9', '10 to 19', '20 or more'],
    cip:        { bond: 'Bond', current: 'Current revenue', grant: 'Grant', othergo: 'Other GO', debt: 'Other debt', other: 'Other' },
    flood:      ['Study area', 'Regulatory floodplain'],
    landmarks:  ['Passed inspection', 'Failed inspection']
  },

  popup: {
    taxpayer: 'Type', taxable2025: 'Taxable 2025', taxable2026: 'Taxable 2026',
    bill2025: 'City tax FY26', bill2026: 'City tax FY27', change: 'Change',
    history: 'Taxable value by year',
    impervious: 'Impervious cover', pctImpervious: 'Share of lot', chargeFy26: 'Charge FY26', chargeFy27: 'Charge FY27',
    permits: 'Building permits', newConstruction: 'New construction', month: 'Month',
    department: 'Department', program: 'Program', funding: 'Funding', fiveYear: 'Five-year total',
    studyGroup: 'Study group', watersheds: 'Watersheds', parcels: 'Parcels', acres: 'Acres',
    address: 'Address', inspection: 'FY26 inspection',
    district: 'Council district', neighborhood: 'Planning area', medianHomestead: 'Median homestead bill change'
  },

  ui: {
    satellite: 'Satellite', zoomInBtn: 'Zoom in', zoomOutBtn: 'Zoom out', extents: 'Fit to Austin',
    tilt3d: '3D', tilt2d: '2D', tiltTitle: 'Tilt the map',
    about: 'About this map', aboutClose: 'Hide',
    how: 'How it is calculated.', sources: 'Sources.', caveats: 'Caveats.',
    zoomIn: 'Zoom in the map to see parcels',
    month: 'Month',
    play: 'Play', pause: 'Pause',
    loading: 'Loading'
  },

  attribution: 'City of Austin FY 2026-27 budget, Travis CAD rolls, City open data'
};
