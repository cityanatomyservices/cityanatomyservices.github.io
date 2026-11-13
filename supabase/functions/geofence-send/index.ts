import QRCode from 'npm:qrcode@1.5.4';
import {runtime} from '../_shared/geofence-mail-runtime.mjs';
import {handler} from './handler.mjs';
const api=runtime(name=>Deno.env.get(name));
Deno.serve(handler({...api,qrPNG:async url=>(await QRCode.toDataURL(url,{type:'image/png',width:280,margin:4,errorCorrectionLevel:'M'})).split(',')[1],pause:ms=>new Promise(resolve=>setTimeout(resolve,ms))}));
