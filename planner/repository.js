/* The only planner module that knows Supabase table/RPC names. */
window.PlanRepository = {
  async load(client, owner, id) {
    const { data, error } = await client.rpc('planner_load', { p_id: id || null });
    if (error) throw error;
    if (!data) return null;
    if (!window.PlanModel.valid(data.plan)) throw new Error('Saved plan has an unsupported format. Your browser copy is intact.');
    return data;
  },
  async save(client, envelope) {
    const { id, items, ...settings } = envelope.plan;
    const { data, error } = await client.rpc('planner_save', { p_id: id, p_revision: envelope.revision, p_settings: settings, p_items: items });
    if (error) throw error;
    return data;
  }
};
