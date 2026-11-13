import {runtime} from '../_shared/geofence-mail-runtime.mjs';
import {handler} from './handler.mjs';
Deno.serve(handler(runtime(name=>Deno.env.get(name))));
