-- Mode changes and fixtures live only inside this rolled-back transaction.
begin;
select set_config('testing.owner',gen_random_uuid()::text,true),set_config('testing.other',gen_random_uuid()::text,true),set_config('testing.guest',gen_random_uuid()::text,true),set_config('testing.space',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 (current_setting('testing.owner')::uuid,'testing-'||current_setting('testing.owner')||'@example.invalid',now(),false),
 (current_setting('testing.other')::uuid,'testing-'||current_setting('testing.other')||'@example.invalid',now(),false),
 (current_setting('testing.guest')::uuid,null,null,true);
select public.access_testing_set(false,false);
set local role anon;
do $$begin
 assert public.access_testing_status()->>'proEnabled'='false';
 assert not has_function_privilege(current_user,'public.access_testing_set(boolean,boolean)','execute');
 assert not has_function_privilege(current_user,'public.access_testing_grant(text,uuid,uuid)','execute');
 assert not has_schema_privilege(current_user,'billing_private','usage');
end $$;
reset role;
set local role service_role;
do $$declare owner uuid:=current_setting('testing.owner')::uuid;id uuid:=current_setting('testing.space')::uuid;fields jsonb:='{"name":"Free testing fixture","description":"","latitude":30.2672,"longitude":-97.7431,"diameter":50}';begin
 begin perform public.access_testing_grant('pro',owner);raise exception 'Disabled grant accepted';exception when sqlstate 'PT409' then null;end;
 perform public.geofence_save_draft(owner,id,fields);
 perform public.access_testing_set(true,true);
 begin perform public.access_testing_grant('pro',current_setting('testing.guest')::uuid);raise exception 'Guest grant accepted';exception when insufficient_privilege then null;end;
 begin perform public.access_testing_grant('geofence',current_setting('testing.other')::uuid,id);raise exception 'Other owner accepted';exception when sqlstate 'PT404' then null;end;
 perform public.access_testing_grant('pro',owner);perform public.access_testing_grant('pro',owner);
 perform public.access_testing_grant('geofence',owner,id);perform public.access_testing_grant('geofence',owner,id);
 assert public.geofence_owner_list(owner,'live')->0->>'temporaryAccess'='true';
 assert public.geofence_owner_list(owner,'test')->0->>'temporaryAccess'='false';
 assert public.geofence_owner_list(owner,'live')->0->>'hasBilling'='false';
 begin perform public.geofence_save_draft(owner,id,fields||'{"diameter":100}'::jsonb);raise exception 'Activated location changed';exception when sqlstate 'PT409' then null;end;
end $$;
reset role;
do $$begin
 assert not exists(select 1 from billing_private.members where owner_id=current_setting('testing.owner')::uuid);
 assert not exists(select 1 from geofence_private.billing where space_id=current_setting('testing.space')::uuid);
 assert (select count(*) from billing_private.testing_members where owner_id=current_setting('testing.owner')::uuid)=1;
 assert (select count(*) from geofence_private.testing_spaces where space_id=current_setting('testing.space')::uuid)=1;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('testing.owner'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$declare r jsonb:=public.membership_read();id uuid:=current_setting('testing.space')::uuid;begin
 assert not has_function_privilege(current_user,'public.access_testing_grant(text,uuid,uuid)','execute');
 assert r->>'plan'='pro' and r->>'temporaryAccess'='true' and r->>'paidThrough' is null and r->>'hasBilling'='false';
 assert public.geofence_read(id)->>'name'='Free testing fixture';
 assert not(public.geofence_read(id)?'owner_id');
 begin perform public.geofence_chat(id,31,-97.7431,5,clock_timestamp(),null,false);raise exception 'Outside accepted';exception when sqlstate 'PT403' then null;end;
 perform public.geofence_chat(id,30.2672,-97.7431,5,clock_timestamp(),'Free circle works',false);
end $$;
reset role;
select public.access_testing_set(false,false);
set local role authenticated;
do $$begin
 assert public.membership_read()->>'plan'='free';assert public.membership_read()->>'temporaryAccess'='false';
 assert public.geofence_read(current_setting('testing.space')::uuid) is null;
 begin perform public.geofence_chat(current_setting('testing.space')::uuid,30.2672,-97.7431,5,clock_timestamp(),null,false);raise exception 'Disabled free circle accepts chat';exception when sqlstate 'PT410' then null;end;
end $$;
reset role;
-- Paid entitlements remain independent of free testing, including after disable.
select public.access_testing_set(true,true);
set local role authenticated;
do $$begin assert public.membership_read()->>'temporaryAccess'='true';assert public.geofence_read(current_setting('testing.space')::uuid) is not null;end $$;
reset role;
select public.access_testing_set(false,false);
insert into billing_private.members(mode,owner_id,status,pro_until) values('live',current_setting('testing.owner')::uuid,'active',now()+interval '1 day');
insert into geofence_private.billing(mode,space_id,status,pro_until) values('live',current_setting('testing.space')::uuid,'active',now()+interval '1 day');
set local role authenticated;
do $$begin assert public.membership_read()->>'plan'='pro';assert public.membership_read()->>'temporaryAccess'='false';assert public.geofence_read(current_setting('testing.space')::uuid) is not null;end $$;
reset role;
rollback;
