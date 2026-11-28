(() => {
  const gate = document.getElementById('parcel-access');
  const workspace = document.getElementById('parcel-workspace');
  const status = document.getElementById('access-status');
  const action = document.getElementById('access-action');
  const manage = document.getElementById('manage-payment');
  const session = window.AustinSession;
  const endpoint = window.PARCELS_CONFIG.supabase.url + '/functions/v1/parcel-page';
  let paid = false, owner = null;

  async function request(operation, authenticated = false) {
    const credentials = authenticated ? await session.peek() : null;
    const headers = {'Content-Type':'application/json'};
    if (credentials?.user?.is_anonymous === false) headers.Authorization = 'Bearer ' + credentials.access_token;
    const response = await fetch(endpoint, {method:'POST', headers, body:JSON.stringify({action:operation}),
      cache:'no-store', signal:AbortSignal.timeout(30000)});
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Parcel access is unavailable.');
    return result;
  }
  function offer(message, label, fn) {
    workspace.hidden = true;
    gate.hidden = false;
    status.textContent = message;
    action.hidden = false;
    action.disabled = false;
    action.textContent = label;
    action.onclick = fn;
  }
  async function billing(operation) {
    action.disabled = manage.disabled = true;
    try {
      const {url} = await request(operation, true);
      const target = new URL(url);
      if (target.protocol !== 'https:' || !['checkout.stripe.com','billing.stripe.com'].includes(target.hostname)) throw Error('Billing link unavailable.');
      window.top.location.href = target.href;
    } catch (error) { offer(error.message, 'Return to parcel access', () => location.reload()); }
    finally { action.disabled = manage.disabled = false; }
  }
  async function open() {
    action.hidden = true;
    status.textContent = 'Opening the parcel map…';
    try {
      let result = await request('open');
      if (result.access === 'sign-in') {
        const credentials = await session.peek();
        paid = true;
        if (credentials?.user?.is_anonymous !== false) {
          offer('Monthly access to the parcel page is $10. Sign in to check your subscription.', 'Sign in', () => window.parent.AustinAccount.open());
          return;
        }
        owner = credentials.user.id;
        result = await request('open', true);
      }
      if (result.access === 'subscribe') {
        offer('Monthly access to the parcel map and City Hall is $10. It renews monthly until canceled.',
          result.hasBilling ? 'Review subscription' : 'Subscribe for $10/month', () => billing('checkout'));
        return;
      }
      if (!['testing','paid'].includes(result.access) || typeof result.script !== 'string' || !result.script) throw Error('The parcel map could not load.');
      document.getElementById('parcel-pricing').textContent = result.access === 'testing'
        ? 'Free during testing · Future access $10/month' : '$10/month · Subscription active';
      manage.hidden = !result.hasBilling;
      manage.onclick = () => billing('manage');
      gate.hidden = true;
      workspace.hidden = false;
      const url = URL.createObjectURL(new Blob([result.script],{type:'text/javascript'}));
      try { await import(url); } finally { URL.revokeObjectURL(url); }
    } catch (error) { offer(error.message, 'Try again', () => location.reload()); }
  }
  session.subscribe((_event, value) => {
    const id = value?.user?.is_anonymous === false ? value.user.id : null;
    if (paid && owner !== id) location.reload();
  });
  open();
})();
