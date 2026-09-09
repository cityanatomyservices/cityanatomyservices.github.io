-- scripts/sql/search_parcels.sql
--
-- RPC called by the parcel filter panel on /parcels/index.html. Returns
-- parcel_ids matching zoning-category / FAR / height criteria inside the
-- map-viewport bounding box.
--
-- 2026-09-09: rewritten for the paid cityanatomyservices Supabase project
-- (aqbyxpiwugcvoephsvpm): reads public.parcels_public (anon-readable view)
-- and joins austin_zoning_rules on zoning_base (was parcels.zoning). The
-- parcel tables are owned by the WhatCanIBuildHere repo; this only ADDS a
-- function. Idempotent.
--
-- PERFORMANCE: the viewport bbox is a direct, mandatory predicate
-- (`p.geom && st_makeenvelope(...)`) so the planner uses the GiST index
-- parcels_geom_idx through the view. Do NOT wrap it in an `OR ... IS NULL`
-- guard — that defeats the index and the query scans the whole city.
--
-- Parameters: p_categories text[] (austin_zoning_rules.category values),
--   p_far_min/p_far_max, p_height_min/p_height_max numeric,
--   p_west/p_south/p_east/p_north numeric — WGS-84 viewport (REQUIRED;
--   a null bbox yields no rows).

create or replace function public.search_parcels(
  p_categories text[]  default null,
  p_far_min    numeric default null,
  p_far_max    numeric default null,
  p_height_min numeric default null,
  p_height_max numeric default null,
  p_west       numeric default null,
  p_south      numeric default null,
  p_east       numeric default null,
  p_north      numeric default null
)
returns table(parcel_id text)
language sql
stable
security invoker
set statement_timeout to '20s'
as $$
  select p.parcel_id
  from   public.parcels_public p
  left join public.austin_zoning_rules r on r.base_zoning = p.zoning_base
  where
    p.geom && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
    and (p_categories is null or r.category = any(p_categories))
    and (p_far_min is null or r.far >= p_far_min)
    and (p_far_max is null or r.far <= p_far_max)
    and (p_height_min is null or r.max_height_ft >= p_height_min)
    and (p_height_max is null or r.max_height_ft <= p_height_max)
  limit 20000;
$$;

revoke all on function public.search_parcels(
  text[], numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric
) from public;

grant execute on function public.search_parcels(
  text[], numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric
) to anon, authenticated;

-- Smoke test (small downtown bbox, should return fast):
--   select count(*) from public.search_parcels(
--     array['commercial'], 1.0, null, null, null,
--     -97.76, 30.25, -97.72, 30.29);
