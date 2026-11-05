# Private owner dashboard

Open **https://austin.chat/dashboard** directly. There is intentionally no link
in the site menus, catalog or footer, and the page requests no search indexing.
The HTML is public on GitHub Pages; all private reports and membership actions
require a confirmed account in `dashboard_private.admins`. A hidden URL is not
the access control. The authorized owner email is stored only in the database.

Choose a report, optionally add search/date filters, then **Run report**.
Neighborhood chat also accepts an exact room ID. **Export to Excel** retrieves
all matching pages, not just the 200 rows visible in the preview. Workbooks
contain a Report sheet and an Export details sheet with filters, row count and
timestamps. Exports over 50,000 rows stop with a request to narrow filters;
no partial file is silently downloaded. Data can change during a long export;
stable-key pagination avoids offset shifts when rows are inserted/deleted.

The 18 private report choices cover members, current site-paid subscribers,
Substack access/history, saved chat, comments, classifieds, favorites,
preferences, plans/items, reminders/delivery, tour progress, parcel attributes,
zoning rules, market context and source freshness. Another 120 choices query
the site's published datasets, including neighborhood businesses, Explore,
City Hall, Shopping Apps, schools and datacenters. Dates are labeled in UTC;
the manual Substack paid-through input uses the owner's local time.

Chat includes only saved registered-user messages within the existing retention
window (normally 30 days). Guest broadcasts and already-purged messages cannot
be recovered. Reports do not expose authentication secrets, payment credentials,
checkout sessions, unsubscribe tokens or reminder message payloads. Geometry
is omitted from tabular exports; point data retains latitude and longitude.

**Substack membership access** grants/renews or revokes verified included site
access. It never starts or cancels billing or sends email. For site→Substack,
use the Site-paid members report, then grant the comp in Substack manually.
Follow [the bundle and renewal workflow](../billing/SUBSTACK.md).

## Maintenance

- `supabase/migrations/0015_dashboard.sql` owns the private allowlist, fixed
  report definitions and owner-checked RPCs. No arbitrary SQL input is accepted.
- Run `python3 tools/dashboard/configure.py --deploy --authorize` to preflight
  the migration and authorize a confirmed owner email entered at the prompt.
  Changes to the verified owner's email require authorization again.
- `node tools/dashboard/build-catalog.cjs` refreshes the public dataset catalog.
  Pro shopping datasets are read from their existing public GitHub source;
  private member records are never copied into that catalog.
- Browser results stay in memory and are cleared on sign-out/account switch.
  No subscriber export is uploaded to GitHub, Pages or an external file service.
- SheetJS CE 0.20.3 is vendored from its official CDN for browser-only XLSX
  generation; its license is in `vendor/`. Strings are explicit spreadsheet
  text cells, so formulas in chat messages or email addresses cannot execute.
- `node tools/dashboard/check-browser.cjs` verifies desktop/phone layout,
  denied access, pagination, an actual 521-row Excel download, text safety,
  manual activation and signing out during a request with isolated fixtures.
- `python3 tools/dashboard/check-hosted.py` verifies live API access boundaries,
  Substack activation and private app access using disposable confirmed users.
  It sends no email and creates no Stripe object; fixtures are removed.

Keep reports, tokens and real owner/member details out of this public repository.
