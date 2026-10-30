# How austin.chat gets users

## A growth plan for a free Austin things-to-do site with a Day Planner and, soon, free classifieds

DRAFT research report, 29 October 2026. Factual plan for the owner to act on and rewrite; all copy here is draft (owner writes all copy). Five research notes, a site audit and this synthesis live in `docs/growth-plan/`. Every number carries a label: FACT (sourced, URL in the appendix note named), ESTIMATE (arithmetic shown) or UNCERTAIN (could not be verified this session, owner to check).

---

## 0. The answer in one paragraph

austin.chat has a bigger inventory than any small Austin guide (66 neighborhoods, about 6,700 businesses, about 1,950 dated events at 390 venues, a planner with its own routing engine) and almost no way for anyone to find it: no sitemap, no page descriptions, no share previews, no analytics, and every listing drawn by JavaScript inside an iframe, so search engines and AI assistants index roughly nothing. Users will come from three engines, in this order of payoff: (1) static pages that search engines can read, led by one permanent "this weekend in Austin" page, 66 neighborhood pages and a dozen itinerary pages, because that is exactly the query family tiny local sites already win; (2) the owner's own short-video machine, pointed at a pre-filled plan link every time, posted where links actually travel (Instagram, Pinterest, Bluesky, the Substack) and tagged to Austin places for TikTok's new Local Feed; (3) a classifieds launch that is deliberately narrow (free stuff and garage sales on the map, then student sublets in late April, then face-value ticket swaps before ACL and F1), seeded by hand and open to read without an account. Around those engines sit cheap, rule-bound channels: free event calendars, a Nextdoor Business Page, newcomer Meetups, Airbnb-host QR cards, three specific press contacts, one Show HN post, and a single paid test (Google exact-match search at an estimated 15 to 50 cents a visit). Paid listings, billboards, bus ads, Chamber dues and influencer fees are the things not to buy. Realistic targets if the plan is executed: 2,000 to 4,000 visits a month at month six, 5,000 to 10,000 at month twelve, with at least one in ten visitors starting a plan.

---

## 1. Ten facts that shape the plan

| # | Fact | Label | Why it matters | Note |
|---|---|---|---|---|
| 1 | The home page body is one iframe; there is no robots.txt, sitemap, meta description, Open Graph tag, JSON-LD block, analytics script or web-app manifest anywhere on the site | FACT (repo audit) | Nothing can be found, previewed or measured until this is fixed; it is week-one work | 06 |
| 2 | "things to do in austin" is held by Tripadvisor, US News, Time Out and Visit Austin; "things to do in austin this weekend" is held by Eventbrite and five one-person sites (ATX Weekly, Hey Austin, Austinot, 365 Things, austin-texas.net) that each keep one permanent URL whose title carries this week's dates | FACT (Bing SERPs 2026-10-29) | The weekend query is winnable by a small site; copy the single-URL pattern | 02 |
| 3 | 365 Things Austin, the archetype small guide, gets about 7,600 visits a month, 58% from search; Do512 gets about 138,000 a month, 66% from search | FACT (Similarweb) | Sets the realistic range for year one and shows search is two thirds of a local guide's traffic | 02, 05 |
| 4 | TikTok launched a US Local Feed on 11 Feb 2026 that ranks on location, topic and recency and favors travel, events, restaurants and shopping from local creators; Instagram Map (Aug 2025) surfaces public location-tagged posts | FACT (TikTok newsroom, TechCrunch) | Place-tagging every post is free local distribution for the owner's existing video output | 03 |
| 5 | Links: TikTok allows one bio link and no clickable captions; YouTube Shorts allow no clickable URLs at all; Instagram allows 5 bio links plus Story stickers; every Pinterest pin is a link; Bluesky welcomes links; X deprioritizes them (Musk's own words) | FACT (platform help pages) | Decides where the plan link goes and why Pinterest, Instagram and Bluesky carry the clicks while TikTok and Shorts carry discovery | 03 |
| 6 | Every six-figure Austin "things to do" account is a daily feed of what is new (365 Things, Austin Report posting six times a day for 68 weeks, Visit ATX); none has a product behind it | FACT | Cadence and news hooks grow the audience; austin.chat would be the first Austin account where the plan is the product | 03 |
| 7 | Nextdoor's rules changed on 19 Aug 2026: promotion must come from a free Business Page (2 posts a month, 2-mile radius); personal-account promotion is down-ranked with a warning email | FACT (Nextdoor blog) | One claimed page, used twice a month, beats posting as a neighbor | 01 |
| 8 | Craigslist Austin live counts on 2026-10-29: free stuff 360, apartments 346, gigs 279, musicians 161, sublets 45, lost and found 37, tickets 19, garage sales 13; company revenue fell from about $1.04B (2018) to about $302M (2025) | FACT (counted on the public pages; Wikipedia, BusinessWire) | Garage sales, tickets, sublets and lost-and-found can reach parity with a few dozen real posts | 04 |
| 9 | Facebook Commerce Policies ban animals, job posts and weapons and restrict event tickets to approved sellers | FACT | Fan ticket swaps, musicians and gigs have no incumbent home on the biggest marketplace | 04 |
| 10 | A front-page Show HN is worth about 4,000 to 11,000 visitors over a day or two, then decays; ESTIMATE 2% to 5% of them are in Austin | FACT (self-reported post-mortems); ESTIMATE | Launch platforms buy backlinks and credibility with source-code buyers, not Austin users | 05 |

---

## 2. What the site looks like from outside today

Counted from the repository on 2026-10-29 (commit f99518b). Appendix 06 has the detail.

| What exists | Count | Can a search engine read it? |
|---|---|---|
| Neighborhood business files (OpenStreetMap) | 66 files, 6,688 businesses: Food and Drink 2,010; Health and Beauty 1,303; Shopping 1,097; Groceries 782; Auto 726; Services 409; Things to Do 361 | No. Drawn by JavaScript on the chat map |
| Explore layer (dated items) | 1,955 items at 390 venues: movies 446, live music 286, parks 275, free and cheap 270, events and festivals 215, events 213, comedy 212, pop-up markets 36 | No |
| Neighborhood polygons and chat geofences | 95 and 65 | No |
| HTML pages | 39 index pages (apps, maps, tours, planner, chat, models, budget, data centers, AISD, news) | Partly. Titles only; one page has a description |
| robots.txt, sitemap.xml | none | - |
| Open Graph / Twitter card tags | none on any key page | Shared links show no preview |
| JSON-LD structured data | none | - |
| Analytics | none | Nothing is measured |
| Web app manifest | none | No "Add to Home Screen" on phones |

The fix is a build step, not an architecture change: the data already sits in static JSON files and the repo already runs GitHub Actions that rebuild the places, explore, news, sports and ticker data. A `build-pages` action that writes static HTML pages plus a sitemap from those files is in the existing pattern (appendix 02, section 7).

---

## 3. The strategy: three engines and one asset

| Engine | What it is | Why it is first-tier | Evidence |
|---|---|---|---|
| **Engine 1: pages search can read** | One permanent `/this-weekend/` page with dated title, `/today/`, 66 `/neighborhoods/<slug>/` pages, 8 to 12 itinerary pages, annual `/sxsw/`, `/acl/`, `/f1/`, `/ut-game-day/` pages, and one leaf URL per event with Event JSON-LD; each page ends in "open this plan in the planner" | Two thirds of a local guide's traffic is search; the weekend and itinerary queries have thin results; freshness (a weekly rebuild) is the strongest documented AI-citation signal; Eventbrite doubled event-page traffic growth after adding Event markup | 02 §3, §4, §5, §9 |
| **Engine 2: the video machine, pointed at a plan link** | Every video's plan exists at a stable URL with a map preview image before the video posts; that URL is the bio link, the Story sticker, the Pinterest pin and the Bluesky post; every post is tagged to an Austin place | Discovery happens on TikTok and Reels, clicks happen on Instagram, Pinterest and Bluesky; the Local Feed and Instagram Map reward place tags; the owner already makes the videos | 03 §2, §5, §7 |
| **Engine 3: a narrow classifieds launch** | Free stuff and garage sales on the map first (zero money, zero legal weight, a weekly Short); sublets near campus in late April; face-value swaps of transferable tickets when ACL and F1 tickets go on sale; everything readable without an account | Every successful cold start used a pre-existing group, one category, hand seeding and open browsing (Craigslist, Nextdoor, Marketplace, Depop); Craigslist's thin Austin sections are beatable; Facebook bans the categories a fan board can own | 04 §2, §3, §7 |
| **The asset: the email list** | The "this weekend" page, the Thursday video and the Substack issue are the same artifact | Do512's engine was 353,000 daily email subscribers (2018); 6AM City runs 1.3M subscribers across 25 cities; email is the one audience no platform can throttle | 03 §1, §5 |

Everything in sections 4 to 8 feeds one of these four.

---

## 4. Channel inventory

Priority: **A** = do in the first 30 days, **B** = days 30 to 90, **C** = later or only with a trigger, **No** = do not buy or do.

### 4.1 Search and discovery surfaces

| Channel | Cost | Rules that matter | What to do | Priority | Note |
|---|---|---|---|---|---|
| robots.txt and sitemap.xml | $0 | Allow Googlebot, Bingbot, OAI-SearchBot and PerplexityBot; true `lastmod` only; Google ignores priority and changefreq | Generate the sitemap in the build action; sitemap line in robots | A | 02 §7 |
| Google Search Console and Bing Webmaster Tools | $0 | ChatGPT and Copilot read Bing's index | Verify both; add an IndexNow ping to the build action so Bing sees each weekly rebuild | A | 02 §5 |
| Home page HTML | $0 | Google follows only real `<a href>` links; iframe content is a separate document | H1 "Things to do in Austin", three sentences, meta description, links to this-weekend, neighborhoods, itineraries, planner, tours; keep the map below | A | 02 §7 |
| Open Graph image and description on every page | $0 | - | Plan pages render a map image so links preview as a map in DMs, Bluesky, Pinterest | A | 03 §5 |
| `/this-weekend/` and `/today/` | $0 | One permanent URL; dates in the title and H1; content changes inside the URL; visible "Updated <date>" | Rebuilt every Thursday by the existing data action from the explore layer; archive copies at `/weekends/<date>/` | A | 02 §3, §4 |
| Event leaf pages with Event JSON-LD | $0 | One unique URL per event; physical public events only; never hours, happy hours or promos as events (Google may take manual action) | Generate `/events/<id>/` from the explore layer | B | 02 §4.2 |
| 66 neighborhood pages | $0 | Listing text (names, addresses, hours, website links) must be in the initial HTML; map loads after first paint | Pre-render from `chat/data/places/*.json` with ItemList JSON-LD | B | 02 §4.1 |
| Itinerary pages (3-day, 1-day South Congress, East Austin night, with kids, bachelorette, SXSW no-badge, ACL and F1 weekend) | $0 | Each page needs a task (the planner CTA) or it reads as thin programmatic content | Owner writes 8 to 12; each opens pre-filled in the planner | B | 02 §4.1 |
| Apple Business Connect | $0 | Open to online-only businesses | Register the brand | B | 02 §4.2 |
| Google Business Profile | $0 | Online-only brands are ineligible; profiles get suspended | Do not create one | No | 02 §10 |
| Google "Things to do" modules and travel carousels | - | Attractions and tour operators only; carousel beta is EEA, Türkiye, South Africa only | Nothing to feed | No | 02 §4.2 |
| llms.txt and "AI SEO" vendors | - | Google: no AI text files needed; Mueller: no AI system uses llms.txt | Skip; AI referrals are 0.37% of travel-site traffic | No | 02 §5 |
| Pinterest business account | $0 | Every pin links; 8 in 10 weekly users plan summer trips there; travel searches spike at New Year | One tall pin per itinerary and neighborhood page; boards per crowd; March content pinned in January | A | 02 §6, 03 §2 |
| YouTube search | $0 | Shorts carry no clickable links; long-form links need "advanced features" verification | Verify the channel; one evergreen "how to plan your Austin weekend" long-form whose description links; every Short's related-video link points to it; titles copy the winners ("N things to do in Austin", "weekend in Austin") | B | 02 §6, 03 §2 |
| Core Web Vitals | $0 | LCP 2.5 s, INP 200 ms, CLS 0.1 on mobile | Defer MapLibre and Supabase until after first paint on listing pages; check in PageSpeed Insights | B | 02 §7 |
| Keyword volumes | $0 | - | Check once in Google Keyword Planner (free account, no spend) and record in the repo; public volumes could not be fetched this session | A | 02 §2 |

### 4.2 The owner's own channels

| Channel | Link reality | What to do | Priority | Note |
|---|---|---|---|---|
| TikTok @anatomy.city | One bio link (1,000 followers or a Business account); captions not clickable; Local Feed ranks on place tags | Switch to a Business account; tag every post to the Austin place; weekly "this weekend on the map" plus daily 15 to 60 s neighborhood clips; say and show "austin dot chat"; rotate the single link to the current plan | A | 03 §7 |
| Instagram Reels, Stories, Map | 5 native bio links; Story link sticker for all non-new accounts; location tags feed the Map; Trial Reels test formats on non-followers | Same videos; Thursday Story with the plan sticker; the 5 links = this week's plan, planner, tours, newsletter, classifieds; Trial Reels to A/B map-only vs narrator cuts | A | 03 §7 |
| Pinterest | Every pin links out | See 4.1 | A | 03 §7 |
| YouTube | Shorts: no links; long-form: links after verification | See 4.1 | B | 03 §7 |
| Bluesky (create @anatomy.city) | Links welcomed; Boston Globe saw 3x Threads' referrals | Post every map video natively with the link; the budget, data-center, AISD and absentee-capital maps fit its journalist and urbanist audience | A | 03 §7 |
| Threads and X | Threads: links allowed; X: link in the first reply | Cross-post only; 5 minutes a week | C | 03 §7 |
| Facebook Page | Links allowed, low reach; Reels live about 65 days | Cross-post Reels for the 45-plus, parent and newcomer audience; link in comments | C | 03 §7 |
| Substack | - | The Thursday "this weekend" email is the weekend page; grow the list from every plan page | A | 03 §5 |
| Own `/go/` redirects | - | Self-hosted short links with UTMs so clicks are counted in the site's analytics; skip Linktree | A | 03 §5, 05 §6.3 |
| Reddit | One honest "I made this map" launch post per big map, never a drip | See 4.3 and 4.7 | B | 03 §8 |

Formats with evidence behind them (03 §3): "this weekend in Austin" (fits the 3 to 7 day decay of TikTok and the 24 to 48 h peak of Shorts), "N things to do" ranked lists, a 60 to 90 s itinerary walk with the routing engine's travel times on screen (the format no Austin account has), neighborhood tours tagged to the place, negative-constraint titles ("that aren't eating or drinking"). The one documented penalty that applies to the owner is re-uploading TikTok exports with the watermark: "unoriginal or reused material" is ineligible for the For You feed. Render each cut from source.

### 4.3 Austin communities

| Place | Size | Rules found | What to do | Priority | Note |
|---|---|---|---|---|---|
| r/Austin | about 640,000 (GummySearch) | UNCERTAIN: rule text not fetchable; third-party guide says self-promotion "heavily restricted", a weekly megathread exists; large subs commonly gate on 200 to 500 karma and 14 to 30 day accounts | Read the sidebar in a browser; modmail asking whether a free non-commercial map tool may be shared once; answer "Looking for" and "Ask Austin" questions with a plan link only when it is the answer | B | 01 §2 |
| r/austinfood | about 196,000 | UNCERTAIN | Post the shopping lists (pizza etc.) as content; link the app in a comment if asked | B | 01 §2 |
| r/UTAustin | about 118,000 | UNCERTAIN; "Events" flair exists | "Things to do near campus" map in August move-in week; sublet map in late April | B | 01 §2 |
| r/AustinClassifieds, r/AustinHousing, r/AustinMusicians | about 41,000 (+33%/yr), 13,000 (+90%/yr), 7,000 (+40%/yr) | UNCERTAIN; r/AustinClassifieds runs a Tickets Megathread | Participate as a person; once the board has real swaps, ask mods whether a "map of current Austin ticket swaps" link is acceptable | C | 04 §1.6, §6 |
| Nextdoor | "1,000+" Austin listings on its For Sale and Free page | Business Page: free, 2 posts a month, 2-mile radius or chosen neighborhoods; Groups set their own rules and are exempt | Claim a Business Page (UNCERTAIN whether an online-only site qualifies); use the 2 posts for a neighborhood's own page; join 5 neighborhood Groups as a person | A | 01 §4 |
| Facebook groups: Awesome Austin (20,000+), Austin Moms network (45,000+ across groups), Walking Moms of Austin (3,800, vetted), New to Austin and Girls New To Austin (sizes UNCERTAIN) | as listed | Most newcomer groups ban business posts without admin approval | DM the admin first; offer a "newcomer's first weekend" plan link; pitch AustinMoms editors instead of posting ads | B | 01 §4 |
| Discord: Austinites | 4,803 members, grew by hosting restaurant meetups | Rules not shown on the listing | Join, read rules, drop the weekend plan in the events channel when relevant | C | 01 §4 |
| Meetup: New To Austin 20/30s (15,716), "I love Austin, but I need some friends" (34,072), Austin History and Culture (3,727); Austin topic 94,547 members across 41 groups | as listed | Group-run; starting a group needs an organizer subscription, ESTIMATE $120 to $180 a year | Offer the Moontower and 1885 tours as group walks to the History and Culture organizer; co-host a "plan your month" meetup; consider the one paid item: an "Austin walking tours" Meetup group | B | 01 §4 |
| Austin Newcomers Club | "hundreds of members", newsletter Welcome Mat | Terms UNCERTAIN | Email memberservices@austinnewcomers.com offering a free "first month in Austin" plan and a guided walk | B | 01 §4 |
| Neighborhood associations | City of Austin Community Registry lists every association with website links | Usually free community notices | Pull the list; email each its own `/neighborhoods/<slug>/` page and a one-line embed of the neighborhood map and, later, its classifieds feed | B | 02 §8, 04 §5 |

### 4.4 Free calendars, newsletters and listings

All accept submissions; all list events, not websites. austin.chat must host dated things (tour runs, a monthly "plan your weekend" walk, a garage-sale map morning) to use them. Appendix 01 §3 has the submission URLs and rules.

| Outlet | Cost | Rules | Priority |
|---|---|---|---|
| Austin Chronicle calendar | Free; do not buy the non-refundable promotion upsell at checkout | Curated, space-available; due the Monday of the week before the issue | A |
| Visit Austin event calendar | Free | Visitor-appealing events only; rejects daily tours, business activity, happy hours, networking, fundraisers, reseller tickets; 3:2 image at least 900x600; up to 5 business days; needs a link to your site | A (dated special runs only) |
| KUT / KUTX community calendar | Free | Supports recurring events | A |
| Austin Monthly calendar | Cost not stated | Account required; listings flagged "reader submitted" | A |
| ATXtoday (6AM City) events | Free upload; paid guaranteed newsletter slot | - | A |
| The Austinot | Free by email | Austin-based only; ranks #5 for the weekend query | A |
| Do512 | Free profile; event-adding rights granted by email | Events only; about 250,000 uniques a month | A |
| Eventbrite | Free for free events; the Eventbrite page itself ranks | - | A |
| The Austin Common | Partner page is paid (price UNCERTAIN) | Civic and advocacy events | Pitch the budget, data-center and AISD maps as stories, not ads |
| Community Impact, Austin360 | Submission pages not found (UNCERTAIN) | - | C |
| Austin Chamber ($590 a year), Visit Austin partner programs ($300 to $8,000, no cancellations, no listing product) | Paid | - | No |

### 4.5 Press

Local coverage of solo-made tools arrived three ways in the cases found (05 §1.4): the tool was the only live data in a news moment (ice-storm water map, COVID donation map), a civic or UT partnership embedded it (VoteATX on the city site), or the maker was quoted as a source (Austin Towers cited by KXAN). "Please cover my site" pitches did not surface as a pattern. Pitch assets, not the brand.

| Outlet | Contact found | Angle | Priority | Note |
|---|---|---|---|---|
| Silicon Hills News | Laura@SiliconHillsNews.com (one editor; covered Austin Tech Map and ATXup) | "Solo maker builds a free Austin planner on his own routing engine" | A | 05 §1.1 |
| City Cast Austin | austin@citycast.fm; podcast relaunched 22 Sep 2026; runs Neighborhood Guides and monthly "Austin's Best" event guides | Day Planner as a "how to plan ACL or SXSW weekend" segment; neighborhood map for their guides | A | 05 §1.1 |
| KUT ATXplained | Hearken question form; listener vote | Submit a map-shaped question the owner can co-answer with data | B | 05 §1.1 |
| Austin Towers | Contact form; takes no ads; since 2007 | The 3D city-project models page is exactly their beat | B | 01 §3, 05 §1.1 |
| Austin Current (replaced the Austin Monitor, which closed Oct 2025) | austincurrent.org/tips/ wants documents and data, not launches | Only the data products (budget, data centers, AISD) as evidence for a story | B | 05 §1.1 |
| 365 Things Austin | Contact page; about 500,000 Instagram, 315,000 Facebook | A story: "a free map that plans your Austin day"; do not buy ads | B | 01 §3 |
| Austin Chronicle "Best of Austin" | Two-round reader poll; 33,055 voters and 423,142 votes in the 2025 final; nominations historically late March to early April | Ask followers to write in austin.chat when round 1 opens; ESTIMATE a few hundred write-ins reach the finalist list; no confirmed website or app category (UNCERTAIN) | B (spring 2027) | 05 §1.2 |
| KXAN, KVUE, Statesman/Austin360, ABJ/Austin Inno, Community Impact, Austin Monthly | Newsroom numbers and reporter patterns; no pitch guides fetched (UNCERTAIN) | Be the data source when news breaks; event-weekend "plan your weekend" angle 3 to 4 weeks ahead; ABJ wants the source-code business, not the free site | C | 05 §1.1 |
| Austin Monitor, KVUE Defenders line, Texas Standard without a statewide hook | - | - | No | 05 §7 |

Pitch shape (recommendation, 05 §1.3): subject leads with the asset ("[Data] Where Austin's 47 data centers are, free interactive map"); five lines (what it is and that it is free with no sign-up; the one surprising number; link plus a square screenshot; "built alone, data from X, GeoPackage available"; a 10-minute call this week); one follow-up after three business days.

### 4.6 Partnerships and offline

| Partner | What exists | What to do | Priority | Note |
|---|---|---|---|---|
| Airbnb hosts | Guidebooks are public, printable and shareable off-platform; Austin has 9,000 to 14,000 listings by counter, about 2,750 licensed | A one-page "give your guests this link" kit: QR card PDF plus a three-line welcome message; post in Austin host groups; hand to 10 hosts and 5 downtown concierges | A | 01 §5, 05 §3 |
| Bachelorette and wedding planners, hotels selling packages | Austin ranked #1 US bachelorette destination (Thumbtack 2015); Google "bachelorette" interest peaks mid-September | One bachelorette-weekend plan template; send to planners and hotels that sell packages | B | 05 §3, 02 §2 |
| Apartment locators and realtors | Free-to-tenant locator industry; realtors hand out newcomer packets; 2019-era "Austin apps" roundups by RentCafe, Built In, JB Goodwin still rank and get refreshed | Co-branded "your first 30 days in Austin" plan link; ask for inclusion in the next roundup refresh | B | 05 §3, 02 §8 |
| UT Austin | UT Marketplace is a free table for Austin businesses (confirm it still runs: UNCERTAIN); Texas Union ballroom exhibitor fee $350; the ISSS 2026 "Welcome to Austin" guide links to no external Austin site | Table with QR cards; email ISSS offering the neighborhood pages and a newcomer itinerary for the handbook | B | 05 §3, 02 §8 |
| Open Austin and ATX Hack for Change (St. Edward's) | Volunteer civic-tech group; the hackathon is how VoteATX got embedded on the city site | Present the routing engine and open-data maps at a meetup; enter the hackathon with austin.chat as the platform | B | 05 §3 |
| Downtown Austin Alliance | XOXO Cultural Curators pays creators ($125 at the 10,000 to 50,000 tier), a videography fellowship with stipend, and open calls for cultural programming | Apply when the next cycle opens; it is paid civic work the map-video skill fits | B | 03 §4 |
| Austin Public Library boards | Commercial advertising banned; librarian approval required; unapproved flyers discarded | Only as a free educational history map (the 1885 tour, the budget map), asked at the desk | C | 01 §3 |
| Coworking spaces, coffee-shop boards | No data | 50 printed cards near UT and East Austin, with a partner's permission | C | 01 §5 |
| Visit Austin partnerships | Corporate sponsorships (Delta, Tito's); 14M site uniques, 30.1M annual visitors; no published listing tier | Ask one question about a listing tier; offer an in-kind planner embed; expect no free link | C | 05 §3 |
| Airport ads ($3,500 to $25,000 per 4 weeks), CapMetro bus and shelter ads ($1,200 to $23,000 per location per month, now Clear Channel), billboards ($2,500 to $8,000 per 4 weeks) | Vendor estimates | - | No | 01 §5, 05 §5 |

### 4.7 Launch platforms

| Platform | Rules | Evidence | What to do | Priority |
|---|---|---|---|---|
| Show HN | Must be tryable without sign-up (austin.chat qualifies); no landing pages; no asking for upvotes; posts last about 2.9 h on page 1 | 4,000 to 11,000 visitors over about 1.5 days, then decay, "no direct conversions" in the best-documented case | One post, "Show HN: a free day planner for Austin on my own pgRouting engine (no sign-up)", 8 to 10 am ET on a weekday, lead with the routing engine and OSM data, stay in the thread all day | B |
| r/dataisbeautiful, r/MapPorn | [OC] with tools and data in a comment; [Interactive] in the title; "selling products is not allowed" on r/MapPorn (mirrors; re-read live sidebars) | Hoodmaps: about 200,000 users and 500,000 uses in two weeks from one coordinated Product Hunt, Show HN and r/dataisbeautiful launch with embeddable maps; 7% of users contributed | Post static exports of the budget, data-center and AISD maps as [OC]; the 1885 Sanborn and Ford maps and the 3D models page as [Interactive]; never mention source-code sales | B |
| r/SideProject, r/webdev Showoff Saturday, Indie Hackers build log | Promotion-friendly | Build logs rank in Google for years | One post each at launch; reply to every comment | C |
| Product Hunt | Company accounts prohibited; no upvote requests; 12:01 am PT | Global SaaS audience; a city site gets curiosity visits | Low priority; if done, frame as "an itinerary planner on OSM and open routing, Austin first" from the owner's personal account | C |

### 4.8 Paid (framed as cost per visit)

| Channel | Price found | ESTIMATE cost per visit | Verdict |
|---|---|---|---|
| Google Search, exact match on "things to do in austin this weekend"-type terms, Austin + 50 mi, mobile | "things to do in austin" about 140,500 US searches a month at about $0.15 CPC on a public Semrush page (UNCERTAIN, page garbled); travel average CPC $2.12 (WordStream) | $0.15 to $0.50 if the Semrush figure holds; $1 to $2 at the travel average; $100 buys 200 to 650 visits | The one paid line worth more than a one-week test: $5 a day for 3 weeks, kill above $1 a visit |
| ATXtoday (6AM City) self-serve newsletter | From $200; text ads $25 to $500; banners $25 to $250; live in 3 business days | about $1.10 a visit at $200 if ATXtoday has about 30,000 subscribers (guess) | One lowest-tier text ad with a UTM |
| Reddit Ads, community targeting r/Austin, r/askaustin, r/austinfood | $5 a day floor; CPM quoted $2 to $9 (UNCERTAIN) | about $0.80 a visit at $4 CPM and 0.5% CTR | One $5 a day, 14-day test, judged only on cost per visit |
| TikTok Promote | about $3 a day (UNCERTAIN) | Buys views, not visits | Only to push an already-performing map video to Austin viewers |
| Nextdoor Ads | Self-serve, near-zero minimum | Unknown CPM | $5 a day test for the classifieds launch |
| Meta geo-targeted | US CPM $10 to $15 | $1.20 or more a visit | Only to amplify videos, measured as views |
| Community Impact (107,000 inboxes, 40%+ open), Chronicle Daily (54,212 subscribers, 28% open), Austin Monthly (65,000 print) | On request | ESTIMATE 150 to 230 clicks per send at 1% click | Ask prices; likely too dear for a free site |
| Micro-influencer posts | Collabstr 15,000-deal average about $198; Austin UGC from $25 a video | A 260-collab study measured +150 to +300 followers per collab, about one week's growth | Do not pay for followers; trade a custom plan map for a "guest itinerary" collab instead |
| Billboards, bus, airport, Chamber, Visit Austin programs, Linktree Pro, paid analytics | See 4.6 | - | No |

---

## 5. The classifieds launch

Appendix 04 holds the sources. The shape below is an ESTIMATE derived from the seven cold-start cases (Craigslist's 250-person email list and apartment wedge, Nextdoor's 90-house HOA pilot, Marketplace formalizing 450M group users, Nextdoor's Free Finds opening free listings to non-members and growing listings 80%, OfferUp metro by metro, Depop from magazine readers, Airbnb door to door) and three failures (Backpage seized, Oodle blocked by Craigslist within months, 3Taps and PadMapper enjoined and fined $1M for scraping Craigslist).

### 5.1 Order of categories

| Phase | Category | Why | Incumbent to beat | Legal line to design around |
|---|---|---|---|---|
| 1 (launch) | Free stuff and curb alerts on the map | Craigslist's largest Austin section (360); Nextdoor says 25% of its listings are free; about 70 walled Buy Nothing groups and a 15,990-member Freecycle list are fragmented; zero money means near-zero scam and legal load | Craigslist 360 posts; Nextdoor "1,000+" listings | none |
| 1 (launch) | Garage and estate sales by neighborhood | Craigslist Austin has 13; Marketplace has no sale-event type; dated pins and a Saturday-morning use case; a natural weekly Short | 13 posts | Texas: 1 to 2 sales a year or $3,000 of personal items before a sales-tax permit (one line on the form) |
| 2 (late April, early November) | Sublets and lease takeovers near UT and ACC | About 45,000 UT students live off campus; r/AustinHousing grows 90% a year on sublease and roommate posts; UT's own tool needs a Facebook login; Craigslist has 45 | 45 posts | Fair Housing Act: free text only, no tenant-attribute drop-downs or targeting (the Roommates.com and HUD v. Facebook trap); Equal Housing line on every post; roommate ads are exempt (9th Cir. 2012) |
| 2 (when ACL and F1 tickets go on sale) | Face-value swaps of transferable tickets | r/AustinClassifieds runs a Tickets Megathread; Craigslist has 19; Facebook restricts tickets to approved sellers; Texas has no resale price cap, SB 1820 died in committee, bots are banned (ch. 328) | 19 posts | UT Big Ticket, SXSW wristbands and tampered ACL wristbands are non-transferable and APD has made felony arrests over wristband resale: show the venue's transfer rule on the form and disallow those |
| 3 | Musicians and gigs | Craigslist still has 161 musician posts; r/AustinMusicians grows 40% a year; Facebook bans job posts; on-brand for Austin, low scam rate | 161 posts | none special |
| 3 | Non-pet lost and found | Craigslist has 37; pets already have strong city-recommended Facebook groups | 37 posts | Link out to the pet groups; do not compete |
| Later or never | Pet rehoming (rehoming-only, fee capped, link to the City's Home To Home), gig work (spam magnet), event rideshares, neighborhood services (lead-gen spam), personals, massage, firearms, animal sales | - | - | FOSTA killed Craigslist Personals in a week; Armslist litigation runs a decade; Austin bans public-space animal sales |

### 5.2 Mechanics that drove adoption elsewhere

| Mechanic | Evidence | For austin.chat |
|---|---|---|
| Open to read, gated to post | Nextdoor's Free Finds grew listings 80% by letting non-members browse | Everything readable and mappable without login; the existing Google and email-code sign-in only to post or reply |
| Map-first browsing | Craigslist Austin's list UI shows an 80.6% bounce (UNCERTAIN, subdomain estimate) | Posts are pins with a neighborhood, not an address; dated pins for sales; a campus-distance filter for sublets |
| Hand seeding with permission | Craigslist, Nextdoor, Airbnb all did it | The owner posts the first 30 to 50 real items (own garage, friends, a neighborhood association); never scrape |
| Email alerts and saved searches | Craigslist steers users from RSS to saved-search alerts; want-ads are the top flairs on r/AustinClassifieds | "Alert me when X is posted within N miles" by email (Supabase already there); a want-ad is a public saved search |
| Share card, not auto-posting | Marketplace let sellers cross-post to groups at launch | Every post gets an OG image with its map pin so posters paste it into Buy Nothing and neighborhood groups themselves; never auto-post into groups |
| Expiry and renewal | Craigslist: 7 to 45 days free | 14-day default, one-click renew from the email, "claimed" button that keeps the pin grey for a day as proof of liquidity |
| RSS, GeoJSON and embeds per neighborhood | Oodle lived as a feed for others | A one-line embed for neighborhood-association sites: they are the HOA boards of the Nextdoor playbook |
| Weekly Short | - | "This Saturday's garage sales on the map" and "free stuff posted this week" are the seeding loop from an audience the owner already owns |

### 5.3 Trust and legal kit for day one

- Safe-exchange layer: all four APD stations (HQ 715 E 8th St; Central East 812 Springdale Rd; South 404 Ralph Ablanedo Dr; North 12425 Lamplight Village Ave) plus Pflugerville, Manor, Round Rock, Cedar Park, Georgetown, Kyle, Buda and Lockhart police lots, shipped as a map layer. None of the incumbents show this on a map.
- Anonymous flagging with a two-flag auto-hide (Craigslist's model: about 50 staff ran about 700 cities in 2019).
- Phone verification only for housing, tickets and anything over about $200; one number per account, never displayed.
- Keyword blocks for weapons, adult, animals and MLM; a "no money changes hands on this site" banner.
- Section 230-shaped terms (you host, you do not write), DMCA agent registration at the Copyright Office, Equal Housing line on housing posts, a published prohibited list in the spirit of Craigslist's, no sale of data (Texas Data Privacy and Security Act small-business exemption applies; the one rule left is never sell sensitive data), no checkout ever (keeps the INFORM Act at zero countable transactions and avoids Lyte's custody collapse).
- ESTIMATE moderation load: at 50 new posts a day with verification, filters and auto-hide, 5 to 15 decisions a day, 15 to 30 minutes.

---

## 6. The 90-day calendar and the Austin demand year

### 6.1 Ninety days (recommendation; weeks are the owner's working weeks)

| Week | Build (Engine 1) | Video and social (Engine 2) | Community, press, partners | Classifieds (Engine 3) | Measure |
|---|---|---|---|---|---|
| 1 | robots, sitemap, Search Console, Bing Webmaster, IndexNow; home-page HTML and description; OG tags on every page | TikTok Business account; place-tag everything from now on; Bluesky account; self-hosted `/go/` links | Claim the Nextdoor Business Page; join 5 neighborhood Groups and the Austinites Discord as a person | Decide the two launch categories; write the prohibited list and terms | Umami Hobby plus the Cloudflare beacon live; UTM vocabulary and short-link table in the repo; funnel events wired |
| 2 | `/this-weekend/` and `/today/` built by the Thursday action | First Thursday "this weekend on the map" video with its plan link in bio, Story sticker, pin, Bluesky post and Substack issue | Submit the next dated tour runs to Chronicle, KUT, Austin Monthly, ATXtoday, Austinot, Eventbrite, Do512; Visit Austin for special dates only | Safe-exchange layer and flag button built | First Monday review |
| 3 | Event leaf pages with Event JSON-LD | Trial Reels: map-only vs narrator cut of the same plan | Airbnb-host kit (QR card PDF plus three-line message) to 10 hosts and 5 concierges; email Austin Newcomers Club and the History and Culture Meetup organizer | Seed 30 to 50 free-stuff and garage-sale posts by hand | - |
| 4 | First 20 neighborhood pages pre-rendered | Evergreen long-form "how to plan your Austin weekend"; verify the channel for links | Pitch Silicon Hills News and City Cast Austin; submit an ATXplained question | Soft launch: one Nextdoor Business post, one Short | Check Keyword Planner once; record volumes |
| 5 to 6 | Remaining 46 neighborhood pages; Apple Business Connect | Weekly cadence holds; one Pinterest pin per new page | Show HN (routing-engine angle), r/SideProject, r/MapPorn [Interactive] in one week, all UTM'd | Garage-sale Saturday Short every week | $5 a day Google exact-match test starts; one ATXtoday text ad |
| 7 to 8 | 8 to 12 itinerary pages (owner copy); Trail of Lights template by 1 Dec | Guest-itinerary collab with one Austin creator (trade a custom plan map) | Email 10 neighborhood associations from the Community Registry with their page; pitch Austin Towers with the 3D models page | Neighborhood-association embed and RSS | Kill any paid line above $1 a visit |
| 9 to 10 | Core Web Vitals pass; annual `/sxsw/`, `/acl/`, `/f1/`, `/ut-game-day/` shells | Pinterest boards for SXSW no-badge and bachelorette (March content up in January) | Read r/Austin rules in a browser and modmail; one "I made this map" post if the mods say yes | Prepare the sublet category for late April; ticket-swap rules text | Month-3 review against the targets in section 7 |
| 11 to 13 | Weekly rebuilds running unattended | Holiday plan template and Trail of Lights Short | UT Marketplace table (if it still runs); Open Austin meetup | - | Decide what to stop and what to double |

### 6.2 The demand year (publish 3 to 4 weeks ahead; outlets run their guides 1 to 3 weeks ahead)

| When | Event | Numbers | Content and pitch deadline | Note |
|---|---|---|---|---|
| January | Pinterest travel searches +300% month over month at New Year | - | Pin March content now | 02 §6 |
| Mid-March | SXSW | 309,300 attendees in 2025; 2026 held near that | "SXSW without a badge" pages and pins by mid-February; City Cast and Chronicle pitches late February; press passes exclude brand content producers, so no credentials | 05 §4, 03 §4 |
| Late March to early April | Chronicle Best of Austin round 1 | 33,055 voters in the 2025 final | Nomination push to the owner's audience | 05 §1.2 |
| Late April and early November | Student sublet seasons | about 45,000 UT students off campus | Sublet map live two weeks before | 04 §3 |
| March to June, September to October | Bachelorette peaks; Google interest peaks mid-September | Austin ranked #1 US bachelorette destination (Thumbtack) | Bachelorette template live by late February | 05 §3 |
| August move-in week | UT | r/UTAustin about 118,000 | "Things to do near campus" map | 01 §2 |
| September to November | UT football at DKR | capacity 100,119, sold out 2025 and 2026 | Friday game-day plans | 05 §4 |
| October (two weekends) | ACL Fest | about 75,000 a day over six days; $557.8M impact in 2025 | Content live by mid-September | 05 §4 |
| October (third weekend) | F1 at COTA | 432,000 (2023); 2025 sold out, about 380,000 to 400,000 | "F1 weekend off-track" plan; high-income, out-of-town, three days | 05 §4 |
| 10 to 23 December | Trail of Lights | about 400,000 (UNCERTAIN) | Holiday template by 1 December | 05 §4 |

---

## 7. Measurement

- **Tools (all $0 on GitHub Pages):** Umami Cloud Hobby (100,000 events a month, custom events) for the funnel, plus the Cloudflare Web Analytics beacon as a second opinion because ad-blockers undercount. GoatCounter is a free alternative. Plausible has no free tier.
- **Funnel events:** visit (by referrer and UTM); planner_started (first item ticked); plan_saved (guest or signed in); plan_shared; route_opened; a first-party localStorage "seen before" flag that marks returning visits without cookies or identifiers; classified_posted and classified_contacted once live; tour_started.
- **UTM discipline:** fixed lower-case vocabulary (source: tiktok, instagram, pinterest, bluesky, youtube, substack, reddit, hn, citycast, atxtoday, airbnb-kit, ut-marketplace, qr-card, google-ads, reddit-ads, nextdoor-ads; medium: social, video, newsletter, print, cpc, referral; campaign: the event or month); one `/go/<slug>` per placement so QR cards stay clean; never post the bare domain where a tagged link is possible.
- **Monday review, 20 minutes:** visits and Austin share; top five sources with planner_started each; the funnel ratios; returning share; classifieds posts and contacts; paid spend and cost per visit (kill above $1 after two weeks); pitches sent, replies, links earned; videos and templates shipped and which drove the most planner_started; one thing to stop, one to double. Findings go into docs/STATUS.md.

| Benchmark | Numbers | Label |
|---|---|---|
| CityXee, a solo city guide, year one | 42,000 visits and 130,000 pageviews, about 3,500 visits a month | FACT |
| 365 Things Austin today | about 7,600 visits a month, 58% search | FACT |
| Do512 today | about 138,000 visits a month, 66% search | FACT |
| Visit A City (travel-guide SEO case) | 28,500 to 199,700 monthly visits in six months by growing from 1,600 to 16,000+ URLs | FACT: scale needs thousands of indexable pages |
| **Target, month 6** | 2,000 to 4,000 visits a month, at least 40% from Austin, at least 10% planner_started | ESTIMATE |
| **Target, month 12** | 5,000 to 10,000 visits a month if the neighborhood and category pages are indexed and one event cycle (SXSW or ACL) runs with templates plus a City Cast or Chronicle mention | ESTIMATE |

---

## 8. What not to do (consolidated, each sourced in the appendix named)

1. Do not post a launch thread on r/Austin without reading the sidebar and getting a mod reply; do not drip-promote there (01, 03).
2. Do not promote from a personal Nextdoor account; the 19 Aug 2026 policy down-ranks it (01).
3. Do not create a Google Business Profile for an online-only brand; profiles get suspended (02).
4. Do not mark hours, happy hours or promos as Event markup, and do not put Event markup on a list page without leaf URLs (02).
5. Do not mint a new URL every week or year for the weekend and event pages; the winners keep one URL and change its dates (02).
6. Do not rely on JS-only or iframe-only pages for anything that should be found (02).
7. Do not spend on llms.txt, "AI SEO" vendors or AI referrals as a channel (02).
8. Do not re-upload watermarked TikTok exports to Reels or Shorts; render each cut from source (03).
9. Do not paste URLs into Shorts descriptions or TikTok captions expecting clicks; do not put the link in the main post on X (03).
10. Do not pay for Linktree, followers, engagement bait ("comment for the link") or micro-influencers expecting followers (03).
11. Do not apply for SXSW press credentials as a brand content producer; they are excluded (03).
12. Do not seed classifieds with scraped Craigslist, Facebook or Nextdoor posts (3Taps: injunction and $1M), and do not advertise the board on Craigslist (04).
13. Do not launch personals, massage, escort, firearms or animal-sale categories; do not build tenant-attribute filters for housing; do not list non-transferable tickets; do not take custody of money or tickets (04).
14. Do not pitch the Austin Monitor (closed), the Austin Current with a product launch, or the KVUE Defenders line (05).
15. Do not ask for upvotes on Show HN or Product Hunt; do not launch from a company account; do not Show HN a landing page (05).
16. Do not buy billboards, bus or airport ads, Chamber membership, Visit Austin programs, the Chronicle calendar upsell, library flyers without approval, or Meta ads for site visits (01, 05).

---

## 9. Gaps the owner should close (could not be verified this session)

| Gap | Why it was blocked | How to close |
|---|---|---|
| r/Austin, r/austinfood, r/UTAustin, r/AustinClassifieds rule text and megathread schedule | reddit.com and mirrors blocked for fetching | Open the about/rules pages in a browser; copy into appendix 01; modmail |
| Facebook group sizes and posting rules (New to Austin, Girls New To Austin, Austin buy/sell groups, Austin STR host groups) | facebook.com not fetchable | Check in-app; DM admins |
| Keyword volumes ("things to do in austin" and the weekend, itinerary, neighborhood and bachelorette families) | Public Semrush pages 404 or garbled | One session in Google Keyword Planner (free); record in the repo |
| Whether Nextdoor grants a Business Page to an online-only site | Not stated in the policy | Try to claim it |
| Visit Austin listing tier and price; Do512 and Chronicle rate cards; Community Impact single-edition price | Pages 403 or on request | One email each |
| Whether UT Marketplace still runs and its terms; UT orientation vendor terms | 2022 listing only | Email Texas Student Media |
| Austin Chronicle Best of Austin: is there a website or app category in 2026/27 | 2025 PDF not fetched | Read the ballot when round 1 opens |
| TikTok's own link-in-bio rule page; Instagram Recommendation Guidelines page | Empty responses | Verify in-app before relying on the Business-account shortcut |
| Conversion rate of pre-filled itinerary links; Austin-specific creator rates; map-animation vs talking-head performance | No published data anywhere | The site's own analytics after month one |

---

## 10. Sources

The five research notes and the site audit hold about 250 source links, each tagged FACT, ESTIMATE or UNCERTAIN beside the claim it supports:

- `appendix/00-brief.md` — the shared brief the agents worked from
- `appendix/01-local-channels.md` — Reddit, Facebook, Nextdoor, Discord, Meetup, calendars, newsletters, offline, precedents (Do512, 365 Things, Hoodmaps, Austin Towers)
- `appendix/02-search-seo.md` — SERP snapshots, competitor traffic, page programme, Google feature eligibility, AI-assistant citation studies, Pinterest and YouTube, technical constraints, local link targets
- `appendix/03-social-video.md` — Austin and other-city account case studies, platform link rules, formats and decay data, creator rates, the Toronto collab study, social-to-site mechanics
- `appendix/04-classifieds.md` — Austin classifieds landscape with live counts, cold-start cases and failures, category evidence, Section 230, FOSTA, Fair Housing, Texas ticket and privacy law, scam patterns, safe-exchange zones
- `appendix/05-launch-pr-paid.md` — outlet-by-outlet press table, Best of Austin mechanics, Show HN and Product Hunt rules and traffic, partnerships, the event calendar with attendance figures, paid benchmarks, analytics tools, review template, traffic benchmarks
- `appendix/06-site-audit.md` — what was counted in the repository on 2026-10-29

Method: five research agents, one angle each, 29 October 2026, about 90 to 140 tool calls apiece; synthesis and the site audit by hand. A printable PDF of this plan is beside it; `scripts/make_pdf.py` rebuilds it.
