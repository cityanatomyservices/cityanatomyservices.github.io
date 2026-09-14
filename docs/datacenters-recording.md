# Recording the data centers timeline as a 9:16 video

Set up 2026-09-14. The page runs its own sequence, so the recording is:
point OBS at it, wait about 100 seconds, stop. No mouse, no clicks.

## Why a browser source, not a kiosk window

The landscape display is 1920x1080, so no Chrome window can be 1080x1920
(Windows clamps it to the screen). OBS's own **Browser Source** renders the
page at any size you give it, so the page is drawn at a true 1080x1920 with
WebGL, no browser window on screen at all.

## What is set in OBS (not in git; `C:\Dev\tools\obs-control\obs.js` drives it)

- Profile **`wcibh-phone`**: canvas and output 1080x1920, 30 fps.
- Scene **`Site portrait`** with one source, **`Site page`**, a browser source:
  URL `https://anatomy.city/datacenters/?play&phone`, 1080x1920, 30 fps, "shutdown
  when not visible" and "refresh when scene becomes active" on.
- Record folder `C:\Dev\map-exports\datacenters`.

Two address switches are features of the shared engine (`/topicmap/app.js`
and `/topicmap/player.js`, since the 2026-09-14 lift), and the URL in the
browser source uses both: `?play&phone`.

- `?play` removes the intro card and starts the timeline a moment after
  load (`playDelay` in the page's `map.js`), so nobody has to click Play.
- `?phone` makes the page draw the way a phone draws it, whatever the window
  size. Without it a 1080x1920 recording lays out as a 1080 px wide desktop
  page: tiny type, tiny dots, unreadable on a phone. With it the page is
  zoomed so it lays out 393 CSS px wide (a phone), the map draws at the
  matching pixel density (MapLibre `pixelRatio`), and the phone layout
  rules kick in. Compared frame by frame against a real phone emulation
  (393x699 at 2.75x) the two are identical.

## The process for the next topic map (budget, AISD, whatever comes)

Since the engine lift (2026-09-14) every page built on `/topicmap/` has
these three things already; the list stays here as the explanation of
what they are and why. The short order of work is `docs/new-map-checklist.md`.

1. **Container queries, not media queries.** `.page { container: page / size; }`
   and every `@media (max-width: 640px)` becomes `@container page (max-width:
   640px)`. Media queries ignore CSS zoom; container queries follow the page's
   own size, which is what `?phone` changes.
2. **The `?phone` block at the top of `topicmap/app.js`**: read the switch, set
   `document.documentElement.style.zoom = innerWidth / 393`, size `.page` to
   393 x (innerHeight / zoom) by hand (viewport units ignore zoom), and pass
   `pixelRatio: zoom` to the MapLibre map.
3. **A `?play` switch** in whatever runs the page's sequence, and phone-layout
   rules that keep story text at the bottom and panels at the top.

Then in OBS: browser source at 1080x1920 pointing at `<page>?play&phone`,
profile `wcibh-phone`, record for the sequence length plus a few seconds.

## The take

From WSL, in `C:\Dev\tools\obs-control`:

    node obs.js req GetVideoSettings          # must say 1080x1920 (profile wcibh-phone)
    node obs.js recdir 'C:\Dev\map-exports\datacenters'
    node obs.js setscene 'Site portrait'
    # optional: check the picture without looking at the screen
    node obs.js req GetSourceScreenshot '{"sourceName":"Site page","imageFormat":"png","imageWidth":540,"imageHeight":960}'
    node obs.js req PressInputPropertiesButton '{"inputName":"Site page","propertyName":"refreshnocache"}'
    node obs.js startrec
    # 4 s intro + 6 reveals x 5 s + 4 text cards x 15 s = 94 s; record ~108 s
    node obs.js stoprec

The file lands in the record folder named by date and time. Takes of
2026-09-14: `02-03-33` (desktop layout, rejected as unreadable), `02-28-45`
(first `?phone` take), `02-37-04` (final, site list under the panel bars).
Silent; music goes on afterwards.

## Traps

- The first seconds show tiles loading and the intro card; trim them.
- If the picture is blank in the screenshot, hardware acceleration for
  browser sources is off (OBS Settings > Advanced) — MapLibre needs WebGL.
- Changing the page's `?v=` versions does not matter here: the browser
  source loads the live HTML fresh on refresh. Wait for the Pages deploy
  before a take if the page was just pushed.

## Adding the narrator (done 2026-09-14)

The narrator is `C:\Dev\DataCenters\datacenter_animation.mp4`: a 1080x1080
emoji face on a plain white background, with the narration as its audio track,
1:46 long. It sits in the bottom-left corner above the timeline bar, 300 px
wide, from second 2 to the end, with its audio. The take's own length wins.

**The text card covers it.** The card is baked into the take, so the face
cannot go "under" it after the fact. Instead the face keeps playing but only
its chin (the 60 px below the card's bottom edge at y 1750) is drawn while
the card is up. The card's window was measured from the take itself: the
strip of card margin at x 26-52, y 1500-1700 goes from map brightness (~216)
to paper (~232) at 34.25 s and back at 94.5 s. Re-measure for a new take
with the `signalstats` line below, and change the two `between()` times.

Keying the white out by colour alone would also cut the white teeth, so the
alpha is the colour key OR a circle 200 px around the face's centre: white
outside the face goes, white inside the face stays. The face's box was
measured with `cropdetect` on a negated copy (x 245-742, y 322-783 over the
whole clip; centre 493,552). If a new animation is framed differently,
re-measure and change the `crop` and the `hypot` centre.

    FF=/mnt/c/Users/clero/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe
    # when is the bottom card up? prints brightness of the card's margin strip 4x a second
    "$FF" -i "<take>.mp4" -vf "fps=4,crop=26:200:26:1500,signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1 | grep -E "pts_time|YAVG"
    FONT="C\\:/Windows/Fonts/segoeui.ttf"; FONTB="C\\:/Windows/Fonts/segoeuib.ttf"; SHOW="gte(t,107)"
    "$FF" -y -i "<take>.mp4" -i "C:\Dev\DataCenters\datacenter_animation.mp4" -filter_complex "
    [0:v]tpad=stop_mode=clone:stop_duration=4[base];
    [1:v]crop=524:488:233:310,format=rgba,colorkey=0xffffff:0.12:0.08,split[k][k2];
    [k2]alphaextract[ka];
    color=c=black:s=524x488:r=30,format=gray,geq=lum='if(lt(hypot(X-260,Y-242),200),255,0)'[circ];
    [ka][circ]blend=all_mode=lighten:shortest=1[a];
    [k][a]alphamerge,scale=300:-1,tpad=start_duration=2:color=0x00000000:stop_mode=clone:stop_duration=6,split[full][part];
    [part]crop=300:60:0:240[chin];
    [base][full]overlay=16:1510:eof_action=pass:format=auto:enable='not(between(t,34.25,94.5))'[v1];
    [v1][chin]overlay=16:1750:eof_action=pass:format=auto:enable='between(t,34.25,94.5)'[v2];
    [v2]drawbox=x=(iw-820)/2:y=(ih-360)/2:w=820:h=360:color=white@0.94:t=fill:enable='$SHOW',
    drawtext=fontfile='$FONTB':text='Navigate map':fontsize=64:fontcolor=0x1f2933:x=(w-text_w)/2:y=(h-360)/2+52:enable='$SHOW',
    drawtext=fontfile='$FONT':text='and sources at':fontsize=56:fontcolor=0x1f2933:x=(w-text_w)/2:y=(h-360)/2+152:enable='$SHOW',
    drawtext=fontfile='$FONTB':text='anatomy.city/datacenters':fontsize=56:fontcolor=0x7b3294:x=(w-text_w)/2:y=(h-360)/2+248:enable='$SHOW'[v];
    [1:a]adelay=2000|2000,apad[au]" -map "[v]" -map "[au]" -r 30 -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "<out>.mp4"

What the extra pieces do: the take's last frame is held 4 s (`tpad` on
`[0:v]`) so the narration, which ends at 108.2 s, finishes with picture
under it; the face is held too (`stop_mode=clone` on the overlay) so it
does not vanish before the end; `apad` + `-shortest` make the audio run to
the video's length. The end card (`drawbox` + three `drawtext` lines,
Segoe UI from `C:\Windows\Fonts`) is centred and shows from 107 s, the
last second of the map, to the end. Its three lines are the owner's words
verbatim; to change them edit the three `text=` values.

Output of the night: `C:\Dev\map-exports\datacenters\datacenters-short-narrated.mp4`
(1080x1920, 30 fps, 1:52, narration audio, end card). First cut had the face top-left;
the owner moved it bottom-left the same night. The animation has a few small
yellow flecks that drift below the face at times; they are in the source.
