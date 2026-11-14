import test from 'node:test';
import assert from 'node:assert/strict';
import {invitationEmails} from '../../geofences/invitations.mjs';
import {handler} from '../../supabase/functions/geofences/handler.mjs';
import {message} from '../../supabase/functions/_shared/geofence-email.mjs';
const id='68d071c2-ac2d-449b-ac02-0caf2e17efcd';
test('invitation recipients are bounded, normalized and deduplicated',()=>{
 assert.deepEqual(invitationEmails([' Friend@example.com ','friend@EXAMPLE.com','other@example.com']),['friend@example.com','other@example.com']);
 for(const emails of [[],[''],['bad'],['a@example.com\r\nBcc: b@example.com'],[null],Array(26).fill('a@example.com')])assert.throws(()=>invitationEmails(emails));
});
test('draft and invitations save atomically using the authenticated owner; invalid or unavailable email cannot save',async()=>{
 const calls=[],api={mode:'live',user:async()=>({id:'owner'}),emailReady:()=>true,rpc:async(n,b)=>{calls.push({n,b});return {};}};
 const save=invitations=>handler(api)(new Request('https://x',{method:'POST',headers:{Origin:'https://austin.chat'},body:JSON.stringify({action:'save',id,fields:{name:'Picnic',description:'Join us',latitude:30,longitude:-97,diameter:500},invitations})}));
 assert.equal((await save(['bad'])).status,422);assert.equal(calls.length,0);
 assert.equal((await save([' Friend@example.com ','friend@example.com'])).status,200);
 assert.equal(calls[0].n,'geofence_save_with_invitations');assert.equal(calls[0].b.p_owner,'owner');assert.deepEqual(calls[0].b.p_emails,['friend@example.com']);
 api.emailReady=()=>false;assert.equal((await save(['a@example.com'])).status,503);assert.equal(calls.length,1);
});
test('invitation includes joining instructions and QR without owner notification tokens or recipients',async()=>{
 const mail=await message({kind:'invitation'},{id,name:'<script>Picnic</script>',description:'Meet <here>',email:'guest@example.com',stopToken:'private-stop',verifyToken:'private-verify'},async()=> 'png');
 assert.match(mail.subject,/invited/);assert.match(mail.text,/inside the circle/);assert.match(mail.text,/one-time invitation/);
 assert.match(mail.html,/&lt;script&gt;/);assert.doesNotMatch(mail.html,/<script>|private-stop|private-verify|guest@example.com/);assert.equal(mail.attachments[0].content_id,'geofence-qr');
});
