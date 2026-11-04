-- Server-owned Stripe associations. Test purchases can never grant live access.
begin;
create schema billing_private;
revoke all on schema billing_private from public,anon,authenticated;
create table billing_private.members (
  mode text not null check (mode in ('test','live')),
  owner_id uuid not null references auth.users(id) on delete restrict,
  customer_id text,
  subscription_id text,
  status text not null default 'none',
  pro_until timestamptz,
  cancel_at_period_end boolean not null default false,
  checkout_id text,
  checkout_nonce uuid not null default gen_random_uuid(),
  lease_id uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key(mode,owner_id),
  unique(mode,customer_id)
);
alter table billing_private.members enable row level security;
revoke all on all tables in schema billing_private from public,anon,authenticated;

create function public.billing_load(p_mode text,p_owner uuid default null,p_customer text default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(m) from billing_private.members m where mode=p_mode
    and ((p_owner is not null and owner_id=p_owner and p_customer is null)
      or (p_owner is null and customer_id=p_customer));
$$;

-- All reconciliation and checkout operations share a fenced per-account lease.
-- A crashed worker expires; an old worker cannot overwrite its replacement.
create function public.billing_claim(p_mode text,p_owner uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row billing_private.members;
begin
  if not exists(select 1 from auth.users where id=p_owner and not coalesce(is_anonymous,true)
    and email_confirmed_at is not null) then
    raise exception using errcode='42501',message='Confirmed account required';
  end if;
  insert into billing_private.members(mode,owner_id) values(p_mode,p_owner) on conflict do nothing;
  update billing_private.members set lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds'
    where mode=p_mode and owner_id=p_owner and (lease_until is null or lease_until<clock_timestamp()) returning * into row;
  if not found then raise exception using errcode='PT409',message='Billing update in progress'; end if;
  return to_jsonb(row);
end $$;

create function public.billing_save(p_mode text,p_owner uuid,p_lease uuid,p_fields jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row billing_private.members;
begin
  if p_fields is null or jsonb_typeof(p_fields)<>'object' or exists(select 1 from jsonb_object_keys(p_fields) k
    where k not in ('customer_id','subscription_id','status','pro_until','cancel_at_period_end','checkout_id','checkout_nonce')) then
    raise exception 'Invalid billing fields';
  end if;
  select * into row from billing_private.members where mode=p_mode and owner_id=p_owner for update;
  if not found or p_lease is null or row.lease_id is distinct from p_lease or row.lease_until is null or row.lease_until<clock_timestamp() then
    raise exception using errcode='PT409',message='Billing lease expired';
  end if;
  if row.customer_id is not null and p_fields ? 'customer_id' and row.customer_id is distinct from p_fields->>'customer_id' then
    raise exception 'Customer association cannot be changed';
  end if;
  row:=jsonb_populate_record(row,p_fields);
  update billing_private.members set customer_id=row.customer_id,subscription_id=row.subscription_id,
    status=row.status,pro_until=row.pro_until,cancel_at_period_end=row.cancel_at_period_end,
    checkout_id=row.checkout_id,checkout_nonce=row.checkout_nonce,updated_at=clock_timestamp()
    where mode=p_mode and owner_id=p_owner;
  return to_jsonb(row);
end $$;

create function public.billing_release(p_mode text,p_owner uuid,p_lease uuid)
returns void language sql security definer set search_path='' as $$
  update billing_private.members set lease_id=null,lease_until=null
    where mode=p_mode and owner_id=p_owner and lease_id=p_lease;
$$;

-- This is the only browser-callable billing RPC. It accepts no user/tier input.
create function public.membership_read() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare member uuid; row billing_private.members;
begin
  if coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then
    raise exception using errcode='42501',message='Sign in to view membership';
  end if;
  select id into member from auth.users where id=auth.uid() and not coalesce(is_anonymous,true) and email_confirmed_at is not null;
  if member is null then raise exception using errcode='42501',message='Confirmed account required'; end if;
  select * into row from billing_private.members where mode='live' and owner_id=member;
  return jsonb_build_object('plan',case when row.status='active' and row.pro_until>now() then 'pro' else 'free' end,
    'paidThrough',row.pro_until,'cancelAtPeriodEnd',coalesce(row.cancel_at_period_end,false),
    'hasBilling',row.customer_id is not null);
end $$;

revoke all on function public.billing_load(text,uuid,text),public.billing_claim(text,uuid),
  public.billing_save(text,uuid,uuid,jsonb),public.billing_release(text,uuid,uuid),public.membership_read() from public,anon,authenticated;
grant execute on function public.billing_load(text,uuid,text),public.billing_claim(text,uuid),
  public.billing_save(text,uuid,uuid,jsonb),public.billing_release(text,uuid,uuid) to service_role;
grant execute on function public.membership_read() to authenticated;
commit;
