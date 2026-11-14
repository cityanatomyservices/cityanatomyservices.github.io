import test from 'node:test';import assert from 'node:assert/strict';
import {chatTranscript} from '../../geofences/chat-export.mjs';
test('chat export is a readable plain-text copy with names and timestamps, without device locations or account IDs',()=>{
 const text=chatTranscript('Park chat',[{id:1,nickname:'Anonymous Pal',body:'Hello\nMeet at the picnic table.',created_at:'2026-11-14T14:00:00Z',user_id:'private-user',latitude:30.26}]);
 assert.match(text,/Park chat/);assert.match(text,/2026-11-14T14:00:00.000Z.*Anonymous Pal/);assert.match(text,/Hello\nMeet at the picnic table/);assert.doesNotMatch(text,/private-user|30.26/);
});
