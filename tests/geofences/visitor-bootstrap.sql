-- Platform objects that predate the application's migrations, for isolated CI only.
create extension postgis with schema public;
create role service_role bypassrls;
grant usage on schema auth to service_role;
alter table auth.users add column created_at timestamptz default now(),
  add column deleted_at timestamptz;

create table public.profiles(id uuid primary key references auth.users(id));
alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

create schema storage;
create table storage.buckets(id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(bucket_id text, name text);
alter table storage.objects enable row level security;

-- Record job definitions without running background work in the test database.
create schema cron;
create table cron.job(jobid bigint generated always as identity primary key, jobname text unique, schedule text, command text);
create function cron.schedule(text, text, text) returns bigint language sql as $$
  insert into cron.job(jobname,schedule,command) values ($1,$2,$3)
  on conflict(jobname) do update set schedule=excluded.schedule, command=excluded.command returning jobid
$$;
create function cron.unschedule(bigint) returns boolean language sql as $$
  with removed as (delete from cron.job where jobid=$1 returning jobid) select exists(select 1 from removed)
$$;
