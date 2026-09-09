# STATUS — cityanatomyservices.github.io (anatomy.city)

## 2026-09-09 — site moved here from loraatx/loraatx.github.io

The City Anatomy site (anatomy.city) now lives in this repo under the
cityanatomyservices GitHub account, with the full git history copied over
(641 commits). Nothing in the site itself changed.

What was done, in order:

1. The old `cityanatomyservices.github.io` repo (austin.chat) was renamed to
   `austin-chat-archive`, its Pages disabled, and the repo archived on GitHub.
   Local folder: `C:\Dev\projects\cityanatomyservices\austin-chat-archive`.
   austin.chat no longer resolves to a site (owner: not needed).
2. `loraatx/loraatx.github.io` was renamed to `loraatx-site-archive`, its
   Pages disabled, and the CNAME file removed so the domain could be claimed
   here. Local folder: `C:\Dev\projects\loraatx\loraatx-site-archive`.
   GitHub redirects the old repo URL to the new name.
3. This repo was created, the site pushed, GitHub Pages enabled from `main`
   at `/`, custom domain `anatomy.city`.

DNS did not change: anatomy.city is proxied by Cloudflare, which forwards to
GitHub Pages. GitHub picks the repo by the `CNAME` file, so keep that file.

## Supabase — the site uses only the paid cityanatomyservices project (2026-09-09)

Owner's rule: the paid Supabase account (org `cityanatomyservices`) is the only
one that matters. It holds project **`aqbyxpiwugcvoephsvpm` ("parcels")** —
the parcel database shared with WhatCanIBuildHere (`austingraph/austingraph.github.io`)
and the CityAnatomyAustin container app — plus the "Pubber" project.

Before the move the site pointed at `tqnklodtiithbsxxyycp`, a project on the
FREE account (the austin.chat one). It held a small copy of the parcel data,
two custom RPCs and its own PMTiles file. That dependency is gone:

- `/parcels/` now reads the paid project: `parcels_public` view (anon-readable),
  PMTiles `tiles/parcels.pmtiles` (source layer `parcels`), and two RPCs.
- The two RPCs and the `austin_zoning_rules` lookup table were ADDED to the
  paid project from `scripts/sql/` (`get_parcel_constraints.sql`,
  `search_parcels.sql`, `austin_zoning_rules.sql`). They are the only objects
  this repo owns there. Re-apply by pasting a file into the SQL editor.
  Schema mapping: old `parcels.zoning` = new `zoning_base`; old
  `zoning_overlay` = `zoning_ztype` when it differs from the base district.
- The parcel tables themselves belong to the austingraph repo. **Never run
  this repo's loader SQL (`scripts/*.sql`, `scripts/sql/load_*`,
  `spatial_join_zoning.sql`, `zoning_stage_to_final.sql`) against the paid
  project** — they alter and update `parcels`. They were the free project's
  pipeline and are kept only as history. The three workflows that ran them
  (`build-parcels-pmtiles`, `load-zoning`, weekly `refresh-lists`) were
  deleted for the same reason. **No Actions secrets are needed** — the two
  remaining Remotion render workflows use none.
- `apps/chats/*` (the three austin.chat maps) and their ChatMaps cards on
  `/apps/` were REMOVED 2026-09-09 (owner: "the function is over"). The site
  now has no dependency on the free account at all. Note for the owner: the
  `/apps/` hero lede still says "live chat experiences" — owner copy, not
  touched.

The free project (`tqnklodtiithbsxxyycp`) can be deleted whenever the owner
likes: its austin.chat tables are all EMPTY (checked 2026-09-09), and its
parcel copy is superseded. The austin.chat data the owner is keeping — the
1,202 curated geofences — lives in git in the archived repo
`cityanatomyservices/austin-chat-archive` (`data/`) and in the GIS library
(`C:\GISData\austin\places.gpkg`, GeoJSON in `C:\GISData\derived\`).
The austin.chat domain stays registered but points at nothing.

## OPEN — one follow-up

**Push the full history (blocked on a token scope).** None of the `gh`
logins on this machine have the `workflow` scope, and GitHub refuses any push
that adds `.github/workflows/*` files without it. To keep the site up,
`main` on GitHub currently holds a single temporary snapshot commit with the
workflows omitted. The full history (641 commits + the changes above) is in
this local folder. Fix, from a WSL terminal:

```
gh auth switch --user cityanatomyservices
gh auth refresh -h github.com -s workflow      # opens a browser, one-time code
gh auth switch --user atxmapdata
cd /mnt/c/Dev/projects/cityanatomyservices/cityanatomyservices.github.io
git -c credential.helper= -c credential.helper='!f(){ echo username=cityanatomyservices; echo "password=$(gh auth token --user cityanatomyservices)"; }; f' push --force origin main
```

The force push is safe: the only thing it replaces is the temporary snapshot.
Delete this section once done.
