export async function call(action,values={}){
 const S=window.AustinSession;await S.peek();if(!S.registered)throw Error('Sign in to manage your geofences.');const owner=S.user.id;
 const {data,error}=await S.client().functions.invoke('geofences',{body:{action,...values}});
 if(!S.registered||S.user.id!==owner)throw Error('Your account changed. Please try again.');
 if(error){let detail;try{detail=await error.context?.clone().json();}catch{}throw Error(detail?.error||'Could not connect. Please try again.');}return data;
}
export function redirectBilling(url){const parsed=new URL(url);if(!['https://checkout.stripe.com','https://billing.stripe.com'].includes(parsed.origin))throw Error('Unexpected payment address.');window.location.assign(parsed.href);}
