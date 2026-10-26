#!/usr/bin/env bash
# prepare-glbs.sh - copies the chosen GLB exports out of the unpacked transfer
# batch, shrinks them, and drops them in models/data/ for the /models/ page.
#
#   bash tools/models/prepare-glbs.sh          (from anywhere)
#
# WHY: the Blender exports are plain, uncompressed glTF binaries (the drainage
# one is 17 MB). Two gltf-transform passes per file:
#   1. `optimize` with everything lossy switched off: it de-duplicates, flattens
#      and joins meshes (fewer draw calls) but keeps every vertex, every
#      material and its flat colour. Mesh simplification is off so nothing is
#      thrown away, and the material "palette" is off because merging the
#      colours into one tiny texture smeared them on the first try (2026-10-26:
#      the owner found the models "blurry and abstracted" next to Blender).
#   2. `draco` compression at 16-bit positions (the finest Draco allows; its
#      default 14 bits spaces vertices 0.4 m apart on the 6 km drainage model,
#      visibly lumpy). Draco is what makes the files small: 17 MB -> well under
#      1 MB. The page decodes it with the decoder that ships with three.js (see
#      models/js/model-layer.js). Textures are left alone: these models have
#      none, only flat colours.
# WHICH FILES: one main export per project plus the optional context layers
# the page offers as toggles. Never a combined export AND its split parts
# (both_stitches already contains 41st_stitch + red_line_stitch, and so on).
# Each project's zoom-in view of what the names mean is in its MODEL_NOTES.md.
#
# Needs `npm install` run once in tools/models/ (puts gltf-transform in
# tools/models/node_modules). Node comes from nvm in WSL.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
BATCH=/mnt/c/Dev/Austin_Models_Transfer_Batch/unpacked
# bake-ao.sh leaves a copy of each model with baked ambient occlusion here;
# when one exists it is used instead of the raw export
BAKED=/mnt/c/Dev/Austin_Models_Transfer_Batch/baked
OUT="$REPO/models/data"
GLTF="$HERE/node_modules/.bin/gltf-transform"

# shellcheck disable=SC1090
[ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh" >/dev/null
[ -x "$GLTF" ] || { echo "gltf-transform missing: run 'npm install' in $HERE first"; exit 1; }
mkdir -p "$OUT"

# source path inside the batch  ->  name in models/data/
FILES=(
  "Austin_Drainage/Austin_Drainage/finished/drainage_model.glb                         drainage.glb"
  "Austin_Convention_Center/Austin_Convention_Center/Models/convention_center_cesium.glb convention-center.glb"
  "I35_Northern_Stitches/I35_Northern_Stitches/Models/both_stitches.glb                  i35-stitches.glb"
  "I35_Northern_Stitches/I35_Northern_Stitches/Models/highway_context.glb                i35-highway-context.glb"
  "Lady_Bird_Lake_Light_Rail/Lady_Bird_Lake_Light_Rail/Models/all_infrastructure.glb     lady-bird-rail.glb"
  "Lady_Bird_Lake_Light_Rail/Lady_Bird_Lake_Light_Rail/Models/lake_surface.glb           lady-bird-lake-surface.glb"
  "Lady_Bird_Lake_Light_Rail/Lady_Bird_Lake_Light_Rail/Models/trains_and_activity.glb    lady-bird-trains.glb"
  "Lady_Bird_Lake_Light_Rail/Lady_Bird_Lake_Light_Rail/Models/shore_and_city_context.glb lady-bird-shore-context.glb"
  "AUS_Concourse_B/AUS_Concourse_B/Models/concourse_and_bridges.glb                      aus-concourse-b.glb"
  "AUS_Concourse_B/AUS_Concourse_B/Models/tunnel_cutaway.glb                             aus-tunnel.glb"
  "AUS_Concourse_B/AUS_Concourse_B/Models/apron_context.glb                              aus-apron-context.glb"
  "AUS_Concourse_B/AUS_Concourse_B/Models/aircraft_context.glb                           aus-aircraft-context.glb"
  "AUS_Concourse_B/AUS_Concourse_B/Models/existing_terminal_context.glb                  aus-terminal-context.glb"
)

printf '%-32s %-6s %10s %10s\n' file from before after
for entry in "${FILES[@]}"; do
  read -r src name <<<"$entry"
  in="$BATCH/$src"; from=raw
  if [ -f "$BAKED/$name" ]; then in="$BAKED/$name"; from=baked; fi
  "$GLTF" optimize "$in" "$OUT/$name" --compress false --palette false --simplify false --texture-compress false >/dev/null
  "$GLTF" draco "$OUT/$name" "$OUT/$name" --quantize-position 16 --quantize-normal 10 --quantize-texcoord 12 >/dev/null
  printf '%-32s %-6s %10s %10s\n' "$name" "$from" "$(stat -c %s "$in")" "$(stat -c %s "$OUT/$name")"
done
echo
du -sh "$OUT"
