#!/usr/bin/env bash
# make-geofences.sh — merge the city's neighborhood rows into one polygon per
# neighborhood name, for the chat map (owner, 2026-10-22: "merge by name, we
# don't want the area too small or too many polygons").
#
#   bash tools/make-geofences.sh        (from the repo root, in WSL)
#
# Reads chat/data/neighborhoods.geojson (the portal file, unchanged) and
# writes chat/data/geofences.geojson: one feature per planning_area_name,
# with `name` and a URL-safe `id`. Uses the GDAL that comes with QGIS
# (OSGeo4W on the Windows side), so it needs no install in WSL.
set -e
cd "$(dirname "$0")/.."
WIN_ROOT=$(wslpath -w "$PWD")
rm -f chat/data/geofences.geojson
/mnt/c/OSGeo4W/bin/ogr2ogr.exe -f GeoJSON \
  "$WIN_ROOT\\chat\\data\\geofences.geojson" \
  "$WIN_ROOT\\chat\\data\\neighborhoods.geojson" \
  -dialect sqlite \
  -sql "SELECT lower(replace(replace(replace(planning_area_name,' ','-'),'/','-'),'''','')) AS id, planning_area_name AS name, ST_Union(geometry) AS geometry FROM neighborhoods GROUP BY planning_area_name ORDER BY planning_area_name" \
  -lco COORDINATE_PRECISION=6
echo "wrote chat/data/geofences.geojson"
