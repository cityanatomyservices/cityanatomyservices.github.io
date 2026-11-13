-- Private owner email preferences, activation receipts and leased delivery jobs.
begin;
create table geofence_private.email_settings (
 space_id uuid primary key references geofence_private.spaces(id) on delete cascade,
 enabled boolean not null default false,email text not null,verified boolean not null default false,
 version uuid not null default gen_random_uuid(),verify_token uuid not null default gen_random_uuid(),
 stop_token uuid not null default gen_random_uuid(),verify_until timestamptz,
 updated_at timestamptz not null default now(),
 check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
create table geofence_private.email_activations (
 space_id uuid primary key references geofence_private.spaces(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table geofence_private.email_jobs (
 id uuid primary key default gen_random_uuid(),space_id uuid not null references geofence_private.spaces(id) on delete cascade,
 kind text not null check(kind in ('welcome','verify','activity')),settings_version uuid,
 events jsonb not null default '[]',created_at timestamptz not null default now(),due_at timestamptz not null default now(),
 state text not null default 'pending' check(state in ('pending','processing','sent','skipped','cancelled','failed')),
 attempts integer not null default 0,lease_id uuid,lease_until timestamptz,payload jsonb,
 provider_id text,sent_at timestamptz,result text
);
create index geofence_email_due on geofence_private.email_jobs(due_at) where state in ('pending','processing');
create index geofence_email_space on geofence_private.email_jobs(space_id,created_at);
alter table geofence_private.email_settings enable row level security;
alter table geofence_private.email_activations enable row level security;
alter table geofence_private.email_jobs enable row level security;
revoke all on geofence_private.email_settings,geofence_private.email_activations,geofence_private.email_jobs from public,anon,authenticated;

create function public.geofence_is_owner(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from geofence_private.spaces s join auth.users u on u.id=s.owner_id
 where s.id=p_id and u.id=auth.uid() and not coalesce(u.is_anonymous,true) and u.email_confirmed_at is not null);
$$;
create function public.geofence_email_list(p_owner uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(s.id,jsonb_build_object('enabled',coalesce(e.enabled,false),'email',coalesce(e.email,lower(u.email)),
 'verified',coalesce(e.verified,false),'pending',coalesce(e.enabled and not e.verified,false),
 'welcomeState',(select state from geofence_private.email_jobs j where j.space_id=s.id and kind='welcome' order by created_at desc limit 1))), '{}')
 from geofence_private.spaces s join auth.users u on u.id=s.owner_id left join geofence_private.email_settings e on e.space_id=s.id where s.owner_id=p_owner;
$$;
create function public.geofence_email_save(p_owner uuid,p_id uuid,p_enabled boolean,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous geofence_private.email_settings;account_email text;destination text:=lower(btrim(p_email));v uuid:=gen_random_uuid();confirmed boolean;
begin
 select lower(u.email) into account_email from geofence_private.spaces s join auth.users u on u.id=s.owner_id
 where s.id=p_id and s.owner_id=p_owner and not coalesce(u.is_anonymous,true) and u.email_confirmed_at is not null for update of s;
 if not found then raise exception 'Geofence not found' using errcode='PT404';end if;
 if p_enabled is null or destination is null or length(destination)>254 or destination !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid notification email.' using errcode='PT422';end if;
 select * into previous from geofence_private.email_settings where space_id=p_id;
 if previous.enabled=p_enabled and previous.email=destination and (previous.verified or previous.verify_until>now() or not p_enabled) then return public.geofence_email_list(p_owner)->p_id::text;end if;
 confirmed:=destination=account_email or coalesce(previous.email=destination and previous.verified,false);
 if p_enabled and not confirmed and (select count(*) from geofence_private.email_jobs j join geofence_private.spaces s on s.id=j.space_id where s.owner_id=p_owner and j.kind='verify' and j.created_at>now()-interval '1 hour')>=5 then raise exception 'Please wait before requesting another verification email.' using errcode='PT429';end if;
 insert into geofence_private.email_settings(space_id,enabled,email,verified,version,verify_until) values(p_id,p_enabled,destination,confirmed,v,now()+interval '24 hours')
 on conflict(space_id) do update set enabled=excluded.enabled,email=excluded.email,verified=excluded.verified,version=v,verify_token=gen_random_uuid(),stop_token=gen_random_uuid(),verify_until=excluded.verify_until,updated_at=now();
 update geofence_private.email_jobs set state='cancelled',result='Email settings changed' where space_id=p_id and kind in ('verify','activity') and state in ('pending','processing');
 if p_enabled and not confirmed then insert into geofence_private.email_jobs(space_id,kind,settings_version) values(p_id,'verify',v);end if;
 return public.geofence_email_list(p_owner)->p_id::text;
end $$;
create function public.geofence_email_token(p_token uuid,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e geofence_private.email_settings;
begin
 if p_action not in ('verify','stop') or p_action is null then raise exception 'Invalid email action' using errcode='PT422';end if;
 select * into e from geofence_private.email_settings where (p_action='verify' and verify_token=p_token) or (p_action='stop' and stop_token=p_token) for update;
 if not found or (p_action='verify' and (not e.enabled or e.verify_until<=now())) then raise exception 'This email link has expired. Update the geofence email settings to get a new one.' using errcode='PT404';end if;
 if p_action='verify' then update geofence_private.email_settings set verified=true where space_id=e.space_id;
 else
  update geofence_private.email_settings set enabled=false,version=gen_random_uuid() where space_id=e.space_id;
  update geofence_private.email_jobs set state='cancelled',result='Notifications turned off' where space_id=e.space_id and kind in ('activity','verify') and state in ('pending','processing');
 end if;
 return jsonb_build_object('ok',true);
end $$;

create function geofence_private.queue_welcome(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.geofence_active(p_id) then return;end if;
 insert into geofence_private.email_activations(space_id) values(p_id) on conflict do nothing;
 if found then insert into geofence_private.email_jobs(space_id,kind) values(p_id,'welcome');end if;
end $$;
create function geofence_private.email_activation() returns trigger language plpgsql security definer set search_path='' as $$
begin perform geofence_private.queue_welcome(new.space_id);return new;end $$;
create trigger email_paid_activation after insert or update on geofence_private.billing for each row execute function geofence_private.email_activation();
create trigger email_testing_activation after insert on geofence_private.testing_spaces for each row execute function geofence_private.email_activation();
create function geofence_private.email_presence() returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid;visitor text;e geofence_private.email_settings;jid uuid;event jsonb;
begin
 if tg_op='INSERT' then sid:=new.space_id;visitor:=new.nickname;else sid:=old.space_id;visitor:=old.nickname;end if;
 select * into e from geofence_private.email_settings where space_id=sid and enabled and verified for update;
 if not found or not public.geofence_active(sid) then return null;end if;
 event:=jsonb_build_object('kind',case when tg_op='INSERT' then 'enter' else 'leave' end,'name',visitor,'at',clock_timestamp());
 select id into jid from geofence_private.email_jobs where space_id=sid and kind='activity' and state='pending' and payload is null and settings_version=e.version and jsonb_array_length(events)<100 order by created_at desc limit 1 for update;
 if jid is null then insert into geofence_private.email_jobs(space_id,kind,settings_version,events,due_at) values(sid,'activity',e.version,jsonb_build_array(event),now()+interval '30 seconds');
 else update geofence_private.email_jobs set events=events||jsonb_build_array(event) where id=jid;end if;
 return null;
end $$;
create trigger email_chat_presence after insert or delete on geofence_private.people for each row execute function geofence_private.email_presence();

create function public.geofence_mail_claim() returns setof geofence_private.email_jobs language plpgsql security definer set search_path='' as $$
begin
 perform public.geofence_cleanup();
 delete from geofence_private.email_jobs where created_at<now()-interval '30 days';
 update geofence_private.email_jobs set state='skipped',result='Delivery window passed' where state in ('pending','processing') and
 (created_at<now()-interval '23 hours' or (kind='activity' and created_at<now()-interval '15 minutes') or (attempts>=5 and (state='pending' or lease_until<now())));
 return query with selected as (
 select id from geofence_private.email_jobs where due_at<=now() and attempts<5 and (state='pending' or (state='processing' and lease_until<now())) order by due_at for update skip locked limit 10
 ) update geofence_private.email_jobs j set state='processing',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes' from selected s where j.id=s.id returning j.*;
end $$;
create function public.geofence_mail_context(p_id uuid,p_lease uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j geofence_private.email_jobs;s geofence_private.spaces;e geofence_private.email_settings;account_email text;
begin
 select * into j from geofence_private.email_jobs where id=p_id and lease_id=p_lease and state='processing' and lease_until>now();if not found then return null;end if;
 select * into s from geofence_private.spaces where id=j.space_id;
 select email into account_email from auth.users where id=s.owner_id and not coalesce(is_anonymous,true) and email_confirmed_at is not null;
 if account_email is null then return null;end if;
 select * into e from geofence_private.email_settings where space_id=s.id;
 if j.kind<>'welcome' and (e.space_id is null or not e.enabled or e.version<>j.settings_version) then return null;end if;
 if j.kind='verify' and (e.verified or e.verify_until<=now()) then return null;end if;
 if j.kind='activity' and not e.verified then return null;end if;
 if j.kind in ('welcome','activity') and not public.geofence_active(s.id) then return null;end if;
 return jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'diameter',s.diameter,
 'email',case when j.kind='welcome' then account_email else e.email end,'verifyToken',e.verify_token,'stopToken',e.stop_token);
end $$;
create function public.geofence_mail_update(p_id uuid,p_lease uuid,p_state text default null,p_payload jsonb default null,p_provider text default null,p_result text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_state is not null and p_state not in ('pending','sent','skipped','failed') then raise exception 'Invalid email state';end if;
 update geofence_private.email_jobs set payload=coalesce(payload,p_payload),state=coalesce(p_state,state),provider_id=coalesce(p_provider,provider_id),result=p_result,
 sent_at=case when p_state='sent' then now() else sent_at end,due_at=case when p_state='pending' then now()+interval '1 minute' else due_at end
 where id=p_id and lease_id=p_lease and state='processing' and lease_until>now() and (p_payload is null or payload is null or payload=p_payload);
 return found;
end $$;
revoke all on function geofence_private.queue_welcome(uuid),geofence_private.email_activation(),geofence_private.email_presence() from public,anon,authenticated;
revoke all on function public.geofence_is_owner(uuid),public.geofence_email_list(uuid),public.geofence_email_save(uuid,uuid,boolean,text),public.geofence_email_token(uuid,text),public.geofence_mail_claim(),public.geofence_mail_context(uuid,uuid),public.geofence_mail_update(uuid,uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.geofence_is_owner(uuid) to authenticated;
grant execute on function public.geofence_email_list(uuid),public.geofence_email_save(uuid,uuid,boolean,text),public.geofence_email_token(uuid,text),public.geofence_mail_claim(),public.geofence_mail_context(uuid,uuid),public.geofence_mail_update(uuid,uuid,text,jsonb,text,text) to service_role;
-- Existing active circles receive the same one-time share email.
select geofence_private.queue_welcome(id) from geofence_private.spaces where public.geofence_active(id);
notify pgrst,'reload schema';
commit;
