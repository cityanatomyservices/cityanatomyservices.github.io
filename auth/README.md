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
- Guest plans still reset on refresh/reopen. Display preferences remain.

## Validation

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
