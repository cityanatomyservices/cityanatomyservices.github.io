#!/usr/bin/env bash
# build-datacenters-layers.sh — export the electric and water context layers
# for /datacenters/ from the GIS library as small web GeoJSON files.
#
# Source layers live in C:\GISData\austin\energy.gpkg and water.gpkg (EPSG:2277),
# filled by C:\GISData\scripts\fetch_energy_water.py. This script only converts:
# WGS84, 4-decimal coordinates (about 10 m), light simplification, a trimmed
# field list, and a clip to the map's region box so nothing sprawls off-map.
#
# Run from WSL at the repo root:  bash scripts/build-datacenters-layers.sh
# Then bump ?v= in datacenters/config.js for every file that changed.
set -euo pipefail
OGR=/mnt/c/OSGeo4W/bin/ogr2ogr.exe
OUT="$(cd "$(dirname "$0")/.." && pwd)/datacenters/data"
ENERGY='C:\GISData\austin\energy.gpkg'
WATER='C:\GISData\austin\water.gpkg'
# the region box the fetch script used (lon/lat)
CLIP="-99.0 29.2 -96.2 31.7"

# export <gpkg> <layer> <outfile> <simplify tolerance in FEET (source CRS)> <sql>
# ogr2ogr simplifies in the source layer's units before reprojecting, and the
# library is in US survey feet. NAD83 to WGS84 differs by under a metre here,
# so the "several coordinate operations" warning is silenced.
export_layer() {
  local gpkg="$1" layer="$2" file="$3" tol="$4" sql="$5"
  local win_out; win_out="$(wslpath -w "$OUT/$file")"
  rm -f "$OUT/$file"
  "$OGR" -f GeoJSON "$win_out" "$gpkg" -dialect sqlite -sql "$sql" \
    -t_srs EPSG:4326 -ct_opt WARN_ABOUT_DIFFERENT_COORD_OP=NO -clipdst $CLIP -simplify "$tol" \
    -lco COORDINATE_PRECISION=4 -lco RFC7946=YES -lco WRITE_BBOX=NO -lco ID_FIELD=fid 2>&1 | grep -v '^Warning 1: .*Layer creation options' || true
  printf '%-28s %6d KB\n' "$file" "$(( $(stat -c %s "$OUT/$file") / 1024 ))"
}

# ── electric ──
export_layer "$ENERGY" transmission_lines transmission_lines.geojson 80 \
  "SELECT VOLTAGE AS kv, OWNER AS owner, STATUS AS status, geom FROM transmission_lines"
export_layer "$ENERGY" power_plants power_plants.geojson 0 \
  "SELECT name, entity, county, \"group\" AS phase, technology, mw, generators, year, geom FROM power_plants"
# substations: only ones tagged 69 kV or more, so the distribution clutter stays out
export_layer "$ENERGY" substations_osm substations.geojson 0 \
  "SELECT name, operator, voltage_kv AS kv, kind, geom FROM substations_osm WHERE voltage_kv >= 69"

# ── water ──
export_layer "$WATER" major_aquifers major_aquifers.geojson 400 \
  "SELECT AquiferName AS name, geom FROM major_aquifers"
export_layer "$WATER" groundwater_districts groundwater_districts.geojson 150 \
  "SELECT OfficialName AS name, Website AS website, geom FROM groundwater_districts"
export_layer "$WATER" water_planning_areas water_planning_areas.geojson 150 \
  "SELECT RegionName AS name, geom FROM water_planning_areas"
export_layer "$WATER" watersheds_huc8 watersheds_huc8.geojson 150 \
  "SELECT name, huc8, areasqkm AS sq_km, geom FROM watersheds_huc8"
export_layer "$WATER" surface_water_intakes surface_water_intakes.geojson 0 \
  "SELECT SYS_NAME AS system, WATERBODY AS waterbody, OWNR_DES AS intake, geom FROM surface_water_intakes WHERE OPSTAT = 'O'"
export_layer "$WATER" wastewater_outfalls wastewater_outfalls.geojson 0 \
  "SELECT PERMITTEE AS permittee, PERMIT_NUM AS permit, OUTFALL AS outfall, STATUS AS status, DTYPE AS dtype, COUNTY AS county, SEGMENT AS segment, geom FROM wastewater_outfalls"
