-- An unlisted page is not authorization. Every report checks the verified owner.
begin;
create schema dashboard_private;
revoke all on schema dashboard_private from public,anon,authenticated;
create table dashboard_private.admins (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  verified_email text not null,
  created_at timestamptz not null default now()
);
create table dashboard_private.reports (
  id text primary key,title text not null,description text not null,
  source_sql text not null,position integer not null
);
alter table dashboard_private.admins enable row level security;
alter table dashboard_private.reports enable row level security;
revoke all on all tables in schema dashboard_private from public,anon,authenticated;

create function public.dashboard_authorized() returns boolean language sql stable
security definer set search_path='' as $$
  select coalesce(auth.jwt()->>'is_anonymous','true')='false' and exists(
    select 1 from dashboard_private.admins a join auth.users u on u.id=a.owner_id
    where u.id=auth.uid() and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,true)
      and lower(btrim(u.email))=a.verified_email);
$$;
create function dashboard_private.require_admin() returns void language plpgsql stable
security definer set search_path='' as $$
begin
  if not public.dashboard_authorized() then
    raise exception using errcode='42501',message='This dashboard is restricted to its authorized owner.';
  end if;
end $$;

-- Each source is developer-defined, projects only report fields, and has a stable
-- unique key for pagination. No caller SQL, table name or identifier is executed.
insert into dashboard_private.reports values
('members','Members and memberships','Confirmed accounts, live site payments and manually verified Substack access. Dates filter account creation.',
 $q$select u.id::text as key,u.created_at as at,jsonb_build_object(
 'member_id',u.id,'email',u.email,'handle',p.handle,'created_at',u.created_at,
 'site_paid_active',coalesce(b.status='active' and b.pro_until>now(),false),'site_payment_status',b.status,
 'site_paid_through',b.pro_until,'site_cancel_at_period_end',b.cancel_at_period_end,
 'substack_active',coalesce(s.revoked_at is null and s.pro_until>now() and s.verified_email=lower(btrim(u.email)),false),
 'substack_plan',s.subscription_plan,'substack_verified_email',s.verified_email,
 'substack_verified_through',s.pro_until,'substack_verified_at',s.verified_at,'substack_revoked_at',s.revoked_at) as row
 from auth.users u left join public.profiles p on p.id=u.id
 left join billing_private.members b on b.owner_id=u.id and b.mode='live'
 left join billing_private.substack_memberships s on s.owner_id=u.id
 where not coalesce(u.is_anonymous,true) and u.email_confirmed_at is not null$q$,10),
('site-paid','Site-paid members for Substack','Current site-paid members to compare with Substack comps. Dates filter the paid-through timestamp.',
 $q$select u.id::text as key,b.pro_until as at,jsonb_build_object('member_id',u.id,'email',u.email,
 'paid_through',b.pro_until,'cancel_at_period_end',b.cancel_at_period_end,'billing_last_checked',b.updated_at,
 'substack_verified_through',s.pro_until,'substack_plan',s.subscription_plan) as row
 from billing_private.members b join auth.users u on u.id=b.owner_id
 left join billing_private.substack_memberships s on s.owner_id=u.id
 where b.mode='live' and b.status='active' and b.pro_until>now()
 and not coalesce(u.is_anonymous,true) and u.email_confirmed_at is not null$q$,20),
('substack','Substack access and renewals','All manual Substack grants, including expired and revoked grants. Dates filter paid-through.',
 $q$select s.owner_id::text as key,s.pro_until as at,jsonb_build_object('member_id',s.owner_id,
 'site_email',u.email,'verified_email',s.verified_email,'plan',s.subscription_plan,'paid_through',s.pro_until,
 'verified_at',s.verified_at,'revoked_at',s.revoked_at,
 'active',coalesce(s.revoked_at is null and s.pro_until>now() and s.verified_email=lower(btrim(u.email)),false)) as row
 from billing_private.substack_memberships s join auth.users u on u.id=s.owner_id$q$,30),
('chat','Neighborhood chat','Saved registered-user messages, normally retained for 30 days. Guest messages are not stored. Dates filter message creation; exact room accepts a neighborhood or business room ID.',
 $q$select lpad(m.id::text,20,'0') as key,m.created_at as at,to_jsonb(m) as row from public.messages m$q$,40),
('comments','Place comments','Public comments on places and listings. Dates filter creation.',
 $q$select c.id::text as key,c.created_at as at,to_jsonb(c) as row from public.place_comments c$q$,50),
('classifieds','Classifieds','Current classified listings. Dates filter creation.',
 $q$select a.id::text as key,a.created_at as at,to_jsonb(a) as row from classifieds_private.ads a$q$,60),
('favorites','Member favorites','Saved favorites and their source details. Dates filter creation.',
 $q$select f.owner_id::text||':'||f.source_key as key,f.created_at as at,to_jsonb(f) as row from public.member_favorites f$q$,70),
('preferences','Member preferences','Saved theme, navigation and other site preferences. Dates filter last update.',
 $q$select p.owner_id::text as key,p.updated_at as at,to_jsonb(p) as row from public.member_preferences p$q$,80),
('plans','Day Plans','Saved planner settings and revisions. Dates filter last update.',
 $q$select p.id::text as key,p.updated_at as at,to_jsonb(p) as row from public.planner_plans p$q$,90),
('plan-items','Day Plan items','Saved places, schedule and planned day. Dates filter the planned day in UTC.',
 $q$select i.id::text as key,i.plan_day::timestamp at time zone 'UTC' as at,to_jsonb(i)-'location' as row from public.planner_items i$q$,100),
('reminders','Event reminders','Reminder enrollment and event details. Unsubscribe tokens are excluded. Dates filter event start.',
 $q$select r.id::text as key,r.starts_at as at,to_jsonb(r)-'unsubscribe_token' as row from public.event_reminders r$q$,110),
('reminder-delivery','Reminder delivery','Delivery status and attempts. Message payloads, unsubscribe tokens and lease details are excluded. Dates filter delivery due time.',
 $q$select j.id::text as key,j.due_at as at,jsonb_build_object('id',j.id,'reminder_id',j.reminder_id,'lead_hours',j.lead_hours,
 'due_at',j.due_at,'state',j.state,'attempts',j.attempts,'sent_at',j.sent_at) as row from public.event_reminder_jobs j$q$,120),
('tour-progress','Tour progress','Visited stops saved by registered members. Dates filter visit time.',
 $q$select p.user_id::text||':'||p.tour||':'||p.stop_id as key,p.visited_at as at,to_jsonb(p) as row from public.tour_progress p$q$,130),
('parcels','Parcel search data','Parcel attributes used by the site. Search an address, parcel ID, ZIP or zoning code. Geometry is excluded from Excel reports. Dates filter record creation.',
 $q$select p.parcel_id as key,p.created_at as at,to_jsonb(p)-'geom'-'centroid' as row from public.parcels_public p$q$,140),
('zoning-rules','Zoning rules','Austin zoning standards. Dates filter last update.',
 $q$select z.base_zoning as key,z.updated_at as at,to_jsonb(z) as row from public.austin_zoning_rules z$q$,150),
('market','Market context','ZIP-level sale and rent context. Dates filter last update.',
 $q$select m.zip as key,m.updated_at as at,to_jsonb(m) as row from public.market_context m$q$,160),
('source-vintage','Data freshness','Source dates and refresh information. Dates filter last update.',
 $q$select s.source_key as key,s.updated_at as at,to_jsonb(s) as row from public.source_vintage s$q$,170),
('substack-history','Substack grant history','Manual grant and revocation audit history. Dates filter action time.',
 $q$select lpad(h.id::text,20,'0') as key,h.recorded_at as at,to_jsonb(h) as row from billing_private.substack_history h$q$,180);

create function public.dashboard_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare reports jsonb;
begin
  perform dashboard_private.require_admin();
  select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description) order by position) into reports from dashboard_private.reports;
  return reports;
end $$;

create function public.dashboard_query(p_report text,p_search text default '',p_from timestamptz default null,
  p_to timestamptz default null,p_room text default '',p_cursor text default '',p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='15s' as $$
declare source text; results jsonb; page jsonb; more boolean;
begin
  perform dashboard_private.require_admin();
  if p_report is null or p_limit is null or p_limit<1 or p_limit>1000 or length(coalesce(p_search,''))>200
    or length(coalesce(p_room,''))>200 or length(coalesce(p_cursor,''))>1000
    or (p_from is not null and not isfinite(p_from)) or (p_to is not null and not isfinite(p_to))
    or (p_from is not null and p_to is not null and p_from>=p_to) then
    raise exception using errcode='22023',message='Invalid report filters.';
  end if;
  select source_sql into source from dashboard_private.reports where id=p_report;
  if source is null then raise exception using errcode='22023',message='Unknown report.';end if;
  if coalesce(p_room,'')<>'' and p_report<>'chat' then raise exception using errcode='22023',message='Room filter is only available for chat.';end if;
  execute 'select coalesce(jsonb_agg(jsonb_build_object(''key'',key,''row'',row) order by key),''[]''::jsonb) from ('||
    'select * from ('||source||') report where key>$1 and ($2='''' or strpos(lower(row::text),lower($2))>0)'||
    ' and ($3::timestamptz is null or at>=$3) and ($4::timestamptz is null or at<$4)'||
    ' and ($5='''' or row->>''room''=$5) order by key limit $6) page'
    into results using coalesce(p_cursor,''),coalesce(p_search,''),p_from,p_to,coalesce(p_room,''),p_limit+1;
  more:=jsonb_array_length(results)>p_limit;
  if more then results:=results-p_limit;end if;
  select coalesce(jsonb_agg(value->'row' order by ordinal),'[]'::jsonb) into page
    from jsonb_array_elements(results) with ordinality as rows(value,ordinal);
  return jsonb_build_object('rows',page,'more',more,'cursor',case when more then results->-1->>'key' else null end,
    'generatedAt',statement_timestamp());
end $$;

-- Owner-only manual activation controls; no billing mutation or external email.
create function public.dashboard_substack_grant(p_email text,p_plan text,p_until timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform dashboard_private.require_admin();
  return public.billing_substack_grant(p_email,p_plan,p_until);
end $$;
create function public.dashboard_substack_revoke(p_email text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform dashboard_private.require_admin();
  perform public.billing_substack_revoke(p_email);
end $$;
revoke all on all functions in schema dashboard_private from public,anon,authenticated;
revoke all on function public.dashboard_authorized(),public.dashboard_catalog(),
  public.dashboard_query(text,text,timestamptz,timestamptz,text,text,integer),
  public.dashboard_substack_grant(text,text,timestamptz),public.dashboard_substack_revoke(text) from public,anon,authenticated;
grant execute on function public.dashboard_authorized(),public.dashboard_catalog(),
  public.dashboard_query(text,text,timestamptz,timestamptz,text,text,integer),
  public.dashboard_substack_grant(text,text,timestamptz),public.dashboard_substack_revoke(text) to authenticated;
commit;
