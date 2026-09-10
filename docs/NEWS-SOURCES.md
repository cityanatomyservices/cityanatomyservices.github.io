# News sources for the map feed — research of 2026-09-09

Owner asked for real estate, urban planning and city council sources to add
to the News Feed. Four research agents each verified candidates with live
fetches (status, item count, newest date) on 2026-09-09. Everything below
was checked that day; "dead" means do not retry without a reason.

The builder (`tools/news/build-feed.js`) reads RSS/Atom only. Section 3
lists official datasets that already carry coordinates — the next step if
the map should show exact pins instead of name matches.

## 1. What went into `tools/news/outlets.json`

| Group | Outlet | Feed | Why |
|---|---|---|---|
| news | Austin Current | https://austincurrent.org/feed/ | The Austin Monitor's successor (Monitor's own RSS died 2025-11). Daily, full text, Austin-only, names places. |
| planning | Austin Current — Growth & Development | https://austincurrent.org/category/growth-development/feed/ | Same paper, the land-use category only. |
| government | City of Austin | https://www.austintexas.gov/site/news/rss.xml | The one official city feed (all departments). Capped at 10 items, ~2/day, full text; APD items carry a "Location:" line. Dates look like "September 8, 2026". |
| government | Council Message Board | https://austincouncilforum.org/app.php/feed | Council members' public posts (phpBB Atom). |
| government | Austin Politics Newsletter | https://www.austinpolitics.net/rss/ | Jack Craver; council/zoning heavy, full text of public posts. |
| government | The Austin Bulldog | https://theaustinbulldog.org/feed/ | Investigative local government. |
| government | Texas Tribune (tag austin) | https://www.texastribune.org/tag/austin/feed/ | City-level, ~3/week. |
| news / planning | KUT | https://www.kut.org/austin.rss · housing.rss · transportation.rss | Replaces the sparse news.rss. Austin desk, full text. |
| news | KXAN (Austin section) | https://www.kxan.com/news/local/austin/feed/ | Replaces the statewide feed; still crime/weather heavy, capped at 10. |
| planning / government / realestate | Community Impact topic feeds | https://communityimpact.com/rss/austin/development/ · government/ · real-estate/ · business/ | Replace the general Austin feed. Development is the most geocodable feed found (permits, rezonings, tracts) but descriptions are empty, so pins come from titles. Metro-wide (suburbs). |
| realestate | Connect CRE (Austin) | https://www.connectcre.com/story-market/austin/feed/ | Only commercial-RE trade feed with an Austin-only URL. Needs a browser user-agent. |
| realestate | CultureMap Austin real estate | https://austin.culturemap.com/feeds/news/real-estate.rss | Full article HTML in the feed, so addresses appear. Occasional Houston/Dallas listicle. |
| realestate | The Real Deal (tag austin) | https://therealdeal.com/tag/austin/feed/ | Addresses in excerpts; articles metered. Needs a browser user-agent. |
| realestate | REjournals (tag austin) | https://rejournals.com/tag/austin/feed/ | Intersections and building names in excerpts. |
| realestate | Austin Towers | https://austin.towers.net/feed/ | A few posts a year, every one a named site. |
| planning | Downtown Austin Alliance | https://downtownaustin.com/feed/ | Twice monthly, dense on downtown place names; 1.4 MB fetch. |
| planning | habitavit (Substack) | https://habitavit.substack.com/feed | LIHTC applications, Houseplex amendment, specific sites; 1–2/month. |

Dropped from the original four: Austin Monitor (dead, replaced by Austin
Current), KUT news.rss, KXAN statewide feed, Community Impact general feed
(all replaced by narrower feeds of the same outlets).

## 2. Verified working but NOT added (candidates)

| Source | Feed | Why not yet |
|---|---|---|
| Council district newsletters (Mailchimp archives) D1, D6, D7, D8, D9, D10 | D1 `us3.campaign-archive.com/feed?u=d36739e30dd8f75e2de6ed805&id=8d208cf343`, D6 `us13…?u=6bece8d6def8e5aaa548a2fb0&id=81d53291a3`, D7 `us10…?u=51fd74872ddb16c5f022118b3&id=a087ad2232`, D8 `us5…?u=a650e7a8a4268e3923c20a945&id=58e6f962eb`, D9 `us21…?u=3ddf35db48535a8363c3d7196&id=d92250c718`, D10 `us2…?u=13a7db8ed269181c3ca3644e0&id=7add14d63a` | Whole emails as items (1–5 MB each); one pin per newsletter would land on an arbitrary place. Better as a "by district" layer. Mayor, D2, D3, D4 have no archive feed; D5 stale since 2025-04. |
| Austin ISD | https://www.austinisd.org/rss.xml | Would need a school list in the gazetteer. |
| Travis County news | https://www.traviscountytx.gov/news/2026?format=feed&type=rss | Titles only, county-wide; year in the URL. |
| Austin Transit Partnership | https://www.atptx.org/feed/ | Quarterly press releases. |
| CapMetro board (Legistar API) | https://webapi.legistar.com/v1/capmetrotx/events?$orderby=EventDate%20desc&$top=20 | JSON, not RSS; meetings + matters. |
| KVUE local · CBS Austin local | https://www.kvue.com/feeds/syndication/rss/news/local · https://cbsaustin.com/news/local.rss | 15/day each, mostly crime/weather; only with a keyword filter. |
| KXAN traffic | https://www.kxan.com/traffic/feed/ | Names roads; 20 items. |
| Austin Chronicle | https://www.austinchronicle.com/feed/ | No section feeds; 1 in 10 items is news. |
| CultureMap Austin (all news) | https://austin.culturemap.com/feeds/news.rss | Lifestyle-heavy. |
| Austin Parks Foundation · Waterloo Greenway | https://austinparks.org/feed/ · https://waterloogreenway.org/feed/ | Advocacy/events, monthly. |
| AURA | https://aura-atx.org/feed/ | ~4 posts/year (last 2026-07-17). |
| Save Austin Now · Mackenzie Kelly · City of Yes (Substacks) | saveaustinnow.substack.com/feed · frommackenzie.substack.com/feed · ryanpuzycki.com/feed | Opinion/partisan; City of Yes is national. |
| Opportunity Austin · Austin Chamber blog | https://opportunityaustin.com/feed/ · https://www.austinchamber.com/blog/feed.rss | Economic development PR; Chamber feed is the whole archive (~1 MB). |
| Texas Real Estate Research Center | https://trerc.tamu.edu/feed/ | Statewide research; 403 to browser UAs, works with curl UA. |
| Rebusiness Online (Texas) · Bisnow (all) · Multi-Housing News · Multifamily Dive · Redfin News · Texas Housers | see agent notes | Statewide/national; ~1 Austin item a week at best; keyword filter only. |
| Austin Business Journal via Google News RSS | https://news.google.com/rss/search?q=site:bizjournals.com/austin+real+estate&hl=en-US&gl=US&ceid=US:en | Only machine route to ABJ (its own RSS is Cloudflare-blocked). Redirect links, no summaries, hard paywall. Bing variant: https://www.bing.com/news/search?q=site%3Abizjournals.com%2Faustin+real+estate&format=rss |
| Urbanize Austin | https://austin.urbanize.city/rss.xml | 3 posts in 12 months. |

## 3. Official data that already carries a location (exact pins, no name matching)

City of Austin open data (Socrata): `https://data.austintexas.gov/resource/<id>.json` with `$where`, `$order`, `$limit`; `.geojson` where noted. No app token needed at one run a day (a free token removes throttling). Portal terms: public domain unless a dataset says otherwise. Gotchas: `$order=<date> DESC` puts nulls first, add `AND <date> IS NOT NULL`; traffic/fire dates are UTC with `Z`, permits/311/code dates are local with no zone; daily-load datasets lag a day.

| Dataset | id | Date column | Location | Volume | Notes |
|---|---|---|---|---|---|
| Zoning Cases | `edir-dcnf` (.geojson too; polygons `4cr9-k3gx`) | `status_date`, `application_start_date` | `site_address`, lat/lon | ~6 new/month, status changes daily | The best news-like geo dataset: case number, existing → proposed zoning, status, link. |
| Site Plan Cases | `mavg-96ck` (polygons `2u4n-hmgw`) | `application_start_date`, `status_date` | point, street fields | ~1 new/day | `proposed_no_of_units`, `description_of_work`. |
| Subdivision Cases | `s7gx-9m54` (polygons `it4s-wgjk`) | same | lat/lon | rare | |
| Plan Review Cases | `n8ck-xkda` | `applied_date` | `location` (100%), `project_name` = address | ~13/day | Earliest signal of new construction. |
| Issued Construction Permits | `3syk-w9eu` | `issue_date` | lat/lon (65%), `permit_location` | ~80/weekday | 6.4M rows: always filter by date. `description`, valuation, `work_class`. |
| Issued Building Permits (geocoded) | `quv8-5ckq` | `issue_date` | `the_geom` (100%) | ~6/day | Demolitions, unit counts. |
| Issued Tree Permits | `ac2h-ha3r` | `issued_date` | point, `permit_address` | ~5/day | `heritage_tree`, species. PDDL. |
| Code Complaint Cases | `6wtj-zbtb` (.geojson) | `opened_date` | `address`, lat/lon (86%) | ~85/day | `description` = violation type; STR flag. |
| Council Agenda Items | `sich-49ay` | `agenda_date` (filter `< now`; placeholder rows dated 2050) | none (text names places) | per meeting | item, sponsor, lead dept, posting language, link to agenda. |
| Zoning Notices | `k2wj-4v6p` | `meeting_date` | none (PDF) | per hearing | link target only. |
| Real-Time Traffic Incidents | `dx9v-zd7x` (.geojson) | `published_date` (UTC) | point, `address` | ~125/day, minutes fresh | Drop stalled/hazard types for signal. |
| Real-Time Fire Incidents | `wpu4-x69d` | `published_date` (UTC) | point, `address` | ~120/day (mostly alarms) | "BWP - Broken Water Pipe" is the only main-break proxy. |
| 311 (all) · 311 TPW subset | `xwdj-i9he` · `38mr-dwji` | `sr_created_date` · `created_date` | point + address | 400–1000/day · ~180/day | Filter by `sr_type_desc`. |
| Mobility Management Center issues | `v7vh-gbi6` | `created_date` | point, intersection name | ~45/day | CC BY 4.0 — attribute. |
| Roadway Work Zones | `qyfh-gwei` (.geojson LineString) | `start_date` | line, `road_names` | ~65 new/day | Generic text. |
| Street Events (AMANDA) | `qfdt-ma2g` | `start_date` | `the_geom` | ~1/day | Permitted closures. |

ArcGIS (City of Austin org `0L95CJ0VTaxqcmED`, `f=geojson&outSR=4326`):
Special Events Road Closures `Special_Events_Road_Closures_Public/FeatureServer/0/query` (event name, street, closure type, times; entered weeks ahead) · Street Events AMANDA `Street_Events_AMANDA/FeatureServer/0/query`.
TxDOT Travis closures: unofficial mirror `https://services5.arcgis.com/Rvw11bGpzJNE7apK/arcgis/rest/services/DriveTexas_API/FeatureServer/0/query?where=county_num=227`.
CapMetro service alerts (JSON): `https://data.texas.gov/download/9zu9-jwr2/application%2Fjson`, join `stopId` to static GTFS `stops.txt` (`https://data.texas.gov/download/r4v4-vz24/application%2Foctet-stream`); strip staff names before publishing.
City news as JSON: `https://www.austintexas.gov/jsonapi/node/news_article?sort=-created&page[limit]=20` (no locations).

Suggested first datasets for an exact-pin layer, in order: Zoning Cases status changes, City news, Council agenda items (name-matched), Site Plan + Building Permits (new/demolition above a valuation), Special-event closures. Last-24-hours query shapes are in the agent notes; e.g. zoning:
`https://data.austintexas.gov/resource/edir-dcnf.json?$where=status_date > '<yesterday>' AND latitude IS NOT NULL&$order=status_date DESC`

## 4. Dead, blocked or stale — do not retry

- **Austin Monitor** all feed URLs: last item 2025-11-05; publication moved to austincurrent.org.
- **Austin Business Journal** own RSS: 403 Cloudflare on every path. **Austin American-Statesman**: no public feed. **Bisnow** per-market: 404 (only `/rss/all`). **GlobeSt**, **Zillow Research**, **Planetizen**: 403. **ABoR / Unlock MLS**: no feed (Nuxt SPA; only `sitemap.xml`).
- **City of Austin**: only `/site/news/rss.xml` exists; `/rss.xml` is an empty channel; every department/council/boards RSS path 404s. **CapMetro** news, **Project Connect**, **Austin Energy**, **Austin ISD** news/agenda feeds: 404. Austin does not use Legistar (CapMetro does).
- **Travis County** un-scoped feed: 2 items from 2024 (use `/news/<year>`); commissioners' agenda feeds: empty.
- **Community Impact** `rss/city/austin/`, edition feeds (`central-austin/` etc.), `housing/`: 404; `city-county/` stale 2023.
- **KUT** `austin-city-council.rss`, `development.rss`: 404; `politics.rss` is statewide. **Texas Tribune** topic feeds: HTML/404 (only `tag/austin`, `tag/housing`, main).
- **Austin Towers** old domain `towers.net/feed/` (2018). **Reconnect Austin** (2014). **Friends of Austin Neighborhoods** `atxfriends.org/feed/` (2024-10). **Rethink35** `rethink35.org/blog?format=rss` (2025-10). **Austin Neighborhoods Council** `atxanc.org/blog-feed.xml` (2025-12). **Austin Justice Coalition** (2025-03). **Bike Austin**, **Preservation Austin**, **Evolve Austin**, **The Austin Common**: no feed / 403. **Austin EcoNetwork**: domain hijacked. **UT SoA** `rss.xml` is a staff directory. **Farm&City**: winding down.
- **Brokerage blogs** (Realty Austin, Moreland, Bramlett, Kuper…): none have feeds. **Substack** name guesses (austinurbanist, austinyimby, atxhousing…): 404 or empty stubs.
- **Multi-Housing News** Austin tag (2015) / market feed (403). **Connect CRE** `/texas/feed/` and **REjournals** `/category/texas/feed/`: 200 but empty (use the market/tag feeds).
- **Socrata**: APD Crime Reports `fdj4-gpfu` and CAD `22de-7rzg` lost their coordinates; Board of Adjustment `ykxk-t5y9` stops 2019; Council Voting Record `3c89-i35a` last 2026-05; ACE Events `teth-r7k8` stale; ROW Active Permits `hyc6-zz9w` aggregates only. **ATD_road_closures_incidents** ArcGIS: 2017. **AMANDA ROW permits** ArcGIS: token required. **Austin Water** main breaks / boil notices / **park closures** / **TCAD deeds**: no dataset or feed. **TxDOT** direct APIs: none public.
