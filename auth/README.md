# Austin.chat sign-in

The existing Supabase project (`aqbyxpiwugcvoephsvpm`) supports Google OAuth
and email codes. GitHub Pages continues hosting the entire public site.
Google's client secret and Resend's API key stay in Supabase. The browser uses
only the project's existing publishable key.

## Owner setup: Google

1. In [Google Auth Platform](https://console.cloud.google.com/auth/overview),
   create or select the project for Austin.chat. Set the app name and support
   email, and choose an External audience for public visitors.
2. Create a **Web application** OAuth client. Use:
   - Authorized JavaScript origin: `https://austin.chat`
   - Authorized redirect URI: `https://aqbyxpiwugcvoephsvpm.supabase.co/auth/v1/callback`
   - Basic scopes: `openid`, email, profile. No Gmail, Contacts or Drive access.
3. In [Supabase providers](https://supabase.com/dashboard/project/aqbyxpiwugcvoephsvpm/auth/providers),
   enable Google and paste the client ID and secret. Keep nonce validation on.
4. If Google's app audience is Testing, add your own Google account as a test
   user. Move to Production when ready to allow the public to sign in.

The site checks Supabase's public provider settings when the dialog opens;
Google's button becomes available after the provider is configured.

## Owner setup: email through Resend

1. Create a [Resend](https://resend.com/) account on the free plan. Add
   `login.austin.chat` as a sending domain. Add the exact DNS records Resend
   supplies, then wait until the domain is verified. Keep the website's existing
   GitHub Pages DNS records.
2. Create a sending API key restricted to that domain.
3. In the project's Authentication → Email → SMTP Settings, set:
   - Sender address: `no-reply@login.austin.chat`
   - Sender name: `Austin.chat`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the Resend API key
4. Keep email confirmation enabled. The confirmation and magic-link templates
   include `{{ .Token }}` so new and returning users can enter a code without
   leaving their current plan.
5. Run `python3 tools/auth/configure.py --refresh-public-config`, then commit
   and deploy `auth/config.json`. This enables the email form only after a
   sender and code templates are configured. Test actual delivery to your own
   address; configured credentials alone do not prove inbox delivery.

Do not commit provider credentials or send them in chat. The local setup helper
uses the existing management token in `~/.supabase/access-token`; it prints
only readiness flags. `--apply-templates` prepares templates and adds the exact
site callback URL while retaining existing redirect entries and template links.

Saved SMTP passwords are write-only in hosted Supabase. A value returned by
the management API can be a protected fingerprint rather than the actual
Resend key. Do not use it for a direct SMTP login test or write it back into
the configuration. Verify sending through Supabase Auth with the owner's
approved test address, then confirm receipt in that inbox.

## Behavior and module boundaries

- `shared/session.js` owns one SDK client per page visit, shared by same-origin
  child frames. It stores only registered sessions in localStorage. Anonymous
  sessions and PKCE verifiers remain in page memory, isolated between visits.
- `shared/account.js` and `account.css` own the dialog, Google popup, email-code
  form, private account display and sign-out. Opening the dialog does not send
  email or expose an email address in chat. Email sign-in creates an account
  when necessary and uses Supabase verification before saving a session.
- `auth/callback/` relays a one-time code to the originating page using an
  unpredictable attempt ID, same-origin messaging and a BroadcastChannel
  fallback for providers that detach `window.opener`. Only the original page
  holds the PKCE verifier. Callback URLs are cleared from browser history;
  no access tokens, guest plans or credentials go into callback URLs/storage.
  If the original page was closed/refreshed, the user starts sign-in again.
- A sign-in keeps the guest plan in memory until `planner/store.js` merges it
  with the account's saved collection. Duplicate place/day selections preserve
  the saved account entry. Registered saves continue using RLS and revisions.
- Chat reloads its nickname/profile and resets visibility on an account change.
  Google profile names and email addresses are never used as public nicknames.
- Sign-out attempts to save outstanding itinerary edits first. If saving fails,
  the dialog offers an explicit discard action. Other registered tabs follow
  sign-out; an anonymous account in one tab does not sign another tab in.
- Guest plans and Explore layers/filters reset on refresh/reopen. Sign-out also
  clears Explore pins immediately. Other display preferences remain.

## Profiles, Favorites and account preferences (2026-10-30)

`0008_member_profiles.sql` is applied to the existing project. No hosting,
subscription, parcel or routing changes were required. `shared/member.js`
owns the account data in page memory and is shared by the outer frame and
its apps. `member-ui.js` mounts Profile & privacy, Favorites and Preferences
inside the existing Account dialog. `favorite-button.js` subscribes to the
same listing targets as the planner without selecting a day or joining chat.
The app catalog also supplies Favorite actions.

- A person may keep the generated nickname and emoji, choose another unique
  nickname, or upload a picture. Real Google names/photos are not copied into
  their public identity. The profile editor previews what others see; map
  visibility remains an independent explicit Chat control.
- The existing `profiles` table still has owner-only SELECT, including its
  email column. `profile_display(handle)` returns only handle, emoji and an
  opted-in avatar path. It does not expose the private profile row.
- `avatars` is a private Storage bucket. Browser canvas crops/resizes to a
  256×256 WebP, omitting original EXIF/GPS data. Bucket policies enforce one
  fixed path per registered account, WebP MIME and 128 KiB per file. A person
  can replace/delete only their own file; other authenticated visitors can
  fetch only explicitly displayed pictures. The app uses short-lived signed
  downloads and local blob URLs, not permanent public image URLs. File
  replacement and deletion go through the Storage API. Previously displayed
  images can be copied; CDN invalidation is not instantaneous. Privacy tests
  verify fresh requests and the actual file listing, not stale cached URLs.
- `member_favorites` stores private source snapshots, limited in Postgres to
  200 per account, with an owner index and serialized count check. Expired
  listings remain labeled for review. Add to Day Planner uses the existing
  source/date behavior; a Favorite alone does not alter the itinerary.
- `member_preferences` privately stores theme, Explore categories/filters,
  ticker selections and navigation app. Per-key updates avoid overwriting
  unrelated choices from another tab. `shared/preferences.js` mirrors only
  display choices into existing browser settings; searches, coordinates,
  profiles, Favorites and tour progress are not copied there.
- `webtour/store.js` now uses existing `tour_progress` rows for registered
  users and visit memory for guests. Moontower lighting and physical visits
  remain separate. Legacy unscoped progress is removed rather than assigned
  to whichever account next signs in. Progress errors show a banner.
- Account changes clear the in-memory member data before new data loads.
  Mutations retain their initiating account ID; stale loads cannot overwrite
  another account. Cross-tab notifications carry no profile or Favorite data.

The owner wants to retain the current setup through roughly 1,000 registered
users. The organization was already on **Pro**, with approximately **3.16 GB**
database usage and **86 MB** Storage files at the initial check. Pro currently
includes 100,000 monthly active users, 8 GB database disk and 100 GB file
storage. At this upload cap 1,000 avatars occupy at most 125 MiB. This is an
account/storage capacity assessment, not a 1,000-concurrent-user load test:
chat connections, traffic and routing computation still matter. Pro includes
500 peak Realtime connections before overages; no billing setting was changed.
See [current Supabase allowances](https://supabase.com/pricing).
Email sign-in has separate throughput limits: the existing Supabase sender is
set to 30 emails/hour, and the requested Resend free tier allows 100/day and
3,000/month. Google sign-in does not consume those email sends. These settings
were inspected, not changed; a burst of new email sign-ins can reach these
limits before the account/storage allowances. See [Resend limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

Run `node tools/auth/check-members.cjs http://127.0.0.1:8765` for real Storage,
RLS, image processing, visibility, Favorites, preference restore, tour progress,
two-account isolation, guest reset and responsive dialog checks. It creates
only disposable accounts, sends no email, and removes test avatars through
Storage before removing accounts. `tests/planner/member.test.cjs` covers late
loads, sign-out during saves and concurrent reloads. Both browser checks can
also target the live site **after** the matching Pages deployment completes.

## Sign-in validation

Run `node --test tests/planner/*.test.cjs`. Browser checks cover the current
guest plan becoming an account plan, refresh, sign-out, two-account isolation,
email-code errors, popup cancellation and callback validation. A real Google
consent round trip and actual email delivery require the owner's provider setup.

For the integration check, serve the repository locally, then run
`node tools/auth/check-browser.cjs http://127.0.0.1:8765`. It uses the local
Supabase management token to create and remove disposable test accounts. Email
delivery and Google consent are simulated; email-code verification and private
database saves use the real project. It sends no email. Install the existing
`tools/video` Playwright dependency and set `CHROMIUM_PATH` if needed.

References: [Google and Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
[Supabase email codes](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[Resend SMTP](https://resend.com/docs/send-with-supabase-smtp).

## Public place comments

Migration `0009_place_comments.sql` stores comments separately from private
profiles and itinerary notes. `place_comments_list` returns only public
nickname/emoji/text/timestamps and a caller-specific `mine` flag. Do not open
profile-table SELECT policies to support comments. Guests may read, while
registered owners may insert body/source, update only body, or delete their
own comments. Database limits: 2,000 characters, 20 existing posts from the
last hour, 1,000 comments/account. These are modest storage/abuse controls,
not a substitute for moderation. Owners can moderate through the Supabase
table editor. There are no public moderation keys or service credentials.

`tools/auth/check-comments.cjs [base]` tests real RLS/CRUD with disposable
accounts and synthetic source keys; it removes the accounts/comments and
sends no email. Browser drafts are memory-only and clear on account changes.
