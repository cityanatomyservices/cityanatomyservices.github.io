begin;
select set_config('chatqa.owner',gen_random_uuid()::text,true),set_config('chatqa.guest',gen_random_uuid()::text,true),set_config('chatqa.space',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 (current_setting('chatqa.owner')::uuid,'chatqa-owner@example.invalid',now(),false),
 (current_setting('chatqa.guest')::uuid,null,null,true);
insert into public.profiles(id,handle) values(current_setting('chatqa.owner')::uuid,'Profile'||substr(current_setting('chatqa.owner'),1,8)) on conflict(id) do update set handle=excluded.handle;
select public.access_testing_set(true,true);
select public.geofence_save_draft(current_setting('chatqa.owner')::uuid,current_setting('chatqa.space')::uuid,'{"name":"Chat QA","description":"Temporary","latitude":30.2672,"longitude":-97.7431,"diameter":500}');
select public.access_testing_grant('geofence',current_setting('chatqa.owner')::uuid,current_setting('chatqa.space')::uuid);
set local role anon;
do $$begin assert not has_function_privilege(current_user,'public.geofence_chat_v2(uuid,double precision,double precision,double precision,timestamptz,text,boolean,text,boolean)','execute');assert not has_schema_privilege(current_user,'geofence_private','usage');end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('chatqa.guest'),'is_anonymous',true)::text,true);
set local role authenticated;
do $$declare sid uuid:=current_setting('chatqa.space')::uuid;r jsonb;begin
 begin perform public.geofence_chat_v2(sid,30.2672,-97.7431,5,clock_timestamp(),p_use_profile=>true);raise exception 'Guest profile accepted';exception when sqlstate 'PT422' then null;end;
 begin perform public.geofence_chat_v2(sid,30.2672,-97.7431,5,clock_timestamp(),p_name=>'email@example.com');raise exception 'Email nickname accepted';exception when sqlstate 'PT422' then null;end;
 r:=public.geofence_chat_v2(sid,30.2672,-97.7431,5,clock_timestamp(),p_text=>'Hello from a guest',p_name=>'Park Pal');
 assert r->'people'->0->>'name'='Park Pal';assert r->'messages'->0->>'nickname'='Park Pal';
 assert not(r->'messages'->0?'user_id') and not(r->'messages'->0?'latitude');
 perform set_config('chatqa.first',r->>'conversationId',true);
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('chatqa.owner'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.geofence_chat_v2(current_setting('chatqa.space')::uuid,30.2672,-97.7431,5,clock_timestamp(),p_name=>'Forged profile',p_use_profile=>true);
 assert exists(select 1 from jsonb_array_elements(r->'people') p where p->>'name'='Profile'||substr(current_setting('chatqa.owner'),1,8));
 assert not exists(select 1 from jsonb_array_elements(r->'people') p where p->>'name'='Forged profile');
 assert jsonb_array_length(r->'messages')=0,'New arrivals cannot read messages from before they joined';
end $$;
reset role;
update geofence_private.messages set created_at=now()-interval '3 minutes' where space_id=current_setting('chatqa.space')::uuid;
select public.geofence_cleanup();
do $$begin assert exists(select 1 from geofence_private.messages where space_id=current_setting('chatqa.space')::uuid),'An ongoing chat must not lose messages after two minutes';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('chatqa.guest'),'is_anonymous',true)::text,true);
select public.geofence_chat(current_setting('chatqa.space')::uuid,p_leave=>true);
do $$begin assert (select ended_at is null from geofence_private.conversations where id=current_setting('chatqa.first')::uuid),'Chat remains open while a participant remains';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('chatqa.owner'),'is_anonymous',false)::text,true);
select public.geofence_chat(current_setting('chatqa.space')::uuid,p_leave=>true);
do $$begin assert (select ended_at is not null from geofence_private.conversations where id=current_setting('chatqa.first')::uuid);end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('chatqa.guest'),'is_anonymous',true)::text,true);
do $$declare r jsonb;begin
 r:=public.geofence_chat_v2(current_setting('chatqa.space')::uuid,30.2672,-97.7431,5,clock_timestamp(),p_name=>'New visit');
 assert r->>'conversationId'<>current_setting('chatqa.first');assert jsonb_array_length(r->'messages')=0;
end $$;
update geofence_private.conversations set ended_at=clock_timestamp()-interval '23 hours 49 minutes' where id=current_setting('chatqa.first')::uuid;
select public.geofence_cleanup();
do $$begin assert exists(select 1 from geofence_private.messages where conversation_id=current_setting('chatqa.first')::uuid);end $$;
update geofence_private.conversations set ended_at=clock_timestamp()-interval '23 hours 51 minutes' where id=current_setting('chatqa.first')::uuid;
select public.geofence_cleanup();
do $$begin assert not exists(select 1 from geofence_private.messages where conversation_id=current_setting('chatqa.first')::uuid);assert not exists(select 1 from geofence_private.conversations where id=current_setting('chatqa.first')::uuid);end $$;
update geofence_private.people set expires_at=clock_timestamp()-interval '1 second' where space_id=current_setting('chatqa.space')::uuid;
select public.geofence_cleanup();
do $$begin assert not exists(select 1 from geofence_private.conversations where space_id=current_setting('chatqa.space')::uuid and ended_at is null),'Expired last visitor ends the chat';end $$;
rollback;
