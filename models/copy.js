// copy.js — every word on the 3D models page.
//
// DRAFT (2026-10-26): the project descriptions below were drafted from the
// notes packed with each model (MODEL_NOTES.md, model_parameters.json,
// placement notes) for the owner to review and rewrite. The caveats quote
// those notes on purpose: the models are independent reconstructions of
// published plans, not the designers' files, and the page should say so.
window.MODELS_COPY = {
  title: 'Austin Projects in 3D',
  home: 'austin.chat',
  satellite: 'Satellite',
  extentTitle: 'All projects',
  projectsTitle: 'Projects',
  projectsSub: 'Pick one to fly to it. Drag with the right mouse button (or two fingers) to tilt and turn.',
  layersTitle: 'Layers',
  buildings: 'Existing buildings (3D)',
  aboutOpen: 'About this model',
  aboutClose: 'Close',
  draft: 'Draft text, under review.',
  loadFailed: 'This model could not be loaded.',
  labels: {
    what: 'What it shows',
    caveats: 'What it is not',
    placement: 'How it was placed',
    accuracy: 'How close',
    sources: 'Sources'
  },

  projects: {
    'drainage': {
      name: 'I-35 and Cesar Chavez drainage tunnels',
      short: 'Tunnels, nine shafts and a pump station, about 10 km',
      what: 'The stormwater tunnel network built with the I-35 reconstruction: the I-35 and Cesar Chavez tunnels, nine shafts, the pump station and outfall near the lake, drawn at true depth below the street. Centrelines and profiles were read from the 2024 TxDOT contract drawings.',
      caveats: 'Plan basis, not as-built. Shell details and lateral adits are schematic; the pump equipment is simplified. The map has no terrain, so tunnels show through the ground as an x-ray and read shallower where the land rises to the north-east.',
      layers: { main: 'Tunnels, shafts and pump station' },
      sources: [
        { label: 'TxDOT tunnel contract, volume 1', url: 'https://ftp.txdot.gov/plans/State-Let-Construction/2024/12%20December/12%20Contract%20Plans/Travis%200015-13-433%20Vol.1.pdf' },
        { label: 'TxDOT tunnel contract, volume 2', url: 'https://ftp.txdot.gov/plans/State-Let-Construction/2024/12%20December/12%20Contract%20Plans/Travis%200015-13-433%20Vol.2.pdf' },
        { label: 'TxDOT pump station plan archive', url: 'https://ftp.txdot.gov/plans/Facilities/2024/11%20November/SLBC%2014-0914-04-362%20New%20Pump%20Station%20Facility,%20CapEx/' }
      ]
    },
    'convention-center': {
      name: 'Convention Center redevelopment',
      short: 'The proposed LMN/Page design on its downtown block',
      what: 'An independent reconstruction of the published redevelopment design by LMN/Page: the main hub, ballroom, paseo and northern plaza on the block between Trinity, Red River, Cesar Chavez and 4th. Footprints were read off the illustrative site plan presented to the Design Commission.',
      caveats: 'Not the architect\'s model, a permit model or a construction document. Dimensions are estimates from a scale bar. Switch the existing buildings off: the present Convention Center still stands on this block in the map data.',
      layers: { main: 'Proposed building and plazas' },
      sources: [
        { label: 'Design Commission presentation, part 2 (site plan)', url: 'https://services.austintexas.gov/edims/document.cfm?id=450212' },
        { label: 'Design Commission presentation, part 3 (elevations)', url: 'https://services.austintexas.gov/edims/document.cfm?id=450211' },
        { label: 'Project overview, unconventionalatx.com', url: 'https://unconventionalatx.com/overview/' }
      ]
    },
    'i35-stitches': {
      name: 'I-35 northern stitches',
      short: 'The 41st Street split stitch and the Red Line stitch',
      what: 'The two northern "stitch" decks the City carried forward in 2026 (Option B): a split deck at 41st Street and a longer deck beside the Red Line, over the lowered I-35 mainlanes, with an illustrative park treatment on top.',
      caveats: 'Deck extents were traced from a presentation diagram; amenities, heights and the lowered highway are illustrative, not TxDOT\'s design. Nothing here says the decks are funded or scheduled. The hatched extension in the City\'s diagram is left out.',
      layers: { main: 'Both stitches', highway: 'Lowered highway (context)' },
      sources: [
        { label: 'City memorandum, January 2026 (Option B)', url: 'https://services.austintexas.gov/edims/document.cfm?id=465600' },
        { label: 'Council work session, March 2026', url: 'https://services.austintexas.gov/edims/document.cfm?id=469650' },
        { label: 'TxDOT Capital Express Central', url: 'https://www.txdot.gov/mymobility35/projects/capex-central.html' }
      ]
    },
    'lady-bird-rail': {
      name: 'Light rail over Lady Bird Lake',
      short: 'Trinity Street, the lake crossing and Waterfront Station',
      what: 'Austin Light Rail\'s preferred alternative from Trinity near 3rd Street, through Cesar Chavez Station, across the lake on a new bridge with a walking and cycling deck below, to the elevated Waterfront Station on the south shore. Alignment and profile follow the January 2026 Final EIS drawings.',
      caveats: 'Traced from conceptual plan sheets, not CAD. Piers, girders, station architecture, trees and the neutral context blocks are illustrative. The lake is drawn at its normal level; the south approach is cropped, not a terminus.',
      layers: { main: 'Bridge, guideway and stations', trains: 'Trains, people and kayaks', lake: 'Lake surface', shore: 'Shore and city context' },
      sources: [
        { label: 'ATP Final EIS, Appendix C conceptual drawings', url: 'https://www.atptx.org/wp-content/uploads/2021/01/19_ALR_FEIS_Appendix_C_Project_Design_May_2025pdf.pdf' },
        { label: 'ATP Final EIS, Chapter 2 preferred alternative', url: 'https://www.atptx.org/wp-content/uploads/2021/01/07_ALR_FEIS_Chapter_2_Alternatives_Considered_January_2026.pdf' },
        { label: 'ATP visuals and aesthetics appendix', url: 'https://www.atptx.org/wp-content/uploads/2021/01/28_ALR_FEIS_Appendix_E5_Visuals_Aesthetics_December_2025.pdf' }
      ]
    },
    'aus-concourse-b': {
      name: 'AUS Concourse B',
      short: 'A 26-gate concourse south of the Barbara Jordan Terminal',
      what: 'A conceptual exterior of the airport\'s planned Concourse B: a long glazed bar with four raised pavilions and 26 boarding bridges, joined to the terminal by an underground walkway. The character comes from the airport\'s May 2026 rendering; the gate count from the current programme.',
      caveats: 'Pre-design. No dimensioned drawings were available, so every size is an estimate and the position is a documented guess from the terminal footprint. Gate numbers and airline positions are not shown on purpose.',
      layers: { main: 'Concourse and bridges', tunnel: 'Underground walkway (cutaway)', apron: 'Apron', aircraft: 'Aircraft', terminal: 'Existing terminal (stand-in)' },
      sources: [
        { label: 'Journey With AUS programme', url: 'https://www.flyaustin.com/expansion-development-program' },
        { label: 'Airport Advisory Commission update, September 2026', url: 'https://services.austintexas.gov/edims/document.cfm?id=480693' },
        { label: '2024 design brief (tunnel length)', url: 'https://financeonline.austintexas.gov/afo/account_services/solicitation/solicitation_details_print.cfm?sid=140127' }
      ]
    }
  }
};
