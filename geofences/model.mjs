export const MIN_DIAMETER=10,MAX_DIAMETER=100,MAX_FIX_AGE=45000;
export const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
export function validate(input){
  const name=String(input?.name||'').trim(),description=String(input?.description||'').trim();
  const {latitude,longitude,diameter}=input||{};
  if(!name||name.length>80)throw Error('Enter a name of 1–80 characters.');
  if(description.length>400)throw Error('Keep the description to 400 characters.');
  if(!Number.isFinite(latitude)||Math.abs(latitude)>85||!Number.isFinite(longitude)||Math.abs(longitude)>180)throw Error('Enter a latitude from −85 to 85 and longitude from −180 to 180.');
  if(!Number.isInteger(diameter)||diameter<MIN_DIAMETER||diameter>MAX_DIAMETER)throw Error('Choose a whole-number diameter from 10 to 100 meters.');
  return {name,description,latitude,longitude,diameter};
}
export function distance(a,b){const r=Math.PI/180,dlat=(b[1]-a[1])*r,dlng=(b[0]-a[0])*r,h=Math.sin(dlat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dlng/2)**2;return 12742000*Math.asin(Math.sqrt(Math.min(1,h)));}
export function circle({latitude,longitude,diameter}){
  const points=[],r=Math.PI/180,lat=latitude*r,lng=longitude*r,d=diameter/2/6371000;
  for(let i=0;i<=96;i++){const bearing=2*Math.PI*(i%96)/96,l=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(bearing));let x=(lng+Math.atan2(Math.sin(bearing)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(l)))/r;x=longitude+((x-longitude+540)%360-180);points.push([x,l/r]);}
  return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[points]}};
}
export function fixStatus(fence,fix,now=Date.now()){
  if(!fix||!Number.isFinite(fix.timestamp)||now-fix.timestamp>MAX_FIX_AGE||fix.timestamp>now+5000)return 'Waiting for a fresh GPS location…';
  if(!Number.isFinite(fix.accuracy)||fix.accuracy<0||fix.accuracy>Math.min(50,fence.diameter/2))return 'GPS is not precise enough yet. Try moving outdoors.';
  if(!Number.isFinite(fix.latitude)||!Number.isFinite(fix.longitude)||distance([fence.longitude,fence.latitude],[fix.longitude,fix.latitude])>fence.diameter/2)return 'You are outside this chat circle.';
  return '';
}
export const pageURL=id=>{if(!validId(id))throw Error('Invalid geofence.');return 'https://austin.chat/geofences/?id='+id;};
