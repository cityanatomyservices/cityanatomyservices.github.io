# One membership, two services

An $8/month Austin.chat Pro subscription includes paid access to
[Austin.chat on Substack](https://austindotchat.substack.com/).
A currently paid monthly, annual or founding Substack subscription includes
Austin.chat Pro. The subscriber uses the **same email** on both services.
The owner chose to keep Substack's existing prices (its public monthly plan
was $5 on November 5, 2026); site Pro remains $8/month. Either paid route
qualifies for the same bundle after manual activation.
Activation and renewal reconciliation are manual; payment stays on the service
the member chose. This does not merge accounts or create a second subscription.

## Site payment → Substack access

1. Export the private site report using the command below. Rows with
   `site_paid_active=True` have current site-paid access. `site_paid_through`
   gives the end of that paid period. Compare these with your Substack list to
   identify new members and renewals; the report is a full current snapshot.
2. In [Substack Subscribers](https://austindotchat.substack.com/publish/subscribers),
   find the same email. If necessary, invite/add it with the reader's agreement.
   Substack may require the reader to confirm the subscription.
3. Select the reader, then **… → Comp** to grant complimentary paid access.
   Substack offers fixed periods including 30 days. Choose a period consistent
   with the site membership and keep a note that the comp comes from Austin.chat.
   Do not comp an already paying Substack subscriber without reviewing the two
   subscriptions: Substack adds comp time after their current billing cycle.
4. Recheck new payments and renewals regularly, and before comps expire. A
   canceled site plan still qualifies through its paid-through date. Stop
   extending the site-funded comp when that paid period ends. Never remove a
   reader's independently paid Substack subscription as part of this process.

Substack sends automatic reminders before a timed comp ends and may invite the
reader to pay there. Explain that members already paying through Austin.chat
should contact you for renewal of their included access, not pay a second time.
This is why an occasional new-member-only report is insufficient: renewals,
expirations, refunds and cancellations also need review.

## Substack payment → site access

1. Verify the subscriber in the publication's dashboard, including their paid
   plan and exact paid-through/renewal timestamp. Monthly, annual and founding
   plans qualify. Free readers, unpaid trials and site-funded complimentary
   subscriptions do not qualify as a second payment source.
2. Ask them to sign in at [Austin.chat](https://austin.chat/?account=membership)
   with that same email. The account must be confirmed before granting access.
3. Run the grant command below. Enter their email at the prompt and confirm you
   verified the payment and date. No card, Stripe customer, email or charge is
   created. The grant immediately unlocks the same nine Pro apps.
4. Run grant again after a verified renewal, using the new paid-through date.
   Access expires automatically at that timestamp if it is not renewed. A
   cancellation scheduled for period end keeps access through that paid period.
   For an earlier termination/refund, use revoke after checking the subscription.

An active Substack grant hides the site upgrade button and blocks new site
checkout on the server. Existing subscriptions are never canceled or refunded
automatically. Review any member paying on both services and agree which
subscription they want to keep. Already-open Stripe checkout sessions cannot
be recalled by this grant; review the report for any resulting double payment.
If the member changes their site login email, verify the match again before
regranting. The old email cannot silently transfer access to another account.

## Owner commands

The easiest route is the unlisted [owner dashboard](https://austin.chat/dashboard).
Use **Site-paid members for Substack** or **Substack access and renewals**, then
**Export to Excel**. The **Substack membership access** section provides the
same grant/renew/revoke controls as the commands below. Only the authorized
owner account can use these reports and controls.

Run from the repository with the already-authorized Supabase CLI. On this
Windows laptop, `python3` can be replaced by
`C:\Users\citya\.local\bin\python3.14.exe`.

```powershell
# Choose a NEW filename outside every Git repository.
python3 tools/billing/substack-members.py report --output C:/Dev/reports/membership-private/members-2026-11-05.csv

# Replace this example timestamp with the subscriber's actual paid-through time.
# --plan accepts monthly, annual or founding. The email is entered privately locally.
python3 tools/billing/substack-members.py grant --plan monthly --until 2026-12-05T18:00:00Z

# Removes only the Substack-derived site grant; site-paid access is preserved.
python3 tools/billing/substack-members.py revoke
```

The report contains private email addresses. The helper refuses a destination
inside a Git repository and refuses to overwrite an existing file. Keep reports
local; never commit them or publish them through Pages or public Actions artifacts.
It exports current site-paid and Substack-granted members, including expired
grants that need review. `site_billing_last_checked` is the billing reconciliation
time, **not** the date the person subscribed. Review Substack separately: the
tool does not fetch its subscriber list or know whether a comp was fulfilled.
CSV cells are escaped for spreadsheet safety; this is a review report, not a
direct Substack import file.

No subscriber lists are synchronized automatically. Substack's **Export**
supports a filtered paid subscriber list if you prefer to review several
members together; grant each verified member using the command above.

## Implementation and deployment

`0014_substack_billing.sql` adds private, owner-managed grants and an audit
history. `membership_read()` combines active live site payments and active
verified Substack grants. Expiry/revocation of one source cannot erase the
other; test Stripe payments never count. The protected-app backend already
calls this RPC on every request, so these grants use the existing access gates.
Browser users cannot read the private tables or call the grant/revoke RPCs.

```powershell
python3 tools/billing/substack-members.py deploy
```

Deployment runs rolled-back database fixtures before installing a new migration,
checks existing Stripe behavior, and deploys the billing functions without
changing live payment settings. It creates no real membership grants. Ordinary
CI tests permissions, email verification, plan types, expiry, revocation,
independent payment sources and blocked duplicate checkout.

Official Substack instructions:
[complimentary access](https://support.substack.com/hc/en-us/articles/360037465612-How-do-I-offer-a-complimentary-subscription-to-a-reader-on-Substack),
[subscriber exports](https://support.substack.com/hc/en-us/articles/6314498343700-How-do-I-export-my-email-list-on-Substack),
[subscriber dashboard and comp behavior](https://support.substack.com/hc/en-us/articles/360058529871-How-do-I-use-the-subscriber-dashboard-on-Substack).
