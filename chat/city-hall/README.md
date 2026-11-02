# City Hall — main map only

The **City Hall** button follows Chat on the home map. Its four cards open
official city lists using Explore's surfaces, with search, council-district and
meeting-board filters. Selecting a card shows that category; selecting it again
closes its list. Opening City Hall closes the other main-map panels and vice
versa. Escape/Close returns focus to the button. Choices live only in page
memory. Public Meetings includes the same **Day Planner** checkbox as Explore.
Checking it adds a saved snapshot to that meeting's plan day, creating the day
if needed or joining its existing stops. Unchecking removes only that meeting.
Guest plans stay in visit memory; registered plans save privately through the
existing planner. No City Hall pins or GPS requests are added.
The other maps keep their controls until the owner requests an extension.

Meeting snapshots use `PlanSources.meeting` and `PlanSelection.mount`. Their
stable key is the official occurrence URL, so changing an import ID or source
time does not duplicate a selection on the same day. Published starts are fixed;
finish times are unknown, and the initial 60-minute visit is an unconfirmed
estimate the user can edit. Date-only meetings select their announced date
instead of treating midnight as a start on the previous plan day. They remain
unscheduled until the user checks the agenda and enters a time; Build my day
does not invent one. Once entered, that meeting time is an appointment. The
planner's existing 5 AM–5 AM Austin-time days and conflict review are preserved.
Locations are retained as text; no coordinates are inferred. Saved meetings
survive feed expiry and still link to the source for cancellations and changes.

## Lists and sources

- **Public Meetings:** upcoming starts from now through the end of the seventh
  Austin calendar day, today included, sorted by date/time. Combines the City's
  [boards and commissions calendar](https://www.austintexas.gov/boards-commissions/events),
  [Council public calendar](https://www.austintexas.gov/council/events), and
  [Council and committee meeting index](https://www.austintexas.gov/council/meetings).
  The annual index URL is calculated for the current year (and next year when
  the collection window crosses January). These are official city website
  sources; no current unified meeting calendar was found in the Open Data
  catalog. Calendar pagination is followed. Cancelled entries are excluded.
  Council's explicitly labelled convening time is read from its agenda page;
  other date-only entries say **Time: see agenda**, remain through that date,
  and sort after known times that day. No times are guessed from update dates,
  proclamations, or regular schedules. Source pages link to agendas and
  participation information.
- **Public Announcements:** [City news](https://www.austintexas.gov/news)
  published in the last 30 Austin calendar days plus upcoming
  [zoning notices](https://data.austintexas.gov/d/k2wj-4v6p). Links and titles
  are indexed, not the full news articles. An upcoming zoning notice can remain
  longer than 30 days, until its hearing date passes.
- **Permits report:** all [issued construction permits](https://data.austintexas.gov/d/3syk-w9eu)
  in the last seven Austin calendar days, including today, newest first.
  Includes the published type, permit number, work description, address,
  district and current status. The period describes issuance, not the present
  construction status. No applicant, owner or contractor contact fields are
  requested or republished.
- **Development:** [site-plan cases](https://data.austintexas.gov/d/mavg-96ck)
  filed in the last 30 Austin calendar days, newest first. The window uses the
  application date, not the nightly warehouse update timestamp. Shows case
  name/number, type, status, proposed work, address and district; this is recent
  application activity, not an exhaustive inventory of active development.

All dates use America/Chicago, including daylight saving transitions.
Open Data queries paginate in a stable order and fail if their limit is reached.
Published permit/site-plan districts are retained. Council and citywide board
meetings apply to all districts; their venue address is not their jurisdiction.
Selecting a numbered district includes citywide records. Unknown districts
remain in **All districts**, and are explicitly labelled. Zoning notices cover
the citywide Council docket; individual case districts are in the linked PDF.

## Refresh and failures

`tools/city-hall/build.py` uses Python's standard library and public city
endpoints, with no secrets or paid APIs. It writes `chat/data/city-hall.json`.
Each source reports its last successful check independently. Requests retry
three times. An unavailable source retains only its own unexpired last-good
records; the previous check time and expiry are never advanced. A successful
empty response clears that source. Unrecognized HTML is a failed import, not
an empty calendar. Meeting snapshots expire after 12 hours; the other snapshots
expire after 72 hours. The browser also removes past dates and cancelled rows.

The **Refresh City Hall** GitHub workflow runs every three hours at minute 17
UTC and can be run manually. It tests the importer/model, refreshes all sources,
publishes the healthy results with the shared retry/rebase publication helper,
then fails visibly if any import failed. This does not modify Explore's job.
City datasets may publish less frequently than the workflow; **Checked** is
our fetch time, not a claim that the City changed a record at that moment.

The browser downloads the snapshot on first opening, with retry UI if it fails,
and rechecks a panel left open every 15 minutes. Records are re-filtered every
minute. Feed/source links are restricted to official Austin government hosts,
and upstream text is inserted as text rather than HTML.

## Verification

```sh
python3 -m unittest discover -s tools/city-hall -p 'test_*.py'
node tools/city-hall/test-model.cjs
python3 tools/city-hall/build.py
node tools/city-hall/check-browser.cjs
node tools/city-hall/check-planner.cjs
node tools/explore/check-map-layers.cjs
```

The browser check uses real city snapshots and blocks Supabase requests. It
checks desktop/phone layouts, placement, lazy fetching, retries, all four
categories, filters, pagination, links, panel exclusivity, focus, expiration,
refresh and the absence of City Hall on a catalog map. Pass the deployed site
URL as its first argument to repeat against production. Screenshots go to
`/tmp/city-hall-*.png`.

The planner browser check uses a controlled meeting feed and blocks account
requests. At both widths it checks adding meetings to a new/existing date,
retaining today's edits, dropdown navigation, unknown-time handling, editing
visit lengths to resolve conflicts, unchecking, returning to the list and guest
refresh. Both browser commands accept the live site URL after deployment.
