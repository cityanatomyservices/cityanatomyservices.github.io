import test from 'node:test';import assert from 'node:assert/strict';
import {austinInstant,localTime,validateSchedule,scheduleLabel} from '../../geofences/schedule.mjs';
import {handler} from '../../supabase/functions/geofences/handler.mjs';
import {message} from '../../supabase/functions/_shared/geofence-email.mjs';
test('Austin scheduling is independent of device time zone and rejects DST gaps and reversed windows',()=>{
 assert.equal(austinInstant('2026-11-14T12:00'),'2026-11-14T18:00:00.000Z');assert.equal(austinInstant('2027-07-01T12:00'),'2027-07-01T17:00:00.000Z');
 assert.throws(()=>austinInstant('2027-03-14T02:30'),/does not exist/);assert.throws(()=>austinInstant('2027-02-30T10:00'),/does not exist/);
 assert.equal(austinInstant('2026-11-01T01:30'),'2026-11-01T06:30:00.000Z');assert.equal(localTime('2026-11-14T18:00:00Z'),'2026-11-14T12:00');
 assert.deepEqual(validateSchedule({}),{});assert.deepEqual(validateSchedule({starts_at:null,ends_at:null}),{starts_at:null,ends_at:null});
 assert.deepEqual(validateSchedule({starts_at:'2026-11-14T18:00:00.123456+00:00',ends_at:'2026-11-14T19:00:00.123456+00:00'}),{starts_at:'2026-11-14T18:00:00.123Z',ends_at:'2026-11-14T19:00:00.123Z'});
 for(const input of [{starts_at:null},{starts_at:'infinity',ends_at:'infinity'},{starts_at:'2026-11-14T18:00:00Z',ends_at:'2026-11-14T17:00:00Z'}])assert.throws(()=>validateSchedule(input));
 assert.match(scheduleLabel('2026-11-14T18:00:00Z','2026-11-14T20:00:00Z'),/Austin time/);
});
test('schedule edits use the authenticated owner and draft schedule data stays atomic with invitations',async()=>{
 const calls=[],api={user:async()=>({id:'owner'}),mode:'live',emailReady:()=>true,rpc:async(name,args)=>{calls.push({name,args});return {};}};
 const run=body=>handler(api)(new Request('https://example.invalid',{method:'POST',body:JSON.stringify(body)}));
 const id='f1111111-1111-4111-8111-111111111111',schedule={starts_at:'2027-01-01T18:00:00Z',ends_at:'2027-01-01T20:00:00Z'};
 assert.equal((await run({action:'schedule',id,...schedule})).status,200);assert.equal(calls[0].name,'geofence_schedule_set');assert.equal(calls[0].args.p_owner,'owner');
 assert.equal((await run({action:'schedule',id,owner:'forged',...schedule})).status,400);assert.equal((await run({action:'schedule',id,starts_at:null})).status,422);
 assert.equal((await run({action:'save',id,fields:{name:'Scheduled',description:'A test',latitude:30.2,longitude:-97.7,diameter:100,...schedule},invitations:['guest@example.invalid']})).status,200);
 assert.equal(calls.at(-1).name,'geofence_save_with_invitations');assert.equal(calls.at(-1).args.p_fields.ends_at,'2027-01-01T20:00:00.000Z');
});
test('invitations include the scheduled Austin-time window',async()=>{
 const mail=await message({kind:'invitation'},{id:'f1111111-1111-4111-8111-111111111111',name:'Meetup',startsAt:'2027-01-01T18:00:00Z',endsAt:'2027-01-01T20:00:00Z'},async()=> 'png');
 assert.match(mail.text,/Austin time/);assert.match(mail.text,/12:00/);assert.match(mail.html,/2:00/);
});
