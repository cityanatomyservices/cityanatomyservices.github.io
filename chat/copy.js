// copy.js — EVERY WORD THAT APPEARS ON THE CHAT MAP LIVES HERE.
//
// OWNER WRITES ALL COPY. These strings are working placeholders put in by
// Claude on 2026-10-22 so the page could be built; the owner replaces them.
window.MAP_COPY = {
  pageTitle: 'Austin neighborhoods',
  ui: {
    satellite: 'Satellite', zoomInBtn: 'Zoom in', zoomOutBtn: 'Zoom out', extents: 'Fit to Austin',
    about: 'About this map', aboutClose: 'Hide', sources: 'Source.'
  },
  // the card in the top-left corner
  legendTitle: 'Austin neighborhoods',
  legendSub: 'See and chat with the people in your neighborhood.',
  // the card's chat lines and buttons
  you: 'You are',
  newName: 'New name',
  visible: 'Visible', hidden: 'Hidden',
  chatButton: 'Chat',
  // room: the status line. {name} is the neighborhood's name.
  room: {
    off: 'This browser has no location.',
    asking: 'Finding your neighborhood\u2026',
    denied: 'Location is off. Allow it to join your neighborhood.',
    outside: 'You are outside the mapped neighborhoods.',
    inside: 'You are in {name}.'
  },
  // people: how many are visible here. {n} is the count of OTHER people.
  people: { none: 'Nobody else is visible here yet.', one: '1 other person is visible here.', many: '{n} other people are visible here.',
            hiddenNote: 'Turn Visible on to be seen and to chat.' },
  chat: { send: 'Send', close: 'Close', placeholder: 'Say something to the neighborhood\u2026' },
  about: {
    what: 'The City of Austin neighborhood planning areas, one shape per neighborhood (areas the city splits into sub-districts are shown as one).',
    sources: 'City of Austin Open Data portal, Neighborhoods layer (dataset inrm-c3ee), downloaded 2026-10-22.'
  },
  attribution: 'City of Austin open data · © OpenStreetMap contributors'
};
