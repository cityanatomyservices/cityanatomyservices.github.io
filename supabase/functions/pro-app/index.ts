import {runtime} from './runtime.mjs';
import {handler} from './handler.mjs';
Deno.serve(handler(runtime(name=>Deno.env.get(name))));
