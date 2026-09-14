# New topic map, start to narrated video: the checklist

The formula (2026-09-14) done twice, `/datacenters/` and `/AISD/`. This
page is the order of work for the third map and every one after. The long
explanations and the reasons behind each step are in
`docs/datacenters-recording.md`; this file is just what to do and what to
fill in. Nothing here is copy: the owner writes or approves every word that
reaches the screen or the narration.

## 0. Before starting

- Research note with every source link in the private `atxmapdata/qgis-lab`
  repo (`notes/<topic>.md`); the layers in `C:\GISData` (never in this repo).
- Two agents at most for the research (owner's cap).
- Pull this repo first: the owner also pushes from another laptop.

## 1. The page (about an hour)

The engine is shared: `/topicmap/app.js`, `/topicmap/player.js`,
`/topicmap/style.css`. A page folder holds only what is its own.

    /<topic>/
      index.html    copy of /AISD/index.html; change <title> and the comment
      style.css     two lines: the page's own --accent colour
      config.js     window.MAP_CONFIG: the data files and how they draw
      copy.js       window.MAP_COPY: every word on screen (mark drafts)
      map.js        window.MAP_PAGE: popup, timeline steps, camera moves
      data/         small GeoJSON exports; city_limits and council_districts
                    copied from /AISD/data/

Fill in, in this order:

1. **`data/`.** Export the points file and any overlays from the GIS
   library (`ogr2ogr -f GeoJSON ... -t_srs EPSG:4326`). The points need a
   `name` property and one **category** property (the colour and the legend
   row: `status`, `role`, whatever the topic calls it).
2. **`config.js`.** `points`, `categoryField`, `categories` (key → colour, in
   legend and reveal order), `pointRadius` (a number, or
   `[field, v, px, v, px...]`), `pointLabel` (`field`, `size`, `below`,
   `overlap`), `overlays` and `groups`, `fitPadding`, `cagePad`, `minZoom`.
   `colorBy: 'category'` on an overlay tints it by the same field as the
   dots. `timeline` (a JSON of `{ date, event }`) if About should list dates.
3. **`copy.js`.** `pageTitle`, `intro`, `legendTitle`, `legendSub`,
   `category` (key → label), `overlays`, `overlayGroup`, `overlay`,
   `fields`, `popup`, `ui`, `about`, `attribution`, and in `player` the
   button words plus one title and one `...Text` paragraph per story card.
   Draft paragraphs from the research note: 55 to 70 words each, marked
   DRAFT in a comment.
4. **`map.js`.** `column(properties)` for the site list's first column;
   `popupHtml(p, helpers)` for the dot popup; `steps(helpers)` for the
   sequence; `frame(step, map, helpers)` for the camera; `playDelay`.
   Start from `/AISD/map.js` (legend beat, `only`, per-step re-framing).
5. **The sequence.** The pacing that works: reveals 5 s each, story cards
   15 s each, whole thing about 2:00. A legend beat of 3 s first if the
   legend needs reading. Count it: `legend + reveals x 5 + cards x 15`.
6. **Home page card.** Add the page to the Apps chip in `home.json`.
7. **Check headless** (no console errors, every file 200, cards and layers
   switch step by step), then push and tell the owner to open the live
   page on a phone and click a dot. Wait for the Pages deploy before
   fetching any new `?v=` address.

The owner reviews the page and the draft paragraphs before any take.

## 2. The take (ten minutes)

OBS profile `wcibh-phone` (1080x1920, 30 fps), scene `Site portrait`,
browser source `Site page`. From WSL in `C:\Dev\tools\obs-control`:

    node obs.js req GetVideoSettings                       # must say 1080x1920
    node obs.js recdir 'C:\Dev\map-exports\<topic>'
    node obs.js req SetInputSettings '{"inputName":"Site page","inputSettings":{"url":"https://anatomy.city/<topic>/?play&phone"}}'   # not yet tried; or edit the URL in the source's properties by hand
    node obs.js setscene 'Site portrait'
    node obs.js req PressInputPropertiesButton '{"inputName":"Site page","propertyName":"refreshnocache"}'
    node obs.js startrec
    # wait the sequence length plus about 10 s
    node obs.js stoprec

Trim the take to the length the owner wants, from where the sequence
starts (the tiles need a moment; the legend beat covers it):

    FF=/mnt/c/Users/clero/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe
    "$FF" -y -ss <start> -i "<take>.mp4" -t <length> -c:v libx264 -crf 18 -an "<topic>-take-<length>s.mp4"

Never record a desktop layout at 1080 wide; `?phone` is what makes the
take readable. The owner reviews the silent take before narration.

## 3. The narration (the owner's)

Draft `docs/<topic>-narration.md`: a table of time range, what is on
screen, one line of narration per step. Under 220 words for a 2:00 take
(5-second lines 6 to 13 words, 15-second lines 27 to 40). Facts only from
the research note; list the claims to double-check at the bottom. The owner
edits, records the voice and makes the emoji narrator animation (a square
face on plain white with the narration as its audio track). It arrives as
`C:\Dev\map-exports\<topic>\<animation>.mp4`.

## 4. The composite (twenty minutes)

Measure four things, fill in the variables, run one command.

**a. The face's box** in the animation (white outside it is keyed away, the
circle mask keeps the white teeth inside it):

    "$FF" -i "<animation>.mp4" -vf "negate,cropdetect=limit=24:round=2:reset=0" -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -1

Gives `crop=W:H:X:Y`. Widen it a little (about 20 px each side) so the
edges of the face are inside the crop; the circle mask is centred in it.
Data centers: `524:488:233:310`; AISD: `486:482:269:314`.

**b. When the bottom text card is up** in the take (the face shows only
its chin while the card covers it):

    "$FF" -i "<take>.mp4" -vf "fps=4,crop=26:200:26:1500,signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1 | grep -E "pts_time|YAVG"

Brightness jumps from the map (about 216) to paper (about 232) when the
card appears and drops when it goes: `CARD_ON` and `CARD_OFF` in seconds.
Data centers: 34.25 to 94.5; AISD: 37.25 to 112.25. If the story is
several cards with gaps, use one `between()` per window.

**c. The end**: the narration's length (`ffprobe`), plus 2 s of delay, is
when the audio ends. `HOLD` = how many seconds to freeze the take's last
frame so the picture outlasts the audio (0 if the take is already longer).
`END` = when the end card appears: the last second of the map before the
hold. Data centers: HOLD 4, END 107 on a 108 s take; AISD: HOLD 0, END 113
on a 119 s take.

**d. The end card's three lines**: the owner's words, verbatim
("Navigate map" / "and sources at" / "anatomy.city/<topic>").

Then:

    FF=/mnt/c/Users/clero/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe
    FONT="C\\:/Windows/Fonts/segoeui.ttf"; FONTB="C\\:/Windows/Fonts/segoeuib.ttf"
    TAKE="<take>.mp4"; FACE="<animation>.mp4"; OUT="<topic>-short-narrated.mp4"
    CW=524; CH=488; CX=233; CY=310                  # a. the face: crop W:H:X:Y
    CARD_ON=34.25; CARD_OFF=94.5                    # b. the text card
    HOLD=4; END=107                                 # c. the end
    L1="Navigate map"; L2="and sources at"; L3="anatomy.city/<topic>"   # d. the card
    "$FF" -y -i "$TAKE" -i "$FACE" -filter_complex "
    [0:v]tpad=stop_mode=clone:stop_duration=$HOLD[base];
    [1:v]crop=$CW:$CH:$CX:$CY,format=rgba,colorkey=0xffffff:0.12:0.08,split[k][k2];
    [k2]alphaextract[ka];
    color=c=black:s=${CW}x${CH}:r=30,format=gray,geq=lum='if(lt(hypot(X-$CW/2,Y-$CH/2),200),255,0)'[circ];
    [ka][circ]blend=all_mode=lighten:shortest=1[a];
    [k][a]alphamerge,scale=300:-1,tpad=start_duration=2:color=0x00000000:stop_mode=clone:stop_duration=6,split[full][part];
    [part]crop=300:60:0:240[chin];
    [base][full]overlay=16:1510:eof_action=pass:format=auto:enable='not(between(t,$CARD_ON,$CARD_OFF))'[v1];
    [v1][chin]overlay=16:1750:eof_action=pass:format=auto:enable='between(t,$CARD_ON,$CARD_OFF)'[v2];
    [v2]drawbox=x=(iw-820)/2:y=(ih-360)/2:w=820:h=360:color=white@0.94:t=fill:enable='gte(t,$END)',
    drawtext=fontfile='$FONTB':text='$L1':fontsize=64:fontcolor=0x1f2933:x=(w-text_w)/2:y=(h-360)/2+52:enable='gte(t,$END)',
    drawtext=fontfile='$FONT':text='$L2':fontsize=56:fontcolor=0x1f2933:x=(w-text_w)/2:y=(h-360)/2+152:enable='gte(t,$END)',
    drawtext=fontfile='$FONTB':text='$L3':fontsize=56:fontcolor=0x7b3294:x=(w-text_w)/2:y=(h-360)/2+248:enable='gte(t,$END)'[v];
    [1:a]adelay=2000|2000,apad[au]" -map "[v]" -map "[au]" -r 30 -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "$OUT"

The face sits bottom-left at 300 px wide from second 2, above the timeline
bar; the third line of the end card is in the data centers purple
(`0x7b3294`), change `fontcolor` to the page's accent if wanted. Output
goes to `C:\Dev\map-exports\<topic>\`, never into a repo. Check the result
once by eye at the card-on, card-off and end-card moments, then hand it
to the owner.

## 4b. The desktop cut (16:9, for Substack and YouTube)

Added 2026-09-14 for the AISD map. The same page, sequence and narration;
what differs is the layout and the face's spot.

- **The map.** On a desktop-width layout the engine keeps the Layers box
  and the legend open through the whole sequence (the `cards` keys in
  map.js act on phones only), and the story card sits top-centre, the
  site list top-right, so the left column is always the two panels.
- **The address.** `<page>?play&width=1280`: the page lays out at
  1280x720 CSS px and is scaled by 1.5 into a 1920x1080 frame, so type and
  dots read at video size (`topicmap/phone.js`, the same mechanism as
  `?phone`). Never record the bare desktop page at 1920 wide.
- **The take.** OBS is still on profile `wcibh-phone`; switch the canvas
  for the take and back afterwards:

      node obs.js req SetVideoSettings '{"baseWidth":1920,"baseHeight":1080,"outputWidth":1920,"outputHeight":1080}'
      node obs.js recdir 'C:\Dev\map-exports\<topic>'
      node obs.js req SetInputSettings '{"inputName":"Site page wide","inputSettings":{"url":"https://anatomy.city/<topic>/?play&width=1280","width":1920,"height":1080}}'
      node obs.js setscene 'Site landscape'
      node obs.js req PressInputPropertiesButton '{"inputName":"Site page wide","propertyName":"refreshnocache"}'
      node obs.js startrec
      # wait the sequence length plus about 10 s
      node obs.js stoprec
      node obs.js req SetVideoSettings '{"baseWidth":1080,"baseHeight":1920,"outputWidth":1080,"outputHeight":1920}'

  Scene `Site landscape` holds one browser source, `Site page wide`, at
  1920x1080 (created 2026-09-14 with `CreateScene` / `CreateInput`,
  `inputKind` `browser_source`). **Trap:** a source created while the
  canvas is 1080x1920 is scaled down to fit that canvas, and the scale
  stays after the canvas is switched, so the take shows the page at half
  size in the top-left corner. Before recording, check with
  `GetSceneItemTransform` that `scaleX`/`scaleY` are 1 and `width` is
  1920; if not, `SetSceneItemTransform` with `scaleX:1, scaleY:1,
  positionX:0, positionY:0, boundsType:"OBS_BOUNDS_NONE"`. Then a
  `GetSourceScreenshot` of the scene (not the input) shows the actual
  frame. Trim the take the same way as the phone take, to the same length,
  so the narration timings carry over (find where the school list appears
  from a contact sheet of the first frames; it was 3.0 s here).
- **The composite.** Same command as section 4 with these differences: no
  chin trick (nothing covers the bottom-left corner on a desktop), the face
  scaled to 260 wide so it fits between the legend's bottom edge and the
  timeline bar, placed at `overlay=16:752`; the end card is the same box,
  centred. AISD: same face crop `486:482:269:314`, HOLD 0, END 114 (the
  desktop take ran a second later than the phone one; measure the last
  card's exit with the `signalstats` line on a strip inside the top-centre
  card, e.g. `crop=200:40:600:100`).

      "$FF" -y -i "$TAKE" -i "$FACE" -filter_complex "
      [0:v]tpad=stop_mode=clone:stop_duration=$HOLD[base];
      [1:v]crop=$CW:$CH:$CX:$CY,format=rgba,colorkey=0xffffff:0.12:0.08,split[k][k2];
      [k2]alphaextract[ka];
      color=c=black:s=${CW}x${CH}:r=30,format=gray,geq=lum='if(lt(hypot(X-$CW/2,Y-$CH/2),200),255,0)'[circ];
      [ka][circ]blend=all_mode=lighten:shortest=1[a];
      [k][a]alphamerge,scale=260:-1,tpad=start_duration=2:color=0x00000000:stop_mode=clone:stop_duration=6[face];
      [base][face]overlay=16:752:eof_action=pass:format=auto[v2];
      [v2]drawbox=x=(iw-820)/2:y=(ih-360)/2:w=820:h=360:color=white@0.94:t=fill:enable='gte(t,$END)',
      drawtext=fontfile='$FONTB':text='$L1':fontsize=64:fontcolor=0x1f2933:x=(w-text_w)/2:y=(h-360)/2+52:enable='gte(t,$END)',
      drawtext=fontfile='$FONT':text='$L2':fontsize=56:fontcolor=0x1f2933:x=(w-text_w)/2:y=(h-360)/2+152:enable='gte(t,$END)',
      drawtext=fontfile='$FONTB':text='$L3':fontsize=56:fontcolor=0x7b3294:x=(w-text_w)/2:y=(h-360)/2+248:enable='gte(t,$END)'[v];
      [1:a]adelay=2000|2000,apad[au]" -map "[v]" -map "[au]" -r 30 -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "<topic>-wide-narrated.mp4"

## 5. Close out

- `docs/STATUS.md`: the take names, the measured numbers, the output path.
- Commit and push (`main`), and bump the `?v=` on any page file that changed.
