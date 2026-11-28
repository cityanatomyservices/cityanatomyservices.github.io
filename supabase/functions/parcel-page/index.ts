import {bundle} from './bundle.mjs';
import Stripe from 'npm:stripe@23.1.0';
import {runtime} from '../_shared/billing-runtime.mjs';
import {handler} from './handler.mjs';

const env = (name: string) => Deno.env.get(name);
const mode = env('PARCEL_STRIPE_MODE') || 'test';
const prefix = 'PARCEL_STRIPE_' + mode.toUpperCase() + '_';
const product = {id:'parcels', mode, path:'/what-can-i-build-here/', amount:1000,
  price:env(prefix+'PRICE'), portal:env(prefix+'PORTAL')};
const api = runtime(env,Stripe,fetch,product);
Deno.serve(handler({accessMode:env('PARCEL_PAGE_ACCESS'), api, bundle}));
