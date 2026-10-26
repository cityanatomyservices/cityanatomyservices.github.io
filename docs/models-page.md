# The 3D models page: `/models/` (2026-10-26)

Five proposed Austin projects, built in Blender from published plans, drawn as
3D models on a MapLibre map. Pick a project, the map flies to it tilted, and
the model stands on the basemap or the satellite image at true size.

## Where things are

| What | Where |
| --- | --- |
| The page | `models/index.html`, `style.css`, `config.js` (files), `copy.js` (words), `js/app.js` (controls), `js/model-layer.js` (the three.js custom layer) |
| The models | `models/data/*.glb`, Draco-compressed, 1.4 MB in all |
| Where each model sits | `models/data/placements.json`: anchor, heading, ground offset, footprint, and the reasoning for each number |
| The tools | `tools/models/place.py` (writes placements.json), `tools/models/prepare-glbs.sh` (makes the GLBs), `tools/models/osm-cache/` (the OpenStreetMap answer place.py works from) |
| The Blender sources | `C:\Dev\Austin_Models_Transfer_Batch\` (five zips) and `unpacked\` next to it. **Not in any git repo.** |
| The framed page | `maps/models/` (from `node tools/make-pages.js`), card in `home.json` under Metro Apps |

## How a model gets on the map

1. **Blender → GLB.** Each project in the transfer batch ships `Models/*.glb`
   in metres, Y up, around its own pivot. `prepare-glbs.sh` runs gltf-transform
   on the chosen ones (`FILES` at the top of the script) and writes
   `models/data/<name>.glb`. Draco compression is what makes them small: the
   drainage model is 17 MB raw and 0.5 MB compressed. The decoder is loaded on
   the page from the same pinned three.js copy on unpkg. Two passes: `optimize`
   with palette, simplify and compression OFF (keeps every vertex and every
   flat material colour), then `draco` at 16-bit positions (the default 14 bits
   spaced vertices 0.4 m apart on the 6 km drainage model).
2. **Where it goes.** The map is flat, so a model needs three things: an
   anchor (lon/lat for its local origin), a heading (how far its +Y axis is
   turned clockwise from true north) and a ground offset (metres to lift or
   sink it so its ground meets the map plane). `place.py` derives these from
   OpenStreetMap geometry and the packages' own notes, never by eye:
   - **Drainage**: the package's state-plane origin (exact). Heading = the
     Texas Central grid convergence at that longitude (+1.34°). Sunk by the
     ground height at the origin minus NAVD88 100 m, so tunnels sit at true
     depth and show through the ground as an x-ray.
   - **Convention Center**: centroid of the existing building's footprint in
     OSM; heading = bearing of Trinity Street (17.9°, package guessed 17).
   - **I-35 stitches**: where the line of East 41st Street crosses the
     mainlanes in OSM; heading = the mainlanes' bearing there (28°).
   - **Lady Bird rail**: the OSM node where Trinity meets Cesar Chavez;
     heading = Trinity's bearing north of it (18.0°, package guessed 18.01).
     Sunk by street grade minus lake level, so streets land on the map plane.
   - **AUS Concourse B**: the package has no coordinates at all. Terminal
     footprint centroid in OSM, moved 308 m towards the airfield (the distance
     between the concourse and the terminal stand-in inside the model itself);
     heading = the terminal's long axis.
   Every placement carries its `derivation` text and an `accuracy` line, and
   the page shows them in the About panel. Expect metres for drainage, tens of
   metres for the rest, more for AUS.
3. **Drawing.** `model-layer.js` is one MapLibre custom layer
   (`renderingMode: '3d'`) with a three.js scene on the map's own WebGL
   context. **The trap:** MapLibre's Mercator world (x east, y south, z up)
   is left-handed and three.js assumes right-handed, so a mirror in an
   object's matrix makes three.js light every face from the wrong side. The
   mirror therefore lives in the camera's projection matrix (`FLIP_Y`), and
   objects sit in a right-handed map frame (x east, y north, z up). Each
   model's matrix: move to the anchor (Mercator x, minus Mercator y), scale
   metres to Mercator units at that latitude, quarter turn about x (Y-up to
   Z-up), turn about the up axis by minus the heading, lift by the ground
   offset. Lights: a hemisphere light and one sun from the south-east.
   Materials are forced matte (metal with nothing to reflect renders black)
   and Blender glass becomes plain transparency. Models load the first time
   they are switched on and stay loaded. Map `antialias: true` matters.

## Adding a sixth model

1. Unpack its transfer zip next to the others in `unpacked\`.
2. Add its GLB(s) to `FILES` in `tools/models/prepare-glbs.sh` and run it.
3. Add a block to `tools/models/place.py` that works out anchor, heading and
   ground offset from something checkable (an OSM way or node, the package's
   own coordinates), with a `derivation` for each; run
   `python3 tools/models/place.py` (`--refresh` if the OSM query changed).
4. Add the project to `config.js` (id, colour, layers) and its words to
   `copy.js` (name, what, caveats, layer labels, sources), marked draft.
5. Bump `?v=` on the changed files, push, wait for the Pages deploy, test on a
   phone.

## Checks that were run (2026-10-26)

- Headless Chromium (playwright-core, the Chromium in `~/.cache/ms-playwright`)
  loads the page with no console errors and every file at 200; each project
  renders when picked, screenshots against the satellite layer for orientation.
- Sanity numbers from `place.py`: drainage convergence 1.34°, Convention
  Center heading 17.87° vs the package's 17, Lady Bird 17.99° vs 18.01.

## Open questions

- 3D custom layers on phone GPUs: untested until the owner opens the page on
  the phone.
- The Blender sources and the transfer batch have no git home.
