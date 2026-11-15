# Private content desk

Open **https://austin.chat/dashboard/content/** or use **Content desk** inside
the owner dashboard. The existing verified dashboard-owner account is required.
The page shell is public on GitHub Pages and asks search engines not to index it;
private lists are served only by owner-checked database functions. No link is
added to the public navigation. No posting or automatic export schedule exists.

Tomorrow is the default, in America/Chicago. The six event categories use the
actual `ExploreModel.filter` and registry, including movie showtimes, expiry,
duplicate handling, price and search rules. Both deployed and raw-main snapshots
are checked, choosing the newest valid event feed just like Browse. City Hall
and Classifieds reuse their existing models and sources. Special Events and Pro
Tier Apps use the same catalogs. Neighborhood Businesses supports a neighborhood
and business-category selector. Directory entries are not presented as dated
events; this distinction appears beside the filters. Refresh retries failed
sources; returning to the page refreshes research. Lists never refresh themselves.

Create as many named lists as needed, switch between them, duplicate, reorder,
remove picks, and add introductions and individual notes. Each selection freezes
the source facts and applicable movie showtimes so research refreshes cannot
silently rewrite a draft. Expired saved event records show a recheck note. The
private `dashboard_private.content_lists` table stores each list independently,
with revisions guarding against overwrites by another tab. Autosave runs after
edits and before switching lists. Failures retain the in-memory draft and expose
Retry save / Save as new list. Unfinished saves trigger a browser leave warning.
There is no arbitrary list-count limit; each short list supports up to 250 picks
and 1 MB. Drafts are not copied to localStorage, GitHub, Google Drive or social
accounts. Sign-out/account change clears research, draft and export DOM/memory.

Preview & export shows the selected items in order. **Copy formatted** provides
HTML and plain text together; the destination decides which it can paste.
**Copy plain text** is suitable for social captions. HTML and UTF-8 text downloads
also work without clipboard permission. A selectable text fallback appears when
clipboard access is unavailable. Export markup escapes all source/user text,
accepts only HTTP(S) links and includes no executable scripts. Exports include
titles, published times, venues/addresses, price/conditions, your notes and source
links. Descriptions remain research details instead of being silently copied
into the post. Unknown prices/end times are never invented.

Maintenance:

- `supabase/migrations/0025_content_desk.sql`: private table and owner RPCs.
- `uv run --no-project python tools/dashboard/configure-content.py`: rolled-back
  SQL preflight, migration when needed, permission/revision tests, schema reload.
- `node --test tests/dashboard/content.test.cjs`: shared filtering, Austin DST,
  duplicate events, movie times and safe exports.
- `node tools/dashboard/check-content.cjs [https://austin.chat]`: desktop/phone
  browser flow with isolated session, feed and storage fixtures; real clipboard
  and downloaded file validation. No real user data is touched.
- `uv run --no-project python tools/dashboard/check-content-hosted.py`: actual
  hosted API access boundaries and CRUD with disposable confirmed test accounts;
  all fixtures removed, no messages or billing actions.

Version the three page assets together and obey the root deployment/cache rules.
