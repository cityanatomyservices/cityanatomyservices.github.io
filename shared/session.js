/* Shared identity transport only. No chat rooms, profiles, presence or planner
   tables belong here. All same-origin apps reuse Supabase's persisted session. */
(() => {
  let client, pending;
  const config = {
    url: 'https://aqbyxpiwugcvoephsvpm.supabase.co',
    key: 'sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN'
  };
  function getClient() {
    if (!client) client = window.supabase.createClient(config.url, config.key, {
      realtime: { params: { eventsPerSecond: 5 } },
      global: { fetch: (url, options = {}) => fetch(url, { ...options,
        signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) }
    });
    return client;
  }
  async function session() {
    const c = getClient();
    const { data, error } = await c.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    const fresh = await c.auth.signInAnonymously();
    if (fresh.error) throw fresh.error;
    return fresh.data.session;
  }
  window.AustinSession = {
    client: getClient,
    ready() {
      if (!pending) {
        // Coordinate first-time anonymous sign-in between applications/tabs.
        pending = (navigator.locks ? navigator.locks.request('austin-session-start', session) : session())
          .finally(() => { pending = null; });
      }
      return pending;
    }
  };
})();
