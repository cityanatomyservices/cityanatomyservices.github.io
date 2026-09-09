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

## OPEN — two follow-ups

**1. Push the full history (blocked on a token scope).** None of the `gh`
logins on this machine have the `workflow` scope, and GitHub refuses any push
that adds `.github/workflows/*` files without it. To get the site back up
immediately, `main` on GitHub currently holds a single temporary snapshot
commit with the workflows omitted. The full history is in this local folder.
Fix, from a WSL terminal:

```
gh auth switch --user cityanatomyservices
gh auth refresh -h github.com -s workflow      # opens a browser, one-time code
gh auth switch --user atxmapdata
cd /mnt/c/Dev/projects/cityanatomyservices/cityanatomyservices.github.io
git -c credential.helper= -c credential.helper='!f(){ echo username=cityanatomyservices; echo "password=$(gh auth token --user cityanatomyservices)"; }; f' push --force origin main
```

The force push is safe: the only thing it replaces is the temporary snapshot.
Delete this section once done.

**2. Re-add the Actions secrets.** GitHub secrets do not travel with a
repo copy. `SUPABASE_URL` is already set (it is not really a secret). Still
needed, from the Supabase dashboard for project `tqnklodtiithbsxxyycp`:

- `SUPABASE_DB_PASSWORD` — the raw database password
- `SUPABASE_SERVICE_KEY` — the service-role key (not the anon key)

Set them at https://github.com/cityanatomyservices/cityanatomyservices.github.io/settings/secrets/actions
or with `gh secret set NAME --repo cityanatomyservices/cityanatomyservices.github.io`.
Without them the weekly `refresh-lists` cron (Mondays 09:00 UTC) and the
manual `build-parcels-pmtiles` / `load-zoning` workflows fail. The two
Remotion render workflows need no secrets.
