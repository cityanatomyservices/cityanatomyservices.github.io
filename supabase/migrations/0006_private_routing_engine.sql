-- Supabase owns extension functions and may retain its default EXECUTE grants.
-- Keep the engine outside the Data API, behind the narrow planner RPC instead.
-- PostGIS remains in public, where the existing parcel applications expect it.
begin;
create schema if not exists routing_engine;
revoke all on schema routing_engine from public,anon,authenticated;
do $$ begin
  if exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    where e.extname='pgrouting' and n.nspname<>'routing_engine') then
    alter extension pgrouting set schema routing_engine;
  end if;
end $$;
notify pgrst,'reload schema';
commit;
