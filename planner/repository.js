/* The only planner module that knows Supabase table/RPC names. */
window.PlanRepository = {
  async load(client, owner, id) {
    const { data, error } = await client.rpc('planner_load_scoped', { p_scope: window.PlanContext.id, p_id: id || null });
    if (error) throw error;
    if (!data) return null;
    const legacy = data.plan?.schemaVersion !== 2;
    data.plan = window.PlanModel.upgrade(data.plan);
    if (data.plan?.scope !== window.PlanContext.id || !data.plan.items?.every(i=>window.PlanContext.accepts(i.source)) || !window.PlanModel.valid(data.plan)) throw new Error('Saved plan has an unsupported format. Your browser copy is intact.');
    if (legacy) data.dirty = true;
    return data;
  },
  async save(client, envelope) {
    const { id, items, ...settings } = envelope.plan;
    const { data, error } = await client.rpc('planner_save_scoped', { p_scope: window.PlanContext.id, p_id: id, p_revision: envelope.revision, p_settings: settings, p_items: items });
    if (error) throw error;
    return data;
  }
};
