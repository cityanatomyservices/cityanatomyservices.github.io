-- Minimal report sources for isolated CI only; never deploy these fixture tables.
alter table auth.users add column created_at timestamptz default now();
create table public.profiles(id uuid primary key,handle text);
create table public.messages(id bigserial primary key,room text,user_id uuid,handle text,emoji text,text text,created_at timestamptz);
create table public.place_comments(id uuid,created_at timestamptz);
create schema classifieds_private;
create table classifieds_private.ads(id uuid,created_at timestamptz);
create table public.member_favorites(owner_id uuid,source_key text,created_at timestamptz);
create table public.member_preferences(owner_id uuid,updated_at timestamptz);
create table public.planner_plans(id uuid,updated_at timestamptz);
create table public.planner_items(id uuid,plan_day date,location text);
create table public.event_reminders(id uuid,starts_at timestamptz,unsubscribe_token uuid);
create table public.event_reminder_jobs(id uuid,reminder_id uuid,lead_hours integer,due_at timestamptz,state text,attempts integer,sent_at timestamptz);
create table public.tour_progress(user_id uuid,tour text,stop_id text,visited_at timestamptz);
create table public.parcels_public(parcel_id text,created_at timestamptz,geom text,centroid text);
create table public.austin_zoning_rules(base_zoning text,updated_at timestamptz);
create table public.market_context(zip text,updated_at timestamptz);
create table public.source_vintage(source_key text,updated_at timestamptz);
