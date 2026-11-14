import {austinInstant,localTime,validateSchedule} from './schedule.mjs?v=20261114e';
export function scheduleEditor(host,{starts_at=null,ends_at=null}={},onChange=()=>{}){
 const label=document.createElement('label'),mode=document.createElement('select');label.textContent='Chat availability';mode.name='schedule_mode';
 for(const [value,text] of [['always','Anytime while activated'],['scheduled','Choose a start and end time']]){const o=document.createElement('option');o.value=value;o.textContent=text;mode.append(o);}label.append(mode);
 const times=document.createElement('div'),inputs=[];
 for(const [name,text,value] of [['starts_at','Starts (Austin time)',starts_at],['ends_at','Ends (Austin time)',ends_at]]){const l=document.createElement('label'),i=document.createElement('input');l.textContent=text;i.type='datetime-local';i.name=name;i.value=localTime(value);i.min='2020-01-01T00:00';i.max='2099-12-31T23:59';l.append(i);times.append(l);inputs.push(i);}
 const note=document.createElement('small');note.textContent='All times use Austin’s time zone. During the fall clock change, a repeated time means its first occurrence. Scheduling does not change billing.';
 const error=document.createElement('p');error.setAttribute('role','status');
 mode.value=starts_at?'scheduled':'always';host.append(label,times,note,error);
 function read(){return mode.value==='always'?{starts_at:null,ends_at:null}:validateSchedule({starts_at:austinInstant(inputs[0].value),ends_at:austinInstant(inputs[1].value)});}
 function update(){times.hidden=mode.value!=='scheduled';inputs.forEach(i=>{i.required=!times.hidden;i.disabled=times.hidden;});error.textContent='';try{read();}catch(e){error.textContent=e.message;}onChange();}
 mode.onchange=update;inputs.forEach(i=>i.addEventListener('input',update));update();
 return {read,reset(){mode.value='always';inputs.forEach(i=>i.value='');update();}};
}
