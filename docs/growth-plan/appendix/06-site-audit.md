# Site audit, austin.chat, 2026-10-29 (local check of the repo at commit f99518b)

## Inventory (counted from the data files)
- 66 neighborhood files under chat/data/places, 6,688 businesses from OpenStreetMap:
  Food & Drink 2,010; Health & Beauty 1,303; Shopping 1,097; Groceries & Essentials 782; Auto 726; Services 409; Things to Do 361.
- Explore layer chat/data/explore: 1,955 dated items at 390 distinct venues/names:
  movies 446, live music 286, parks 275, free & cheap 270, events-festivals 215, events 213, live comedy 212, pop-up markets 36, festivals 2.
- 95 neighborhood polygons, 65 chat geofences.
- 39 index.html pages in the repo (apps, maps, tours, planner, chat, models, budget, datacenters, AISD, news).

## Findability gaps (facts from the files)
- No robots.txt and no sitemap.xml.
- Home page title is "Austin.Chat" with no meta description; no Open Graph or Twitter card tags on any key page
  (home, planner, apps index, maps index, chat, moontower). Shared links show no preview image or text.
- No JSON-LD structured data anywhere (0 application/ld+json blocks).
- No analytics of any kind (no Plausible, GoatCounter, Umami, GA, Cloudflare Insights).
- No web app manifest, so no "Add to Home Screen" install prompt and no app icon on phones.
- All listings, events and plans are drawn by JavaScript from GeoJSON/JSON; no static HTML page exists per
  neighborhood, venue, event or category, so search engines index roughly nothing of the 8,600 items.
- Only /myplanmap/ has a description ("Build your Austin day with saved events and places, a personal map,
  and a schedule you can adjust.").
