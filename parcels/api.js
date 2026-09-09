// api.js — thin wrappers around PostgREST RPCs and (later) the parcel-qa
// Edge Function. Decouples the UI from the supabase client so the drawer
// can be unit-tested with a stub.
//
// Usage from app.js after creating the Supabase client:
//   ParcelAPI.init(sb);
//   const data = await ParcelAPI.getParcel(id);
//   const constraints = await ParcelAPI.getConstraints(id);

(function () {
  let _sb = null;

  function requireSb() {
    if (!_sb) throw new Error('ParcelAPI used before init(sb)');
    return _sb;
  }

  // Reads the anon-readable parcels_public view of the paid project. That
  // schema stores the base district in zoning_base and the full combining
  // string (e.g. "SF-3-NP") in zoning_ztype, so we map them onto the field
  // names the drawer expects (zoning / zoning_overlay).
  async function getParcel(parcelId) {
    const { data, error } = await requireSb()
      .from('parcels_public')
      .select('parcel_id,zoning_base,zoning_ztype,metadata')
      .eq('parcel_id', String(parcelId))
      .maybeSingle();
    if (error) throw error;
    if (!data) return data;
    const overlay = data.zoning_ztype && data.zoning_ztype !== data.zoning_base
      ? data.zoning_ztype : null;
    return {
      parcel_id:      data.parcel_id,
      zoning:         data.zoning_base,
      zoning_overlay: overlay,
      metadata:       data.metadata
    };
  }

  async function getConstraints(parcelId) {
    // PostgREST exposes SQL functions at /rpc/<name>. supabase-js wraps it.
    const { data, error } = await requireSb()
      .rpc('get_parcel_constraints', { p_parcel_id: String(parcelId) });
    if (error) throw error;
    return data;
  }

  // Search/filter — multi-parcel counterpart to getConstraints. Returns the
  // parcel_ids matching the given criteria within a viewport bbox. Backed by
  // the search_parcels RPC (see scripts/sql/search_parcels.sql).
  async function searchParcels(params) {
    const p = params || {};
    const cats = Array.isArray(p.categories) && p.categories.length
      ? p.categories : null;
    const { data, error } = await requireSb().rpc('search_parcels', {
      p_categories: cats,
      p_far_min:    p.farMin    != null ? p.farMin    : null,
      p_far_max:    p.farMax    != null ? p.farMax    : null,
      p_height_min: p.heightMin != null ? p.heightMin : null,
      p_height_max: p.heightMax != null ? p.heightMax : null,
      p_west:  p.west  != null ? p.west  : null,
      p_south: p.south != null ? p.south : null,
      p_east:  p.east  != null ? p.east  : null,
      p_north: p.north != null ? p.north : null
    });
    if (error) throw error;
    return (data || []).map(row => row.parcel_id);
  }

  // Phase B / C placeholders — wire once their RPCs / Edge Function ship.
  async function getCases(/* parcelId */) {
    return { not_implemented: true };
  }

  async function ask(/* parcelId, question */) {
    throw new Error('Q&A not enabled yet — Phase C work.');
  }

  window.ParcelAPI = {
    init(sb) { _sb = sb; },
    getParcel,
    getConstraints,
    searchParcels,
    getCases,
    ask
  };
}());
