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

Two address switches are page features (see `datacenters/app.js` and
`player.js`), and the URL in the browser source uses both: `?play&phone`.

- `?play` removes the intro card and starts the timeline 4 s after load, so
  nobody has to click Play.
- `?phone` makes the page draw the way a phone draws it, whatever the window
  size. Without it a 1080x1920 recording lays out as a 1080 px wide desktop
  page: tiny type, tiny dots, unreadable on a phone. With it the page is
  zoomed so it lays out 393 CSS px wide (a phone), the map draws at the
  matching pixel density (MapLibre `pixelRatio`), and the phone layout
  rules kick in. Compared frame by frame against a real phone emulation
  (393x699 at 2.75x) the two are identical.

## The process for the next topic map (budget, AISD, whatever comes)

Copy these three things into the new page and the recording is the same
five commands as below:

1. **Container queries, not media queries.** `.page { container: page / size; }`
   and every `@media (max-width: 640px)` becomes `@container page (max-width:
   640px)`. Media queries ignore CSS zoom; container queries follow the page's
   own size, which is what `?phone` changes.
2. **The `?phone` block at the top of app.js**: read the switch, set
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
