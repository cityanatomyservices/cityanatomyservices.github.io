import {bundle} from './bundle.mjs';
import Stripe from 'npm:stripe@23.1.0';
import {runtime} from '../_shared/billing-runtime.mjs';
import {handler} from './handler.mjs';

const env = (name: string) => Deno.env.get(name);
const prefix = 'PARCEL_STRIPE_' + (env('BILLING_MODE') || 'test').toUpperCase() + '_';
const product = {id:'parcels', path:'/what-can-i-build-here/', amount:1000,
  price:env(prefix+'PRICE'), portal:env(prefix+'PORTAL')};
const api = runtime(env,Stripe,fetch,product);
Deno.serve(handler({accessMode:env('PARCEL_PAGE_ACCESS'), api, bundle}));
