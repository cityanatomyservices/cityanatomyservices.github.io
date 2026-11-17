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

In **01 / DISCOVER**, the checkbox beside the listing count adds every filtered
match to **02 / CURATE**, including rows behind Show more. Clearing a checked
box removes the current matches. A dash indicates partial selection. Bulk
selection keeps existing picks and their order. If the full selection exceeds
250 picks, the desk reports the available space and asks for narrower filters.

**Export map** downloads an interactive MapLibre HTML file with the list title,
pick titles, and coordinates. Open the file in a browser with internet access
for MapLibre and the OpenFreeMap basemap. Click a title to locate a pick. Picks
at the same coordinates share a marker that opens all their titles. New event
and neighborhood picks keep their source coordinates. For older lists, the desk
checks the original feed by item ID. For any missing points, enter latitude,
longitude in decimal degrees to complete the map. The coordinates save with the
private list and can be used for subsequent exports.

Preview & export shows the selected items in order. **Copy formatted** provides
HTML and plain text together; the destination decides which it can paste.
**Copy plain text** is suitable for social captions. HTML and UTF-8 text downloads
also work without clipboard permission. A selectable text fallback appears when
clipboard access is unavailable. Export markup escapes all source/user text,
accepts only HTTP(S) links and includes no executable scripts. Exports include
titles, published times, venues/addresses, price/conditions, your notes and source
links. Descriptions remain research details instead of being silently copied
into the post. Unknown prices/end times are never invented.

**Copy for Substack** creates a separate newsletter body using H2 headings,
explicit bold labels, paragraphs, line breaks, source links and horizontal rules.
It has no card wrappers or CSS. Put the list title in Substack's separate Title
field, then paste normally into the post body (Ctrl+V / Command+V). The publication
controls its fonts and colors; the styled preview is not a promise of identical
appearance in Substack. Substack does not support custom CSS/HTML in the editor:
https://support.substack.com/hc/en-us/articles/360037463152-Can-I-edit-the-CSS-or-HTML-on-Substack
Clipboard and native rich-paste structure are tested; automated tests do not
write to the owner's Substack drafts or publish anything there.

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

Version the page CSS, scripts, and downloadable map template together and follow
the root deployment/cache rules.
