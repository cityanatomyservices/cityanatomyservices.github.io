# Austin.chat email event reminders

Email only, per the owner's final instruction. No SMS provider or phone field.
The UI offers an unchecked **Email reminders** checkbox for published timed
Explore events and City Hall meetings. Ongoing activities/opening hours, parks,
all-day listings, date-only meetings, news and permit issuance dates do not
qualify. Movies have a reminder-showtime selector, with a separate selection
for each showing. Planner selections and reminder selections are independent.

Supabase owns private selections, a minute-by-minute Cron schedule and two
Edge functions. Resend delivers the emails to the account's current confirmed
email address. The existing Auth SMTP configuration is for sign-in messages;
it does not give Edge functions access to its stored, write-only API key.
GitHub Actions still refreshes the event feeds and runs regression tests.

<a id="remaining-owner-setup-connect-the-existing-resend-account"></a>

## Resend connection and setup

**Active as of November 2, 2026.** The Resend key, sender and enable flag are
stored in Supabase Edge secrets, the public readiness check returns true, and
the every-minute Cron job is active. Recent worker calls return HTTP 200 with
no failed or overdue jobs. Actual Resend acceptance and inbox delivery still
need verification when a scheduled email is sent.

The steps below are for reconnecting or rotating the sending key. If sending
is paused or required secrets are absent, visitors see “Email reminders are
being set up”; unavailable reminders cannot be selected.

1. In [Resend API keys](https://resend.com/api-keys), create a sending key
   restricted to the already verified `login.austin.chat` domain. No new SMS
   account or phone number is needed. The reminder sender is
   `Austin.chat <no-reply@login.austin.chat>`.
2. From this checkout, run `python3 tools/reminders/configure.py --enable`.
   Paste the key at its **hidden terminal prompt**, never into chat or a public
   repository. This uses the local Supabase management login and stores the key
   as an Edge secret, then activates the already installed Cron job.
3. Select a timed event in your own signed-in account and verify delivery in
   [Resend Emails](https://resend.com/emails). No real email was sent during
   automated verification. Provider acceptance is not proof of inbox delivery.

Dashboard alternative: add `RESEND_API_KEY`, `REMINDER_FROM` (the sender above)
and `REMINDERS_ENABLED=true` in
[Supabase Edge secrets](https://supabase.com/dashboard/project/aqbyxpiwugcvoephsvpm/functions/secrets),
then activate `austin-email-reminders` in the project's Cron dashboard. Keep
`REMINDER_CRON_SECRET` unchanged; the installed schedule uses its Vault copy.
After activation, refresh the listings or reopen Account → Reminders.

To pause sending: `python3 tools/reminders/configure.py --disable`.
To deploy later code/schema changes: `python3 tools/reminders/configure.py --deploy`.
Deploy uses the Supabase CLI's API bundler, requires no Docker, never prunes
unrelated functions, and preserves the existing activation setting. Do not
enable the scheduler without the matching function secret/Vault deployment.
This does not change Auth SMTP, the site's subscriptions, billing or DNS.

## Timing and content

- More than 24 hours away at selection: schedule 24-hour and 2-hour emails.
- Between 2 and 24 hours away: schedule only the 2-hour email.
- Within 2 hours: show that it is too late; do not send an immediate substitute.
- Offsets use elapsed hours from an absolute timestamp, including across DST.
  Dates in messages and controls use `America/Chicago`.
- Cron checks each minute. Provider queues can delay arrival. Retries stop
  after five attempts or 15 minutes past the intended send time; old reminders
  never accumulate into a catch-up burst after an outage.

Example subject: **Reminder: Public Safety Commission — 2 hours to go**.
The plain-text body includes the card's title, start date/time, venue/address,
price if given, description, conditions and source link. It also links to
Account → Reminders and a cancellation link for that event. No marketing text
or invented event time is added.

## Privacy and delivery behavior

`0010_event_reminders.sql` creates two RLS-protected tables. Browser roles have
no direct grants; even owner reads go through the authenticated endpoint so
delivery payloads and cancellation tokens stay private. Registered accounts
with confirmed email can select up to 100 upcoming events. Neither recipient
addresses nor card text supplied by the client are trusted. Edge functions
validate event IDs and exact start times against fixed repository feed URLs.

Selections are shared across the frame, maps and browser tabs. Sign-out clears
private state. In-flight reads cannot undo a newer save, and stale account
responses cannot populate another user's account. Unchecking a card, cancelling
one entry in Account, or cancelling all entries stops pending jobs. A message
already accepted by Resend cannot be recalled.

The worker rechecks fresh source data before sending. Removed, cancelled,
expired or rescheduled occurrences are skipped; users need to select a new
time after a reschedule. Temporary feed failures retry within the delivery
window. Account → Reminders shows scheduled, sent, skipped and failed states.
`sent` means the provider accepted the request, not a delivery/read receipt.
Existing provider suppression rules handle bounced/complaining addresses;
there is no delivery-tracking webhook or open tracking added here.

Jobs use row locks and leases so overlapping runs cannot claim the same job.
The exact send payload is saved before submission, and retries use the same
Resend idempotency key and payload. If the confirmed account email changes
between uncertain attempts, the old job is skipped. Retry windows are shorter
than Resend's 24-hour idempotency retention. Private records and payloads more
than 30 days past the event are purged by the active worker; account deletion
cascades immediately. No credentials, addresses or personal event selections
are logged. Cron authenticates with an independent random secret held in
Supabase Vault and Edge secrets; it does not expose the service-role key.

The email's cancellation link opens a confirmation page on `/reminders/`, so link scanners
cannot cancel selections. Its token stays in a URL fragment and is cleared from
browser history. Supabase GET requests redirect to this page (hosted Edge
functions rewrite HTML to plain text). An explicit POST cancels that event, also supporting
standard `List-Unsubscribe-Post` one-click clients. It cannot expose an email
address or cancel other events. Account cancellation always verifies ownership.

The existing Resend plan's quotas apply to both sign-in and event emails. No
plan was changed. Monitor provider limits/errors and the private jobs table
when activating or expanding use. Each selected event can generate two emails.

## Validation

`node --test tests/reminders/*.test.mjs` tests timing boundaries, Austin DST,
trusted sources, date-only/opening-hours exclusion, movie occurrences, account
authorization, cancellation, provider errors, immutable retries and expired jobs.

`node tools/reminders/check-browser.cjs [base-url]` intercepts all account and
feed requests; it tests desktop/mobile cards, popups, City Hall, Account,
showtimes, failures, stale loads, readiness and sign-out without production writes.

`node tools/reminders/check-backend.cjs` uses the local management login to
create/delete disposable confirmed `example.invalid` accounts. It tests real
database/Edge access controls, isolation, exact offsets, deduplication, late
selection, cancellation, unsubscribe and worker auth without sending email.
It checks concurrent claims only while sending is disabled and no other due
jobs exist. Do not send fixture content to an actual mailing list.

Primary references: [Supabase Cron and Edge functions](https://supabase.com/docs/guides/functions/schedule-functions),
[Supabase + Resend](https://supabase.com/docs/guides/functions/examples/send-emails),
[Resend send API](https://resend.com/docs/api-reference/emails/send-email),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[GitHub scheduled-run delays](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows).

Hosted HTML behavior: [Supabase routing](https://supabase.com/docs/guides/functions/http-methods).
