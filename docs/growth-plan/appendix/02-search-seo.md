# 02 — Search, SEO and AI search for austin.chat (things to do + day planner)

Research date: 2026-10-29. Angle: how people search for Austin things-to-do / itineraries, who ranks, what a one-person GitHub Pages site can win, AI-assistant citation, Pinterest/YouTube as search, technical constraints, local links.

Tags: **FACT** = sourced claim (URL follows); **ESTIMATE** = my arithmetic or reading, shown; **UNCERTAIN** = could not verify from a primary source.

Research limits hit this session: DuckDuckGo HTML served a bot-check and Bing's result pages degraded after a few queries, so SERP snapshots are Bing only, from the first clean fetches. Semrush public "website overview" pages exist only for larger domains (404 for 365thingsaustin.com, austin.com, seekaustin.com, heyaustin.com, austinot.com, atxweekly.com). No clean public keyword-volume table could be fetched; volumes below are ESTIMATE/UNCERTAIN and should be checked once in Google Keyword Planner (free with a Google Ads account, no spend needed).

---

## 1. Top findings (short)

1. **The money query is owned by giants, the weekend query is owned by small local sites.** On Bing, "things to do in austin" top 10 = US News, Tripadvisor (x2), Time Out, Visit Austin (x2), Travel+Leisure, Seek Austin, Atlas Obscura, 365 Things Austin. But "things to do in austin this weekend" top 10 = Eventbrite (x2), ATX Weekly, Hey Austin, Austinot, Visit Austin (x2), 365 Things Austin, austin-texas.net, KidsOutAndAbout — five of those are tiny one-person-scale sites. FACT: https://www.bing.com/search?q=things+to+do+in+austin and https://www.bing.com/search?q=things+to+do+in+austin+this+weekend (fetched 2026-10-29).
2. **365 Things Austin, the archetype of a small Austin things-to-do site, gets ~22.7K visits per 3 months (~7.6K/month) with 58% from organic search**, ranking for "things to do in austin", "things to do in austin this weekend", "things to do in austin today". FACT: https://www.similarweb.com/website/365thingsaustin.com/ . That is the realistic ceiling for a content-only small site; a site with a real planner tool can aim higher but should expect this order of magnitude from SEO in year one (ESTIMATE).
3. **The site currently has no robots.txt and no sitemap.xml, the home page `<title>` is "Austin.Chat" with no meta description, and the home page body is one `<iframe>` to /chat/.** Google indexes almost nothing from that. FACT: repo inspection of `/mnt/c/Dev/projects/cityanatomyservices/cityanatomyservices.github.io` (index.html, `ls robots.txt sitemap.xml` → not found). The listing data already exists as 66 static JSON files (`chat/data/places/<neighborhood>.json`, e.g. Allandale = 163 places with name, address, website, opening_hours) and the repo already runs GitHub Actions builds (`.github/workflows/build-places.yml` etc.), so pre-rendering one static HTML page per neighborhood and per category is a build step away, not an architecture change.
4. **Google says plainly: no special markup, no llms.txt, no "AI text file" is needed for AI Overviews / AI Mode — a page just has to be indexed and snippet-eligible.** FACT: https://developers.google.com/search/docs/appearance/ai-features . Google's Mueller: no AI system uses llms.txt. FACT: https://www.searchenginejournal.com/googles-mueller-says-llms-txt-cant-help-llms-differentiate-sites/566027/
5. **AI assistants barely follow Google rankings**: only ~12% of ChatGPT/Gemini/Copilot/Perplexity citations are in Google's top 10 for the query (Perplexity 28.6%; the others ~8%); AI Overviews do follow the SERP (76% from top 10). FACT: https://ahrefs.com/blog/ai-search-overlap/ . So long-tail pages that never rank #1 can still be cited.
6. **Freshness is the strongest documented citation signal**: 75% of pages cited by ChatGPT/Gemini/Perplexity were updated within the last year; updates beat new publishing (72% fresh by update vs 42% by publish date). FACT: https://www.seerinteractive.com/insights/study-content-recencys-impact-on-ai-visibility-in-2026 . A dated weekend page that is rebuilt every week is exactly this.
7. **AI referrals are still tiny for travel**: 0.37% of traffic across 41 UK travel sites; Google sends 65x more. FACT: https://www.abta.com/industry-zone/partner-insights/how-much-traffic-do-llms-send-travel-websites-2026 . Do the AI work because it is the same work as SEO, not for the traffic.
8. **Google Business Profile is NOT available to the brand** ("Brands, organizations, artists, and other online-only businesses" are ineligible; a business "must make in-person contact with customers"). FACT: https://support.google.com/business/answer/13763036 . **Apple Business Connect IS open** to businesses that "operate fully online or without a physical location", free. FACT: https://www.apple.com/newsroom/2024/10/apple-expands-tools-to-help-businesses-connect-with-customers/
9. **Google "Things to do" (ticket/tour modules) is only for attraction businesses and tour operators via their Business Profile; the ItemList "aggregator" carousel for things-to-do is only live in the EEA, Türkiye and South Africa.** A US content site cannot feed either. FACT: https://support.google.com/business/answer/12944910?hl=en and https://developers.google.com/search/docs/appearance/structured-data/carousels-beta
10. **Event rich results are open to anyone, but each event needs its own URL** ("Each event MUST have a unique URL (a leaf page) and markup on that URL"), physical location, bookable by the public. Eventbrite saw "roughly a 100-percent increase in the typical year-over-year growth of traffic" to event pages the month after adding Event markup. FACT: https://developers.google.com/search/docs/appearance/structured-data/event and https://developers.google.com/search/case-studies/eventbrite-case-study

---

## 2. How people search

### 2.1 Keyword families (what to build pages for)

| Family | Example queries | Volume evidence | Intent / who | Page type to win it |
|---|---|---|---|---|
| Head "things to do" | things to do in austin; austin things to do; fun things to do in austin | UNCERTAIN. A Semrush public page for austintexas.org listed "things to do in austin" as a top keyword; one scrape read the US volume as ~140,500/mo, another read "5,000" — the table is garbled (https://ja.semrush.com/website/austintexas.org/overview, now 404). ESTIMATE: a six-figure monthly US volume is consistent with Tripadvisor/US News/Time Out all holding year-stamped pages for it. | Visitors + locals, broad | Not winnable head-on in year one; the home page should still target it (title/H1) so the brand accrues |
| Time-boxed | things to do in austin this weekend; things to do in austin today; events in austin today; austin this weekend | FACT: "events in austin today" is a top organic keyword for do512.com (https://www.similarweb.com/website/do512.com/); "things to do in austin this weekend" and "things to do in austin today" are top keywords for 365thingsaustin.com (https://www.similarweb.com/website/365thingsaustin.com/) | Locals, Thu–Sat | **Primary target.** One always-current `/this-weekend/` URL (same URL every week, dated H1) + `/today/`; plus archive pages per weekend date |
| Itinerary | austin itinerary; 3 days in austin; austin 3 day itinerary; one day in austin; weekend in austin | UNCERTAIN volume. FACT: Visit Austin ranks a "perfect-3-day-austin-itinerary" post in the top 10 for the *weekend* query (https://www.bing.com/search?q=things+to+do+in+austin+this+weekend); the "austin 3 day itinerary" Bing SERP is weak (Wikipedia, city site, KXAN, UT in top 10) (https://www.bing.com/search?q=austin+3+day+itinerary) | Visitors, 2–8 weeks out | **Winnable.** Static itinerary pages (1-day, 2-day, 3-day, by neighborhood, by crowd) that open in the planner |
| Neighborhood | things to do in east austin; south congress things to do; rainey street; mueller austin | UNCERTAIN volume (no clean source fetched) | Both | **Winnable.** 66 neighborhood JSONs already exist → `/neighborhoods/<slug>/` static pages |
| Audience | austin with kids; things to do in austin with kids; austin bachelorette; austin bachelorette itinerary | FACT: Google Trends "bachelorette" interest in Austin peaks mid-September, paired with "disco", "brunch", "bachelorette party games" (https://digital-release.kxan.com/?p=1621402). FACT: do512family.com / austinwithkids.com / austinmoms.com exist as dedicated competitors (https://www.similarweb.com/it/website/austinmoms.com/competitors/) | Groups, parents | Winnable with pre-built plans ("Bachelorette Saturday on Rainey", "Rainy day with kids") |
| Event-driven | sxsw without a badge; things to do during f1 weekend austin; acl weekend; ut game day austin | FACT: austintexas.org ranks for "austin city limits 2026" (https://www.similarweb.com/website/austintexas.org/); Bing video search for "austin itinerary" during F1 week was dominated by F1 TikToks (https://www.bing.com/videos/search?q=austin+itinerary) | Visitors, spiky | Annual pages with stable URLs (`/sxsw/`, `/f1/`, `/acl/`), refreshed each year — never a new URL per year |
| Category | best breakfast tacos austin; live music tonight austin; swimming holes near austin; free things to do austin | UNCERTAIN | Both | Category pages from the existing OSM categories; the shopping apps (pizza, toy stores, bike shops…) already are this |

### 2.2 Seasonality (ESTIMATE / weak evidence)
- "Near me" searches peak on weekends and around July 4 and the week after Christmas (2018 analysis of Google Trends, not peer-reviewed). FACT: https://blumenthals.com/blog/2018/12/22/near-me-searches-peak-on-weekends-in-search-of-mind-altering-substances/
- Pinterest travel searches run 8–12 weeks ahead of travel (marketing-blog claim). UNCERTAIN: https://www.socialmediatoday.com/social-business/making-travel-plans-pinterest-what-marketers-need-know-infographic
- ESTIMATE: Austin visitor demand clusters in March (SXSW), October (ACL + F1), plus UT home game weekends; the right move is to have those pages indexed 2–3 months before, because search engines need time to discover and rank them, and AI engines reward recently *updated* pages (see §5).

---

## 3. Who ranks today and why

### 3.1 SERP snapshots (Bing, 2026-10-29)

**"things to do in austin"** — 1 travel.usnews.com, 2 tripadvisor.com, 3 timeout.com, 4 austintexas.org/things-to-do/, 5 tripadvisor.com, 6 travelandleisure.com, 7 austintexas.org blog, 8 seekaustin.com, 9 atlasobscura.com, 10 365thingsaustin.com. FACT: https://www.bing.com/search?q=things+to+do+in+austin
Why they win: domain authority + a year in the title ("(2026)") + big lists (25/30/51 items). Seek Austin (#8) and 365 Things (#10) are small sites; both use the exact phrase as the page title and keep the page updated.

**"things to do in austin this weekend"** — 1–2 eventbrite.com, 3 atxweekly.com/calendar, 4 heyaustin.com/this-weekend-in-austin/, 5 austinot.com/things-to-do-in-austin-this-week (title carries the dates: "October 23-25"), 6 austintexas.org/events/things-to-do-this-weekend/ (title "Oct 30-Nov 1, 2026"), 7 365thingsaustin.com/top-picks-for-the-weekend/, 8 austin-texas.net/events/this-weekend/, 9 austintexas.org 3-day itinerary post, 10 austin.kidsoutandabout.com. FACT: https://www.bing.com/search?q=things+to+do+in+austin+this+weekend
Why they win: **one permanent URL per site whose title and H1 carry this week's dates**, refreshed weekly. This is the pattern to copy exactly.

**"austin 3 day itinerary"** — top 10 is generic (Wikipedia, austintexas.gov, austintexas.org, US News, KXAN, utexas.edu, seekaustin.com, Tripadvisor, austincurrent.org). FACT: https://www.bing.com/search?q=austin+3+day+itinerary . A thin SERP = open opportunity.

### 3.2 Competitor traffic (public Semrush / Similarweb, Sep 2026 data unless noted)

| Site | Est. visits / mo | Organic share | Authority | Notes | Source |
|---|---|---|---|---|---|
| tripadvisor.com | 103.5M total | — | 100 | "things to do in" city pages are the classic programmatic-SEO example | https://www.semrush.com/website/tripadvisor.com/overview/ |
| timeout.com | 9.6M total; 6.0M organic | — | 77 | | https://www.semrush.com/website/timeout.com/overview/ |
| wanderlog.com | 6.3M total | ~30% from google.com (Sep 2025) | 78 | top keywords are brand + venue names ("jamul casino", "newport music hall") = programmatic place pages | https://www.semrush.com/website/wanderlog.com/overview/ ; https://cw.semrush.com/website/wanderlog.com/overview |
| atlasobscura.com | 6.3M total; 2.0M organic | — | 69 | | https://www.semrush.com/website/atlasobscura.com/overview/ |
| culturemap.com (all cities) | 749K total; 222K organic | — | 52 | | https://www.semrush.com/website/culturemap.com/overview/ |
| austintexas.org (Visit Austin) | 614K / 3 months (~205K/mo) | 60.6% organic | — | #196 US Travel & Tourism-Other; keywords: austin texas, visit austin, austin city limits 2026 | https://www.similarweb.com/website/austintexas.org/ |
| do512.com | 352.5K total; 236K organic (Semrush) / 414.5K per 3 mo (Similarweb) | 66.5% organic | 47 | keywords: do512, events in austin today, acl lineup; referrals incl. austinmuseums.org | https://www.semrush.com/website/do512.com/overview/ ; https://www.similarweb.com/website/do512.com/ |
| austinchronicle.com | 281.9K total; 116.8K organic | — | 46 | "renaissance festival" is 9.85% of its organic traffic — event pages drive papers | https://www.semrush.com/website/austinchronicle.com/overview/ |
| 365thingsaustin.com | 22.7K / 3 mo (~7.6K/mo) | 57.9% organic | — | 368 keywords incl. "things to do in austin this weekend/today" | https://www.similarweb.com/website/365thingsaustin.com/ |
| austin.com | 15.3K / 3 mo (~5K/mo) | 36.7% organic | — | 448 keywords; "south congress" | https://www.similarweb.com/website/austin.com/ |

ESTIMATE: an austin.chat that executes §4 well for 12 months lands between austin.com and do512 — i.e. 5K–50K visits/month, mostly from time-boxed and neighborhood long-tail, with the planner as the differentiator none of the small sites have.

---

## 4. What a small static site can realistically win

### 4.1 Page programme (ordered by expected payoff)

| # | Page set | URL pattern | Why it can win | Schema | Build source already in repo |
|---|---|---|---|---|---|
| 1 | This weekend / today | `/this-weekend/` (permanent), `/today/`; archive `/weekends/2026-10-31/` | Small sites hold the SERP today (§3.1); freshness is the top AI-citation signal (§5) | `ItemList` of `Event` (each event also needs its own leaf URL for the Event rich result) | news/ticker/sports builders in `.github/workflows/` |
| 2 | Neighborhood guides | `/neighborhoods/<slug>/` × 66 | Data exists (`chat/data/places/*.json`); competitors have few neighborhood pages | `ItemList` of `LocalBusiness`/`Place` (no Google rich result in the US, but consistent, text-visible data) | `chat/data/places/`, `neighborhoods.geojson` |
| 3 | Itineraries | `/itineraries/3-days-in-austin/`, `/1-day-south-congress/`, `/bachelorette-weekend/`, `/austin-with-kids-rainy-day/` | Thin SERP (§3.1); each page's CTA = "open this plan in the planner" | `TouristTrip` + `ItemList` (schema.org only; no Google rich result) | planner data model |
| 4 | Event-driven annual pages | `/sxsw/`, `/acl/`, `/f1/`, `/ut-game-day/` | Spiky demand, stable URL reused yearly | `Event` leaf pages for the headline dates | — |
| 5 | Category pages | `/best/<category>/` from OSM categories; shopping apps already exist at `/apps/<id>/` | Long tail, "open now" variants from `opening_hours` | `ItemList` of `LocalBusiness` with `openingHoursSpecification` | `chat/data/categories.json`, `opening_hours` field |
| 6 | Movie showtimes | `/movies/today/` | Already in the product; "austin movie showtimes" style queries | `Movie` (Google carousel exists only for Movie lists on host sites) | existing showtimes feed |

Rules that make or break these:
- Every list item must be **text in the HTML**, not only in JS or in the map. Google: content only present after JS "has to survive the render queue", Google still recommends "server-side or pre-rendering", "not all bots can run JavaScript". FACT: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- One stable URL per concept; weekly content changes **inside** the URL. (Pattern of all weekend-SERP winners, §3.1.)
- `<lastmod>` in the sitemap must be true; Google ignores `<priority>`/`<changefreq>`. FACT: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

### 4.2 Google features: what is open and what is closed

| Feature | Open to austin.chat? | Rule | Source |
|---|---|---|---|
| Event rich results ("events search experience") | **Yes** | unique leaf URL per event; `name`, `startDate`, `location` with address; physical, public events; no business hours / promos as events; Google may take manual action for violations | https://developers.google.com/search/docs/appearance/structured-data/event |
| Carousel (host carousel, ItemList) | Only with Recipe, Course, Restaurant, Movie | TouristAttraction / TouristTrip / Place are **not** rich-result types | https://developers.google.com/search/docs/appearance/structured-data/search-gallery |
| Carousels beta for travel/local ("things to do") | **No** — EEA, Türkiye, South Africa only; interest form | ItemList of LocalBusiness/Product/Event, ≥3 items, same-domain detail URLs | https://developers.google.com/search/docs/appearance/structured-data/carousels-beta |
| Google "Things to do" ticket/tour modules | **No** — "All attraction businesses and tour operators" via their Business Profile; feed partners for ads | required: activity name + booking URL | https://support.google.com/business/answer/12944910?hl=en ; https://developers.google.com/actions-center/verticals/things-to-do/guides/partner-integration/overview |
| Google Business Profile for the brand | **No** — "Brands, organizations, artists, and other online-only businesses" ineligible | UNCERTAIN: the two GPS walking tours might qualify as a "tour operator" only if there is in-person contact; a self-guided app does not meet "make in-person contact with customers during its stated hours" | https://support.google.com/business/answer/13763036 |
| Bing Places | UNCERTAIN (official FAQ redirected to a marketing page; third-party guides say free, with "Import from Google") — with no GBP, nothing to import | | https://blogs.bing.com/search/October-2025/Introducing-the-New-Bing-Places-for-Business-Built-for-Business-Owners,-Powered-by-Research |
| Apple Business Connect | **Yes** — "every business — including those that provide a service or operate fully online or without a physical location"; free; Branded Mail (logo in Mail) | | https://www.apple.com/newsroom/2024/10/apple-expands-tools-to-help-businesses-connect-with-customers/ ; https://support.apple.com/guide/apple-business-connect/intro-abcb205640e7/web |
| Local business knowledge panel for listed places | Not yours to claim; link out to each business's Google/Apple/Yelp (already done in the apps) | | — |

### 4.3 Programmatic-SEO evidence
- Tripadvisor's "Things to Do in <city>" pages are the canonical programmatic example; site is at 103.5M visits/mo. FACT: https://backlinko.com/programmatic-seo ; https://www.semrush.com/website/tripadvisor.com/overview/
- Wanderlog's organic keywords are venue names (programmatic place pages), 6.3M visits/mo. FACT: https://www.semrush.com/website/wanderlog.com/overview/
- A local parenting magazine got 3,200 pageviews in Halloween week from one "[State] trick-or-treating laws" page; its agency flagged "things to do this weekend near me" as a target pattern. FACT: https://blog.twentyfirstdigital.com/case-study-local-parenting-magazine-increases-search-traffic-by-43
- A Tahoe venue's local event pages "drove the most qualified traffic"; one artist-event keyword rose from position 101 to 16. FACT: https://videos.brightedge.com/case-studies/tahoe-south-noble-case-study.pdf
- Warning: programmatic pages that only chase keywords read as thin content; Wise's currency pages are cited as the good counter-example because they solve a task. FACT: https://gracker.ai/blog/10-programmatic-seo-case-studies--examples-in-2025 . The planner is the "task" that keeps austin.chat's pages from being thin.

---

## 5. Being cited by AI assistants

| Claim | Status | Source |
|---|---|---|
| Google: "no extra requirements" for AI Overviews/AI Mode; no special schema, no "AI-specific text files"; page must be indexed and snippet-eligible; AI traffic shows in Search Console under "Web" | FACT | https://developers.google.com/search/docs/appearance/ai-features |
| Mueller: "No AI system currently uses llms.txt"; server logs show bots not requesting it; comparable to the keywords meta tag | FACT (press reports of his statements) | https://www.searchenginejournal.com/googles-mueller-says-llms-txt-cant-help-llms-differentiate-sites/566027/ ; https://searchengineland.com/google-says-normal-seo-works-for-ranking-in-ai-overviews-and-llms-txt-wont-be-used-459422 |
| ChatGPT search: allow `OAI-SearchBot` in robots.txt; sites that block it "will not be shown in ChatGPT search answers"; ~24 h to take effect; `GPTBot` (training) is a separate decision; `ChatGPT-User` may ignore robots.txt | FACT | https://developers.openai.com/docs/bots |
| Perplexity: allow `PerplexityBot` to appear in results; `Perplexity-User` "generally ignores robots.txt" | FACT | https://docs.perplexity.ai/guides/bots |
| ChatGPT draws on Bing (and may fall back to Google); Copilot = Bing; Perplexity has its own index; assistants "fan out" to query variants and merge with reciprocal rank fusion, so a page ranking #6 for several variants beats #1 for one | FACT (Ahrefs analysis; Bing dependency is reported by Ahrefs, not an OpenAI doc fetched here) | https://ahrefs.com/blog/ai-search-overlap/ |
| Only ~12% of assistant citations are in Google's top 10 (Perplexity 28.6%, others ~8%); AI Overviews: 76% from top 10 | FACT | https://ahrefs.com/blog/ai-search-overlap/ |
| 75% of cited pages updated within 12 months; 88% within 24; Gemini strictest (78%), Perplexity most tolerant (65%); marketplaces/comparison pages are the freshest cited types (78%/77%), blogs 67%, news 45% | FACT (4 brands, Mar–Jun 2026, 7,683 pages) | https://www.seerinteractive.com/insights/study-content-recencys-impact-on-ai-visibility-in-2026 |
| Reddit = 6.6% of all Perplexity citations (46.7% of its top-10 share), 2.2% for AI Overviews, 1.8% for ChatGPT; Wikipedia = 7.8% of ChatGPT citations; YouTube 1.9–2.0% for AIO/Perplexity | FACT (Profound, 680M citations Aug 2024–Jun 2025) | https://www.tryprofound.com/blog/ai-platform-citation-patterns |
| Only ~11% of domains are cited by both ChatGPT and Perplexity | FACT (vendor study) | https://llmpulse.ai/blog/glossary/platform-citation-patterns-in-ai/ |
| In Google AI Mode travel tests, users clicked operator/branded links 56% of the time, OTAs <10%; content sites (YouTube, blogs, Tripadvisor) got more than OTAs; "having more content out there … is key" | FACT (Arival, Sep 2025, NYC/Paris/Vancouver) | https://arival.travel/?p=193361 |
| LLM traffic = 0.37% of traffic for 41 UK travel sites; Google sends 65x more | FACT | https://www.abta.com/industry-zone/partner-insights/how-much-traffic-do-llms-send-travel-websites-2026 |
| ChatGPT referral traffic to websites +206% YoY (Jan 2025→Jan 2026, 200M-user US panel) | FACT (Semrush, via secondary) | https://www.semrush.com/news/379285-new-semrush-study-reveals-chatgpt-search-trends-insights-from-80-million-clickstream-records/ |
| Bing indexing matters because ChatGPT and Copilot read it; IndexNow pushes URLs to Bing/Yandex/Naver/Seznam/Yep instantly (key file + GET `https://api.indexnow.org/indexnow?url=…&key=…`, up to 10,000 URLs per POST) | FACT | https://www.indexnow.org/faq |

What this means for austin.chat (ESTIMATE, from the facts above): (a) pages must exist as indexable HTML — the current iframe home page cannot be cited; (b) weekly-rebuilt dated pages with a visible "Updated <date>" and a true `dateModified` are the single highest-leverage AI move; (c) register in Bing Webmaster Tools and ping IndexNow from the GitHub Action after each build; (d) do not spend time on llms.txt beyond a 5-minute file; (e) Reddit presence matters for Perplexity more than for Google (another agent's angle).

---

## 6. Pinterest and YouTube as planning search engines

### Pinterest
- Pinterest: "over one billion travel-related searches and over 10 billion travel saves in one year"; "8 in 10 weekly Pinterest users turn to Pinterest when planning" summer trips; "travel vision board" +210%, "packing guide" +480% YoY. FACT (Pinterest summer-travel report, Apr 2024): https://www.socialmediatoday.com/news/pinterest-shares-insight-into-summer-travel-trends/714095/
- Pinterest 2025/26 New-Year data: "Travel" searches +300% vs prior month; "travel vision board" +1,000%; "Travel Inspo" 76% women. FACT (trade press): https://www.fvw.de/international/travel-news/top-source-for-travel-inspiration-pinterest-reveals-where-young-travelers-are-heading-258588
- Older: 3 in 5 Pinterest users use it to plan trips (Deep Focus study, via Skift 2017). FACT, dated: https://skift.com/2017/08/21/from-dreaming-to-departure-how-pinterest-reaches-travelers-throughout-the-entire-customer-journey/
- Action: one tall pin (2:3) per itinerary page and per neighborhood page, text overlay = the exact search phrase ("3 days in Austin itinerary", "Austin bachelorette weekend"), linking to the static page. Cost: free. ESTIMATE: Pinterest pins keep sending traffic for months, which suits evergreen itinerary pages better than weekend pages. The "Austin bachelorette" niche (Pinterest skews female; KXAN's September peak) is the best fit.

### YouTube
- YouTube search "austin texas itinerary" top results (fetched 2026-10-29): "11 Things to do in Austin" (Adam and Madalyn, 414,893 views, 3 y), "Our PERFECT Weekend in AUSTIN" (The Endless Adventure, 254,469, 2 y), "Exploring Austin: 16 Things to Do" (Through My Lens, 223,374, 3 y), "ULTIMATE 2 days in Austin & Hill Country" (Adventures of A+K, 129,954, 1 y), "3 Days in Austin" (pris daily, 53,653, 3 weeks), "AUSTIN TRAVEL GUIDE" (Jumping Places, 47,142, 4 mo); explicit "itinerary"-titled videos by small channels sit at 197–951 views. FACT: https://www.youtube.com/results?search_query=austin+texas+itinerary (parsed from page JSON).
- Reading (ESTIMATE): the format that wins YouTube search is "N things to do / weekend in Austin" vlogs with a human on camera; the "itinerary with prices" format gets almost nothing. The owner's strength (map videos, Shorts) should feed search with titles that copy the winning phrasing and a pinned link to the matching planner page. YouTube is 1.9–2.0% of AI Overview/Perplexity citations (§5), so a video per itinerary also feeds AI answers.
- No YouTube keyword volumes were obtainable (Ahrefs' YouTube keyword tool reported "under maintenance"). UNCERTAIN: https://ahrefs.com/youtube-keyword-tool/?country=us

---

## 7. Technical constraints (GitHub Pages, JS maps)

Audit of the live repo (`/mnt/c/Dev/projects/cityanatomyservices/cityanatomyservices.github.io`, 2026-10-29) — all FACT from file inspection:
- **No `robots.txt`, no `sitemap.xml`.**
- `index.html`: `<title>Austin.Chat</title>`, canonical set, **no `<meta name="description">`**, body = `<main><section class="map-hero"><iframe src="/chat/">`. The crawlable text of the home page is effectively nothing.
- `/myplanmap/index.html`: has a title and description, body is again one iframe to `/planner/app.html`.
- `/apps/austin-pizza/index.html`: title "Pizza in Austin", no description, places live in `data.geojson` rendered by `/shopmap/app.js`.
- `/chat/data/places/*.json` (66 files, e.g. Allandale: 163 places with name, address, website, opening_hours) — this is already a static dataset suitable for pre-rendering.
- GitHub Actions already run data builds (`build-places.yml`, `build-explore.yml`, `build-news-feed.yml`, `build-sports.yml`, `build-ticker.yml`), so a `build-pages` step that writes static HTML + sitemap is in the existing pattern. GitHub documents custom Actions workflows for "deployment from any static site generator". FACT: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub Pages limits: 1 GB site, 100 GB/month soft bandwidth, 10 builds/hour soft limit. FACT: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits . 66 neighborhoods + ~50 weekends/yr + ~30 itineraries + categories = low thousands of small HTML files — far inside limits (ESTIMATE).

What search engines need from this architecture:
| Requirement | Why | Source |
|---|---|---|
| Listing text (names, addresses, hours, descriptions) in the initial HTML of each page; map can stay JS | Google renders JS later in a queue; "not all bots can run JavaScript"; Bing's own guidance recommends dynamic/pre-rendering for JS-heavy sites | https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics ; https://blogs.bing.com/webmaster/october-2018/bingbot-Series-JavaScript,-Dynamic-Rendering,-and-Cloaking-Oh-My |
| Real `<a href>` links between pages (no JS-only navigation, no `#` routes) | "Google can only follow links that are `<a>` elements with an `href`"; fragment URLs are not reliably resolved | https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics |
| No iframe-only pages for anything you want ranked; the home page needs its own H1 + text + links to the page sets | iframes are a separate document; the framing page has nothing to index (FACT by inspection + the Google guidance above) | — |
| JSON-LD may be injected by JS but is safer in static HTML; keep it consistent with visible text | Google allows JS-generated JSON-LD but says to test it; AI-features doc asks that structured data match visible text | https://developers.google.com/search/docs/appearance/ai-features |
| `sitemap.xml` (≤50,000 URLs / 50 MB per file; true `lastmod`) and `robots.txt` that allows Googlebot, Bingbot, OAI-SearchBot, PerplexityBot | | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap ; https://developers.openai.com/docs/bots ; https://docs.perplexity.ai/guides/bots |
| Canonical on every page, one URL per concept (already done on index and myplanmap) | avoid `?v=` and date-param duplicates | https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics (canonical section) |
| Core Web Vitals: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile, mobile; "Core Web Vitals are used by our ranking systems" | MapLibre + Supabase JS on every page will hurt LCP/INP on phones; load the map after first paint on listing pages | https://web.dev/articles/vitals ; https://developers.google.com/search/docs/appearance/page-experience |
| IndexNow ping from the build action for Bing/Copilot/ChatGPT freshness | | https://www.indexnow.org/faq |
| Verify in Google Search Console and Bing Webmaster Tools (free) to see what is actually indexed and AI-Overview traffic (reported under "Web") | | https://developers.google.com/search/docs/appearance/ai-features |

---

## 8. Local link-building and listings

| Target | URL | Cost / rules | What to do | Status |
|---|---|---|---|---|
| Visit Austin event calendar | https://www.austintexas.org/events/submit-event/ | Free; editor approves only "Austin-area events that are appealing to tourists"; no fundraisers, happy hours, networking, reseller listings; needs description, **link to your website**, 3:2 image ≥900×600; up to 5 business days | Submit the two GPS walking tours as recurring self-guided events only if the editor accepts self-guided formats (UNCERTAIN); otherwise any real meetup you host | FACT |
| Austin Chronicle calendar | https://calendar.austinchronicle.com/austin/Events/AddEvent (form, 403 to bots) ; FAQ https://www.austinchronicle.com/uncategorized-2/no-headline-12107449/ | Free listings, editors rewrite copy, listings limited to one week, email calendar@austinchronicle.com; "All listings are free" and due "the Monday of the week prior" per the commform page (FACT via search snippet: https://www.austinchronicle.com/commform/) | Same as above; also pitch the classifieds launch as a story | FACT / partly dated (2016 FAQ) |
| ATX Today (6AM City) events | https://atxtoday.6amcity.com/local-events-austin-tx | Free to add an event with a login; paid promotion exists | List events; newsletter has a "reader questions" format worth pitching | FACT |
| Austinot | https://austinot.com/contact-the-austinot | Accepts event submissions it judges a fit; ranks #5 for the weekend query | Ask for inclusion in weekend roundups; offer the planner as a tool | FACT |
| Do512 | https://do512.com/ ; family.do512.com has "Add an Event" | Submission terms not confirmed (UNCERTAIN) | Add events; Do512's Similarweb shows referrals from austinmuseums.org-type niche sites — be one | FACT (existence) |
| City of Austin Community Registry (neighborhood associations) | https://www.austintexas.gov/development-services/community-registry-search | Free database; entries include "links to related websites"; click Search with no text to list all | Pull the list of all neighborhood associations; offer each its neighborhood page (`/neighborhoods/<slug>/`) as a resource for their website/newsletter | FACT |
| UT Austin ISSS "Welcome to Austin" guide + Living in Austin resources | https://isss-blog.global.utexas.edu/2026/07/welcome-to-austin-a-guide-for-new-international-students/ ; https://global.utexas.edu/isss/life-at-ut/new-student-scholar-resources | The 2026 guide names Barton Springs, the Capitol, Mount Bonnell etc. but links to **no external Austin site** — a resource gap; author Sarah Chiu, ISSS Intercultural Programs | Email ISSS offering the neighborhood pages / newcomer itinerary as a free resource for the New Student Handbook | FACT |
| "Apps for Austin" roundups | RentCafe "13 local apps for Austin" (2019, media@rentcafe.com) https://www.rentcafe.com/blog/local-resources/13-local-apps-for-austin/ ; Built In Austin https://www.builtinaustin.com/articles/must-have-apps-austin-summer ; JB Goodwin https://www.jbgoodwin.com/blog/6-cant-miss-austin-apps.html ; Mount Bonnell https://www.mountbonnell.info/austin-bound/5-must-have-apps-for-new-austin-residents | Old (2019-era) posts that still rank; apartment/realtor blogs refresh these | Ask for inclusion in the next refresh; realtors want newcomer content | FACT (existence/dates) |
| Austin Chronicle "Best of Austin" readers poll | https://www.austinchronicle.com/best-of-austin ; https://calendar.austinchronicle.com/best-of/2025 | Free; write-in nominating round in spring (older rounds: Mar 28–Apr 8), finalist voting later; ballot being refreshed for 2026 | Ask followers to write in austin.chat under a website/app category in the 2027 nominating round | FACT |
| Austin food/lifestyle blogs (outreach list) | Toast "15 best Austin food blogs 2026" https://pos.toasttab.com/blog/on-the-line/best-austin-food-blogs ; Square Cow Movers list https://squarecowmovers.com/best-local-blogs-read-moving-austin/ ; Daily Texan 2023 creators list https://thedailytexan.com/2023/10/03/austin-bloggers-for-all-things-512/ | — | Offer embeddable neighborhood maps / planner links; the shopping apps (pizza, toy stores) are natural "best of" link bait | FACT (lists exist; Toast page blocked bots) |
| Texas Music Office directory (music blogs in Austin) | https://gov.texas.gov/Apps/Music/Directory/results/music-blogs-online-only-publications/region/austin/p1 | State directory, free | Source list for "live music tonight" partners/links | FACT |
| Reddit r/Austin wiki / rules | UNCERTAIN — reddit.com could not be fetched; secondary sources say r/askaustin has a "No Self-Promotion" rule | Left to the community-angle agent | | UNCERTAIN |

---

## 9. Case studies (who did it, what happened)
- **Eventbrite + Event schema**: "roughly a 100-percent increase in the typical year-over-year growth of traffic" to event pages the month after, visual change in SERPs within 2–3 weeks (2018). FACT: https://developers.google.com/search/case-studies/eventbrite-case-study
- **365 Things Austin** (one-person-scale): ~7.6K visits/mo, 58% organic, ranks for the money phrases on a content-only site. FACT: https://www.similarweb.com/website/365thingsaustin.com/
- **Austin Chronicle**: a single evergreen event page ("renaissance festival", position 1, 74,000 searches) is 9.85% of its organic traffic. FACT: https://www.semrush.com/website/austinchronicle.com/overview/
- **Do512**: 66.5% of visits from organic search on "events in austin today"-type queries; brand query "do512" is only 3.5% of traffic. FACT: https://www.similarweb.com/website/do512.com/ ; https://www.semrush.com/website/do512.com/overview/
- **Wanderlog**: programmatic venue/itinerary pages, 6.3M visits/mo, but ~57% direct — the app, not SEO, is the engine. FACT: https://cw.semrush.com/website/wanderlog.com/overview
- **Local parenting magazine**: +43% search traffic from hyper-local pages; one seasonal page = 3,200 views in its week. FACT: https://blog.twentyfirstdigital.com/case-study-local-parenting-magazine-increases-search-traffic-by-43

---

## 10. What NOT to do
1. **Do not create a Google Business Profile for austin.chat** with a home or P.O. address — online-only brands and "P.O. box or mailbox" addresses are ineligible; profiles get suspended. FACT: https://support.google.com/business/answer/13763036
2. **Do not mark business hours, happy hours, promos or "open now" as `Event`** — explicitly forbidden; "Google may take manual action". FACT: https://developers.google.com/search/docs/appearance/structured-data/event
3. **Do not put Event markup on a list page only** — each event needs its own leaf URL or it is not eligible. FACT: same URL.
4. **Do not expect ItemList/TouristAttraction/TouristTrip to produce a Google rich result in the US** — not in the supported list; the travel carousel beta is EEA/TR/ZA only. FACT: https://developers.google.com/search/docs/appearance/structured-data/search-gallery ; https://developers.google.com/search/docs/appearance/structured-data/carousels-beta
5. **Do not spend effort on llms.txt or "AI SEO" vendors** — Google: no AI text files needed; Mueller: no AI system uses it. FACT: https://developers.google.com/search/docs/appearance/ai-features ; https://www.searchenginejournal.com/googles-mueller-says-llms-txt-cant-help-llms-differentiate-sites/566027/
6. **Do not block OAI-SearchBot or PerplexityBot in robots.txt** (blocking GPTBot for training is a separate choice). FACT: https://developers.openai.com/docs/bots ; https://docs.perplexity.ai/guides/bots
7. **Do not mint a new URL every week/year** ("/weekend-oct-31-2026/" as the only page) — the SERP winners keep one URL and change its dates. FACT: https://www.bing.com/search?q=things+to+do+in+austin+this+weekend
8. **Do not ship keyword-only programmatic pages with no task** — thin-content risk; the planner CTA is what makes each page non-thin. FACT: https://gracker.ai/blog/10-programmatic-seo-case-studies--examples-in-2025
9. **Do not submit ineligible events to Visit Austin** (fundraisers, happy hours, networking, reseller tickets) — listed as unlikely to be approved. FACT: https://www.austintexas.org/events/submit-event/
10. **Do not rely on JS/iframe-only pages for anything you want found** — Google's render queue and non-JS bots; Bing's own advice is pre-rendering. FACT: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics ; https://blogs.bing.com/webmaster/october-2018/bingbot-Series-JavaScript,-Dynamic-Rendering,-and-Cloaking-Oh-My
11. **Do not count on AI referrals as a channel** — 0.37% of travel-site traffic. FACT: https://www.abta.com/industry-zone/partner-insights/how-much-traffic-do-llms-send-travel-websites-2026

---

## 11. Consolidated action table (what a solo site should do, in order)

| # | Action | Where | Cost | Effort | Evidence |
|---|---|---|---|---|---|
| 1 | Add `robots.txt` (allow all incl. OAI-SearchBot, PerplexityBot; `Sitemap:` line) and a generated `sitemap.xml` with true lastmod | repo root, written by a GitHub Action | $0 | 1 h | §7 |
| 2 | Verify Google Search Console + Bing Webmaster Tools; add IndexNow ping to the build action | GSC, Bing WMT | $0 | 1 h | §5, §7 |
| 3 | Give the home page real HTML: H1 "Things to do in Austin", 2–3 sentences, links to neighborhoods / this weekend / itineraries, meta description; keep the map iframe below | index.html | $0 | 2 h | §7 |
| 4 | Build `/this-weekend/` and `/today/` as static HTML regenerated by the existing data actions; H1 carries the dates; each event gets `/events/<id>/` with Event JSON-LD | tools + workflow | $0 | 1–2 days | §3.1, §4.2, §9 |
| 5 | Pre-render 66 `/neighborhoods/<slug>/` pages from `chat/data/places/*.json` (names, addresses, hours, website links in HTML; map loads after) + `ItemList` JSON-LD | tools/make-pages.js pattern | $0 | 1–2 days | §4.1, §7 |
| 6 | Write 8–12 itinerary pages (3-day, 1-day SoCo, East Austin night, with kids, bachelorette, SXSW no-badge, ACL/F1 weekend) each with "Open in planner"; owner writes copy (copy rule) | /itineraries/ | $0 | ongoing | §2.1, §3.1 |
| 7 | Register Apple Business Connect (brand, online-only allowed); skip Google Business Profile | businessconnect.apple.com | $0 | 30 min | §4.2 |
| 8 | Submit real events to Visit Austin, Austin Chronicle, ATX Today, Do512 with the site URL | §8 URLs | $0 | 1 h each | §8 |
| 9 | Pull the Community Registry list; email neighborhood associations and UT ISSS with their neighborhood page | §8 URLs | $0 | 2–3 h | §8 |
| 10 | One Pinterest pin per itinerary/neighborhood page; one YouTube Short/vlog per itinerary titled like the SERP winners, link in description | Pinterest, YouTube | $0 | ongoing | §6 |
| 11 | Check keyword volumes once in Google Keyword Planner (free account) and record them in the repo docs | ads.google.com | $0 | 30 min | §2.1 (gap) |
| 12 | Check Core Web Vitals on the new static pages with PageSpeed Insights; defer MapLibre/Supabase until after first paint on listing pages | pagespeed.web.dev | $0 | half day | §7 |
