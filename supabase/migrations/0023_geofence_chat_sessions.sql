-- Named chat sessions with deletion within 24 hours of the last participant leaving.
begin;
set local lock_timeout='5s';
create table geofence_private.conversations (
 id uuid primary key default gen_random_uuid(),space_id uuid not null references geofence_private.spaces(id) on delete cascade,
 started_at timestamptz not null default now(),ended_at timestamptz
);
create unique index geofence_one_open_conversation on geofence_private.conversations(space_id) where ended_at is null;
create index geofence_conversation_cleanup on geofence_private.conversations(ended_at) where ended_at is not null;
alter table geofence_private.conversations enable row level security;
revoke all on geofence_private.conversations from public,anon,authenticated;
alter table geofence_private.people add column conversation_id uuid references geofence_private.conversations(id) on delete cascade;
alter table geofence_private.messages add column conversation_id uuid references geofence_private.conversations(id) on delete cascade;
-- Preserve the messages and visits already present during this upgrade.
insert into geofence_private.conversations(space_id,started_at,ended_at)
 select s.id,coalesce((select min(created_at) from geofence_private.messages where space_id=s.id),now()),
 case when exists(select 1 from geofence_private.people where space_id=s.id) then null else now() end
 from geofence_private.spaces s where exists(select 1 from geofence_private.people where space_id=s.id) or exists(select 1 from geofence_private.messages where space_id=s.id);
update geofence_private.people p set conversation_id=c.id from geofence_private.conversations c where c.space_id=p.space_id;
update geofence_private.messages m set conversation_id=c.id from geofence_private.conversations c where c.space_id=m.space_id;
alter table geofence_private.people alter column conversation_id set not null;
alter table geofence_private.messages alter column conversation_id set not null;
create index geofence_conversation_messages on geofence_private.messages(conversation_id,id);

create function geofence_private.end_conversation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from geofence_private.people where conversation_id=old.conversation_id and expires_at>clock_timestamp()) then
  update geofence_private.conversations set ended_at=least(clock_timestamp(),greatest(old.expires_at,coalesce((select max(expires_at) from geofence_private.people where conversation_id=old.conversation_id),old.expires_at)))
  where id=old.conversation_id and ended_at is null;
 end if;
 return null;
end $$;
create trigger geofence_chat_session_end after delete on geofence_private.people for each row execute function geofence_private.end_conversation();
revoke all on function geofence_private.end_conversation() from public,anon,authenticated;

create function public.geofence_chat_v2(p_id uuid,p_lat double precision default null,p_lng double precision default null,p_accuracy double precision default null,p_timestamp timestamptz default null,p_text text default null,p_leave boolean default false,p_name text default null,p_use_profile boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s geofence_private.spaces;person geofence_private.people;dist double precision;uid uuid:=auth.uid();conversation uuid;display_name text;
begin
 if uid is null then raise exception 'A chat session is required' using errcode='PT401';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,920));
 if p_leave then delete from geofence_private.people where space_id=p_id and user_id=uid;return '{}'::jsonb;end if;
 if not public.geofence_active(p_id) then raise exception 'This geofence is not active.' using errcode='PT410';end if;
 select * into s from geofence_private.spaces where id=p_id;
 if p_lat is null or p_lat not between -90 and 90 or p_lng is null or p_lng not between -180 and 180 or p_accuracy is null or p_accuracy not between 0 and least(50,s.diameter/2.0) or p_timestamp is null or p_timestamp<clock_timestamp()-interval '45 seconds' or p_timestamp>clock_timestamp()+interval '5 seconds' then raise exception 'A fresh, precise GPS location is required.' using errcode='PT403';end if;
 dist:=12742000*asin(sqrt(least(1,power(sin(radians(p_lat-s.latitude)/2),2)+cos(radians(s.latitude))*cos(radians(p_lat))*power(sin(radians(p_lng-s.longitude)/2),2))));
 if dist>s.diameter/2.0 then raise exception 'You are outside this chat circle.' using errcode='PT403';end if;
 if p_use_profile then
  select p.handle into display_name from public.profiles p join auth.users u on u.id=p.id where p.id=uid and not coalesce(u.is_anonymous,true) and u.email_confirmed_at is not null;
  if display_name is null then raise exception 'Set a profile name in Account, or choose an anonymous name.' using errcode='PT422';end if;
 else
  display_name:=coalesce(btrim(p_name),'Visitor '||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)));
  if char_length(display_name) not between 1 and 30 or display_name ~ '[[:cntrl:]@]' then raise exception 'Choose an anonymous name of 1 to 30 characters, without an email address.' using errcode='PT422';end if;
 end if;
 delete from geofence_private.people where space_id=p_id and expires_at<clock_timestamp();
 select id into conversation from geofence_private.conversations where space_id=p_id and ended_at is null for update;
 if conversation is null then insert into geofence_private.conversations(space_id,started_at) values(p_id,clock_timestamp()) returning id into conversation;end if;
 insert into geofence_private.people(space_id,user_id,conversation_id,nickname,joined_at,expires_at) values(p_id,uid,conversation,display_name,clock_timestamp(),clock_timestamp()+interval '20 seconds')
 on conflict(space_id,user_id) do update set expires_at=excluded.expires_at returning * into person;
 if p_text is not null then
  if char_length(btrim(p_text)) not between 1 and 500 then raise exception 'Use 1–500 characters.' using errcode='PT422';end if;
  if person.last_sent>clock_timestamp()-interval '1 second' then raise exception 'Please wait before sending again.' using errcode='PT429';end if;
  insert into geofence_private.messages(space_id,conversation_id,visitor_id,nickname,body,created_at) values(p_id,conversation,person.visitor_id,person.nickname,btrim(p_text),clock_timestamp());
  update geofence_private.people set last_sent=clock_timestamp() where space_id=p_id and user_id=uid;
 end if;
 return jsonb_build_object('self',person.visitor_id,'conversationId',conversation,
 'people',(select coalesce(jsonb_agg(jsonb_build_object('id',visitor_id,'name',nickname) order by joined_at),'[]'::jsonb) from geofence_private.people where space_id=p_id and expires_at>clock_timestamp()),
 'messages',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) from (select id,visitor_id,nickname,body,created_at from geofence_private.messages where conversation_id=conversation and created_at>=person.joined_at order by id desc limit 100)m));
end $$;
revoke all on function public.geofence_chat_v2(uuid,double precision,double precision,double precision,timestamptz,text,boolean,text,boolean) from public,anon;
grant execute on function public.geofence_chat_v2(uuid,double precision,double precision,double precision,timestamptz,text,boolean,text,boolean) to authenticated;
-- Older open pages keep the same endpoint and receive the same privacy rules.
create or replace function public.geofence_chat(p_id uuid,p_lat double precision default null,p_lng double precision default null,p_accuracy double precision default null,p_timestamp timestamptz default null,p_text text default null,p_leave boolean default false)
returns jsonb language sql security definer set search_path='' as $$
 select public.geofence_chat_v2(p_id,p_lat,p_lng,p_accuracy,p_timestamp,p_text,p_leave);
$$;
create or replace function public.geofence_cleanup() returns void language sql security definer set search_path='' as $$
 delete from geofence_private.people where expires_at<clock_timestamp();
 -- Ten minutes of slack for the existing five-minute cleanup schedule.
 delete from geofence_private.conversations where ended_at<clock_timestamp()-interval '23 hours 50 minutes';
 delete from geofence_private.geocode_limits where requested_at<clock_timestamp()-interval '1 day';
$$;
notify pgrst,'reload schema';
commit;
