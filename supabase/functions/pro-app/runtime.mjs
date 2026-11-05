const issue=(status,message)=>Object.assign(new Error(message),{status,publicMessage:message});
export function runtime(env,fetcher=fetch){
  const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY'),release=env('PRO_APPS_RELEASE');
  let manifest;
  async function storage(path){
    const response=await fetcher(base+'/storage/v1/object/authenticated/pro-apps/'+release+'/'+path,
      {headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Private app storage unavailable');return response;
  }
  return {
    async authorize(req){
      const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if(!token)throw issue(401,'Sign in to use Pro apps.');
      const response=await fetcher(base+'/rest/v1/rpc/membership_read',{method:'POST',
        headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
      if(!response.ok){if(response.status===401||response.status===403)throw issue(401,'Sign in with a confirmed account to use Pro apps.');throw new Error('Membership unavailable');}
      const membership=await response.json();
      if(membership.plan!=='pro'||!(Date.parse(membership.paidThrough)>Date.now()))throw issue(403,'Pro membership is required for this app.');
    },
    async asset(path){
      if(!release||!/^[a-f0-9]{64}$/.test(release))throw new Error('Private app release missing');
      if(!manifest){const value=await(await storage('manifest.json')).json();if(value.release!==release)throw new Error('Wrong app release');manifest=value;}
      const entry=manifest.files[path];if(!entry)return null;
      const response=await storage(path.slice(1));return {body:response.body,mime:entry.mime};
    }
  };
}
