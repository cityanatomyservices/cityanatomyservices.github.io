# Private Explore exports for Substack

Run **Actions → Export Explore for Substack → Run workflow**, keep `main`,
and choose `tonight` or `weekend`. This workflow is **manual only**. Running it
requires GitHub repository write access; there is no export control on the site.
Outputs go to the owner's private Google Drive folder, under
`ChatGPT / Austin.chat Explore Exports / YYYY-MM / <dated run>`.

Each run creates a new native Google spreadsheet, an interactive `Map.html`,
a publication image `Map.png`, and `Listings.geojson`. Nothing is shared,
uploaded to GitHub artifacts, committed to Pages, or posted to Substack.
Open the spreadsheet's **Start here** tab for links and instructions.
Download the HTML map to use it; Drive previews do not execute HTML applications.
The map needs internet access for the free basemap and MapLibre library.

The **Listings** tab has research, additional-source, draft and editorial-status
columns in E–H. New runs never modify an earlier spreadsheet. Every map place has
a number matching the spreadsheet's **Map pin** column. Several events at one
place share a pin. Crowded labels use leader lines; clicking a pin opens its
listings, ticket links and Google directions. Map category buttons can be toggled.

## Exact selection and preservation

`export.cjs` reads `chat/explore/config.js` and calls the actual
`chat/explore/model.js` filters. It includes all six configured categories,
all locations and movie theaters, all Free & cheap types up to $20, and no
search, proximity restriction or 30-result UI pagination limit.

- Tonight is 6 PM–3 AM in America/Chicago; before 3 AM it means the previous evening.
- Weekend is Saturday through Monday midnight, including the DST boundary.
  A Friday Weekend export does **not** include Friday night; use Tonight as well.
- Expired/ended records and past movie starts are excluded, just like Explore.
- Duplicate occurrences use the same last-category-wins rule as the map. All
  memberships/prices and each original source variant remain in the workbook.
- **Movie showtimes** contains every matching time, format and ticket URL.
- **Collected data** preserves every property plus complete original feature
  JSON, including new fields and original movie showtimes outside the selection.
- **Sources** includes source statuses and complete snapshot/source metadata.
  Missing category files stop export. Old snapshots and partial source failures
  appear as explicit notes. The export does not scrape new data or invent hours.
- All displayed calendar values are Austin-time text. Google Drive conversion
  may retain the account's spreadsheet timezone; source times do not depend on it.
- Unknown real end times stay blank in the readable columns. Raw end/expiry
  timestamps can be technical filtering boundaries, not actual finish times.

The exporter uses the latest published data commit when its job starts. The
existing Explore refresh remains independent. An export is a frozen editorial
snapshot; it does not change when an event expires or an earlier sheet is edited.

## Connection and maintenance

`EXPLORE_EXPORT_DRIVE_CONFIG` is an encrypted GitHub Actions secret containing
a single rclone remote named `export`, with `scope = drive.file` and a dedicated
`root_folder_id`. Never put the config, OAuth tokens, private file links or
exported research into this public repository. The runner writes the config
with mode 0600, uses it only for upload, and removes it afterward.

Drive publishing verifies that the destination and created files have only
owner permissions. It refuses to replace an existing run folder. A failed
upload can leave a partial new folder; another workflow attempt creates a new
folder and never overwrites an existing research sheet. Private URLs are saved
only in the private export, not the public Actions summary.

The pre-existing local Drive connection uses rclone's shared Google OAuth
client. Rclone warns that this shared client is being retired during 2026 and
Google sometimes rate-limits it. Bounded retries handle temporary request quotas;
a dedicated Google OAuth client should replace this connection before retirement.
Use rclone's [official setup instructions](https://rclone.org/drive/#making-your-own-client-id),
retain `drive.file` scope, authorize the destination with that client, and replace
the GitHub secret. Do not change the site's Supabase/Google sign-in credentials.

Google Sheets are created through Drive's native XLSX conversion; the uploader
does not require the Sheets API to be enabled on the OAuth client's project.
Organizer text is written as literal strings, preventing spreadsheet formulas
or HTML scripts from being executed. Map data is embedded safely and DOM text
is rendered with `textContent`.

## Local checks

```sh
node --test tools/explore-export/test-export.cjs
python3 -m unittest discover -s tools/explore-export -p 'test_*.py'
node tools/explore/test-model.cjs
node tools/explore-export/export.cjs --when tonight --out /tmp/explore-export
node tools/explore-export/render.cjs /tmp/explore-export
python3 tools/explore-export/publish.py /tmp/explore-export --config /private/export.conf
```

Install the pinned Python requirements and run `npm ci` in this directory;
`npx playwright install --with-deps chromium` installs the renderer browser.
`CHROMIUM_PATH` can select an existing local Chromium. Output paths inside
the public repository are rejected. The map uses
[OpenFreeMap](https://openfreemap.org/), with OpenMapTiles/OpenStreetMap attribution.
