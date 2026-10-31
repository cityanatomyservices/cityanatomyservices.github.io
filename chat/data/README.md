# chat/data/ — boundaries and places for the chat map

## zipcodes.geojson — Austin ZIP areas (owner-selected, 2026-10-31)

Downloaded from [Boundaries: City of Austin Zip Codes](https://data.austintexas.gov/City-Government/Boundaries-City-of-Austin-Zip-Codes/49ja-3mqz/about_data),
dataset `49ja-3mqz`, provided by Austin Open Data with USPS source attribution.
Download: `https://data.austintexas.gov/resource/49ja-3mqz.geojson?$limit=50000`.

The snapshot has 44 features and 44 unique ZIP codes; every row identifies
Austin, TX. All geometries are MultiPolygon, longitude/latitude.
The full source geometry and properties are retained, with JSON whitespace
compacted (about 152 KB). Labels use `zipcode`. This is the portal's selected
ZIP-area dataset; it is not an additional clip to municipal boundaries.

The main map's Map panel loads this file only when ZIP codes is enabled. It
replaces the broader 103-area regional snapshot for the main map; files used
by other maps are unchanged. To refresh, download the same source, check the
row count and ZIP/city fields, and bump the data URL in `../map-layers.js`.

## Neighborhoods

`neighborhoods.geojson` — the City of Austin **Neighborhoods** layer
(neighborhood planning areas), downloaded unchanged from the Austin Open
Data portal on 2026-10-22 (owner: "use the Austin Open Data portal
neighborhood geojson and store it in GitHub").

- Portal dataset: https://data.austintexas.gov/d/inrm-c3ee (id `inrm-c3ee`)
- Download used: `https://data.austintexas.gov/api/geospatial/inrm-c3ee?method=export&format=GeoJSON`
- 95 features, MultiPolygon, WGS84 (longitude, latitude), 322 KB.
- Name field: `planning_area_name`. Other useful fields:
  `neighborhood_planning_status`, `neighborhood_sub_district`,
  `combined_npa`.
- The same layer is in the GIS library as `C:\GISData\austin\boundaries`
  area `neighborhoods` (catalog row verified by row count, 95).

Note for the chat map ("one geofence per neighborhood"): the 95 features
are 65 distinct planning areas; 16 are split into sub-districts (two to five rows
each, e.g. West Congress, Highland and Upper Boggy Creek have five): Brentwood, Central East Austin, Coronado Hills, Garrison Park, Highland, Mlk, Mlk-183, Pecan Springs-Springdale, South Manchaca, South River City, Sweetbriar, Upper Boggy Creek, West Congress, West University, Windsor Hills, Wooten. Decide whether a split area is one geofence
(merge by `planning_area_name`) or two before wiring the chat rooms.

To refresh: download the same URL again and replace the file; keep this note
and update the date.

## geofences.geojson — the chat rooms (merged by name, owner 2026-10-22)

One polygon per neighborhood name: 65 features, each with `id` (URL-safe,
e.g. `upper-boggy-creek`) and `name`. The sub-district rows above are
dissolved into their parent; every merge came out as a single Polygon.
Made by `bash tools/make-geofences.sh` (GDAL from the QGIS install) — run
it again after refreshing `neighborhoods.geojson`, then commit both. 156 KB.

## Business directory

The Austin Neighborhood Chat menu combines free public sources:

- [OpenStreetMap](https://www.openstreetmap.org/copyright), © OpenStreetMap contributors, under [ODbL 1.0](licenses/ODbL-1.0.txt).
- [Overture Maps Foundation Places](https://docs.overturemaps.org/guides/places/), with provider attribution below.
- [City of Austin Food Establishment Inspection Scores](https://data.austintexas.gov/d/ecmv-9xxi), used to corroborate food-business names and locations. An inspection is not a statement that a business is currently open, and this menu does not display or assess health scores.
- Austin.chat's existing guitar, bicycle and toy-shopping guides, with individual business source URLs retained in the records.

The original October 22 list contained 3,335 entries from OpenStreetMap alone.
The October 28 audit expanded the categories and compared additional directories,
resolved matching duplicates, checked selected stale listings against business
websites/local reporting, and corrected neighborhood polygon-hole handling.
Current counts, source releases and provider licenses are in [places/index.json](places/index.json);
per-run changes are in [places-audit.json](places-audit.json).

Each neighborhood file retains the existing group → category → business shape.
Businesses carry `id`, `name`, `lng`, `lat`, optional `address`/`website`, `sources`,
and optional `aliases` for merged chat IDs. Source evidence is traceable through
OpenStreetMap node/way/relation paths, Overture GERS IDs and release, City facility
IDs and inspection dates, or individual business URLs. No reviews or personal
contact records are imported.

Coverage is limited to the 65 existing neighborhood planning-area geofences;
this does not cover every business inside Austin's city limits or its suburbs.
Directory data can be incomplete or stale. New Overture food listings require a
matching City inspection; other additions require an open flag, high existence
confidence, street address, website and a mapped public-facing category. Records
were cross-matched automatically; not every business was individually verified.

The free Python/GitHub Actions process refreshes weekly. Underlying sources have
their own update schedules. See [the build instructions](../../tools/places/README.md)
for eligibility rules, manual corrections, validation and failure handling.

### Overture attribution and redistribution

Data from Overture Maps Foundation and Meta, Microsoft, BrightQuery, DAC, Birdeye,
Uberall, OpenTravel Alliance and PinMeTo is available under
[CDLA Permissive 2.0](licenses/CDLA-Permissive-2.0.txt).
Data from AllThePlaces is available under [CC0 1.0](licenses/CC0-1.0.txt).
Data from Foursquare: Copyright 2024 Foursquare Labs, Inc. All rights reserved.
Available under [Apache 2.0](licenses/Apache-2.0.txt); see the
[Foursquare notice](licenses/Foursquare-NOTICE.txt).
Foursquare data was transformed to the Overture schema. Austin.chat further
filters records, maps categories, normalizes addresses, merges matching locations
and selects fields for the neighborhood menu (October 28, 2026).
See [Overture's full attribution](https://docs.overturemaps.org/attribution/#places).

The combined neighborhood database incorporating OpenStreetMap is distributed
under ODbL 1.0, with the additional source notices/licenses retained above.
The database and the scripts used to produce it are publicly downloadable here.
