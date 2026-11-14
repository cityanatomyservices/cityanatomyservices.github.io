import {invitationEmails,MAX_INVITATIONS,validEmail} from './invitations.mjs?v=20261114c';

export function guidedForm({form,hasLocation,onChange}){
 const $=id=>document.getElementById(id),field=name=>form.elements.namedItem(name);
 let sizeChosen=false,sequence=0,ready=false;
 const inputs=()=>[...$('geo-invite-fields').querySelectorAll('input')];
 function emails(){return invitationEmails(inputs().map(input=>input.value.trim()).filter(Boolean));}
 function changed(){onChange();}
 function addEmail(){
  const row=document.createElement('div');row.className='geo-invite-row';
  const label=document.createElement('label'),input=document.createElement('input'),remove=document.createElement('button');
  input.type='email';input.name='invitation';input.maxLength=254;input.autocomplete='email';input.placeholder='friend@example.com';input.id='geo-invitation-'+(++sequence);
  const caption=document.createElement('span');caption.className='geo-field-label';caption.textContent='Invitation email address';label.append(caption,input);
  remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove invitation email address');
  remove.onclick=()=>{row.remove();if(!inputs().length||inputs().every(i=>i.value.trim())&&inputs().length<MAX_INVITATIONS)addEmail();changed();inputs().at(-1).focus();};
  input.addEventListener('input',()=>{if(input.checkValidity()&&validEmail(input.value.trim())&&inputs().at(-1)===input&&inputs().length<MAX_INVITATIONS)addEmail();});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(!input.value.trim()||!input.reportValidity())return;const next=inputs()[inputs().indexOf(input)+1];if(next)next.focus();else $('geo-preview').focus();}});
  row.append(label,remove);$('geo-invite-fields').append(row);
 }
 function update({busy,preview,emailReady}){
  const name=field('name').value.trim(),description=field('description').value.trim();
  const named=name.length>0&&name.length<=80,described=named&&description.length>0&&description.length<=400;
  const located=described&&hasLocation(),diameter=Number(field('diameter').value),sized=located&&Number.isInteger(diameter)&&diameter>=10&&diameter<=500;
  let invited=[];try{invited=emails();}catch{}
  const inviting=sized&&sizeChosen;
  ready=inviting&&invited.length>0&&inputs().every(i=>!i.value.trim()||i.checkValidity());
  const visible=[true,named,described,located,inviting];
  ['name','description','location','size','invite'].forEach((name,i)=>{const step=$('geo-step-'+name);step.hidden=!visible[i];step.disabled=busy||!visible[i];step.dataset.complete=String([named,described,located,sized&&sizeChosen,ready][i]);});
  $('geo-size-next').hidden=sizeChosen&&sized;$('geo-size-next').disabled=!sized||busy;
  const step=ready?6:visible.lastIndexOf(true)+1;
  $('geo-progress').textContent=step===6?'Ready to review your geofence':'Step '+step+' of 5';
  $('geo-progress-bar').value=ready?5:step-1;
  $('geo-invite-summary').textContent=invited.length?invited.length+' '+(invited.length===1?'person':'people')+' will receive an invitation after creation.':'Add at least one person to continue.';
  $('geo-email-availability').hidden=emailReady;
  $('geo-preview').hidden=!ready;$('geo-preview').disabled=busy||!ready;
  $('geo-review').hidden=!preview||!ready;
  $('geo-review-emails').textContent=invited.join(', ');
  inputs().forEach(input=>input.closest('.geo-invite-row').querySelector('button').hidden=!input.value.trim());
  return ready;
 }
 field('diameter').addEventListener('input',()=>{sizeChosen=true;});
 $('geo-size-next').onclick=()=>{sizeChosen=true;changed();inputs()[0]?.focus();};
 function reset(){sizeChosen=false;ready=false;$('geo-invite-fields').replaceChildren();addEmail();}
 reset();return {update,reset,emails,get ready(){return ready;}};
}
