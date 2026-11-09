# Austin Watercolor tiles

Original Stamen Watercolor artwork, created in 2012–2014, downloaded from the
[Cooper Hewitt, Smithsonian archive](https://watercolormaps.collection.cooperhewitt.org/)
on November 9, 2026. The archive explicitly permits using these tiles in other
mapping applications. This is a bounded Austin copy, not a new rendering of
current geographic data. JPEG bytes are unmodified.

Map tiles by [Stamen Design](https://stamen.com/), licensed under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
Data by [OpenStreetMap](https://www.openstreetmap.org/), under
[CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/).
Archived by Cooper Hewitt, Smithsonian Design Museum. These credits also
appear in the map's attribution through `tiles.json`.

`tiles.json` records coverage, source URL, count, size and attribution. The
701 JPEG tiles cover the Studio Tour bounds plus 0.04 degrees on each side,
at zooms 0–14. Higher map zooms scale and fade the painting to reveal current
street detail, while labels, event pins, routes and chat geofences remain
independent overlays.
The archive has missing tiles at zoom 15 near the western edge; this copy uses
the complete zoom-14 coverage. Outside the copy's bounds the street base shows.

Reproduce with `python3 tools/special-events/cache-watercolor.py` from the
repository root. Existing valid tiles are reused; at most four archive requests
run concurrently. No API key, subscription or runtime archive requests are
needed. Direct archive tiles lack the CORS headers required by MapLibre, so the
site serves this licensed copy from its own origin. When changing published
tile bytes or coverage, use a new tile folder URL to avoid stale CDN caches.
