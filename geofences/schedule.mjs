export const ZONE='America/Chicago';
const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function localTime(value){if(!value)return '';const p=Object.fromEntries(parts.formatToParts(new Date(value)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
export function austinInstant(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value||''))throw Error('Enter both a start and an end date and time.');
 const wall=Date.parse(value+'Z');
 const times=[5,6].map(h=>wall+h*3600000).filter(t=>Number.isFinite(t)&&localTime(t)===value);
 if(!times.length)throw Error('That Austin time does not exist. Choose a valid date and time outside the daylight-saving jump.');
 return new Date(times[0]).toISOString();
}
export function validateSchedule(input={}){
 if(input.starts_at===undefined&&input.ends_at===undefined)return {};
 if(input.starts_at===null&&input.ends_at===null)return {starts_at:null,ends_at:null};
 const values=[input.starts_at,input.ends_at];
 if(values.some(v=>typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v))))throw Error('Enter both a start and an end date and time.');
 if(Date.parse(values[1])<=Date.parse(values[0]))throw Error('The end time must be after the start time.');
 return {starts_at:new Date(values[0]).toISOString(),ends_at:new Date(values[1]).toISOString()};
}
export function scheduleLabel(start,end){
 if(!start&&!end)return 'Available anytime while this geofence is activated.';
 const fmt=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,dateStyle:'medium',timeStyle:'short'});
 return fmt.format(new Date(start))+' – '+fmt.format(new Date(end))+' (Austin time)';
}
