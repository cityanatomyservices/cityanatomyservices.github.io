#!/usr/bin/env bash
# story-take.sh — record a shopping app's story (?play&phone) with OBS.
#
#   tools/story-take.sh austin-pizza 75
#
# OBS must be open on Windows with the `wcibh-phone` profile (1080x1920) and
# the `Site portrait` scene with its `Site page` browser source (the setup
# from docs/new-map-checklist.md). The take lands in
# C:\Dev\map-exports\<app>\ as OBS names it (date and time). The second
# argument is how long to record: the story's length plus about 15 s for
# the tiles and the curtain. Then run tools/story-composite.sh on the take.
set -euo pipefail
APP="${1:?app id}"; SECONDS_TO_RECORD="${2:?seconds to record}"
OBS="node /mnt/c/Dev/tools/obs-control/obs.js"
URL="https://austin.chat/apps/$APP/?play&phone"
$OBS req GetVideoSettings | grep -q '"baseWidth": *1080' || { echo "OBS canvas is not 1080 wide — switch to the wcibh-phone profile first"; exit 1; }
$OBS recdir "C:\\Dev\\map-exports\\$APP"
$OBS req SetInputSettings "{\"inputName\":\"Site page\",\"inputSettings\":{\"url\":\"$URL\"}}"
$OBS setscene 'Site portrait'
$OBS req PressInputPropertiesButton '{"inputName":"Site page","propertyName":"refreshnocache"}'
$OBS startrec
echo "recording $URL for $SECONDS_TO_RECORD s"
sleep "$SECONDS_TO_RECORD"
$OBS stoprec
ls -t "/mnt/c/Dev/map-exports/$APP"/*.mp4 | head -1
