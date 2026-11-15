# Parking overlay

The main map's left-hand P button toggles an independent overlay. It starts off,
loads data only on demand, keeps the camera unchanged, and has no planner actions
or persistence. Parking is suppressed in isolated Chat mode; explicitly enabling
parking leaves that mode. A style reload restores the selected visibility.

`node tools/parking/build.cjs` refreshes three separate public snapshots. The
weekly **Refresh Austin parking** workflow runs normalization tests, refreshes
the data and publishes through the existing Pages workflow. All source responses
must complete and pass count/drop checks before any saved snapshot is replaced.
Failures leave the last good committed data. The map shows its check date and
flags snapshots older than fourteen days.

- City service: https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Parking_Inventory_FME_UPDATE_view/FeatureServer
- City map: https://experience.arcgis.com/experience/5010870614c5488dbb107f599d15e8e1
- City open-data terms: https://data.austintexas.gov/download/2z87-8uh7/application/pdf
- OSM license: https://www.openstreetmap.org/copyright

City terms offer City-created data free and without restriction and request
attribution. OSM data is © OpenStreetMap contributors, under ODbL 1.0. The OSM
derived database is kept separate as `chat/data/parking/osm-parking.geojson`,
freely downloadable from the visible sources key, with its license and extraction
timestamp. City data is separately attributed. No paid API, key or subscription
is used. Overpass is queried by the updater, never separately by each visitor.

Coverage is the Austin-area box [-98.05,30.00,-97.50,30.60], not complete municipal
or regional coverage. City spaces include ordinary parking and marked accessible
spaces. Reserved/loading/no-parking/permit-only and flex/hybrid individual spaces
are excluded. Zone lines retain changing-use restrictions, displayed in amber;
their full source hours/restrictions remain visible. Times are not interpreted
as permission to park now. No nearest-zone join guesses which rules govern a
space. Paystation location records are not presented as parking spaces.

OSM facilities exclude explicitly private, customer-only, permit-only and other
restricted access, and omit street-side areas already represented by City data.
Missing access and fee tags are shown as unknown, never as public/free. Nodes
use their mapped point; ways/relations use the Overpass center, not a verified
vehicle entrance. Capacity means mapped total capacity, never vacancy. The
dataset is a weekly location snapshot, not live availability. Duplicates within
OSM or changes in restrictions remain possible; posted signs govern.

Checks: `node --test tools/parking/build.test.cjs` and
`node tools/parking/check-map.cjs [https://austin.chat]`. The browser check uses
real parking snapshots at desktop/phone sizes, with all account writes blocked.
