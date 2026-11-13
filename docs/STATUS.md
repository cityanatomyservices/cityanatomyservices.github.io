# STATUS — cityanatomyservices.github.io (austin.chat)

## 2026-11-13 - All 307 Studio Tour stop chat pages

Owner authorized creating all studio geofence pages before testing a couple,
then doing an onsite phone test and personally emailing selected studio contacts.
No outreach was sent and no contacts were inferred or collected.

`/maps/austin-studio-tour/stops/` is the searchable directory with a public CSV
of studio names, addresses, links and QR addresses. Each organizer stop number
has a real GitHub `index.html`, downloadable PNG QR and print SVG QR. All 307
pages plus images/directory total 3.84 MiB. The generator preserves the exact
existing stable stop IDs and polygons, including shared-building divisions and
approximate zones. Full-tour stop popups link to these individual pages.

The shared stop runtime shows one centered map, visible members below it,
GPS/Visible/Chat controls and sharing. It reuses the account shell and existing
live-only ChatRoom/Engine transport, so a studio page and the main tour share
the same room. No new database geofences, billing, remote-host privileges,
stored event messages or notification emails. Hosts must be onsite, open the
page and turn on Visible, like other visitors. GPS begins on a button click.

The existing retention rule unpublishes the directory/pages/QRs November 24,
2026 at 10 PM Central. Open pages stop chat then; the root 404 provides an
event-ended message for old studio links. Source files/Git history remain until
a later cleanup commit. Other event/main/account content is unaffected.

Local verification: all 307 exact room/boundary matches, actual QR decoding for
1/47/233/308, deterministic generator check, 11 event Python tests and 120
planner/chat tests passed. Browser QA with real isolated Realtime rooms passed
stop 47 phone ↔ full-tour desktop broadcasts, stop 233 separation, second stop
1, GPS permission/accuracy/freshness, member lists, PNG download, directory
search and retirement. Four disposable guests were removed after the passing
run (earlier harness attempts also cleaned their guests). Screenshots reviewed
outside the repository. GPS was simulated; the onsite two-phone check remains.

New page assets and event popup version: `20261113d`. No shared/private Pro
asset changes. Generator and live-browser check instructions are in
`special-events/README.md`; CI is `test-studio-stops.yml`. Deployment evidence
will be recorded after publication. Free testing and the prior Stripe/Supabase/
email configuration remain unchanged.

## 2026-11-13 - Geofence share emails, optional activity alerts and visitor map

Owner added automated link/QR email, optional arrival/departure alerts, and a
centered visitor map with chat members below, Chat and owner-only Manage.
Owner explicitly deferred SMS: email only for now. Managers sign in and own
multiple separate circles; guests join free without a registered account.
Regular pricing stays $10/month per circle, with free testing currently on.

Migration 0020 and the geofences/geofence-send/geofence-email functions are
deployed. Activation queues one share email to the confirmed account address;
paid renewals/retries do not duplicate it. The email includes the permanent URL
and an inline/attached PNG QR, with no private alert tokens so it can be forwarded.
Optional alerts start unchecked. Account email is trusted; another address needs
email confirmation. Owner-only per-circle settings can turn alerts off later.

Presence alerts describe people using the page with location allowed. Leaving
includes closing/backgrounding the page or disconnecting; this is not background
tracking. Poll refreshes do not create extra arrivals. Events group briefly for
delivery, preserving individual transitions. Jobs/contacts are private; leases,
fixed payloads and idempotency protect retries. Email links require explicit POST
confirmation and clear tokens from history. No SMS integration was created.

The existing Resend sender/key is reused; the separate authenticated Cron and
geofence email enable flag are ON. See `geofences/README.md` and
`python tools/geofences/configure-email.py --enable` / `--disable`. No billing or sign-in
configuration is replaced. The management module is `20261113c`; the visitor
module/style/email-confirmation script are `20261113b`. Shared/main-map assets
remain `20261113a`. No additional private app bundle changes.

Implementation `94bcd02` published through Pages run `43430827598`; membership
CI `43430827648` and reminder CI `43430827853` passed. Published HTML and versioned
bytes matched. Desktop/phone fixtures passed GPS, forms, optional email controls,
owner-only Manage, the member list below the map, guest chat, QR and token
confirmation/opt-out (including changing tokens in the same tab). Real account
phone checks passed geofence creation/chat/Manage and all nine Pro app gates.

The automatic minute Cron delivered three messages to Resend's designated test
recipients: owner share email with valid PNG QR, alternate-email confirmation,
and grouped arrival/departure email. Provider receipts were recorded; this verifies
provider acceptance, not a human inbox. Verification enabled alerts, opt-out
prevented later events, and repeat activation did not resend the welcome. All
disposable users/circles/preferences/jobs/chat records were removed. No fixture
email went to visitors. Existing Stripe, Supabase, sign-in and reminder secret
fingerprints are unchanged; only the earlier private-app release changed, with
two new geofence email settings added. Free Pro and geofences remain enabled;
no active paid subscriptions or charges were created.

The deployment helper is `configure-email.py` (not `email.py`, which shadows
Python's email package). Cron activation uses `cron.alter_job`, since hosted
roles cannot update `cron.job` directly. Follow-up `98402ce` published that helper
fix and lets owners turn alerts off even if an unsaved email edit is invalid.
Pages run `43431793706` and billing CI `43431793724` succeeded; final published
HTML and versioned runtime bytes match the checkout.
No owner setup remains; SMS and physical-phone field checks remain deferred.

## 2026-11-13 - GPS center, temporary free geofences/Pro and $5 Pro price

Owner requested a GPS center button on geofence management, temporary creation
without charges for geofences and Pro, and regular Pro reduced to $5/month.
GPS requests a fresh position and fills the coordinates; map preview and
confirmation remain required. Permission denial/timeout/stale fixes keep manual
entry available. Geofences stay $10/month when regular billing is restored.

Migration 0019 adds separate temporary grants and two service-only switches.
Confirmed signed-in users activate with the existing buttons, with no Stripe
customer/subscription or paid database row. All nine protected app gates accept
server-authorized temporary Pro. Geofence pages/QR/chat retain their GPS gates.
Turning testing off removes temporary access without charging; paid/Substack
entitlements remain valid, and saved circle links can be activated via checkout.
Use `python tools/billing/testing-mode.py --disable` to restore paid checkout;
`--enable` restores free testing. No billing setup needs to be repeated.

New $5 prices were created in the existing products (test
`price_1UbJdbPylm4UechMkj6ty6Z3`, live `price_1UbJdfPylm4UechMB1GxVKGy`). Legacy
$8 prices/entitlements are retained. No active paid site subscriptions or open
site checkout sessions existed. Stripe CLI was returned to test mode.
Migration and all five functions are deployed; both free switches are ON.
Implementation `89fb2ac` published successfully in Pages run `43427810754` and
membership CI `43427810477` passed. Deployed restricted keys verified
the $5 Pro and $10 geofence catalogs/portals without a customer or charge.

Local validation passed: 91 Node checks (including shared geofence tests), real
rolled-back database ACL/ownership/activation/disable/re-enable/paid-preservation
checks, desktop and phone geofence form/QR/guest-chat/GPS/free-activation tests,
and membership/account UI checks. Private bundle repackaged/uploaded: nine apps,
45 files. Changed runtime assets/loaders use `20261113a`; root map iframe updated.
Live phone UI/API verification passed: GPS center, activation, stable page/QR,
chat, Pro activation, actual protected Moontower page, all nine menu links and
private app entries, owner isolation, idempotency and zero paid billing rows.
Disposable accounts/circles/grants/messages were removed. No Stripe request or
charge was made. Physical device field checks remain separate.

## 2026-11-12 - Geo Fence shortcut below Chat

Added the main-page Geo Fence control directly below Chat. It uses the same
44px circle, with Geo above Fence, and links to
`https://austin.chat/geofences/manage/` with `_top` so the destination replaces
the full page. No extra interaction or setup is attached to the shortcut.
The event-map generator excludes this main-page link. Main iframe and
`chat/neighborhood.css` versions are `20261112b`; other assets keep their versions.
Desktop and phone browser checks passed size, order, stacked text and actual
full-page navigation. Screenshot reviewed; public build and diff/syntax checks
passed. Public build still excludes all 45 private app resources.
Published implementation `762e5b6` through successful Pages run `43245123699`.
Live entry pages and versioned CSS match the checkout. Published 1280px/390px
checks passed dimensions, stacked label and full-page navigation to management.

## 2026-11-12 - Neighborhood businesses moved from Chat into Explore

Owner requested the main map's neighborhood business directory in Explore,
under a new closed-by-default Neighborhood Businesses dropdown. The existing
group/category hierarchy also starts closed. GPS neighborhood selection,
business-room selection, presence counts, Favorites and Day Planner checkboxes
are retained. Picking a business closes Explore to reveal its map popup.

Chat keeps the visible-user list, whole-neighborhood room selector, identity
and Visible / Chat buttons. Its message window now sits inside the card where
the directory used to be. Visibility/chat eligibility, room messages and the
backend are unchanged. Shared room wiring supports separate room/directory
containers while retaining the combined layout on other maps. The Special
Events generator preserves the tour's combined list and separate chat window.

Main-map assets and its iframe use `20261112a`. The new main-only stylesheet is
`chat/neighborhood.css`; no private app sources or billing settings changed.
Desktop (1280px) and phone (390px) browser checks passed with fixture auth and
presence: collapsed hierarchy, users/counts, inline send, room switching,
visibility, planner selections, popup/panel switching, GPS exit/return and
refresh. Light/dark screenshots were reviewed. Six chat connection/form tests
passed. The existing Special Events map suite passed all four desktop/phone
guest/member variants, including its business directory and stop-chat gates.
The public build passed and excluded all 45 private app resources; private
bundle hashes remain unchanged. No production accounts, messages or plans
were changed by testing. Physical-phone field checks remain owner-deferred.
The browser check is `tools/explore/check-neighborhood-businesses.cjs` and
accepts a deployed origin.

Implementation `32c2b89` is published through successful Pages run
`43243261069`. After deployment, all three unversioned entry pages advertised
`20261112a` and matched the checkout; all four changed versioned runtime assets
matched as well. The published main-map browser check passed at 1280px and
390px with fixture identity/presence, including selecting a visible user,
business counts, conversation send, planner selection, GPS exit/return and
refresh. Published phone screenshots were reviewed. No work remains for this
layout request; previously deferred physical-device checks remain separate.

## 2026-11-10 - Laptop handoff: resume from GitHub main

Owner is moving to another laptop. All implementation, migrations, setup and
verification scripts are committed on `main`. Live billing verification/tools
commit `bb0b1a0` was published successfully by Pages run `42840305397`.
Custom geofence checkout is LIVE at $10/month; the existing $8 Pro billing is
also live and separate. Migration 0018 and the geofence Edge functions are
already deployed. Frontend runtime version remains `20261109h`.

On the other laptop, inspect `git status`, fetch `origin`, and update `main`
with a fast-forward pull before editing. Preserve and reconcile any local
changes or divergent commits; never force-push an older laptop's copy over
GitHub. Read AGENTS.md and this newest checkpoint first. Older entries about
pending Stripe authorization or disabled checkout are historical.

Stripe products/portal/webhook and Supabase secrets are already configured in
their services. Do not recreate them or rerun `configure-stripe.py` merely to
resume work: its default mode disables checkout. Git does not transfer CLI
logins, VS Code extension settings, dependencies or private credentials. Sign
in on the other laptop only if administrative access is needed; do not commit
credentials. Selecting test mode in the local Stripe CLI does not change the
live website. Both environments were authorized on this laptop; its CLI was
left in test mode after setup.

No implementation or payment-setup step remains unfinished. The owner deferred
physical-phone GPS/chat testing for the Austin Studio Tour; physical-device
testing of custom geofence chat is also still an owner field check. Real Stripe
test-card payment/activation/cancellation, deployed live configuration and the
published phone form have passed. No real charge was made during verification.
Detailed results and the production identifiers are in the checkpoint below.

## 2026-11-10 - Custom geofence subscriptions enabled in production

Owner authorized both test and live access to the existing Stripe account.
Configured the separate $10 USD/month geofence price
`price_1UaGUGPylm4UechMpz3cKmzF`, cancellation portal
`bpc_1UaGUHPylm4UechMkAjptNME`, and signed webhook
`we_1UaGUIPylm4UechMhPdQV1yB`. Stored their settings directly in Supabase and
enabled `GEOFENCE_CHECKOUT_ENABLED`. Existing production functions and frontend
already support these settings; no runtime asset/version change was needed.
Stripe account charges/payouts are enabled. The local CLI was returned to test
mode; both environments remain authorized and production billing stays live.

Before enabling checkout, the deployed restricted live key successfully read
the fixed $10 monthly price and dedicated period-end cancellation portal.
Unsigned webhook requests were rejected and an unpaid map remained unavailable.
Repeated the live checks after enabling, then verified the published 390px form
with a real disposable signed-in account and real backend: $10 Account card,
saved draft/QR, coordinate preview, and payment button enabled only after map
confirmation. Screenshot reviewed. No Checkout request, live Stripe customer,
subscription or charge was created during live verification; all temporary
Supabase users/drafts/billing rows were removed. The preceding isolated test-card
Checkout, signed payment/cancellation notifications and 67 automated tests passed.
Physical-device GPS field testing remains owner work.

Existing $8 Pro live configuration/readiness also passed. All non-geofence
Supabase secret SHA-256 hashes matched the snapshot taken before live setup.
Corrected the verification helper to read Supabase CLI 3's hash field named
`value`, failing closed if it is missing; the earlier sandbox helper had compared
secret names with null digest values. The actual payment/cancellation tests were
unaffected. Corrected the live probe to accept a successful HTTP 204 for the
void lease-release RPC. Added a real published-phone check via
`tools/geofences/verify-live.py --enabled --browser`.

Three published entry pages matched the checkout and advertised `20261109h`.
The previous verification-tools deployment `42829699618` succeeded on retry.
The feature is now available at `https://austin.chat/geofences/manage/` and
through Account → Your own chat geofence. No further Stripe connection step
is required on this laptop while the CLI authorization remains valid.

## 2026-11-10 - Geofence Stripe sandbox verified; live authorization pending

Owner installed the Stripe VS Code extension and authorized the CLI on this
laptop. WSL CLI 1.55.9 is installed and the remote extension points to it.
Verified the existing Austin.chat account and its $8 test Pro price. The current
authorization includes test mode only; requested that the owner re-run
`stripe login` and allow live access to the same account. No need for a ChatGPT
Stripe plugin. Live $10 product configuration/activation remains pending and
the public builder still has payments disabled.

Added `tools/geofences/check-sandbox.py`: deploys separate temporary geofence
API/webhook functions, uses the existing restricted test key with QA-specific
settings, and permits only a disposable confirmed account. Real hosted Checkout
completed using a Stripe test card at $10/month. Retry reused the session; the
signed payment webhook activated only the test billing row; the live geofence
and Pro membership stayed inactive; repeat checkout opened the customer portal.
Period-end cancellation retained paid time and the cancellation webhook removed
entitlement. Unsigned requests, unauthorized users and location edits after
checkout were rejected. Temporary endpoints, webhook, Auth users, geofence and
Stripe customers were removed; test product/price/portal archived. Production
secret names were identical before and after; the newer checkpoint records the
corrected hash verification. No real charges were made.

All 67 billing/domain/HTTP tests passed. New setup scripts compile and diff
checks pass. `configure-stripe.py` now verifies live account identity and the
existing Pro catalog before creating objects, and validates webhook events/API
version. Added `verify-live.py` to exercise the deployed restricted key's reads
of the new live price/portal without a live Stripe customer, subscription or
charge; it awaits live configuration before its first real run.

Next: verify live CLI authorization, select the existing account's live mode,
run geofence configure (checkout off), run geofence live verification, activate,
and verify again with `--enabled`. Preserve the existing Pro production settings.
The isolated test-payment check is complete; do not repeat unless configuration
or code changes warrant it. Restore local CLI test mode after live setup.

## 2026-11-09 - Custom paid geofences: preview built, Stripe connection pending

Owner requested $10/month per custom geofence, account-card entry, mutually
exclusive address/coordinates, map preview, size control, permanent self-contained
page and shareable QR. Owner confirmed 10–100m diameter and automatic permanent
`/geofences/?id=<UUID>` links. UI/template/QR remain in GitHub Pages; Supabase
stores each circle and private ownership/billing state. No per-sale deployment
or GitHub write token is required. This is separate from Pro and Special Events.

Implemented `/geofences/manage/`, Account card, server-side validation/ownership,
Census U.S. address lookup, checked circle preview, checkout handoff, owner list,
permanent page, downloadable QR, and separate anonymous GPS-gated chat. Chat
checks distance/accuracy/freshness on each request, never stores coordinates,
returns no account IDs, and uses expiring presence/messages. Phone layouts put
preview beside confirmation and chat before sharing controls. Locations lock
when checkout begins; retries can resume from Your geofences.

Migration 0018 is applied; `geofences` and `geofence-webhook` are deployed.
Existing Pro functions/products/settings were unchanged. New billing has fixed
$10/month price checks, per-circle customer ownership, fenced leases/idempotency,
signed webhooks, current-state reconciliation, period-end cancellation and
server-enforced expiry. New checkout is OFF: this laptop has no authorized
Stripe CLI/connection for creating the new product/price/portal/webhook. Stripe
integration was offered, but no connection is confirmed. Do not call the feature
fully launched or take real payments yet. UI clearly allows preview while setup
is pending. `tools/geofences/configure-stripe.py` prepares configuration using an
authorized CLI without creating customers or charges; activation is separate.
Complete sandbox payment/webhook/cancellation validation in an isolated test
deployment and verify live configuration before enabling the new product.

67 new/existing billing/domain/HTTP tests pass. Database ownership, permissions,
leases, live/test separation, size limits, GPS gating, anonymous chat, send rate
and expiry checks passed in rolled-back transactions before/after migration.
The deployed API passed real disposable-account ownership/validation checks and
a Census lookup; all fixtures were removed, with no Stripe objects/purchases.
Real MapLibre/form/account/page browser checks passed desktop and phone with
fixture payment routing; repeated phone checks include guest chat and improved
mobile layout. QR was independently decoded to the exact UUID URL. Screenshots
were reviewed. GPS field testing remains owner work; browser GPS can be spoofed
and is not physical-access security. See geofences/README.md for the flow,
configuration, retention and commands. Runtime/cache updates use `20261109h`.
The public build passed and excluded all 45 private resources; private bundle
hashes are unchanged. New geofence tests also run in the existing billing CI job.
Implementation `2301c9e` is published via Pages run `42758199422`. All five
CI suites passed. Three unversioned entry pages advertised `20261109h` after
successful deployment and matched checkout bytes. All 10 changed versioned
assets and the QR library matched. The published 390px browser check passed
Account card, exclusive input modes, preview/confirmation, size validation,
fixture-only checkout redirect, stable page/QR, and anonymous chat GPS gates.
New-product Stripe configuration, sandbox payment validation and activation
remain pending; the live builder explicitly keeps payments disabled.

## 2026-11-09 - Pro Tier Apps inside Explore

Owner requested moving the main map's Pro Apps button into Explore beside
Special Events. The main stack is now Explore, Day Plan, Chat. Pro Tier Apps
is the adjacent Explore card and reuses the existing categorized app catalog,
including free entries and Favorites. Visitors can browse the catalog; all
nine paid links still require an active Pro membership. Legacy catalog maps
keep their original Apps/Media controls. Generated event markup remains aligned.

Changed runtime assets and shared loader references use `20261109g`. Nine
private bundles (45 files) were repackaged and uploaded. The public build
excludes all 45 private resources. No database changes are needed.

Validation: actual main-map browser checks passed at 1280px and 390px, including
three-button order, same-row cards, exact catalog contents, guest paid-link
restrictions, failed-load/reopen retry, section switching, Escape/focus, Day Plan
and Chat. Screenshots were reviewed at both sizes. Legacy catalog and new-section
membership fixtures pass guest/Free/Pro, expiry and sign-out access transitions.
Changed JS syntax and diff checks pass. Browser account requests were mocked;
no production customer accounts, plans or conversations were changed.
Implementation `2f0511c` is live via successful Pages run `42740145540`.
All four CI suites passed. After deployment, three unversioned entry pages
advertised `20261109g` and matched checkout bytes; all five changed versioned
assets and the private-bundle manifest also matched. The live 390px check passed
three controls, adjacent cards, full catalog, locked paid links, section switching,
Escape/focus, Day Plan and Chat. Physical-phone GPS/chat remains the separately
deferred owner check.

## 2026-11-09 - Private event stop notes, Favorites and printed notes

Owner requested notes and a Favorites button in every Art Tour stop popup,
disabled for guests with “Sign In to save”, then asked for the signed-in user's
notes in printed map callouts. Browsing and Plan popups now share a private
stop notebook. Notes/Favorites are event-only and persist across tour dates;
Favorites only filters the event's current availability results. Saving never
adds a planned visit; unfavoriting keeps the note. Existing per-day notes remain
separate and both note sources are printed, without duplicating identical text.
Long notes continue across full-extent sheets with repeated stop identification.
Preparing a print reloads saved notes and reads the current plan items so recent
visit-note edits appear. Note/account changes invalidate previews. Opening an
event Plan popup collapses the editor drawer to keep its controls accessible.
Guests cannot save or print registered notes. Unsaved drafts require Save note.

Applied migration `0017_special_event_stop_saves.sql` atomically after rolled-back
checks. RLS/registered-owner guards, event scope, independent field updates,
stale-write conflicts, validation, row limits, direct-write denial and expiry
cascade pass before and after applying. No existing user data was changed.
Account changes clear records/drafts; requests retain the initiating owner.
No note content is written to browser persistence, public chat or comments.

Runtime updates use `20261109f`; generated event HTML references the new saved
store/UI and updated print helpers. Nine private bundles (45 files) were rebuilt
and uploaded for shared loader reference changes. Validation: 120 planner/domain
tests pass. All four phone/desktop guest/member browser checks pass private
notes/Favorites, reload, filters and Plan popups. Desktop checks include clearing
saved and draft notes at sign-out, reopening while signed out, and restoring only
saved notes after sign-in. PDF checks verify saved stop notes plus newly edited
visit notes, guest exclusion, full long-note continuation, preview invalidation,
and unchanged plan/camera. Standard and three-sheet long-note PDFs were parsed
and visually inspected. The public build excludes all 45 private resources.
Implementation `ad5c907` is published by Pages run `42723338664`. All four CI
suites passed. After the deployment succeeded, four unversioned entry pages
advertised `20261109f` and matched checkout bytes. All 11 changed versioned
assets and the private-bundle manifest matched as well. The live 390px member
check passed notes/Favorites, failed-save/conflict recovery, signed-out privacy,
sign-in restoration, Plan popups, PDF download with both note sources, navigation,
reload and expiry. Account/chat/route requests used fixtures; no production
customer notes or conversations were changed. Physical-phone GPS/chat remains
the separately deferred owner check.

## 2026-11-09 - Event plan labels, printable PDFs and 3D opening

Owner requested location titles and visit dates/times beside planned markers,
a map Print button, and the Studio Tour to open tilted in 3D like the main map.
These changes apply through the shared Special Events adapter to future events.

Event Plan view adds title/date/time callouts connected to numbered markers.
They disappear in Stops browsing; the main planner keeps its existing pins.
Unscheduled visits are explicitly labelled and show selected availability when
known. The timeline cards also show the actual visit date, including overnight
visits. Labels refresh on date, title, order, arrival and duration changes.

Print map appears on the planning map toolbar and inside the event editor.
It prepares landscape Letter sheets fitted to every located stop for that day,
using the selected Watercolor/street/satellite base. Full titles and times have
separate callouts; crowded numbers offset with connectors to their exact points.
Large plans continue across map sheets while every sheet covers the full extent.
Download PDF produces a real high-resolution image PDF; Print prints just the
preview sheets. Attribution is included. Rendering/snapshots stay in browser
memory; no account/cloud writes occur. The current plan and camera are preserved.
A day/plan change invalidates the preview; map-load failure blocks output and
allows retry; cancellation/closure releases the export map and generated URLs.

The event now uses the main map's downtown opening flight, 57-degree pitch and
3D building layer. Selecting a studio retains the chosen tilt. Entering Plan
fits its stops while keeping the editor open, including on phones. Print sheets
use a flat overhead view without building extrusions for legibility.

Runtime changes use `20261109e`; the event HTML is generated from the updated
map generator. Nine private bundles (45 files) were repackaged/uploaded for the
shared loader version changes. New PDF/label helpers need no external library.
GitHub feed changes `d5514bb` and `6ffa44f` were fast-forwarded before publication.
No database migration or workflow edit is needed.

Validation: 112 planner/domain tests pass. Full event browser checks pass all
four desktop/phone guest/member combinations, including the 3D opening, label
spacing, PDF download, native print invocation, preserved plan/camera and
day-change invalidation. Phone member checks also pass tile outage/retry,
unscheduled visits, crowded multi-sheet output and cancellation. Tests use
fixture accounts/chat/routes. Downloaded PDFs parse as Letter landscape sheets;
standard and crowded Unicode-title sheets were rendered and visually checked.
The 24-stop example spans three sheets. Main planner regression checks pass
all four desktop/phone guest/member combinations. The public site build passes
and excludes all 45 private resources.

Implementation `111fd60` is live via Pages run `42716176744`. Initial run
`42714456550` timed out while Pages was syncing files; retrying that same run
failed because both attempts retained an artifact named `github-pages`.
A fresh workflow dispatch published successfully. In this situation, dispatch
`publish-site.yml` again instead of rerunning the artifact-uploading job.
The planner, billing, classifieds and dashboard CI suites all passed.
After successful publication, four unversioned entry pages advertised
`20261109e` and matched checkout bytes; all 13 changed versioned assets plus
the private bundle manifest also matched. The live 390px member browser check
passed, including the 3D opening, Plan-only labels, PDF download, print action,
preserved day/camera, navigation, reload and expiry. Account/chat/route traffic
was mocked; no production customer plans or conversations were changed.
Browser verification used Chromium desktop and phone layouts; physical-phone
GPS/chat testing remains the separate owner check deferred earlier.

## 2026-11-09 - Separate Special Event plans and 48-hour retirement

Owner found main Explore stops in the Studio Tour planner. Each Special Event
now owns its collection, independent of `main` and other events on the same
date. Guest visit keys, account caches, edit/save locks, scoped RPCs,
backup/restore and exports enforce that boundary. Frame navigation preserves
separate guest collections when moving between Explore and an event; a full
refresh still clears guest plans. Event dates and retirement time appear in
the event planner. An event backup cannot replace a main or other-event plan.

Applied `0016_special_event_plans.sql` atomically. Existing event items moved
without changing IDs, source snapshots, notes, visit schedules or day settings.
The old main revision increments to protect against stale saves. Post-migration
verification found two main collections, one event collection and zero mixed
items. Legacy RPCs expose only main plans and reject mixed writes; registered
owner RLS, revision checks and scope guards apply to current/direct calls.
Legacy browser caches partition for offline recovery, preserving unsaved edits
through explicit conflicts instead of forcing them over newer cloud records.

Owner explicitly approved removal 48 hours after final scheduled closing.
The last published Studio Tour closing is Nov 22 at 10 PM CST; retirement is
Nov 24 at 10 PM CST (Nov 25 04:00 UTC). `special-events/registry.json` supplies
browser/build metadata. The server registry generates its expiry at 48 elapsed
hours; active policies deny expired reads/writes and a verified active minute
cron deletes that event's plans/items, linked Favorites/reminders/jobs, legacy
messages/progress and registry row. Main plans, accounts and other events remain.
Event chat stays live-only. Browsers retire the event at the deadline and clear
its cache; offline device caches clear when current site code next runs.

Every Pages build excludes expired event pages/data/assigned unique assets,
removes their catalog links, and prevents folder fallback from relisting them.
The existing sports workflow triggers publication about every 15 minutes;
Actions delays can delay physical artifact removal. Runtime/server deadlines
are independent of deployment. Reusable themes/code, Git history, provider
backups and user exports are not erased. Future-event registration/refresh and
these retention limits are documented in `special-events/README.md`.

Validation: 107 planner/domain tests and 11 importer/retention tests pass.
Database migration and existing-data preservation, RLS, mixed/legacy/stale writes,
account isolation and expiry passed in rolled-back SQL transactions; checks
also passed after applying the migration. Full event browser checks pass all
four desktop/phone guest/member combinations, including independent same-date
main/event plans, notes, navigation, registered reload, exports and expiration.
Account/chat/route browser traffic uses fixtures. Main-map regression passes
all four variants. An added sign-out guard protects offline edits in inactive
collections, and frame navigation attempts the active save before switching.
The public build passes and excludes all 45 private files.

Changed assets/references use `20261109d`. Nine private app bundles (45 files)
were repackaged/uploaded successfully. No workflow file edits were needed.

Published as `d7a89e6`. Pages `42699574809`, planner `42699573591`, billing
`42699573534`, dashboard `42699573123` and classifieds `42699573605` all
succeeded. Only after deployed HTML advertised the new version, all four
entry HTML pages, fourteen runtime/catalog assets, expiry page and private-app
manifest were verified against checkout bytes. The full live phone member
regression passed, including independent main/event plans on the same date,
return navigation, account reload, filtered exports, and the expiry transition.
Implementation, database migration and deployment verification are complete.

## 2026-11-09 - Studio Tour filters and individual opening hours

Owner requested the filters from `https://atxstudiotour.com/explore/` and
explicitly removed venue/location type. The map now filters by event day,
optional visit times, all-event-hours availability, art mediums, activities,
vibe, accessibility, communities highlighted, indoor/outdoor, participant
type and family-friendly content. Time/availability and additional filters
are collapsible on phones. Search accepts exact location numbers.

Fetched all 813 public profile pages and the Explore filter definitions.
789 located profiles supply 811 participant/location associations across
all 307 existing stops. Individual schedules and filters stay attached to the
same participant at the correct location; moving groups retain distinct
location/day windows. 115 associations have no schedule, and 14 contain at
least one incomplete/invalid day. They retain their public evidence, but no
missing hours are inferred. The default day results are 258/256/250/249 stops;
an explicit checkbox includes schedules needing confirmation. Evening hours
are retained. All coordinates, stop identities, existing titles/addresses,
chat geometries and GPS membership behavior are unchanged.

The planner snapshots matching participants, chosen filters and narrowed
opening windows. Build, conflict checks and travel fitting preserve closed
gaps. Unknown event hours require confirmed manual availability; unavailable
or out-of-hours scheduled visits are excluded from exports. Calendar details
retain the selections. Changing discovery filters keeps already selected
visits; Update planned visit explicitly applies new choices. Older saved
event sources refresh on the active day, preserving visits, notes and locked
arrivals while flagging current availability problems. Ordinary planner
business/meeting behavior remains covered by its existing checks.

The standard-library `enrich-studio-tour.py` helper stores raw public pages
outside the repository and updates only factual metadata. Full location
reimports require its cache to avoid discarding schedules. See Special Events
README for schema, source limitations, refresh and verification commands.

Local checks: all 101 planner/domain tests and seven parser tests pass. Event browser tests pass
desktop/phone and guest/member for filters, date exceptions, unknown hours,
time windows, plan updates, calendar exports, Watercolor and GPS/chat controls.
The phone member run also verifies an old saved visit is retained and flagged
when its day is no longer available. The main-map planner browser regression
passes all four combinations. Account/chat/route operations use fixtures.

Changed event, planner and loader assets/references use `20261109c`; all nine
private apps were repackaged and uploaded with the new shared references.
GitHub's automatic sports update `24fcf63` was fast-forwarded before edits;
the newer Explore data refresh `31d0f8c` was also incorporated before publishing.
The public build passes and excludes all 45 private app files.

Published as `716cad1`; Pages run `42692872043` succeeded, along with planner
CI `42692872203`, billing CI `42692872010`, dashboard CI `42692872040` and
classifieds CI `42692872536`. After the deployed HTML advertised `20261109c`,
all four entry HTML pages, twelve changed runtime/catalog/data assets and the
private-app manifest matched the checkout's bytes. The full phone member
event regression passed against the live site, including filtered calendar
export, updating a planned visit and retaining/flagging an older saved visit.
Implementation and deployment verification are complete.

## 2026-11-09 - Studio Tour Watercolor background

Owner chose an Austin copy hosted with the site, with no new subscription.
The Studio Tour now selects Stamen Watercolor through event metadata. Its
701 unmodified JPEG tiles (7.3 MiB total, requested only as needed) come from
the Cooper Hewitt, Smithsonian archive, which explicitly permits reuse with
Creative Commons attribution. The archive lacks the CORS headers MapLibre
needs, so the bounded copy is served from our own origin. Zooms 0–14 cover
the event plus a margin; zoom 15 has gaps in the historic archive. The source,
licenses, coverage and reproducible cache command are recorded in
`special-events/tiles/stamen-watercolor-austin/README.md` and `tiles.json`.

Current street/place labels overlay the historic 2012–2014 painting. Close
street zooms gently fade the painting to show current road/building detail.
Map layers → Background switches to Street map without changing the camera,
stops or plans; satellite and 3D still work. A watercolor request failure
restores the street base, with an explicit retry through the selector. Future
Special Events can choose their theme through the same metadata/module;
events without a theme retain the street map. All 307 stops/geofences and
chat behavior are unchanged. Owner will do the physical two-phone chat test
later; no further real-service chat test is part of this visual change.

Changed event/catalog/frame assets use `20261109b`. Private app bundles remain
unchanged. Incorporated GitHub's automatic ticker update `57a386a` locally
before publishing; no force push. Seven event-domain tests and full cache
coverage/JPEG validation pass. Desktop/phone and guest/member browser checks
pass with real hosted JPEGs, street/satellite/3D switches, camera preservation,
attribution, a simulated tile outage/retry, and the existing 307-zone,
planner/export and GPS/chat fixtures. Reviewed overview and close-up images.
The public Pages build passes and excludes all 45 private app resources.

Published as `e001975`; Pages run `42679893493` succeeded. After the deployed
HTML advertised `20261109b`, both changed HTML pages and all seven changed
runtime/catalog/data assets matched the checkout's bytes. A hosted JPEG's
bytes and MIME type also matched. The complete phone guest browser regression
passed again against `https://austin.chat`, including the artwork and simulated
outage/retry. All account/chat/route actions used fixtures. The local checkout
and GitHub contain the finished theme and its source documentation.

## 2026-11-09 - Studio Tour chat verified against the live service

Owner asked to verify anonymous chat among people physically inside the same
stop, before approaching tour hosts. These behaviors apply to future Special
Events maps through the shared chat engine and event stylesheet.

Found a real teardown race that fixture-only tests missed: a GPS failure followed
quickly by a new fix could rejoin the same SDK channel while its earlier leave
was still pending. The SDK rejects adding Presence callbacks after subscribe,
leaving the visitor in the correct stop with an unusable channel. Teardown now
finishes before a replacement joins. Presence waits for subscription; connection
loss removes event peers and prevents sends until reconnection. Event sends
require server acknowledgement, failed submissions retain their draft, and
late replies cannot affect another room/new draft. Phone participant names now
wrap instead of being cut off. No geofences, database schema or membership
behavior changed. All cache references for changed assets use `20261109a`.

Added six deterministic connection/form regressions; five fail against the
previous code, and all six pass with the repair. All 91 planner/domain tests
pass. The manual `tools/special-events/check-chat-live.cjs` uses independent
phone/desktop contexts, simulated GPS and a random test event namespace with
real guest Auth, Presence and Broadcast. With local repaired assets it verified
two-way messages, a three-person room, no replay to late arrivals, separation
between shared-building stops 47/233, hiding/exit, rapid GPS recovery, stationary
presence beyond 60 seconds, failed offline sends and delivery after reconnect.
Every disposable guest was removed; no messages went to real event rooms and
no saved-message API reads/writes were made. This does not replace a field
check with actual phones/indoor GPS and does not establish crowd capacity.
The complete event-map and main-map planner browser regressions also pass
at 1280/390 pixels for both guests and members. The new connection tests run
as part of the existing planner test suite. The laptop's GitHub token cannot
edit workflow files, so the existing CI triggers are unchanged.

Outreach wording must say **visible participants at the same stop**, and
describe a live group conversation. Guests get random names without registering;
members use their existing public profile. Hosts must keep the map open and
Visible at their stop; there is no inbox for later/offline replies. Browser
GPS checks remain client-side, not proof of physical presence. The unrelated
dashboard sign-in-form follow-up remains open.

Published as `4de991b`. Pages run `42675184981`, planner CI `42675184994`
and billing CI `42675184511` succeeded. The nine private app bundles were
uploaded before publishing; the Pages artifact excludes all 45 private files.
Checked the event HTML's `20261109a` references after deployment, then verified
all seven changed application/catalog assets match the committed bytes.
The full live-service check passed again against deployed assets, including
browser closure removing the departing visitor. Its four temporary guests
were deleted. Implementation, automated verification and deployment are complete;
an actual two-phone field check remains advisable before broad host outreach.

## 2026-11-08 - Per-stop chat geofences and tour drawer

The Austin Studio Tour now has 307 separate, non-overlapping chat zones.
The City of Austin 2023 building-footprint layer supplies 301 matches; six
unmatched pins use approximate 40 m zones. Buildings get about 20 m of
surrounding space where available. Adjacent outdoor areas are divided by
building proximity. Shared-building pairs 21/104, 47/233, 97/100 and 132/135
are divided between their stop pins, honoring the owner's no-overlap rule.
The source, approximation flags and rebuild command are in
[Special Events](../special-events/README.md). No source downloads are stored
in this public repository. The builder verifies building coverage, pin
containment, valid geometry and all-pairs nonintersection after serialization.

Event chat now uses `event-<event-id>-stop-<stop-id>` channels. A Visible
visitor must have a fresh, sufficiently accurate GPS fix inside a zone to
subscribe. Chat requires another visible person at that same stop; expired
presence and messages from other rooms or departed peers are excluded.
Event messages are live-only for guests and members, with no history reads
or writes. Leaving, hiding, denied/inaccurate GPS or a 60-second stale fix
clears and leaves chat. Stationary visitors refresh GPS every 25 seconds.
This is browser GPS gating, not server verification. The main neighborhood
and business chat retains its separate channels and history. The event's
business directory still follows the GPS neighborhood; selecting a business
does not change the stop room. No database migration was needed.

The tour card is a left-side drawer with an arrow to open/close it; its handle
stays available when closed. Stops opens the same drawer. Street-level maps
show purple chat zones and a green outline around the current GPS zone.
Existing dates, planner, routes and calendar/map exports remain available.

Assets and references use `20261108b`. Regenerate the event page with
`node tools/special-events/make-map.cjs` after shared markup changes. The nine
private Pro apps were repackaged for the new shared script references;
continue to publish using the workflow that excludes those private files.

Validation: 85 planner/domain tests and 53 billing tests passed, including
307 unique pin-to-zone assignments, all-pairs zone separation, stale GPS and
old-channel callbacks, current peer checks and live-only member messages.
Event browser tests passed desktop/phone and guest/member combinations for
drawer controls, same-building stop changes, independent GPS businesses,
visibility, accuracy, expiry, route rendering and calendar/map exports.
Main-map planner browser regressions passed all four combinations. Account,
chat and route actions used test fixtures; no real messages or accounts were
created. The earlier dashboard Account-form follow-up remains unrelated.

## 2026-11-08 - Special Events and Austin Studio Tour

The main Explore card now has a Special Events category with a link to
`/maps/austin-studio-tour/`. This public map has Stops, Plan and Chat controls,
the existing MapLibre basemap/display controls, and the complete day planner,
route estimation and Google/Apple calendar/map exports. No Explore button is
shown on event maps. Configured event bounds replace the main map's extent.

The first dataset contains all 307 currently published organizer map stops,
with official numbers, coordinates, addresses and source links. The organizer's
fully loaded index supplies named artists/hosts at 303 stops; the other four
use the official address. Tour dates are November 14–15 and 21–22, 2026,
11 AM–5 PM, verified against the homepage, not the stale 2025 Explore SEO title.
Artist attendance can vary; the UI and exported plans retain the source link
and attendance note. No nonexistent pins were added to match the publicity's
309-location count. The source snapshot and refresh procedure are documented
in [Special Events](../special-events/README.md).

Event chat uses `event-austin-studio-tour-2026` across the configured event
area. GPS independently updates the neighborhood business directory. Picking
a business opens its map details without changing the event conversation.
Leaving coverage or losing location permission leaves chat. Visibility is
still opt-in; its hint now explains event-wide sharing. Ordinary maps keep
their neighborhood/business rooms. Late chat histories and channel callbacks
cannot restore an abandoned room. No database migration or real account,
message, subscription or billing mutation was required.

The event page is generated from `chat/index.html` by
`node tools/special-events/make-map.cjs`; regenerate it after shared markup or
asset-version changes. Event data and UI use `20261108a`, as do changed shared
scripts and their references. The nine Pro apps were repackaged/uploaded to
refresh shared chat references; preserve workflow-only Pages publishing.

Validation: 82 planner/domain tests and 53 billing tests passed. The event
browser harness passed 1280px/390px guest/member cases, real MapLibre pins,
search, dated selections, rendered route lines, actual two-stop ICS downloads,
Google/Apple Maps links, GPS directory changes with unchanged event room,
outside/denied-location chat gating, themes and the main Explore link. Existing
main-map planner browser regressions passed all four guest/member/viewport
combinations. Browser account, chat and routing operations used fixtures.

The previous dashboard Account-form loading check below is unrelated and
remains a follow-up; no sign-in code was sent during this work.

## 2026-11-05 - Private dashboard and manual Substack membership bundle

Owner requested reciprocal membership: $8/month site Pro includes paid Austin.chat
Substack access, and all paid monthly, annual or founding Substack plans include
site Pro. After checking the public $5/month Substack plan, the owner explicitly
chose to retain Substack's current prices. Do not change them to match the site.
Fulfillment and renewal reconciliation are manual, using the same
confirmed email. Substack comps are still performed in its publisher dashboard.
The Account panel explains the bundle and manual activation. No Substack
subscription, email, Stripe customer or charge was created by this work.

The owner-only page is `/dashboard/` (the requested `/dashboard` redirects there).
It has no menu, footer or catalog link and requests no search indexing. The
owner's specified existing confirmed account is authorized in a private database
allowlist; the email is not stored in repository source. Every report and grant
RPC verifies that account and its current confirmed email. Anonymous and ordinary
members cannot read private reports or grant access.

The dashboard has 18 database reports and 120 site datasets, search/date/room
filters, paged previews, and Excel exports of all matches up to 50,000 rows.
Larger reports require narrower filters, with no silent partial export. It
includes saved Neighborhood chat within its existing 30-day retention; guest
broadcasts and already-purged messages are unavailable. Other reports cover
memberships, comments, classifieds, plans/items, favorites, preferences,
reminders/delivery, tour progress, parcels, zoning, markets and source freshness.
Substack access controls grant/renew until a verified date or revoke only that
source. A current Substack grant blocks a new site checkout. Existing purchases
are never canceled automatically; review overlapping subscriptions manually.

Migrations 0014 and 0015 are installed. Billing functions are deployed with
live settings preserved. Grants and audit history are private; Stripe state and
Substack grants are independent, with automatic expiry and email re-verification.
No live member was granted or revoked by this work. Owner authorization is the
only lasting account change. Client shell and membership UI use `20261105b`.
No private Pro source file changed, so the private app manifest stays unchanged.

Validation: 53 billing Node tests, four private-report Python tests, four XLSX/
page tests, desktop/phone membership and dashboard checks, full Account fixtures,
and rolled-back hosted SQL checks passed. The dashboard check downloaded and
read an actual 521-row XLSX, verified text/formula safety, pagination, flattened
business data and in-flight sign-out. Hosted disposable-user API checks proved
guest/member denial, owner report access, Substack Pro/private-app delivery,
duplicate-checkout rejection, grant revocation and immediate admin revocation.
All temporary Auth accounts, grants and related history were removed.

Release `9f8ed85` passed Pages (42058171250), dashboard (42058171268), billing
(42058171180), planner, classifieds and reminder CI. The named owner is the sole
dashboard administrator; zero disposable dashboard users remain.

HANDOFF: owner is shutting down and asked to save everything. Published homepage
and `/dashboard` redirect/HTML were verified after Pages completed. The live
guest dashboard gate works and opens the real Account dialog. The immediate
post-open assertion found the email field disabled; this may be provider/config
loading, since the check did not wait for it. Next session: wait for the Account
sign-in form to finish loading on desktop/phone, confirm it becomes usable,
and fix it if needed. Do not send a sign-in code without the owner's request.
Local dashboard/account fixtures and hosted API authorization checks passed.

See [dashboard operation](../dashboard/README.md) and
[Substack fulfillment and renewal instructions](../billing/SUBSTACK.md).

## 2026-11-05 - Rename the map button to Pro Apps

The home map and shared map controls now display **Pro Apps**, with matching
accessible names and signed-in/guest tooltips. Membership behavior is unchanged.
The changed catalog/control assets, map loader references and home iframe use
`20261105a`. The nine private app entry files were repackaged to carry the new
loader version; commit the generated manifest with the source and retain
workflow-only Pages publishing described in the previous checkpoint.

Validation: desktop (1280 px) and phone (390 px) browser checks confirmed both
button variants, accessible labels, guest tooltips and text fit. The existing
catalog browser check passed guest, Free, Pro, expiry and sign-out cases.
JavaScript syntax and diff checks passed. The Pages build excluded all 45
private files and validated the refreshed manifest.

## 2026-11-04 ? Free / Pro is live; hosted Pro apps protected

The owner approved protecting direct hosted app access. The completed release
is on main (`5392508`) and live on https://austin.chat/. GitHub Pages now uses
**workflow** publishing through `Publish Austin.chat`; never switch back to
legacy publishing because that would expose the protected app files again.
The existing domain is unchanged and automated feed updates still republish.

There are exactly two plans: Free and Pro ($8 USD monthly). Apps is gray and
disabled for guests. Signed-in members can open it; the nine selected paid
entries carry ?Pro App? and are gray/unlaunchable for Free members. These are
Austin 1885, Moontower Walking and all seven Shopping Apps entries. The app
directory and canonical wrappers also enforce membership. Existing map and
catalog controls pass desktop and phone regression checks. Changed client
assets and all references use `20261104e`.

**LIVE PAYMENTS ENABLED.** The owner saved the restricted live key, which was
verified through the deployed backend. Stripe account charge readiness and the
800-cent monthly price passed launch checks. `BILLING_MODE=live`,
`BILLING_CHECKOUT_ENABLED=true`, `BILLING_TEST_USERS=none`. The live webhook
`we_1UYDmVPylm4UechMuIWp8adD` is enabled; test webhook
`we_1UYDGcPylm4UechMvq87q7Al` is disabled. Test credentials are retained.
The CLI remains in test mode, independently of the production runtime.
No live Stripe customer, subscription, purchase or charge was created by this
work. Hosted sandbox payment, actual signed webhooks and cancellation had
already passed. Do not run the production sandbox harness after launch;
use a separate test deployment. Automatic tax collection was not configured.

The nine Pro apps have 45 private files (864,562 bytes) in Supabase Storage.
Each `pro-app` function request checks confirmed live Pro membership. A
restrictive Storage policy denies direct anon/authenticated access even with
broad permissive policies. The service worker preserves app URLs/imports,
holds login tokens in memory only and never caches private resources.
GitHub remains a **public source repository** as discussed with the owner;
this protects hosted app access, not downloadable GitHub source/history.

Verification for `5392508`: billing CI `41940022389`, classifieds
`41940022371`, reminders `41940022284`, planner `41940022695` and Pages
`41940022297` all passed. The 49 Node tests include Stripe signatures and
Pro asset checks; CI also checks SQL permissions/leases and Storage policy.
Published HTML was verified before fetching the new versioned assets.
All 45 raw hosted resources and nine older query-string entry URLs return 404.
Hosted API checks rejected guest/Free and direct Storage requests, delivered
all 45 matching resource hashes/MIMEs for Pro, then rejected the same retained
login token after revocation. Live browser checks opened **all nine apps**,
verified nine enabled Pro links, sign-out gating and an empty CacheStorage.
The published phone Free flow also passed: Apps opens, nine paid links are
locked, exactly two plans appear, the $8 upgrade button is enabled, and the
direct app wrapper stays gated. Temporary Auth accounts and synthetic
entitlements were removed; SQL confirmed zero tagged test users and zero
live/test billing associations. No emails were sent. Desktop/phone membership
and Account fixtures also passed.

Maintenance: after changing Pro sources/catalog, run
`python3 tools/billing/package-apps.py --upload`, commit source and generated
`billing/pro-assets.json` together, then publish. Build refuses a stale
manifest. New app types may need their resources added to the packager.
`check-private-apps.py --browser` runs manual hosted checks. The updated
`verify-live.py --enabled --browser` checks Free membership and its upgrade
UI without changing activation settings or making a purchase.
See [billing/README.md](../billing/README.md) for current operations.
Older checkpoints below are historical; their pending setup statements
are superseded by this completed launch.

## 2026-11-04 — Free / Pro membership setup in progress

Latest checkpoint: the owner saved `AUSTIN_STRIPE_KEY` in Supabase. Its test-mode
permissions were verified with actual hosted Stripe Checkout and portal sessions.
A Stripe test-card payment succeeded; a signed webhook granted test Pro, while
the browser's live membership RPC stayed Free. Repeat checkout reused its session;
an active subscriber was sent to the portal. Period-end cancellation retained
paid access, and immediate cancellation's webhook removed Pro. All synthetic
Auth users and Stripe customers were removed; checkout is disabled again and
the test allowlist is `none`. No real money moved. The test webhook is now enabled.
The manual harness is `tools/billing/check-sandbox.py` (never ordinary CI).

The Account panel now has Free and Pro ($8/month), current membership,
upgrade/manage-billing actions and cancellation timing. It rechecks the server
after a Stripe return, never trusts the return URL, clears state on account
switch/sign-out and retries brief webhook contention. Test Pro cannot unlock
live membership. Ordinary members see “Pro sign-up is coming soon” until launch.
The shell, account script and new membership assets/references use `20261104d`.
42 Node tests, desktop/phone UI fixtures and full Account-dialog integration
fixtures pass. The shared billing runtime was redeployed to support separately
staged live credentials; all hosted database preflight fixtures rolled back.

Live portal `bpc_1UYDmUPylm4UechM0BBIEx3p` and live webhook
`we_1UYDmVPylm4UechMuIWp8adD` are prepared. The live webhook is DISABLED.
Its signing secret and portal ID are already stored in Supabase as
`AUSTIN_STRIPE_LIVE_WEBHOOK_SECRET` and `AUSTIN_STRIPE_LIVE_PORTAL`.
This was the first live portal configuration, so Stripe automatically marked
it as the default; no preexisting configuration was replaced. Preparation is
reproducible through `tools/billing/prepare-live.py`, which restores CLI mode.
The active runtime and CLI remain in test mode. No live customer, subscription
or charge has been created.

NEXT REQUIRED CREDENTIAL: the owner was asked to save a restricted live key
as `AUSTIN_STRIPE_LIVE_KEY` in Supabase, retaining the test key. Requested scopes
match the verified test key: Customers, Checkout Sessions and Customer Portal
write; Prices, Subscriptions and Invoices read. Check whether it was saved
before asking again. Finish the requested Apps states and direct-entry access
handling before enabling live checkout; those changes remain pending. Tax
configuration remains unspecified. The older setup history below records how
this point was reached; its pending-key/deployment statements are superseded.

Owner requested exactly Free and Pro ($8/month), with the paid tier set up
first. They confirmed an existing Stripe account. The site has Supabase
sign-in but no membership billing integration. A Stripe integration is
available and was suggested. Stripe CLI
1.55.8 is now installed and working on this Windows ARM laptop using the
official Windows x86_64 executable (published checksum verified); the npm
wrapper was incompatible and was removed. The executable is under
`%LOCALAPPDATA%\Programs\StripeCLI` and its folder is on the user PATH.
`stripe agent setup --client codex --yes` succeeded and status confirms the
Stripe plugin is installed for Codex CLI. Browser authorization succeeded for
both test and live modes. `stripe whoami --format json` and catalog reads
confirmed access. The grayed-out authorization button did not require another
attempt. Do not print CLI credentials/configuration.

Created and retrieved the sandbox Austin.chat Pro product
`prod_VZLVebM4SPstbL` and monthly USD 800-cent price
`price_1UYCoYPylm4UechMfDQJur0b`, lookup key `austin_chat_pro_monthly_usd`.
The sandbox catalog had no products. No trial or signup fee was added. Calls
use `2026-10-28.endive` per request without changing account-wide API settings.
Also created and retrieved live product `prod_VZLfx6PwAYLksw` and price
`price_1UYCyLPylm4UechMwGuCKwdH`, with the same USD 800-cent monthly settings.
The live catalog was checked for existing Austin.chat products/prices first.
The CLI is currently in test mode after explicitly switching to the authorized
sandbox. In the new CLI, omitting `--live` does not switch modes.

Owner defined Pro benefits: Austin 1885, Moontower Walking, and all apps in
the current Shopping Apps group. Those nine catalog records now carry
`requiredPlan: "pro"`; future paid apps can use the same field. In the Apps
panel, append the exact words "Pro App" after each paid app name, gray out
those entries for Free members and enable them for Pro. The catalog metadata
is preparatory; the existing renderers do not yet apply labels or restrictions.
The Shopping Apps group includes all seven report records, including its
Recreation and Dining entries. See the billing notes for the exact list.

[Billing setup notes](../billing/README.md) record the agreed tiers, product
configuration and remaining integration work. Both Stripe products/prices exist;
no checkout session, customer, subscription or charge has been created.
Tax settings remain unconfigured.

Prepared migration `0012_billing.sql` and Edge functions `billing` and
`stripe-webhook`, using Stripe SDK 23.1.0 and the current API version. They
verify registered identities and webhook signatures, isolate test/live
entitlements, fix price/customer/redirect choices on the server, reuse
checkout sessions, and reconcile current Stripe state under fenced account
leases. A successful redirect never grants Pro. Default checkout is disabled.
The 33 Node tests pass, including actual SDK signature verification. PostgreSQL
permission and lease tests passed in billing CI run `41930400705` for commit
`932cc32`; email reminder CI run `41930400738` also passed. Local module
syntax, Python helper compilation and diff checks passed. The backend
foundation is committed and pushed; no browser assets changed.

Supabase CLI 3.0.0 authorization is now complete on this laptop. Access to the
existing project was verified. `tools/billing/configure.py --deploy` passed
the hosted SQL preflight with rolled-back fixtures, installed migration 0012,
and deployed only the new `billing` and `stripe-webhook` functions. Both are
ACTIVE (version 2), with handler-level auth/signature checks. Endpoint checks
passed: unauthenticated checkout 401, foreign origin 403, unsupported method
405, unconfigured webhook 503. No sign-in codes or credentials are in the repo.

Created test portal `bpc_1UYDFWPylm4UechMi7mK5NgH` for invoice history, payment
method updates and cancellation at period end. This was the first portal in
the empty test catalog, so Stripe automatically marked it as the test default.
No existing configuration was replaced; no live portal was changed/created.
Test webhook `we_1UYDGcPylm4UechMvq87q7Al` is created and DISABLED until the
runtime key is configured. Its signing secret was captured directly into
Supabase without printing or committing it. Supabase now holds
`AUSTIN_STRIPE_WEBHOOK_SECRET`, `AUSTIN_STRIPE_PORTAL`, `BILLING_MODE=test`,
and `BILLING_CHECKOUT_ENABLED=false`. Reproducible preparation helper:
`tools/billing/prepare-webhook.py` (syntax checked).
Saved as `a16da53`; billing CI `41931362481` and Pages deployment
`41931362248` passed. Re-running the helper reused the existing disabled
webhook and preserved its secret. No browser assets changed.

Remaining credential: `AUSTIN_STRIPE_KEY`. The owner was asked to create a
restricted test-mode key in Stripe and paste it directly into Supabase Edge
secrets, never chat. Requested runtime scopes: Customers, Checkout Sessions
and Customer Portal write; Prices, Subscriptions and Invoices read. Verify
scope sufficiency with a real sandbox checkout once saved. Test users also
need explicit `BILLING_TEST_USERS` IDs before testing. No UI, checkout or paid
restrictions have been enabled. See billing notes for the launch sequence.

Next, the Apps button should be gray/unavailable for signed-out visitors and
open normally for signed-in Free or Pro members. Those button states and the
per-app labels/gray states remain pending the billing integration. Direct app
URLs and public static assets must be considered when enforcing paid access;
disabling menu links alone is not an access boundary. The owner requested the
paid tier first, so restrictions have not been activated on the live site.

## 2026-11-04 — Classifieds footer follows the ads

Owner reported the page bottom appearing inside classified ads. Standalone
classifieds pages inherited the map frame's fixed body height and shrinking
main area, allowing long content to overflow beneath the ticker/footer.
Scoped classifieds CSS now lets the body grow and prevents the main content
from shrinking below its ads. The ticker and social footer follow all content;
short pages still fill the viewport with the footer at its bottom.

The new browser layout checks reproduced the overlap before the fix and pass
afterward at 1280px/390px: signed out, empty category, one ad, owner editor,
directory and 22 ads after pagination. Existing fixture CRUD, account isolation,
sorting, drafts, conflicts and sign-out checks also pass. Screenshots reviewed;
JS syntax and diff checks pass. No production records were changed.

The stylesheet, frame/return loaders and their page/template references use
`20261104c`; other asset versions remain unchanged. Published as `00230e4`.
Pages run `41920932606`, classifieds CI `41920933383` and planner CI
`41920932904` succeeded. Root/chat, directory and all eight category pages
advertised the new version before assets were requested; all three changed
assets match committed bytes. Live guest/member browser checks, including
every footer scenario above, passed at desktop and phone sizes. Publication
and verification are complete.

## 2026-11-04 — Larger, clickable Explore icon circles

Owner found the bare category icons difficult to see and tap. Each icon now
sits inside a solid white circle with a gray border and heavier colored lines,
using the same category paths and colors. The 48px symbol bounds make the
entire white circle clickable. Shared-venue counts sit at the upper-right edge;
popups are offset beyond the enlarged circle. Existing clustering is retained.

Local desktop/phone browser checks pass all six rendered icons, actual clicks
and touch taps on the white space near circle edges, shared-venue popups,
satellite/dark styling and style reloads. Screenshots reviewed; changed JS/CJS
syntax and diff checks pass. No production account/data requests were made.

Changed scripts and their direct/dynamic/template references use `20261104b`:
Explore, the shared map loader and the return-to-chat loader; the homepage
iframe query is also bumped. Other application files retain their versions.
Published as `5e63fea`. Pages run `41919625202`, classifieds CI `41919626071`
and planner CI `41919626117` succeeded. Root/chat HTML advertised the new
version before assets were requested; all three changed JS files match the
committed bytes. Live desktop/phone checks passed every category's circle-edge
click/tap, shared-venue details, satellite/dark styling and style reloads.
Publication and verification are complete.

## 2026-11-04 — Explore organization and category map icons

Owner requested four main-map controls on the right: Explore, Day Plan, Chat
and Apps. City Hall and Classifieds now live as cards inside Explore. GPS and
Map are native-size square controls under zoom/compass on the left; Map opens
the existing layers/view/extent box. The chat and phone Apps panels leave the
left controls accessible. Other maps retain their control columns.

City Hall uses a dropdown for its four existing categories, retains district,
board and search filters, and adds date sorting. Classifieds has its eight
categories with counts, newest/oldest sorting, and the existing member-only
ad controls and standalone links. Explore's time buttons, All dates and exact
On date input apply to both sections. Owner confirmed past seven days for
published posts and upcoming seven for meetings/events. Zoning notices use
their hearing date; date-only records match their Austin calendar day.
Filtering and sorting preserve unsaved ad drafts. Member date choices sync
with Explore preferences; guest/reset behavior remains intact.

Owner then requested category icons in place of Explore dots. Individual
markers now reuse each card's SVG paths and color, with a white outline for
legibility. Cluster numbers and co-located-event counts/popups remain; images
and symbols recover after a style reload. City Hall/Classifieds retain their
list-only behavior. No backend migrations or production-account writes.

Classifieds sorting reads all existing RPC pages for the selected category
before filtering locally, then displays 20 matches at a time. Account/category
changes discard late results. The API's existing 10,020-ad limit is surfaced
if reached. New test coverage includes older ads beyond the first server page,
exact dates, daylight-saving changes and multi-page account races.

Validation: all 104 planner/reminder/classifieds unit tests, Explore and
City Hall model suites, JS syntax and diff checks pass. Desktop/phone fixture
browsers pass City Hall filters, Classifieds CRUD/date sorting/drafts/sign-out,
map layers and catalog isolation, all six rendered icons, meeting planning,
and email reminders. The full main-map planner regression passes for guests and
members at both widths, including GPS, rendered routes, late responses, day
switching, browser history, refresh and sign-out. Screenshots reviewed.
Published as `e549004` (implementation `b70954c`, rebased over the automatic
ticker refresh `bd6afc5`). Pages run `41917818935`, classifieds CI
`41917819699`, planner CI `41917819712`, and reminder CI `41917819720` all
succeeded. Root/chat HTML advertised `20261104a` before requesting the new
asset URLs; all 18 changed JS/CSS files match the committed bytes.
Live fixture browsers passed all six rendered category icons, shared-venue
details and style reloads, City Hall categories/date filters/sorting/layout,
and guest/member Classifieds controls at both 1280px and 390px. Test account
and database requests were intercepted; no production records were changed.
Publication and verification are complete.

This laptop's GitHub CLI is now signed in as `cityanatomyservices`, with write
access verified. For future pushes, use the GitHub CLI credential helper with
the stale VS Code askpass helper disabled if necessary. The connected GitHub
app may still use its separate account; browser sign-in does not switch it.

Changed assets and their HTML/template/dynamic-loader references use
`20261104a`. Browser checks now find installed Chromium on Windows or Linux
through `tools/browser.cjs`, retaining the `CHROMIUM_PATH` override.


## 2026-11-02 — Self-managed free classifieds

Owner requested a main-page classifieds button and category pages, then clarified:
**no email field, no automatic contact details and no content policing**. Treat
ads as public notes for signed-in members. Authors may put any contact details
they choose in the text. Keep the earlier sign-in requirement: guests see only
an account/sign-in note rather than categories, counts or ad contents.

Implemented a main-map Classifieds box after City Hall, a `/classifieds/`
directory and eight category pages: For Sale, Free Stuff, Services, Housing, Jobs,
Gigs, Community, Lost & Found. Category counts come from the database. New ads
choose a category before a two-field form: title and paragraph. One active ad per
account across all categories. Owners see their ad as an editable form; everyone
else sees plain text. Owners can change category, save, delete and post again.
No photos, uploads, email relay, phone/location fields, contact-text filters,
moderation queue or expiry. Account email is never returned by the ad API or
copied into a post. Limits are 100 title / 1,000 paragraph characters; all content
is rendered as text, including author-entered HTML.

`0011_classifieds.sql` is installed. Private schema/tables have RLS and no browser
schema/table access. Registered confirmed Auth records are required even for
reads/counts. Owner uniqueness, transaction locks, and ad ID/revision checks
prevent duplicates, cross-account edits and stale-form overwrites. Browser state
is memory-only and clears on sign-out/account changes; late responses are ignored.
No changes to existing users, plans, email delivery or other data tables.

Validation: 98 planner/reminder/classifieds unit tests; real PostgreSQL role tests
run inside a rolled-back transaction (no test ads or Auth users remain); live
anonymous RPC denial verified. Fixture browsers passed the classifieds guest and
member flows at 1280/390px, including category counts/pages, inline own-ad editing,
read-only other ads, selected contact text, literal HTML, pagination, conflicts,
delete/repost controls and sign-out. Existing map-layer and City Hall checks passed.
Asset version `20261102h`; shared changes elsewhere are cache references/navigation,
not new controls on other maps. See `classifieds/README.md` and its deployment/test
tools.

Published as `63731e3`. Pages run `41542806734`, classifieds CI (including a
fresh PostgreSQL service), and planner CI succeeded. Verified new-version HTML
before requesting `20261102h` assets; all nine changed application JS/CSS files
match the committed bytes. Home/chat/directory/all eight category URLs work.
The full guest/member classifieds browser checks also passed on the deployed
site at desktop and phone sizes with all Supabase requests intercepted. No
production ads or accounts were created by those browser checks. Work complete.


## 2026-11-02 — Day Planner integrated into the main map

The main page’s Day Plan button now opens the full Austin day Planner editor.
Removed the small launcher and the separately rendered planner map. The home
MapLibre instance stays alive through editing, discovery, old in-site links and
Back/Forward. Date selection, one plan per 5 AM–5 AM Austin day, scheduling,
conflict review, routing, entrance edits, exports and backups remain available.
The heading/close control stays visible while scrolling on phones.

Collapsing the editor keeps the selected day’s pins/routes and a small Edit day /
Explore toolbar visible. Explore, City Hall, Chat and Apps leave planning mode;
Map display controls preserve it. Planning displays only selected stops, empties
Explore sources even on late refresh, and removes chat business/people markers
including late updates. GPS centers without adding a marker or changing chat
state. Route requests pause while browsing. Day changes, removal and sign-out
clear stale routes without waiting for unrelated map sources to finish loading.

`/dayplan/`, `/myplanmap/` and `/planner/app.html` are lightweight redirects to
`/?planner=1`, retaining other query parameters and fragments. Existing bookmarks
continue working. Catalog maps retain their layouts; their Day Plan buttons now
open this editor directly. No database migrations, account changes, notifications
or real test emails were needed. Shared asset references use `20261102g`.

Local validation: 92 planner/reminder unit tests; JavaScript syntax and diff
checks; fixture-based desktop/phone checks for exports, meeting planning, City
Hall, map layers and email reminder controls. Full same-map guest/member checks
passed at 1280 and 390 pixels: selected-only pins, chat-marker suppression,
rendered routes, late results, day switching, entrance picking, GPS, browser
history, saved-account reload and sign-out. Browser fixtures block real Supabase
writes.

Published as `c37dcc4`; planner CI and Pages run `41539948551` succeeded.
Verified root/chat/legacy HTML advertises `20261102g` before fetching new asset
URLs; all 14 changed application JS/CSS files match the committed bytes. The
same-map phone guest regression also passed on https://austin.chat after deploy.
No task-specific work remains.


## 2026-11-02 — Resend connected; email reminders active

Owner reported that the Resend API was connected. Verified the deployed
configuration without reading or printing secret values: `RESEND_API_KEY`,
`REMINDER_FROM`, `REMINDERS_ENABLED` and the existing private Cron credential
are present. The public reminder availability endpoint returns `{enabled:true}`.
`austin-email-reminders` is already active on its every-minute schedule; no
activation change or secret replacement was needed.

Recent Cron invocations succeeded, and the email worker returned HTTP 200
with no failures. Existing pending jobs are scheduled in the future; none
are overdue or marked failed/skipped. No reminder has been submitted to Resend
yet, so key authorization for actual sending and inbox delivery remain
unverified until a scheduled send. No test message was sent to a person, and
no user selections, recipients or delivery times were changed or logged.
The activation instructions below are historical; the operational setup guide
now records the active state. No application code or asset-version change.



## 2026-11-02 — Email-only event reminders

Owner first requested email + SMS, then explicitly switched to **email only**.
Use the same 24-hour and 2-hour offsets for email. Only events with a published
start time qualify; do not add a phone field or any SMS setup.

Added unchecked Email reminders controls to timed Explore cards/popups and
City Hall Public Meetings. Movie cards select an individual showtime; each
occurrence is independent. Ongoing activities/opening hours, parks, all-day
listings and date-only municipal records have no reminder control. Within
24 hours only the 2-hour send is scheduled; within 2 hours new selections are
disabled with an explanation. Account → Reminders lists upcoming selections
and delivery states, with cancellation per event or for all events. Selection
is independent of the Day Planner. Mobile account tabs use two columns.

Supabase migration `0010_event_reminders.sql` and Edge functions `reminders`
and `reminder-send` are deployed. Private tables have RLS and no browser-role
grants; authenticated Edge calls own enrollment, reads and cancellation.
Recipient comes from the confirmed Auth account, and event contents/start time
are verified against fixed repository feed URLs. The worker rechecks source
freshness, cancellation and occurrence identity, skips changed/expired events,
uses locked job claims and persistent idempotency keys/payloads, and caps
retries at five attempts / 15 minutes after the intended time. Plain-text email
uses the card's contents and a simple subject. Token-based unsubscribe uses a
confirmation GET redirect to `/reminders/#token` and cancellation POST; account
cancellation verifies owner. The static confirmation page removes the token
from history and only sends after the visitor clicks; Supabase rewrites HTML
responses to plain text, so the page stays on GitHub Pages.
The active worker purges event records/payloads 30 days after each event.

**Sending is NOT active.** The existing Resend Auth SMTP key is write-only and
not accessible to Edge functions. No `RESEND_API_KEY` or reminder sender secret
was available. `austin-email-reminders` Cron is installed and paused; a private
random credential is stored in Vault and Edge secrets. One manual scheduler
invocation returned HTTP 200 / `{enabled:false}`. Readiness controls truthfully
say “Email reminders are being set up” until configuration is complete.
No real email, billing, DNS or Auth SMTP changes occurred.

Remaining owner setup: create/reuse a Resend sending key restricted to the
verified `login.austin.chat` domain and run
`python3 tools/reminders/configure.py --enable` (hidden key prompt). This saves
Edge secrets and activates Cron. The dashboard alternative and verification
steps are in `tools/reminders/README.md`. Do not ask the owner to paste a key
into chat. Actual provider/inbox delivery remains unverified until setup.

Validation: all 87 Node tests pass (73 planner + 14 reminders). New desktop/
phone browser checks pass at 1280/390 px, including stale-load protection,
save failure rollback, independent movie showtimes, popup/frame consistency,
City Hall, cancellation, unavailable sender, and sign-out privacy. Screenshots
reviewed. Live backend checks with disposable confirmed example.invalid accounts
pass isolation, denied direct grants, exact offsets, duplicate enrollment,
late selection, cross-account cancellation denial, unsubscribe and worker auth;
concurrent claims yielded one job. All fixtures were deleted (zero reminder
rows remain). No provider requests or emails were made by these checks.
The existing City Hall planner regression and selected-stop map checks also
pass both widths (guest and member for the map).
Asset revisions for changed files and every referencing page/template are
`20261102f`; test HTTP servers now serve `.mjs` with JavaScript MIME.

Published implementation `6943289`. Pages run `41508490644`, planner checks
`41508490924`, and email reminder checks `41508490954` all succeeded. Live
homepage HTML serves `20261102f`; the shared `.mjs` serves JavaScript MIME and
`/reminders/` is available. Full reminder browser checks also pass on the live
site at 1280/390 px, including explicit cancellation without sign-in. The public
backend readiness endpoint returns `{enabled:false}` as intended. Sending
activation and actual provider/inbox delivery are the only remaining setup
steps; all implementation, deployment and automated checks are complete.

## 2026-11-02 — /dayplan/ and date-only plan labels

Owner requested the public slug `/dayplan/` and removal of the "Day name,
manual allowance & backup" section to simplify the itinerary. The full frame
now lives at `dayplan/index.html`. `myplanmap/index.html` is a small redirect
with a canonical link and no-JavaScript fallback; its script preserves query
and fragment. Main/catalog planner links, Favorites fallback, standalone-engine
redirects and visit navigation now target `/dayplan/`. AustinVisit normalizes
legacy in-site URLs while retaining the guest visit and its selected plans.
Internal implementation stays under `planner/`; account/storage keys are stable.

Removed the day-name field and its settings wrapper. Each day's dropdown and
export heading use the date; `.ics` calendar names also use the date. New stored
names default to the ISO date. Legacy name fields stay compatible with existing
accounts/backups but do not appear in the UI or calendar labels. The existing
one-plan-per-date model and 5 AM–5 AM Austin boundaries continue to apply.

Manual travel allowance moved into the existing collapsed Driving & arrival
options. All-days JSON backup/restore moved into a collapsed section within
Export, with download/restore/error feedback there and working Undo. No
database migration or account data rewrite. Shared scripts, all referencing
pages/templates and both navigation frame URLs use `20261102e` where changed.

Validation: 73 Node tests and browser module syntax pass. Expanded export
browser checks pass at 1280/390 px: old bookmark/query/fragment redirect,
canonical URL, date-only labels despite legacy names, existing-date reuse,
per-date manual allowances, repeated calendar/map exports, JSON download,
invalid/valid restore and Undo, old in-site links preserving guest memory,
Back/Forward and standalone planner URL redirect. The full selected-stop map
regression passes for guests and registered visitors at both widths. Screenshots
reviewed; browser fixtures prevent production account writes.

Published implementation `2ac2ee3`; Pages deployment `41498917395` and Check
My Plan Map `41498918379` succeeded. Homepage and `/dayplan/` serve `20261102e`,
and `/myplanmap/` serves the redirect. The full expanded export/navigation check
passes on the live site at 1280/390 px. Its navigation waits now check the loaded
iframe document, since the outer History API URL changes before that document
finishes loading and Back/Forward may cancel an intermediate navigation.

## 2026-11-02 — Austin day Planner exports

Started only after completing and live-verifying the preceding map-marker fix,
as requested. Renamed the planner panel, browser/frame titles and visit-navigation
title to "Austin day Planner". The new heading Export button opens a native
modal with mutually exclusive Google Calendar, Google Maps, Apple Calendar and
Apple Maps radio choices. Users can change the destination before or after each
export without closing the dialog. Each export reads only the selected day;
the existing all-days JSON backup/restore is retained.

Researched current official Google/Apple format documentation and RFC 5545;
links and limits are recorded in `planner/README.md`. Both calendar options
download `.ics` files containing scheduled visits with edited arrivals,
durations, locations, source links and notes. UTC times preserve Austin instants
through DST; stable event UIDs, escaping and Unicode-safe folding support repeat
exports. No start time is invented. Unconfirmed durations are labeled. The
dialog shows excluded untimed/out-of-day items, import instructions and that
imports are copies rather than live synchronization.

Map options create driving-route links from source/entrance coordinates in
scheduled order, then untimed preferred order. Stops missing coordinates are
explicitly listed. Google routes split at five points for mobile-browser limits;
Apple unified URLs split at 15 points. Parts share boundary stops, retaining all
legs. Apple receives avoid-tolls; Google's documented URL interface lacks that
preference, so the dialog says to check it in Maps. Map apps calculate their own
routes; private notes are absent from these links. No external account writes,
new credentials, database migrations or backend changes are involved.

Validation: 73 planner tests pass, including nine new export tests for day
isolation, edited times, DST folds/gaps, unknown times, stable UIDs, Unicode,
escaping, entrance overrides and up to 150 stops without dropped route legs.
`tools/planner/check-export.cjs` passes at 1280/390 px: real downloads for both
calendars, exclusive choices/repeat exports, intercepted links for both maps,
day switching, live edits, empty-day states, light/dark layout, Escape and focus
return. All eight browser-download fixtures also parse without errors using the
independent `icalendar` 7.3.0 parser. Screenshots reviewed. External calendar
account imports/native Apple app execution are not automated. Asset/loaders and
navigation frames advance to `20261102d`.

The full selected-stop map regression also passes again at 1280/390 px for
guests and registered visitors. Published implementation `01b37f9`; Pages
deployment `41493388847` and Check My Plan Map `41493390393` succeeded. Both
homepage and planner HTML serve `20261102d`. The complete export browser check
also passed against the live site at 1280/390 px, including real repeated
calendar downloads and intercepted Google/Apple map navigation.

## 2026-11-02 — Planner map contains only selected stops

Fixed the planner restoring Explore categories as map layers, which displayed
unselected listings alongside planned stops. `AustinExplore.init` now accepts
`{mapMarkers:false}`; the planner opts in to list-only browsing. Categories,
filters, source details and selection checkboxes remain available. Details
expand inside the list without moving the planner map or opening map popups.
Explore creates no planner sources/layers, including on style reload or data
refresh. Planner GPS centers the view without leaving an extra marker. The
existing selected-day markers, entrance editing and route rendering remain
owned by the planner. Main/catalog Explore pins keep their default behavior.

Shared assets and every loader/template were advanced to `20261102c` where
needed, including both visit-navigation frame URLs. No data imports, database
or routing service changes. All 64 planner tests passed. New fixture-backed
`tools/planner/check-map.cjs` reproduced the bug before the fix and passes at
1280/390 px for guests and registered visitors: selected-only markers, inline
browsing and add/remove, actual rendered routes with correct endpoint requests,
style reload, GPS, empty-day switching, a late route response, return navigation,
refresh and sign-out. Main-map pin/popups also pass. Existing guest-state
browser checks pass after scoping search selectors to Explore (City Hall has
its own search); source emptiness assertions now await actual source data.
Screenshots reviewed. Browser fixtures prevent production account writes.

Published implementation `9b4380d`. Pages deployment `41491295155` and Check
My Plan Map `41491296450` succeeded. Both homepage and planner HTML serve
`20261102c`; the complete planner-map browser check passed against the live
site at 1280/390 px for guests and registered visitors.

Owner's next request, to begin after this fix is finished: rename the panel to "Austin day Planner"
and add an export dialog with mutually exclusive Google Calendar, Google Maps,
Apple Calendar and Apple Maps options. Research supported formats first.

## 2026-11-02 — Public Meetings in dated day plans

Owner requested the same Day Planner checkbox on City Hall Public Meetings,
with automatic grouping into one plan per day and a dropdown for reviewing
other days. Confirmed this collection model already exists: each plan runs
5 AM–5 AM Austin time (5:00 AM–4:59 AM displayed), following the local clock
through DST. Kept those boundaries and the existing guest/account lifetime.

Public meeting rows now mount the shared planner checkbox through
`PlanSelection.mount` and the new `PlanSources.meeting` adapter. Selecting a
meeting creates or joins its dated plan and selects that day for review; all
other days and edits remain. Unchecking removes only that meeting. Selection
is deduplicated by the official occurrence URL within its day. The existing
planned-day dropdowns and timing/conflict editor are reused. City Hall stays
on the main map only; the shared navigation/planner loaders were versioned
so all routes load compatible scripts (`20261102b`).

Published starts carry into the itinerary. The initial 60-minute duration is
explicitly unconfirmed because the city feed does not supply finishes. A
meeting with only a date routes to its announced date (not the prior day at
midnight), remains unscheduled, and asks the user to check the agenda and enter
the time. Build my day cannot invent that start; once entered, it is preserved
as an appointment during building/fitting. Existing overlap, travel-buffer and
outside-day checks continue to apply. Source links, board and location text
are retained; no coordinates or finish times are guessed. No database schema,
City Hall importer or scheduled workflow changes are required.

Validation: all 64 planner/member/session/routing/model tests passed, including
new meeting-date, stable-key, unknown-time, conflict-edit and guest/registered
multi-day persistence cases. `tools/city-hall/check-planner.cjs` passed at 1280
and 390 px: preserve today's edits, add a new future day, join more meetings to
that day, use both dropdowns, edit a duration to resolve an overlap, enter a
missing time, return home, restore checkbox state, uncheck and refresh a guest.
The existing complete City Hall browser check also passed at both widths.
Screenshots were reviewed. Browser tests block production account requests.

Published implementation `fd78c07`; Pages deployment `41483515223` and Check
My Plan Map `41483517209` passed. The homepage serves `20261102b`. The complete
meeting/planner browser scenario also passed against the live site at 1280
and 390 px, including existing-day preservation and editing conflicts.

## 2026-11-02 — City Hall on the main map

Owner requested a City Hall button immediately below Chat on the main map
only, with Explore-style cards for Public Meetings, Public Announcements,
Permits report and Development. Other maps retain their existing controls.
The new panel has a searchable list, council-district filter and meeting-board
filter. Meetings show the next seven Austin calendar days, soonest first;
citywide meetings remain relevant to every district. Meeting-room location is
never treated as the jurisdiction. Close/Escape restores focus, and opening
one map panel closes the others. City Hall does not add map pins or use any
account, GPS, persistent browser storage or database writes.

Official sources: paginated City boards/commissions and Council event calendars,
the annual Council/committee agenda index, City news, and Austin Open Data's
issued construction permits (`3syk-w9eu`), site-plan cases (`mavg-96ck`) and zoning
notices (`k2wj-4v6p`). A current unified meeting calendar was not found on the
Open Data portal, so meeting dates come directly from the city website.
Date-only meetings explicitly say to check the agenda for the time. Permits
cover the last seven calendar days; news/site-plan filings cover 30 days;
upcoming zoning notices remain through their hearing date. Development is
recent applications, not every active project. Applicant/owner/contractor
contact fields are excluded. See `chat/city-hall/README.md` for exact coverage.

`tools/city-hall/build.py` is a standard-library public-data importer. The new
Refresh City Hall workflow runs every three hours at minute 17 UTC, with a
manual trigger. Source failures retain only unexpired last-good rows without
renewing their check time/expiry; healthy sources still publish, and the job
reports failure. Meeting snapshots expire after 12 hours, other sources after
72 hours. The panel shows source freshness, retries failed downloads, and
removes expired or past listings. Initial imports succeeded for all seven
sources. No credentials or external account setup are required.

Validation: seven importer tests, model checks (Austin dates/DST, sorting,
expiry, cancellation, districts, boards, search and official URLs), and all
six existing planner/member/session suites passed. City Hall browser checks
passed at 1280 and 390 px using real city records and blocked Supabase requests;
checked card/list behavior, lazy fetch/retry, filtering, pagination, links,
exclusive panels, focus, expiration, refresh and catalog isolation. Existing
Map layers browser regression passed at both widths. Reviewed light/dark
screenshots and adjusted narrow card titles. Main-frame/module versions use
`20261102a`. Shared visit-loader references also advance to that version so
returning home from another page loads the new frame; other pages' controls
and content are unchanged.

Published implementation `d24215b`. Pages deployment `41479107253` and Check
My Plan Map `41479111249` passed. Manual Refresh City Hall run `41479152904`
passed every source and published snapshot `483a263`; its Pages deployment
`41479236766` also passed. Live main-page checks passed at 1280 and 390 px,
including every category/filter, retries, expiry, focus and unchanged catalog
controls. The live snapshot reports all seven sources healthy.

The default Git credential lacks the workflow scope. Publishing the new
workflow used the already configured cityanatomyservices GitHub CLI sign-in,
which has that permission, via a one-command credential-helper override.
No persistent credential configuration was changed.

## 2026-10-31 — A.C logo favicon

Owner supplied `Burnt Orange A.C. Circle Logo.png` (1254 × 1254) as the new
site favicon. Resized the supplied artwork with Lanczos resampling, retaining
its colors and white corners: root `favicon.ico` includes 16, 32, and 48 px
images; `favicon-16x16.png` and `favicon-32x32.png` support browser tabs;
`apple-touch-icon.png` is 180 px for phone bookmarks. All 60 public HTML
pages and maintained page/report templates now explicitly reference these
shared icons with cache version `20261031f`, replacing blank and older icons.
Regenerated framed pages with `node tools/make-pages.js`.

Validation: checked every changed HTML file for favicon-only changes and
valid asset references, decoded all ICO frames and PNG sizes, and visually
checked the 32 px icon. Chromium loaded and decoded each icon on the home,
contact, shopping app, and legacy report pages. Browser checks blocked
scripts and external requests, with no production account activity.

## 2026-10-31 — YouTube social-bar destination

Owner requested that every YouTube link in the social media bars point to
`https://www.youtube.com/channel/UC2ITzNUJIanC_vzmHZdZs9Q`. Updated the shared
footer icon in `shell.js`, plus the five legacy report social bars and their
report template (those still had placeholder links). Every page/template
loading the shared shell now references `20261031e`. The links open in a new
tab. Syntax and a complete social-icon markup/version audit passed.


## 2026-10-31 — Austin-only ZIP layer and updated Substack links

Owner supplied Austin Open Data dataset `49ja-3mqz` to replace the main map's
broader regional ZIP layer. `chat/data/zipcodes.geojson` is a complete download
of that dataset: 44 MultiPolygon features, 44 unique ZIP codes, all identifying
Austin, TX. Original geometry and properties are retained; only whitespace was
compacted (152 KB). The main Map panel loads this file and links to the supplied
dataset page. The layer remains off by default. Regional ZIP snapshots used
by other maps and council district data are unchanged. Source/download details
are recorded in `chat/data/README.md`.

Owner also changed the Substack destination to
`https://austindotchat.substack.com/` and authorized updating it everywhere.
The shared footer icon, content/Media catalog and both tour credit panels use
the new address. Tour credit display handles now read `@austindotchat`. The old
publication URL no longer appears in the repository. Other publications' news
sources are unchanged. Changed scripts, tour modules, frame references and
the shared navigation loader use `20261031d` to refresh existing browsers.

Validation: source row count, unique ZIP codes, Austin/TX attributes, geometry
types and coordinate bounds checked. The complete Map layers browser check
passed locally at 1280 px and 390 px with the new data, including actual map
rendering, city-field checks, defaults/reset, failed-load retry and unchanged
catalog controls. A separate browser check verified the new footer links on
the home, contact, shopping and both tour pages, the shopping Media link, and
both tour credit links/handles. Syntax and whitespace checks passed. Browser
checks use simulated/blocked auth and change no production accounts.

Published implementation `40cd3ff`; Pages run `41231128714` and Check My Plan
Map `41231129086` passed. Live checks confirm the ZIP GeoJSON exactly matches
the downloaded 44-area snapshot, the footer/catalog/tour modules use the new
Substack URL, and the homepage serves the new frame and script versions.

## 2026-10-31 — main-map button order and Map layers panel

Owner follow-up: the stack button now says **Map**, including its accessible
name and tooltip. The panel title remains Map layers. Only the button label
and navigation/frame cache versions changed (`20261031c`).

Owner requested this iteration on the main map only; extend it to other maps
only after the owner finishes choosing the main-map changes. The right stack
is now Explore, Day Plan, Chat, Apps, GPS, Map layers. Media is removed from
this page. The new panel contains 3D view, satellite imagery, Show map extent,
ZIP codes and City council districts. Opening it closes the other main-map
panels; opening another stack panel closes it. Escape and the close button
return focus to Map layers.

The original basemap, opening camera/tilt and neighborhood behavior remain.
The view buttons reuse the existing map handlers; Show map extent still fits
Austin flat and north-up. Boundary layers start off, load only on demand and
never persist to browser/account storage. Refresh and sign-out clear them;
turning them on does not move the camera. Existing ZIP polygons from
`datacenters/data/zipcodes.geojson` (103 regional areas) have purple dashed
outlines; `budget/data/council_districts.geojson` (10 districts) has orange
solid outlines. Both have labels and white halos; their source links are in
the panel. Existing GeoJSON files were reused without edits. The budget
council file retains polygon geometry for every district; another existing
compact copy includes a GeometryCollection, so it was not selected.

Implementation: new main-only `chat/map-layers.js` and CSS, main-map HTML and
map wiring. `catalog-menu.js` skips missing buttons so removing Media creates
no orphan panel; maps with Media retain their menu. Other maps' button order,
panels and engines are unchanged. Navigation-loader version references were
updated so returning to the main map loads its new frame. Main assets/frame
use `20261031b`; shared map UI/control template is unchanged.

Validation: syntax checks and the complete existing guest-reset browser check
passed. `tools/explore/check-map-layers.cjs` passed at 1280 px and 390 px with
actual ZIP/district data: button order, panel closing/focus, 2D/3D, satellite,
extent, both rendered boundary layers, stable camera, refresh, failed-load
retry and toggling while loading. Screenshots were reviewed in light/dark
mode. A catalog shopping map retained its old order and working Media menu
at both widths. Tests simulate authentication and make no production account
changes. The same command accepts the live site URL after deployment.

Published implementation `2902613`; Pages deployment `41229593299` and Check
My Plan Map `41229593850` passed. The homepage serves `20261031b`, and the
complete Map layers browser check passed against `https://austin.chat` at
both desktop and phone widths, including unchanged catalog controls.

## 2026-10-31 — blank main map for signed-out visits

Owner reported points remaining on the main map after refreshing while signed
out. Explore was restoring `austin-explore-v1` from localStorage for everybody
and enabling Free & cheap even for a fresh guest. Guests now start with every
Explore category off, ignore old persistent Explore settings and keep their
choices/search/filter state only in `AustinVisit` memory. Switching framed
maps keeps the current visit; refresh, reopening and new tabs start blank.
Guest plan selections already follow this lifetime and still clear on refresh.

Sign-out immediately clears Explore points, popups, search and filters, cancels
pending location callbacks and removes the guest Explore cache even when its
map is not currently mounted. Feed responses that finish later cannot enable
cleared categories. Guests ignore other tabs' persistent Explore changes.
Registered category defaults and browser/account preference saving remain as
before; the owner has not yet chosen new signed-in behavior. Other display
settings retain their existing behavior. No database or account data changes.

Validation: planner/session/member Node suites, Explore model checks and
changed-module syntax checks passed. `tools/explore/check-guest-reset.cjs`
passed in Chromium against the local homepage, including clean and legacy
guest storage, actual map-source contents, working category selections,
main map → planner → main map navigation, refresh clearing both pins and guest
plans, new tabs, ignored storage events, registered preference restore and
sign-out. Auth and feeds are intercepted fixtures: no accounts or production
data are created or modified. The blank signed-out homepage was visually
checked. Updated module, loader and map-frame references use `20261031a`.

Published implementation `9453160`; Pages run `41225676654` and Check My Plan
Map run `41225677053` passed. The deployed homepage shows the new asset/frame
versions. The same complete browser regression passed against `https://austin.chat`,
including old saved categories, refresh, tab isolation and sign-out.

## 2026-10-30 — private Explore spreadsheet and map exports

Owner requested all categories from Explore's Tonight selection and Friday's
Weekend selection for Substack research, with a map. Clarification: **manual
exports only for now**, no automatic daily/Friday schedule.

`tools/explore-export/` reuses the real Explore configuration and filtering
model. No public site controls change. The manual `Export Explore for Substack`
workflow creates a new private Drive folder and native Google spreadsheet per
run, plus numbered interactive HTML map, PNG image and GeoJSON. All collected
properties, original category variants, movie showtimes and source metadata
are preserved. Research columns E–H are blank and editable. Future exports
never replace existing research. Read `tools/explore-export/README.md` for use,
privacy, source-freshness handling and setup.

Existing owner Drive authorization is restricted to `drive.file`. A dedicated
private export folder was created and the connection is held only in the
encrypted `EXPLORE_EXPORT_DRIVE_CONFIG` GitHub secret. Google occasionally
throttles the existing shared rclone OAuth client; verification now retries
temporary quotas. Rclone says that shared client is retiring during 2026, so
it should be migrated to a dedicated Google OAuth client. This is independent
of the site's Google sign-in; do not alter Supabase credentials.

Local filtering/workbook tests passed (7 Node, 2 Python) and the existing Explore
model checks passed. Both maps rendered with numbered pins and collision-aware
label placement. Tonight draft had 102 listings/32 places; Weekend had 281/62.
Both native Google Sheets were read back through the Drive connector, including
headers, final rows, research columns, map links and imported formatting. Files
and destination have owner-only permissions. The final Tonight workflow snapshot
contains 101 listings/32 places; an earlier 102-listing draft remains in its own
folder. The decrease reflects an event ending while testing, matching Explore.

Published implementation `7fc86dc`, followed by `1e665be` fixing map-pin click
propagation and adding browser checks for popups, new-tab links and category
restore to every export. Already generated HTML maps were repaired in place
without changing their frozen data, spreadsheet contents or file links. Local
Tonight and Weekend browser checks pass. Final manual GitHub run `41146991554`
passed tests, interactive-map checks, image rendering and private Drive upload;
Pages deployment `41146940671` also passed. A preceding export run also passed.
No public export files, Google file IDs, credentials or research notes are stored
in GitHub. There is no daily schedule until the owner asks to enable one.

## 2026-10-30 — scheduled Explore and news refresh recovery

Owner reported failed Explore run `41139567416` at `09eedf6`. The local-calendar
step failed on Fallout Theater (missing calendar cards) and Saxon Pub (invalid
JSON); healthy sources and still-valid cached listings were published. Both
official endpoints returned valid calendars during the investigation. This
workflow does not use Supabase. The earlier logs did not retain the response
bodies, so their exact upstream content is unknown.

`calendar_http.py` now validates and retries these calendars and SFC Markets up
to three times, with short delays and a fresh public cache query on retries.
Logs identify the source, response size/type, retry count and recovery. Permanent
HTTP client errors are not retried. Saxon retries individual pages without
losing its date/pagination parameters. Persistent failures still fail the job;
existing per-source retention and expiry limits are unchanged.

Separately found news run `41093561825` failed to push because main advanced
while it built. Explore and news now use `tools/publish-data.sh`, rebasing and
retrying publication up to three times. Conflicts still stop publication and
no force push is used. Queued refreshes check out the latest `main` when their
job starts, rather than the older trigger snapshot; verification exposed a
conflict when a preceding run published data while the next run was queued.
News uses the same current action versions and pinned Ubuntu image as the
other maintained workflows.

Validation: 66 Python calendar tests and Explore JavaScript checks pass.
Tests cover incomplete/empty/invalid responses, bounded retries, permanent
access denials, Saxon pagination and DST, and SFC hours/cancellations.
A disposable Git remote test forced a competing push between pull and push:
the retry preserved both bots' changes. A conflicting feed edit correctly
stopped without changing the remote. Queued GitHub run `41142498661` checked
out the preceding refresh's data and published successfully; its separate SFC
source error led to the additional market retry protection.

Final Explore run `41142960884` passed every source, tests and publication;
news run `41142483420` also passed. Final data commit `0f32eef` deployed via
successful Pages run `41143092451`. Live Austin.chat GeoJSON checks confirmed
all sources healthy and 18 Fallout shows, 42 Saxon shows and four SFC market
dates. Final category totals: 36 markets, 210 comedy, 294 music and 207 combined
events/festivals. Implementation commits: `c3cbde1`, `4fd89b1`, `0456b87`,
`e66b3ed`. No Supabase changes, new paid services or owner setup are needed.
No browser assets changed; the existing cache versions remain correct.

## 2026-10-30 — place comments and consistent site/map controls

Owner asked for account-only posting on neighborhood businesses and planner
items, deliberate sharing of itinerary notes, Google directions on every
planner popup, removal of the planner's floating cards, and the main page's
frame and controls across the site. Implemented on the existing GitHub Pages
site and Supabase project; no billing changes or existing-data deletion.

Applied `0009_place_comments.sql`. `place_comments` is separate from private
plans/profiles. Stable `place:` / `explore:` keys connect a listing's popup
and planner thread. Everyone can read the safe RPC projection; only registered
users can post, edit and delete their own comments. The public projection has
nickname/emoji/text/timestamps, no email or author UUID. Database column grants
prevent author/time/source changes; RLS restricts ownership. Text is capped at
2,000 characters, 20 retained new comments per hour and 1,000 per account.
Deleting an account cascades its comments. No additional Realtime subscription,
image upload, AI update process or persistent guest storage was added.

`shared/comments.js` and CSS mount lazy, paginated discussions in neighborhood
business popups, Explore popups, planner cards and planner map popups. Posts
are text-only, authors can edit/delete, and Refresh fetches later comments.
Drafts clear on account changes, including detached popup DOM. **My private
notes** stay private. **Share note as a public comment** copies to a draft;
only **Post comment** publishes it. Popup sizing adapts to loaded comments.
For owner moderation, use Supabase's `place_comments` table; there is no new
public admin interface or automated moderation system.

Planner popups have a Google Maps directions link opening a new tab (honors a
chosen entrance). The old Fit my places / Neighborhood chat / Driving overview
cards are removed. Extents fits the itinerary, Chat opens the shared widget;
temporary entrance-picking instructions still appear when needed. Route line
cloning across iframe realms remains intact, including satellite view.

`shared/map-ui.js`, CSS and the control template apply the main map's Apps,
Media, Day Plan, Chat, Explore, GPS, 2D/3D, satellite and extents controls to
catalog maps. Zoom/compass is top left. Shopping apps now have an outer shared
frame and inner `map.html`; their filters/table/popup engine stays unchanged.
Tours retain their own progress, GPS/travel and chat behavior; extra tour
settings are grouped under Tour. Explore layers restore after a tour changes
its basemap. Maps, tours, directories, contact/content and HTML reading pages
use the Sign In/Account shell; obsolete hamburger markup is removed. Printable
reports hide the site frame in print. Old standalone map URLs lead to their
framed public page; `?standalone` keeps an engine accessible for diagnostics.
News and the Moontower demonstration now also have framed map addresses.

Shared visit navigation carries guest plans from any framed catalog app into
Day Planner without reloading the outer page; refresh still clears guests.
Deep links/test parameters pass through catalog frames. Changes use cache tag
`20261030e`; shared authentication/member assets remain at their existing tags.
`tools/make-pages.js` preserves the shopping wrappers and regenerates the
standard catalog wrappers. If refreshing generated reading documents, retain
the shared frame assets and print exclusion; the report template includes them.

Validation: 62 Node test results passed, including scheduling, persistence,
route serialization, profiles, ticker and Explore. Disposable-account browser
checks passed real comment CRUD, guest read/denied writes, owner isolation,
column/length/rate limits, literal HTML rendering, explicit note sharing,
draft reset, shared business/planner threads, Google links and actual route
rendering on phone layouts. Shared menus were checked on all seven shopping
apps, both tours, budget, AISD, data centers, models, parcels, news and the
Moontower demo. Guest selections survive catalog → planner navigation. Existing
auth checks passed real OTP verification, cloud restore, account isolation,
cross-tab/offline sign-out and simulated Google consent. No real emails sent;
test accounts and their comments were removed. Repeatable checks:
`tools/auth/check-comments.cjs` and `tools/auth/check-map-ui.cjs`.

Published implementation: `5b3641a`; GitHub Pages and Check My Plan Map passed.
Live comment/routing checks passed. Catalog, tour, reading-page frames and
cross-map guest transfer passed on the live site, including a desktop check.
The map browser check no longer intercepts planner JavaScript: an unused
interceptor could finish during browser teardown and interrupt test cleanup.
The disposable headless guests from that interrupted cleanup were removed.
The desktop visual review then found shopping filters covering the new zoom
control. Zoom now sits beside the open shopping panel; parcel filters sit
below zoom. The map UI stylesheet/loader, visit loader and affected frames
use `20261030f` for this placement fix; feature scripts stay at `20261030e`.

## 2026-10-30 — profiles, private Favorites and saved preferences

Owner approved building the proposed account features while retaining GitHub
Pages and the existing Supabase setup through roughly 1,000 registered users.
The organization is already on Pro. Initial usage was about 3.16 GB database
and 86 MB Storage; no subscription, compute, billing or email-sending limits
were changed. No parcel/routing data or owner account data was removed.

Account now has **Profile & privacy**, **Favorites**, and **Preferences**:

- Choose a unique nickname and emoji, retain a random identity, or optionally
  upload/display/delete a picture. Google names and photos are not published
  automatically. Chat offers Edit profile for registered users. Map visibility
  remains separate. The generated-name/emoji option is a pseudonym attached to
  the private account, not a promise of unlinkable activity.
- Add Favorite actions beside Explore listings, neighborhood businesses and
  catalog apps. Favorites are private source snapshots, independent of plan
  selection, with a database-enforced limit of 200 per account. The account
  list opens source links, removes items, and adds places/events to Day Planner
  using its existing date logic. Past listings are labeled for review.
- Theme, Explore categories/filters, ticker choices and navigation app sync
  across signed-in devices. Searches and GPS are not synced as preferences.
- The two tour apps use account-owned `tour_progress`; guests use visit memory
  and reset on refresh. Lighting Moontowers remains separate from physically
  visiting them. Older unscoped tour caches are not assigned to new accounts.

Applied `0008_member_profiles.sql`. Existing profile emails stay behind
owner-only RLS; the public display RPC returns only nickname, emoji and an
opted-in avatar path. The private `avatars` bucket enforces one 128 KiB WebP
per registered user. The browser crops/resizes to 256×256 and omits original
image metadata. Storage API handles deletion; no direct object-row deletion.
Fresh downloads obey visibility rules; already displayed/copied/cached images
cannot be recalled instantly. No real emails were sent during testing.

Modules: `shared/member.js` (account data), `member-ui.js` (dialog panels),
`preferences.js` (display setting sync), `favorite-button.js` (listing action),
and `member.css`. These remain independent of planner scheduling and chat
presence. Changed browser assets, map frame URLs, tour modules and shared
loader references use cache tag `20261030c`. The account panel and shell use
`20261030d` to clear closed profile previews immediately on account changes.

Validation: 60 planner/session/member Node tests and the ticker/Explore checks
passed (62 test-runner results). Browser checks with disposable accounts passed
real sign-in/code verification, guest merges, private profile/photo access,
image processing, nickname uniqueness, Favorite limits, new-browser restore,
preferences, guest reset, sign-out isolation, both actual tour pages, responsive
account layouts, and actual routing with a rendered line. Test accounts and
avatar files were removed. `tools/auth/check-members.cjs` is the repeatable
profile/Storage integration check; `tools/auth/check-browser.cjs` retains the
sign-in checks. Provider consent/email delivery are simulated in those tests;
the owner's real Google sign-in was verified in the preceding checkpoint.

Capacity details and source links are in [auth/README.md](../auth/README.md).
1,000 avatars at the cap use at most 125 MiB; the current Pro account/storage
allowances have ample room for that. This is not a 1,000 simultaneous-user load
test. Pro includes 500 peak Realtime connections, and the requested free email
sender still has separate hourly/daily quotas. The actual owner email-code
inbox-delivery check remains unconfirmed. No additional owner setup is needed
for profiles or Favorites; review them through Account after refresh.

## 2026-10-30 — owner sign-in verified; route line confirmed

The owner confirmed the repaired route line appears on their device and asked
whether their current sign-in works. A read-only check of the nominated account
confirmed a registered, email-verified Google identity, successful sign-in,
recent session activity and saved planner data. No account details, identifiers
or itinerary contents are recorded here. The actual owner Google sign-in check
listed as pending in older checkpoints is now complete; direct observation of
their browser was not available.

`node tools/auth/check-browser.cjs https://austin.chat` passed against the
deployed site: real email-code verification with disposable accounts, guest
selection merge, cloud restore after removing the local plan cache, cross-tab
sign-out, account isolation, offline local sign-out and responsive account UI.
Google popup/callback checks also passed with simulated provider consent.
The test sent no email and removed all disposable accounts. The owner's account
and plans were not modified. Google and email configuration-presence checks
also passed; actual receipt of a sign-in email remains unconfirmed.

No site code or Supabase configuration changes were required for this check.
The route fix in `15151a6` deployed successfully and rendered routes in live
phone-sized and desktop browser checks before the owner's confirmation.

## 2026-10-30 — route line display repaired after shared sign-in change

Owner reported Plan route stopped working on the phone, both as a guest and
signed in. The decisive symptom was "2 of 2 journeys estimated · 36 min driving"
with no line on the map. Supabase was responding normally: network 2 was active,
PostGIS/pgRouting were installed, and guest/registered route RPCs returned HTTP
200 with valid geometry in about 1–1.3 seconds. No database restart, migration,
network rebuild, provider change or parcel deletion was needed.

Cause: the parent-owned Supabase client introduced in `f99518b` returns geometry
objects created in the outer page's JavaScript realm. The iframe's MapLibre
worker serializer rejected those objects with "can't serialize object of
unregistered class Object". Driving times still worked; the map source had
coordinates but zero rendered route features. Reproduced against the live site.

Fix: `planner/map.js` now uses `structuredClone` at the map boundary to copy the
route FeatureCollection into the iframe's realm before passing it to MapLibre.
Shared account/guest behavior and scheduling are unchanged. `planner/map.js`,
the planner iframe URL, and the shared visit loader use cache tag `20261030b`;
all HTML visit-loader references and the page template were updated. Other
authentication assets remain at `20261030a`.

Validation: the two new tests in `tests/planner/map.test.cjs` reproduced the
worker serialization failure before the fix and passed afterward. They cover
foreign-window LineString/MultiLineString geometry, refresh/clear, and routes
arriving before the basemap. All **55** planner/session/map tests passed.
Browser checks against the fixed local code and the real Supabase backend
confirmed the visible blue line for guests and two journeys for a disposable
registered account on phone and desktop layouts. Temporary test accounts and
their data were removed. Rendering was checked with MapLibre's actual rendered
features and screenshots, not just the "journeys estimated" status.

Next owner check: refresh the planner after the release and confirm the line
appears. Signed-in plans persist; a guest who wants to retain the current day
should download it before refreshing, because guest refresh-reset is intended.
Earlier email inbox confirmation and the owner's real Google consent round trip
remain unconfirmed in this conversation; see the checkpoint below. Do not
repeat SMTP-key replacement based on the old invalid direct-password test.

## 2026-10-30 — resume checkpoint: Google and email sign-in enabled

The owner asked to save the current work and return in a few hours. Start here;
older sections below describe earlier versions of the interface. No new feature
or redesign was requested at this pause.

### Where the project stands

- Public site: <https://austin.chat>; planner: <https://austin.chat/myplanmap/>.
  GitHub Pages hosting stays, with Cloudflare managing the domain/DNS.
- Repository: `cityanatomyservices/cityanatomyservices.github.io`, branch `main`.
  Local checkout: `C:\Dev\projects\cityanatomyservices\cityanatomyservices.github.io`
  (`/mnt/c/Dev/projects/cityanatomyservices/cityanatomyservices.github.io` in WSL).
- Existing Supabase project: `aqbyxpiwugcvoephsvpm`. The site uses its public
  publishable key; management credentials and provider secrets stay private.
  Do not replace the project, remove parcels, or rebuild the routing network
  merely to resume authentication work.
- Feature commits: `4e63bc1` (temporary guests and map controls), `cb658c1`
  (Media control and Sign In placeholder), `f99518b` (Google/email-code account
  implementation), and `773d31c` (enable email with the configured Resend sender).
  Subsequent scheduled Explore/news/sports data commits are expected.
- Google is configured in Supabase and its button is available on the live site.
  Email is enabled in deployed `auth/config.json` (`emailEnabled: true`). Both
  options were checked in the live account dialog, including mobile layout.
- The owner verified `login.austin.chat` in Resend through Cloudflare. SMTP is
  configured in Supabase: host `smtp.resend.com`, port `465`, user `resend`,
  sender `no-reply@login.austin.chat`, sender name `Austin.chat`. The Resend
  API key is stored only as Supabase's SMTP password. Use Resend's free plan.
- The confirmation and magic-link templates contain `{{ .Token }}`. Email
  sign-in uses a one-time code, with no user password. Google is the only
  OAuth provider requested. Setup details: [auth/README.md](../auth/README.md).

### First things to finish when the owner returns

1. Confirm whether the authorized test email arrived in the owner's nominated
   inbox (or spam). One real request was submitted through the deployed site's
   email form; Supabase returned HTTP 200 and the form advanced to code entry.
   Inbox receipt has **not** been confirmed. Do not equate the accepted request
   with confirmed inbox delivery, and do not send more test emails unprompted.
2. Have the owner perform a real email login in their own browser: Sign In →
   enter email → Email me a code → enter the fresh code on the site. Do not ask
   them to paste a sign-in code or API key into chat. Then confirm a selected
   plan survives refresh when signed in and is cleared from view on sign-out.
3. Have the owner try the real Google consent/login flow. Provider availability
   is checked; the actual owner-account consent round trip is still unverified.
   If Google blocks a public user, check the OAuth app's audience/test-user
   settings and redirect configuration before changing site code.
4. After those checks, ask which site improvement the owner wants next. The
   separate growth plan is saved in [growth-plan/README.md](growth-plan/README.md)
   with [a printable PDF](growth-plan/austin-chat-growth-plan.pdf). Its proposed
   SEO, analytics, promotion and classifieds work has not been implemented by
   the authentication task; do not treat those proposals as approved work.

**Important correction from the last session:** a direct SMTP check incorrectly
used the value returned by Supabase's management API as if it were the original
password. Hosted Supabase hides stored secrets; the returned values appeared
as protected 64-character fingerprints. Those direct tests returned 535, which
did **not** establish that the owner's Resend key was invalid. The owner was
unnecessarily asked to replace it; the mistake was explained and apologized
for. The subsequent real request through Supabase succeeded. Do not repeat the
direct-password test or ask for another key on that basis. This caveat is also
recorded in `auth/README.md` and `tools/auth/configure.py`.

### Behavior and preferences to preserve

- Guests automatically receive a temporary anonymous identity. Their itinerary,
  nickname and visibility are held in page memory and reset on refresh/reopen.
  Display preferences remain remembered. Only registered accounts persist
  login credentials and private saved plans. There is no persistent guest plan
  in localStorage, sessionStorage, a cookie or a URL.
- Navigation between the main map and planner keeps the outer page alive so
  guest selections survive that navigation and Back. A new visit starts fresh.
  Guest auth records still support protected APIs; scoped cleanup removes
  inactive tagged guest accounts after at least 24 hours. This is not a promise
  of immediate deletion of Supabase security logs.
- Sign-in merges current guest selections into the account's saved days;
  failed cloud loads preserve selections for retry. Sign-out saves outstanding
  edits first or offers an explicit discard choice. Different accounts stay
  isolated. Google names and private email addresses are not public chat names.
- A Day Planner view covers one Austin day, 5 AM to 4:59 AM the following day.
  Multiple days are supported as separate selected days. Scheduling, routing,
  account UI and neighborhood chat stay modular. Selecting a destination never
  claims the visitor is physically there or changes chat presence.
- Routing is for static travel-time planning. Google Maps, Apple Maps or Waze
  handle driving navigation. Existing Supabase/PostGIS routing and parcel data
  remain in place; see [routing docs](../tools/routing/README.md).
- Main-map controls include Apps, Media, Day Plan, Chat, Explore and GPS; zoom
  is a standard control at top left. Apps/Media replace the former hamburger
  sections. The header has Sign In/Account, and the planner drawer collapses.
  Keep the Contact page. Light mode uses white surfaces. Existing Explore and
  ticker sources update through scheduled code; no AI subscription is needed.

### Code and validation to pick up

- `shared/visit.js`: visit memory and map/planner navigation.
- `shared/session.js`: one parent-owned Supabase client shared with child
  frames; guest memory versus persistent registered sessions; cross-tab logout.
- `shared/account.js` / `.css`: account dialog, Google popup/PKCE, email codes,
  sign-out. `auth/callback/`: same-origin callback relay with attempt validation.
- `planner/store.js`: merging, account-scoped persistence, revision conflicts
  and retry. `chat/auth.js` / `room.js`: nickname and visibility reset/rejoin.
- Current auth release asset tag is `20261030a`; SDK is pinned to 2.118.0.
  Follow `CLAUDE.md` cache-version rules when changing browser assets.
- Before activation, **53 planner/session Node tests passed**, as did the real
  guest-privacy/routing browser checks. The committed browser integration check
  passed actual Supabase OTP verification, guest/account merge, cloud restore,
  two-account isolation, cross-tab/offline sign-out, and phone layouts. Its
  Google consent and email delivery are simulated; distinguish them from the
  later single real email request and the still-pending owner checks above.
- Useful commands: `node --test tests/planner/*.test.cjs`;
  `python3 tools/auth/configure.py` (configuration-presence flags only);
  `node tools/auth/check-browser.cjs http://127.0.0.1:8765` (disposable accounts,
  no real email sent). Start a local static server if needed; see auth docs for
  Playwright/Chromium prerequisites. Do not rely on old `/tmp` test scripts or
  an old preview process still running.
- The existing local management token is read by the helper, not embedded in
  code. Never print it or commit it. Normal repo credential-helper pushes work;
  fetch first to incorporate scheduled data commits, then push `main` normally.
- `773d31c` completed GitHub Pages deployment successfully. This checkpoint
  changes documentation only; it does not require rerunning functional tests
  or reapplying database migrations.

## 2026-10-29 (forty-fifth pass) — growth plan: how austin.chat gets users (research, no site changes)

Owner asked for "anywhere and everywhere I can promote Austin.Chat" plus a plan
for getting users for the things-to-do list, the Day Planner with its map and
routing, and the coming free classifieds. Five research agents (local channels,
search/SEO, social video, classifieds cold start, launch/press/paid/measurement)
plus a local audit of this repo. Everything is in `docs/growth-plan/`:
`README.md` (the plan, DRAFT, owner rewrites copy), `austin-chat-growth-plan.pdf`
(23 pages, printable; `scripts/make_pdf.py` rebuilds it with the OSGeo4W
python and Chrome), `appendix/00-06` (the research notes, about 250 source
links, each claim tagged FACT / ESTIMATE / UNCERTAIN).

What the audit found (facts from this repo at f99518b): no robots.txt, no
sitemap.xml, no meta description on the home page, no Open Graph tags, no
JSON-LD, no analytics, no web-app manifest; every listing (66 neighborhoods,
6,688 OSM businesses, 1,955 dated explore items at 390 venues) is drawn by
JavaScript inside an iframe, so search engines index roughly nothing.

The plan in one line: static pages search can read (one permanent
`/this-weekend/` page with dated title, 66 neighborhood pages, itinerary
pages, event leaf pages with Event JSON-LD, built by a GitHub Action like the
data builds), the owner's videos always pointed at a pre-filled plan link and
place-tagged for TikTok's Local Feed, a narrow classifieds launch (free stuff
and garage sales on the map, then student sublets in late April, then
face-value ticket swaps), free event calendars, a Nextdoor Business Page,
Airbnb-host QR cards, three press contacts, one Show HN, one $5/day Google
exact-match test, $0 analytics (Umami Hobby + Cloudflare beacon). Targets
(ESTIMATE): 2–4k visits/month at month 6, 5–10k at month 12.

NOTHING on the site was changed. NEXT: owner reads the plan and decides;
week-1 items (robots, sitemap, home-page HTML, OG tags, analytics) are the
first build work if the plan is accepted. Gaps the owner must close by hand
are listed in README §9 (Reddit and Facebook rules were unfetchable).

## 2026-10-26 (forty-fourth pass) — NEW page /models/: five Blender project models in 3D on the map

Owner: the five Blender models in `C:\Dev\Austin_Models_Transfer_Batch`
(drainage tunnels, Convention Center redevelopment, I-35 northern
stitches, Lady Bird Lake light rail, AUS Concourse B) onto MapLibre so
they can be zoomed and tilted on the site. Decisions: MapLibre + three.js
(not Cesium), one page with a project picker, NO hand positioning. Finding
first: the batch was packed for a Unity+Cesium import on another laptop
that never ran (`unity_cesium_runtime_tested: false` everywhere), so the
models were never placed anywhere and that is why there was no height
data. On a flat map height stops mattering (one ground offset per model
from its own notes) and position is derived, not dragged.

Built: `/models/` (index.html, style.css, config.js, copy.js DRAFT,
js/app.js, js/model-layer.js — a MapLibre custom layer drawing GLBs with
three.js from unpkg, Draco decoder from the same pinned copy);
`models/data/*.glb` (13 files, 1.4 MB in all: Draco took the 17 MB
drainage model to 0.4 MB); `models/data/placements.json` written by
`tools/models/place.py` from OpenStreetMap geometry + the package notes,
with the reasoning next to every number (drainage: state-plane origin +
grid convergence 1.34°; Convention Center: OSM footprint centroid, Trinity
bearing 17.87°; I-35: 41st line × mainlanes, 27.95°; Lady Bird: the
Trinity/Cesar Chavez node, 17.99°, sunk 12.1 m so streets meet the map
plane; AUS: terminal centroid moved 308 m to the airfield, 358.13°).
`tools/models/prepare-glbs.sh` makes the GLBs (gltf-transform, `npm
install` in tools/models). Card in `home.json` under Metro Apps, framed
page `maps/models/`. Recipe and placement reasoning in
`docs/models-page.md`.

Checked headless (playwright-core + the ms-playwright Chromium): every
file 200, no errors; screenshots over the satellite layer put the
Convention Center on its block square to the grid, the rail along Trinity
and across the lake, the tunnels from downtown up I-35 and east to the
outfall. First try rendered the buildings black: Blender's metallic
factors with nothing to reflect; the layer now forces matte materials.
Three MapLibre console warnings "Expected value to be of type number,
but found null" and a few GL "framebuffer incomplete" warnings during the
fly remain, cosmetic. NEXT: owner opens the page on the phone (3D custom
layers on phone GPUs untested), reviews the DRAFT copy, and decides where
the Blender sources and the transfer batch should live in git (they are
outside every repo; `unpacked\` next to the zips is where the GLBs came
from). Stray empty folder `C:\Dev\tools\models` left by a misdirected
npm install: delete it.

**Same day, second pass — "blurry and abstracted" next to Blender (owner).**
Three causes found and fixed, in order of weight: (1) MapLibre's Mercator
world is left-handed and three.js assumes right-handed, so three.js lit
every face from the wrong side (roofs shaded as undersides: murky, flat).
Diagnosed with a blue-sky/red-ground test light on a plain cube. Fix: the
y mirror now lives in the camera's projection matrix where three.js never
looks, and objects sit in a right-handed map frame (x east, y north, z
up) with plain similarity matrices (`model-layer.js`, FLIP_Y). This is
also why the official MapLibre+three example bakes the mirror into the
projection. (2) gltf-transform's `optimize` had merged all materials into
a palette texture and Draco at its default 14-bit positions spaces
vertices 0.4 m apart on the 6 km drainage model; now `optimize` runs with
palette/simplify/compress off and a separate `draco` pass at 16 bits
(1.6 MB total). (3) the map canvas had no antialiasing (`antialias:
true`). Also: Blender glass arrives as a transmission material, which
three.js renders with a pass that does not work inside MapLibre's context
and caused the "framebuffer incomplete" warnings; glass is now plain
45 % transparent, warnings gone. `?v=20261026b`. The Convention Center
now reads like the Blender aerial: zinc roof, limestone paving, lawn,
creek. What is still not Blender: no shadows or ambient occlusion. If the
owner wants that depth, bake Eevee/Cycles lighting into vertex colours in
Blender and re-export; three.js multiplies vertex colours into the base
colour for free.

**Same day, third pass — shadows and baked ambient occlusion (owner: "Add
the shadows and baked AO to the current page").** Shadows: the sun in
`model-layer.js` now casts a 2048 px PCF-soft shadow map; `spotlight(key)`
(called by app.js on every pick) aims the shadow camera at the picked
model's footprint and moves the scene origin there. The origin matters on
its own: Austin sits near (0.23, 0.41) Mercator and a metre is 3e-8, more
than 32-bit floats can hold together, so objects are now placed RELATIVE to
the origin and the big offset rides in the projection matrix (built in
64-bit each frame). An invisible ShadowMaterial sheet under each model
catches its shadow on the map plane. AO: `tools/models/bake-ao.sh` runs
the Windows Blender 5.2 headless with `bake-ao.py` on each raw GLB: join,
split every edge longer than N m (4 m buildings, 8–12 m context), bake
Cycles AO (OptiX on the RTX 3050, seconds per model) into a vertex colour
attribute, multiply it into every material's base colour so the glTF
exporter writes COLOR_0; results land in
`C:\Dev\Austin_Models_Transfer_Batch\baked\` and `prepare-glbs.sh` prefers
them. First attempt baked to a TEXTURE and failed: a Smart-UV layout of a
building plus hundreds of trees gave the roofs no texture space (black
image with leaf speckles). Vertex AO needs no layout. `?v=20261026c`.
Verified headless: Convention Center canopy underside darkens, trees and
the building drop shadows on the plaza, no console errors.

## 2026-10-24 (forty-third pass) — the video does NOT use the map: card renderer instead

Owner, on seeing pass 42: "we dont need to use OBS, this report won't
reference the map built for this, it will just be a quick review of the
total numbers and the top comments". So the map story mode is GONE again
(play.js, the app.js hooks, the story CSS, story-take/composite.sh,
apps/austin-pizza/story.js — all removed; shopmap/app.js and style.css
are back to 6cd2720, the `?v=20261024a` bumps stay). In its place
`tools/video/`: `make-story.py` (same beats, now writes
`C:\Dev\map-exports\<id>\story\beats.json` + the narration doc),
`card.html` (one 1080x1920 card in the site's day look: eyebrow
AUSTIN.CHAT, app title, big number / rows with bars / top list / end
lines, credit + progress dots at the foot), `render-cards.js`
(playwright-core + the ms-playwright Chromium → card-NN.png), `compose.sh`
(cards concat; each card holds max(hold, clip + 0.6 s); narration clips
at beat-NN.mp3 laid at their card's start; silent when none). Pizza:
6 cards rendered, silent 58 s cut at
`C:\Dev\map-exports\austin-pizza\austin-pizza-short.mp4` for the owner
to look at. End card now "More Austin maps and apps at / austin.chat"
(draft). "Top comments": no quote data exists, so the top card is the 8
brands (of 11) mentioned in both r/austinfood and Austin Monthly; a
`quote` beat comes when the CSV has quote columns. NEXT: owner reviews
`docs/austin-pizza-narration.md` → ElevenLabs clip per beat → compose.

## 2026-10-24 (forty-second pass) — shopping-app videos: story mode + generator (pizza first)

Owner wants a sub-one-minute informational video per shopping app
(count, types, most talked about from Reddit/Yelp with quotes), then the
same for many apps, automated. Facts first: the pizza CSV has NO Yelp
data; Reddit notes on 54 places are summaries, not quotes, pointing at
11 r/austinfood threads; each place carries at most one Reddit and one
magazine source, so "popularity" here = number of sources (0–2). Owner
decided: start with mention counts and no quotes, ElevenLabs voice,
9:16 only. BUILT (recipe in CLAUDE.md "Shopping app videos"):
`/shopmap/play.js` (?phone layout + ?play story player: curtain, bottom
card, beats all / breakdown (pins recoloured by the property, bars) /
top (only those pins, labels forced on) / end), app.js exposes
`window.shopApp` + `shopmap:ready` and drops its zoom/bounds limits while
playing, story CSS in shopmap/style.css, `tools/make-story.py` (story.json
+ data → story.js + docs/<id>-narration.md, brand grouping by name),
`tools/story-take.sh` (OBS), `tools/story-composite.sh` (curtain-drop
trim via negate+blackdetect, per-beat clips with adelay, amix). Pizza:
`apps/austin-pizza/story.json` → 6 beats, 0:58 (194 → by type → style
named, 144 not stated → health bands → 11 brands in both Reddit and
Austin Monthly, 8 shown → end card). Narration draft in
`docs/austin-pizza-narration.md`, beat 4 is one word over budget.
Verified headless (SwiftShader, 1080x1920, ?play&phone): every card
renders, pins recolour, no page errors; SwiftShader loads slowly so the
curtain dropped ~8 s in, which the composite's trim handles. Engine
`?v=20261024a` on all 7 shopping pages. NEXT: owner reviews the narration
lines → ElevenLabs clips per beat → OBS take (ask first) → composite.
Open: Yelp/quote columns would need the owner's research AI to add
`quote`, `quote_url`, `quote_by` to the CSV; make-story.py can then grow a
`quote` beat.

## 2026-10-24 (forty-first pass) — menu: Maps section gone, Metro Apps, Maps under Content

Owner: take the top-level Maps section out of the hamburger, put Maps as
a section under Content, and move the three Planning maps (Budget,
Datacenter, AISD) to a new category called Metro Apps. Done:
`home.json` — `categories` gains "Metro Apps" (last, after Shopping
Apps), `mapCategories` is deleted (Animated / Austin News / Historical
were empty), the three maps carry `category: "Metro Apps"`; their `kind`
stays `maps`, so their framed pages are still /maps/budget/,
/maps/datacenters/, /maps/aisd/ and the /maps/ directory page is
untouched. `shell.js` — the Maps `<details>` is removed; Content now
opens to a Maps group (a `.menu-group`, same look as a category, holding
"All maps" → /maps/ plus any map whose category is not an Apps category —
none today) and then the social/shop links. Cards route by category: a
`kind: maps` card with an Apps category sits under Apps. Only
`shell.js?v=20261024a` bumped (19 pages + tools/page-template.html);
style.css unchanged. Verified headless (Playwright 1280x800, local
server): sections Apps / Content / Contact; Apps ▸ five categories, Metro
Apps lists the three maps; Content ▸ Maps ▸ All maps, then YouTube…Ebay;
no page errors. Choices to confirm with the owner: Metro Apps placed last
in the Apps list; Maps placed FIRST under Content (before YouTube).

## 2026-10-23 (fortieth pass) — home chat map zoom: 16.4 tried, REVERTED to 15.4

Owner asked for one level closer; `views.neighborhood.zoom` 15.4 → 16.4
made the map "zoom in and then zoom out", so it is back at 15.4
(`chat/index.html` config.js `?v=20261023n`). WHY IT ZOOMS TWICE (same
before the change, just less visible): on load `neighborhoodView()` eases
to downtown at `neighborhood.zoom` (close, tilted); then GPS (or
`?room=`) resolves a neighborhood and `onRoom` calls
`flyTo(boundsOf([feature]), 60, V.neighborhood.zoom)` — that FITS the
whole polygon with 60 px padding, `neighborhood.zoom` is only a CAP.
Downtown's box is 2.6 × 3.6 km and fits at about z13.7 (phone) – z14.1
(desktop), so the second move zooms OUT to the fitted view. The view the
owner sees and likes is that fitted view, not the configured number, so
raising the number only made the overshoot bigger. If the double move
should go: make the opening move fit `openView.room` the same way
(flyTo with the cap) instead of easing to a fixed zoom — one line in
map.js — or drop the opening ease and wait for the room.

DONE (owner, same day): `neighborhoodView()` now calls the same
`flyTo(boundsOf([target]), 60, V.neighborhood.zoom, duration)` as the room
flight (flyTo took a `duration` argument, default 900; the opening pass
uses `openTiltMs`), so the opening move, the Neighborhood button and the
flight to your room all land on the fitted view. `neighborhood.zoom` is
now only a cap everywhere; to open closer, raise the cap AND the fit
would still win for a big neighborhood — shrink the 60 px padding instead.
`chat/index.html` map.js + config.js `?v=20261023n`. Owner: "that fixed it".

THEN one level closer (owner): new `config.js` `fitCloser: 1` — flyTo
takes the fitted zoom + fitCloser, capped at `neighborhood.zoom`. Applies
to the opening view, the Neighborhood button and the flight to your room
alike (all go through flyTo). Downtown now lands near z14.7 (phone) –
z15.1 (desktop). `?v=20261023o` on both scripts.

## 2026-10-22 (thirty-ninth pass) — NEW shopping app: Pizza in Austin

Owner's CSV `C:\Dev\austin-pizza\austin-pizza-restaurants-deep-research.csv`
(194 rows, with Austin Public Health scores + Reddit / Austin Monthly
notes) → new app `apps/austin-pizza/` (index.html copied from guitar,
config.js, build.py, data.geojson). Dropdowns sorted from the owner's
text: `kind` (Chain / Pizzeria / Bar, brewery or restaurant / Counter or
trailer), `style` (8 bands, 144 "Not stated"), `score` (90–100 / 80–89 /
below 80 / no match), `area` (owner's 8 general areas). Popup: type,
style, "website says", address, phone, website, health score with date
+ inspection link, Reddit note + thread, Austin Monthly note + article,
verification, notes. Added to `apps/reports/reports.json` (category
Dining) so the menu (under Shopping Apps for now) and /apps/ list it.
TITLE "Pizza in Austin", SUBTITLE and BLURB ARE CLAUDE DRAFTS — owner
to replace. Data `?v=20261023l`.

## 2026-10-22 (thirty-eighth pass) — toy stores data refreshed

Owner's CSV `C:\Dev\austin-toy-stores\greater-austin-toy-stores-and-childrens-retailers-with-contact-info.csv`
(35 rows) → `apps/austin-toy-stores/data.geojson` (8 → 35) via
`apps/austin-toy-stores/build.py`: `kind` (Independent / local, Chain,
LEGO), `focus` (LEGO, Educational / STEM, Collectibles, Plush, Games &
puzzles, General toys), `stock` (New / New and used) sorted from the
owner's text, kept whole. Dropdowns Type / Focus / New or used / Area.
Data `?v=20261023k`.

## 2026-10-22 (thirty-seventh pass) — bike shops data refreshed

Owner's CSV `C:\Dev\austin-bicycle-shops\greater-austin-bicycle-and-ebike-shops-with-contact-info.csv`
(40 rows) → `apps/austin-bike-shops/data.geojson` (5 → 40) via
`apps/austin-bike-shops/build.py` (same pattern as horseback: owner text
kept whole, dropdown fields sorted from it: `kind`, `ebikes`, `service`).
config: name field `name`, category `kind`, dropdowns Type / E-bikes /
Service / Area, popup with type, specialties, area, address, phone,
website, verification status, notes, source. Data `?v=20261023j`.

## 2026-10-22 (thirty-sixth pass) — panel arrow on the panel; Export + Reset

Owner: the panel must run all the way to the arrow box; two same-size
buttons above the table: Export (CSV of the filtered table) and Reset
(dropdowns back to All). `/shopmap/`: the arrow button now lives INSIDE
`.data-panel` (right: -22px) so panel and arrow are one piece; `.panel-
actions` with `exportBtn` / `resetBtn`; Export writes every property of
the rows now shown (+ longitude, latitude) as `<app id>.csv` with a UTF-8
BOM; Reset clears the selects and re-filters. `?v=20261023i`.

## 2026-10-22 (thirty-fifth pass) — map height fix; horseback riding data refreshed

The shopping pages' blank band at the bottom: the site `style.css` `#map`
rule (a fixed height for another page) applied inside `.shopmap`; the
engine now sets `width/height: 100%` outright (`?v=20261023h`). Then
owner's CSV `C:\Dev\austin-horseback-riding\austin-area-horseback-riding-with-contact-info.csv`
(20 rows) → `apps/austin-horseback-riding/data.geojson` (17 → 20).
Dropdown fields sorted from the owner's free-text `type_of_riding` (kept
whole as `types`): `riding` (Trail rides / Lessons & training /
Therapeutic riding), `style` (English / Western / both / not stated),
`camps` (Yes/No), plus `city`; config filters/columns/popup set.

## 2026-10-22 (thirty-fourth pass) — shopping apps: the side panel is back, with dropdowns

Owner: keep the old reports' side panel (slides out from the left, arrow
on its edge) and give it at least three dropdowns that narrow the table
underneath and the pins (guitar: type, new or used, area). `/shopmap/`:
the top-left card is gone; `.data-panel` (title, subtitle, result count,
`filters` from config.js — each "All" or a value found in the data, a
dropdown with no values in the data is left out — and the table from
config.js `columns`, first cell with the pin's colour, a tap goes there;
on a phone the panel slides away after a tap); `.panel-toggle` arrow on
the panel's edge, open on desktop, closed on phone. Per-app `filters` +
`columns` set in each `config.js` (guitar: shop_type / sells / city —
`sells` New|Used|Both is NOT in the data yet; the dropdown appears once
Codex's table adds it; bike: type / sells_ebikes / city; toy: type /
age_range / city; golf: Type / Holes / Area / price tier; horseback:
category / area / primary_activities; pools: Pool Type / Status / Closure
Days). Engine + pages `?v=20261023g`. Rendered headless: panel, dropdowns
and table right; the map itself still unseen with WebGL here.

## 2026-10-22 (thirty-third pass) — shopping apps rebuilt on /shopmap/, at /apps/<id>/

Owner: the guitar report must live at /apps/austin-vintage-guitar/ and
"look like the map on the site home page", header and footer matching
the homepage; all shopping apps the same; owner will have Codex redo the
other data tables. Built the shared engine `/shopmap/` (`app.js`,
`style.css`, `words.js`): a real page in the site frame (shell.js header
+ footer, `<main><section class="map-hero"><div class="shopmap">`), the
home map's look — positron, round control stack (find me, 2D/3D, Sat,
extents, +, −), Street / Neighborhood / City views, opens fitted then
tilts, zoom floor + keep-on-screen — pins coloured by category, labels
from zoom 12, a card with the title and ONE list (a fold per category
with swatch, count and a hide box; a row per place), tap a row → street
level + popup (config rows, URLs become links, Google / Apple / Yelp
buttons) and the card folds; tap a pin → popup. Six app folders
`apps/<id>/` (index.html + config.js + data.geojson copied from
`apps/reports/<id>/`): austin-vintage-guitar, austin-bike-shops,
austin-toy-stores, austin-golf-courses, austin-horseback-riding,
PoolOpenings — titles/subtitles are the owner's words from the old
configs; name/category/popup fields chosen per data. `home.json`
`reportsKind: apps` (menu + /apps/ list link there); `maps/<id>/` framed
folders for the six deleted; `tools/make-pages.js` now leaves a folder
alone when its index.html is a real page (no view.js). The old citywide
report apps in `apps/reports/<id>/` are untouched (reports.json hrefs
still reach their report.html). KNOWN: the control/view code is a twin of
chat/map.js by design (each page readable alone) — if they drift, that is
the moment to make a shared mapkit. NOT seen with WebGL here: the map's
`ResizeObserver` re-measure inside the frame is the thing to eyeball
first. Engine `?v=20261023f`. Data for the other five: owner + Codex.

## 2026-10-22 (thirty-first pass) — three-level hamburger menu

Owner: Apps → Walking and Biking Apps, Real Estate Apps, Historical Apps,
Shopping Apps; Maps → Animated, Austin News, Historical, Planning;
Content → YouTube, TikTok, Instagram, X, Substack, Gumroad, Etsy, Ebay.
`home.json`: `categories` (apps), new `mapCategories`, new `content`
links; Moontower + 1885 → Walking and Biking, What can I build here →
Real Estate, Budget / Datacenter / AISD → Planning, reports → Shopping.
`shell.js`: `addGroup` per category (shown even when empty), `addItem`
(an empty url renders greyed `.menu-soon`); `style.css` third-level
indents. EMPTY TODAY: Historical Apps; Animated, Austin News, Historical
maps. NO ADDRESS YET (greyed): Instagram, Gumroad, Etsy, Ebay — fill the
`url` in home.json `content`. `?v=20261023e`.

## 2026-10-22 (thirtieth pass) — visible people share their position

Owner: "why can't the chat get the location from the map for the users"
— it could; Claude had kept coordinates on the phone. Now, WHILE
VISIBLE, your position rides on presence (`chat.js setPosition`, 4
decimals ≈ 10 m, re-sent after 15 m of movement; `locate.js` hands every
reading out + `metres()`), hidden shares nothing. `map.js`: one emoji
marker per person at their position (else their business, else the
neighborhood). "Users visible" rows say the business picked, else "near
<shop>" within 80 m of the shared position, else the whole neighborhood.
The Visible button's hover text says what it shares. Tour apps: same
files, so a tour walker who turns Visible on is drawn on the chat map
too. `?v=20261023b`. Then: the find-me button goes to YOUR position
(zoom ≥ 16), not the neighborhood; picking a business never moves your
marker. `?v=20261023c`. Owner saw the marker jump to the business:
with no GPS reading (desk / `?room=` test) the fallback was the picked
business. Now a marker is ONLY the shared position, else the neighborhood
centre; `?room=` test mode also watches the GPS for the position.
`?v=20261023d`.

## 2026-10-22 (twenty-ninth pass) — "Users visible" fold on the card

Owner: above "The whole neighborhood", a "Users visible" dropdown listing
every visible person and the shop they are in (or the whole
neighborhood). `room.js` `showUsers(list)`: a fold rebuilt on every
presence change, one row per person "🦊 Handle (you) · H-E-B"; tapping a
row joins that person's room (same delegated click as the businesses).
`?v=20261023a`.

## 2026-10-22 (twenty-eighth pass) — the card folds after picking a business

Owner: close the card after a business is picked (map goes there, popup
opens); the arrow reopens it. `chat/map.js` `onPlace`: `setCard(false)`.
`chat/*?v=20261022y`. Then: reopening the card closes the popup
(`placePopup` hoisted next to `setCard`), `?v=20261022z`.

## 2026-10-22 (twenty-seventh pass) — businesses under six groups

Owner picked six groups: Food & Drink, Groceries & Essentials, Shopping,
Health & Beauty, Auto, Things to Do. `categories.json` gained `groups`
(heading → labels, card order; a label in no group → Other);
`tools/fetch-places.py` writes `groups → categories → places` per
neighborhood (re-run); `room.js` builds neighborhood → group fold →
category fold → business; `map.js` reads the new shape. Chat files
`?v=20261022x`.

## 2026-10-22 (twenty-sixth pass) — zoom and pan limits

Owner: no zooming out past the current extents, and the map can be
pushed almost off the screen but never entirely. `chat/map.js`:
`limitZoom()` sets minZoom to the City view's zoom (cameraForBounds of
the geofences' box), `keepInView()` sets maxBounds to that box widened by
90% of what the screen shows at the current zoom (`keepOnScreen: 0.1` in
config.js), re-run on zoomend and resize; the fixed `cagePad` / `minZoom`
are gone. Chat files `?v=20261022w`.

## 2026-10-22 (twenty-fifth pass) — more shop types; business popup with map + Yelp links

Owner: add the dropped shop types and re-run; tapping a business zooms
to it at street level (like the Street button) with a popup: name + a
Google Maps button, an Apple Maps button and a Yelp search button, all
plain URLs, no API. Done: `categories.json` +25 shop types (car dealers,
auto parts, storage, phone stores, electronics, furniture, home goods,
jewelry, department / variety stores, drugstores, gift shops, massage,
opticians, thrift, tattoo, smoke shops, toys, sporting goods, building
supply; cosmetics merged into Beauty); `tools/fetch-places.py` re-run:
3,436 places kept (was 2,969), downtown 479, north-burnet 262, zilker 131,
496 KB; next dropped types are small (stationery 11, wholesale 11,
copyshop 10, pawnbroker 10, flooring 10…). `chat/config.js` `placeLinks` URL templates ({lat} {lng}
{name}); `map.js` `onPlace`: flat street zoom + MapLibre popup with the
three links (`.place-popup`, `.place-links` in `chat/style.css`); words in
`copy.js places.google/apple/yelp`. Chat files `?v=20261022v`.

## 2026-10-22 (twenty-fourth pass) — menu: Apps and Maps open a second level

Owner: clicking Apps or Maps in the hamburger should open a second level
so a person can go to an individual app or map from the menu. `shell.js`:
Apps and Maps are `<details>` again, each list starting with the
directory page ("All apps" → /apps/, "All maps" → /maps/) then one row
per item from `home.json` (by `kind`) and `reports.json` (under Maps);
Content and Contact stay plain links; closing the menu folds the level
up. `style.css`: summary + `.menu-links` rules back, chevron turns when
open. `?v=20261022u`.

## 2026-10-22 (twenty-third pass) — menu arrows back, smaller chat box, three view buttons

Owner: the chevrons back on the hamburger links; chat box a little
narrower and 40% shorter; three equal square buttons bottom right above
the info button: Street (flat, block level, zoom 17), Neighborhood (the
opening view, tilted, one level closer than before: zoom 15.4 — also the
new default; goes to YOUR neighborhood once located, else downtown), City
(flat, all of Austin, same as extents). Done: `style.css` `.menu-link::after`
chevron; `chat/panel.css` 280×216 (phone 33%), moved left of the stack;
`chat/config.js` `views` block; `chat/map.js` setTilt/cityView/
neighborhoodView/streetView, opening move = neighborhoodView; room flights
use the Neighborhood zoom. Site `?v=20261022t`, chat files too.

## 2026-10-22 (twenty-second pass) — businesses per neighborhood, business rooms

Owner: a categorized list of businesses per neighborhood on the card
(neighborhood → category fold → business) so people narrow whom they
chat with; data from OpenStreetMap; anyone standing in the neighborhood
may pick any of its businesses; a business room opens even when empty;
people line says "At <place>."; the map shows where each visible person
is. Built: `chat/data/categories.json` (OSM shop/amenity/leisure value →
label, owner-editable, order = card order), `tools/fetch-places.py`
(plain python3, Overpass with the GISData mirror/retry pattern, point in
polygon as locate.js) → `chat/data/places/<id>.json` × 65 + `index.json`:
4,907 OSM elements, 2,969 kept (downtown 459, north-burnet 212, zilker
123; hyde-park 23), 464 KB total, biggest file 47 KB; the script prints
the dropped shop types (car 58, storage_rental 52, mobile_phone 40,
furniture 40, jewelry 34, department_store 31…) to grow the list. Rooms:
strings `<neighborhood>` / `<neighborhood>/<place id>` on ONE channel per
neighborhood; presence + broadcast carry `room`; `chat.js setRoom()`;
`messages.room` holds either (no migration). `room.js`: fetches the
neighborhood's file (only where a `placeList` element exists — not in the
tours), builds the list with "N here" counts, `choose()`, `?place=` test
switch, hooks `onPlaces` / `onPlace`. `map.js`: one emoji row per room at
the business or the neighborhood centre, a pin on the business you
picked. Chat files `?v=20261022s`. NOT seen in a browser here — owner
tests two tabs on `/chat/?room=hyde-park` (second tab private window).

## 2026-10-22 (twenty-first pass) — accounts and history, waiting on one SQL run

Owner: use the paid project (already paying; "don't want to pay for
another"). Auth config verified + completed via the management API
(anonymous ON, email ON, site URL austin.chat, redirects). Written:
`supabase/migrations/0001_chat.sql` — `handle` + `emoji` on the existing
`profiles` (unique handle, own-row insert/update policies), `messages`
(room, user, text; RLS read-all-signed-in / write-own; 3-per-10 s trigger;
pg_cron purge at 30 days), `tour_progress` (own rows). **NOT APPLIED:
the auto-mode classifier blocks SQL writes to the database from the
terminal — the OWNER runs the file in the SQL Editor.** Client code is
done and degrades until then: `chat/auth.js` replaces identity.js
(anonymous sign-in → profiles handle/emoji, unique-handle retry, browser
fallback when offline); `chat.js` reads a room's last 100 lines on join
and inserts each sent message; `room.js` awaits the name. Chat files
`?v=20261022r`. Also: plan §0 notes the coming "many geofences per
neighborhood" (places GeoJSON, locate checks places first). Test: run the
SQL, then phone + laptop `?room=hyde-park`; a reload should keep your
name, and a room should show its earlier lines.

## 2026-10-22 (twentieth pass) — the tours join the chat; shared room.js

Owner: "code anything that still needs to be done", tests on phone +
laptop. Done: the chat wiring left `chat/map.js` for `chat/room.js`
(shared), the chat window's CSS became `chat/panel.css` with six
`--chat-*` colour variables each page sets from its own palette (engine
shared, look per product). Both tour apps (`1885murdertour/app.html`,
`moontowertour/app.html` — hand-kept files, only `vendor/` is synced)
got a 👁 Visible button and a 💬 Chat button at the bottom of the round
stack, the chat window, the script tags and a 3-line `js/chat.js`; no
polygons drawn on the tour maps. Visibility now starts OFF everywhere
(plan §0) and is remembered once on. `home.json`: the 1885 demo `src`
is `/1885murdertour/app.html` (austin1885.city is going). `chat/README.md`
explains the files and how an app joins. Chat files `?v=20261022q`.
Still linking to austin1885.city: the 1885 stops' "read more" pages
(`vendor/stops.js`, synced from the app repo) — owner's call where those
pages move. Supabase: owner is doing the Auth dashboard steps now.

## 2026-10-22 (nineteenth pass) — the agreed identity model, in the plan

Owner reviewed a long description of the platform; Claude's read: mostly
what is built, but no server-side polygon check, no live GPS positions,
no Turf.js, and cross-app login only works on one origin. Owner's
decisions: austin1885.city will be DELETED, everything runs under
austin.chat/apps/<slug>/; one identity across all apps (random name now,
profile name once Auth exists); never required to register; history
functions (miles walked etc.) are the only sign-in-only ones. Written as
`docs/CHAT-PLAN.md` §0, with the two things the deletion breaks (1885
demo src in home.json, stop links to austin1885.city). No code changed.

## 2026-10-22 (eighteenth pass) — card closed by default, no auto-open chat, closer

Owner: the chat window must NEVER open by itself; the card starts closed
on a refresh, showing its title and, directly under it, the "1 other
person is visible here" line; zoom in one more step. Done in `chat/`:
`#peopleLine` moved out of `#legendBody` (under the title button, so it
shows while folded); `setCard(false)` on load; the auto-open in
`onPeople` removed (the Chat button is the only way in); `openView.zoom`
13.4 → 14.4 and room / find-me flights `maxZoom` 14 → 15 so they do not
zoom back out. `chat/*?v=20261022p`.

## 2026-10-22 (seventeenth pass) — cleaner chat card

Owner: remove the sub line ("See and chat with…"), the "Nobody else is
visible here yet." line and the About button. Done in `chat/`: card =
title, You are …, room line, people line (only when someone else is
there, or the hidden note), Visible / Chat. The About strings and the
`about` markup are gone from copy.js / index.html; empty lines collapse
(`:empty`). `chat/*?v=20261022o`.

## 2026-10-22 (sixteenth pass) — the menu is four links to the directory pages

Owner: "Apps should go to index.html at austin.chat/apps/ and just open
with the slug for the directory page you built for Apps and Maps and
Content". `shell.js`: the fold-out sections (categories, per-app rows,
the ↗ new-tab links, the home.json + reports.json fetch) are gone; the
hamburger panel is Apps → `/apps/`, Maps → `/maps/`, Content →
`/content/`, Contact → `/contact/`. The directory pages (`list.js`) and
the framed pages (`view.js`) are unchanged, so `home.json` still feeds
them (titles, blurbs, `kind`/`slug`). Dead menu CSS removed from
`style.css` (summary/chevron/menu-links/menu-pop/menu-group rules).
`?v=20261022n`.

## 2026-10-22 (fifteenth pass) — chat map opens tilted over downtown, coloured

Owner: open tilted like the reference picture (their own 3D view over
Downtown with the building blocks), "polygons fill different colors",
tapped border highlights, "attractive when someone visits". Done in
`chat/`: a 12-colour palette in `config.js`, assigned in `map.js` so no
two touching neighborhoods share a colour (greedy, bbox overlap);
fill .38 / hover .55 / room .7; pale white borders, dark border on the
tapped one (`selected` feature-state, one at a time, tap again to clear;
the name popup is gone — the name is already written on the polygon),
accent border on your room. Opening move: the map loads flat on all of
Austin and in 1.8 s flies in over `downtown` at zoom 13.4, pitch 57,
buildings on (`openView` in config.js); the tilt button starts as "2D";
room / find-me flights keep the tilt; extents lays it flat and resets the
button. `chat/*?v=20261022m`. Not seen in a real browser here.

## 2026-10-22 (fourteenth pass) — chat map: tour-app controls on the right, bar fixed

Owner (screenshot): a white bar across the map; move the controls to the
right and the box to the top; use the same controls as the Moontower map
including 3D. The bar was the avatars marker stretching full width (its
div lacked `position:absolute` + `width:max-content`; fixed in
`chat/style.css`). Now: the card sits top-left at the top; the floating
title pill is gone (the card carries the title); a round control stack
on the right in the tour apps' order and size (44 px): find me (eases to
your room, or asks for the location again), 2D/3D (pitch 57 like the
tours, plus buildings as blocks from positron's own OpenMapTiles
`building` layer, shown only while tilted — positron is a vector style so
tilt works, no basemap change needed), Sat, extents (flat, north-up),
+, −. Behaviour copied from `1885murdertour/js/main.js`; surfaces are
this site's (paper/ink/accent), not the tour's palette. Chat window moved
left of the stack. `chat/*?v=20261022l`. Not yet seen in a real browser.

## 2026-10-22 (thirteenth pass) — the chat map is the home page centre

Owner (after a restart): the home page window holds the chat map, with
the controls the datacenter map has; "it opens a chat window when you
connect with someone in your neighborhood geofence". Built `/chat/`:
`index.html` (same control markup as `/datacenters/`: Satellite, +, −,
fit, fold card; borrows `../topicmap/style.css` but NOT the engine, which
is dots + a story timeline), `config.js` (data + the paid Supabase
project `aqbyxpiwugcvoephsvpm`, publishable key as in `/budget/`),
`copy.js` (words, Claude drafts marked), `identity.js` (random handle +
emoji in localStorage, "New name" button), `locate.js` (GPS watch →
point-in-polygon against the 65 geofences, in the browser; coordinates
never leave the phone), `chat.js` (one Realtime channel per geofence
`chat:<id>`, Presence = visible, Broadcast = messages, 240 chars, 1/s,
nothing stored), `panel.js` (the chat window), `map.js` (map + wiring:
your room tints and the map eases to it; emoji row of the visible people
on the polygon; Visible/Hidden button remembered per browser, default
on; the window OPENS BY ITSELF when you are visible and someone else is
visible in your room, the Chat button toggles it after that; leaving the
geofence changes the room). Test switch `?room=<geofence id>` joins a
room without GPS (two tabs at a desk). Home: `index.html` window →
`/chat/` with `geolocation` allowed on the iframe; demo flags removed
from `home.json` so `home.js` finds no reel. `?v=20261022k`. VERIFIED
from node with two clients on the paid project: presence sync, broadcast
delivery, untrack drops the person within 1 s. NOT yet seen in a real
browser (headless here has no WebGL) — owner to open austin.chat on a
phone in Austin, and on two desktop tabs with `?room=hyde-park`.
NEXT (plan §2/§4/§5, unchanged): accounts (anonymous sign-in → email)
and the 30-day history table need the owner's dashboard steps first.

## 2026-10-22 (twelfth pass) — geofences merged by name; chat + login plan

Owner: merge by name ("we don't want the area too small or too many
polygons"); a login/authentication so people use it like an app, same
name and login in the walking apps, or a randomly assigned name; signing
in shows a profile and, for the walking apps, a record system. Done:
`chat/data/geofences.geojson` (65 polygons, `id` + `name`) via
`tools/make-geofences.sh` (OSGeo4W ogr2ogr, ST_Union by name). Written:
`docs/CHAT-PLAN.md` — Supabase Auth on the paid project with anonymous
sign-in (random handle) upgradable to email; `profiles` table; one
Realtime channel per geofence, visible = joined Presence; people shown on
their neighborhood, never at GPS; popup = neighborhood room (proposed);
30-day history (proposed); `tour_progress` table for the walking apps;
page at `/chat/` in the frame. NEXT: owner does the dashboard steps in
plan §2 and approves §3–§5; then migration SQL; then the page.

## 2026-10-22 (eleventh pass) — neighborhood geofences stored for the chat map

Owner is replacing the home page's demo reel with a chat map: one geofence
per neighborhood, see only the people in yours, visibility on/off, popup
chat when two or more are visible (revives the shelved austin.chat idea;
the archive's Supabase Realtime engine is reusable). First step, owner:
"use the Austin Open Data portal neighborhood geojson and store it in
GitHub" — `chat/data/neighborhoods.geojson` (portal dataset inrm-c3ee,
95 features, unchanged) with provenance in `chat/data/README.md`. Open
decisions before building: Supabase project, where people appear
(neighborhood not GPS pin recommended), identity (handle+emoji vs
accounts), popup = private room or neighborhood room, message history.

## 2026-10-22 (tenth pass) — index pages list whatever is in the folder

Owner: the /apps/ and /maps/ index pages must "read any new files in that
folder and list them", each opening from its slug. A static host cannot
list a folder, so `folder.js` asks GitHub's public contents API (the repo
is public; ~60 calls/hour per visitor; failure falls back to the data
files). `list.js` merges data entries (owner titles/blurbs, first) with
every other folder GitHub reports (titled from the folder name, then
alphabetical; `reports` and `shared` under /apps/ skipped). `view.js`,
for a folder with no data entry, shows the PDF (or non-index page) found
inside it. `make-pages.js` now also writes `index.html` into hand-made
folders that lack one. So a new map = drop `maps/<slug>/<file>.pdf`, run
the script (or copy the template), commit. `?v=20261022j`.

## 2026-10-22 (ninth pass) — /apps/<slug>/ and /maps/<slug>/ replace /view/

Owner: framed pages live at `/apps/<slug>/` for apps and `/maps/<slug>/`
for maps (reports included: `/maps/austin-golf-courses/`), each folder
with its own `index.html`; `/apps/` and `/maps/` open a page listing all
of that kind; a map folder may hold a PDF instead of a page. Done:
`home.json` gives every app `kind` + `slug` (`reportsKind: maps`);
`tools/make-pages.js` writes the folders from `tools/page-template.html`;
`view.js` reads folder + name from the address; `list.js` fills the two
index pages. `/view/` is gone. The old hand-written `apps/index.html`
(stale "7 apps / 8 story maps" copy) is replaced by the data-driven list;
its text is in git history. The tours now live at `/apps/moontower/` and
`/apps/1885/`; `/moontowertour/` and `/1885murdertour/` redirect there
(tour code still at `app.html` in those folders). The hamburger menu is
unchanged (reports still under Apps > Shopping Apps; only their ADDRESS
is under /maps/). `?v=20261022i`.

## 2026-10-22 (eighth pass) — /moontowertour/ is the framed page too

Owner: "do the same with https://austin.chat/moontowertour/". Same move
as the 1885 tour: `moontowertour/index.html` → `app.html`, framed
`index.html` beside it, `home.json` card has `page` not `slug`,
`view/moontower/` removed. The home-page demo (`/moontower/`) still links
to `/moontowertour/`, which is now the framed page. `?v=20261022h`.

## 2026-10-22 (seventh pass) — /1885murdertour/ is the framed page

Owner: the 1885 tour's framed page must be at its own address,
https://austin.chat/1885murdertour/. The tour's `index.html` is now
`app.html` (nothing else moved, so its `../../webtour` imports and the
sync script's `vendor/` output are untouched) and a framed `index.html`
sits beside it with the window pointed at `app.html` (geolocation and
wake-lock allowed through). `home.json`: the card has `page` instead of
`slug`, `app` is `/1885murdertour/app.html`; `view/1885/` removed;
`shell.js` links to `page` when an app has one. Recipe in CLAUDE.md.
Same move is available for the other apps on request. `?v=20261022g`.

## 2026-10-22 (sixth pass) — menu opens one level at a time; framed page per app

Owner: hamburger → four closed sections → Apps opens to closed categories →
a category opens to its apps; and every app/report opens "with the same
menu, header and footer as index.html but with a different address", for
sharing and QR codes. Done: `shell.js` sections and categories start
closed and fold up when the menu closes; every menu item now points at
`/view/<slug>/`. Those are folders holding one identical file
(`view/template.html`), written by `node tools/make-views.js` from
`home.json` (new `slug` on each app: moontower, 1885, parcels, budget,
datacenters, aisd) and `reports.json` (report id). `view.js` reads the
folder name from the address and loads the app into the window. The hash
deep links (`/#/budget/`) from the fifth pass are gone; `home.js` is just
the reel. Owner said they will fix some names/links. `?v=20261022f`.

## 2026-10-22 (fifth pass) — shell.js: one frame, many pages; deep links

Owner: new Content and Contact pages "based on the homepage", the brand
link to go to `/`, and "many pages" that look exactly like the home page
except the centre, shareable as links. Built as ONE shared frame:
`shell.js` (header + menu + footer + day/night button, loaded at the end of
every page's body) around a page that holds only its `<main>`. `index.html`,
`content/index.html` and `contact/index.html` are now that shape;
`contact.html` is gone (its styles moved into `style.css`). Menu items are
deep links `/#<path>`; `home.js` reads the hash and loads it in the window,
so `https://austin.chat/#/budget/` opens the Budget Map inside the frame
from anywhere. The window is moved with location.replace so the reel and
picks add no history entries (`?v=20261022e`). The Content text is
the old page's placeholder copy, marked as such in the file. `apps/` and
`apps/reports/` keep the old header for now. `?v=20261022d`.

## 2026-10-22 (fourth pass) — Maps is a top-level menu section

Owner: "Maps is top level at the menu", beside Apps, holding the Budget,
Datacenter and AISD maps directly; sub-headings by type of map may come
later. `index.html` has the `Maps` section; `home.js` sends any app whose
`category` is `Maps` there instead of under Apps; `home.json` no longer
lists Maps among the Apps categories. `?v=20261022c`.

## 2026-10-22 (third pass) — Maps category; Contact page and menu item back

Owner: add a Maps section under Apps holding the Budget, Datacenter and
AISD maps, and a Contact item under Content. `home.json` gains the
category `Maps` (listed last) and those three apps carry it; What can I
build here? stays under Culture Apps. `contact.html` is restored from
git exactly as it was (photo, name, phone) with the Services link
dropped from its header, because a Contact menu item needs a page to
land on. No CSS/JS changed, so `?v=20261022b` stands.

## 2026-10-22 (later) — Services and Contact pages deleted; Apps menu is categories

Owner: delete the Services and Contact pages and their menu entries; drop
the word Reports and file the reports under Apps; Apps shows only
categories (Walking/Biking Apps, Shopping Apps, Culture Apps) with the
apps under them, all reports under Shopping Apps; shrink the header and
social bar but keep them usable on a phone. `services/` (both pages) and
`contact.html` are gone (git history has them); their links were removed
from the headers of `apps/`, `apps/reports/` and `content/`.
`scripts/build-list-csv.py` still prints the old lists URL in CSVs it
makes. `home.json` now carries `categories`, `reportsCategory` and a
`category` on each app; Claude put the four civic maps (parcels, budget,
datacenters, AISD) under Culture Apps because only three categories were
named - move them by editing the word. Header is 0.4rem padding with 36px
buttons; footer icons 36px targets with 18px glyphs. `?v=20261022b`.

## 2026-10-22 — home page: hamburger menu replaces the chip bar and card row

Owner: "remove the entire card menu at the bottom … add them as menu items at
the top … Austin.Chat in the middle of the title bar … hamburger menu on the
top left with a secondary menu … put the social media back." Done in
`index.html`, `home.js` and a new block at the end of `style.css`
(`?v=20261022a`). The menu is a panel under the header: Apps (All apps +
every card from `home.json`), Reports (every report in
`apps/reports/reports.json`), Content, Services, Contact. Picking an app or
report loads it in the map window; the ↗ beside it opens a new tab. The
demo reel still cycles the `demo` apps until the visitor picks. The chip bar
and card CSS stay in `style.css` because `parcels/index.html` uses them.
The empty Media chip had no links and is not in the menu. The other pages
keep their old header.

## 2026-10-22 — domain is now austin.chat (anatomy.city expired)

The anatomy.city registration lapsed; the owner moved the site to
austin.chat (CNAME pushed, Cloudflare updated). This session replaced
every `anatomy.city` URL in the repo with `austin.chat`: canonical tags,
home buttons in the map pages and report apps, the webtour copy files,
the QR URL in the report-video builder, the scripts, and the notes in
`docs/`. The TikTok handle `@anatomy.city` is a social account name, not
the domain, so it is unchanged. Older notes that mention austin.chat as
the former chat product (archived 2026-09-09) are about that product,
not this site.


## 2026-09-15 — data centers desktop cut composited (owner to watch)

Owner: "record the datacenters wide take, with the legends open like
before." Checklist step 4b run unchanged against `/datacenters/`; the
engine already keeps both panels open on the desktop layout, so no page
code changed. Scene item `Site page wide` had picked up the 1.78 scale
again from the canvas switch (the trap in the checklist); reset to 1
before the take, scene screenshot confirmed the full frame with the
Layers box and legend open. Take: `C:\Dev\map-exports\datacenters\
2026-09-15 10-55-08.mp4` (1920x1080, 30 fps, 2:10, silent). Contact
sheet checked: site lists from about 3 s, service-area card, water card,
sequence finished by about 110 s. Canvas and scene put back to portrait.
**Trim and composite (same morning, owner: "trim it and do the
composite").** This take runs EARLIER than the phone take, not later: the
first site list appears at 2.57 s here against 4.27 s in the phone take
(measured at 30 fps with `signalstats`: the list card's header strip
`crop=180:30:1700:80` here, the intro card's Play button strip
`crop=400:40:300:1030` there). So instead of trimming, the first frame is
held 1.7 s (`tpad=start_duration=1.7:start_mode=clone`) and the take cut
at 110.3 s, giving `datacenters-wide-take-112s.mp4` on the phone take's
clock: the corridor card comes up at 34.45 s against 34.25 s on the phone,
close enough for the narration. The composite is the 4b command with
HOLD 0, END 107 and the phone recipe's face crop, with ONE change: the
face sits bottom-RIGHT (`overlay=1644:752`), because on this map the
legend is taller than AISD's and the left column scrolls all the way down
to the timeline bar, so 16,752 would cover the lower legend rows. Nothing
lives bottom-right but map (the info button at 1887,1045 is below the
face). Output `C:\Dev\map-exports\datacenters\datacenters-wide-narrated.mp4`
(1920x1080, 30 fps, 1:52, narration audio). Checked by eye at 4 s, the
corridor card, the service-area card, the water card, the finished map,
and either side of the end card. Owner to watch before Substack.

## 2026-09-14 — AISD desktop cut: panels open throughout, ?width= switch

Owner: a full-size AISD video for Substack, "mostly the same as the short
except with the legend panels open for the entire video", and the desktop
map itself should work that way. Done in the engine, so it holds for every
topic map:

- `topicmap/player.js`: the `cards` / `cardsAfter` step keys act only on
  the phone layout (`options.layout().narrow`, passed from app.js). On a
  desktop the timeline opens the Layers box and the legend at the first
  step and leaves both open to the end. The budget page's own app.js does
  not pass `layout`, so its phone behaviour is unchanged there.
- `topicmap/phone.js`: `?width=1280` lays the page out at 1280 CSS px wide
  and scales it to the window (the `?phone` mechanism with any width), so
  a 1920x1080 browser-source take is 1280x720 at 1.5x: readable type and
  dots, both panels down the left, story card top-centre, site list
  top-right. Address for the take: `/AISD/?play&width=1280`.
- `AISD/map.js` and `topicmap/app.js` comments; engine assets at
  `?v=20260914k` on all three pages.

Checked headless (1920x1080, `?play&width=1280`): both cards report open
at every step, no console errors, every file 200; screenshots of a reveal
and a story step look right (left column 414 px wide ending at y 745, bar
at y 1018). `?phone` still folds the cards as before.

**The take and the cut (same day, after the owner opened OBS).** Scene
`Site landscape` with browser source `Site page wide` (1920x1080) created
in OBS; canvas switched to 1920x1080 for the take and back to 1080x1920
after. First take was the page at half size in the corner: the source had
been created on the portrait canvas and kept that scale (trap now in the
checklist; fix is `SetSceneItemTransform` to scale 1). Second take
`C:\Dev\map-exports\aisd\2026-09-14 16-41-15.mp4` (2:17, full frame);
trimmed from 1.0 s to `aisd-wide-take-119s.mp4` (school list at 0:02.0 as
in the phone take). Composite with the same narrator file, face 260 px at
16,752, no chin trick, end card from 114 s (the last story card leaves at
114.0 s here, measured): `C:\Dev\map-exports\aisd\aisd-wide-narrated.mp4`
(1920x1080, 30 fps, 1:59, narration audio). Checked by eye at the legend
beat, a reveal, two story cards, and either side of the end card. Owner to
watch it before it goes to Substack.

## 2026-09-14 — budget map on the topic map layout, one timeline per topic

Owner: "do the budget map next ... fix the map to be like the previous ones
where the controls are along the top and the legends have arrows to close
them, with most things to the left ... a separate timeline for each of the
topics in the 2027 Budget Topic dropdown."

`/budget/` now uses the shared stylesheet (`../topicmap/style.css`, accent
`#b2182b` in its own two-line `style.css`), the `?phone` switch
(`topicmap/phone.js`, split out of the engine's app.js so a page with its
own map code can use it) and the shared player. Layout: controls in a row
top-left (satellite, zoom, extents, 3D), then the topic dropdown, the
summary link, the Layers box and the legend, each folding with the arrow;
home link top-right; title centred. The map code stays the page's own
`app.js` (PMTiles themes, not points, so `topicmap/app.js` does not apply).

**Timelines.** `budget/timelines.js` holds one step list per topic; the
player is rebuilt when the dropdown changes (`MAP_PLAYER.init` now returns
`destroy()`, and takes `intro: false` so the intro shows once). Step keys
this page adds: `camera` ('austin' / 'downtown'), `pitch`, `months`
(plays the permits slider), `show`/`hide` for `zip` / `council`. Address
`?play&phone#<topic>` records one topic. The step lists are a SKELETON:
each topic shows its About text (what, how) as two cards plus one
topic-specific placeholder card; the owner decides what each story walks
through. Placeholder card text is marked in `copy.js` `player`.

Checked headless (`?phone`): no errors, all seven topics swap their legend
and timeline, one player at a time, cards fold, phone zoom applied. Assets
at `?v=20260914j` (topicmap files too, in all three pages). Not recorded.

## 2026-09-14 — topic map engine lifted into /topicmap/, new-map checklist

Owner: "do the lift and the checklist" (after a readback that the formula
was documented but the page step was a copy, not a template). Done:

**The lift.** `/topicmap/app.js`, `/topicmap/player.js` and
`/topicmap/style.css` are now the one engine both `/datacenters/` and
`/AISD/` run on; the two folders' `app.js`, `player.js` and full
`style.css` are deleted. What each page keeps is its own: `config.js`
(`window.MAP_CONFIG`; `points`, `categoryField`, `categories`,
`pointRadius`, `pointLabel`, overlays with `colorBy: 'category'`),
`copy.js` (`window.MAP_COPY`; the legend rows are `category`), a two-line
`style.css` (the accent colour) and a new `map.js` (`window.MAP_PAGE`:
`column`, `popupHtml`, `steps`, `frame`, `playDelay`, and for the data
centers `legendExtra` for the size key). The step keys are documented at
the top of `topicmap/player.js`; `only` and `hold` (AISD's additions) now
work on both maps. `window.topicMap` is the map object for the browser
console. Layer ids are `points` / `point-labels` on both pages. Assets at
`?v=20260914h`.

**Verified** headless (Playwright + SwiftShader WebGL, local server): the
DOM state at load and at every timeline tick, desktop and `?phone`, is
byte-identical before and after the lift on both maps (checkboxes, cards,
headings, list rows, button states, ticks, zoom); no console errors, no
failed requests; layer list, dot radius and label expressions as before;
the legend filter reaches the role-tinted zones; a real click on a dot
opens the popup; `?play&phone` autoplays with no intro; screenshots of a
story step on each map look right (own accent, phone layout).

**Fixed the same day:** `datacenters/data/datacenters.geojson` had no `id`
property (the id is the GeoPackage's FID column, which ogr2ogr drops), so
the row number on each dot and the "N." in the popup heading were empty
since the export. Re-exported with `-sql "SELECT id, * FROM data_centers
ORDER BY id"`: same 47 sites, same coordinates, ids 1-47. Data at
`?v=20260914i`. Any future re-export needs that `-sql` clause.

**The checklist.** `docs/new-map-checklist.md`: the order of work for the
third map: page (files to create and what to fill in), take (OBS
commands), narration (length rules), composite (the four things to
measure, with the values from both maps, and the ffmpeg command as
variables), close-out. `CLAUDE.md` now points there first.

## 2026-09-12 (night) — AISD school closures map at /AISD/

Owner: "do the AISD school closures one, same 2 agent limit" then "put the
school closures map up at austin.chat/AISD too". Same two-agent research
pattern as the data centers (researcher → fact-checker, 209 tool calls),
source note with every link in the private `atxmapdata/qgis-lab` repo,
`notes/aisd-school-changes-2026.md`; QGIS project there too.

`/AISD/` (folder name as the owner wrote it; Pages is case-sensitive) is a
MapLibre page on the same bones as `/datacenters/`: 60 campuses touched by
the district's 2025 closure and consolidation plan as dots coloured by role
(closing, closing-and-receiving, receiving, program moves, boundary change,
taken off the list, other), the pre-plan attendance zones of the closing and
receiving schools tinted by the same colour, and a dashed line from each
closing school to where its students go. Legend checkboxes per role hide
dots and zones; Layers box has zones, links, city limits, council districts.
Popups: type, role, address, effective year, enrollment, capacity (district
figure if published, else the city campus layer's), linked schools, future
use, district reason, plan history, community response, who attends, source
links. About panel carries the plan timeline (`data/timeline.json`). Map
opens fitted to the campuses.

**Data.** `AISD/data/`: `campuses.geojson`, `zones.geojson`, `links.geojson`,
`timeline.json` exported from `C:\GISData\austin\boundaries.gpkg` layers
`aisd_changes_campuses` / `_zones` / `_links` (built 2026-09-12 from the
research joined to the city's AISD campus and attendance layers); city
limits and council districts are copies of the data centers page's files.
An "AISD School Closures" card (blurb empty) is on the home page's Apps
chip. Asset version `?v=20260912a` (its own). Every word on the page is a
placeholder in `AISD/copy.js`. Not verified in a browser (see the data
centers note on headless WebGL); the owner should open it and click a dot.

## 2026-09-14 — AISD narrated cut

Owner supplied the narrator (`C:\Dev\map-exports\animate_aisd.mp4`, emoji
face on white, 1:54, narration audio) and asked for it bottom-left like the
data centers cut. Composited with the same graph (`docs/datacenters-
recording.md`), re-measured for this take: face crop 486x482 at 269,314,
circle centre 242,240; bottom text card window 37.25-112.25 s; end card
"Navigate map / and sources at / austin.chat/AISD" from 113 s. Narration
runs 2.0-115.9 s inside the 1:59. Output:
`C:\Dev\map-exports\aisd\aisd-short-narrated.mp4` (1080x1920, 30 fps, 1:59).

## 2026-09-14 — AISD take at 1:59, narration draft

Owner: legend card open from the first frame for 2 s, then the schools;
trim the end to 1:59; and a narration to match. Done: legend beat 3 s and
the sequence starts 0.5 s after load in `?play` mode (`AISD/player.js`,
`?v=20260914c`); recorded and trimmed to exactly 119 s:
`C:\Dev\map-exports\aisd\aisd-take-119s.mp4` (the school list appears at
0:02.0, measured from the video). Narration draft with timings at
`docs/aisd-narration.md` (owner edits; the narrator composite then follows
`docs/datacenters-recording.md`, re-measuring the card window and the
face crop for the new animation).

## 2026-09-14 — AISD sequence tuned after the preview

Owner, after watching the preview: story steps show only the closing and
receiving schools; no intro card in the recording ("that is really just
for when the user actually goes to the map"); show the legend card for two
sections (10 s) before folding it and starting the school lists. Done in
`AISD/player.js`: steps now take `only` (the roles shown from that step
on) and `hold` (a step length in ms); a 10 s legend step opens the
sequence over the full map; the story cards use closing + closing-and-
receiving + receiving, and the "Taken off the list" card adds the grey
dots it talks about; `?play` now removes the intro at once and starts
3 s after load (applied to `datacenters/player.js` too, so the formula
stays one thing). Sequence: 3 s + 10 s + 7 x 5 s + 5 x 15 s = 123 s.
Re-recorded: `C:\Dev\map-exports\aisd\2026-09-14 07-04-13.mp4` (1080x1920,
30 fps, 2:12, silent) for the owner's review before narration.

## 2026-09-14 — AISD map rebuilt on the data centers formula (owner to review)

Owner: "Lets make that the formula going forward. Can you setup something
similar for the AISD map, do the timeline first, paced the same way ...
Add the same map controls positioned the same way, have the timeline at
the bottom ... add relevant text boxes explaining everything and I'll
review it before we move to the OBS portion ... about 2 minutes long."

`/AISD/` now shares the data centers page's bones file for file:
`style.css` is a copy (accent blue instead of purple, plus the About
timeline list rules); `index.html` has the same top-left controls, Layers
and legend cards with fold arrows, title centred, home link top-right;
`player.js` is the same player with this map's steps; `app.js` is the same
app with roles instead of statuses, the plan's zones tinted by role
(`colorBy: 'role'` in `config.js`, and the legend checkboxes filter them
too), dashed links with a popup (from, to, share, detail), `?phone` mode
and per-step re-framing: on phones the campuses are fitted below the site
list during the reveals and above the text card during the story, so
nothing hides under a card. Zone labels dropped (the dots carry the names).

**Sequence** (4 s intro + 7 reveals x 5 s + 5 cards x 15 s = 114 s, about
2:00 with the end hold): Closing (11) → Closing and taking students (2) →
Receiving (16) → Boundary change (2) → Program moves (7) → Taken off the
list (18) → Other (4) → "Why the plan" (zones on, Layers box flashes) →
"Where students go" (links on) → "South Austin" (zoom to Becker, Dawson,
Galindo, Zilker, Sunset Valley, Boone, Cunningham, Odom, Pleasant Hill) →
"Taken off the list" (zones and links off) → "What happens next" → Complete.
The five paragraphs are DRAFTS in `AISD/copy.js` (from the research note
and the data; 55-70 words each) for the owner to edit; the intro card
reuses the owner's data centers wording with the map's name. Assets at
`?v=20260914a`. Checked headless (desktop and `?phone`): no errors, cards
and layers switch as designed. NOT recorded yet; the owner reviews first,
then the OBS recipe in `docs/datacenters-recording.md` applies unchanged
(browser source URL `https://austin.chat/AISD/?play&phone`). Preview
take made the same morning for the owner's review, before narration:
`C:\Dev\map-exports\aisd\2026-09-14 06-45-53.mp4` (1080x1920, 30 fps, 2:04,
silent; OBS recdir now `C:\Dev\map-exports\aisd`).

Note for a third map: the player and app are now duplicated in two folders.
When the next map needs them, lift the shared parts into one file under the
site root rather than copying a third time.

## 2026-09-14 (narrated cut) — emoji narrator composited

Owner supplied `C:\Dev\DataCenters\datacenter_animation.mp4` (emoji face on
white, narration audio, 1:46) and asked for it in the left corner, background
transparent, from second 2 to the end. Done with one ffmpeg graph (colour key
plus a circle mask so the white teeth survive), bottom-left at 300 px, audio
delayed 2 s; while the bottom text card is up (34.25-94.5 s, measured from
the take) only the chin below the card's edge is drawn, so the card "covers"
the face and it keeps playing. Then (owner): hold the end a few seconds so
the narration finishes, and a centred three-line end card from the last
second — "Navigate map" / "and sources at" / "austin.chat/datacenter"
(owner confirmed the missing s was a typo; re-rendered as
"austin.chat/datacenters"). Output is 1:52: `C:\Dev\map-exports\datacenters\datacenters-short-narrated.mp4`.
Command and the re-measuring note are in `docs/datacenters-recording.md`.
The animation file sits untracked in the TX-31 repo folder; media should
live in `C:\Dev\map-exports`, not a repo.

## 2026-09-14 (narration) — script draft, process pinned

Owner: "that looks good, let's record this process for the other videos.
Can you write a script to narrate this 1:40 min long." Done: the recording
process is now pointed to from this repo's `CLAUDE.md` (so every future map
page gets `?play`, `?phone`, container queries, OBS browser source), and a
timed narration draft is at `docs/datacenters-narration.md` (11 lines, one
per timeline step, ~250 words; owner edits).

## 2026-09-14 (recording, second pass) — ?phone mode: the phone look at 1080x1920

Owner, on the first take: "How do we make that easier to see. If I look at
this map on my phone it looks a lot better ... I want to make a lot of these
for different topics so need to figure out the right process." The first
take rendered the desktop layout at 1080 px wide. Fix: `?phone` (app.js)
zooms the page to phone proportions (393 CSS px wide) and draws the map at
the matching pixel ratio; style.css switched from media queries to
container queries on `.page` so the phone layout follows the zoom; phone
text cards now sit at the bottom above the timeline (panels stay visible at
the top, so the Layers flash shows). Verified identical to a 393x699 @ 2.75x
phone emulation. The general process for future topic maps is written in
`docs/datacenters-recording.md`. Assets at `?v=20260914g` (the phone site
list also moved under the panel bars). Final take of the night:
`C:\Dev\map-exports\datacenters\2026-09-14 02-37-04.mp4` (1080x1920, 30 fps,
1:48, silent; trim the first ~4 s of loading and intro card).

## 2026-09-14 (recording prep) — portrait layout, ?play

For the owner's 9:16 OBS recording: in portrait viewports the text card sits
below the folded panel bars (`style.css` orientation query) and the corridor
zoom leaves 420 px of headroom (`app.js`); `?play` in the address dismisses
the intro and starts autoplay 4 s after load (`player.js`), so a browser
source can run the sequence with nobody clicking. Assets at `?v=20260914e`.
Recorded the same night: OBS **browser source** at 1080x1920 (a Chrome
window cannot be taller than the 1080 display), scene `Site portrait`,
profile `wcibh-phone`; first take `C:\Dev\map-exports\datacenters\2026-09-14
02-03-33.mp4`. Recipe: `docs/datacenters-recording.md`.

## 2026-09-14 (night) — data centers panel open at load

Owner: the "Data centers in and around Austin" panel is open when the map
loads (behind the intro card), folds when Play is clicked, stays open on
Navigate Map. Done in `app.js` (load state) and `player.js` (the sequence's
starting card state; step 1 already folds it). Assets at `?v=20260914d`.

## 2026-09-14 (evening) — intro card, 4-row site lists

Owner: site lists show 4 rows with a scrollbar; the data centers panel folds
as soon as the first popup appears (no overlap); an intro card centred on
the map reads "Austin Area Data Center Map" / "Play the animation from here
or anytime from the timeline on the bottom" with a Play button (card goes,
sequence starts) and a Navigate Map button (card goes, both panels open).
Done: `copy.js` `intro` block holds the owner's words verbatim; `player.js`
builds `.intro` and removes it on either button or any timeline move; step 1
carries `cards: { legend: false }`; `.is-list .sequence-body` is capped at
152 px; both panels start folded again (`app.js`). Assets at `?v=20260914c`.

## 2026-09-14 (later) — card choreography, "the last fix"

Owner: data centers card open when the map loads, folding after the first
reveal; the Layers box opens with the Austin Energy text card and folds 2 s
later while the text stays. Done: `app.js` opens the legend and folds Layers
on load; `player.js` step 2 carries `cards: { legend: false }`, the service
step `cards: { layers: true }` plus `cardsAfter: { delay: 2000, cards:
{ layers: false } }` (a timed second state; the cumulative walk treats earlier
steps' timed changes as done, and the timer is cleared on every seek).
Assets at `?v=20260914b`.

## 2026-09-14 — title, city limits at load, 5 s / 15 s timing

Owner: Austin city limits showing when the map loads; 5 s per data center
reveal, 15 s per text card; the Austin Energy card turns the city limits off
and the service area on; title "Austin Area Data Centers". Done in
`config.js` (city on, service off at load — the service area now first
appears at its own step), `player.js` (step 1 shows `city`, the service step
hides it; `stepMs()` per step and the ring drains over that step's length),
`copy.js` + `index.html` (title). Assets at `?v=20260914a`.

## 2026-09-13 (evening) — site list back right, 10 s steps, countdown ring

Owner: only the TEXT boxes were meant to be centred; the site list returns
to the top-right. Every tick now holds 10 s on autoplay (was 3 s, text 8 s),
and a small countdown ring sits to the right of the ticks: an SVG circle
whose accent stroke drains over the step and freezes on pause
(`player.js` drawClock/runClock, `.player-clock` in `style.css`). The card
gets class `is-text` on text steps, which is what centres and enlarges it.
Assets at `?v=20260913q`.

## 2026-09-13 (latest) — story card centred, cards fold, text halved

Owner: the draft copy is acceptable ("copy is fine here ... I just don't want
you to write ad copy or creative writing"); cut the four paragraphs in half;
centre the text box and enlarge the font; add a 5 s pause after a text box;
both arrow cards start closed, the data centers card opens when the timeline
starts, and at the Austin Energy step it closes and the Layers box opens.
Done: paragraphs 62–79 words each; `.sequence-card` centred at the top
(560 px, 15 px body, 20 px heading); text steps hold 8 s instead of 3 s;
`app.js` exposes `DC_SET_CARD` and folds both cards on load; `player.js`
steps carry `cards: { legend, layers }`. Assets at `?v=20260913p`.

## 2026-09-13 (later) — timeline resequenced, draft story text

Owner (after reviewing the live map): the steps should show the status
categories, zoom to the Hutto area with text on why it attracts data centers,
fold the data centers card away for room, switch on the Austin Energy area and
zoom out, then the transmission lines and substations with their significance,
then close those and do the same with the most important water layers; and the
timeline should have tick lines without numbers.

Sequence now (`player.js`): Ready → six status reveals → "Round Rock to
Taylor" (corridor camera, paragraph) → "Austin Energy service area" (legend
collapsed from here on, `service` on, camera back to overview) →
"Transmission and substations" (`transmission` + `substations` on) → "Water
resources" (electric off; `aquifers`, `gcd`, `intakes` on) → Complete. The
"Austin city limits" and "Regional overview" steps were dropped. Overlays start
OFF inside the sequence (the plain map still opens with Austin Energy on).
Steps support `collapseLegend`; ticks are bare bars (`style.css`).

**Text.** At the owner's explicit request this session, Claude DRAFTED the
four paragraphs in `copy.js` (`corridorText`, `serviceAreaText`,
`electricText`, `waterText`) from the research note and the layers
themselves — no new web research. They are marked as drafts; the owner edits
every word. Facts to double-check before publishing as final: the 345 kV path
names come from HIFLD's SUB_1/SUB_2 fields and OSM; "the corridor lies in no
groundwater district" is from the TWDB layer at three test points; water-use
figures are the tracker's estimates quoted in the note. Assets bumped to
`?v=20260913n` (copy, player, style).

## 2026-09-13 — electric and water context layers on /datacenters/

Owner: no new Supabase project for the TX-31 "District Anatomy" spec
(`C:\Dev\DataCenters`), parcels skipped; instead "add the water and electric
resources as geojsons held on github and put them on the map ... as part of
the map timeline animation that will explain the important considerations".
The map covers all data centers around Austin now, not only TX-31, so the
layers are clipped to a region box around the mapped sites
(lon -99.0..-96.2, lat 29.2..31.7). NOT PUSHED: committed locally only, on
the owner's instruction.

**Data pipeline (two scripts, both plain and re-runnable).**
1. `C:\GISData\scripts\fetch_energy_water.py` (run with
   `C:\OSGeo4W\bin\python-qgis-ltr.bat`) pulls twelve public layers into two
   new GeoPackages and records each in `catalog.json`:
   - `austin\energy.gpkg`: `transmission_lines` (HIFLD, 855 lines, 115–345 kV),
     `power_plants` (EIA-860M July 2026, 185 plants, 135 operating, summed per
     plant from the generator rows), `substations_osm` (OpenStreetMap, 814,
     ODbL — community data, attributed on the map).
   - `austin\water.gpkg`: TWDB `major_aquifers`, `minor_aquifers`,
     `groundwater_districts`, `water_planning_areas`; USGS `watersheds_huc8`;
     TCEQ `surface_water_intakes`, `pws_reservoirs`, `wastewater_outfalls`,
     `water_rights_points` (3,383 diversion points, library only).
   Gotchas met: the Overpass mirrors 406/504 at random (the script now
   retries across two mirrors); ArcGIS paging is by `resultOffset`; QGIS
   keeps the downloaded page files open until it shuts down, so the temp
   cleanup runs twice.
2. `scripts/build-datacenters-layers.sh` (WSL, ogr2ogr) exports nine of them
   to `datacenters/data/*.geojson`: WGS84, 4-decimal coordinates, simplified
   (tolerances are in FEET because ogr2ogr simplifies in the source CRS),
   clipped to the region box, trimmed fields. About 2.8 MB in all; the
   biggest is major_aquifers at 650 KB. Substations are exported only at
   69 kV and up; intakes only with TCEQ status O. Re-run it after the fetch
   script, then bump the `?v=` in `config.js` for the files that changed.

**Map changes.** `config.js` overlays now carry `group` (electric / water /
boundaries — headings in the Layers box), `kind` (polygon / line / point),
and per-kind style: line width or point radius stepped by a field, `hollow`
for planned plants, `popup` field list. `app.js` draws polygons under lines
under points, gives lines and points a small popup (labels from
`copy.js.fields`), and shows a swatch per row. `player.js` steps can now
`show` and `hide` lists of overlays; two new steps — "Electric grid" (lines,
plants, substations on) and "Water resources" (aquifers, districts, intakes,
outfalls on; electric off) — sit before "Round Rock to Taylor", each with a
PLACEHOLDER paragraph in `copy.js` for the owner to replace. Assets bumped
to `?v=20260913m`. Checked headless: no console errors, every file loads,
steps 9–11 switch the expected layers.

**Left for the owner.** All copy (step paragraphs, layer labels, the About
sources sentence). Styling is a first pass: aquifer fill 0.14, GCD outlines,
labels per polygon part. Not exported (library only): minor aquifers, PWS
reservoirs, water-rights points, planning-area labels beyond names.

## 2026-09-12 (late) — data centers map at /datacenters/

Owner: "can you make a maplibre map of this datacenter map and put it up at
austin.chat/datacenters". `/datacenters/` is a MapLibre page built on the
same bones as `/budget/` (home link and control column top-left, legend
top-right, every word in `copy.js` as Claude's placeholders for the owner).
It shows the 47 current and planned data centers researched the same day
(two-agent web research pass; the source note with 134 links is in the
private `atxmapdata/qgis-lab` repo, `notes/austin-datacenters-2026.md`).

**Data.** Two plain GeoJSON files in `datacenters/data/` (about 80 KB
together, no tiles, no database): `datacenters.geojson` exported from
`C:\GISData\austin\planning.gpkg` layer `data_centers`, and
`austin_energy_service_area.geojson` from `boundaries.gpkg` (City of Austin
open data w5fd-ctq4). Re-export with ogr2ogr from the library if the
research is refreshed.

**What the page does.** Dots coloured by status (six classes, same palette
as the QGIS project), sized by MW, numbered by the research-note row id.
The legend has a checkbox per status with a count; unticking hides those
dots. The Austin Energy service area draws as a purple dashed outline (on by
default, Layers box) so the reader sees that every Williamson County campus
sits outside it. Later the same evening (owner): the Layers box grew three
more overlays — Austin city limits (full + limited purpose, from
`boundaries.gpkg` `austin_jurisdictions`), council districts and ZIP codes
(103 Central Texas ZIPs) — all OFF by default, Austin Energy still on; each
is a GeoJSON in `datacenters/data/` (ZIPs 0.56 MB, the rest small), drawn as
a tinted fill, dashed outline and a haloed number label. And the map now
opens fitted to the sites' bounding box, the extents button refits it, and
the pan cage is that box grown half a degree (`config.js` `fitPadding`,
`cagePad`); app.js reads the sites file before building the map. Version
`?v=20260912c` (b was poisoned: a curl probe hit the new query string before
the Pages deploy finished and the CDN cached the old file under it for four
hours — never probe a new `?v=` until the deploy is done). Clicking a dot opens a popup: operator, status, address,
place, MW, size, year, point precision, the research notes, and the source
links. Satellite, zoom and extents buttons as on the budget page; the map
is caged to a box from New Braunfels to Temple and Rockdale. A "Datacenter
Map" card (title from the owner's words, blurb empty) is on the home page's
Apps chip. Asset version `?v=20260912a` (its own).

**Not verified in a browser.** Headless Chrome on this machine renders a
blank MapLibre canvas for `/budget/` too (WebGL in headless), so only the
page chrome and the JS syntax were checked; the owner should open the page
and click a dot. Every word on the page is a placeholder in
`datacenters/copy.js`.

## 2026-09-12 (evening) — budget map: Layers box with two overlays

`/budget/` has a "Layers" box under the map controls with two checkboxes, ZIP codes and council districts, both OFF by default (owner's ask). They are plain GeoJSON files in `budget/data/` (0.85 MB and 0.58 MB), exported from the GIS library by the budget repo's `scripts/96_export_overlays_geojson.py`, drawn as dashed outlines with a number label. The council outline that used to draw automatically on the two tax themes is gone; the checkbox owns it now. Wording for the box is placeholder in `copy.js` (`ui.overlays`, `ui.overlayZip`, `ui.overlayCouncil`). Styled the same evening: each polygon tinted at 25% from a ten-colour palette (`config.js` `overlayPalette`, number modulo 10), solid coloured outline, bold label with a 2.5 px white halo. Cache key bumped to `v=20260912i`. The tiles were also re-uploaded earlier today with the drainage parcels filtered to the city limits.

## 2026-09-12 — the FY 2026-27 budget map at /budget/

Owner: "Can we make a maplibre map of this QGIS project and put it online on a
page on the austin.chat site?" and, on data: "We have a parcel database on
Supabase ... it's better to not make that database larger."

`/budget/` is a MapLibre page with the seven maps built in
`projects/atxmapdata/Austin2026Budget` (tax base change, city tax bill change,
drainage charge, building permits by month, capital projects, Atlas 14 flood
study areas, landmark exemptions). One theme at a time, chosen from a row of
buttons along the bottom; the legend sits top-right; the permits theme has a
month slider with a play button. Clicking a feature opens a popup.

**Data, and where it lives.** Everything the map draws is three PMTiles files
(`budget_fy27.pmtiles` for the small layers, `budget_fy27_tax_bill.pmtiles`
and `budget_fy27_drainage.pmtiles` for the two parcel layers, zoom 11-14) in
the public `tiles` Storage bucket of the cityanatomyservices Supabase project
— the same bucket the parcels app's tiles live in, chosen because it already
serves the range requests PMTiles needs and because it keeps the tiles off
GitHub Pages. Three files rather than one because the project's storage
setting caps uploads at 50 MB each and that setting was left alone. **Nothing was added to
the parcel database.** The one thing the page reads from the database is
`parcel_appraisal_history` (2021-2026 taxable values, already there, keyed by
the same TCAD property id the roll uses), shown in the popup on the two tax
themes. The parcel layers are only in the tiles from zoom 11, so a hint shows
when zoomed out on those themes.

**Files:** `budget/index.html`, `app.js` (map, themes, legend, popups),
`config.js` (tile URL, colours, breaks), `style.css`, and `copy.js` — **every
word on the page is in copy.js**; the strings there are Claude's working
placeholders for the owner to replace. The build scripts (`92_export_pmtiles.py`,
`93_upload_tiles.sh`) are in the budget repo, not here.

Later the same day (owner): the theme chips became a dropdown top-left under
the home link, labelled "2027 Budget Topic", with a "CityAnatomy Budget
Summary:" card under it that opens `budget/summary.html` — the two volume
analyses and the adopted-changes note as one page, generated by the budget
repo's script 95, with a slide-out contents panel whose handle is always
visible (open on desktop, closed on a phone). A "Budget Map" card is on the
home page's Apps chip (title from the owner's words; blurb left empty).
Then, over several messages: the map opens close in on downtown (zoom 13,
where the parcel tiles draw); a control column sits on the left under the
summary card — Satellite (the Esri imagery the report maps use), zoom in,
zoom out, extents (fits a box a little wider than the full-purpose city),
and 2D/3D (tilt only); the map is caged to that same box and cannot zoom out
past it; the legend is top-right. Asset version `?v=20260912g`.

**Pick up here.** The page has not been through a phone check. Every word on
the page is a placeholder in `budget/copy.js` for the owner to replace, and
the home card's blurb is empty. If the parcels look rough when zoomed in past
14, rebuild the two parcel tile files with less simplification (budget repo,
script 92) — each is then likely to brush the 50 MB storage limit. Cache version for `/budget/` assets:
`?v=20260912a` (its own, separate from the site-wide one).

## 2026-09-11 — two reports deleted; the data panel starts closed

Owner: "please delete everything from the city councils map and delete the
neighbors map the first 2 cards of the reports" — and "right now the tables that
open from the side are open by default, have them be closed by default."

### Deleted: cards 1 and 2

Confirmed against `reports.json` before touching anything: card 1 was
`austin-chambers` (Austin-Area Chambers of Commerce — the "city councils" one)
and card 2 was `austin-neighborhoods`. Both are gone, 4.1 MB in total, along
with every reference:

- **`apps/index.html`** — **four** cards, two per report. Each still appeared in
  both the "Map Apps" section and the duplicate "Shopping Reports" section
  below it.
- `apps/reports/reports.json` and `apps/reports/index.json`.
- `content/report-videos/` — the `render:chambers` and `render:neighborhoods`
  scripts, both `reports/*.json` video configs, and the `promo-light.html`
  template mapping for neighborhoods in `GUIDE.md`.

**Six reports remain:** horseback riding, golf courses, bike shops, vintage
guitar, toy stores, pool openings. The home page's Reports carousel now opens on
horseback riding.

### The data panel starts closed

`.page` carries `panel-closed` from the start, and the handle's `aria-expanded`
and label start at "Show the list" to match. The map is what the page is for; the
list waits until the handle is pulled.

The table is still **built** on load — only hidden — so pulling the handle is
instant rather than a wait while rows render.

Verified across the six survivors: all four deleted URLs 404; the panel is off
screen on load with `aria-expanded="false"` and its rows already built (46, 5,
20, 17, 8, 9); the Satellite button sits at x=12 with the panel shut and steps
clear of it when opened; the title is centred to the pixel; `/apps/` is 9 cards
with every link resolving 200; the reports listing is 6; no console errors.

Cache version `?v=20260911a`.

## 2026-09-10 — map controls, a GPS button, satellite, and a cage around the data

Owner, across four messages: a zoom +/− on the right with a simple north arrow
above it, an extents button below, a 2D/3D button below that "that just adjusts
the tilt", a home button above the zoom that returns to austin.chat; the maps
should "only zoom out to the extents as a limit, and not go anywhere past the
extents of the data"; a GPS button; a satellite button in the left corner. And
later: "the extents doesn't have to be exact you can do a little further out."

**The stack, top to bottom on the right:** home, north, zoom in, zoom out,
extents, 2D/3D, GPS. **Satellite** sits on its own in the top-left corner.

- **Home** is a plain `<a href="https://austin.chat" target="_top">`. The
  `_top` matters: this page also plays inside the window on the home page, and
  without it the whole site would load into that small frame.
- **North** turns with the map — the arrow is rotated by the live bearing — and
  clicking it eases the bearing to 0 while leaving the tilt alone.
- **2D/3D** changes pitch and nothing else, as asked: 0 ↔ 55°. It does not touch
  3D buildings, satellite or terrain.
- **GPS** uses MapLibre's own `GeolocateControl` for the permission prompt, the
  blue dot and the accuracy ring; that control's own button is hidden by CSS and
  the one in the stack triggers it, so the behaviour is MapLibre's and the look
  is ours.
- **Satellite** is the control that was already in `app.js` — `initSatellite()`
  is simply called again.

### The cage, and the two bugs behind it

`lockToData()` sets `maxBounds` and a `minZoom` so you can neither pan off the
data nor zoom out past it. Getting it right took three goes, and the reason is
worth keeping:

1. First attempt caged the **data's own bounding box**. The extents button then
   fitted 15 of golf's 20 courses — MapLibre keeps the viewport inside
   `maxBounds`, and a fit that wanted more room than the cage got clamped.
2. Widening the cage to 40% barely helped, which was the clue: **these data sets
   are tall and narrow and the screen is wide.** Vintage guitar spans 0.09° of
   longitude but needs 0.66° of screen to show. A cage cut to the data box is
   therefore far *narrower* than the view that shows the data, so MapLibre
   answered by zooming **in** — cropping four of its nine shops.
3. The fix: **build the cage from the viewport, not the data.** Turn the cage
   off, ask `cameraForBounds` what shows everything, jump there flat and
   north-up, read what the screen actually covers, grow it 10%, and cage *that*.
   `minZoom` is that same camera's zoom. Both are recomputed on resize, since
   how far out you must go depends on the size of the window.

Also fixed on the way: `fitMapToFeatures()` was forcing `pitch` and `bearing`
back to CONFIG's values, so changing a filter yanked the map out of whatever
tilt the visitor had chosen. Those two lines are gone; the opening view still
gets `CONFIG.pitch` from the map's constructor, and after that the camera angle
belongs to the visitor.

And a CSS trap worth remembering: `--panel-w` is `clamp(260px, 28%, 400px)`,
which is right for the panel, where the 28% is measured against the page. But
the Satellite button had to step aside by the same amount, and **a percentage
inside `translateX()` is measured against the element's own width** — on that
little button the clamp floor won and it shifted 260px instead of 358, staying
under the panel. `app.js` now publishes the panel's measured width as
`--panel-px` for anything that needs to move by it.

Verified across all eight maps: extents now frames **every** point (46/46, 5/5,
5/5, 20/20, 17/17, 8/8, 8/8, 9/9), the cage holds both zoom and pan against a
deliberate escape attempt, the stack is in the right order with the right home
link, satellite toggles its layer and clears the panel on desktop, and there are
no console errors. On a phone the panel covers 84% so the Satellite button stays
put behind it, by design.

Cache version `?v=20260910p`.

## 2026-09-10 — the PS5 Slim Bundles report is deleted

Owner: "let's delete the PS5 bundles report and maps, it is very dated."

Removed `apps/reports/austin-ps5-bundles/` (2.0 MB — map app, `data.geojson`,
the written `report.html`, `promo.mp4`, favicons) and every reference to it:

- **`apps/index.html`** — two cards, not one. The second lived in the "Shopping
  Reports / 8 story maps" section and had been pointing at the same map app since
  the story maps came out, so it was a duplicate of the first.
- **`apps/reports/reports.json`** — the entry that drives the home page's Reports
  carousel and the reports listing.
- **`apps/reports/index.json`** — its entry (see the note below).
- **`content/report-videos/`** — the `render:ps5-bundles` script in
  `package.json` and the `reports/austin-ps5-bundles.json` video config.

Verified: both old URLs now 404; the home Reports carousel is 8 cards with no
PS5; `/apps/` is 13 cards with no PS5 and **every one of its links resolves 200**;
the reports listing is 8; no console errors.

**Two things for the owner, both pre-existing and both on-screen text, so left
alone:**

1. `/apps/` still says **"7 apps"** and **"8 story maps"** above its two sections.
   Neither count was right before this deletion and neither is right now. More to
   the point, the whole "Shopping Reports / 8 story maps" section is now a
   **duplicate** — since the story maps were removed, every card in it links to
   the same map app as the card above it in "Map Apps". That section probably
   wants deleting outright rather than recounting.
2. `apps/reports/index.json` is **dead** — nothing on the site reads it. It was
   already stale before today: it lists `template` as if it were a report and is
   missing `austin-toy-stores` and `austin-vintage-guitar`. It can be deleted
   whenever; I only took the PS5 line out rather than make that call.

Cache version `?v=20260910m`.

## 2026-09-10 — filter dropdowns in the sidebars

Owner: "now give each of the sidebars 2 different drop downs each that will
filter the data, pick any 2 but types are better than locations, something with a
discreet number of items to select so dropdown isn't too long. I just want to get
the basics working."

**The basics work.** Changing a dropdown re-filters the map and the table
together — verified by counting rendered markers, not just rows: toy stores go
8 → 2 markers with 2 rows, golf 20 → 3 with 3 rows.

Almost nothing new was written. `buildFilters()`, `getUniqueValues()` and
`applyFilters()` were all already there and already wired (`change` →
`applyFilters` → `updateMap` + `updateTable` + `updateCount`). It needed the
`<div id="filters">` back in the panel and a sane choice of field per report.

**Two real bugs came out of switching it on:**

1. **Numeric fields filtered to nothing.** A `<select>` value is always a string,
   and `applyFilters` compared with `===`, so golf's `Holes` (the number 18, not
   `"18"`) never matched and picking a value emptied the map. Now compared as
   strings.
2. **Numbers sorted as text** — the Holes dropdown read 18, 9. Now numeric when
   every value is a number, alphabetical otherwise.

Also: blank values are dropped from a dropdown, so a feature missing that field
no longer puts an empty option at the top.

**What each report got** — labels are the owner's own, taken from the config's
existing `filters` or `columns`, nothing invented:

| Report | Dropdowns |
|---|---|
| PoolOpenings | Status (3) + Pool Type (5) |
| austin-bike-shops | Type (3) + Sells E-Bikes (3) |
| austin-chambers | Focus (5) + City (4) |
| austin-golf-courses | Holes (2) + Type (12) |
| austin-toy-stores | Type (3) + Age Range (3) |
| austin-neighborhoods | Area (6) — **one only** |
| austin-ps5-bundles | Retailer (7) — **one only** |
| austin-vintage-guitar | Shop Type (6) — **one only** |
| austin-horseback-riding | **none** |

**Four reports could not have two, and inventing one would have been worse than
saying so.** A filter is only useful if its values GROUP the rows. In those four,
every remaining field has one distinct value per row — `austin-horseback-riding`
has no grouping field at all (17 features, and `area` alone has 16 distinct
values), so a dropdown there would list every item one by one, which is exactly
the "too long" the owner asked to avoid. The empty filter bar hides itself
(`.filters:empty`). Say the word and any of them can take a second dropdown on a
derived field — the data would have to be reshaped first.

Types were preferred over locations wherever the data offered a choice. Chambers
is the one exception: `Focus` is its only type-ish field, so `City` is the honest
second.

Verified across all nine: dropdown option counts as above, zero blank options,
selecting a value drops the row count and the marker count together and the
result line matches, no console errors.

Cache version `?v=20260910l`.

## 2026-09-10 — popups cut back to a name, two fields and two links

Owner: "let's make the pop-ups for all the maps much simpler, less formatting and
just the name, and 2 more fields on it so it is smaller, and add the links just
for Google and apple maps on the bottom and small buttons."

Done across all nine report maps — they share one `app.js`, so one edit covers
every one of them.

**What a popup is now:** the name, the first **two** populated fields from
`CONFIG.popupFields`, and small **Google** and **Apple** buttons. That is the
whole thing. It measures 127–230px wide and about 110px tall, against roughly
300×300 before.

**What went:**
- the **Info / Course App tab bar** — two tabs, one of which had nothing in it
  (`svContent` was an empty string, so the second tab opened a blank pane);
- every field past the second;
- the coloured **score badge** for `inspection_score`;
- the **Waze** and **Reddit** links;
- the rule under the title, the flexed label/value rows, and the full-width
  coloured link bar. A row now reads as one line — a small grey label in front of
  the value — and the links are small pills rather than four stretched buttons.

`switchPopupTab()` had nothing left to switch and is gone, along with the CSS for
the tabs, the panes and the badges.

Nothing is lost from the map: the rest of a place's detail is a row away in the
left panel, which shows every column.

Verified across all nine: exactly 2 field rows, exactly the two links in the
order Google then Apple, zero tabs, zero badges, no console errors.

Cache version `?v=20260910k`.

## 2026-09-10 — a data table on the left, one row per feature, click to fly

Owner: "add a data table on the left side for the data from the geojson with 1
row for each item with a marker, and when that line is clicked the map zooms to
that marker. the table is a panel that opens from the left."

**The panel slides in from the left over the map**, with the same chevron handle
riding on its edge. One row per feature in `data.geojson` — row counts match the
files exactly (46 / 5 / 5 / 20 / 17 / 8 / 18 / 8 / 9). Clicking a row flies the
map to that marker at zoom 15.5 and opens its popup.

**Almost none of this was new code.** `updateTable()` already built the rows and
already had the fly-to-and-popup click handler — it has been sitting there
guarded, returning early because there was no `#tableBody` on the page. Adding
the markup back switched it on. Two real changes:

1. **The marker no longer lands under the panel.** The click now passes
   `padding: { left: <panel width> }` to `flyTo`, so the place you picked ends up
   in the part of the map you can actually see. Without it, clicking a row flew
   the marker to a spot hidden behind the panel you clicked it in.
2. **Rows are one line, clipped with an ellipsis.** Letting the text wrap made a
   five-column row 200px tall — the panel showed three courses and you scrolled
   for the rest. All twenty fit on screen now. A row is a way *in* to a place,
   not the place itself: the full value is in the popup the row opens, and in the
   cell's tooltip (`td.title`).

The title still centres itself on whatever map is left beside the panel and
slides back when it closes. On a phone the panel takes 84% and the title stays
put behind it.

Still no filtering, as agreed — `buildFilters()` returns immediately because
there is no filter UI, so nothing is filtered out and every feature has a row.

Verified across all nine at 1280×800: rows match each `data.geojson` feature
count, headers built from `CONFIG.columns`, panel flush to the left edge, a row
click moves the centre and takes zoom from ~10.6 to 15.5 with a popup, no page
scroll in either direction, no console errors.

Cache version `?v=20260910j`.

## 2026-09-10 — a map, its data, and a title. Nothing else.

Owner: "let's remove all of the controls and have the title just as text on the
map along the top centered and the data from the geojson in the map."

`/apps/reports/<slug>/` is now three things. The whole page body is:

```html
<div class="page">
  <div id="map"></div>
  <h1 class="map-title" id="pageTitle"></h1>
</div>
```

**Every control is gone** — zoom, compass, geolocate, Satellite, Layers, Topo,
Buildings, 2D/3D, dark mode, ⓘ, Draw, Clear, Measure, Map PNG. Zero `<button>`
elements on the page.

**What went is the BUTTONS, not the map.** It still pans and zooms by hand, and
`data.geojson` is still on it: `addPlacesLayers()` and `applyFilters()` still run,
so every feature is plotted and the camera still fits to them.

**The attribution notice in the corner stays.** It is OpenStreetMap's licence
requirement, not a control.

Their initialisers are still in `app.js`, just not called — with a comment saying
so. Turning any one back on is one line in the init sequence, not a rewrite.

**The title** is plain text across the top, centred, no bar and no box, with
`pointer-events: none` so the map keeps the whole of itself. It is **dark ink
with a white halo, not white with a dark one**: the satellite and dark-mode
toggles are gone, so the pale street map is the only ground it ever sits on, and
white-on-pale was barely readable.

Verified across all nine at 1280×800: features plotted (12–103 each), title
centred to the pixel at the same top offset, **zero buttons**, attribution
present, map fills the viewport, no scroll in either direction, no console
errors.

Cache version `?v=20260910i`.

## 2026-09-10 — each report becomes just a map of its data

Owner, after two wrong turns of mine: "I don't want the reports recreated in the
middle I mispoke, I want the maps made of the data with the same mapping controls
once we have those done we will consider how to filter it" — and "you don't have
to rebuild them ... just make a map of the data that they are based on and add
the same map controls."

**`/apps/reports/<slug>/` is now a map and nothing else.** The map fills the page
and everything that remains floats on top of it:

- the data — every location plotted, nothing filtered out;
- the map controls, unchanged: Satellite, Layers, zoom / compass / geolocate,
  Topo, Buildings, 2D-3D, dark mode, and the ⓘ panel;
- the map tools: Draw, Clear, Measure, Map PNG, in a floating pill;
- a small title, so you can tell which map you are looking at in the carousel.

**Gone:** the block header, the footer, the side panel, its collapse handle, the
filters, the location table, Export CSV, and the Report modal. No page chrome
survives — nothing to scroll past.

**Filtering is deliberately not here yet** ("once we have those done we will
consider how to filter it"). The code that built it is not deleted, just
guarded: `buildFilters`, `buildTableHead`, `updateTable` and `updateCount` each
return early when their element is missing, so `applyFilters()` still does its
map-side work — it finds no filter selects, filters nothing, and every feature
stays on the map. Putting a filter UI back is adding markup, not rewriting logic.

`app.js`, `style.css` and `index.html` remain byte-identical across all nine
report folders (`index.html` differs only by its `<title>`).

Positioning bugs found and fixed along the way: `.toolbar` was never actually
positioned, so it sat as a static block across the top overlapping the title;
the draw bar's rail is `pointer-events: none` so the map keeps the gaps, which
left the buttons themselves dead until the pill took clicks back; a stale
`#map { height: 46vh }` in the phone block fought `inset: 0` and left the map
388px tall on a phone.

Verified at 1280×800 and 390×844 across all nine: the map fills the viewport,
six map controls present, the four map tools present, **no** table / filters /
count / panel / handle / report modal in the DOM, no page scroll in either
direction, no console errors. Golf's twenty course pins render as before.

Cache version `?v=20260910h`.

## 2026-09-10 — the report panel opens and closes; the header is just a title

Owner, clarifying the earlier ask: the side panel should "be opened and closed
with an arrow on the side"; and separately, "there shouldn't be a header and
stuff like in the reports, just the map and the controls and a title at top".

**The panel now collapses.** A handle rides on the panel's edge — a chevron in a
small tab, vertically centred — and slides with it, so it is always the thing
you reach for. Closed, the panel folds to nothing and the map takes the whole
row; the arrow flips to point back out. Below 900px the panel is stacked under
the map, so the handle becomes a full-width strip between them and the panel
closes upward instead of sideways. Filters, list and click-to-fly are unchanged.

**Getting MapLibre to follow it took three tries** and is worth writing down.
MapLibre sizes its canvas once and does not watch its container, so it has to be
told the box changed. Both obvious hooks resize exactly ONCE, at a moment that
turns out to be wrong:
1. `transitionend` — fired early on the way back OPEN; canvas stayed ~400px too
   wide with a blank strip down the side.
2. A `ResizeObserver` calling `map.resize()` inside its own callback — that trips
   the browser's resize-loop guard and notifications stop being delivered
   mid-slide. Same symptom: measured 1263px against an 870px box.

What works is following the whole animation: `map.resize()` on every animation
frame for 380ms after the click. A ResizeObserver is still there, deferred to the
next frame, for the window resizing and for this page being resized inside the
home page's window.

**The header is a title bar now.** It was a block: an eyebrow line above a 30px
title with a 3px rule under it, and a social-icon footer below everything. Both
are gone — what is left is the title and the ⓘ / 2D / theme controls in a 7px-tall
strip. The map gained 84px of height on a 800px screen, which matters most in the
small home-page window where every pixel it gives up is map.

`CONFIG.eyebrow` and `CONFIG.socialLinks` are no longer read; the config keys are
left alone.

**One near-miss worth recording:** the first attempt at removing the social-icon
code walked back from the `socialIcons` line to find its enclosing function and
found `init()` — deleting the app's entire startup routine, 94 lines, in every
report. Caught by reading the diff before committing. Restored from git and
redone as an exact-string removal of just that block.

Verified headless at 1280×800 and 390×844: the panel closes and reopens, the
canvas width matches the map box exactly both ways, aria-expanded and the label
flip, and there are no console errors. Full sweep re-run: nine map apps 200 with
rows populated, eight written reports 200 with word counts intact, home Reports
chip previewing the map app.

Cache version `?v=20260910g`.

## 2026-09-10 — story maps removed; report map apps get a side panel

Owner: "I like for the cards to advance the reports like that but I want to
change story maps that each shows to be more like the reports and get rid of the
story maps completely, I like the map and controls on the reports but want them
to have a side panel that has table data and filters there instead of being
underneath and I want those there instead of the story map."

### The map app is now two columns

The table and its filters used to sit **underneath** the map, so you scrolled
away from the map to read them. They are now a **side panel beside it** and both
are on screen at once. The map, its draw bar and every control are unchanged.

- `.page` is a flex column and `.app-body` the row, so the app is exactly one
  screen tall and **only the panel's list scrolls**. That matters because the app
  is now what plays inside the small window on the home page.
- **In the panel the table is not a table.** Four columns will not fit 380px —
  the first attempt sliced the last column clean off the edge. Each row now
  **stacks into a labelled record**: first column as the name, the rest as
  label/value lines. `app.js` puts the column header on each cell
  (`td.dataset.label`, a one-line change) and `style.css` draws it. Rows still
  click to fly the map. Nothing is cut off and nothing scrolls sideways. Fields
  that were invisible before — golf's PRICE, for one — are readable now.
- Below 900px the panel goes back under the map and the page scrolls normally.

`app.js`, `style.css` and `index.html` stay byte-identical across all nine report
folders (`index.html` differs only by its `<title>`); `template/` was edited and
copied out, and each title was preserved on the way.

### The story maps are gone, the writing is not

Deleted from all nine reports and the template: `storymap/index.html`,
`engine.js`, `ui.js`, `story.json`, `data/` — the cinematic scene player.

**Kept and moved up one level**, because the written reports are real work and
were only ever stored in that folder:
`{slug}/report.html` (8 of them, 1,310–6,267 words each), the toy-store report's
three images, and every `promo.mp4`. `template/report-template.html` was pulled
back out of the deleted folder too — the written-report build still needs it.

Everything that pointed into `storymap/` was repointed: `reports.json` hrefs →
`{slug}/report.html`; the eight reports' own "Story map →" nav links removed
(they had nowhere to go); `apps/reports/index.html` cards and seven hard-coded
links in `apps/index.html` → the map app; `content/report-videos/build.js` and
`GUIDE.md` → the new `promo.mp4` path; `apps/reports/CLAUDE.md` rewritten.

### The home page

Report cards now **play the map app in the window** instead of the story map;
clicking still opens the same app in its own window. The carousel behaviour from
earlier today is untouched — swipe the row, leftmost card drives the window.

Renamed while the story maps were going: `#storymap-frame` → `#app-window`,
`.storymap-nav-bar` → `.chip-bar`, `.storymap-nav` → `.chip-row`. Those names
described a thing that no longer exists.

### Verified headless

All nine map apps: 200, side panel on the right at x=896, rows populated
(5–46), no horizontal scroll, no console errors. All eight written reports: 200,
full word counts intact, zero remaining story-map links. Home page: Reports chip
renders 9 cards and previews `/apps/reports/austin-chambers/`; the swipe test
still walks the Apps row both directions. Responsive sweep re-run at twelve
sizes — still no scrollbars, footer on the bottom edge.

Cache version `?v=20260910f`.

## 2026-09-10 — the card row is now the control for the window

Owner: "can we have the middle section change by swiping the card? so whatever
card is in the 1st left position is what the middle section will be."

**One rule now governs the home page: whichever card is snapped to the LEFT EDGE
of the row is what plays in the window.** Swipe the row, two-finger scroll it, or
roll a wheel over it and the window follows. The leftmost card also takes the
`is-active` accent fill, so it is obvious which one is driving.

Clicking a card still opens its real web app in a new browser window. A swipe is
not a click, so the two never collide.

Three things had to change for "leftmost" to mean anything:

1. **Snapping.** `scroll-snap-type: x mandatory` on the row, `scroll-snap-align:
   start` on the cards, plus `scroll-padding-left: 16px` so a resting card keeps
   the row's gutter instead of sitting flush against the window edge. Snapping is
   what makes "leftmost" a definite answer rather than wherever a swipe stopped.
2. **The row has to actually overflow.** It didn't. Three 280px cards on a
   1280px screen fit with room to spare, so nothing could ever be swiped and the
   feature was dead on the desktop — the first test showed `scrollLeft` stuck at
   0. Cards are now `clamp(240px, 44%, 420px)`, a share of the row, so a slice of
   the next card always shows — that peek is what says "this swipes".
3. **Runway.** Even overflowing, three cards only gave a few dozen pixels of
   scroll — not enough for the last card to ever reach the left edge. The row now
   carries a trailing `::after` spacer of `100% - card - gap`, which is what lets
   the last card sit at the left and take the window.

**The demo reel now advances the ROW instead of the window** (`scrollToCard`, not
`show`). One thing decides what plays, so the row can never disagree with what is
on screen. The moment a visitor touches the row — pointer, touch, key or wheel —
the reel stops and the row is theirs.

The page never scrolls vertically, so a wheel over the card row would otherwise
be dead input; it is spent sideways instead, which is how a plain mouse moves the
row the way a finger does.

**Side effect worth knowing:** picking **Reports** now loads the first report's
story map into the window, where before it left the window alone. That follows
from the same rule and makes the Reports chip do something again — but say so if
you'd rather it stayed put.

Verified headless: leftmost card and window agree in both directions across all
three cards; clicking card 2 still opens `/1885murdertour/`; a wheel over the row
moved it 16 → 446 and the window followed; the reel advanced the row at 62s and
stopped dead after a touch. Re-ran the responsive sweep — twelve sizes from
1600×900 to 320×568, still zero vertical and zero horizontal scroll with the
footer on the bottom edge.

Cache version `?v=20260910e`.

## 2026-09-10 — the Moontower WebApp link was dead: an invisible overlay ate the click

Owner: "can you have the card on the animation map link to
https://austin.chat/moontowertour/". It already did — the `href`, `target` and
text were all correct from the previous commit. **The link was simply not
clickable**, and the owner was reading the symptom exactly right.

**Cause: `#fallback`.** It is the "map data did not load" message, an
`inset: 0` overlay at `z-index: 3`, carrying the `hidden` attribute so it only
appears on failure. But the stylesheet said `#fallback { ... display: grid; }`,
and **a `display` rule in a stylesheet outranks what the `hidden` attribute
does**. So the overlay was never hidden at all — an empty, invisible, full-page
box sitting on top of everything and swallowing every click on the page.
`elementFromPoint` at the middle of the pill returned `DIV#fallback`, not the
link.

Fix: `[hidden] { display: none !important; }` — the same one-liner
`moontowertour/` and `1885murdertour/` already carry, which is why those two
were never affected. Checked all four map pages; `/moontower/` was the only one
with the bug.

This was not new. That overlay has been swallowing clicks on the demo page the
whole time, which is probably why nothing there ever seemed to respond.

Verified headless with real clicks: the pill opens
`https://austin.chat/moontowertour/` in a new tab **both** from `/moontower/`
directly **and** from inside the home page's window — the case that matters,
since that is where the owner sees it. The home page's own Moontower card still
opens `/moontowertour/` too.

## 2026-09-10 — the Moontower demo loses its popups and gains the app link

Owner: "Remove all of the popups from the moontower animation and make the card
on there that says Moontower, change that Moontower WebApp and make it linked to
the https://austin.chat/moontowertour/". This supersedes the earlier choice to
keep the story cards.

**`/moontower/` has no popups at all now.** `js/card.js` is deleted, the
`#story-card` element and every one of its CSS rules are gone, and the tour's
`onArrive` is an empty function. The demo is the moving map and nothing else:
the camera flies tower to tower, the lamps come on, the light pools spread.
Checked past two arrivals — nothing appears.

**The pill under the tagline is now the way into the real thing.** It was a
placeholder `href="#"` reading "Moontower"; it now reads **"Moontower WebApp"**
(the owner's own words) and links to `https://austin.chat/moontowertour/`.
It carries `target="_blank"` deliberately — this page is embedded in the
austin.chat home window, so without it the app would open inside that small
frame instead of a real window.

`moontower/index.html` loads its module as `js/main.js?v=20260910d`. That is not
decoration: `card.js` is gone, so a browser still holding the old `main.js`
would import a 404 and take the whole demo down. Bump it whenever main.js's
imports change; its own imports (`tour.js`, `map-bits.js`, `towers-3d.js`) are
unchanged and cache safely.

`js/tour.js` keeps `pin()` and `release()` — nothing on this page calls them,
but the file is shared with the interactive web app where clicking a tower does
pin it. Its comments now say so instead of describing a card this page no longer
has. `moontower/README.md` records all three divergences from
`MoonTowerTour/web` at the top, since a straight re-copy would undo them.

Verified headless: pill reads "Moontower WebApp" → `/moontowertour/`,
`target=_blank`; zero `#story-card` in the DOM after 16s of touring; the only
absolutely-positioned things left are the map canvas, the attribution control
and the hidden fallback. No console errors.

## 2026-09-10 — the home page fits one screen at every size

Owner: "Can you fix the footer, the site is not completely responsive for some
reason. Should resize without there needing to be a scroll bar on the right."

**One cause, both symptoms.** `.map-hero` had a fixed height — `flex: 0 0 65vh;
height: 65vh`. The other four bands are whatever they are, so the total never
matched the viewport:

- On a laptop it was too tall. At 1280×800 the parts came to 816px against
  800px of screen, so the page grew a **16px scrollbar** (27px at 1024×768,
  63px at 360×640) — the scrollbar on the right.
- On a tall screen it was too short. At 820×1180 the bands ended at 992px and
  the footer sat at 1109px, leaving a **117px dead band** above it — the footer
  problem.

**Fix:** the map window now takes the remainder instead of a fixed height
(`flex: 1 1 auto; min-height: 220px`), and `main` got `min-height: 0` so the
window is actually allowed to shrink — without it a flex child refuses to go
below its content size and the page grows a scrollbar anyway. Below 220px of
room there is genuinely no space and the page scrolls rather than squashing the
map to a sliver.

Also: `.report-cards` lost its `border-bottom`. The footer's own `border-top`
sits directly beneath it, and the two 1px rules together read as one thick
smudged line.

Verified headless at twelve sizes from 1600×900 down to 320×568: **zero vertical
scroll, zero horizontal scroll, and the footer's bottom edge exactly on the
viewport's bottom edge in every one.** `/apps/`, `/services/`, `/contact.html`
and `/apps/reports/` were checked for sideways overflow at the same twelve
widths — none.

Cache version `?v=20260910d`.

## 2026-09-10 — the original day design is back; the theme button was backwards

Owner: "The buttons seem backward and now the whole page has a glow. I just want
the day to look like it did before you changed it to the dark (which I didn't
ask for...)."

Both correct, and the second one was bigger than a palette. **`c6046fc`
(2026-09-09, "night palette") changed the whole design, not just the colours** —
it also swapped the typography to Georgia serif throughout, dropped every font
weight to 400, replaced the topbar's drop shadow with a glow, put a
`text-shadow: 0 0 18px` glow on the wordmark, turned the map window's 6px top
gradient into a page-wide `inset 0 0 80px 20px` vignette, and added glows to the
active chip, the active card and the social icons. Restoring the tokens alone
(my earlier fix) left all of that in place, which is the glow the owner saw.

**`style.css` is now `git show c6046fc^:style.css` verbatim** — the stylesheet
as it was before that commit — plus exactly two additions: `color-scheme` on
each palette block (so scrollbars and form controls follow the theme), and the
comment at the top saying why. Nothing else. That was safe because only three
selectors had been added to the file since, and all three belonged to the night
styling being removed. So the day page is the **exact** design it was: Helvetica
body, Poppins headings at weight 700, real drop shadows, no glow anywhere, and
the original `#0067c5` blue.

The dark option is the site's OWN original dark theme, which was already in that
file (`:root[data-theme='dark']`, `#0e1117` / `#4cc3ff`) — not the Moontower
one. Day is still the default; night is only ever chosen.

**The button was backwards.** It showed the theme you were already in, so the
day page said "Light" and clicking it gave you dark. It now says where a click
will take you: 🌙 Dark on the day page, ☀️ Light on the night page.

Cache version bumped to `?v=20260910c`.

Verified headless with the browser set to dark: day loads by default at
`rgb(245,247,250)` with Helvetica, no wordmark text-shadow and no vignette on
`.map-hero::after`, offering "🌙 Dark"; the click gives `rgb(14,17,23)` offering
"☀️ Light"; back again. No console errors.

## 2026-09-10 — News Feed off the home page; the site is a holder for the web apps

Owner: "Lets remove the news feed button and that page in the carrosel, I want
to keep the list for some way to update myself but I don't think people will
use that, I want this site more to be a holder for webapps that I have mostly
already built."

- **The News Feed chip is gone** from `home.json`, so the chip row is now
  Apps / Reports / Media / Services.
- **The page opens on Apps**, which starts the demo reel straight away
  (`"open": true` moved to the Apps chip). `index.html`'s iframe default src is
  `/moontower/` instead of `/news/`, so the first painted frame is already the
  demo rather than a news map that then gets replaced.
- **Nothing about the news feed was deleted.** The daily Action
  (`.github/workflows/build-news-feed.yml`) still rebuilds `news/feed.geojson`
  every morning and the page is still live at **https://austin.chat/news/** —
  it is just not advertised on the home page. `news/README.md` says so at the
  top, along with how to put the chip back (a `"src": "/news/"` chip with no
  cards — a data edit, no code).
- `home.js`'s "a chip with its own src and no cards is a page in itself" branch
  is now unused but kept: it is the mechanism for putting any page back on the
  home page without writing code, which is the whole point of `home.json`.
- Cache version bumped to `?v=20260910b` on all 16 references.

Verified headless: chips are Apps/Reports/Media/Services, Apps is active on
load, the window opens on `/moontower/`, the three app cards render, and
`/news/` visited directly still lists its 102 stories. No console errors.

**Still open, and worth a decision:** the **Media** and **Services** chips have
no cards, so picking either shows an empty row under the window. If the site is
a holder for the web apps, those two either need cards or should come out the
same way the News Feed chip did.

## 2026-09-10 (fix) — day is the default, and the button is findable

Owner: "I'm not seeing the light/dark button, I do want it to default to light
but also want a dark option." The button WAS live and rendering — checked
against austin.chat directly, all three files deployed. Two real causes:

1. **The browser was serving the previous `style.css`,** the one that still
   carried `display:none !important` on `.theme-toggle`. GitHub Pages caches
   these files hard. **Fixed properly: `/style.css`, `/page.js` and `/home.js`
   are now referenced with `?v=20260910` on all eight pages that use them, and
   `CLAUDE.md` says to bump that number on every push that touches them.** Each
   report folder's own `style.css` keeps its separate `?v=` — untouched.
2. **At night the button was nearly invisible** — `var(--surface)` on a bar
   painted from the same `--surface`, with a faint `--border`. It now carries
   the accent on its edge, its label and a 12% tint of its background, becomes
   solid accent on hover, and is a pill in small caps. Reads on either ground.

**Day is now the default.** The palette blocks were swapped rather than
patched: the day tokens live on bare `:root` (so the first painted frame is
already light — no flash) and night is `:root[data-theme="dark"]`, restating
the same eleven tokens. `page.js` no longer consults
`prefers-color-scheme` at all: `storedTheme === 'dark' ? 'dark' : 'light'`, so
an unvisited page is always day whatever the machine says, and night is only
ever a choice the visitor made. The choice is still remembered in localStorage.

Verified headless with the browser set to dark: first visit lands
`data-theme="light"`, `rgb(245,247,250)`; the button flips it to
`rgb(11,15,20)`; the choice survives a reload both ways and carries to
`/apps/`. No console errors.

## 2026-09-10 (later still) — day/night button, cards launch the apps, demos go quiet

Four owner changes.

**1. Day / night button, top right of the header.** All the machinery was
already there and had been switched off on 2026-09-09: the markup existed on
six pages, `page.js` still ran the toggle and remembered the choice in
localStorage, and `style.css` killed the button with `display:none !important`.
Now: the button is back (and added to `index.html`, which never had one — all
seven header pages carry it), the `.theme-toggle-unused` styles are `.theme-toggle`
again, and `style.css` has a **day palette** under `:root[data-theme="light"]`
— the same eleven tokens lit, with the accent darkened to `#0067c5` so it holds
on white. Night stays the `:root` default. With nothing stored the page follows
the machine's setting, so a light-mode visitor now lands on the day palette.
The map window is always a night map, so on the day palette it gets a rim
instead of dissolving into the white.

**2. App cards open the web apps.** A card is now a link: clicking one opens
its `app` in a new browser window (`/moontowertour/`, `/1885murdertour/`,
`/parcels/`, and each report's map app). It no longer swaps the preview in the
map window, so the small ↗ is gone — the whole card is the ↗ now, and its CSS
went with it. A card with no `app` still previews in the window, as before.

**3. The window plays a demo reel.** Since cards no longer drive it, a chip
marked `cycle: true` in `home.json` runs through its `demo: true` cards in
turn, each holding the window for `demoMs` (60 s each for the two tours) before
the next. So Apps shows the Moontower animation, then the 1885 lantern, and
loops. Leaving the chip stops the reel; hand-picking a non-app card stops it too.
Verified over a real 123 s run: Moontower → 1885 → Moontower, and it stops dead
when another chip is picked.

**4. Both demos are animations now — nothing in them responds to a click.**
Owner kept the story cards (they open themselves as part of the show); what
went is every hand-driven control.
- `moontower/` — the `map.on('click')` tower pin/release is gone (the map was
  already `interactive: false`). With nothing clickable the "Read more" fold
  could never be opened, so the card always carries `.open` and shows the whole
  stop; the button, its label and its CSS are removed. **This copy has now
  DIVERGED from `MoonTowerTour/web` on purpose** — `moontower/README.md` says so
  at the top, because a straight re-copy would undo it.
- The 1885 lantern is on austin1885.city, a different repo, and it is a live
  product the Play app links to — so it was NOT made non-interactive. It gained
  a **`?demo=1` mode** instead (`Austin1885/austin1885.github.io`, commit below):
  no click-to-pin, no zoom buttons, no wheel zoom; the lantern still tours and
  the cards still open themselves. `home.json` embeds
  `https://austin1885.city/annihilatortour/?demo=1`. Plain `/annihilatortour/`
  is untouched.

Verified headless (Playwright, 1280×800): toggle flips `rgb(11,15,20)` ↔
`rgb(245,247,250)` and back and writes `data-theme`; all three Apps cards render
as `<a target="_blank">` to their apps with zero ↗ arrows left; the Moontower
demo's card opens itself with no fold button and does not change when the map is
clicked; `?demo=1` hides the lantern's zoom UI while plain `/annihilatortour/`
still shows it. No console errors on any page.

**Owner to check:** whether landing in day mode (when the machine is set light)
is what you want, or whether the site should always open at night with the
button as the only way into day. And 60 s per demo is a dial in `home.json`
(`demoMs`) — a full Moontower round is about 135 s, so at 60 s the reel moves on
partway through.

## 2026-09-10 (later) — the site gets its own palette; Moontower drift cut

Owner: the site had come to look like the Moontower app, and "I have had an
issue with drift from that project ... that seems like too much of an
influence." Investigated where the pull came from and fixed three things.

**Where it came from.** Nothing instructed it. Moontower is simply the oldest
and most finished product in the workspace, so every session reaching for
"what should this look like" found it first — and each copy got written into a
STATUS file as precedent, which made the next session do it again. On
2026-09-09 the home window was set to play the Moontower map; because that map
is dark, the page around it was made dark too, and `style.css` was given the
Moontower tokens verbatim (the old comment said so). From there the palette
reached every page on the site.

**1. The rule, so it stops recurring.** `C:\Dev\CLAUDE.md` now carries
"Moontower is one module, not the house style": what is shared is the engine
and only the engine (`webtour/`, the kit / container-app code) — no palette,
no basemap style, no typography, no product identity travels with an engine,
and no non-Moontower surface reads files out of a `moontower*` folder.

**2. The News Feed is decoupled.** `news/index.html` was loading
`../moontower/vendor/arclight-1895.style.js` — an Austin news map wearing the
Moontower tour's 1895 cartography, carrying the tour's `towers`,
`illumination` and `routes` sources and their 13 layers. The news map now has
its own `news/vendor/basemap.style.js` (`window.NEWS_BASEMAP_STYLE`, 99
layers, 2 sources): started as a copy of that cartography with the tour layers
stripped and the ground set to the site ink, and it is the news map's to
change from here. Nothing outside `moontower/` reads `moontower/vendor/` now.

**3. The site palette is the site's own.** `style.css` `:root` is no longer
the Moontower tokens. It stays night-toned (the home window always holds a
dark map) but the hue is the site's own blue — `--accent: #4cc3ff`, the accent
austin.chat used before 2026-09-09 — on a neutral ink `#0b0f14`. Every colour
on the site still flows from those 11 tokens, so the accent is one line to
change if the owner wants a different one; there is no City Anatomy brand
colour written down anywhere (`CityAnatomyAustin/docs/BRAND.md` is links only),
so this is a restoration, not an invented brand.

The tour apps were already clean — `moontowertour/vendor/` and
`1885murdertour/vendor/` each carry their own day/night styles and keep their
own looks. Only the site chrome and the news map changed.

Verified headless (Playwright, 1280x800): `/`, `/news/` and `/apps/` load with
zero console errors, body ground `rgb(11,15,20)` on all three; the generated
news style parses, 99 layers, no layer pointing at a missing source.

**Owner to decide:** whether `#4cc3ff` is the accent they want, and whether the
news basemap should stay this dark night cartography at all now that it is
free to diverge from the tour.

## 2026-09-10 — austin.chat IS the app for now: tour web apps + home rewire

Owner: "Until we get the react native app tested and approved I want to
treat austin.chat like a webapp version of what the react native app will
eventually be." Apps open in their own browser window, full screen, with
only what an app would show (no site header/footer); nobody uses them from
the front page. Built today:

- **`/1885murdertour/`** — the Servant Girl Murder tour module as a web app
  (map, geofences, verified "I'm here", card, story page, picker, distance,
  credits). **`/moontowertour/`** — the Moontower module as a web app (pools
  of light, the carbon-arc strike, honest ✦ visits, follow-me camera,
  hold-to-reset). Both: plain ES modules, no build, MapLibre GL JS 5 from
  unpkg, the app's own style JSON verbatim over OpenFreeMap tiles (no key).
  Each folder has a README; the shared engine is **`webtour/`** (its README
  is the overview). Every label is lifted verbatim from the phone app's
  screens into each app's `js/copy.js`; no copy was written.
- **Data**: `node tools/sync-webapps.js` copies the app's generated module
  data (`CityAnatomyAustin/src/modules/<id>/data/*`) into each app's
  `vendor/` as window globals. Re-run after any data or style change in the
  app, then commit. Never hand-edit `vendor/`.
- **Home page**: the window opens on the **News Feed** map (`open: true` on
  the chip in `home.json`; iframe default `/news/`). The Apps carousel
  keeps the animated Moontower (`/moontower/`) and the austin1885.city
  lantern map as window previews; each card now has a small **↗** that opens
  the real app (`app` field) in a new window. Reports cards preview the
  story map and their ↗ opens the report's own MapLibre map app at
  `/apps/reports/<id>/` — those map apps existed for every report but were
  linked from nowhere on the home page. `PoolOpenings` was missing from
  `apps/reports/reports.json`; added (strings taken from `apps/index.html`;
  its eyebrow "Austin Parks · Report" follows the pattern of the others —
  owner may change). `/apps/index.html` still omits the toy-store map app and
  the vintage-guitar map app; not touched.
- Cleanup: 45 `*.out` fetch dumps committed by accident with the news-feed
  research on 2026-09-09 removed; `*.out` ignored.
- Verified headless (Playwright, phone + desktop): both apps load without
  errors, picker flight → card → I'm here / strike → progress persisted;
  home opens on the news map, Apps/Reports cards carry the right ↗ links.
  Screenshots in `C:\Dev\temp\webapps\`. Real-phone GPS is untested
  (needs the live https site).

Owner to check on a phone: geolocation prompt on ◎, the strike on
`/moontowertour/`, "I'm here" at a real site on `/1885murdertour/`.

## 2026-09-09 — site moved here from loraatx/loraatx.github.io

The City Anatomy site (austin.chat) now lives in this repo under the
cityanatomyservices GitHub account, with the full git history copied over
(641 commits). Nothing in the site itself changed.

What was done, in order:

1. The old `cityanatomyservices.github.io` repo (austin.chat) was renamed to
   `austin-chat-archive`, its Pages disabled, and the repo archived on GitHub.
   Local folder: `C:\Dev\projects\cityanatomyservices\austin-chat-archive`.
   austin.chat no longer resolves to a site (owner: not needed).
2. `loraatx/loraatx.github.io` was renamed to `loraatx-site-archive`, its
   Pages disabled, and the CNAME file removed so the domain could be claimed
   here. Local folder: `C:\Dev\projects\loraatx\loraatx-site-archive`.
   GitHub redirects the old repo URL to the new name.
3. This repo was created, the site pushed, GitHub Pages enabled from `main`
   at `/`, custom domain `austin.chat`.

DNS did not change: austin.chat is proxied by Cloudflare, which forwards to
GitHub Pages. GitHub picks the repo by the `CNAME` file, so keep that file.

## Supabase — the site uses only the paid cityanatomyservices project (2026-09-09)

Owner's rule: the paid Supabase account (org `cityanatomyservices`) is the only
one that matters. It holds project **`aqbyxpiwugcvoephsvpm` ("parcels")** —
the parcel database shared with WhatCanIBuildHere (`austingraph/austingraph.github.io`)
and the CityAnatomyAustin container app — plus the "Pubber" project.

Before the move the site pointed at `tqnklodtiithbsxxyycp`, a project on the
FREE account (the austin.chat one). It held a small copy of the parcel data,
two custom RPCs and its own PMTiles file. That dependency is gone:

- `/parcels/` now reads the paid project: `parcels_public` view (anon-readable),
  PMTiles `tiles/parcels.pmtiles` (source layer `parcels`), and two RPCs.
- The two RPCs and the `austin_zoning_rules` lookup table were ADDED to the
  paid project from `scripts/sql/` (`get_parcel_constraints.sql`,
  `search_parcels.sql`, `austin_zoning_rules.sql`). They are the only objects
  this repo owns there. Re-apply by pasting a file into the SQL editor.
  Schema mapping: old `parcels.zoning` = new `zoning_base`; old
  `zoning_overlay` = `zoning_ztype` when it differs from the base district.
- The parcel tables themselves belong to the austingraph repo. **Never run
  this repo's loader SQL (`scripts/*.sql`, `scripts/sql/load_*`,
  `spatial_join_zoning.sql`, `zoning_stage_to_final.sql`) against the paid
  project** — they alter and update `parcels`. They were the free project's
  pipeline and are kept only as history. The three workflows that ran them
  (`build-parcels-pmtiles`, `load-zoning`, weekly `refresh-lists`) were
  deleted for the same reason. **No Actions secrets are needed** — the two
  remaining Remotion render workflows use none.
- `apps/chats/*` (the three austin.chat maps) and their ChatMaps cards on
  `/apps/` were REMOVED 2026-09-09 (owner: "the function is over"). The site
  now has no dependency on the free account at all. Note for the owner: the
  `/apps/` hero lede still says "live chat experiences" — owner copy, not
  touched.

The free project (`tqnklodtiithbsxxyycp`) can be deleted whenever the owner
likes: its austin.chat tables are all EMPTY (checked 2026-09-09), and its
parcel copy is superseded. The austin.chat data the owner is keeping — the
1,202 curated geofences — lives in git in the archived repo
`cityanatomyservices/austin-chat-archive` (`data/`) and in the GIS library
(`C:\GISData\austin\places.gpkg`, GeoJSON in `C:\GISData\derived\`).
The austin.chat domain stays registered but points at nothing.

## Home page — 2026-09-09 (owner: "make it look cooler", same basic layout)

Same skeleton as before: top bar, map window, chip row, card row, footer.
What changed:

- **The window plays the Moontower map** by default. `moontower/` is a COPY
  of `MoonTowerTour/web` (see `moontower/README.md` for the refresh recipe)
  so austin.chat does not depend on austin1885.city. It self-tours; nothing
  waits for the visitor.
- **Chips = products, cards = their pages**, all from `home.json`
  (`home.js` renders it). Picking a card loads its page in the window. Every
  visible string is the owner's: module names/blurbs from
  `CityAnatomyAustin/src/content/copy.ts`, page titles from each page's
  `<title>`. Add a product or page by editing `home.json` only.
- **One palette, no light/dark toggle.** `style.css` `:root` now carries the
  Moontower night tokens (ink / paper / arc-light) and Georgia serif, so the
  window and the page match. The toggle button on the other pages is hidden
  by CSS; `page.js` still runs the mobile nav.
- **Footer links are real** (TikTok, X, Substack, Patreon from
  `docs/BRAND.md`). YouTube has no URL in the brand table yet, so no icon.
  No Play Store button until the listing is live.
- **Reports are off the home page** (owner: "I don't care about the
  reports"). They still exist: one folder per report under `apps/reports/`,
  listed at https://austin.chat/apps/ and https://austin.chat/apps/reports/.
  The old home-page loader read `apps/reports/reports.json`.

Owner copy flags: `/apps/` hero lede still mentions "live chat experiences".

## News Feed chip — map-based news, built 2026-09-09

Owner: "rethink the old feeds as a map-based news feed for this site",
"rewrite it in JS, use those four outlets". The old feeds were two Actions in
the austin.chat repo (daily feed + nightly Palmer Events scrape); they ran
fine but had placeholder lanes, no locations, and stopped when that repo was
archived today.

Now: `tools/news/build-feed.js` (Node, no dependencies) reads KUT, KXAN,
Austin Monitor, Community Impact RSS, pins each story on a known Austin
place (`tools/news/gazetteer.json`, generated from the austin.chat places +
`landmarks.json`), writes `news/feed.geojson`. `.github/workflows/build-news-feed.yml`
runs it daily at 06:00 Austin and commits; first run succeeded. `news/`
is the page (Moontower basemap, pins + story list); the News Feed chip
loads it in the window (a chip can carry its own `src` in `home.json`).
Details in `news/README.md`. First build: 41 stories, 25 pinned.

Same day, later: the source research (4 agents) is in `docs/NEWS-SOURCES.md`
and its top feeds went into `outlets.json` — 22 feeds now (Austin Monitor
became austincurrent.org; City of Austin, council, KUT Austin, Community
Impact topic feeds, CRE trade press). Build: 116 stories, 48 pinned.
Next step if wanted: an exact-pin layer from the geolocated city datasets
listed in NEWS-SOURCES.md §3 (zoning cases first).

## PICK UP HERE — 2026-09-10 (older items from 2026-09-09 below)

0. Phone test of `/moontowertour/` and `/1885murdertour/` on the live site
   (see the 2026-09-10 section at the top). Then: should the tour web apps
   also link from `/apps/`? Not done — owner call.

## Older — 2026-09-09, owner shut down mid-session

1. **Moontower story card on phones: owner says the "Read more" fold "doesn't
   work well"** (no detail yet — ask what they saw before touching it).
   The fold lives in `moontower/js/card.js` + the phone media query in
   `moontower/index.html`; source of truth is `MoonTowerTour/web/`, and the
   same copy is deployed at `austin1885.github.io/moontowertour/`. Fix in
   the source, then re-copy to both.
2. Owner to check in a real browser: News Feed chip (/news/), Reports chip
   (story maps in the window), Media and Services chips still empty.
3. Free Supabase account: owner may keep it (free) or delete it; nothing
   depends on it.
4. Optional next for the news map: an exact-pin layer from the geolocated
   city datasets in `docs/NEWS-SOURCES.md` §3 (zoning cases first).

## Push token — fixed 2026-09-09

The `cityanatomyservices` gh login now has the `workflow` scope, and the full
history (645 commits) is on GitHub main. Nothing is open for this repo.
Push from a non-active account with:

```
git -c credential.helper= -c credential.helper='!f(){ echo username=cityanatomyservices; echo "password=$(gh auth token --user cityanatomyservices)"; }; f' push origin main
```
