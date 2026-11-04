import Stripe from 'npm:stripe@23.1.0';
import {runtime} from '../_shared/billing-runtime.mjs';
import {handler} from './handler.mjs';
Deno.serve(handler(runtime(name=>Deno.env.get(name),Stripe)));
