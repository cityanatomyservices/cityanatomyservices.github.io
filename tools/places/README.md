# Neighborhood business directory

`python tools/fetch-places.py` builds the businesses under Austin Neighborhood
Chat. It uses free public downloads, with no AI step or paid API.

```sh
python -m pip install -r tools/places/requirements.txt
python -m unittest discover -s tools/places -p 'test_*.py'
node tools/places/test-locate.cjs
python tools/fetch-places.py
```

The GitHub Action runs every Tuesday at 10:43 UTC and supports manual dispatch.
Overture normally releases monthly; the City publishes inspections on its own
schedule. A successful weekly fetch does not mean every underlying record was
updated that week. The browser compares Pages and the current repository copy,
so bot commits are visible even though they do not trigger a Pages deployment.

## Sources and admission rules

- **OpenStreetMap:** Overpass queries the mapped shop, amenity, leisure,
  healthcare, tourism, craft and office types in `chat/data/categories.json`.
  Require a name and coordinates; exclude explicit private, disused, abandoned,
  demolished, vacant and closed records. The new types include music stores,
  specialty retailers, clinics, gas stations, car washes and everyday services.
- **City of Austin food inspections:** download the last 365 days of
  `ecmv-9xxi`, paginate, and keep the latest inspection per facility ID.
  Match by name, address and distance. Never invent coordinates for a facility
  without them. Schools, private kitchens and hospital food-service permits
  are not turned into restaurant listings merely because they were inspected.
- **Overture Places:** use the official Python client's bounding-box download
  and latest STAC release. Require operating status `open`, confidence >= 0.95,
  a numbered street address, a website and a specific public-facing category
  from `chat/data/overture-categories.json`. Read the current `taxonomy`
  structure, not the removed `categories` field. New food/drink/grocery entries
  must also match a City inspection. Broad offices, residences, practitioners
  and unspecified service categories are not imported.
- **Existing Austin.chat shopping guides:** guitar, bicycle and toy shops with
  source URLs and websites. Omit entries explicitly described as closed.

## Matching and corrections

All sources are clipped to the existing 65 neighborhood planning areas, with
polygon holes respected in both Python and the browser. This is not a complete
Austin city-limit or metro-area business registry.

Conflation requires nearby coordinates and compatible names/addresses; different
street numbers or suites are protected. A website domain alone never identifies
a branch. A shared City facility ID can resolve duplicates already independently
matched to that facility. Ambiguous matches are kept separate. Source IDs and
inspection dates remain in each listing; `index.json` records source versions
and Overture provider licenses. Published source evidence does not guarantee a
business is open today or its website is still correct.

Existing chat IDs are reused when a match is found. Merged IDs are recorded in
`aliases`, which the browser accepts for old place links. Removed/closed records
are not retained solely to keep an obsolete menu entry.

`chat/data/place-overrides.json` contains reviewed exclusions and corrections
with evidence URLs and review dates. Corrections survive future refreshes.
Review these when a business reopens or moves again. This pass checked selected
conflicts against business websites and local reporting; it did not individually
call or verify every business.

## Reproducibility and failure handling

Downloads default to the OS temporary directory, outside Git. To review without
changing the published files:

```sh
python tools/fetch-places.py --cache /tmp/austin-places --output /tmp/review/places
python tools/fetch-places.py --offline --cache /tmp/austin-places --output /tmp/review/places --as-of 2026-10-28
```

`places-audit.json` records additions, retained IDs, redirects, removals, source
counts, rejected candidates and neighborhood/category totals. Source failures,
Overpass timeout remarks, implausibly small responses, an old release/feed, a
20% overall count loss, or a 40% loss in a neighborhood previously holding at
least 20 places abort before publication. Validated files replace existing files
atomically; the Action commits the complete set together. No paid geocoding or
Google/Yelp API calls are involved.

Data credits and license copies: [chat/data/README.md](../../chat/data/README.md#business-directory).
