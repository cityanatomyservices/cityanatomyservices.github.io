#!/usr/bin/env bash
# bake-ao.sh - bakes ambient occlusion into each model with Blender (headless)
# and leaves the result in C:\Dev\Austin_Models_Transfer_Batch\baked\, where
# prepare-glbs.sh picks it up in preference to the raw export.
#
#   bash tools/models/bake-ao.sh                 (every model, ~minutes each)
#   bash tools/models/bake-ao.sh convention-center.glb   (just one)
#
# Runs the Windows Blender 5.2 from WSL, so it hands Blender Windows paths.
# The bake itself is tools/models/bake-ao.py (read its header: per-vertex AO
# after splitting long edges). Two numbers per model: the longest edge left
# unsplit, in metres (smaller = finer shading, more vertices), and the Cycles
# samples. The sprawling models get coarser edges so they stay light.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLENDER="/mnt/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
BATCH_WIN='C:\Dev\Austin_Models_Transfer_Batch\unpacked'
BAKED=/mnt/c/Dev/Austin_Models_Transfer_Batch/baked
BAKED_WIN='C:\Dev\Austin_Models_Transfer_Batch\baked'
SCRIPT_WIN="$(wslpath -w "$HERE/bake-ao.py")"
mkdir -p "$BAKED"

# source inside the batch (Windows path, backslashes) -> name  edge_m  samples
MODELS=(
  'Austin_Drainage\Austin_Drainage\finished\drainage_model.glb                          drainage.glb                 12 24'
  'Austin_Convention_Center\Austin_Convention_Center\Models\convention_center_cesium.glb convention-center.glb         4 32'
  'I35_Northern_Stitches\I35_Northern_Stitches\Models\both_stitches.glb                  i35-stitches.glb              4 32'
  'I35_Northern_Stitches\I35_Northern_Stitches\Models\highway_context.glb                i35-highway-context.glb       8 24'
  'Lady_Bird_Lake_Light_Rail\Lady_Bird_Lake_Light_Rail\Models\all_infrastructure.glb     lady-bird-rail.glb            4 32'
  'Lady_Bird_Lake_Light_Rail\Lady_Bird_Lake_Light_Rail\Models\trains_and_activity.glb    lady-bird-trains.glb          4 24'
  'Lady_Bird_Lake_Light_Rail\Lady_Bird_Lake_Light_Rail\Models\shore_and_city_context.glb lady-bird-shore-context.glb   8 24'
  'AUS_Concourse_B\AUS_Concourse_B\Models\concourse_and_bridges.glb                      aus-concourse-b.glb           4 32'
  'AUS_Concourse_B\AUS_Concourse_B\Models\tunnel_cutaway.glb                             aus-tunnel.glb                4 24'
  'AUS_Concourse_B\AUS_Concourse_B\Models\apron_context.glb                              aus-apron-context.glb        12 16'
  'AUS_Concourse_B\AUS_Concourse_B\Models\aircraft_context.glb                           aus-aircraft-context.glb      4 24'
  'AUS_Concourse_B\AUS_Concourse_B\Models\existing_terminal_context.glb                  aus-terminal-context.glb      8 16'
)
# lady-bird-lake-surface.glb is a flat sheet: nothing to occlude, no bake.

only="${1:-}"
for entry in "${MODELS[@]}"; do
  read -r src name edge samples <<<"$entry"
  [ -n "$only" ] && [ "$only" != "$name" ] && continue
  echo "== $name (edges to $edge m, $samples samples)"
  "$BLENDER" -b --python "$SCRIPT_WIN" -- "$BATCH_WIN\\$src" "$BAKED_WIN\\$name" "$edge" "$samples" 2>&1 \
    | grep -E '^\[bake-ao\]|Error|Traceback|error' || true
  ls -l "$BAKED/$name" 2>/dev/null | awk '{print "   ->", $5, "bytes"}'
done
