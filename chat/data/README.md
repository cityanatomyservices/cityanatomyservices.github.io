# chat/data/ — neighborhood geofences for the chat map

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
are 65 distinct planning areas; 16 are split into sub-districts (two rows
each): Brentwood, Central East Austin, Coronado Hills, Garrison Park, Highland, Mlk, Mlk-183, Pecan Springs-Springdale, South Manchaca, South River City, Sweetbriar, Upper Boggy Creek, West Congress, West University, Windsor Hills, Wooten. Decide whether a split area is one geofence
(merge by `planning_area_name`) or two before wiring the chat rooms.

To refresh: download the same URL again and replace the file; keep this note
and update the date.
