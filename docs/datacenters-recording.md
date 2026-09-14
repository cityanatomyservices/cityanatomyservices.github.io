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
  URL `https://anatomy.city/datacenters/?play`, 1080x1920, 30 fps, "shutdown
  when not visible" and "refresh when scene becomes active" on.
- Record folder `C:\Dev\map-exports\datacenters`.

`?play` is a page feature: it removes the intro card and starts the timeline
4 s after load, so nobody has to click Play (see `datacenters/player.js`).

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

The file lands in the record folder named by date and time. First take:
`2026-09-14 02-03-33.mp4`. Silent; music goes on afterwards.

## Traps

- The first seconds show tiles loading and the intro card; trim them.
- If the picture is blank in the screenshot, hardware acceleration for
  browser sources is off (OBS Settings > Advanced) — MapLibre needs WebGL.
- Changing the page's `?v=` versions does not matter here: the browser
  source loads the live HTML fresh on refresh. Wait for the Pages deploy
  before a take if the page was just pushed.
