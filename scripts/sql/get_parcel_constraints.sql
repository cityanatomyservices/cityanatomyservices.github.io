-- scripts/sql/get_parcel_constraints.sql
--
-- RPC the browser calls (via PostgREST `rpc/get_parcel_constraints`) to
-- populate the "Constraints" tab of the side drawer on /parcels/.
--
-- 2026-09-09: rewritten for the paid cityanatomyservices Supabase project
-- (aqbyxpiwugcvoephsvpm). Differences from the old free-project version:
--   * reads public.parcels_public (the anon-readable view over parcels)
--     instead of public.parcels — anon has no grant on the base table;
--   * the base zoning district lives in zoning_base (was parcels.zoning);
--   * the full combining string (e.g. "SF-3-NP") lives in zoning_ztype and is
--     returned as zoning_overlay when it differs from the base district.
-- The parcel tables themselves are owned by the WhatCanIBuildHere repo
-- (austingraph/austingraph.github.io); this file only ADDS a function.
--
-- Output jsonb (nulls stripped):
--   { parcel_id, zoning, zoning_overlay, lot_area_sqft, lot_area_acres,
--     rules: {...austin_zoning_rules row...}, computed: {...}, warnings: [...] }
-- Failure modes surface as `warnings`, not errors:
--   parcel not found -> { error: "parcel_not_found" }
--   no base zoning   -> rules omitted, warning "zoning_unknown"
--   no rules row     -> rules omitted, warning "no_rules_for_zoning:<code>"
--
-- Anon-callable; security invoker, so the view/RLS grants still apply.
-- Idempotent. How to run: node-free — paste into the Supabase SQL editor,
-- or POST it to the Management API query endpoint (see docs/STATUS.md).

create or replace function public.get_parcel_constraints(p_parcel_id text)
returns jsonb
language plpgsql
stable
security invoker
as $$
declare
  v_parcel       public.parcels_public%rowtype;
  v_rules        public.austin_zoning_rules%rowtype;
  v_zoning       text;
  v_overlay      text;
  v_lot_sqft     numeric;
  v_lot_acres    numeric;
  v_warnings     jsonb := '[]'::jsonb;
  v_rules_jsonb  jsonb := null;
  v_computed     jsonb := '{}'::jsonb;
begin
  select * into v_parcel from public.parcels_public where parcel_id = p_parcel_id;
  if not found then
    return jsonb_build_object('error', 'parcel_not_found', 'parcel_id', p_parcel_id);
  end if;

  v_zoning  := v_parcel.zoning_base;
  v_overlay := case when v_parcel.zoning_ztype is distinct from v_parcel.zoning_base
                    then v_parcel.zoning_ztype end;

  -- Lot area in sqft from geographic area (handles latitude correctly).
  v_lot_sqft  := round((st_area(v_parcel.geom::geography) * 10.7639)::numeric, 1);
  v_lot_acres := round((v_lot_sqft / 43560.0)::numeric, 4);

  if v_zoning is null then
    v_warnings := v_warnings || jsonb_build_array('zoning_unknown');
  else
    select * into v_rules from public.austin_zoning_rules
      where base_zoning = v_zoning;
    if not found then
      v_warnings := v_warnings || jsonb_build_array(
        format('no_rules_for_zoning:%s', v_zoning)
      );
    else
      v_rules_jsonb := jsonb_build_object(
        'display_name',      v_rules.display_name,
        'category',          v_rules.category,
        'far',               v_rules.far,
        'max_height_ft',     v_rules.max_height_ft,
        'impervious_pct',    v_rules.impervious_pct,
        'building_pct',      v_rules.building_pct,
        'min_lot_sqft',      v_rules.min_lot_sqft,
        'min_lot_width_ft',  v_rules.min_lot_width_ft,
        'front_setback_ft',  v_rules.front_setback_ft,
        'side_setback_ft',   v_rules.side_setback_ft,
        'rear_setback_ft',   v_rules.rear_setback_ft,
        'max_units_per_acre',v_rules.max_units_per_acre,
        'notes',             v_rules.notes,
        'source_citation',   v_rules.source_citation
      );

      v_computed := jsonb_strip_nulls(jsonb_build_object(
        'max_floor_area_sqft',
          case when v_rules.far is not null
               then round(v_lot_sqft * v_rules.far) end,
        'max_impervious_sqft',
          case when v_rules.impervious_pct is not null
               then round(v_lot_sqft * v_rules.impervious_pct / 100.0) end,
        'max_building_sqft',
          case when v_rules.building_pct is not null
               then round(v_lot_sqft * v_rules.building_pct / 100.0) end,
        'max_height_ft',     v_rules.max_height_ft,
        'max_units',
          case when v_rules.max_units_per_acre is not null
               then floor(v_lot_acres * v_rules.max_units_per_acre)::int end,
        'min_lot_satisfied',
          case when v_rules.min_lot_sqft is not null
               then v_lot_sqft >= v_rules.min_lot_sqft end
      ));

      if v_rules.min_lot_sqft is not null and v_lot_sqft < v_rules.min_lot_sqft then
        v_warnings := v_warnings || jsonb_build_array('lot_below_minimum');
      end if;
    end if;
  end if;

  if v_overlay is not null then
    v_warnings := v_warnings || jsonb_build_array(
      format('overlay_present:%s', v_overlay)
    );
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'parcel_id',      v_parcel.parcel_id,
    'zoning',         v_zoning,
    'zoning_overlay', v_overlay,
    'lot_area_sqft',  v_lot_sqft,
    'lot_area_acres', v_lot_acres,
    'rules',          v_rules_jsonb,
    'computed',       case when v_computed = '{}'::jsonb then null else v_computed end,
    'warnings',       case when jsonb_array_length(v_warnings) = 0 then null else v_warnings end
  ));
end $$;

revoke all on function public.get_parcel_constraints(text) from public;
grant execute on function public.get_parcel_constraints(text) to anon, authenticated;

-- Smoke test:
--   select public.get_parcel_constraints(parcel_id)
--     from public.parcels_public where zoning_base = 'SF-3' limit 1;
