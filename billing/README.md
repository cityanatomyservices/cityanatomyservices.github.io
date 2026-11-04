# Austin.chat membership setup

Owner direction, November 4, 2026: exactly two membership levels. Set up the
paid tier first, then change access to the Apps button.

| Membership | Price |
| --- | --- |
| Free | $0 |
| Pro | $8 USD per month |

The owner's existing Stripe account is connected to the CLI in both test and
live modes. Both Pro products and monthly prices have been created and verified.
The billing database and Edge functions are deployed to Supabase. They are
not yet connected to the site UI. Checkout is disabled. No customer,
subscription or charge has been created by this work.

## Local Stripe tooling

Stripe CLI **1.55.8** is installed on this laptop at
`%LOCALAPPDATA%\Programs\StripeCLI\stripe.exe`, and its directory is in the
user PATH. The npm wrapper rejects Windows ARM64, so the official Windows
x86_64 executable was installed and verified against Stripe's published
SHA-256 checksum. It runs successfully on this laptop. The incompatible npm
wrapper was removed.

`stripe agent setup --client codex --yes` completed successfully;
`stripe agent setup --client codex --status` confirms the Stripe plugin is
installed for Codex CLI. Test and live authorization are complete.
Use the CLI's browser login flow; never save pairing
codes, access tokens or secret keys in this repository. A fresh terminal may
be needed to pick up the new PATH; the executable's full path also works.
Supabase CLI 3.0.0 browser authorization also succeeded on this laptop, and
project access was verified. Its login is stored by the CLI outside the repo.

## Stripe product configuration

- Product name: **Austin.chat Pro**.
- Flat recurring price: **800 USD cents**, every **one month**.
- One membership per signed-in site account.
- Keep Free as the site's default membership; no zero-dollar Stripe
  subscription is needed for Free users.

Verified sandbox objects (not live payment identifiers):

- Product: `prod_VZLVebM4SPstbL`.
- Price: `price_1UYCoYPylm4UechMfDQJur0b`.
- Price lookup key: `austin_chat_pro_monthly_usd`.
- Price: active, `livemode: false`, USD 800 cents, monthly interval count 1,
  licensed quantity, no trial. No signup fee was added.

The sandbox catalog was empty before setup. Product creation used an
idempotency key and the price was retrieved afterward to verify its settings.
Requests use API version `2026-10-28.endive`, verified against the current
Stripe API documentation; no account-wide API version was changed. Tax
behavior is still unspecified; tax configuration remains part of live setup.

Verified live objects:

- Product: `prod_VZLfx6PwAYLksw`.
- Price: `price_1UYCyLPylm4UechMwGuCKwdH`.
- Same lookup key and monthly USD 800-cent configuration; `livemode: true`.
- The live catalog was checked for an existing matching Austin.chat product
  before creating this product. Both modes were retrieved to verify settings.

Inspect the connected Stripe catalog before creating anything, and reuse an
existing matching product/price if present. Validate in a Stripe sandbox
before enabling live checkout. Do not add other paid levels, yearly prices,
trials or signup fees without an owner request.

Stripe supports product/price setup in its [Dashboard or API](https://docs.stripe.com/products-prices/manage-prices).
Use [hosted Checkout for subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted)
and its [customer portal](https://docs.stripe.com/customer-management/integrate-customer-portal)
for members to manage billing.

## Prepared backend

`supabase/migrations/0012_billing.sql` stores customer/subscription associations
in a private schema. Browser accounts can only call `membership_read()` for
their own live entitlement; all mutation RPCs require the service role. Free
is the default, and test purchases can never grant live Pro. A paid-through
deadline also expires access if a renewal event is delayed. Account deletion
is restricted while a billing association exists: cancel any subscription
before deliberately removing that association and deleting the Auth account.

`billing` is an authenticated Edge function accepting only `status`, `checkout`
and `portal`. It verifies the user with Supabase, fixes the price and return
URLs on the server, and creates a dedicated Austin.chat Stripe customer.
It never links existing Substack customers by matching email. Repeated clicks
reuse checkout; existing subscriptions go to the portal. A persisted nonce,
Stripe idempotency keys and fenced account leases protect retries/concurrency.

`stripe-webhook` verifies the raw request with Stripe SDK 23.1.0, then fetches
current subscriptions instead of applying potentially stale event snapshots.
Duplicate or reversed events therefore reconcile current state. Processing
failures return 503 so Stripe retries. The shared lease prevents checkout and
webhook workers overwriting one another. Paid active subscriptions grant Pro;
failed/unpaid/trial/paused subscriptions do not. Cancellation at period end
keeps access until the paid-through date. Unrelated account events are ignored.

This foundation is not yet the site's completed paid-membership feature.
No frontend checkout button or app access rule has been activated.

## Connection and launch steps

Completed on this laptop: Supabase CLI sign-in, hosted SQL preflight (all
fixtures rolled back), migration installation, and deployment of both Edge
functions. Both functions are active with gateway JWT checking disabled;
the handlers enforce their own authentication/signatures. Live endpoint
checks confirm guest checkout returns 401, foreign origins return 403,
unsupported methods return 405, and an unconfigured webhook returns 503.

Test-mode portal `bpc_1UYDFWPylm4UechMi7mK5NgH` is configured for invoice
history, payment method updates and cancellation at period end. It was the
first configuration in an empty test catalog, so Stripe automatically marked
it as the test default. No existing portal was replaced, and no live portal
configuration has been created or changed.

Test webhook `we_1UYDGcPylm4UechMvq87q7Al` was created and paused pending the
runtime key. Its signing secret and the portal ID are stored in Supabase,
along with `BILLING_MODE=test` and `BILLING_CHECKOUT_ENABLED=false`.
`tools/billing/prepare-webhook.py` records the reproducible setup and reuses
an existing endpoint without printing its secret. The owner was asked to
create a restricted test API key and save it directly in Supabase under
`AUSTIN_STRIPE_KEY`; this key is still missing. No test user IDs are configured.

The sequence below remains the reference for a new laptop or subsequent launch:

1. Sign in to Supabase CLI on this laptop:
   `npx --yes supabase@3.0.0 login --agent no --output-format text`.
   Browser sign-in alone does not connect the CLI. Use its verification flow;
   do not put access tokens or Stripe API keys in chat or this repository.
2. After the billing CI suite passes, run
   `python tools/billing/configure.py --deploy`. It checks SQL permissions and
   leases using rolled-back fixtures before installing the initial migration,
   and deploys only `billing` and `stripe-webhook` using the API bundler.
   It does not change existing sign-in, reminders or other functions.
3. Create an Austin.chat-specific Stripe portal configuration with payment
   method updates, invoice history and cancellation at period end. Keep plan
   changes disabled, use `https://austin.chat/?billing=return`, and pass its
   configuration ID explicitly. Do not alter account-wide/Substack defaults.
4. Register `https://aqbyxpiwugcvoephsvpm.supabase.co/functions/v1/stripe-webhook`
   in the intended Stripe mode with API version `2026-10-28.endive` and the
   event names in `_shared/billing.mjs`'s `EVENTS`. Capture its signing secret
   directly into Supabase secrets; never print it or commit it.
5. Create a dedicated restricted Stripe API key. Runtime access needs Customers
   write, Checkout Sessions write, Customer Portal write, and Prices,
   Subscriptions and Invoices read. Verify the exact scope requirements using
   a sandbox checkout and portal request. Setup operations for webhook/portal
   configuration can use the authorized CLI instead of broader runtime rights.
   Run `python tools/billing/configure.py --connect test` in a private terminal
   to store the test key, signing secret and portal ID in Supabase Edge secrets.
   The script hides secret input, uses a temporary transport file outside the
   repo, deletes it immediately, and leaves checkout disabled. Dashboard entry
   into Supabase Edge secrets is also supported.
6. Set `BILLING_TEST_USERS` to the confirmed Auth IDs allowed to test. Only
   those users can access test billing. After connecting the forthcoming UI,
   enable `BILLING_CHECKOUT_ENABLED` for sandbox testing. Exercise successful
   and failed payments, retries, renewals, cancellation and direct app URLs.
7. Finish authenticated delivery of the Pro apps before collecting money.
   Confirm tax treatment with the owner before adding Stripe Tax; automatic
   collection is not configured. Then connect matching live credentials and
   webhook, verify live price/account readiness, and enable live checkout.
   After launch, use a separate test deployment rather than switching the live
   webhook's runtime back to test mode.

Secrets: `AUSTIN_STRIPE_KEY`, `AUSTIN_STRIPE_WEBHOOK_SECRET`,
`AUSTIN_STRIPE_PORTAL`, `BILLING_MODE`, `BILLING_CHECKOUT_ENABLED`,
`BILLING_TEST_USERS`. Supabase supplies its own URL and service role key.
CLI authorization is for this laptop; do not extract its temporary credential
for the deployed application. A missing key/portal/signing secret keeps checkout
unavailable. A successful return URL never changes membership.

Validation: `npm ci --prefix tools/billing --ignore-scripts` followed by
`node --test tests/billing/*.test.mjs`. The GitHub billing workflow also runs
the migration and permission/lease tests against an isolated PostgreSQL 17
database. SQL bootstrap files are for CI only, never the hosted database.

## Site integration still needed

The site already uses Supabase Auth and Edge functions. Associate each Stripe
customer with the verified Supabase account ID on the server. Checkout and
portal sessions must use that association rather than browser-supplied account
or customer IDs. Keep payment secrets in Supabase Edge secrets, outside this
public repository and outside browser code.

Verified Stripe webhook events must update membership through payment,
renewal, cancellation and payment-failure changes. A checkout return URL alone
must never grant Pro. Test account isolation, duplicate events, payment
failures and cancellation before enabling paid access. The current app pages
and assets are public on GitHub Pages. Disabling catalog links alone cannot
enforce paid access; include direct entry points and authenticated delivery
of protected functionality/content when implementing the paid tier.

## Pro apps and Apps access

The Apps button should be gray and unavailable when signed out. Signed-in
Free and Pro members can open its panel. Within that panel, each Pro app must
have the exact words **Pro App** after its name. Free members see those rows
grayed out and cannot launch them; Pro members can launch them. Other Apps
entries retain Free-member access.

Owner-selected Pro apps:

- Austin 1885, currently titled The 1885 Murder Tour (`/apps/1885/`).
- Moontower Walking, currently titled Moontower (`/apps/moontower/`).
- All seven current entries in the card's Shopping Apps group: horseback
  riding, golf, bike shops, vintage/used guitar shops, toy stores, Austin Pool
  Openings and Pizza in Austin. The group includes Recreation and Dining
  records as well as records whose internal category is Shopping.

The selected records now carry `requiredPlan: "pro"` in `home.json` and
`apps/reports/reports.json`. Future Pro apps should use the same explicit
field. Their existing catalog/category controls where they appear; new Pro
apps should automatically receive the label and access rule from this field.
This metadata is preparatory: the current renderers do not yet apply it.
Gray states, labels, server membership checks and paid access are still
pending the billing integration, respecting the owner's paid-tier-first order.
