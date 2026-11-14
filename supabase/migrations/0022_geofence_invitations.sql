-- Private invitation recipients; invitations are queued only after activation.
begin;
create table geofence_private.invitations (
 space_id uuid not null references geofence_private.spaces(id) on delete cascade,
 email text not null check(length(email)<=254 and email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'),
 created_at timestamptz not null default now(),queued_at timestamptz,sent_at timestamptz,
 primary key(space_id,email)
);
alter table geofence_private.invitations enable row level security;
revoke all on geofence_private.invitations from public,anon,authenticated;
alter table geofence_private.email_jobs drop constraint email_jobs_kind_check,
 add constraint email_jobs_kind_check check(kind in ('welcome','verify','activity','invitation')),
 add column recipient text;
create unique index geofence_invitation_once on geofence_private.email_jobs(space_id,recipient) where kind='invitation';

create function public.geofence_save_with_invitations(p_owner uuid,p_id uuid,p_fields jsonb,p_emails text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;emails text[];
begin
 if p_emails is null or coalesce(cardinality(p_emails),0) not between 1 and 25 or exists(select 1 from unnest(p_emails) e where e is null or length(e)>254 or btrim(e) !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$') then
  raise exception 'Add 1 to 25 valid invitation email addresses.' using errcode='PT422';
 end if;
 select array_agg(distinct lower(btrim(e))) into emails from unnest(p_emails) e;
 -- Existing draft ownership, account, activation and checkout locks apply.
 result:=public.geofence_save_draft(p_owner,p_id,p_fields);
 if (select count(*) from geofence_private.invitations i join geofence_private.spaces s on s.id=i.space_id where s.owner_id=p_owner and i.space_id<>p_id and coalesce(i.queued_at,i.created_at)>now()-interval '1 day')+cardinality(emails)>100 then
  raise exception 'You can invite up to 100 people per day. Please try again tomorrow.' using errcode='PT429';
 end if;
 delete from geofence_private.invitations where space_id=p_id and not(email=any(emails));
 insert into geofence_private.invitations(space_id,email) select p_id,e from unnest(emails) e on conflict do nothing;
 return result;
end $$;

create function public.geofence_invitation_list(p_owner uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(x.space_id,jsonb_build_object('total',x.total,'sent',x.sent,'queued',x.queued,'failed',x.failed)),'{}') from (
 select i.space_id,count(*) total,count(*) filter(where i.sent_at is not null) sent,
 count(*) filter(where j.state in ('pending','processing')) queued,
 count(*) filter(where i.sent_at is null and i.queued_at is not null and (j.id is null or j.state in ('failed','skipped','cancelled'))) failed
 from geofence_private.invitations i join geofence_private.spaces s on s.id=i.space_id
 left join geofence_private.email_jobs j on j.space_id=i.space_id and j.recipient=i.email and j.kind='invitation'
 where s.owner_id=p_owner group by i.space_id
 ) x;
$$;

create or replace function geofence_private.queue_welcome(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.geofence_active(p_id) then return;end if;
 insert into geofence_private.email_activations(space_id) values(p_id) on conflict do nothing;
 if found then insert into geofence_private.email_jobs(space_id,kind) values(p_id,'welcome');end if;
 with claimed as (
  update geofence_private.invitations set queued_at=now() where space_id=p_id and queued_at is null returning email
 ) insert into geofence_private.email_jobs(space_id,kind,recipient) select p_id,'invitation',email from claimed;
end $$;

create or replace function public.geofence_mail_context(p_id uuid,p_lease uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j geofence_private.email_jobs;s geofence_private.spaces;e geofence_private.email_settings;account_email text;
begin
 select * into j from geofence_private.email_jobs where id=p_id and lease_id=p_lease and state='processing' and lease_until>now();if not found then return null;end if;
 select * into s from geofence_private.spaces where id=j.space_id;
 select email into account_email from auth.users where id=s.owner_id and not coalesce(is_anonymous,true) and email_confirmed_at is not null;
 if account_email is null then return null;end if;
 if j.kind='invitation' then
  if not public.geofence_active(s.id) or not exists(select 1 from geofence_private.invitations where space_id=s.id and email=j.recipient and queued_at is not null) then return null;end if;
  return jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'diameter',s.diameter,'email',j.recipient);
 end if;
 select * into e from geofence_private.email_settings where space_id=s.id;
 if j.kind<>'welcome' and (e.space_id is null or not e.enabled or e.version<>j.settings_version) then return null;end if;
 if j.kind='verify' and (e.verified or e.verify_until<=now()) then return null;end if;
 if j.kind='activity' and not e.verified then return null;end if;
 if j.kind in ('welcome','activity') and not public.geofence_active(s.id) then return null;end if;
 return jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'diameter',s.diameter,
 'email',case when j.kind='welcome' then account_email else e.email end,'verifyToken',e.verify_token,'stopToken',e.stop_token);
end $$;

create or replace function public.geofence_mail_update(p_id uuid,p_lease uuid,p_state text default null,p_payload jsonb default null,p_provider text default null,p_result text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare job geofence_private.email_jobs;
begin
 if p_state is not null and p_state not in ('pending','sent','skipped','failed') then raise exception 'Invalid email state';end if;
 update geofence_private.email_jobs set payload=coalesce(payload,p_payload),state=coalesce(p_state,state),provider_id=coalesce(p_provider,provider_id),result=p_result,
 sent_at=case when p_state='sent' then now() else sent_at end,due_at=case when p_state='pending' then now()+interval '1 minute' else due_at end
 where id=p_id and lease_id=p_lease and state='processing' and lease_until>now() and (p_payload is null or payload is null or payload=p_payload) returning * into job;
 if not found then return false;end if;
 if job.kind='invitation' and p_state='sent' then update geofence_private.invitations set sent_at=coalesce(sent_at,now()) where space_id=job.space_id and email=job.recipient;end if;
 return true;
end $$;
revoke all on function public.geofence_save_with_invitations(uuid,uuid,jsonb,text[]),public.geofence_invitation_list(uuid) from public,anon,authenticated;
grant execute on function public.geofence_save_with_invitations(uuid,uuid,jsonb,text[]),public.geofence_invitation_list(uuid) to service_role;
notify pgrst,'reload schema';
commit;
