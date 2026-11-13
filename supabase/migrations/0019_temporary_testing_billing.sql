-- Reversible, owner-controlled free testing. Paid billing records stay intact.
begin;
create table billing_private.testing_settings (
 singleton boolean primary key default true check(singleton),
 pro_enabled boolean not null default false,geofences_enabled boolean not null default false
);
insert into billing_private.testing_settings(singleton) values(true);
create table billing_private.testing_members (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 activated_at timestamptz not null default now()
);
create table geofence_private.testing_spaces (
 space_id uuid primary key references geofence_private.spaces(id) on delete cascade,
 activated_at timestamptz not null default now()
);
alter table billing_private.testing_settings enable row level security;
alter table billing_private.testing_members enable row level security;
alter table geofence_private.testing_spaces enable row level security;
revoke all on billing_private.testing_settings,billing_private.testing_members,geofence_private.testing_spaces from public,anon,authenticated;

create function public.access_testing_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('proEnabled',pro_enabled,'geofencesEnabled',geofences_enabled)
 from billing_private.testing_settings where singleton;
$$;
create function public.access_testing_set(p_pro boolean,p_geofences boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_pro is null or p_geofences is null then raise exception 'Both settings are required';end if;
 update billing_private.testing_settings set pro_enabled=p_pro,geofences_enabled=p_geofences where singleton;
 return public.access_testing_status();
end $$;
create function public.access_testing_grant(p_kind text,p_owner uuid,p_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare settings billing_private.testing_settings;s geofence_private.spaces;
begin
 if p_kind is null or p_kind not in ('pro','geofence') then raise exception 'Invalid access type' using errcode='PT422';end if;
 if not exists(select 1 from auth.users where id=p_owner and not coalesce(is_anonymous,true) and email_confirmed_at is not null) then raise exception 'Confirmed account required' using errcode='42501';end if;
 select * into settings from billing_private.testing_settings where singleton for share;
 if (p_kind='pro' and not settings.pro_enabled) or (p_kind='geofence' and not settings.geofences_enabled) then raise exception 'Free testing has ended. Refresh to see current options.' using errcode='PT409';end if;
 if p_kind='pro' then
  if p_id is not null then raise exception 'Invalid membership request' using errcode='PT422';end if;
  insert into billing_private.testing_members(owner_id) values(p_owner) on conflict do nothing;
 else
  select * into s from geofence_private.spaces where id=p_id and owner_id=p_owner for update;
  if not found then raise exception 'Geofence not found' using errcode='PT404';end if;
  insert into geofence_private.testing_spaces(space_id) values(p_id) on conflict do nothing;
 end if;
 return jsonb_build_object('activated',true,'temporaryAccess',true);
end $$;

-- Once shared, a free testing circle has the same fixed location as a paid one.
create function geofence_private.lock_testing_space() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from geofence_private.testing_spaces where space_id=old.id) then raise exception 'This geofence is already activated. Its location and size are fixed.' using errcode='PT409';end if;
 return new;
end $$;
create trigger lock_testing_space before update on geofence_private.spaces for each row execute function geofence_private.lock_testing_space();
revoke all on function geofence_private.lock_testing_space() from public,anon,authenticated;

create or replace function public.membership_read() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare member uuid;row billing_private.members;external jsonb;site_until timestamptz;substack_until timestamptz;testing boolean;temporary boolean;
begin
 if coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then raise exception using errcode='42501',message='Sign in to view membership';end if;
 select id into member from auth.users where id=auth.uid() and not coalesce(is_anonymous,true) and email_confirmed_at is not null;
 if member is null then raise exception using errcode='42501',message='Confirmed account required';end if;
 select * into row from billing_private.members where mode='live' and owner_id=member;
 if row.status='active' and row.pro_until>now() then site_until:=row.pro_until;end if;
 external:=public.billing_substack_access(member);substack_until:=(external->>'paidThrough')::timestamptz;
 select pro_enabled into testing from billing_private.testing_settings where singleton;
 temporary:=testing and exists(select 1 from billing_private.testing_members where owner_id=member) and site_until is null and substack_until is null;
 return jsonb_build_object('plan',case when site_until is not null or substack_until is not null or temporary then 'pro' else 'free' end,
  'paidThrough',greatest(site_until,substack_until),'cancelAtPeriodEnd',coalesce(row.cancel_at_period_end,false),'hasBilling',row.customer_id is not null,
  'source',case when site_until is not null and substack_until is not null then 'both' when substack_until is not null then 'substack' when site_until is not null then 'site' when temporary then 'testing' else null end,
  'sitePaidThrough',site_until,'substackPaidThrough',substack_until,'temporaryAccess',temporary,'freeTesting',testing);
end $$;
create or replace function public.geofence_active(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from geofence_private.billing where mode='live' and space_id=p_id and status='active' and pro_until>now())
 or exists(select 1 from geofence_private.testing_spaces t cross join billing_private.testing_settings s where t.space_id=p_id and s.singleton and s.geofences_enabled);
$$;
create or replace function public.geofence_read(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'name',name,'description',description,'latitude',latitude,'longitude',longitude,'diameter',diameter,'paidUntil',b.pro_until)
 from geofence_private.spaces s left join geofence_private.billing b on b.space_id=s.id and b.mode='live'
 where s.id=p_id and public.geofence_active(s.id);
$$;
create or replace function public.geofence_owner_list(p_owner uuid,p_mode text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg((to_jsonb(s)-'owner_id')||jsonb_build_object(
  'status',case when p_mode='live' and settings.geofences_enabled and t.space_id is not null then 'active' else coalesce(b.status,'none') end,
  'paidUntil',b.pro_until,'cancelAtPeriodEnd',coalesce(b.cancel_at_period_end,false),'hasBilling',b.customer_id is not null,
  'locked',b.customer_id is not null or t.space_id is not null,
  'temporaryAccess',p_mode='live' and settings.geofences_enabled and t.space_id is not null and not coalesce(b.status='active' and b.pro_until>now(),false)) order by s.created_at desc),'[]'::jsonb)
 from geofence_private.spaces s left join geofence_private.billing b on b.space_id=s.id and b.mode=p_mode
 left join geofence_private.testing_spaces t on t.space_id=s.id cross join billing_private.testing_settings settings
 where s.owner_id=p_owner and settings.singleton;
$$;
revoke all on function public.access_testing_status(),public.access_testing_set(boolean,boolean),public.access_testing_grant(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.access_testing_status() to anon,authenticated,service_role;
grant execute on function public.access_testing_set(boolean,boolean),public.access_testing_grant(text,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
