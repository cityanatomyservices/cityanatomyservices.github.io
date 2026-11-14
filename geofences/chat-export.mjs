export function chatTranscript(title,messages){
 const lines=['Austin.chat — '+title,'Messages received during this visit.','Exported '+new Date().toISOString(),''];
 for(const message of messages)lines.push('['+new Date(message.created_at).toISOString()+'] '+message.nickname, String(message.body),'');
 return lines.join('\r\n');
}
export function downloadChat(id,title,messages){
 const url=URL.createObjectURL(new Blob([chatTranscript(title,messages)],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');
 link.href=url;link.download='geofence-chat-'+id+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
