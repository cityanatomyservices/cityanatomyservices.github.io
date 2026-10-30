# 04 — Launching a free Austin-only classifieds section (cold start, trust, legal)

Research note for austin.chat, 2026-10-29. Labels: **FACT** = sourced (URL follows the claim), **ESTIMATE** = my arithmetic shown, **UNCERTAIN** = secondary/unverified source or could not confirm.

Search tooling note: WebSearch worked; DuckDuckGo HTML was bot-walled; reddit.com and facebook.com are unfetchable from here, so Reddit sizes come from GummySearch mirrors and Facebook group sizes are mostly UNCERTAIN.

---

## 1. The Austin classifieds landscape today

### 1.1 Craigslist Austin — still the biggest free board, shrinking, and some sections are nearly dead

- Craigslist started in early 1995 as Craig Newmark's email list of San Francisco events; it moved to Majordomo in June 1995, went to the web in 1996, and only expanded to nine more US cities in 2000. **FACT** https://en.wikipedia.org/wiki/Craigslist
- Company-wide, Craigslist revenue is reported at about $302M in 2025 vs $1.04B in 2018, and it has had a six-year traffic/revenue slide while still being the #1 US classified site. **FACT** https://en.wikipedia.org/wiki/Craigslist and https://www.businesswire.com/news/home/20250502636729/en
- Similarweb (Sept 2026 data): craigslist.org ~96M visits in the period shown, global rank #161, US rank #49, #1 in US Classifieds, bounce 22.5%, 22.9 pages/visit, 7:00 average visit; 94% of traffic is US. Top "competitors" by audience affinity: offerup.com, zillow.com, ebay.com, apartments.com. **FACT** https://www.similarweb.com/website/craigslist.org/
- Similarweb for the Austin subdomain shows ~201K visits in the "last 3 months" box, bounce 80.6%, 8.8 pages/visit, down 13% month-on-month. **UNCERTAIN as an Austin audience figure** — Craigslist now 301-redirects `austin.craigslist.org/search/...` to `www.craigslist.org/search/area/austin`, so the subdomain estimate undercounts Austin use (I observed that redirect while fetching). https://www.similarweb.com/website/austin.craigslist.org/
- **Live section counts on 2026-10-29** (I counted listings on the public search pages; these are what a competitor would have to beat): **FACT (observed)**
  | Austin Craigslist section | Listings showing | URL |
  |---|---|---|
  | free stuff (`zip`) | 360 | https://www.craigslist.org/search/area/austin?cat=zip |
  | apartments/housing (`apa`) | 346 | https://www.craigslist.org/search/area/austin?cat=apa |
  | gigs (`ggg`) | 279 | https://www.craigslist.org/search/area/austin?cat=ggg |
  | musicians (`muc`) | 161 | https://www.craigslist.org/search/area/austin?cat=muc |
  | sublets/temporary (`sub`) | 45 | https://www.craigslist.org/search/area/austin?cat=sub |
  | lost & found (`laf`) | 37 | https://www.craigslist.org/search/area/austin?cat=laf |
  | tickets (`tia`) | 19 | https://www.craigslist.org/search/area/austin?cat=tia |
  | garage/moving sales (`gms`) | 13 | https://www.craigslist.org/search/area/austin?cat=gms |
  Reading: free stuff, gigs and musicians are still alive in Austin; tickets, garage sales, lost & found and sublets are thin (a new board could reach parity with 20–50 real posts). The gigs section is dominated by labor-recruiting posts ("Housekeepers apply here", "Moving helpers needed"), i.e. semi-commercial. Sublets showed one "Airstream at COTA for F1 weekend" — event-week housing demand exists.
- Craigslist's US Personals closed March 22, 2018 after Congress passed FOSTA/SESTA (signed April 11, 2018), to avoid civil liability. **FACT** https://en.wikipedia.org/wiki/Craigslist
- Moderation model: anyone can flag a post anonymously without logging in; a post is removed automatically once a dynamic, secret flag threshold is reached; automated systems also flag; ~50 employees at ~$1B revenue in 2019. **FACT** https://en.wikipedia.org/wiki/Craigslist
- Posting mechanics: free posts live 7–45 days depending on category and market, paid posts 30 days. **FACT** https://www.craigslist.org/about/help/faqs/lifespan Renewal "once per 48 hours" is widely reported by third parties but not on the official page I could reach. **UNCERTAIN** https://itstillworks.com/how-to-refresh-posts-on-craigslist.html
- Phone verification: some postings require it; one phone number can be tied to only one account at a time; the number is never shown on the post; the code is only ever asked for during posting (any other request is a scam). **FACT** https://www.craigslist.org/about/help/posting/verify/phone
- Craigslist's prohibited list (useful as a starting template): firearms and components, ammunition, prostitution/sex trafficking, recalled items, prescription drugs, alcohol/tobacco, **pet sales ("re-homing with small adoption fee ok")**, stolen property, counterfeit items, "tickets or gift cards that restrict transfer", lottery/raffle, MLM/affiliate marketing, "postings the primary purpose of which is to drive traffic to a website". **FACT** https://www.craigslist.org/about/prohibited
- Craigslist RSS feeds still technically exist but IFTTT warns they are "severely rate-limited and may stop working entirely" and points users to Craigslist's own saved-search email alerts. **FACT** https://help.ifttt.com/hc/en-us/articles/360024449693

### 1.2 Facebook Marketplace and Austin buy/sell groups — the incumbent for goods

- Marketplace launched Oct 3, 2016 on top of existing behaviour: "more than 450 million people visit buy and sell groups each month"; sellers could post to a buy-and-sell group at the same time as Marketplace. **FACT** https://about.fb.com/news/2016/10/introducing-marketplace-buy-and-sell-with-your-local-community/
- Facebook Commerce Policies prohibit, among other things: **animals**, weapons/ammunition, alcohol, tobacco, **job opportunities**, adult content, gambling, stolen goods, digital downloads; **event tickets, gift cards, pet adoption matching and services are "restricted" (approved sellers only)**. **FACT** https://www.facebook.com/policies/commerce/  → This is the hole a free board can stand in: Marketplace cannot carry pet rehoming, ticket swaps between fans, or gig/job posts.
- Scam prevalence (not Austin-specific): UK bank TSB assessed 34% of Marketplace adverts it tested as scams (Jan 2024). **FACT** https://www.tsb.co.uk/news-releases/urgent-consumer-warning-as-tsb-finds-over-a-third-of-adverts-on-facebook-marketplace-could-be-scams Generation Rent found 56% of 300 UK rental listings on Marketplace were lifted from other sites. **FACT** https://www.generationrent.org/?p=9853
- Austin-area group sizes I could source: Lakeway Swap "over 1,500 active members", Buy & Sell in Steiner "over 1,300", and "Steiner Sells-Items grew so big they switched from a Facebook group to a website" (undated lifestyle blog). **UNCERTAIN** https://laketravislifestyle.com/get-connected-lake-travis-area-facebook-groups/ Citywide "Austin buy/sell/trade" group counts could not be fetched (facebook.com blocked). **UNCERTAIN**
- Austin robbery pattern at Marketplace meetups: APD Robbery Unit filed a 2nd-degree felony warrant in Oct 2024 over a jewelry theft at a Marketplace meetup on N Lamar. **FACT** https://www.austintexas.gov/node/96453 In 2018 APD arrested a suspect in a string of North Austin robberies where victims answered PlayStation/TV ads on Marketplace, OfferUp and letgo. **FACT** https://patch.com/texas/north-austin/arrest-made-north-austin-string-robberies

### 1.3 Nextdoor For Sale & Free

- Nextdoor's Austin city page advertises "See 1,000+ listings in Austin" under "For sale and free items nearby". The "958,202 neighbors" figure on that page is census population, not members. **FACT** https://nextdoor.com/city/austin--tx/
- Free Finds (June 3, 2021): listings to the buy/sell/give product were up 80% since the start of 2020, 25% of items are free, and free listings are browsable **without an account** (sign-up only to contact the giver); 276,000 neighborhoods, "nearly 1 in 3 US households". **FACT** https://about.nextdoor.com/press-releases/nextdoor-expands-its-buy-sell-and-give-feature-with-the-launch-of-free-finds
- Nextdoor does not permit animal sales but allows modest rehoming fees (as summarized on the City of Austin rehoming page). **FACT** https://www.austintexas.gov/animal-services/rehoming-pet

### 1.4 OfferUp, Mercari, Depop

- OfferUp: hyperlocal, face-to-face, started by building a user base "within a small area in Seattle, then expand" (Seattle Met, 2016 — page returned 403 for me; claim is from the search snippet). **UNCERTAIN** https://www.seattlemet.com/news-and-city-life/2016/01/seattle-s-offerup-grew-from-the-ashes-of-two-failed-startups Harvard case: ~$14B reported 2016 GMV, ~18M downloads, $221M raised, no fees at the time; trust via ratings, user verification and ML scam detection vs Craigslist's "wild-west" feel. **FACT (as cited by the case)** https://d3.harvard.edu/platform-digit/submission/offerup-tackling-craigslist-head-on/ OfferUp had another round of layoffs in 2025 while "simplifying its offerings". **FACT** https://www.geekwire.com/2025/offerup-hit-with-new-round-of-layoffs-as-marketplace-plans-to-simplify-its-offerings/
- Mercari (US): ~23M monthly active users per a reseller blog. **UNCERTAIN** https://blog.vendoo.co/how-much-does-mercari-take-what-you-need-to-know-about-mercari-fees Mercari abruptly discontinued its US local-delivery offering with <24 h notice during a 2025 leadership shake-up. **FACT (trade press)** https://www.valueaddedresource.net/mercari-2025-leadership-shakeup-japan-updates-shape-us-marketplace/
- Depop: founded 2011 at the H-Farm incubator in Italy as a way for readers of PIG magazine to buy what was in the magazine; growth "mainly through word of mouth"; 13M users by 2019; Etsy paid $1.6B in 2021; eBay bought it for $1.2B in 2026. **FACT** https://en.wikipedia.org/wiki/Depop

### 1.5 Free/gift economy: Buy Nothing, Freecycle

- Austin has about 70 Buy Nothing groups (neighborhood-sized); the project reports ~5.3M members in ~7,000 groups in 44 countries. **FACT** https://money.com/best-deals-buy-nothing-facebook/
- During the Feb 2021 freeze, Austin Buy Nothing groups were where people found water, food and generators — evidence they are the trusted hyperlocal gift channel. **FACT** https://www.kut.org/energy-environment/2021-02-23/when-power-and-water-failed-buy-nothing-groups-helped-fill-the-gaps
- Freecycle "Austin, TX" town: 15,990 members. **FACT** https://www.freecycle.org/town/AustinTX

### 1.6 Reddit (GummySearch mirrors, Oct 2026)

| Subreddit | Members | 12-mo growth | What is posted | Source |
|---|---|---|---|---|
| r/Austin | ~544k | — | general; lost-pet wiki | https://gummysearch.com/r/Austin/ |
| r/askaustin | ~61k | — | questions; lists r/AustinClassifieds as a sister sub | https://lr.eu.psf.lt/r/askaustin |
| r/austinjobs | ~46k | +8k (+20%) | flairs Hiring 38, For Hire 26 | https://gummysearch.com/r/austinjobs/ |
| r/AustinClassifieds | ~41k | +10k (+33%) | flairs Offering Item 48, Seeking Item 10, **Offering Tickets 10, Tickets Megathread 8** | https://gummysearch.com/r/AustinClassifieds/ |
| r/AustinHousing | ~13k | +6k (+90%) | ISO 32, Room Available 31; topics Apartment 60, Roommate 22, Sublease 19 | https://gummysearch.com/r/AustinHousing/ |
| r/AustinMusicians | ~7k | +2k (+40%) | Band 22, Open Mic 11, Drummer 6 | https://gummysearch.com/r/AustinMusicians/ |

All **FACT (third-party mirror; counts rounded by the mirror)**. Note that a stats site flagged r/AustinClassifieds as possibly quarantined, which I could not verify. **UNCERTAIN** https://subredditstats.com/r/AustinClassifieds  Takeaway: Reddit Austin classifieds demand is growing 20–90%/yr while Craigslist shrinks, and the ticket-swap megathread is the single most structured thing happening there.

### 1.7 UT / ACC housing boards

- About 82% (~45,000) of UT students live off campus. **FACT** https://thedailytexan.com/2026/05/01/student-led-initiatives-highlight-housing-concerns-in-west-campus/
- UT's recommended off-campus tool uTexas.Rent requires a Facebook login. **FACT** https://cloud.wikis.utexas.edu/wiki/x/wJFEAg The r/UTAustin wiki lists student Facebook groups (buy/sell/trade, Buy Nothing). **FACT** https://axebps-redlib.hf.space/r/UTAustin/wiki/facebook
- West Campus sublease posts are active on r/AustinHousing ("take over my lease at The Nine"). **FACT** https://redlib.ssps.io/r/AustinHousing (mirror; the official UT off-campus housing site did not resolve from here). The UT off-campus housing board itself: **UNCERTAIN**.

### 1.8 Austin Chronicle classifieds, musicians boards

- The Chronicle still runs a Classifieds menu: Jobs, Legals, Marketplace, Licensed Massage, **Music**, Back Page, Obituaries, Real Estate, "Place an Ad". **FACT** https://www.austinchronicle.com/ The /classifieds/ landing URL returned 404 and I could not find listing counts or prices. **UNCERTAIN**
- In 2005 Poynter described the Chronicle as "ground zero of the Craigslist threat" with a steep drop in classifieds. **FACT** https://poynter.org/reporting-editing/2005/lean-times-for-the-chronicle
- Musicians: Craigslist `muc` (161 live posts) and r/AustinMusicians (~7k) are the two living boards I could verify; Bandmix and Facebook groups are mentioned in low-quality pages. **UNCERTAIN beyond the two verified**

### 1.9 Long-tail aggregators (so you know what "page 2" of Google looks like)

| Site | Traffic | Source |
|---|---|---|
| locanto.com | 703K visits (Sept 2026), US rank #12,532, **#8 in US Classifieds** | https://www.similarweb.com/website/locanto.com/ **FACT** |
| hoobly.com | 654K–981K visits/month (Nov 2025–Jan 2026, Semrush) | https://de.semrush.com/website/hoobly.com/overview **FACT (estimator)** |
| classifiedads.com | 772.8K visits (Mar 2025, Semrush) | https://ko.semrush.com/website/geebo.com/competitors **FACT (estimator)** |
| geebo.com | 136K–228K visits/month (early 2025, Semrush) | https://ko.semrush.com/website/geebo.com/overview **FACT (estimator)** |
| oodle.com | still live as an aggregator (no current traffic found) | https://en.wikipedia.org/wiki/Oodle **UNCERTAIN** |

Reading: a site that is #8 in the whole US classifieds category gets ~700K visits/month nationally. ESTIMATE: Austin is ~1% of the US population, so a national #8 gets on the order of 7K Austin visits/month — a well-run Austin-only board with a few hundred live posts would be competitive with every aggregator except Craigslist/Facebook/Nextdoor/OfferUp within months.

---

## 2. The chicken-and-egg problem: what worked, what failed

### 2.1 Case studies that worked

| Who | What they actually did | Numbers | Source |
|---|---|---|---|
| **Craigslist (1995–97)** | Started as a friends-only email list about SF events; the list itself asked for jobs/apartments; apartment listings were added when the dot-com boom created a shortage; web in 1996; no second city for five years. | ~240–250 subscribers by mid-1995; Majordomo June 1995; 9 new cities in 2000, 4 in 2001, 4 in 2002, 14 in 2003 | https://en.wikipedia.org/wiki/Craigslist **FACT**; apartment-shortage wedge: https://www.encyclopedia.com/books/politics-and-business-magazines/craigslist-inc **FACT (secondary)** |
| **Nextdoor (2010)** | Pivoted from Fanbase; co-founder's friends lived in Lorelei Manor (Menlo Park); the friend insisted the HOA board vet it first; Sarah Leary pitched the board (last item on the agenda); pilot in summer 2010; first month was used for a Halloween parade, a lost package and music-teacher recommendations. | ~90 households, 92% owner-occupied; 140,000 neighborhoods by 2017 | https://www.almanacnews.com/news/2017/06/16/menlo-park-lorelei-manor-hailed-as-nextdoors-first-neighborhood/ **FACT** |
| **Facebook Marketplace (2016)** | Did not seed from zero: formalized the 450M people/month already trading in Groups and let sellers cross-post to groups from the listing form. | 450M monthly group visitors at launch | https://about.fb.com/news/2016/10/introducing-marketplace-buy-and-sell-with-your-local-community/ **FACT** |
| **Nextdoor Free Finds (2021)** | Made free listings public (no account to browse) to pull in non-members; sign-up only to contact the giver. | listings +80% since 2020, 25% free | https://about.nextdoor.com/press-releases/nextdoor-expands-its-buy-sell-and-give-feature-with-the-launch-of-free-finds **FACT** |
| **OfferUp (2011–)** | Single metro (Seattle) first, then metro-by-metro; camera-first listing; ratings + verification as the anti-Craigslist pitch. | ~$14B GMV 2016 (reported), 18M downloads | https://d3.harvard.edu/platform-digit/submission/offerup-tackling-craigslist-head-on/ **FACT (as cited)** |
| **Depop (2011–)** | Single category (fashion) and a pre-existing audience (PIG magazine readers); word of mouth, Instagram-like feed, sellers as their own promoters. | 13M users 2019; $1.6B exit 2021 | https://en.wikipedia.org/wiki/Depop **FACT** |
| **Airbnb / "do things that don't scale"** | Founders went door-to-door in New York recruiting hosts and improving listings; "about 30 days of going out and engaging in person with users made the difference"; Paul Graham's advice: pick a deliberately narrow market where you can reach critical mass fast (Facebook at Harvard). | — | https://paulgraham.com/ds.html **FACT** |

Pattern across all seven: (1) a pre-existing group that already trades (email list, HOA, FB groups, magazine readers); (2) one place or one category; (3) the operator does the first posts/recruiting by hand; (4) browsing is open, posting is gated.

### 2.2 Failures and warnings

- **Backpage**: launched 2004 as a Craigslist rival; after Craigslist closed Adult Services in 2010 under state AG pressure, adult ads moved to Backpage; seized by the FBI April 6, 2018; FOSTA was signed April 11, 2018 but the defendants were charged under the Travel Act and money-laundering statutes; Lacey got 5 years in Aug 2024. **FACT** https://en.wikipedia.org/wiki/Backpage  Lesson: Section 230 did not save a site whose revenue was 99% one illegal category (per the California warrant cited there).
- **Oodle (2005–)**: launched as a classifieds aggregator; Craigslist demanded it stop and blocked its IPs within months. **FACT** https://www.inman.com/2005/10/18/craigslist-oodle-stop-using-our-classified-ads/  It powered Facebook's Marketplace from March 2009, was sold to QVC in 2012 and spun out in 2015 — a utility, never a destination. **FACT** https://en.wikipedia.org/wiki/Oodle
- **3Taps / PadMapper (2012–15)**: Craigslist sued scrapers; the CFAA claim survived a motion to dismiss (Apr 2013); settled June 2015 with a permanent injunction and $1M from 3Taps (donated to EFF). **FACT** https://www.eff.org/deeplinks/2015/06/padmapper-and-3taps-settle-suit-craigslist-over-use-real-estate-facts and https://en.wikipedia.org/wiki/Craigslist_Inc._v._3Taps_Inc.  Lesson: never seed with scraped Craigslist/Facebook posts.
- **Newspaper classifieds**: US newspaper classified revenue peaked at $19.6B in 2000 and was under $10B by 2008 (Pew via CNET/Vator). **FACT** https://vator.tv/2009-05-26-newspapers-lose-96-bln-in-ads/  Seamans & Zhu (NYU/HBS) estimate Craigslist alone cost newspapers at least $5B in 2000–07. **FACT** https://www.stern.nyu.edu/experience-stern/news-events/seamans-craigslist-study
- **Lyte (fan-to-fan ticket exchange, 2024)**: site went dark Sept 13, 2024 after $53M raised; festivals sued over unpaid ticket revenue (Baja Beach Fest ~$800K); reporting says most "fan" listings were promoter inventory. **FACT** https://www.digitalmusicnews.com/2024/09/17/after-53-million-in-funding-is-lyte-shutting-down/ and https://news.pollstar.com/2024/09/17/lyte-website-down-as-industry-sources-fear-trouble-for-ticketing-service/  Lesson: do not hold money; a listings-only swap board has no custody risk.
- **Craigslist Personals (2018)**: a whole category deleted overnight to avoid FOSTA civil exposure. **FACT** https://en.wikipedia.org/wiki/Craigslist  Lesson: do not launch "personals", "massage" or "escorts" categories at all.
- **Yahoo Classifieds**: could not source its shutdown; omitted. **UNCERTAIN**

---

## 3. Which categories a free Austin board could own

Evidence of unmet demand = (incumbent prohibits or ignores it) + (Reddit/Craigslist show people doing it anyway).

| Category | Evidence of demand | Incumbent gap | Legal limit to design around | Verdict |
|---|---|---|---|---|
| **Event ticket swaps (ACL, SXSW, F1, UT, Moody Center shows)** | r/AustinClassifieds runs a Tickets Megathread (8) and has "Offering Tickets" as a top flair (10) https://gummysearch.com/r/AustinClassifieds/ **FACT**; Craigslist Austin tickets has only 19 posts https://www.craigslist.org/search/area/austin?cat=tia **FACT**; 2024 ACL 3-day wristbands resold at $800 https://www.aol.com/worst-acl-fest-2024-wristbands-215353498.html **FACT** | Facebook Commerce Policies make event tickets "restricted" (approved sellers only) https://www.facebook.com/policies/commerce/ **FACT** | Texas has no statewide cap on resale price (2016 review) https://www.skadden.com/insights/publications/2016/03/key-takeways-the-emerging-legal-landscape-regardin **FACT**; Texas bans ticket **bots** (Bus. & Com. Code ch. 328, eff. Sept 1 2023) https://texas.public.law/statutes/tex._bus._and_com._code_section_328.002 **FACT**; SB 1820 (2025 disclosure/resale rules) died in committee 3/13/2025 https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB1820 **FACT**. BUT: UT Big Ticket student tickets are non-transferable and cannot be resold https://texaslonghorns.com/BigTicket **FACT**; SXSW: wristbands non-transferable, badges one free transfer before issue, no name changes after https://sxsw.com/transfer-policy/ **FACT**; ACL only supports wristbands bought via its site, Front Gate or Ticketmaster Verified Exchange, and APD has charged wristband re-sellers with felonies https://www.fox7austin.com/news/acl-music-festival-ticket-scams-wristband-thefts and https://www.austinchronicle.com/music/apd-serves-up-felonies-in-acl-wristband-sting-12100924/ **FACT**; COTA F1 tickets described as non-transferable/not for resale https://parkingaccess.com/circuit-of-the-americas-parking **UNCERTAIN** | **Strong wedge, with rules**: allow face-value swaps of transferable tickets (Moody Center, ACL Live, Bass, Longhorns general tickets); disallow Big Ticket, SXSW wristbands, removed ACL wristbands; show the venue's transfer rule on the form. |
| **Sublets / lease takeovers near UT & ACC** | ~45,000 UT students off campus https://thedailytexan.com/2026/05/01/student-led-initiatives-highlight-housing-concerns-in-west-campus/ **FACT**; r/AustinHousing growing 90%/yr with Sublease/Roommate as top topics https://gummysearch.com/r/AustinHousing/ **FACT**; Craigslist Austin sublets only 45 https://www.craigslist.org/search/area/austin?cat=sub **FACT**; UT's own tool needs a Facebook login https://cloud.wikis.utexas.edu/wiki/x/wJFEAg **FACT** | 56% of UK Marketplace rental listings were lifted from other sites https://www.generationrent.org/?p=9853 **FACT** (scam-magnet category) | Fair Housing Act ad rules (see §4); roommate ads are FHA-exempt per Roommates.com (9th Cir. 2012) https://law.justia.com/cases/federal/appellate-courts/ca9/09-55272/09-55272-2012-02-02.html **FACT** | **Strong, seasonal** (May and Dec). Map-based browsing is the differentiator (West Campus / Riverside / North Campus pins). |
| **Musicians & gigs** | Craigslist muc still 161 posts https://www.craigslist.org/search/area/austin?cat=muc **FACT**; r/AustinMusicians ~7k, +40% https://gummysearch.com/r/AustinMusicians/ **FACT**; Chronicle still sells "Music" classifieds https://www.austinchronicle.com/ **FACT** | Facebook prohibits "job opportunities" in commerce listings https://www.facebook.com/policies/commerce/ **FACT** | none special | **Good**: cheap to moderate, on-brand for Austin, low scam rate. |
| **Free stuff / curb alerts** | Craigslist Austin free = 360 posts (largest section) https://www.craigslist.org/search/area/austin?cat=zip **FACT**; Nextdoor: 25% of listings free, +80% https://about.nextdoor.com/press-releases/nextdoor-expands-its-buy-sell-and-give-feature-with-the-launch-of-free-finds **FACT**; ~70 Buy Nothing groups, Freecycle 15,990 https://money.com/best-deals-buy-nothing-facebook/ , https://www.freecycle.org/town/AustinTX **FACT** | Buy Nothing is split into ~70 walled groups; Freecycle is email-era | none | **Strong for a map**: "free stuff near me, on a map, no login" is exactly Nextdoor's Free Finds move, done citywide and open. Zero money → near-zero scam/legal load. |
| **Garage / estate sales by neighborhood** | Craigslist Austin gms only 13 posts https://www.craigslist.org/search/area/austin?cat=gms **FACT** (one was a 69-home community sale) | Marketplace has no sale-event type | Texas: individuals can make 1–2 sales per 12 months, or sell unlimited personal items up to $3,000/calendar year, before needing a sales-tax permit https://comptroller.texas.gov/taxes/publications/94-437.php **FACT**; Austin: no permit, but signs must stay on the sale property and off-premises bandit signs get removed/fined https://cityrulelookup.com/property-maintenance/garage-sale-rules/austin-tx **UNCERTAIN (aggregator)** | **Good map wedge** (dated pins, Saturday morning use) and a natural Short every week. |
| **Lost & found (pets, phones, bikes)** | Craigslist laf 37 posts https://www.craigslist.org/search/area/austin?cat=laf **FACT**; the City itself sends people to the Facebook groups "Austin Lost and Found Pets" and "Austin TX Lost and Found Pets", Nextdoor, Craigslist, Petco Love Lost, PawBoost https://www.austintexas.gov/lost-a-pet **FACT**; group size reported as 80k (Reddit) or 16k (KXXV) **UNCERTAIN** | the pet groups are strong; non-pet lost & found has no home | none | **Pets: don't compete, link to them. Non-pet lost & found: cheap to own on a map.** |
| **Pet rehoming** | — | Facebook prohibits animals; Nextdoor allows modest rehoming fees https://www.austintexas.gov/animal-services/rehoming-pet **FACT**; Craigslist allows rehoming "with small adoption fee" https://www.craigslist.org/about/prohibited **FACT**; City runs Home To Home for direct rehoming https://www.austintexas.gov/animal-services/rehoming-pet **FACT** | Austin bans animal sales in public spaces; new Texas HB 2012/HB 2731 (eff. Sept 1 2025) let large counties ban outdoor sales https://www.tpr.org/government-politics/2025-07-01/new-texas-laws-target-roadside-pet-sales-and-puppy-mills **FACT**; Austin requires dogs/cats to be registered & microchipped before sale, Class C, $200–$2,000 per animal https://digital-release.kxan.com/?p=2718517 **UNCERTAIN (secondary)**; Austin banned pet-store sales in 2010 https://www.austinmonitor.com/stories/2010/12/despite-rescue-groups-concerns-council-oks-ban-on-pet-stores/ **FACT** | **Avoid at launch**; later: rehoming-only, fee capped, link out to Home To Home. |
| **Gig work / odd jobs** | Craigslist gigs 279 posts, mostly recruiters https://www.craigslist.org/search/area/austin?cat=ggg **FACT**; r/austinjobs 46k **FACT** | Facebook prohibits job listings in commerce https://www.facebook.com/policies/commerce/ **FACT** | employment-ad discrimination law; high spam | **Later**: spam magnet (MLM, "work from home"), heavy moderation. |
| **Rideshares to events (ACL/F1/Big Bend)** | no Austin data found **UNCERTAIN** | Craigslist rideshare section exists nationally | liability optics | **Skip**. |
| **Neighborhood services** | — | FB "services" restricted | Texas licensed trades | **Skip** (becomes a lead-gen spam target instantly). |

What people complain about (from the sources above, not Austin-thread-specific because reddit.com is blocked here): scam listings on Marketplace (34%/56% figures), robbery meetups in Austin, Marketplace's bans on tickets/animals/jobs, Craigslist's decline and 80% bounce. **FACT for each, cited above; Austin-specific Reddit sentiment UNCERTAIN.**

---

## 4. Trust & safety and legal (US / Texas, solo operator)

### 4.1 Federal

- **Section 230(c)(1)**: a provider or user of an interactive computer service is not treated as the publisher or speaker of information provided by another content provider; **(c)(2)** protects good-faith removal of objectionable material; **(e)** carve-outs: federal criminal law, intellectual property, and **(e)(5) sex-trafficking civil claims under 18 U.S.C. 1595 / state prosecutions** (the FOSTA addition). **FACT** https://www.law.cornell.edu/uscode/text/47/230
- **Fair Housing Act ads**: Seventh Circuit held Craigslist immune under §230 for discriminatory third-party housing ads (March 14, 2008, 519 F.3d 666). **FACT** https://blog.ericgoldman.org/archives/2008/03/craigslist_gets.htm  Contrast: Roommates.com lost §230 for the discriminatory questions in its own form (2008) but in 2012 the Ninth Circuit held the FHA does not reach roommate selection in a shared dwelling. **FACT** https://law.justia.com/cases/federal/appellate-courts/ca9/09-55272/09-55272-2012-02-02.html  HUD charged Facebook in 2019 over ad targeting; DOJ settled June 2022 for $115,054 (the FHA maximum) plus a new ad-delivery system. **FACT** https://www.cbsnews.com/news/hud-charges-facebook-targeted-ads-enabled-housing-bias/ and https://www.nar.realtor/washington-report/meta-implements-new-housing-ads-platform-after-doj-fair-housing-settlement  Design rule: free-text only, no drop-downs for "preferred tenant" attributes, no targeting; show the "Equal Housing Opportunity" line on housing posts.
- **FOSTA/SESTA**: the reason Craigslist deleted Personals the week it passed. **FACT** https://en.wikipedia.org/wiki/Craigslist  Design rule: no personals, no "massage", no "escort", keyword filters for those on every category.
- **DMCA §512 safe harbor**: register a designated agent through the Copyright Office's online system (paper no longer accepted) and keep it current. **FACT** https://www.copyright.gov/dmca-directory/ (fee and 3-year renewal not stated on that page — **UNCERTAIN**)
- **Firearms**: no federal background-check requirement for private sales, and Texas does not add one. **FACT** https://www.tpr.org/science-technology/2016-06-17/semi-automatic-weapons-without-a-background-check-can-be-just-a-click-away  Armslist has won §230 and non-§230 defenses (Wisconsin Supreme Court 2019 and later cases). **FACT** https://reason.com/2019/05/01/armslist-not-liable-for-allowing-searches-for-private-seller-gun-ads/  Both Craigslist and Facebook ban weapons anyway. **FACT** (prohibited lists above). Design rule: ban firearms/ammo outright; it is the single highest-liability, highest-press-risk category.
- **INFORM Consumers Act**: obligations trigger only for "high-volume third party sellers" (200+ sales of **new or unused** products and $5,000+ in 12 months), and only transactions "for which payment was processed by the online marketplace" count. **FACT** https://www.law.cornell.edu/uscode/text/15/45f  A listings-only board that never touches money has zero countable transactions. ESTIMATE: not applicable as long as you never add checkout.

### 4.2 Texas

- **Texas Data Privacy and Security Act (HB 4, eff. July 1, 2024)**: applies to businesses that are not SBA small businesses; small businesses are exempt except that they may not **sell sensitive personal data without consent** (§541.107); AG-only enforcement, 30-day cure, up to $7,500 per violation, no private right of action. **FACT** https://capitol.texas.gov/tlodocs/88R/billtext/html/HB00004F.htm  GDPR is irrelevant for an Austin-only board with no EU targeting. Design rule: collect email + optional phone only; never sell data; precise location of a post should be user-chosen (neighborhood or block), not the device GPS.
- **Ticket resale**: no price cap; bots banned (ch. 328); 2025 SB 1820 died. (cited in §3.) Design rule: "face value or less" as a house rule, not a legal claim.
- **Occasional sales tax**: 1–2 sales per 12 months or ≤$3,000/yr of personal items need no permit. **FACT** https://comptroller.texas.gov/taxes/publications/94-437.php  Put this on the garage-sale form as a one-line FYI.
- **Animals**: see §3 (public-space sales banned in Austin; registration-before-sale ordinance; new county powers Sept 2025).

### 4.3 Scam patterns and standard defenses

- IC3 2024: 859,532 complaints, $16.6B losses; non-payment/non-delivery is the #2 loss category at ~$785M. **FACT** https://www.hstoday.us/subject-matter-areas/cybersecurity/fbi-releases-annual-internet-crime-report/ (summarizing https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf)
- Craigslist's own scam taxonomy: counterfeit goods, advance-fee fraud (pay before you receive), and buyer-seller collusion using stolen card details. **FACT** https://en.wikipedia.org/wiki/Craigslist
- Defenses that incumbents use and a solo site can copy: anonymous flagging with an automatic hidden threshold (Craigslist) https://en.wikipedia.org/wiki/Craigslist **FACT**; phone verification tied to one account, never displayed, only requested during posting https://www.craigslist.org/about/help/posting/verify/phone **FACT**; ratings/verification/ML (OfferUp) https://d3.harvard.edu/platform-digit/submission/offerup-tackling-craigslist-head-on/ **FACT**; open browsing but sign-up to contact (Nextdoor Free Finds) **FACT** (cited above).
- **Safe-exchange zones (put these on the map as a layer)**: all four APD stations — HQ 715 E 8th St; Central East Substation 812 Springdale Rd; South Substation 404 Ralph Ablanedo Dr; North Substation 12425 Lamplight Village Ave — plus Pflugerville PD 1611 E Pfenning Ln, Manor PD 402 W Parsons St, Round Rock PD 2701 N Mays St, Cedar Park PD 911 Quest Pkwy, Georgetown PD 3500 D.B. Wood Rd, Kyle PD 1700 Kohlers Crossing, Buda PD 405 E Loop St (added Feb 2026), Lockhart PD 214 Bufkin Ln. APD tips: check account age and phone, screenshot the conversation and profile, note the license plate, avoid apartment complexes and dim areas. **FACT** https://www.kxan.com/news/local/austin/safe-exchange-zones-central-texas/ (fetched via https://digital-release.kxan.com/?p=2831538 , KXAN, Sept 12 2025 updated Feb 18 2026)
- Moderation workload, **ESTIMATE**: Craigslist ran ~700 cities with ~50 staff in 2019 (FACT above), i.e. community flagging does almost all of the work. For an Austin board at 300–500 live posts, assume 1–3% of posts need a human look (industry figures for scam share on open platforms run 34% in the TSB test, but that is after no pre-filtering); with phone-verify + keyword filters + 2-flag auto-hide, expect roughly 5–15 moderation decisions a day at 50 new posts/day — 15–30 minutes/day for one person. Shown arithmetic: 50 posts × 10–30% flagged-or-filtered = 5–15.

---

## 5. Mechanics that drive adoption (and which incumbents lack)

| Mechanic | Evidence it matters | What austin.chat should do |
|---|---|---|
| Open browsing, no account | Nextdoor opened Free Finds to non-members to grow listings 80% https://about.nextdoor.com/press-releases/nextdoor-expands-its-buy-sell-and-give-feature-with-the-launch-of-free-finds **FACT** | Everything readable and mappable without login; sign-in (existing Google/email) only to post or reply. |
| Map-first browsing | Craigslist Austin bounce rate is 80.6% on a list UI https://www.similarweb.com/website/austin.craigslist.org/ **UNCERTAIN (subdomain)**; the site's own strength is the neighborhood map | Posts are pins with a neighborhood (not an address); garage sales and free stuff get dated pins; sublets get a campus-distance filter; safe-exchange zones as a toggle layer. |
| Email/SMS alerts + saved searches | Craigslist's own help steers users from RSS to saved-search email alerts https://help.ifttt.com/hc/en-us/articles/360024449693 **FACT**; r/AustinClassifieds flairs are "Seeking Item"/"Seeking Tickets" (want-ads) https://gummysearch.com/r/AustinClassifieds/ **FACT** | "Alert me when X is posted within N miles" by email (Supabase already there); SMS later. A want-ad is just a saved search made public. |
| Cross-posting to Facebook groups | Facebook let sellers post to a group from the Marketplace form at launch https://about.fb.com/news/2016/10/introducing-marketplace-buy-and-sell-with-your-local-community/ **FACT** | Give every post a share card (OG image with the map pin) so posters paste it into Buy Nothing / neighborhood groups themselves; never auto-post into groups (bans). |
| Expiry and renewal | Craigslist: 7–45 days free, 30 paid https://www.craigslist.org/about/help/faqs/lifespan **FACT** | 14-day default, one-click renew from the email, auto-expire; sold/claimed button that keeps the pin grey for a day (proof of liquidity). |
| RSS / API / embeds | Craigslist RSS is rate-limited; Oodle lived as a feed/aggregator for others https://en.wikipedia.org/wiki/Oodle **FACT** | Publish per-neighborhood and per-category RSS + GeoJSON; offer a one-line embed for neighborhood-association sites (they are the HOA boards of the Nextdoor playbook). |
| Phone verification for high-risk categories only | Craigslist asks only for some categories, one number per account https://www.craigslist.org/about/help/posting/verify/phone **FACT** | Require it for housing, tickets, and anything priced over ~$200; not for free stuff or lost & found. |

---

## 6. Action table — exact places to seed and announce (cost, rules, what to do)

| Place | URL | Audience | Self-promo rules | Cost | What a tiny solo site should do |
|---|---|---|---|---|---|
| r/AustinClassifieds | https://www.reddit.com/r/AustinClassifieds/ | ~41k, +33%/yr **FACT** (GummySearch) | Rules not fetchable (reddit blocked here) **UNCERTAIN**; it is itself a classifieds sub, so a competing-site link is likely treated as spam | free | Do not post an ad for the site. Participate in the Tickets Megathread as a person; once the board has real ticket swaps, ask the mods (modmail) whether a "map of current Austin ticket swaps" link is OK. |
| r/AustinHousing | https://www.reddit.com/r/AustinHousing/ | ~13k, +90%/yr **FACT** | **UNCERTAIN** | free | Same: ask mods first; the sublet map is the one thing they do not have. |
| r/AustinMusicians | https://www.reddit.com/r/AustinMusicians/ | ~7k **FACT** | **UNCERTAIN** | free | Ask mods; musicians subs usually allow a "bandmates wanted" board link if it is free and local. |
| Craigslist Austin | https://www.craigslist.org/search/area/austin | #1 US classifieds **FACT** | Prohibits "postings the primary purpose of which is to drive traffic to a website" https://www.craigslist.org/about/prohibited **FACT** | free | **Never** post ads for the board there, and never scrape it (3Taps). Use it only as the benchmark for section counts. |
| Buy Nothing Austin groups (~70) | https://buynothingproject.org/facebookgroups | ~70 Austin groups **FACT** | Buy Nothing rules are gift-only; promotion of outside sites is generally not allowed **UNCERTAIN** | free | Don't promote. Instead make the free-stuff map so good that members paste the share card themselves. |
| Freecycle Austin | https://www.freecycle.org/town/AustinTX | 15,990 **FACT** | email-list norms; no promo | free | Observe for category demand only. |
| Nextdoor (Austin) | https://nextdoor.com/city/austin--tx/ | "1,000+ listings" **FACT** | Business posts need a Nextdoor business page; residents' feeds frown on promo | free | Post as a resident in your own neighborhood once ("I built a free map of Austin garage sales this weekend"), not citywide. |
| Austin Animal Services lost-pet page | https://www.austintexas.gov/lost-a-pet | city referral page **FACT** | n/a | free | Link **to** the two city-recommended pet groups from your lost & found category; do not try to replace them. |
| UT off-campus housing / r/UTAustin wiki | https://axebps-redlib.hf.space/r/UTAustin/wiki/facebook | 45k off-campus students **FACT** | wiki lists Facebook groups; posting rules **UNCERTAIN** | free | Time a sublet-map launch to late April (summer sublets) and early November (spring). |
| APD safe exchange stations | https://www.kxan.com/news/local/austin/safe-exchange-zones-central-texas/ | n/a | public info | free | Ship these 12 points as a map layer on day one; it is the trust feature none of the incumbents show on a map. |
| City Home To Home (pet rehoming) | https://www.austintexas.gov/animal-services/rehoming-pet | city program **FACT** | n/a | free | Link out instead of hosting pet posts. |
| Austin Chronicle Classifieds | https://www.austinchronicle.com/ | print+web, paid ads **FACT** | paid placement | paid, price not found **UNCERTAIN** | Not worth paying; possibly a story pitch later ("free Craigslist for Austin on a map"). |
| Own channels (TikTok/YouTube Shorts) | — | owner's strength (brief) | — | free | Weekly "this Saturday's garage sales on the map" and "free stuff posted this week" Shorts are the seeding loop; this is the Facebook-groups-to-Marketplace move using an audience you already own. |

---

## 7. Recommended launch shape (ESTIMATE, derived from the cases above)

1. **One or two categories, not a Craigslist clone**: (a) free stuff + garage sales on the map (zero money, zero legal weight, visibly Austin, weekly video), and (b) a seasonal second wedge — sublets near campus in late April, or face-value ticket swaps the week ACL/F1 tickets go on sale. Reasoning: Craigslist's free section is its largest in Austin (360) while its garage-sale (13), ticket (19) and sublet (45) sections are beatable with a few dozen real posts. **ESTIMATE from the counts above.**
2. **Seed by hand with permission**: the owner posts the first 30–50 real items (own garage, friends, neighborhood association), the Nextdoor/Airbnb way — not by scraping (3Taps, Oodle). Target weekly growth, not launch-day traffic (Graham).
3. **Open to read, gated to post**: Nextdoor's Free Finds move; sign-in already exists.
4. **Trust kit on day one**: safe-exchange layer, flag button with a 2-flag auto-hide, phone verification for housing/tickets, keyword blocks for weapons/adult/animals/MLM, "no money changes hands on this site" banner.
5. **Legal kit on day one** (all cheap): Section 230-shaped terms (you host, you don't write), DMCA agent registration, no sale of data (TDPSA §541.107), Equal Housing line on housing posts, a published prohibited list copied in spirit from Craigslist's, and no personals/massage categories ever.

---

## 8. What NOT to do

1. **Do not seed with scraped Craigslist/Facebook/Nextdoor listings.** Craigslist blocked Oodle's IPs in 2005 and sued 3Taps/PadMapper to a permanent injunction and $1M in 2015. https://www.inman.com/2005/10/18/craigslist-oodle-stop-using-our-classified-ads/ , https://www.eff.org/deeplinks/2015/06/padmapper-and-3taps-settle-suit-craigslist-over-use-real-estate-facts
2. **Do not advertise the board on Craigslist.** "Postings … the primary purpose of which is to drive traffic to a website" are prohibited and get flagged. https://www.craigslist.org/about/prohibited
3. **Do not launch personals, massage, or escort categories.** Craigslist killed Personals in 2018 over FOSTA; Backpage was seized and its founder imprisoned. https://en.wikipedia.org/wiki/Craigslist , https://en.wikipedia.org/wiki/Backpage
4. **Do not allow firearms/ammo** even though Texas private sales are legal; incumbents ban them and the litigation record (Armslist) is a decade long. https://reason.com/2019/05/01/armslist-not-liable-for-allowing-searches-for-private-seller-gun-ads/
5. **Do not build tenant-attribute filters or targeting for housing posts** (the Roommates.com and HUD-v-Facebook trap). https://law.justia.com/cases/federal/appellate-courts/ca9/09-55272/09-55272-2012-02-02.html , https://www.nar.realtor/washington-report/meta-implements-new-housing-ads-platform-after-doj-fair-housing-settlement
6. **Do not host animal sales**; Facebook prohibits them, Austin bans public-space sales and has a registration-before-sale ordinance. https://www.facebook.com/policies/commerce/ , https://www.tpr.org/government-politics/2025-07-01/new-texas-laws-target-roadside-pet-sales-and-puppy-mills
7. **Do not list non-transferable tickets** (UT Big Ticket, SXSW wristbands, tampered ACL wristbands) — APD has made felony arrests over wristband resale. https://texaslonghorns.com/BigTicket , https://sxsw.com/transfer-policy/ , https://www.austinchronicle.com/music/apd-serves-up-felonies-in-acl-wristband-sting-12100924/
8. **Do not take custody of money or tickets** (Lyte). https://www.digitalmusicnews.com/2024/09/17/after-53-million-in-funding-is-lyte-shutting-down/
9. **Do not auto-post into Facebook groups or Buy Nothing groups**; let posters share a card themselves. (Group rules unfetchable — **UNCERTAIN**, but the ban risk is asymmetric.)
10. **Do not pay for Chronicle or aggregator placement**; the only paid channel with evidence of reach is none — the growth cases above are all unpaid.
