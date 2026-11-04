# Austin.chat membership setup

Owner direction, November 4, 2026: exactly two membership levels. Set up the
paid tier first, then change access to the Apps button.

| Membership | Price |
| --- | --- |
| Free | $0 |
| Pro | $8 USD per month |

The owner already has a Stripe account. Its connection to this session is
pending. Pro benefits are defined below. No payment product,
checkout, subscription or paid entitlement has been created by this work.

## Stripe product to configure

- Product name: **Austin.chat Pro**.
- Flat recurring price: **800 USD cents**, every **one month**.
- One membership per signed-in site account.
- Keep Free as the site's default membership; no zero-dollar Stripe
  subscription is needed for Free users.

Inspect the connected Stripe catalog before creating anything, and reuse an
existing matching product/price if present. Validate in a Stripe sandbox
before enabling live checkout. Do not add other paid levels, yearly prices,
trials or signup fees without an owner request.

Stripe supports product/price setup in its [Dashboard or API](https://docs.stripe.com/products-prices/manage-prices).
Use [hosted Checkout for subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted)
and its [customer portal](https://docs.stripe.com/customer-management/integrate-customer-portal)
for members to manage billing.

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
