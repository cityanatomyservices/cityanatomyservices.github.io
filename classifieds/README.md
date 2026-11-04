# Free classifieds

The home map's Classifieds card is inside Explore. A category dropdown includes
live ad counts; newest/oldest sorting and the shared Explore time frames and exact
date filter use the original posting date. Editing an ad does not advance its date.
The default This week shows the past seven Austin calendar days; All dates shows
all available ads. Filtering/sorting does not discard the owner's unsaved draft.
`/classifieds/` is the standalone directory; each category has its own page, such
as `/classifieds/for-sale/`. Anonymous visitors see only a create-account/sign-in
message in the box and on category pages. Categories and ads require a registered,
confirmed account at the database boundary as well as in the UI.

Standalone pages grow with their ads and owner editor. The news strip and
social footer follow all content, staying at the viewport bottom on short
pages and below the last ad on long pages, including after pagination.

Owner's final direction (2026-11-02): a self-managed notice board, called
classifieds. **No email field, automatic email disclosure or content policing.**
The author chooses a category, then writes a title and one paragraph. They can
include contact information if they want. There are no image inputs, uploads,
phone/location fields, automated contact filters, email relays or approval queues.
The only text rules are nonempty content and 100/1,000-character title/body limits.
Whitespace is normalized to one paragraph; HTML is displayed literally, never
interpreted as markup or images. The sign-in email is never copied into an ad.

Every account has at most one active ad across all categories. On the directory
and the ad's category page, its owner sees the editable form automatically. Other
people's ads are read-only text cards. On another category page, a link points to
the owner's existing ad without mixing it into that category's ads. Owners can
change category, save, delete, and post again after deletion. Ads persist until
owner deletion/account deletion; there is no expiry or recurring job.

Starting categories: For Sale, Free Stuff, Services, Housing, Jobs, Gigs,
Community, Lost & Found. Broad categories were informed by the
[Austin Craigslist directory](https://austin.craigslist.org/); no listings were copied.

## Storage and access

`0011_classifieds.sql` creates only the `classifieds_private` schema and three
public RPCs. The private tables have RLS, no browser-role schema/table grants,
and no public read projection. Functions require both a non-anonymous JWT and a
confirmed, non-anonymous Auth record. The database derives the acting identity;
clients cannot choose another owner. An additional owner argument rejects an
account switch during an in-flight SDK write. A unique owner constraint plus
transaction locking enforces the one-ad limit. Ad ID/revision guards reject stale
updates/deletes, including an old form after deleting and recreating the ad.

`classifieds_read` returns category counts, the viewer's own ad, and up to 20
ads for one category. It exposes no account email, profile identity or author UUID.
Ad IDs are independent UUIDs. It sorts by created timestamp/ID, not edit time.
`classifieds_save` and `classifieds_delete` operate only on the caller's ad.
Foreign-key cascade removes ads when their Auth account is deleted.

Browser ad data/drafts are memory-only; only existing registered auth uses the
site's normal persistence. Sign-out/account changes abort requests, clear rendered
ads/forms and discard late responses. No new realtime channel or paid service.
PostgreSQL functions use restricted execution grants and an empty search path,
following [Supabase function guidance](https://supabase.com/docs/guides/database/functions).

## Files and checks

- `model.js`: category names and form size rules.
- `client.js`: RPC transport, account guards and request cancellation.
- `ui.js`: directory, plain-text ads, inline owner editor and new-ad dialog.
- `panel.js`: home-map button/panel behavior. `page.js`: standalone page mount.
- `tools/classifieds/make-pages.py`: regenerate the directory and eight category
  shells; these files never contain actual ads or account details.
- `node --test tests/classifieds/*.test.cjs`: form semantics and identity races.
- `tests/classifieds/database.sql`: role-based integration checks. All fake Auth
  records and ads roll back. CI uses a disposable PostgreSQL service and the
  minimal Auth contract in `bootstrap.sql`; never run that bootstrap in Supabase.
- `node tools/classifieds/check-browser.cjs [site URL]`: guest/member flows and
  footer placement with no ads, one ad, an owner editor and paginated ads at
  desktop/phone sizes with mocked Auth/ads; no actual emails or production writes.

For initial deployment only, `python3 tools/classifieds/deploy.py` stages the
migration and database checks in one rolled-back transaction. `--install` then
applies the migration after checks pass. It reads the existing management token
from the local credential file without printing it. It refuses to replay an
already installed schema. Changes afterward should use a new migration.

Map browsing uses the existing member-only `classifieds_read` RPC and follows
all pages of the chosen category before filtering/sorting, then displays 20 matches
at a time. This includes matching older ads beyond the first server page without
a database change. Category switches and account changes discard in-flight results.
The API's existing 10,020-row browsing cap is surfaced if a category exceeds it.
Standalone category pages keep their existing server pagination and URLs.
