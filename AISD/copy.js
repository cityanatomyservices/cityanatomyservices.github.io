// copy.js — EVERY WORD THAT APPEARS ON THE AISD SCHOOL CHANGES MAP PAGE LIVES HERE.
//
// OWNER WRITES ALL COPY. The strings below were put in by Claude on 2026-09-12
// as working placeholders so the page could be built and tested; the owner
// replaces them. Nothing else in /AISD/ contains on-screen text — the popups
// show the research data itself (names, numbers, notes, source links).
window.AISD_COPY = {
  pageTitle: 'AISD School Changes',
  home: 'anatomy.city',

  legendTitle: 'Austin ISD school closures and consolidations',
  legendSub: 'Snapshot of 2026-09-12. Tick a role off to hide it.',

  // legend rows, one per role, in this order
  role: {
    closing:               'Closing',
    closing_and_receiving: 'Closing, and taking students',
    receiving:             'Receiving students',
    repurposed:            'Building repurposed',
    boundary_change:       'Boundary change only',
    program_move:          'Program moves',
    removed_from_plan:     'Taken off the list',
    other:                 'Other'
  },

  // the Layers box
  overlays: 'Layers',
  layer: {
    zones:   'Attendance zones of affected schools',
    links:   'Where students go',
    city:    'Austin city limits',
    council: 'Council districts'
  },

  // popup labels
  popup: {
    type: 'School', role: 'Role', address: 'Address', year: 'Takes effect',
    enrollment: 'Enrollment', prior: 'Earlier enrollment', capacity: 'Capacity', utilization: 'Utilization',
    linked: 'Linked schools', future: 'Building becomes', reason: 'District reason', history: 'How it moved through the plan',
    community: 'Community response', demographics: 'Who attends', sources: 'Sources',
    types: { elementary: 'Elementary', middle: 'Middle', high: 'High', other: 'Other' }
  },

  ui: {
    satellite: 'Satellite', zoomInBtn: 'Zoom in', zoomOutBtn: 'Zoom out', extents: 'Fit to schools',
    about: 'About this map', aboutClose: 'Hide', sources: 'Sources.', caveats: 'Caveats.', timeline: 'Timeline.'
  },

  about: {
    what: 'Every Austin ISD campus touched by the district’s 2025 closure and consolidation plan: the schools that close, the schools that take their students, buildings that get a new use, and schools that were on an earlier list and came off. Shaded areas are the attendance zones of the closing and receiving schools; lines show where a closing school’s students are sent.',
    sources: 'Austin ISD plan documents and board records, and local reporting (KUT, Austin American-Statesman, Community Impact, KXAN, Austin Monitor, Texas Tribune). Each popup lists the links used for that campus. Campus points and attendance zones from City of Austin open data.',
    caveats: 'Enrollment and capacity are the figures the district published with the plan and may differ from later counts. Attendance zones are the pre-plan boundaries; new boundaries take effect with the closures.'
  },

  attribution: 'Research snapshot 2026-09-12 · Campus and zone data: City of Austin open data'
};
