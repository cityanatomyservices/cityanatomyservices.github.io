-- Custom $10/month circles are independent of site Pro and Special Events.
begin;
create schema geofence_private;
revoke all on schema geofence_private from public,anon,authenticated;
create table geofence_private.spaces (
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete restrict,
 name text not null check(char_length(btrim(name)) between 1 and 80),description text not null default '' check(char_length(description)<=400),
 latitude double precision not null check(latitude between -85 and 85),longitude double precision not null check(longitude between -180 and 180),
 diameter integer not null check(diameter between 10 and 100),created_at timestamptz not null default now()
);
create table geofence_private.billing (
 mode text not null check(mode in ('live','test')),space_id uuid not null references geofence_private.spaces(id) on delete cascade,
 customer_id text,subscription_id text,status text not null default 'none',pro_until timestamptz,cancel_at_period_end boolean not null default false,
 checkout_id text,checkout_nonce uuid not null default gen_random_uuid(),lease_id uuid,lease_until timestamptz,
 primary key(mode,space_id),unique(mode,customer_id)
);
create table geofence_private.people (
 space_id uuid not null references geofence_private.spaces(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
 visitor_id uuid not null default gen_random_uuid(),nickname text not null,joined_at timestamptz not null default now(),expires_at timestamptz not null,
 last_sent timestamptz,primary key(space_id,user_id)
);
create table geofence_private.messages (
 id bigint generated always as identity primary key,space_id uuid not null references geofence_private.spaces(id) on delete cascade,
 visitor_id uuid not null,nickname text not null,body text not null check(char_length(body) between 1 and 500),created_at timestamptz not null default now()
);
create index geofence_messages_room on geofence_private.messages(space_id,created_at);
create table geofence_private.geocode_limits(owner_id uuid primary key references auth.users(id) on delete cascade,requested_at timestamptz not null);
alter table geofence_private.spaces enable row level security;
alter table geofence_private.billing enable row level security;
alter table geofence_private.people enable row level security;
alter table geofence_private.messages enable row level security;
alter table geofence_private.geocode_limits enable row level security;
revoke all on all tables in schema geofence_private from public,anon,authenticated;

create function public.geofence_active(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from geofence_private.billing where mode='live' and space_id=p_id and status='active' and pro_until>now());
$$;
create function public.geofence_read(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'name',name,'description',description,'latitude',latitude,'longitude',longitude,'diameter',diameter,'paidUntil',b.pro_until)
 from geofence_private.spaces s join geofence_private.billing b on b.space_id=s.id and b.mode='live'
 where s.id=p_id and b.status='active' and b.pro_until>now();
$$;
create function public.geofence_owner_list(p_owner uuid,p_mode text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg((to_jsonb(s)-'owner_id')||jsonb_build_object('status',coalesce(b.status,'none'),'paidUntil',b.pro_until,'cancelAtPeriodEnd',coalesce(b.cancel_at_period_end,false),'hasBilling',b.customer_id is not null,'locked',b.customer_id is not null) order by s.created_at desc),'[]'::jsonb)
 from geofence_private.spaces s left join geofence_private.billing b on b.space_id=s.id and b.mode=p_mode where s.owner_id=p_owner;
$$;
create function public.geofence_save_draft(p_owner uuid,p_id uuid,p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s geofence_private.spaces;begin
 if not exists(select 1 from auth.users where id=p_owner and not coalesce(is_anonymous,true) and email_confirmed_at is not null) then raise exception 'Confirmed account required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,918));
 select * into s from geofence_private.spaces where id=p_id for update;
 if found and s.owner_id<>p_owner then raise exception 'Geofence not found' using errcode='PT404';end if;
 if s.id is null and (select count(*) from geofence_private.spaces where owner_id=p_owner)>=50 then raise exception 'Geofence limit reached' using errcode='PT422';end if;
 if exists(select 1 from geofence_private.billing where space_id=p_id and (customer_id is not null or lease_until>clock_timestamp())) then raise exception 'This location is locked because billing has begun.' using errcode='PT409';end if;
 insert into geofence_private.spaces(id,owner_id,name,description,latitude,longitude,diameter)
 values(p_id,p_owner,p_fields->>'name',p_fields->>'description',(p_fields->>'latitude')::double precision,(p_fields->>'longitude')::double precision,(p_fields->>'diameter')::integer)
 on conflict(id) do update set name=excluded.name,description=excluded.description,latitude=excluded.latitude,longitude=excluded.longitude,diameter=excluded.diameter returning * into s;
 return to_jsonb(s)-'owner_id';
end $$;
create function public.geofence_billing_load(p_mode text,p_id uuid default null,p_customer text default null) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(b)||jsonb_build_object('owner_id',s.owner_id,'name',s.name) from geofence_private.billing b join geofence_private.spaces s on s.id=b.space_id
 where b.mode=p_mode and ((b.space_id=p_id and p_customer is null) or (p_id is null and b.customer_id=p_customer));
$$;
create function public.geofence_billing_claim(p_mode text,p_id uuid,p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s geofence_private.spaces;b geofence_private.billing;begin
 select * into s from geofence_private.spaces where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'Geofence not found' using errcode='PT404';end if;
 if not exists(select 1 from auth.users where id=p_owner and not coalesce(is_anonymous,true) and email_confirmed_at is not null) then raise exception 'Confirmed account required' using errcode='42501';end if;
 insert into geofence_private.billing(mode,space_id) values(p_mode,p_id) on conflict do nothing;
 update geofence_private.billing set lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds'
 where mode=p_mode and space_id=p_id and (lease_until is null or lease_until<clock_timestamp()) returning * into b;
 if not found then raise exception 'Billing update in progress. Please retry shortly.' using errcode='PT409';end if;
 return to_jsonb(b)||jsonb_build_object('owner_id',s.owner_id,'name',s.name);
end $$;
create function public.geofence_billing_save(p_mode text,p_id uuid,p_lease uuid,p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b geofence_private.billing;begin
 if p_fields is null or jsonb_typeof(p_fields)<>'object' or exists(select 1 from jsonb_object_keys(p_fields) k where k not in ('customer_id','subscription_id','status','pro_until','cancel_at_period_end','checkout_id','checkout_nonce')) then raise exception 'Invalid billing fields';end if;
 select * into b from geofence_private.billing where mode=p_mode and space_id=p_id for update;
 if not found or p_lease is null or b.lease_id is distinct from p_lease or b.lease_until is null or b.lease_until<clock_timestamp() then raise exception 'Billing update expired' using errcode='PT409';end if;
 if b.customer_id is not null and p_fields?'customer_id' and b.customer_id is distinct from p_fields->>'customer_id' then raise exception 'Customer cannot change';end if;
 b:=jsonb_populate_record(b,p_fields);
 update geofence_private.billing set customer_id=b.customer_id,subscription_id=b.subscription_id,status=b.status,pro_until=b.pro_until,cancel_at_period_end=b.cancel_at_period_end,checkout_id=b.checkout_id,checkout_nonce=b.checkout_nonce where mode=p_mode and space_id=p_id;
 return public.geofence_billing_load(p_mode,p_id,null);
end $$;
create function public.geofence_billing_release(p_mode text,p_id uuid,p_lease uuid) returns void language sql security definer set search_path='' as $$
 update geofence_private.billing set lease_id=null,lease_until=null where mode=p_mode and space_id=p_id and lease_id=p_lease;
$$;
create function public.geofence_geocode_limit(p_owner uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into geofence_private.geocode_limits values(p_owner,clock_timestamp()) on conflict(owner_id) do update set requested_at=excluded.requested_at where geofence_private.geocode_limits.requested_at<clock_timestamp()-interval '3 seconds';
 if not found then raise exception 'Please wait a few seconds before searching again.' using errcode='PT429';end if;
end $$;

-- Only coordinates for the current request are evaluated; they are never stored.
-- GPS is browser-reported, not proof of a person's physical identity or presence.
create function public.geofence_chat(p_id uuid,p_lat double precision default null,p_lng double precision default null,p_accuracy double precision default null,p_timestamp timestamptz default null,p_text text default null,p_leave boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s geofence_private.spaces;person geofence_private.people;dist double precision;uid uuid:=auth.uid();begin
 if uid is null then raise exception 'A chat session is required' using errcode='PT401';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text||uid::text,919));
 if p_leave then delete from geofence_private.people where space_id=p_id and user_id=uid;return '{}'::jsonb;end if;
 if not public.geofence_active(p_id) then raise exception 'This geofence is not active.' using errcode='PT410';end if;
 select * into s from geofence_private.spaces where id=p_id;
 if p_lat is null or p_lat not between -90 and 90 or p_lng is null or p_lng not between -180 and 180 or p_accuracy is null or p_accuracy not between 0 and least(50,s.diameter/2.0) or p_timestamp is null or p_timestamp<clock_timestamp()-interval '45 seconds' or p_timestamp>clock_timestamp()+interval '5 seconds' then raise exception 'A fresh, precise GPS location is required.' using errcode='PT403';end if;
 dist:=12742000*asin(sqrt(least(1,power(sin(radians(p_lat-s.latitude)/2),2)+cos(radians(s.latitude))*cos(radians(p_lat))*power(sin(radians(p_lng-s.longitude)/2),2))));
 if dist>s.diameter/2.0 then raise exception 'You are outside this chat circle.' using errcode='PT403';end if;
 delete from geofence_private.people where space_id=p_id and expires_at<clock_timestamp();
 delete from geofence_private.messages where space_id=p_id and created_at<clock_timestamp()-interval '2 minutes';
 insert into geofence_private.people(space_id,user_id,nickname,expires_at) values(p_id,uid,'Visitor '||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),clock_timestamp()+interval '20 seconds')
 on conflict(space_id,user_id) do update set expires_at=excluded.expires_at returning * into person;
 if p_text is not null then
  if char_length(btrim(p_text)) not between 1 and 500 then raise exception 'Use 1–500 characters.' using errcode='PT422';end if;
  if person.last_sent>clock_timestamp()-interval '1 second' then raise exception 'Please wait before sending again.' using errcode='PT429';end if;
  insert into geofence_private.messages(space_id,visitor_id,nickname,body) values(p_id,person.visitor_id,person.nickname,btrim(p_text));
  update geofence_private.people set last_sent=clock_timestamp() where space_id=p_id and user_id=uid;
 end if;
 return jsonb_build_object('self',person.visitor_id,'people',(select coalesce(jsonb_agg(jsonb_build_object('id',visitor_id,'name',nickname) order by joined_at),'[]'::jsonb) from geofence_private.people where space_id=p_id and expires_at>clock_timestamp()),
 'messages',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) from (select id,visitor_id,nickname,body,created_at from geofence_private.messages where space_id=p_id and created_at>=person.joined_at order by id desc limit 100)m));
end $$;
create function public.geofence_cleanup() returns void language sql security definer set search_path='' as $$
 delete from geofence_private.people where expires_at<clock_timestamp();
 delete from geofence_private.messages where created_at<clock_timestamp()-interval '2 minutes';
 delete from geofence_private.geocode_limits where requested_at<clock_timestamp()-interval '1 day';
$$;
-- Explicit privileges for every entry point; no public table access.
revoke all on function public.geofence_active(uuid),public.geofence_read(uuid),public.geofence_owner_list(uuid,text),public.geofence_save_draft(uuid,uuid,jsonb),public.geofence_billing_load(text,uuid,text),public.geofence_billing_claim(text,uuid,uuid),public.geofence_billing_save(text,uuid,uuid,jsonb),public.geofence_billing_release(text,uuid,uuid),public.geofence_geocode_limit(uuid),public.geofence_chat(uuid,double precision,double precision,double precision,timestamptz,text,boolean),public.geofence_cleanup() from public,anon,authenticated;
grant execute on function public.geofence_read(uuid) to anon,authenticated;
grant execute on function public.geofence_chat(uuid,double precision,double precision,double precision,timestamptz,text,boolean) to authenticated;
grant execute on function public.geofence_owner_list(uuid,text),public.geofence_save_draft(uuid,uuid,jsonb),public.geofence_billing_load(text,uuid,text),public.geofence_billing_claim(text,uuid,uuid),public.geofence_billing_save(text,uuid,uuid,jsonb),public.geofence_billing_release(text,uuid,uuid),public.geofence_geocode_limit(uuid),public.geofence_cleanup() to service_role;
select cron.schedule('custom-geofence-chat-cleanup','*/5 * * * *','select public.geofence_cleanup()');
notify pgrst,'reload schema';
commit;
