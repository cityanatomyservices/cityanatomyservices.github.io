-- Reuse the subscription lease and invoice reconciliation, with independent
-- customer and entitlement records for parcel access in each Stripe mode.
begin;
alter table billing_private.members drop constraint members_mode_check;
alter table billing_private.members add constraint members_mode_check
  check (mode in ('test','live','parcels-test','parcels-live'));
commit;
