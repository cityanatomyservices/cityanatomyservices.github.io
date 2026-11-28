import {ORIGIN, problem} from '../_shared/billing.mjs';

export function handler({accessMode, api, bundle}) {
  return async request => {
    const origin = request.headers.get('Origin') || ORIGIN;
    const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const allowed = origin === ORIGIN || (local && accessMode === 'testing');
    const headers = {'Content-Type':'application/json', 'Cache-Control':'private, no-store',
      'Access-Control-Allow-Origin':allowed ? origin : ORIGIN, 'Vary':'Origin, Authorization',
      'Access-Control-Allow-Headers':'authorization, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS'};
    const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers});
    if (!allowed) return json({error:'Origin unavailable.'},403);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (request.method !== 'POST') return json({error:'Use POST.'},405);
    try {
      const {action} = await request.json().catch(() => ({})) || {};
      if (!['open','checkout','manage'].includes(action)) return json({error:'Unknown action.'},400);
      if (accessMode === 'testing') {
        if (action !== 'open') return json({error:'The parcel page is free during testing.'},409);
        return json({access:'testing', script:await bundle()});
      }
      if (accessMode !== 'paid' || !api.ready() || !api.service) throw problem(503,'Parcel access is being set up.');
      if (!request.headers.has('Authorization') && action === 'open') return json({access:'sign-in'});
      const user = await api.user(request);
      if (!api.allowed(user)) throw problem(403,'Parcel subscription testing is limited to designated accounts.');
      if (action === 'manage') return json(await api.service.manage(user));
      if (action === 'checkout') return json(await api.service.checkout(user));
      const state = await api.service.status(user);
      if (state.plan !== 'pro') return json({access:'subscribe', hasBilling:state.hasBilling});
      return json({access:'paid',script:await bundle(), hasBilling:state.hasBilling});
    } catch (error) {
      return json({error:error.publicMessage || 'Parcel access could not load. Please try again.'},error.publicMessage ? error.status : 503);
    }
  };
}
