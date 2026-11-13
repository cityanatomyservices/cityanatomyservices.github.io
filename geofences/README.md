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

## Chat behavior

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
