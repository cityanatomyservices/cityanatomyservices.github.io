# Austin.chat membership setup

Owner direction, November 4, 2026: exactly two membership levels. Set up the
paid tier first, then change access to the Apps button.

| Membership | Price |
| --- | --- |
| Free | $0 |
| Pro | $8 USD per month |

The owner already has a Stripe account. Its connection to this session is
pending. Pro benefits have not yet been specified. No payment product,
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
failures and cancellation before enabling paid access. Define the owner's
Pro benefits before presenting an upgrade offer to visitors.

## Apps access requested next

The Apps button should be gray and unavailable when signed out. Signed-in
members can open its panel. This is a sign-in requirement for both Free and
Pro, unless the owner changes that requirement. It is not implemented yet.
