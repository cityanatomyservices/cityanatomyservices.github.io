# Austin planning routes

Public, reproducible preparation and deployment code for My Plan Map. The
website stays on GitHub Pages; the prepared network and route calculations run
in the existing Supabase project. No paid routing API is used.

These scripts extend the pilot in the owner's `austin-routing` repository. All
scripts needed to build and publish the network are here; large road files,
database snapshots and credentials stay outside Git.

## Data and profile

- Source: [Geofabrik Texas OpenStreetMap PBF](https://download.geofabrik.de/north-america/us/texas.html).
- Extent: the checked-in `extent.geojson`, Census Austin urban area buffered by
  10 km. It is a WGS84 extraction boundary; QGIS review layers can use EPSG:32614.
- Car estimates only. Per-class fallback speeds are explicitly estimates.
  Speeds are reduced to a static planning profile, with delays at traffic
  signals/stops and actual junctions, not every OSM way boundary.
- Shared OSM node identities preserve bridge/overpass separation. Barriers,
  vehicle access and directed connectivity constrain the usable network.
- Node and intermediate-way turn restrictions are resolved into edge sequences.
  `only_*` restrictions forbid other exits at each prefix. Conditional rules
  are conservative; unresolved approaches are blocked. A restricted-only path
  returns an unavailable result, never a usable route with a stripped penalty.
- Fractional edge endpoints avoid jumping to a road's end junction. A 250 m
  access limit asks the user to choose a better entrance when a place marker is
  too far from a suitable road. Access minutes are an offset-based allowance,
  not a pedestrian route. No live traffic, closures feed or navigation guidance.

OSM data is © OpenStreetMap contributors, licensed under
[ODbL](https://www.openstreetmap.org/copyright). The map includes this credit.
The source data date is returned by the routing-status RPC.

## Rebuild

Use Python with `requirements.txt` and Osmium Tool installed. The current
workspace has the environment at `~/.venvs/austin-routing`. Store inputs and
builds outside the repository. These example paths are Linux paths; on WSL,
keeping PBF files on the Linux filesystem avoids Windows memory-mapping issues.

```bash
curl -fL https://download.geofabrik.de/north-america/us/texas-latest.osm.pbf -o /data/texas.osm.pbf
osmium extract -s smart -S types=restriction -p tools/routing/extent.geojson /data/texas.osm.pbf -o /data/austin.osm.pbf
osmium tags-filter /data/austin.osm.pbf w/highway r/type=restriction -o /data/austin-roads.osm.pbf
python tools/routing/build_network.py /data/austin-roads.osm.pbf /data/build
python tools/routing/prepare.py /data/build /data/network
```

`smart` preserves restriction members at the boundary but needs more memory.
The initial pilot's existing extract used `complete_ways` under a 4 GB WSL cap.
That strategy does not guarantee complete relations; inspect missing members
and blocked approaches. The importer must not silently accept unresolved turns.

Outputs: CSVs, `review.gpkg` for QGIS, raw restriction/control metadata, and then
portable `roads.jsonl`, `turns.jsonl`, `network.json`. Each published version is
immutable and records its content checksum. Select a new version for a changed
build. Re-running the loader on an identical version resumes an interrupted load.

## Database deployment

Apply `supabase/migrations/0004_routing_network.sql`,
`0005_planner_routing_api.sql`, `0006_private_routing_engine.sql`, then
`0007_temporary_guests.sql` to Supabase. The last migration keeps guest routing
available without retaining a per-user route cache; only registered accounts
can persist planner data.
For local graph tests, apply only `0004`; it supports pgRouting 3.4 and 4.x
without relocating an existing local extension. The private extension schema
in `0006` keeps generic pgRouting SQL functions out of the public Data API;
it does not relocate PostGIS or alter parcel/chat tables.

The admin transport reads `SUPABASE_ACCESS_TOKEN`, or an existing CLI token at
`~/.supabase/access-token`. `SUPABASE_PROJECT_REF` can override the project.
Never put database credentials or admin tokens in the public repository.

```bash
python tools/routing/admin.py supabase/migrations/0004_routing_network.sql
python tools/routing/admin.py supabase/migrations/0005_planner_routing_api.sql
python tools/routing/admin.py supabase/migrations/0006_private_routing_engine.sql
python tools/routing/admin.py supabase/migrations/0007_temporary_guests.sql
python tools/routing/load.py /data/network --version 3 --supabase
python tools/routing/check_network.py --version 3 --supabase
```

The loader leaves the version INACTIVE. After checks and QGIS review, activate
it transactionally through the SQL editor or the admin transport:

```sql
begin;
update routing.networks set active=false where active;
update routing.networks set active=true where id=3;
commit;
```

Keep the previous version briefly for rollback. Only remove obsolete routing
versions after validation; do not delete unrelated application data. An explicit
`--activate` loader option also validates counts and references before switching,
but it does not replace the route regression checks.

No scheduled refresh is enabled yet. These commands can later run in GitHub
Actions using protected secrets and an appropriately sized runner. GitHub Pages
serves the interface; Actions prepares data, not interactive route requests.

## Verification

`check_network.py` creates a small transactional fixture and rolls it back. It
checks fractional endpoints, geometry direction, one-way travel, restrictions
across multiple roads, rejection when only a prohibited route exists, toll
avoidance and coverage. It then tests 13 real pairs with tolls allowed/avoided.
The airport's original center point deliberately requires a better entrance.

`node --test tests/planner/*.test.cjs` covers schedule fitting, fixed/locked
starts, infeasible days, unavailable estimates, changed entrances/tolls, stale
responses, navigation URLs and persistence. Browser checks additionally exercise
the live anonymous-session RPCs, route lines, mobile layouts and saved plans.
