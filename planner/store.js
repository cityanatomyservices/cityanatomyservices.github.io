/* Planner persistence and subscriptions. No map, chat, presence or geolocation.
   Browser edits are durable first, then synced atomically. Cloud conflicts are
   visible and require a choice; failed requests never discard local edits. */
(() => {
  const M = window.PlanModel, R = window.PlanRepository;
  const prefix = 'austin:planner:v1:', listeners = new Set();
  let owner = null, client = null, key = prefix + 'guest', timer, started, conflict = false;
  let status = 'Opening your plan…', persistent = true;
  let envelope = { plan: M.empty(crypto.randomUUID()), revision: 0, dirty: false, stamp: '' };
  const copy = value => structuredClone(value);
  const lock = (name, fn) => navigator.locks ? navigator.locks.request(name, fn) : Promise.resolve().then(fn);
  function read(k = key) {
    try { const e = JSON.parse(localStorage.getItem(k)); return M.valid(e?.plan) ? e : null; } catch (_) { return null; }
  }
  function notify() { for (const fn of listeners) fn(); }
  function persist() {
    try { localStorage.setItem(key, JSON.stringify(envelope)); persistent = true; }
    catch (_) { persistent = false; status = 'Browser storage is unavailable. Keep this page open until saved online.'; }
  }
  const queue = () => { clearTimeout(timer); timer = setTimeout(sync, 700); };
  async function start() {
    // Show only the cache belonging to the currently authenticated identity.
    // A last-owner pointer is used solely if auth is temporarily unreachable.
    let lastOwner;
    const previousKey = key, volatileGuest = !persistent && key === prefix + 'guest' ? copy(envelope) : null;
    try { lastOwner = localStorage.getItem(prefix + 'last-owner'); } catch (_) { /* optional */ }
    try {
      const session = await Promise.race([window.AustinSession.ready(), new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 9000))]);
      owner = session.user.id; client = window.AustinSession.client(); key = prefix + owner;
      try { localStorage.setItem(prefix + 'last-owner', owner); } catch (_) { /* optional */ }
    } catch (_) {
      key = prefix + (lastOwner || 'guest');
      if (persistent || key !== previousKey) envelope = read() || envelope;
      status = 'Saved in this browser · connection unavailable'; notify(); return;
    }
    if (persistent || key !== previousKey) envelope = read() || { plan: M.empty(crypto.randomUUID()), revision: 0, dirty: false, stamp: '' };
    try {
      const remote = await R.load(client, owner, read() ? envelope.plan.id : null);
      if (remote) {
        if (envelope.dirty && remote.revision !== envelope.revision) conflict = true;
        else if (!envelope.dirty) envelope = remote;
      }
      const guest = volatileGuest || read(prefix + 'guest');
      if (guest?.plan.items.length && !conflict) {
        if (!remote && !envelope.plan.items.length) envelope = { ...guest, revision: 0 };
        const keys = new Set(envelope.plan.items.map(i => i.source.key));
        for (const item of guest.plan.items) if (!keys.has(item.source.key) && envelope.plan.items.length < 150) { envelope.plan.items.push(item); keys.add(item.source.key); }
        envelope.dirty = true; envelope.stamp = crypto.randomUUID();
        persist();
        if (persistent) try { localStorage.removeItem(prefix + 'guest'); } catch (_) { /* optional */ }
      }
      status = conflict ? 'A newer saved plan exists. Choose which copy to keep.' : envelope.dirty ? 'Saving…' : remote ? 'Saved privately · this browser’s account' : 'Ready · your plan is private';
      persist(); notify(); if (envelope.dirty && !conflict) queue();
    } catch (_) { status = 'Saved in this browser · online save unavailable'; notify(); }
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session && session.user.id !== owner)) {
        // Do not carry another identity's plan into the new account.
        client = null; owner = null; clearTimeout(timer); key = prefix + 'guest';
        envelope = { plan: M.empty(crypto.randomUUID()), revision: 0, dirty: false, stamp: '' };
        status = 'Account changed. Reload to open its plan.'; conflict = false; notify();
        try { localStorage.removeItem(prefix + 'last-owner'); } catch (_) { /* optional */ }
      }
    });
  }
  function ready() { if (!started) started = start(); return started; }
  async function edit(fn) {
    await ready();
    return lock('austin-planner-edit', () => {
      const latest = persistent ? read() : null; if (latest) envelope = latest;
      const next = copy(envelope.plan); fn(next);
      if (!M.valid(next)) throw new Error('Check the date, times and visit lengths. A plan can hold up to 150 places.');
      envelope = { ...envelope, plan: next, dirty: true, stamp: crypto.randomUUID() };
      status = conflict ? 'A newer saved plan exists. Choose which copy to keep.' : client ? 'Saving…' : 'Saved in this browser · connection unavailable';
      persist(); notify(); if (!conflict) queue();
    });
  }
  async function sync() {
    if (!client || conflict || !envelope.dirty) return;
    return lock('austin-planner-sync', async () => {
      const latest = persistent ? read() : null; if (latest) envelope = latest;
      if (!envelope.dirty || conflict) return;
      const sending = copy(envelope), savingKey = key;
      try {
        const result = await R.save(client, sending);
        if (key !== savingKey) return;
        await lock('austin-planner-edit', () => {
          if (persistent) envelope = read() || envelope;
          envelope.revision = result.revision;
          envelope.dirty = envelope.stamp !== sending.stamp;
          status = envelope.dirty ? 'Saving…' : 'Saved privately · this browser’s account';
          persist(); notify(); if (envelope.dirty) queue();
        });
      } catch (error) {
        if (key !== savingKey) return;
        conflict = error.code === 'PT409' || error.code === '40001' || /planner_revision_conflict/.test(error.message);
        status = conflict ? 'A newer saved plan exists. Choose which copy to keep.' : 'Saved in this browser · online save unavailable';
        notify();
      }
    });
  }
  async function resolve(useLocal) {
    if (!client) { started = null; return ready(); }
    await lock('austin-planner-sync', async () => {
      const remote = await R.load(client, owner, envelope.plan.id);
      await lock('austin-planner-edit', () => {
        envelope = useLocal ? { ...(persistent && read() || envelope), revision: remote?.revision || 0, dirty: true } : remote || { plan: M.empty(crypto.randomUUID()), revision: 0, dirty: false, stamp: '' };
        conflict = false; status = useLocal ? 'Saving…' : 'Saved privately · this browser’s account'; persist(); notify();
      });
    });
    if (useLocal) queue();
  }
  window.addEventListener('storage', event => {
    if (event.key === key && persistent) { const e = read(); if (e) { envelope = e; status = e.dirty ? 'Saving…' : 'Saved privately · this browser’s account'; notify(); if (e.dirty) queue(); } }
  });
  window.addEventListener('online', () => { if (!client) { started = null; ready(); } else sync(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (!client) { started = null; ready(); } else sync(); } });
  window.PlanStore = {
    ready, edit, sync, resolve,
    get plan() { return copy(envelope.plan); },
    get status() { return persistent ? status : 'Browser storage is unavailable. ' + status; },
    get conflict() { return conflict; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    has(source) { return envelope.plan.items.some(i => i.source.key === source.key); },
    async select(source, selected) {
      return edit(plan => {
        const index = plan.items.findIndex(i => i.source.key === source.key);
        if (selected && index < 0) {
          if (!plan.items.length && source.start) plan.date = M.day(source.start);
          plan.items.push(window.PlanSources.item(source, crypto.randomUUID()));
        }
        if (!selected && index >= 0) plan.items.splice(index, 1);
      });
    },
    retry() { if (!client) { started = null; return ready(); } return sync(); }
  };
})();
