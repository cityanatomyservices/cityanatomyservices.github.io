# Custom paid chat geofences

The owner approved **$10 USD per month per geofence**, a **10–100 meter diameter**,
and permanent links such as `https://austin.chat/geofences/?id=<UUID>`.
This is a separate subscription from Free/Pro. The account card opens
`/geofences/manage/`. Address and coordinate fields are mutually exclusive.
The user previews the circle, confirms it, then continues to Stripe Checkout.
The canonical center is stored as coordinates. Location/size lock when billing
begins; checkout retries reuse the same draft, customer and session.

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

`geofences` and `geofence-webhook` are independent Edge functions. The existing
Pro webhook, products and customer associations remain unchanged. Each circle
has a dedicated Stripe customer and subscription, with matching owner/circle
metadata. Prices, quantity and return URLs are fixed by the backend. A fenced
lease and Stripe idempotency protect checkout retries and reconciliation.
Only a current paid active live subscription activates the public page/chat;
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
   `python3 tools/geofences/configure-stripe.py`. Set `STRIPE_CLI` if the binary
   is not on PATH. This creates/reuses the $10 monthly product, dedicated portal
   and webhook, stores their configuration securely, and leaves checkout off.
3. Verify sandbox Checkout/payment/webhook/cancellation end to end in an isolated
   test deployment, then verify live price/portal/webhook readiness without a
   purchase. Never switch the existing Pro production environment to test.
4. Publish the matching site, follow the repository cache rules, verify the
   account/form/page/QR, then use `configure-stripe.py --activate` to enable the
   new product. This is separate from the existing Pro activation script.

Until configured, the account card/form provide a working map preview and
clearly state that payments are being set up; payment buttons are disabled.

## Chat behavior

Visitors explicitly select Use my location to join. They need no paid or
registered account: the existing temporary Supabase guest session suffices.
This isolated chat uses short-lived database presence/messages, polled every
three seconds while open. Each request checks the live subscription, radius,
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
- `python3 tools/geofences/deploy.py` (database checks; rolled-back fixtures)
- `node tools/geofences/check-browser.cjs [site-url]` (fixture account/payment/chat,
  real MapLibre, desktop and phone; `PHONE_ONLY=1` narrows to phone)
- `python3 tools/geofences/check-backend.py` (disposable confirmed accounts,
  real Census lookup/API ownership/size checks; expects checkout OFF and removes
  its own drafts/accounts; creates no Stripe objects)

Live Stripe configuration and real sandbox payment validation remain required
before activation on this laptop. The preparation script does not replace
those end-to-end checks.
