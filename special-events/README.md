# Special Events maps

The first map is `/maps/austin-studio-tour/`, linked from the main map's
Explore → Special Events card. It is available to guests and Free/Pro members.
`home.json` owns the catalog entry (`category: "Special Events"`).

The iframe uses `/special-events/map.html?event=austin-studio-tour-2026`.
This generated page reuses the main MapLibre engine and complete planner,
routing and export UI. It has Stops, Plan and Chat controls, plus the same
GPS, map layers, 3D and satellite controls. It has no Explore button.
Run `node tools/special-events/make-map.cjs` after changing `chat/index.html`
or its shared asset versions. Do not hand-edit `map.html`.

## Event data

Each event has a GeoJSON FeatureCollection in `data/<event-id>.geojson`.
It declares its title, dates, Austin-time hours and UTC offset, source links,
checked timestamp, map bounds and stop features. Stops have stable IDs,
organizer numbers, titles, addresses, categories, coordinates and official URLs.
Optional `dates`, `hours`, `start` and `end` support restricted attendance or
fixed performances. A fixed performance must have a matching `dates` entry.
`boundary` may supply a Polygon/MultiPolygon for a park, street or venue;
otherwise the event bounds form its chat area. Bounds must include every stop.
Configure the offset for the event dates; split occurrences across different
DST offsets into explicit timestamps. The base planner handles Austin DST.

Stops creates one flexible source per stop and chosen event date. The planner
keeps the existing personal day collection: an event day may also include
nearby businesses and other plans. Visit durations remain unconfirmed until
the visitor edits them. Exports retain source URLs and attendance caveats.
No artist's attendance on every tour day is inferred from its location pin.

## Austin Studio Tour 2026 source snapshot

- Dates/hours: [organizer homepage](https://atxstudiotour.com/), November
  14–15 and 21–22, 11 AM–5 PM, 2026. The Explore page's SEO title still
  displays 2025 dates and is not used for scheduling.
- 307 coordinates and location numbers come from the organizer's public
  [map](https://atxstudiotour.com/explore/?view=map), matched by post ID to its
  public WordPress location records and each location's displayed address.
- The fully loaded [participant index](https://atxstudiotour.com/index/)
  supplies names/profile links for 303 of those stops. Four stops without
  numbered index participants use their published street address as the title.
  Unnumbered index entries are not assigned guessed coordinates.
- The map feed has 307 locations although the event publicity mentions 309.
  We retain the published map's actual stops without fabricating missing pins.
  Original organizer coordinates are preserved to seven decimals; the source
  applies small offsets to separate nearby pins. Confirm entrances on arrival.
- The bounding rectangle is the stop envelope with 0.002° padding. It is the
  event map/chat coverage, not an official municipal or organizer boundary.

To refresh, save `explore.html`, extracted `markers.json`, public
`location-records.json`, each `<post-id>.html` and a `participants.json`
mapping number → `{name,url,kind}[]` outside the repository. Read all pages of
the public location API and scroll the public index until no more rows load.
Then run `python tools/special-events/import-studio-tour.py <source-directory>`.
The importer checks number/address/coordinate consistency and fails on missing
records. Review date/hour changes separately and bump the data's asset version.
Do not commit full website downloads, account data or credentials.

## Chat and GPS

`ChatRoom.start(..., {event})` uses one room/channel,
`event-austin-studio-tour-2026`, across the event area. The actual GPS position
independently chooses the neighborhood directory; crossing a neighborhood
boundary refreshes businesses without changing chat. Business picks show their
map details and planner checkbox without entering a business chat room.
Event chat opens when Visible even if no other visitor is present. Visibility
remains opt-in, and its label explains the wider sharing area. Outside the
event boundary or after location denial, the client leaves the room. This is
the existing client-side GPS model, not server-enforced proof of location.
No new database schema is needed: the current chat policies accept room keys.
Guest messages remain live-only; registered history retains its 30-day policy.

The chat transport ignores old channel callbacks and history after leaving,
switching rooms or identity changes. Other maps keep neighborhood/business
room behavior.

## Checks

- `node --test tests/planner/*.test.cjs`
- `node tools/special-events/check-map.cjs [https://austin.chat]`
- `node tools/planner/check-map.cjs [https://austin.chat]`

The event browser check covers desktop/phone, guest/member, all four tour dates,
pins/search, dated plans, rendered routing, calendar download, map export links,
GPS directory changes, event-room retention, outside/denied-location gating,
theme layout and the main Explore link. All account/chat/route writes use local
fixtures. Shared references in private tour/shop pages require repackaging
with `tools/billing/package-apps.py --upload` before workflow-only Pages deploy.
