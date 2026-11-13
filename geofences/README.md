# Custom chat geofences

The owner approved **$10 USD per month per geofence**, a **10–100 meter diameter**,
and permanent links such as `https://austin.chat/geofences/?id=<UUID>`.
This is a separate subscription from Free/Pro. The account card opens
`/geofences/manage/`. Address and coordinate fields are mutually exclusive.
The GPS button requests a fresh current position (high accuracy, no cached fix)
and fills the coordinate center. It does not start location tracking or create
the circle. Permission denial, timeout and stale fixes leave manual entry
available. Users still preview and confirm the circle.
With regular billing, confirmation continues to Stripe Checkout.
The canonical center is stored as coordinates. Location/size lock when billing
begins; checkout retries reuse the same draft, customer and session.

**Free testing is temporarily enabled.** Confirmed signed-in owners can create
or activate circles without a card or charge. The button says "Free while
testing". These grants are separate from paid records; activated circles keep
their center/size fixed and work with the same public page, QR and chat gates.
See [billing testing controls](../billing/README.md#temporary-free-testing-november-13-2026).
Disabling testing ends temporary access without starting any payment. Existing
links remain and can be reactivated through the retained $10/month checkout.

The template, styles, code, QR generator and deployment tools stay in GitHub.
Every UUID opens its own page from one static template, so payment activation
needs no commit or Pages deployment. Supabase stores private ownership/payment
associations and the user-provided public page content. No customer records or
locations are committed to Git. The UUID remains unchanged on cancellation or
renewal; inactive links display an unavailable message. There is no directory.
The page does not load the main Explore/planner iframe or Special Events data.

Address lookup uses the free [Census Geocoding API](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html)
through the authenticated function, with a three-second per-account limit.
It supports U.S. addresses and estimates positions along streets. Users must
check the map; coordinates are the alternative. No Nominatim dependency.
QR codes are generated locally using vendored MIT-licensed
[qrcode-generator 2.0.4](https://github.com/kazuhikoarase/qrcode-generator).
No customer link is sent to a QR service.

## Billing and activation

Production checkout was enabled on 2026-11-10 after isolated Stripe test-card
Checkout/payment/cancellation checks and deployed live-key verification. The
published phone form was checked with a real disposable account without starting
a live purchase. Local Stripe CLI test mode does not change the live backend.

`geofences` and `geofence-webhook` are independent Edge functions. The existing
Pro webhook, products and customer associations remain unchanged. Each circle
has a dedicated Stripe customer and subscription, with matching owner/circle
metadata. Prices, quantity and return URLs are fixed by the backend. A fenced
lease and Stripe idempotency protect checkout retries and reconciliation.
An enabled temporary testing grant or current paid active live subscription
activates the public page/chat;
a return URL, test payment or unpaid subscription cannot grant access. Signed
webhooks read current Stripe state to tolerate stale/duplicate delivery.
Cancellation in the dedicated portal is at period end. Renewal failure or
paid-period expiration disables chat. Inactive ownership records remain so
links can reactivate. Special Event 48-hour cleanup does not apply here.

Secrets: `GEOFENCE_BILLING_MODE`, `GEOFENCE_STRIPE_PRICE`,
`GEOFENCE_STRIPE_PORTAL`, `GEOFENCE_STRIPE_WEBHOOK_SECRET`,
`GEOFENCE_CHECKOUT_ENABLED`, and optional sandbox `GEOFENCE_TEST_USERS`.
The runtime reuses the already deployed restricted Stripe key for the selected
mode (`AUSTIN_STRIPE_LIVE_KEY` / `AUSTIN_STRIPE_KEY`). Never copy a CLI temporary
key into the deployment or commit secrets.

1. `python3 tools/geofences/deploy.py` validates the migration and rolls back
   every test fixture. `--apply --functions` applies migration 0018 and deploys
   the functions without enabling billing.
2. From an authorized Stripe CLI, run
   `python3 tools/geofences/check-sandbox.py`. It deploys separate temporary Edge
   functions with separate QA settings, uses the deployed restricted test key,
   and completes real hosted Checkout with a Stripe test card. Signed payment
   and cancellation notifications update only test billing rows. It verifies
   live geofence/Pro isolation, then removes temporary users/customers/functions/
   webhook/settings, archives the test catalog, and compares production secret
   digests. Never switch the existing Pro production environment to test.
3. Authorize live access with `stripe login`, then select the existing account
   using `stripe switch acct_1UFxBXPylm4UechM --live`. Run
   `python3 tools/geofences/configure-stripe.py`. Set `STRIPE_CLI` if the binary
   is not on PATH. This checks the existing Pro catalog and creates/reuses the
   separate $10 monthly product, portal and webhook, stores configuration
   securely, and leaves checkout off. Run `python3 tools/geofences/verify-live.py`
   to check the deployed restricted key against the live price/portal without
   creating any live Stripe customer, subscription or charge.
4. Publish the matching site, follow the repository cache rules, verify the
   account/form/page/QR, then use `configure-stripe.py --activate` to enable the
   new product. Run `python3 tools/geofences/verify-live.py --enabled --browser`
   afterwards to verify the live backend and published phone form without starting
   a real purchase.
   This is separate from the existing Pro activation script. The CLI can then
   return to test mode with `stripe switch acct_1UFxBXPylm4UechM`.

If configuration is missing or checkout is disabled, the account card/form
provide a working map preview and state that payments are being set up;
payment buttons are disabled.

## Automated email

Email only; the owner explicitly deferred SMS on November 13. Activation queues
one share email to the owner's confirmed account email, with the permanent link
and an embedded/attached PNG QR code. Owners can forward it to guests. The share
email contains no private notification token. Paid renewals and repeated free
activation do not duplicate it. Drafts and test-mode Stripe purchases do not send
share emails. Billing setup is unchanged.

The creation form and each owned circle offer optional, initially unchecked
arrival/departure emails. The account email is immediately verified; a different
address receives a confirmation link before alerts start. Settings, recipients,
verification/stop tokens and delivery jobs are private. Only the owner can update
settings. Token links require a button click on `/geofences/notifications/`, so
email link scanners cannot verify or cancel them by GET. Tokens are cleared from
browser history and never appear in referrers.

Alerts describe **chat presence while the visitor uses the page with location
allowed**, not background tracking. Closing/backgrounding the page, stopping GPS
or losing connection also counts as leaving. Repeated GPS polls do not create
duplicate arrivals. Recent transitions are grouped into one email (up to 100 per
message), normally within a minute or two. No visitor email or account ID is sent
to the owner. Transitions are not recorded when optional alerts are off.

Migration 0020 creates the queue and activation/presence triggers. The separate
`geofence-send` worker reuses the existing `RESEND_API_KEY` and `REMINDER_FROM`,
with its own `GEOFENCE_EMAIL_ENABLED` flag and Vault-backed `GEOFENCE_CRON_SECRET`.
The `austin-geofence-email` Cron runs every minute, prunes stale chat presence,
and delivers queued messages. Retries retain the exact payload and provider
idempotency key; leases prevent overlapping claims. Recipient/settings/access
are rechecked before submission. Activity expires after 15 minutes, other mail
after 23 hours, with at most five attempts; jobs/payloads are purged after 30 days.
The permanent activation receipt prevents resends after that purge. `sent` means
Resend accepted the request, not proof that a person's inbox displayed it.

`python tools/geofences/configure-email.py --apply --functions` validates, installs and
deploys the email feature. `--enable` starts its Cron and sender; `--disable`
pauses only geofence email. Existing sign-in SMTP, reminders, Stripe configuration
and secrets remain unchanged. Never rerun the older reminder setup for this.
`tools/geofences/check-email-live.py` verifies real queue/Cron/provider behavior
with disposable accounts and Resend's labeled `delivered+...@resend.dev` test
recipients, then removes fixtures. It never sends fixture content to visitors.

Provider references: [inline attachments](https://resend.com/docs/dashboard/emails/embed-inline-images),
[test recipients](https://resend.com/docs/dashboard/emails/send-test-emails).

## Chat behavior

The public page centers the circle on a large map, shows chat members below it,
and opens the conversation with **Chat**. It has no Explore panel. An owner-only
**Manage** control returns to the signed-in owner's list of all their circles.
`geofence_is_owner` checks ownership in the database; hiding the control is not
the authorization boundary. The same page works for registered and temporary
guest visitors. A circle has a stable UUID URL, active while paid or temporarily
enabled for testing; each paid circle remains a separate $10/month subscription.

Visitors explicitly select Use my location to join. They need no paid or
registered account: the existing temporary Supabase guest session suffices.
This isolated chat uses short-lived database presence/messages, polled every
three seconds while open. Each request checks active access, radius,
GPS accuracy (at most half the diameter or 50m), and a fix no older than 45s.
The server does not retain the submitted coordinates. It assigns an anonymous
visitor nickname, returns no account/email IDs, and exposes only messages since
that visitor joined. Server rate limiting permits one message per second.
Leaving, backgrounding or changing accounts clears the visible conversation;
presence expires after 20s if a browser disappears. Messages expire after two
minutes and a five-minute cron removes stale rows (also pruned during use).

Phone GPS is browser-reported and can be spoofed; this is a location-based
social feature, not physical access control or proof of presence. Small circles
may require outdoor GPS reception. Payment expiry is enforced server-side even
if a visitor leaves an old page open. Physical-phone GPS remains an owner field
check, as with Studio Tour chat.

## Checks

- `node --test tests/billing/*.test.mjs`
- `python3 tools/geofences/check-sandbox.py` (manual real Stripe test payment;
  temporary isolated endpoints, requires authorized CLI and deployed test key)
- `python3 tools/geofences/verify-live.py [--enabled] [--browser]` (live configuration
  and optional published phone form; disposable Supabase fixture, no Stripe
  customer or charge; browser check requires `--enabled`)
- `python3 tools/geofences/deploy.py` (database checks; rolled-back fixtures)
- `node tools/geofences/check-browser.cjs [site-url]` (fixture account/payment/chat,
  real MapLibre, desktop and phone; `PHONE_ONLY=1` narrows to phone)
- `python3 tools/geofences/check-backend.py` (disposable confirmed accounts,
  real Census lookup/API ownership/size checks; expects checkout OFF and removes
  its own drafts/accounts; creates no Stripe objects)

Live Stripe configuration and real sandbox payment validation remain required
before activation on this laptop. The preparation script does not replace
those end-to-end checks.
