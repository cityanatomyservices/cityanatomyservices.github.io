export function runtime(env,fetcher=fetch){
 const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
 const rpc=async(name,body)=>{
  const response=await fetcher(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok){let value;try{value=await response.json();}catch{}const error=new Error('Email settings are temporarily unavailable.');if(/^PT(404|422|429)$/.test(value?.code)){error.status=Number(value.code.slice(2));error.message=value.message;}throw error;}
  return response.status===204?null:response.json();
 };
 return {env,fetcher,rpc,ready:()=>env('GEOFENCE_EMAIL_ENABLED')==='true'&&!!env('RESEND_API_KEY')&&!!env('REMINDER_FROM')};
}
