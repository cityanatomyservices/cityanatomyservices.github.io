// config.js — the files behind the 3D models page and how it opens.
//
// The GLBs in ./data/ come out of the Blender transfer batch at
// C:\Dev\Austin_Models_Transfer_Batch, shrunk by tools/models/prepare-glbs.sh.
// Where each model sits (anchor, heading, ground offset, footprint) is in
// ./data/placements.json, written by tools/models/place.py with its
// reasoning next to every number. Words are in copy.js.
//
// A project lists its layers: the first is the model itself, the rest are
// optional context parts the Layers box offers as checkboxes (`on` is the
// starting state). A layer loads the first time it is switched on.
window.MODELS_CONFIG = {
  basemap: 'https://tiles.openfreemap.org/styles/positron',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  placements: './data/placements.json?v=20261026c',

  // how the page opens: all five anchors in view, flat
  minZoom: 9,
  fitPadding: 60,
  // the camera a picked project flies to
  pitch: 55,

  projects: [
    { id: 'drainage', color: '#1f77b4', layers: [
        { id: 'main', file: './data/drainage.glb?v=20261026c', on: true }
      ] },
    { id: 'convention-center', color: '#d62728', layers: [
        { id: 'main', file: './data/convention-center.glb?v=20261026c', on: true }
      ] },
    { id: 'i35-stitches', color: '#2ca02c', layers: [
        { id: 'main', file: './data/i35-stitches.glb?v=20261026c', on: true },
        { id: 'highway', file: './data/i35-highway-context.glb?v=20261026c', on: false }
      ] },
    { id: 'lady-bird-rail', color: '#9467bd', layers: [
        { id: 'main', file: './data/lady-bird-rail.glb?v=20261026c', on: true },
        { id: 'trains', file: './data/lady-bird-trains.glb?v=20261026c', on: true },
        { id: 'lake', file: './data/lady-bird-lake-surface.glb?v=20261026c', on: false },
        { id: 'shore', file: './data/lady-bird-shore-context.glb?v=20261026c', on: false }
      ] },
    { id: 'aus-concourse-b', color: '#ff7f0e', layers: [
        { id: 'main', file: './data/aus-concourse-b.glb?v=20261026c', on: true },
        { id: 'tunnel', file: './data/aus-tunnel.glb?v=20261026c', on: false },
        { id: 'apron', file: './data/aus-apron-context.glb?v=20261026c', on: false },
        { id: 'aircraft', file: './data/aus-aircraft-context.glb?v=20261026c', on: false },
        { id: 'terminal', file: './data/aus-terminal-context.glb?v=20261026c', on: false }
      ] }
  ]
};
