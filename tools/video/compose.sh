#!/usr/bin/env bash
# compose.sh — the finished 9:16 video from the cards and the narration clips.
#
#   tools/video/compose.sh austin-pizza
#
# In C:\Dev\map-exports\<id>\story\: card-NN.png (render-cards.js) and, once
# the voice exists, narration\beat-NN.mp3 (one clip per beat, ElevenLabs).
# Each card stays up for its beat's hold or its clip's length plus a short
# breath, whichever is longer, so no line is cut off. Writes
# C:\Dev\map-exports\<id>\<id>-short.mp4 (silent while there are no clips)
# and prints when each card starts. Needs ffmpeg (the Windows winget build,
# or one on the PATH) and node (to read beats.json).
set -euo pipefail
APP="${1:?app id}"
FF="/mnt/c/Users/clero/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe"; [ -x "$FF" ] || FF=ffmpeg
FP="${FF%ffmpeg.exe}ffprobe.exe"; [ -x "$FP" ] || FP=ffprobe
DIR="/mnt/c/Dev/map-exports/$APP/story"; OUT="/mnt/c/Dev/map-exports/$APP/$APP-short.mp4"
BREATH=0.6                                   # seconds of quiet after a clip before the next card
win() { case "$FF" in *.exe) wslpath -w "$1";; *) echo "$1";; esac; }

mapfile -t HOLDS < <(node -e "JSON.parse(require('fs').readFileSync('$DIR/beats.json','utf8')).beats.forEach(b=>console.log(b.hold))")
N=${#HOLDS[@]}
CARDS=(); CLIPS=(); VCHAIN=""; ACHAIN=""; T=0; K=0
for ((i = 0; i < N; i++)); do
  NN=$(printf "%02d" $((i + 1))); CARD="$DIR/card-$NN.png"; CLIP="$DIR/narration/beat-$NN.mp3"
  [ -f "$CARD" ] || { echo "missing $CARD — run render-cards.js first"; exit 1; }
  DUR=${HOLDS[$i]}; HAS=""
  if [ -f "$CLIP" ]; then
    HAS="yes"; K=$((K + 1))
    LEN=$("$FP" -v error -show_entries format=duration -of csv=p=0 "$(win "$CLIP")")
    NEED=$(echo "$LEN + $BREATH" | bc)
    if (( $(echo "$NEED > $DUR" | bc) )); then DUR=$NEED; fi
    MS=$(printf "%.0f" "$(echo "$T * 1000" | bc)")
    CLIPS+=(-i "$(win "$CLIP")")
    ACHAIN+="[$((N + K - 1)):a]adelay=${MS}|${MS}[a$K];"      # clip inputs follow the N card inputs
  fi
  printf "card %s starts at %6.2f s, holds %5.2f s%s\n" "$NN" "$T" "$DUR" "${HAS:+}${HAS:-  (no clip)}"
  CARDS+=(-loop 1 -t "$DUR" -i "$(win "$CARD")")
  VCHAIN+="[$i:v]"
  T=$(echo "$T + $DUR" | bc)
done
FILTER="${VCHAIN}concat=n=$N:v=1:a=0,format=yuv420p[v]"
if [ "$K" -gt 0 ]; then
  TAGS=""; for k in $(seq 1 $K); do TAGS+="[a$k]"; done
  FILTER+=";${ACHAIN}${TAGS}amix=inputs=$K:normalize=0,apad[au]"
  "$FF" -y -loglevel error "${CARDS[@]}" "${CLIPS[@]}" -filter_complex "$FILTER" -map "[v]" -map "[au]" -t "$T" -r 30 -c:v libx264 -crf 18 -c:a aac -b:a 192k "$(win "$OUT")"
else
  "$FF" -y -loglevel error "${CARDS[@]}" -filter_complex "$FILTER" -map "[v]" -t "$T" -r 30 -c:v libx264 -crf 18 "$(win "$OUT")"
fi
echo "wrote $OUT ($T s, $K narration clips)"
