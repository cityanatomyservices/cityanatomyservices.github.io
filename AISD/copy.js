// copy.js — EVERY WORD THAT APPEARS ON THE AISD SCHOOL CHANGES MAP PAGE LIVES HERE.
//
// The strings were put in by Claude on 2026-09-12 as working placeholders and
// extended on 2026-09-14 with the timeline story; the owner edits or replaces
// them. Nothing else in /AISD/ contains on-screen text — the popups show the
// research data itself (names, numbers, notes, source links).
window.MAP_COPY = {
  pageTitle: 'AISD School Changes',
  home: 'anatomy.city',

  // the intro card shown over the map when the page opens (mirrors the data
  // centers page; the owner wrote that wording on 2026-09-14)
  intro: {
    title: 'Austin ISD School Changes Map',
    text: 'Play the animation from here or anytime from the timeline on the bottom',
    play: 'Play',
    navigate: 'Navigate Map'
  },

  player: {
    name: 'Name', location: 'School', zoomTo: 'Zoom to this school',
    play: 'Play', pause: 'Pause', back: 'Back', next: 'Next', stop: 'Finish',
    autoplay: 'Autoplay', timeline: 'Map animation', ready: 'Ready', done: 'Complete',
    empty: 'No schools in this category.', unknownType: 'School',
    // ── the five story cards ─────────────────────────────────────────────
    // DRAFTS by Claude, 2026-09-14, from the research note (qgis-lab
    // notes/aisd-school-changes-2026.md) and the map's own data. The owner
    // edits every word.
    why: 'Why the plan',
    whyText: 'Austin ISD has lost students for a decade: about 83,000 in 2015, just over 69,000 today, leaving roughly 25,000 empty seats. The district faced a $20 million deficit when the plan was drafted, now past $100 million, and the state required turnaround plans at twelve low-rated campuses. The shaded areas are the attendance zones of the schools that close or take students.',
    where: 'Where students go',
    whereText: 'Ten schools closed in May 2026, plus International High School, and 3,796 students were reassigned. Each line runs from a closing school to where its students go. Some move whole: Dawson to Galindo, Widén to Rodriguez. Others split: Bedichek across Covington, Paredes and Mendez; Martin across Kealing, Lively and Marshall. Receiving schools inherit the state turnaround plans.',
    south: 'South Austin',
    southText: 'South Austin shows the pattern. Becker was full at 118 percent, but its dual-language program moves to Sánchez and its neighborhood students go to Galindo or Zilker. Dawson, at 29 percent of capacity, sends everyone to Galindo. Sunset Valley splits between Boone and Cunningham, while Odom becomes the district\u2019s only non-zoned dual-language campus.',
    removed: 'Taken off the list',
    removedText: 'Grey dots were on an earlier list and came off. Palm, Bryker Woods and Maplewood were pulled from the vote in November 2025. Moving Garza to Martin, Montessori to Govalle and International High School to Navarro were dropped. Districtwide boundary changes were pushed to 2028, with only Marshall Middle and Linder Elementary in the first phase.',
    buildings: 'What happens next',
    buildingsText: 'Sunset Valley and Dawson are being sold, Bedichek\u2019s land ground-leased, Becker, Ridgetop and Widén reused, Martin land-banked, and Barrington and Winn used as swing space during rebuilds. Blackshear closes in January 2028 when the rebuilt Oak Springs opens. Paredes Middle closed in July 2026, and Burnet and Webb now face possible state takeover.'
  },

  legendTitle: 'Austin ISD school closures and consolidations',
  legendSub: 'Snapshot of 2026-09-12. Tick a role off to hide it.',

  // legend rows, one per role (the category field), in this order
  category: {
    closing:               'Closing',
    closing_and_receiving: 'Closing, and taking students',
    receiving:             'Receiving students',
    repurposed:            'Building repurposed',
    boundary_change:       'Boundary change only',
    program_move:          'Program moves',
    removed_from_plan:     'Taken off the list',
    other:                 'Other'
  },

  // the Layers box: title, group headings, one label per overlay (keys match config.js)
  overlays: 'Layers',
  overlayGroup: { plan: 'The plan', boundaries: 'Boundaries' },
  overlay: {
    zones:   'Attendance zones of affected schools',
    links:   'Where students go',
    city:    'Austin city limits',
    council: 'Council districts'
  },
  // labels for the fields shown when a link is clicked
  fields: { from: 'From', to: 'To', share_pct: 'Share of students (%)', detail: 'Detail' },

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
    what: 'Every Austin ISD campus touched by the district\u2019s 2025 closure and consolidation plan: the schools that close, the schools that take their students, buildings that get a new use, and schools that were on an earlier list and came off. Shaded areas are the attendance zones of the closing and receiving schools; lines show where a closing school\u2019s students are sent.',
    sources: 'Austin ISD plan documents and board records, and local reporting (KUT, Austin American-Statesman, Community Impact, KXAN, Austin Monitor, Texas Tribune). Each popup lists the links used for that campus. Campus points and attendance zones from City of Austin open data.',
    caveats: 'Enrollment and capacity are the figures the district published with the plan and may differ from later counts. Attendance zones are the pre-plan boundaries; new boundaries take effect with the closures.'
  },

  attribution: 'Research snapshot 2026-09-12 · Campus and zone data: City of Austin open data'
};
