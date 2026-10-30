# 05 — Launch, press, partnerships, paid acquisition and measurement for austin.chat

Research note, 2026-10-29. Angle: how a solo-built, free Austin site gets its first and next users through
launch platforms, local media, partnerships, small paid tests, and how to measure whether any of it worked.

Tags: **FACT** = sourced claim (URL follows). **ESTIMATE** = my arithmetic, shown. **UNCERTAIN** = could not
verify against a primary source in this session (page blocked, secondary source only, or dated).

Research limits this session: statesman.com, kxan.com/report-it, do512.com/p/advertise, the Chronicle media kit,
Nextdoor's ads site and TikTok's Promote help page all refused the fetch (403/empty). Figures for those come from
search snippets or third parties and are marked UNCERTAIN.

---

## 0. The ten things that matter (read this if nothing else)

1. **Austin Monitor is dead; Austin Current replaced it.** The Monitor stopped publishing in October 2025 and lives on as an archive; its successor is the Austin Current (austincurrent.org), whose tips page wants accountability tips (documents, data), not product launches. FACT https://www.austinmonitor.com/ , https://austincurrent.org/tips/
2. **The cheapest "press" is being a reporter's source.** Austin Towers has been cited by KXAN as the source for a story; it has published since 2007 and takes no ads. The pattern to copy is "I have the data/map the reporter needs", not "please cover my site". FACT https://www.kxan.com/news/local/austin/whats-that-building-some-notable-towers-in-austins-skyline/amp/ , https://austin.towers.net/about/
3. **Silicon Hills News is a one-editor outlet with a public pitch email** (Laura Lorek, Laura@SiliconHillsNews.com); it has covered solo-made Austin maps before (Austin Tech Map, ATXup). FACT https://siliconhillsnews.com/about/ , https://siliconhillsnews.com/?p=7791
4. **City Cast Austin relaunched its podcast on Sept 22, 2026**, publishes neighborhood guides and an "Austin's Best" monthly events guide, and lists austin@citycast.fm as the contact. FACT https://austin.citycast.fm/
5. **KUT's ATXplained takes listener questions via a Hearken form and puts them to a vote** — a map-rich "why is Austin like this" question from the owner is a legitimate way in. FACT https://www.kut.org/atxplained
6. **Show HN and Product Hunt both forbid asking for upvotes; Show HN forbids sign-up walls and landing pages; Product Hunt prohibits company accounts.** austin.chat (guest use, no sign-up) is eligible for both. FACT https://news.ycombinator.com/showhn.html , https://www.producthunt.com/launch/guide
7. **A front-page Show HN is worth roughly 4k–11k visitors in a day or two and then decays**; Show HN posts now stay on page 1 about 2.9 hours at peak. FACT (self-reported) https://www.indiehackers.com/post/front-page-of-hn-the-full-postmortem-traffic-lessons-surprises-cbe9e0a7f6 , https://www.indiehackers.com/post/first-place-on-hackernews-stats-traffic-and-regs-46b8b95333 , https://gwern.net/doc/www/www.arthurcnops.blog/f0c0a91fadc895c3d09feda9c90075f69648b243.html
8. **The only priced local newsletter inventory found is 6AM City (ATXtoday): self-serve from $200, text ads $25–$500, banner $25–$250.** Community Impact (107k inboxes/send, 40%+ open) and Austin Monthly (65k print) quote on request. FACT https://advertise.6amcity.com/ , https://advertising.communityimpact.com/advertise/austin/email , https://www.hearstaustinmedia.com/austin-monthly-austin-home-magazines
9. **"things to do in austin" has ~140,500 US searches/month with a CPC near $0.15** on a public Semrush page (UNCERTAIN: page garbled, live page 404 for me). If true, that is the one paid channel that can pay back for a free site at ~$0.15–$0.50 per visit. https://ja.semrush.com/website/austintexas.org/overview
10. **Analytics for GitHub Pages can be $0**: Cloudflare Web Analytics (free, JS beacon, works without proxying), Umami Cloud Hobby (free, 100k events/mo, 1 site, 6-month retention), GoatCounter (free for reasonable public use). Plausible is $9/mo for 10k pageviews, no free tier. FACT https://www.cloudflare.com/web-analytics/ , https://umami.is/pricing , https://www.goatcounter.com/ , https://plausible.io/#pricing

---

## 1. Local press and media

### 1.1 Outlet-by-outlet table

| Outlet | What it is now (2026) | How it takes pitches | What a solo free site should do | Tag |
|---|---|---|---|---|
| **Austin Monitor** | Stopped publishing Oct 2025; archive only. Newsletter migrated to Austin Current (launched Nov 10, 2025, Texas Tribune mail infrastructure). | Do not pitch. | Nothing. | FACT https://www.austinmonitor.com/ |
| **Austin Current** (Monitor successor) | Covers education, government, growth & development, community, 2026 elections; co-produces "Austin Signal" with KUT. | Tips page austincurrent.org/tips/ (form + obfuscated email); wants "specific issues backed by facts, documents, or firsthand evidence". | Pitch the DATA products (budget map, data-centers map, AISD closures map) as evidence for a story, not the site. | FACT https://austincurrent.org/ , https://austincurrent.org/tips/ |
| **City Cast Austin** (podcast + "Hey Austin" newsletter) | Active; podcast "back on Sept. 22" 2026 with new host; sections: Local Civics, Urban Almanac, Austin's Best (monthly event guides), Neighborhood Guides, Explainers. | austin@citycast.fm (footer); no pitch form. Also /advertise. | Pitch the Day Planner as a "how to plan ACL/SXSW weekend" segment; offer the neighborhood map for their Neighborhood Guides. Best single fit found. | FACT https://austin.citycast.fm/ |
| **KUT / ATXplained** | Listener-question series; "You ask a question, we put it to a vote and, if your question gets chosen, a KUT reporter, with your help, will set out to try and answer". ATXplained Live Dec 9, 2026 at Bass Concert Hall. | Hearken form on the ATXplained page. No email listed. | Submit a map-shaped question the owner can co-answer with data (e.g. a neighborhood-boundary question). | FACT https://www.kut.org/atxplained |
| **Silicon Hills News** | Laura Lorek's Austin/San Antonio tech news site, 10+ years. | Laura@SiliconHillsNews.com or LauraLorek@gmail.com. | Pitch "solo maker builds free Austin planner on own routing engine" — this outlet covered Austin Tech Map and ATXup (RepresentMap) in 2013. | FACT https://siliconhillsnews.com/about/ , https://siliconhillsnews.com/?p=7791 |
| **KVUE** | TEGNA ABC affiliate. | Newsroom (512) 459-9442; Defenders (investigative) 512-533-2231 via form; "News Team" page to find reporters. KVUE has a "heartwarming" vertical that covered a Code for America donation map used by Austinites. | Call/email a specific reporter; tie to an event week (ACL, SXSW) or a civic-data angle. Do not use the Defenders line. | FACT https://www.kvue.com/contact-us , https://kvue.com/article/life/heartwarming/kansas-city-man-covid-19-donation-map-app-austinites-connect-help/269-78c3a672-35e4-4c94-972e-03fdcd3c22de |
| **KXAN** | Nexstar NBC affiliate; "Report It" tips page exists at kxan.com/report-it (fetch blocked, contents unverified). Cites local blogs as sources (Austin Towers). Has run crowdsourced-map stories during crises (2023 ice storm). | Report It page / reporters' emails (firstname.lastname pattern, unverified). | Be the data source when news breaks (closures, outages, event-weekend traffic). | UNCERTAIN https://www.kxan.com/report-it/ ; FACT (cites Austin Towers) https://www.kxan.com/news/local/austin/whats-that-building-some-notable-towers-in-austins-skyline/amp/ ; crowdsourced map https://digital-release.kxan.com/?p=885943 |
| **Austin American-Statesman / Austin360** | Gannett; staff page would not load for me. Masthead moves reported by Talking Biz News (managing editor Courtney Sebesta; deputy ME Andy Sevilla oversees business/tech). | Individual reporter emails; no public pitch guide found. | Pitch Austin360 (things-to-do desk) around event weekends with a ready-made "plan your weekend" angle. | UNCERTAIN https://www.statesman.com/contact/staff/ (did not load) ; https://talkingbiznews.com/tag/austin-american-statesman/ |
| **Austin Business Journal / Austin Inno** | ABJ's startup vertical. No public tips address found in this session. | Reporter emails (bizjournals pattern). | Angle: "sells app source code / Gumroad business model" is the ABJ-shaped story, not the free site. | UNCERTAIN https://muckrack.com/media-outlet/austininno |
| **Community Impact** | Hyperlocal print + "Morning Impact" newsletter: ~107,000 inboxes per send held by ~58,000 people, 40%+ open rate; sold by edition. | Newsroom not researched; advertising via "Get Austin pricing". | Best as a cheap-ish ad buy per edition (price on request) for the newcomer/neighborhood angle. | FACT https://advertising.communityimpact.com/advertise/austin/email |
| **Austin Chronicle** | Alt-weekly; Daily newsletter 54,212 subscribers, 28% open (2024 kit). Media kit site too large to fetch. | Section editors; "Best of Austin" is reader-voted (below). | Enter / campaign for Best of Austin; pitch Chronicle's events desk at SXSW/ACL. | FACT https://mediakit.austinchronicle.com/wp-content/uploads/2024/08/2024_Email_Demographics.pdf |
| **Austin Monthly** (Hearst Austin Media) | 65,000 verified print readers/month, six issues/year; sponsored social reaches 270K+ followers; events (Burger Bash etc.). | advertising@austinmonthly.com, 512-263-9133 (ads). Editorial not researched. | Editorial pitch for a "101 things to do" style issue (they run one each summer). | FACT https://www.hearstaustinmedia.com/austin-monthly-austin-home-magazines , https://www.cbsaustin.com/features/we-are-austin/austin-monthly-shares-101-fun-things-to-do-in-their-special-summer-issue |
| **Austin Towers** (austin.towers.net) | Real-estate/urbanism blog since 2007, tied to TOWERS realty; "At this time we do not accept advertiser support". | austin.towers.net/contact/ form. | Not a buy. Offer the 3D city-project models / data-center map as a story they would link. | FACT https://austin.towers.net/about/ |
| **Texas Standard** (statewide public radio) | Contact page is "a space for general feedback and news tips"; separate "Talk of Texas" comments page. | Contact form. | Only with a statewide hook (e.g. data centers across Texas). | FACT https://www.texasstandard.org/contact/ |
| **ATXtoday (6AM City)** | Daily newsletter; parent company's 20 editorial dailies total 570,655 subscribers at 69.8% open; no Austin-only number published. | Self-serve ad portal; editorial not researched. | Cheapest priced newsletter inventory in town (see paid section). | FACT https://advertise.6amcity.com/ |
| **Do512** | Events site; audience 78% aged 18–44, 71% no kids (its own claim). Similarweb estimates 414.5K visits over 3 months (~138K/mo), 66.5% organic search, 51% bounce. | Advertise page (403 for me) links a media kit. | Not press; a possible listing/ad partner. | FACT https://do512.com/p/advertise , https://www.similarweb.com/website/do512.com/ |
| **Austin Bulldog** | Investigative nonprofit; not a fit for a product launch. | — | Skip. | UNCERTAIN (not researched) |

### 1.2 Austin Chronicle "Best of Austin" mechanics

- Two parts: Critics Picks (staff) and a Readers Poll that "goes two rounds" (nominations, then finalists). FACT https://www.austinchronicle.com/issues/best-of-austin-2025/
- 2025 Readers Poll: 175 winners across eight categories; 33,055 voters cast 423,142 votes in the final round. FACT https://www.austinchronicle.com/issues/best-of-austin-2025/
- Finalist round has had 800+ finalists; ballot at vote.austinchronicle.com. FACT https://www.cbsaustin.com/features/we-are-austin/austin-chronicles-best-of-austin-voting-returns-with-more-than-800-finalists
- Historic schedule (one media-kit year): round 1 March 28–April 8, round 2 May 9–20; dates move yearly. FACT https://mediakit.austinchronicle.com/?p=13025
- Separate "Best of Austin: Restaurants" poll runs Aug–Sep with awards in November. FACT https://mediakit.austinchronicle.com/best-of-austin-restaurants
- I could not confirm a "Best Local Website/App" category in the 2025 PDF (not fetched). UNCERTAIN https://www.austinchronicle.com/wp-content/uploads/2025/09/BestOfAustin2025.pdf
- What to do: in the nomination round (spring), ask the owner's TikTok/Substack audience to write in austin.chat under whatever web/media category exists that year; 33k voters means a few hundred write-ins can make the finalist list. ESTIMATE: 800 finalists / 175 winners ≈ 4.6 finalists per category; a write-in needs to beat the 5th-place count, unknown, likely low hundreds.

### 1.3 Pitch email format (recommendation, not a sourced fact)

Subject: `[Data] Where Austin's 47 data centers are — free interactive map` (lead with the asset, not the brand).
Body, 5 lines: (1) one-sentence what it is and that it is free with no sign-up; (2) the single most surprising number; (3) link + a 1080x1080 screenshot attached or linked; (4) "I built it alone, data from X, happy to share the GeoPackage"; (5) availability for a 10-minute call this week. No attachments larger than a screenshot. Follow up once after 3 business days. Generic advice from a newsroom-pitching guide: tailor to the beat reporter, keep it short, pitch in the body, follow up. FACT https://www.newswire.com/blog/how-to-pitch-a-story-to-a-newspaper-editor

### 1.4 Evidence: solo-made Austin maps/sites that got coverage

Honest result: I could not find 3–5 clean 2024–2026 TV/newspaper stories about a solo-made Austin map. The cases found and the mechanism in each:

| Project | Who / when | Coverage | Mechanism to copy |
|---|---|---|---|
| Austin Towers (austin.towers.net) | Blog since 2007, realty-affiliated | KXAN cited "James Rambin with the Austin Towers blog reported in March 2022 developers got their permit approved". FACT https://www.kxan.com/news/local/austin/whats-that-building-some-notable-towers-in-austins-skyline/amp/ | Be the primary source reporters quote; publish permit/data scoops first. |
| Austin Tech Map / ATXup (RepresentMap) | Ricardo Sanchez (co-founders meetup); Nick Hammond, Austin developer, 2013 | Silicon Hills News feature. FACT https://siliconhillsnews.com/?p=7791 | Solo-maker + "map of the scene" angle to a niche tech outlet. |
| Keep Austin Black (Black-owned business directory app) | Earl Potts, UT CS student, 2020 | UT CS news. FACT https://login.cs.utexas.edu/news/tags/earl-potts | University/alumni channel; UT comms writes about alumni projects. |
| VoteATX | Open Austin volunteers; "embedded in City of Austin website for Nov 2014 election" | Civic-tech write-ups. FACT https://thelivinglib.org/voteatx/ | Partner with Open Austin / city so an official site embeds you. |
| Code for America donation map (Kansas City maker, used in Austin) | COVID era | KVUE "heartwarming" story. FACT https://kvue.com/article/life/heartwarming/kansas-city-man-covid-19-donation-map-app-austinites-connect-help/269-78c3a672-35e4-4c94-972e-03fdcd3c22de | TV covers maps when there is a human-need hook and a moment. |
| Crowdsourced water-outage map, 2023 ice storm | Facebook responses | KXAN story. FACT (digital-release mirror) https://digital-release.kxan.com/?p=885943 | Crisis moment + crowd data = TV coverage within hours. |
| Hoodmaps | Pieter Levels, 2017, global | ArchDaily, 6sqft, Spanish tech press; no Austin-outlet coverage found. FACT https://www.6sqft.com/product/hoodmaps/ , https://www.archdaily.com/tag/hoodmaps | Novel, slightly rude map format travels globally on design/tech blogs. |

Takeaway: local TV/newspaper coverage of a solo tool arrives via (a) a news moment where the tool is the only live data (closures, outages, event-weekend crowds), (b) a civic/UT/Open Austin partnership, or (c) being quoted as a source. "Please cover my site" pitches did not surface as a pattern anywhere.

---

## 2. Launch platforms

| Platform | Rules that matter | Evidence of traffic | What austin.chat should do | Tag |
|---|---|---|---|---|
| **Show HN** | Must be something people can run/try; no sign-up walls ("others can try without signups or emails"); blog posts, landing pages, newsletters, fundraisers are not Show HNs; no asking friends to upvote; title starts "Show HN:". | Front page ≈ 6k pageviews / ~500 uniques (one post-mortem); 13 hours on front page ≈ 11k uniques + 300 sign-ups (KTool); 3,858 visitors (HTML Tree); Show HN posts now last ≈2.9 h on page 1 at peak US hours, avg 3.1 comments (Feb 2026 analysis). Traffic concentrates in ~1.5 days. | One post: "Show HN: A free day-planner for Austin on my own pgRouting engine (no sign-up)". Lead with the routing engine and OSM data, not "Austin guide". Post 8–10am ET on a weekday; be in the thread all day. If it gets ~30 upvotes and dies, a moderator may offer a second-chance repost (happened to KTool). | FACT https://news.ycombinator.com/showhn.html ; https://www.indiehackers.com/post/front-page-of-hn-the-full-postmortem-traffic-lessons-surprises-cbe9e0a7f6 ; https://www.indiehackers.com/post/first-place-on-hackernews-stats-traffic-and-regs-46b8b95333 ; https://www.peterbe.com/plog/html-tree-on-hacker-news ; https://gwern.net/doc/www/www.arthurcnops.blog/f0c0a91fadc895c3d09feda9c90075f69648b243.html |
| **Product Hunt** | Free; "Company accounts are prohibited"; may share the launch link but "can't ask people directly to upvote"; hunt your own product (no advantage to a third-party hunter); launch at 12:01 am PT; can relaunch on major iterations. | One founder write-up: 500+ upvotes → 50+ sign-ups and a daily-newsletter feature within 48 h. No verified visitor counts found. Third-party guides favor Tue–Thu but disagree. | Low priority: PH audience is global SaaS; a city site will get curiosity visits, not Austin users. If done, launch the Day Planner as "an itinerary planner that runs on OSM + open routing, Austin first". | FACT https://www.producthunt.com/launch/guide ; https://flexprice.io/blog/how-we-ranked-product-of-the-day-on-product-hunt ; https://www.producthunt.com/p/producthunt/the-best-day-to-launch-on-product-hunt |
| **r/dataisbeautiful** | Own visualizations allowed: "Please do! Be sure to add [OC] to the post title"; OC authors must describe tools/data source in a comment (mod rule, 2014, may have changed). | Not measured here. | Post static exports of the budget / data-center / AISD maps as [OC] with the data source in a comment; link austin.chat only in that comment. | UNCERTAIN (mirror of wiki) https://rl.klein.ruhr/r/dataisbeautiful/wiki/index ; https://lr.eu.psf.lt/2lokun |
| **r/MapPorn** | Interactive maps must have "[Interactive]" in the title; "selling products is not allowed". | Not measured here. | Post the 1885 Sanborn/Ford georeferenced maps and the 3D models page as [Interactive]. Never mention the source-code sales. | UNCERTAIN (mirror of FAQ) https://rl.klein.ruhr/r/MapPorn/wiki/faq |
| **r/SideProject** | Promotion-friendly; weekly "share your project" threads; engage with others' projects. | Not measured here. | Post once at launch; reply to every comment. | UNCERTAIN (third-party guide) https://redship.io/blog/reddit-self-promotion-rules-2026 |
| **r/webdev "Showoff Saturday"** | Not verified this session. | — | Post the MapLibre + three.js models page on a Saturday. | UNCERTAIN |
| **Indie Hackers** | Not verified this session. | Hosts the HN post-mortems cited above. | Write a build log ("solo, GitHub Pages, own routing engine") — IH posts rank in Google for years. | UNCERTAIN |

Does it stick? The HN post-mortems all describe a 1–2 day spike then "steady curiosity for a few days"; one reported ~20% bounce but "no direct conversions". FACT https://www.indiehackers.com/post/front-page-of-hn-the-full-postmortem-traffic-lessons-surprises-cbe9e0a7f6 . ESTIMATE: if 8k HN visitors arrive and 5% are Austin-based (Austin ≈ 0.7% of US population, HN skews to tech hubs, so 2–5%), that is 160–400 locals, i.e. a launch post is worth less than one good TikTok to the owner's existing audience. Use HN/PH for backlinks and developer credibility (source-code buyers), not for Austin users.

---

## 3. Partnerships

| Partner | What exists | Cost / rules | Audience | What a solo free site should do | Tag |
|---|---|---|---|---|---|
| **Visit Austin (ACVB)** | Three tracks: Corporate Partnerships (brand-to-brand, campaign placement), Event Sponsorships (Visitor Center branding), In-Kind & Experiential (products in client gift bags, media kits, cross-promotion). A "Partnernet" extranet login exists for listed partners. | No prices published; inquiry form "Let's Connect" / become-partner. Partnership page markets to Delta, Tito's — i.e. brand sponsors. | 14M annual unique visitors to VisitAustin.org; 44.2M monthly social impressions; 30.1M annual visitors; 21.67M AUS passengers in 2025. | Ask the Strategic Partnerships team one question: "Is there a business-listing partner tier and what does it cost?" (not researched/published). Do not expect a free link. Offer in-kind: a Visit-Austin-branded embed of the Day Planner. | FACT https://www.austintexas.org/partnerships/ ; https://www.austintexas.org/partnerships/partner-opportunities/ ; https://www.austintexas.org/partners/ ; cost UNCERTAIN |
| **Austin Chamber of Commerce** | Membership tiers. | "Engage" $590/yr; "Enterprise" from $2,675/yr. | — | Only if the source-code business needs a directory listing; not a traffic channel. | FACT https://www.austinchamber.com/join |
| **Downtown Austin Alliance** | Manages the downtown PID; Business Membership Program ("assessed property owners, residents and businesses"); DASA fills vacant storefronts with creatives/small businesses; email subscribe list; events calendar. | Dues not published; contact 512.469.1766. | — | Offer the downtown walking tours + planner as content for their events calendar/newsletter; apply to DASA only if a physical pop-up (QR wall) is ever wanted. | FACT https://atxtoday.6amcity.com/what-is-the-downtown-austin-alliance ; https://downtownaustin.com/about-us/contact-us/ ; https://www.kxan.com/news/local/austin/downtown-program-aims-to-fill-vacant-storefronts-with-small-businesses-and-artists/amp/ |
| **Airbnb hosts (guidebooks)** | Hosts build a "guidebook" of places; it shows on listing/profile pages and in guests' Trips tab; hosts can "Share to make your guidebook accessible outside the Airbnb website". Hosts in forums also paste external guide links into messages. | Free. Guidebooks list places, not arbitrary URLs, so the link goes in the host's note text or welcome message. | Per-host. | Make a one-page "give your guests this link" kit (QR card PDF + 3-line message) and post it in Austin host groups; hosts want a free, no-sign-up itinerary tool. | FACT https://www.airbnb.com/resources/hosting-homes/a/recommend-local-activities-with-this-simple-tool-477 ; https://community.withairbnb.com/t5/Ask-about-your-listing/Guidebook-problems/td-p/344051 |
| **Bachelorette/wedding planners** | Austin ranked #1 US bachelorette destination in Thumbtack's 2015 request data; Texas Monthly has covered the phenomenon. Hotels (Four Seasons) market bachelorette packages. | Free to pitch. | Not quantified. | Build one "bachelorette weekend" plan template in the Day Planner and send it to the planners/hotels that already sell packages. | FACT https://dallas.culturemap.com/news/travel/10-11-15-thumbtack-most-popular-bachelorette-party-destinations-top-activities/ ; https://www.texasmonthly.com/the-culture/bachelorette-parties-austin/ ; https://press.fourseasons.com/austin/trending-now/bachelorette-weekends |
| **Apartment locators / relocation** | Industry exists (chamber directory lists locators offering "free apartment locator services for residents and newcomers"); no count of licensed locators found. | Free to pitch. | Unknown. | Offer locators a co-branded "your first 30 days in Austin" plan link they can send clients; locators are paid by landlords so a free value-add costs them nothing. | UNCERTAIN https://www.austinchamber.com/directory/austin-apartment-locators |
| **Corporate HR relocation packets (Tesla/Apple/Oracle/Samsung)** | Not researched this session. | — | — | Reach via the locators and the Chamber's newcomer materials rather than HR directly. | UNCERTAIN |
| **UT Austin** | "UT Marketplace": free event where Austin businesses distribute materials to students/faculty/staff (Texas Student Media + Student Activities), 2022 listing. Texas Union ballroom exhibitor fee $350 for university/non-profit exhibitors on one form. | Free (Marketplace) / $350 (ballroom exhibitor). | ~50k students (not sourced here). | Table at UT Marketplace with QR cards for the walking tours + planner. | FACT https://calendar.utexas.edu/event/ut_marketplace_3157 ; https://cloud.wikis.utexas.edu/wiki/x/GRVDAw ; confirm it still runs — UNCERTAIN |
| **ACC / St. Edward's orientation** | St. Edward's hosts ATX Hack for Change (civic hackathon with Open Austin). | Free. | — | Enter the hackathon with austin.chat as the platform; it is how VoteATX got embedded on the city site. | FACT https://www.stedwards.edu/news/atx-hack-change-kicks-three-day-event-civic-good ; https://thelivinglib.org/voteatx/ |
| **Open Austin** | Volunteer civic-tech group since 2009. | Free. | — | Present the routing engine / open data maps at a meetup; they are the people who get city embeds. | FACT https://austineconetwork.com/atx-hack-for-change/ |
| **CapMetro** | Only ad inventory found (bus sides, shelters — see paid). | — | — | Not a partnership channel found. | UNCERTAIN |
| **Austin Public Library** | Not researched this session. | — | — | — | UNCERTAIN |
| **Austin Parks Foundation** | Corporate-partnerships page 404'd. ACL Fest generated $8.5M for parks in 2025 via APF. | — | — | Offer a free "parks on the planner" layer; approach after the ACL cycle (Oct). | UNCERTAIN https://austinparks.org/ ; FACT (parks $) https://communityimpact.com/central-austin/business/2025s-acl-fest-generated-558m-for-local-economy-85m-for-city-parks/ |
| **Hotels / concierges** | Austin Hotel & Lodging Association is the trade body; Les Clefs d'Or concierges exist at Four Seasons/others. | — | — | Concierges want a printable/QR plan for guests; one email to the AHLA office is cheap. | UNCERTAIN https://austincc.academicworks.com/donors/austin-hotel-lodging-association ; https://www.hotel-online.com/index.php/news/les-clefs-dor-usa-accepts-austin-tx-hotel-concierge-michael-sandoval-as-new |
| **Neighborhood associations** | Not researched this session. | — | — | — | UNCERTAIN |

---

## 4. Event timing: Austin demand calendar with numbers

| Month | Event | Numbers (official or best available) | Launch/content timing | Tag |
|---|---|---|---|---|
| March (mid) | **SXSW** | 2025: 309,300 attendees (vs 417,400 in 2019). 2026: shorter run, organizers expected attendance "close to the 309,300" of 2025; hotel demand +12% vs the first 7 days of 2025 but 20% fewer room nights sold overall (Visit Austin data). 2024 economic impact $370M+. | Publish "SXSW without a badge" plan templates 3–4 weeks before (mid-Feb); pitch City Cast/Chronicle events desk late Feb. | FACT https://www.axios.com/local/austin/2026/03/12/sxsw-austin-music-film-tv-innovation ; https://spectrumlocalnews.com/tx/south-texas-el-paso/news/2026/04/07/report--sxsw-organizers-say-2026-attendance-held-steady ; https://communityimpact.com/south-central-austin/events/all-together-now-sxsw-reimagines-festival-for-40th-season/ |
| March | **Rodeo Austin** | 2025 dates March 14–29; BBQ Austin side event drew 50,953 over two days; full-fair total not published. | Minor. | FACT https://rodeoaustin.com/tickets ; https://rodeoaustin.com/news/rodeo-austin-wraps-up-record-breaking-year/ |
| March | Spring break | No Austin-specific official count found. | — | UNCERTAIN |
| Mar–Jun, Sep–Oct | Bachelorette season peaks (planner quote) | — | Bachelorette plan templates live by late Feb. | UNCERTAIN https://www.texasmonthly.com/the-culture/bachelorette-parties-austin/ |
| Spring (Mar–May) | **Chronicle Best of Austin voting** | 33,055 voters in 2025 final round. | Nomination push to owner's audience when round 1 opens. | FACT https://www.austinchronicle.com/issues/best-of-austin-2025/ |
| Sep–Nov | **UT football at DKR** | Capacity 100,119; season tickets sold out for 2025 and again for 2026. | Game-day "where to eat near campus" plan on Fridays. | FACT https://texaslonghorns.com/news/2025/5/16/football-season-tickets-sold-out-for-the-2025-season ; https://texaslonghorns.com/news/2026/8/11/texas-football-tickets-sold-out-in-advance-of-2026-season |
| October (2 weekends) | **ACL Fest** | 2025: $557.8M economic impact, equivalent of 3,322 full-time jobs, F&B $118.8M; ~75,000 per day over six days (≈450,000 daily entries, not unique people); GA sold out both weekends. 2024: record $535M. | Content live by mid-Sep; City Cast/Fox 7 run "guide to ACL" pieces in late Sep. | FACT https://www.fox7austin.com/news/acl-music-festival-2025-economic-impact ; https://www.axios.com/local/austin/2026/10/04/acl-fest-zilker-mud-austin ; https://communityimpact.com/austin/south-central-austin/arts-entertainment/2025/05/07/acl-fest-2024-generated-84m-for-austin-park-projects-record-535m-in-total-economic-activity/ ; ESTIMATE 75,000 × 6 = 450,000 |
| October (3rd weekend) | **F1 US Grand Prix, COTA** | Record 440,000 three-day attendance in 2022; 432,000 in 2023; 2025 sold out, no official figure (EventMarketer says 380,000; pre-race projections 400,000). Contract runs through 2034. | "F1 weekend off-track" plan; COTA crowd is high-income, out-of-town, 3 days. | FACT https://f1destinations.com/?p=70353 ; https://f1destinations.com/?p=22924 ; https://gpdestinations.com/cota-extends-us-gp-contract-to-2034/ ; https://www.eventmarketer.com/tag/att/ ; https://www.formula1.com/en/latest/article/formula-1-announces-extension-of-the-united-states-grand-prix-through-2034.1Qxc1oXyrxaSVLKn2IPvRu |
| Dec 10–23 (2025) | **Trail of Lights, Zilker** | City event page gives dates; attendance "about 400,000" per season appears only in secondary sources. | Holiday plan template by Dec 1. | FACT (dates) https://www.austintexas.gov/arts-culture/events/trail-lights ; UNCERTAIN (400k) https://www.tripster.com/travelguide/event/trail-of-lights-austin |
| Year-round | Visitors overall | 30.1M annual visitors; $11.1B visitor spending; 148,000 jobs; 21.67M AUS passengers in 2025. | — | FACT https://www.austintexas.org/partnerships/ |

Timing rule from the case studies: local outlets publish event guides 1–3 weeks ahead (Fox 7 "City prepares for ACL", City Cast "Your Guide to ACL Fest 2025"), so the planner template and the pitch must exist 3–4 weeks before the event. FACT https://fox7austin.com/news/city-prepares-2025-acl-music-festival ; https://austin.citycast.fm/podcasts/your-guide-to-acl-fest-2025

---

## 5. Paid acquisition for a tiny budget (framed as cost per visit)

| Channel | Minimum / price found | Benchmark | ESTIMATE cost per visit for austin.chat | Verdict | Tag |
|---|---|---|---|---|---|
| **Google Search** ("things to do in austin" etc.) | No minimum. Keyword "things to do in austin": ~140,500 US searches/mo, CPC ≈ $0.15; "downtown austin" ~118,100 @ ≈$0.48; "south congress" ~112,100 @ ≈$0.50 (public Semrush page, table garbled). Industry: travel avg CPC $2.12–$2.14 (WordStream 2025/2026), overall avg $5.26. | — | $0.15–$0.50/click on informational Austin queries if the Semrush figures hold; $1–2 if the travel average applies. $100 → 200–650 Austin-intent visits. | **Best paid channel** for a free site; run a $5/day exact-match test on 10 "things to do / what to do this weekend austin" terms, phone-only, Austin + 50 mi geo. | UNCERTAIN https://ja.semrush.com/website/austintexas.org/overview ; FACT https://searchengineland.com/google-ads-costs-rising-but-conversion-rates-improved-in-2025-477927 |
| **Meta (FB/IG) geo-targeted** | No practical minimum ($1/day). US CPM $10–15 for reach/impression campaigns (1Q 2026); other datasets $7.47 (2025) to $16–23. | CTR ~1% typical (not sourced here). | ESTIMATE: $12 CPM ÷ 10 clicks per 1,000 = $1.20/visit; $100 → ~80 visits. | Only for boosting the owner's best map videos to Austin + 25 mi; measure as video views, not visits. | FACT https://affectgroup.com/blog/meta-ads-cpm-in-the-us-2025-benchmarks-for-facebook-and-instagram/ ; https://podvector.ai/articles/ads/meta-ads-economics/meta-ads-average-cpm-2025-benchmark |
| **Reddit Ads** (community targeting r/Austin etc.) | $5/day self-serve floor; lifetime minimums quoted as $20–$100 depending on source; managed $500+. CPM quoted $2–5 (one guide) up to $3–9. Guides say $50–100/day needed for signal. | — | ESTIMATE: $4 CPM, 0.5% CTR → $0.80/visit; $100 → ~125 visits, mostly r/Austin readers (good fit). | Worth one $5/day × 14-day test targeting r/Austin, r/AskAustin, r/austinfood with a map screenshot. | UNCERTAIN (no official page fetched) https://ppc.land/reddit-ads-minimum-prices ; https://www.dataslayer.ai/blog/reddit-ads-in-2025-complete-guide-for-marketers |
| **TikTok Promote** | ~$3/day minimum, up to 7 days (third-party guides; official page would not load). TikTok Ads Manager: $50/day campaign, $20/day ad group. | — | Promote buys views, not site visits; "website visits" goal exists. | Use only to push an already-performing map video to Austin viewers; $21 for a week. | UNCERTAIN https://sproutsocial.com/insights/tiktok-promotion/ ; FACT (Ads Manager) https://ads.tiktok.com/help/article/about-daily-budgets |
| **Nextdoor Ads** | Self-serve Ads Manager; agency says no minimum daily spend; Nextdoor UK says campaigns start "with a minimum spend of just a few pounds"; national brands $25k/month managed. | — | Unknown CPM; neighborhood targeting fits the neighborhood-map home page exactly. | $5/day test for the "classifieds" launch (Nextdoor users are the Craigslist/classifieds demographic). | UNCERTAIN https://browsermedia.agency/blog/nextdoor-self-serve-ads/ ; FACT https://about.nextdoor.com/gb/news/nextdoor-announces-new-self-serve-ads-platform-for-small-businesses |
| **6AM City / ATXtoday newsletter** | Self-serve from $200; newsletter text ad $25–$500 (≤50 words, 2 links); email banner $25–$250; premium banner $50–$750; header $750–$1,000; mini article $1,250–$1,500; article $1,750–$2,000; dedicated email $3,000–$3,500; IG post $600–$750. Live in as few as 3 business days. Austin-only subscriber count not published (company-wide dailies: 570,655 subs, 69.8% open). | — | ESTIMATE: if ATXtoday has ~30k subs (guess), 60% open, 1% click → 180 clicks; a $200 text ad ≈ $1.10/visit; a $25 slot would be ~$0.15/visit if it exists for Austin. | **Cheapest local newsletter test**; buy the lowest text-ad slot once, with a UTM. | FACT https://advertise.6amcity.com/ ; subscriber guess UNCERTAIN |
| **Community Impact Morning Impact** | Flat monthly rate, design included, price on request; sold by edition. | ~107,000 inboxes/send, ~58,000 people, 40%+ open. | ESTIMATE: 58,000 × 40% × 1% = ~230 clicks per send; price unknown. | Ask for the single-edition price for Central Austin; likely too dear for a free site. | FACT https://advertising.communityimpact.com/advertise/austin/email |
| **Austin Chronicle newsletter / print** | Rate card not fetched. | Daily newsletter 54,212 subs, 28% open. | ESTIMATE: 54,212 × 28% × 1% ≈ 150 clicks per send. | Ask price; use only around Best of Austin. | FACT https://mediakit.austinchronicle.com/wp-content/uploads/2024/08/2024_Email_Demographics.pdf |
| **Austin Monthly** | Rates on request (advertising@austinmonthly.com). | 65,000 print/month; 270K+ social. | Print cannot be measured except by QR. | Skip for now. | FACT https://www.hearstaustinmedia.com/austin-monthly-austin-home-magazines |
| **Do512** | Media kit on request (page 403). | ~138K visits/month (Similarweb est.). | — | Ask; probably a listing/feature rather than an ad. | FACT https://www.similarweb.com/website/do512.com/ |
| **Austin Towers** | "we do not accept advertiser support". | — | — | Not available. | FACT https://austin.towers.net/about/ |
| **Billboards** | Austin digital share-of-voice $2,500–$8,000 per 4 weeks; sample average $5,585/4 weeks; 4-week minimum typical. | — | ESTIMATE: 500,000 impressions, 0.1% act → 500 visits → $5–$16/visit. | No. | FACT (aggregators) https://adquick.com/billboard-cost/austin-city-texas ; https://alluvitmedia.com/billboard-advertising/tx/austin.php |
| **CapMetro bus / shelters** | Bus side from $1,200/location/month; shelters $1,800–$2,800 per 4 weeks. | — | Same order as billboards. | No. | FACT (aggregators) https://billboardsin.com/market/austin-texas/transit-advertising ; https://www.adquick.com/outdoor-advertising/austin-tx |
| **Flyers / QR cards** | ~$30–60 per 250 cards at any print shop (not sourced; common retail price). UT Marketplace table is free. | — | ESTIMATE: 250 cards, 5% scan → 12 visits → $3–5/visit; but visits are hyper-targeted (host guests, students). | Yes, but only placed with a partner (Airbnb host kit, UT Marketplace, coffee-shop boards), never cold. | ESTIMATE |

Payback framing: the site is free, so "payback" = cost per *planner started* that would otherwise cost the owner a video. ESTIMATE: if a TikTok that takes 2 hours to make yields 300 site visits (owner's own data needed), the owner's time-cost per visit is a few cents; paid channels only beat that at Google-search CPCs of ≤$0.50, so Google exact-match on "things to do in austin this weekend"-type terms is the only paid line worth more than a one-week test.

---

## 6. Measurement

### 6.1 Tool choice for a GitHub Pages site (no server, no cookies banner wanted)

| Tool | Price | Limits | Notes | Tag |
|---|---|---|---|---|
| **Cloudflare Web Analytics** | Free | Not stated | JS beacon works on any host ("Copy-paste a line of JavaScript code into your site"); no cookies/localStorage, no IP/UA fingerprinting; shows referrers, URLs, countries, page speed. No custom events. | FACT https://www.cloudflare.com/web-analytics/ |
| **Umami Cloud Hobby** | $0 | 100K events/mo, 1 website, 6-month retention; Pro $20/mo for 1M events, 20 sites, 2-yr retention | Custom events (planner_started, plan_saved…) supported; MIT-licensed, self-hostable later. Best fit for the funnel below. | FACT https://umami.is/pricing ; https://umami.is/docs/cloud/faq |
| **GoatCounter** | Free for "reasonable public usage" (personal sites, small business) | No pageview cap stated; donations via GitHub Sponsors | No unique identifiers, "doesn't need a GDPR notice"; single script tag or image tracker. | FACT https://www.goatcounter.com/ |
| **Plausible** | $9/mo Starter (10k pageviews), $14 Growth, $19 Business; 30-day trial, no free tier | — | Nicest UI; not worth paying while Umami Hobby is free. | FACT https://plausible.io/#pricing |

Recommendation: Umami Cloud Hobby for events + Cloudflare beacon as a free second opinion (ad-blockers undercount; one HN commenter noted this on the post-mortem thread). FACT https://www.indiehackers.com/post/front-page-of-hn-the-full-postmortem-traffic-lessons-surprises-cbe9e0a7f6

### 6.2 What to track (recommendation)

Events, in funnel order, each with the page path and a `source` property:
1. `visit` (pageview) — by referrer and UTM.
2. `planner_started` — first item ticked on the map.
3. `plan_saved` — guest save or signed-in save (property: guest/auth).
4. `plan_shared` — share link copied / native share.
5. `route_opened` — routing map or turn-by-turn link opened.
6. `return_7d` — Umami/Plausible cannot compute this without identifiers; approximate with a first-party `localStorage` "seen before" flag that sets a `returning=true` property on `visit` (no cookie, no PII).
7. `classified_posted` and `classified_contacted` when classifieds ship.
8. `tour_started` (GPS tours) — distinct from planner.

Ratios to watch: visit→planner_started (target 10%+ on mobile from Austin), planner_started→plan_saved, plan_shared per saved plan (the viral loop), share of visits with `returning=true`.

### 6.3 UTM discipline (recommendation)

- Every link the owner controls gets `utm_source`/`utm_medium`/`utm_campaign` in lower-case, fixed vocabulary: source ∈ {tiktok, x, substack, patreon, youtube, instagram, reddit, hn, producthunt, citycast, atxtoday, airbnb-kit, ut-marketplace, qr-card, google-ads, meta-ads, reddit-ads, nextdoor-ads}; medium ∈ {social, video, newsletter, print, cpc, referral}; campaign = event or month (`sxsw-2027`, `acl-2026`, `launch-classifieds`).
- Short links: one slug per placement (`austin.chat/s/airbnb`) redirecting with UTMs so QR cards stay clean; keep the slug table in the repo.
- Never post the bare domain anywhere you can post a tagged link; the bare-domain "direct" bucket is the unknown you want to shrink.

### 6.4 Weekly growth review (template, 20 minutes, Monday)

```
Week of ____   Analytics: Umami + Cloudflare
1. Visits: ___ (prev ___)  | Austin share: ___%  | mobile share: ___%
2. Top 5 sources (UTM/referrer) with visits and planner_started each:
   a. ___  b. ___  c. ___  d. ___  e. ___
3. Funnel: visit ___ → planner_started ___ (__%) → plan_saved ___ (__%) → plan_shared ___
4. Returning (localStorage flag): ___% of visits
5. Classifieds: posts ___ / contacts ___ (once live)
6. Paid: spend $___ | visits ___ | $/visit ___ | $/planner_started ___  (kill anything > $1/visit after 2 weeks)
7. Press/partners: pitches sent ___ | replies ___ | links earned (list)
8. Content shipped: videos ___ | plan templates ___ | which one drove the most planner_started?
9. One thing to stop, one thing to double next week.
```

### 6.5 Realistic traffic benchmarks (what "working" looks like)

| Case | Numbers | Relevance | Tag |
|---|---|---|---|
| CityXee (city guide, year 1) | 42,000 visits and 130,000 pageviews in its first year, mostly organic search + organic social (~3,500 visits/month average). | Closest small-local-guide analogue: a solo site doing well is ~3–5k visits/month at 12 months. | FACT https://cityxee.com/en/?p=46215 |
| Visit A City (travel-guide SEO case) | 28.5K → 199.7K monthly visits in 6 months, by growing from ~1.6K to 16K+ URLs. | Shows what scale needs: thousands of indexable pages (neighborhood × category pages), not a map app alone. | FACT https://aioseo.com/trends/visit-a-city-seo-case-study/ |
| NewCanaanite.com (hyperlocal news) | 1M pageviews in first full calendar year; funded by local advertisers. | Upper bound for a one-town site with daily news output. | FACT https://newcanaanite.com/newcanaanite-com-hits-1-million-pageviews-for-2015-34113 |
| Do512 (established Austin events site) | ~138K visits/month (414.5K per 3 months), 66.5% organic search, 51% bounce. | Ceiling for an Austin things-to-do site after many years; 2/3 of it is Google. | FACT https://www.similarweb.com/website/do512.com/ |
| HN front page | 4k–11k visitors in ~1.5 days, then decay. | One-off spike; do not plan around it. | FACT (self-reported) see section 2 |

ESTIMATE targets for austin.chat: month 6 = 2,000–4,000 visits/month with ≥40% from Austin and ≥10% planner_started; month 12 = 5,000–10,000/month if neighborhood/category pages get indexed and one event cycle (SXSW or ACL) is executed with templates + a City Cast/Chronicle mention. Anything above that in year one needs either a crisis-moment data tool (section 1.4) or paid search at ≤$0.50/visit sustained.

---

## 7. What NOT to do (with sources)

1. **Do not pitch the Austin Monitor** — closed Oct 2025; and do not pitch the Austin Current with a product launch, its tips page asks for documents/evidence of wrongdoing or misleading officials. https://www.austinmonitor.com/ , https://austincurrent.org/tips/
2. **Do not ask anyone to upvote** on Product Hunt ("can't ask people directly to upvote") or Hacker News ("asking friends to upvote or comment" is disallowed). https://www.producthunt.com/launch/guide , https://news.ycombinator.com/showhn.html
3. **Do not Show HN a landing page, a newsletter, or anything behind sign-up**; those are "not Show HNs". https://news.ycombinator.com/showhn.html
4. **Do not launch on Product Hunt from a "City Anatomy" company account** — prohibited; use the owner's personal account. https://www.producthunt.com/launch/guide
5. **Do not mention selling source code in r/MapPorn posts** ("selling products is not allowed") and do tag interactive maps "[Interactive]"; in r/dataisbeautiful tag "[OC]" and explain tools/data in a comment. https://rl.klein.ruhr/r/MapPorn/wiki/faq , https://rl.klein.ruhr/r/dataisbeautiful/wiki/index (UNCERTAIN mirrors; re-read the live sidebars first)
6. **Do not treat Reddit's $5/day as a real test**; third-party guides say $50–100/day is needed for signal — so cap at $5/day × 14 days and judge only by $/visit, not by Reddit's own optimization. https://www.dataslayer.ai/blog/reddit-ads-in-2025-complete-guide-for-marketers (UNCERTAIN)
7. **Do not buy billboards or bus ads**: $1,200–$8,000 per 4-week flight with 4-week minimums, unmeasurable for a free site. https://adquick.com/billboard-cost/austin-city-texas , https://billboardsin.com/market/austin-texas/transit-advertising
8. **Do not expect a free Visit Austin link**: its partnership page sells corporate sponsorships to Delta and Tito's; pricing is by inquiry only. https://www.austintexas.org/partnerships/
9. **Do not try to advertise on Austin Towers** ("we do not accept advertiser support"). https://austin.towers.net/about/
10. **Do not use the KVUE Defenders tip line** (investigative) for a product story; use the newsroom number or a named reporter. https://www.kvue.com/contact-us
11. **Do not spend on Meta for site visits**; at $10–15 US CPM it is ≥$1/visit; use it only to amplify videos. https://affectgroup.com/blog/meta-ads-cpm-in-the-us-2025-benchmarks-for-facebook-and-instagram/
12. **Do not plan around a Show HN/PH spike**; traffic is 1–2 days and "no direct conversions" in the best-documented case. https://www.indiehackers.com/post/front-page-of-hn-the-full-postmortem-traffic-lessons-surprises-cbe9e0a7f6
13. **Do not pay for analytics yet**; Umami Hobby, GoatCounter and Cloudflare are free and cookie-less. https://umami.is/pricing , https://www.goatcounter.com/ , https://www.cloudflare.com/web-analytics/

---

## 8. Suggested 90-day sequence (recommendation, derived from the above)

1. Week 1: Umami Hobby + Cloudflare beacon live; UTM vocabulary and short-link table in the repo; funnel events wired.
2. Week 1–2: Airbnb-host kit (QR card PDF + 3-line message) and bachelorette/UT-gameday plan templates.
3. Week 2: Show HN (routing-engine angle) + r/SideProject + r/MapPorn [Interactive] (Sanborn 1885) — three posts, one week, all UTM'd.
4. Week 3: pitches — Silicon Hills News (Laura), City Cast Austin (austin@citycast.fm), ATXplained question; Austin Current only with a data story (data centers / budget).
5. Week 3–6: $5/day Google exact-match test on "things to do in austin this weekend"-type terms, Austin geo, mobile; one $25–$200 ATXtoday self-serve text ad; kill anything over $1/visit.
6. Month 2–3: Trail of Lights (Dec 10–23) template and QR cards; then the Feb–Mar SXSW cycle (templates mid-Feb, pitches late Feb, Best of Austin nominations when round 1 opens).
7. Every Monday: the 20-minute review above; every finding into docs/STATUS.md.
