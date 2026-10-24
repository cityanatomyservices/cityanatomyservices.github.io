#!/usr/bin/env bash
# story-composite.sh — the finished 9:16 video from a take and the narration.
#
#   tools/story-composite.sh austin-pizza "/mnt/c/Dev/map-exports/austin-pizza/2026-10-24 12-00-00.mp4"
#
# What it does, in order:
#   1. finds where the white curtain drops in the take (the first beat) and
#      trims to it, for the story's total length (the holds in story.js);
#   2. lays the narration clips at their beats: one clip per beat at
#      C:\Dev\map-exports\<app>\narration\beat-01.mp3, beat-02.mp3 ... (a
#      missing clip is silence); a clip longer than its beat is reported;
#   3. writes C:\Dev\map-exports\<app>\<app>-short-narrated.mp4.
# Needs ffmpeg (the Windows winget build, or one on the PATH) and node (to
# read story.js). Nothing is written into the repo.
set -euo pipefail
APP="${1:?app id}"; TAKE="${2:?take .mp4}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
FF="/mnt/c/Users/clero/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe"; [ -x "$FF" ] || FF=ffmpeg
FP="${FF%ffmpeg.exe}ffprobe.exe"; [ -x "$FP" ] || FP=ffprobe
OUTDIR="/mnt/c/Dev/map-exports/$APP"; NARR="$OUTDIR/narration"; OUT="$OUTDIR/$APP-short-narrated.mp4"
STORY="$HERE/apps/$APP/story.js"

# the beats' start times and holds, from story.js
read -r TOTAL STARTS < <(node -e "
  const w = {}; new Function('window', require('fs').readFileSync('$STORY', 'utf8'))(w);
  let t = 0; const starts = w.SHOP_STORY.beats.map((b) => { const s = t; t += b.hold; return s; });
  console.log(t, starts.join(','));")
IFS=, read -ra START <<< "$STARTS"

# 1. where the curtain drops: the first stretch of (near) white ends
WIN_TAKE="$TAKE"; case "$FF" in *.exe) WIN_TAKE="$(wslpath -w "$TAKE")";; esac
CURTAIN_END=$("$FF" -i "$WIN_TAKE" -vf "negate,blackdetect=d=0.3:pix_th=0.03" -an -f null - 2>&1 | grep -o 'black_end:[0-9.]*' | head -1 | cut -d: -f2)
[ -n "$CURTAIN_END" ] || { echo "no white curtain found in the take — was it recorded with ?play?"; exit 1; }
echo "curtain drops at ${CURTAIN_END}s; story is ${TOTAL}s"

# 2. the narration clips at their beats
INPUTS=(-ss "$CURTAIN_END" -t "$TOTAL" -i "$WIN_TAKE"); MIX=""; N=0
for i in "${!START[@]}"; do
  CLIP=$(printf "%s/beat-%02d.mp3" "$NARR" $((i + 1)))
  [ -f "$CLIP" ] || { echo "beat $((i + 1)): no clip ($CLIP), silence"; continue; }
  WIN_CLIP="$CLIP"; case "$FF" in *.exe) WIN_CLIP="$(wslpath -w "$CLIP")";; esac
  DUR=$("$FP" -v error -show_entries format=duration -of csv=p=0 "$WIN_CLIP")
  NEXT=${START[$((i + 1))]:-$TOTAL}; HOLD=$(echo "$NEXT - ${START[$i]}" | bc)
  if (( $(echo "$DUR > $HOLD" | bc) )); then echo "beat $((i + 1)): clip ${DUR}s is LONGER than its ${HOLD}s beat — shorten the line"; fi
  INPUTS+=(-i "$WIN_CLIP"); N=$((N + 1))
  MS=$(printf "%.0f" "$(echo "${START[$i]} * 1000" | bc)")
  MIX+="[$N:a]adelay=${MS}|${MS}[a$N];"
done
if [ "$N" -gt 0 ]; then
  TAGS=""; for k in $(seq 1 $N); do TAGS+="[a$k]"; done
  FILTER="${MIX}${TAGS}amix=inputs=$N:normalize=0,apad[au]"
else
  FILTER="anullsrc=r=48000:cl=stereo[au]"
fi

# 3. the video
WIN_OUT="$OUT"; case "$FF" in *.exe) WIN_OUT="$(wslpath -w "$OUT")";; esac
"$FF" -y "${INPUTS[@]}" -filter_complex "$FILTER" -map 0:v -map "[au]" -t "$TOTAL" \
  -r 30 -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k "$WIN_OUT"
echo "wrote $OUT"
