-- Owner-verified paid Substack access, independent of Stripe billing records.
begin;
create table billing_private.substack_memberships (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  verified_email text not null check (verified_email=lower(btrim(verified_email))),
  subscription_plan text not null check (subscription_plan in ('monthly','annual','founding')),
  pro_until timestamptz not null,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz
);
create table billing_private.substack_history (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('grant','revoke')),
  subscription_plan text not null,
  pro_until timestamptz not null,
  recorded_at timestamptz not null default now()
);
alter table billing_private.substack_memberships enable row level security;
alter table billing_private.substack_history enable row level security;
revoke all on billing_private.substack_memberships,billing_private.substack_history from public,anon,authenticated;
revoke all on sequence billing_private.substack_history_id_seq from public,anon,authenticated;

-- Only the backend can look up another account. Email changes require re-verification.
create function public.billing_substack_access(p_owner uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('paidThrough',s.pro_until,'subscriptionPlan',s.subscription_plan)
  from billing_private.substack_memberships s join auth.users u on u.id=s.owner_id
  where s.owner_id=p_owner and s.revoked_at is null and s.pro_until>now()
    and not coalesce(u.is_anonymous,true) and u.email_confirmed_at is not null
    and lower(btrim(u.email))=s.verified_email;
$$;

-- These functions are used by the owner's authenticated CLI, never by the browser.
create function public.billing_substack_grant(p_email text,p_plan text,p_until timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare member uuid; matches integer; normalized text:=lower(btrim(p_email));
begin
  if normalized is null or normalized='' or p_plan is null or p_plan not in ('monthly','annual','founding')
    or p_until is null or not isfinite(p_until) or p_until<=now() then
    raise exception 'A paid plan and a future, finite paid-through date are required';
  end if;
  select count(*) into matches from auth.users where lower(btrim(email))=normalized
    and not coalesce(is_anonymous,true) and email_confirmed_at is not null;
  if matches<>1 then raise exception 'Exactly one confirmed site account must match the Substack email'; end if;
  select id into member from auth.users where lower(btrim(email))=normalized
    and not coalesce(is_anonymous,true) and email_confirmed_at is not null for share;
  insert into billing_private.substack_memberships(owner_id,verified_email,subscription_plan,pro_until)
    values(member,normalized,p_plan,p_until)
    on conflict(owner_id) do update set verified_email=excluded.verified_email,
      subscription_plan=excluded.subscription_plan,pro_until=excluded.pro_until,
      verified_at=clock_timestamp(),revoked_at=null;
  insert into billing_private.substack_history(owner_id,action,subscription_plan,pro_until)
    values(member,'grant',p_plan,p_until);
  return jsonb_build_object('paidThrough',p_until,'hasSiteBilling',exists(
    select 1 from billing_private.members where mode='live' and owner_id=member and customer_id is not null));
end $$;

create function public.billing_substack_revoke(p_email text) returns void
language plpgsql security definer set search_path='' as $$
declare entry billing_private.substack_memberships;
begin
  -- Match the verified grant email, including when the site account email changed.
  for entry in update billing_private.substack_memberships set revoked_at=clock_timestamp()
    where verified_email=lower(btrim(p_email)) and revoked_at is null returning * loop
    insert into billing_private.substack_history(owner_id,action,subscription_plan,pro_until)
      values(entry.owner_id,'revoke',entry.subscription_plan,entry.pro_until);
  end loop;
end $$;

create or replace function public.membership_read() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare member uuid; row billing_private.members; external jsonb; site_until timestamptz; substack_until timestamptz;
begin
  if coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then
    raise exception using errcode='42501',message='Sign in to view membership';
  end if;
  select id into member from auth.users where id=auth.uid() and not coalesce(is_anonymous,true) and email_confirmed_at is not null;
  if member is null then raise exception using errcode='42501',message='Confirmed account required'; end if;
  select * into row from billing_private.members where mode='live' and owner_id=member;
  if row.status='active' and row.pro_until>now() then site_until:=row.pro_until; end if;
  external:=public.billing_substack_access(member);
  substack_until:=(external->>'paidThrough')::timestamptz;
  return jsonb_build_object(
    'plan',case when site_until is not null or substack_until is not null then 'pro' else 'free' end,
    'paidThrough',greatest(site_until,substack_until),
    'cancelAtPeriodEnd',coalesce(row.cancel_at_period_end,false),
    'hasBilling',row.customer_id is not null,
    'source',case when site_until is not null and substack_until is not null then 'both'
      when substack_until is not null then 'substack' when site_until is not null then 'site' else null end,
    'sitePaidThrough',site_until,'substackPaidThrough',substack_until);
end $$;

revoke all on function public.billing_substack_access(uuid),public.billing_substack_grant(text,text,timestamptz),
  public.billing_substack_revoke(text) from public,anon,authenticated;
grant execute on function public.billing_substack_access(uuid),public.billing_substack_grant(text,text,timestamptz),
  public.billing_substack_revoke(text) to service_role;
-- CREATE OR REPLACE retains the original membership_read ACL.
commit;
