# Custom chat geofences

The owner approved **$10 USD per month per geofence**, a **10–500 meter diameter**,
and permanent links such as `https://austin.chat/geofences/?id=<UUID>`.
This is a separate subscription from Free/Pro. The account card opens
`/geofences/manage/`. Address and coordinate fields are mutually exclusive.
The inline wizard asks for a title, description, location, circle size, and at
least one invitation email before revealing map review. Each valid email adds
a blank field; addresses can be removed. Editing earlier answers clears the
preview and confirmation. GPS has its own location choice alongside Austin
metro addresses and coordinates. The map stays hidden until review.
The GPS button requests a fresh current position (high accuracy, no cached fix)
and fills the coordinate center. It does not start location tracking or create
the circle. Permission denial, timeout and stale fixes leave manual entry
available. Users still preview and confirm the circle.
With regular billing, confirmation continues to Stripe Checkout.
The canonical center is stored as coordinates. Location/size lock when billing
begins; checkout retries reuse the same draft, customer and session.
The owner raised the maximum diameter to 500 meters on November 14, 2026.
Migration 0021 expands the database constraint; the default remains 50 meters.
The 500-meter circle has a 250-meter radius, and GPS accuracy remains capped
at 50 meters.

**Free testing is temporarily enabled.** Confirmed signed-in owners can create
or activate circles without a card or charge. The button says "Create geofence
& send invitations". These grants are separate from paid records; activated circles keep
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

Full street address suggests matches as the owner types a street number and
name. The address box is restricted to the Austin metro's five counties:
Travis, Williamson, Hays, Bastrop and Caldwell. The authenticated `suggest`
action queries [CAPCOG Regional Address Points](https://www.arcgis.com/home/item.html?id=7c6a142594ec463487c07c0af7885e89)
with a Texas/county filter, then checks each returned county and coordinate.
It returns up to six distinct addresses, with Austin matches first. No API key
or paid geocoding account is needed.

Typing is debounced, requests respect the existing three-second per-account
limit, and stale responses are discarded. The dropdown supports touch, arrow
keys, Enter and Escape. Editing an address invalidates the selected location
and map confirmation. **Find address** retains a full-address fallback through
the [Census Geocoding API](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html),
with the same five-county check using Census geography codes. Out-of-area
addresses are excluded from both lookup paths. Users still check the map;
GPS and coordinate entry remain available. No Nominatim dependency.
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
   every test fixture. `--apply --functions` applies migrations 0018/0021 as needed and deploys
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

Migration 0022 adds private invitations: up to 25 distinct addresses per circle
and 100 recipient reservations per owner per day. Draft and recipient changes
save atomically. Activation queues a separate one-time email with the permanent
link and PNG QR for each invitee; no recipient list or private alert tokens are
shared. Repeated activation and renewals do not resend invitations, even after
email-job cleanup. Owner cards show delivery counts. The form requires the
configured sender before accepting invitations.

`python tools/geofences/configure-invitations.py --apply --functions` validates
and installs 0022 and deploys the API/sender. Existing email and billing settings
remain unchanged. `check-invitations-live.py [--browser]` uses only disposable
accounts and Resend test recipients, checks delivery and duplicate prevention,
and removes its fixtures. The browser option exercises the published wizard,
profile/guest names and text export on desktop and phone.

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
The server does not retain submitted device coordinates. Visitors can choose
an anonymous name or, when signed in, their profile name. Profile names are
resolved on the server and cannot be claimed by guests. The API returns no
account/email IDs and exposes only messages since that visitor joined the
current conversation. Server rate limiting permits one message per second.
Leaving, backgrounding or changing accounts clears the visible conversation;
presence expires after 20s if a browser disappears.

Migration 0023 groups messages into conversations. A conversation ends when
its last participant leaves or expires; later visitors start a new conversation.
The five-minute cleanup removes ended conversations and their messages after
23 hours 50 minutes, leaving scheduling margin for the promised 24-hour limit.
Active conversations are retained until they end. The old chat RPC delegates
to the new implementation so previously opened pages remain compatible.
`python tools/geofences/configure-chat.py --apply` validates and installs 0023.

Export chat downloads a plain-text copy in the browser, containing messages
received during this visit (up to the latest 10,000). It includes names, times
and message text, without account IDs or device coordinates. Export before
leaving; no server history or export endpoint is exposed. Both creation and
public pages display the owner's explanatory and privacy text.

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
- `python3 tools/geofences/check-address-live.py [--browser]` (deployed address
  lookup in all five counties, excluded regions and authentication; optional
  published phone/desktop autocomplete with a disposable account; no saved
  circles, payments or email)
- `python3 tools/geofences/check-diameter-live.py [--browser]` (real saved draft
  at 10/100/101/500 meters, invalid-size rejection, optional published form;
  removes its draft/account without activation, payments or email)
- `python3 tools/geofences/check-backend.py` (disposable confirmed accounts,
  real address lookup/API ownership/size checks; expects checkout OFF and removes
  its own drafts/accounts; creates no Stripe objects)

Live Stripe configuration and real sandbox payment validation remain required
before activation on this laptop. The preparation script does not replace
those end-to-end checks.
