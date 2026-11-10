# Austin.chat membership

Owner direction: exactly **Free** and **Pro ($8 USD per month)**. There is no
annual plan, trial, signup fee or other paid membership level.
Custom chat geofences are a separate $10/month-per-circle product; see
[geofences](../geofences/README.md).

Pro includes paid Austin.chat Substack access through a manual comp. All paid
monthly, annual and founding Substack plans also include site Pro after manual
verification. See the [private report and grant workflow](SUBSTACK.md).

The membership backend, Account UI and protected Pro apps are deployed.
Hosted Checkout, portal access, signed payment webhooks, duplicate checkout
prevention and cancellation passed sandbox integration tests. The owner's
live restricted key is verified. **Live checkout and the live webhook are
enabled**; the test webhook is disabled and test credentials retained. All nine
hosted Pro apps passed browser checks. No real purchase or charge was made by
the setup checks. See `docs/STATUS.md` for the latest deployment evidence.

## Member experience

The main map has an Explore → Pro Tier Apps card that visitors can browse.
Legacy catalog maps retain the signed-in Apps button. Each paid entry has the exact words **Pro App** after its name;
Free members see those entries gray and cannot launch them. The app directory
and direct app wrapper pages also check membership. Account shows the current
plan and provides Upgrade or Manage billing when live checkout is enabled.
Cancellation keeps access through the paid-through date.

The nine owner-selected Pro apps are Austin 1885 (`/apps/1885/`), Moontower
Walking (`/apps/moontower/`), and the seven current Shopping Apps entries:
horseback riding, golf, bike shops, vintage/used guitar shops, toy stores,
Austin Pool Openings and Pizza in Austin. Their `requiredPlan: "pro"` fields
in `home.json` and `apps/reports/reports.json` drive the labels and access rules.
The group includes Recreation and Dining entries as requested.

## Billing configuration

| Setting | Sandbox | Live |
| --- | --- | --- |
| Product | `prod_VZLVebM4SPstbL` | `prod_VZLfx6PwAYLksw` |
| Price | `price_1UYCoYPylm4UechMfDQJur0b` | `price_1UYCyLPylm4UechMwGuCKwdH` |
| Portal | `bpc_1UYDFWPylm4UechMi7mK5NgH` | `bpc_1UYDmUPylm4UechM0BBIEx3p` |
| Webhook | `we_1UYDGcPylm4UechMvq87q7Al` | `we_1UYDmVPylm4UechMuIWp8adD` |

Both prices are active, 800 USD cents every one month, with lookup key
`austin_chat_pro_monthly_usd`. Portals allow invoices, payment method updates
and cancellation at period end; plan changes are disabled. These were the
first configurations in their mode catalogs, so Stripe marked them default;
no existing portal configuration was replaced. Existing Substack Stripe customers
are never reused or changed. Owner-verified Substack access is stored separately;
each member who purchases directly on the site gets a dedicated customer.
Automatic tax collection is not configured; no tax settings were changed.

The integration uses Stripe SDK **23.1.0** and API **2026-10-28.endive** per
request, without changing the account-wide API version. Runtime restricted
keys need Customers, Checkout Sessions and Customer Portal **write**, and
Prices, Subscriptions and Invoices **read**. Setup uses the authorized CLI
for webhook/portal configuration instead of expanding runtime privileges.

Supabase secrets: `AUSTIN_STRIPE_KEY`, `AUSTIN_STRIPE_WEBHOOK_SECRET`,
`AUSTIN_STRIPE_PORTAL` (sandbox), `AUSTIN_STRIPE_LIVE_KEY`,
`AUSTIN_STRIPE_LIVE_WEBHOOK_SECRET`, `AUSTIN_STRIPE_LIVE_PORTAL`,
`BILLING_MODE`, `BILLING_CHECKOUT_ENABLED`, `BILLING_TEST_USERS`, and
`PRO_APPS_RELEASE`. Supabase provides its own URL and service role key.
Never commit credentials, session URLs, sign-in codes or raw account exports.
Never extract the CLI's temporary credential for the deployed application.

## Backend and verification

Migration `0012_billing.sql` owns customer/subscription associations in a
private schema. Browsers can only read their own LIVE membership through
`membership_read()`; all mutation RPCs require the service role. The database
requires a confirmed, nonanonymous account. Account deletion is restricted
while its billing association exists; cancel before deliberately removing it.

The `billing` Edge function supports authenticated `status`, `checkout`, and
`portal`. It fixes price, customer and return URLs on the server, reuses open
checkout sessions and directs existing subscribers to the portal. Persisted
nonces, Stripe idempotency and fenced database leases protect retries.
`stripe-webhook` verifies the raw signature and reconciles current Stripe
subscriptions instead of stale event snapshots. Processing failures return
503 for retry. Paid active subscriptions grant Pro; unpaid, failed, paused or
trial subscriptions do not. Test purchases never grant live app access.
A successful checkout-return URL alone never grants membership.

Run `npm ci --prefix tools/billing --ignore-scripts`, then
`node --test tests/billing/*.test.mjs`. CI also checks database permissions,
account isolation, leases and restrictive Storage policy in PostgreSQL 17.
Browser helpers check Account, membership, Apps states and private delivery.

Manual `check-sandbox.py` completes hosted Checkout with a test card and
verifies signed payment/cancellation webhooks using disposable accounts. It
cleans up customers, Auth users and rows and disables checkout. **After live
launch, use a separate test deployment; do not switch production to test.**
`verify-live.py --enabled --browser` checks the live price/portal and Free UI
without changing activation settings or creating any Stripe objects.
`activate-live.py` validates published exclusions, account charge readiness,
price and webhook settings, enables the live endpoint, disables the test
endpoint and enables checkout. It makes no purchase or charge.

## Protected hosted delivery

The owner approved direct hosted access protection. Source is still saved in
this **public GitHub repository** and can be downloaded from GitHub. The live
site delivers the nine apps only to confirmed, currently paid Pro accounts.
This protects hosted access; it does not make the GitHub source private.

`billing/pro-assets.json` lists the apps and 45 private resources. The Pages
artifact excludes those resources. Private copies live in the `pro-apps`
Supabase bucket under content release prefixes. Migration 0013 denies direct
anon/authenticated Storage access even with a broad permissive policy. The
`pro-app` function checks the caller's live membership on every request and
serves only manifest-listed files. It issues no public or signed file URLs.

A root service worker restores trusted MIME types so iframe apps retain
normal URLs, relative imports and queries. Tokens stay in worker memory and
refresh from the existing login. Files use `private, no-store`; neither app
bytes nor tokens go into CacheStorage. Canonical `/apps/<slug>/` links show
membership gates to Free users. Raw files return 404 without the authorized
worker. Previously downloaded content cannot be recalled from a visitor.

For a Pro source or catalog change:

1. Update source and the catalog's `requiredPlan: "pro"` field.
2. Run `python3 tools/billing/package-apps.py --upload` with the authorized CLI.
   It checks the private bucket/policy, uploads the hashed release, then sets
   the release secret. New app types may need extra resources added to the
   packager before publishing.
3. Commit source and generated manifest together. The builder refuses a
   mismatched catalog/source manifest, so updates cannot silently leak files.
4. Push main and wait for **Publish Austin.chat**. Pages must use workflow
   publishing; legacy publishing would expose the app files again. Existing
   feed jobs trigger this workflow after successful updates.
5. Verify direct denial and authenticated use after deployment. Follow the
   repository rule: wait for Pages and HTML to advertise a new asset version
   before requesting that versioned URL.

`check-private-apps.py` verifies hosted API rejection, file hashes/MIMEs and
revocation with a temporary Auth account and entitlement. `--browser` also
opens all nine hosted apps and verifies sign-out. It sends no email and creates
no Stripe objects. Credentials travel only in memory/stdin, then fixtures are
removed. Run it only against a published matching release.

## Working from another laptop

Use the GitHub repo; all source and checkpoints are committed there. On this
Windows laptop Stripe CLI 1.55.8 is installed under
`%LOCALAPPDATA%/Programs/StripeCLI/stripe.exe`; the official x86_64 build works
on Windows ARM, while the npm wrapper did not. `stripe agent setup` and browser
authorization completed for both modes. Supabase CLI 3.0.0 is authorized here.
A browser GitHub/Stripe login alone does not sign in command-line tools on a
new laptop. Use each CLI's authorization flow; never paste credentials into
chat. The Python executable here is `%USERPROFILE%/.local/bin/python3.14.exe`.

Official references: [Stripe subscription Checkout](https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted),
[customer portal](https://docs.stripe.com/customer-management/integrate-customer-portal),
[Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
