-- All invitations and activation fixtures roll back before any delivery can run.
begin;
select set_config('invite.owner',gen_random_uuid()::text,true),set_config('invite.other',gen_random_uuid()::text,true),set_config('invite.space',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 (current_setting('invite.owner')::uuid,'invite-owner@example.invalid',now(),false),
 (current_setting('invite.other')::uuid,'invite-other@example.invalid',now(),false);
select public.access_testing_set(true,true);
set local role anon;
do $$begin
 assert not has_schema_privilege(current_user,'geofence_private','usage');
 assert not has_function_privilege(current_user,'public.geofence_save_with_invitations(uuid,uuid,jsonb,text[])','execute');
 assert not has_function_privilege(current_user,'public.geofence_invitation_list(uuid)','execute');
end $$;
reset role;
set local role service_role;
do $$declare owner uuid:=current_setting('invite.owner')::uuid;sid uuid:=current_setting('invite.space')::uuid;f jsonb:='{"name":"Invite fixture","description":"Join this chat","latitude":30.2672,"longitude":-97.7431,"diameter":500}';begin
 begin perform public.geofence_save_with_invitations(owner,sid,f,array['bad']);raise exception 'Invalid recipient accepted';exception when sqlstate 'PT422' then null;end;
 assert jsonb_array_length(public.geofence_owner_list(owner,'live'))=0,'Invalid recipients must not leave a draft';
 perform public.geofence_save_with_invitations(owner,sid,f,array[' Guest@example.invalid ','guest@example.invalid','remove@example.invalid']);
 assert public.geofence_invitation_list(owner)->sid::text->>'total'='2';
 begin perform public.geofence_save_with_invitations(current_setting('invite.other')::uuid,sid,f,array['foreign@example.invalid']);raise exception 'Wrong owner accepted';exception when sqlstate 'PT404' then null;end;
 assert public.geofence_invitation_list(current_setting('invite.other')::uuid)='{}';
 perform public.geofence_save_with_invitations(owner,sid,f,array['guest@example.invalid','second@example.invalid']);
end $$;
reset role;
do $$declare sid uuid:=current_setting('invite.space')::uuid;begin
 assert not exists(select 1 from geofence_private.email_jobs where space_id=sid),'Draft cannot send an invitation';
 assert not exists(select 1 from geofence_private.invitations where space_id=sid and email='remove@example.invalid');
end $$;
set local role service_role;
do $$begin
 perform public.access_testing_grant('geofence',current_setting('invite.owner')::uuid,current_setting('invite.space')::uuid);
 perform public.access_testing_grant('geofence',current_setting('invite.owner')::uuid,current_setting('invite.space')::uuid);
end $$;
reset role;
do $$declare sid uuid:=current_setting('invite.space')::uuid;j geofence_private.email_jobs;ctx jsonb;begin
 assert (select count(*) from geofence_private.email_jobs where space_id=sid and kind='invitation')=2,'Repeated activation must not resend';
 assert (select count(*) from geofence_private.email_jobs where space_id=sid and kind='welcome')=1;
 assert not(public.geofence_read(sid)?'email') and not(public.geofence_read(sid)?'invitations');
 update geofence_private.email_jobs set state='processing',lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes' where space_id=sid and recipient='guest@example.invalid' returning * into j;
 assert public.geofence_mail_context(j.id,gen_random_uuid()) is null;
 ctx:=public.geofence_mail_context(j.id,j.lease_id);assert ctx->>'email'='guest@example.invalid';assert not(ctx?'stopToken') and not(ctx?'verifyToken');
 assert public.geofence_mail_update(j.id,j.lease_id,p_state=>'sent',p_provider=>'fixture');
 assert public.geofence_invitation_list(current_setting('invite.owner')::uuid)->sid::text->>'sent'='1';
 delete from geofence_private.email_jobs where id=j.id;
 perform geofence_private.queue_welcome(sid);
 assert (select count(*) from geofence_private.email_jobs where space_id=sid and kind='invitation')=1,'Purged delivery must not resend';
 assert public.geofence_invitation_list(current_setting('invite.owner')::uuid)->sid::text->>'sent'='1';
end $$;
-- Sandbox payments never send invitations; only a real live activation may queue.
do $$declare sid uuid:=gen_random_uuid();owner uuid:=current_setting('invite.owner')::uuid;begin
 perform public.geofence_save_with_invitations(owner,sid,'{"name":"Paid invite fixture","description":"","latitude":30,"longitude":-97,"diameter":50}',array['paid@example.invalid']);
 insert into geofence_private.billing(mode,space_id,status,pro_until) values('test',sid,'active',now()+interval '1 day');
 assert not exists(select 1 from geofence_private.email_jobs where space_id=sid);
 insert into geofence_private.billing(mode,space_id,status,pro_until) values('live',sid,'active',now()+interval '1 day');
 update geofence_private.billing set pro_until=now()+interval '2 days' where space_id=sid and mode='live';
 assert (select count(*) from geofence_private.email_jobs where space_id=sid and kind='invitation')=1;
 update geofence_private.email_jobs set state='processing',lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes' where space_id=sid and kind='invitation';
 update geofence_private.billing set pro_until=now()-interval '1 second' where space_id=sid and mode='live';
 assert (select public.geofence_mail_context(id,lease_id) is null from geofence_private.email_jobs where space_id=sid and kind='invitation'),'Expired circle cannot send';
end $$;
rollback;
