-- All fixtures and settings changes roll back; nothing can be delivered.
begin;
select set_config('mail.owner',gen_random_uuid()::text,true),set_config('mail.other',gen_random_uuid()::text,true),set_config('mail.space',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values(current_setting('mail.owner')::uuid,'owner-'||current_setting('mail.owner')||'@example.invalid',now(),false),(current_setting('mail.other')::uuid,'other-'||current_setting('mail.other')||'@example.invalid',now(),false);
select public.access_testing_set(true,true);
set local role anon;
do $$begin assert not has_function_privilege(current_user,'public.geofence_email_save(uuid,uuid,boolean,text)','execute');assert not has_function_privilege(current_user,'public.geofence_mail_claim()','execute');assert not has_schema_privilege(current_user,'geofence_private','usage');end $$;
reset role;
set local role service_role;
do $$declare owner uuid:=current_setting('mail.owner')::uuid;id uuid:=current_setting('mail.space')::uuid;r jsonb;begin
 perform public.geofence_save_draft(owner,id,'{"name":"Email fixture","description":"Private owner details never go to the public page","latitude":30.2672,"longitude":-97.7431,"diameter":50}');
 begin perform public.geofence_email_save(current_setting('mail.other')::uuid,id,true,'someone@example.invalid');raise exception 'Other owner accepted';exception when sqlstate 'PT404' then null;end;
 r:=public.geofence_email_save(owner,id,true,'owner-'||owner||'@example.invalid');assert r->>'verified'='true';
 perform public.access_testing_grant('geofence',owner,id);perform public.access_testing_grant('geofence',owner,id);
end $$;
reset role;
do $$begin assert (select count(*) from geofence_private.email_jobs where space_id=current_setting('mail.space')::uuid and kind='welcome')=1;end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mail.other'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$begin assert not public.geofence_is_owner(current_setting('mail.space')::uuid);perform public.geofence_chat(current_setting('mail.space')::uuid,30.2672,-97.7431,5,clock_timestamp());perform public.geofence_chat(current_setting('mail.space')::uuid,30.2672,-97.7431,5,clock_timestamp());perform public.geofence_chat(current_setting('mail.space')::uuid,p_leave=>true);end $$;
reset role;
do $$declare j geofence_private.email_jobs;begin
 select * into j from geofence_private.email_jobs where space_id=current_setting('mail.space')::uuid and kind='activity';assert jsonb_array_length(j.events)=2;assert j.events->0->>'kind'='enter';assert j.events->1->>'kind'='leave';
 assert not (public.geofence_read(current_setting('mail.space')::uuid)?'email');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mail.owner'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$begin assert public.geofence_is_owner(current_setting('mail.space')::uuid);end $$;
reset role;
-- Owner changes to another email: no alerts until verification; repeat save dedupes.
select public.geofence_email_save(current_setting('mail.owner')::uuid,current_setting('mail.space')::uuid,true,'alternate@example.invalid');
select public.geofence_email_save(current_setting('mail.owner')::uuid,current_setting('mail.space')::uuid,true,'alternate@example.invalid');
do $$declare e geofence_private.email_settings;j geofence_private.email_jobs;begin
 select * into e from geofence_private.email_settings where space_id=current_setting('mail.space')::uuid;assert not e.verified;
 assert (select count(*) from geofence_private.email_jobs where space_id=e.space_id and kind='verify')=1;
 perform public.geofence_email_token(e.verify_token,'verify');assert (select verified from geofence_private.email_settings where space_id=e.space_id);
 perform public.geofence_email_token(e.stop_token,'stop');assert not (select enabled from geofence_private.email_settings where space_id=e.space_id);
 begin perform public.geofence_email_token(gen_random_uuid(),'verify');raise exception 'Invalid token accepted';exception when sqlstate 'PT404' then null;end;
 select * into j from geofence_private.email_jobs where space_id=e.space_id and kind='welcome';
 update geofence_private.email_jobs set state='processing',lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes' where id=j.id returning * into j;
 assert not public.geofence_mail_update(j.id,gen_random_uuid(),'sent');
 assert public.geofence_mail_context(j.id,j.lease_id)->>'email'='owner-'||current_setting('mail.owner')||'@example.invalid';
 assert public.geofence_mail_update(j.id,j.lease_id,p_payload=>'{"to":["fixture"]}');
 assert not public.geofence_mail_update(j.id,j.lease_id,p_payload=>'{"to":["changed"]}');
 assert public.geofence_mail_update(j.id,j.lease_id,'sent',p_provider=>'fixture');
 assert public.geofence_mail_context(j.id,j.lease_id) is null;
end $$;
-- Test-mode payments cannot queue welcome email; live renewals cannot duplicate it.
do $$declare sid uuid:=gen_random_uuid();begin
 perform public.geofence_save_draft(current_setting('mail.owner')::uuid,sid,'{"name":"Paid email fixture","description":"","latitude":30.2672,"longitude":-97.7431,"diameter":50}');
 insert into geofence_private.billing(mode,space_id,status,pro_until) values('test',sid,'active',now()+interval '1 day');
 assert not exists(select 1 from geofence_private.email_jobs where space_id=sid);
 insert into geofence_private.billing(mode,space_id,status,pro_until) values('live',sid,'active',now()+interval '1 day');
 update geofence_private.billing set pro_until=now()+interval '2 days' where mode='live' and space_id=sid;
 assert (select count(*) from geofence_private.email_jobs where space_id=sid and kind='welcome')=1;
end $$;
rollback;
