import {pageURL} from './model.mjs?v=20261109h';
export function qr(id){const code=window.qrcode(0,'M');code.addData(pageURL(id));code.make();return code.createSvgTag({cellSize:6,margin:24,scalable:true});}
export function downloadQR(id){const url=URL.createObjectURL(new Blob([qr(id)],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download='chat-geofence-'+id+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function copyLink(id){await navigator.clipboard.writeText(pageURL(id));}
