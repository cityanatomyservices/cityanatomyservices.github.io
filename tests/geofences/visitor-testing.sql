-- Disposable identities and mail jobs are visible only in this transaction.
begin;
select set_config('qa.owner',gen_random_uuid()::text,true),set_config('qa.other',gen_random_uuid()::text,true),set_config('qa.circle',gen_random_uuid()::text,true);
insert into auth.users(id,is_anonymous) values(current_setting('qa.owner')::uuid,true),(current_setting('qa.other')::uuid,true);
update billing_private.testing_settings set pro_enabled=true,geofences_enabled=true,visitors_enabled=true where singleton;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.owner'),'role','authenticated','is_anonymous',true)::text,true);
set local role authenticated;
do $$begin
 assert public.visitor_features_allowed();
 assert not public.dashboard_authorized();
 assert public.membership_read()->>'plan'='pro';
 assert public.member_load() is not null;
 perform public.member_preference_set('theme','"dark"');
 perform public.classifieds_save(auth.uid(),'free','Visitor fixture','Rolled back after verification');
 assert public.classifieds_read()->'mine'->>'title'='Visitor fixture';
 assert not has_function_privilege(current_user,'public.visitor_reminder_request(uuid,text)','execute');
end $$;
reset role;
set local role service_role;
do $$declare owner uuid:=current_setting('qa.owner')::uuid; other_id uuid:=current_setting('qa.other')::uuid; circle uuid:=current_setting('qa.circle')::uuid; token uuid;
begin
 perform public.geofence_save_with_invitations(owner,circle,'{"name":"Visitor fixture","description":"Temporary check","latitude":30.2,"longitude":-97.7,"diameter":50}',array['friend@example.invalid']);
 perform public.geofence_email_save(owner,circle,false,'');
 perform public.geofence_email_save(owner,circle,true,'guest@example.invalid');
 perform public.access_testing_grant('geofence',owner,circle);
 assert public.geofence_owner_list(other_id,'live')='[]'::jsonb;
 assert public.geofence_read(circle)->>'name'='Visitor fixture';
 assert public.geofence_is_owner(circle);
 begin perform public.geofence_schedule_set(other_id,circle,null,null);raise exception 'Another visitor edited a circle';exception when sqlstate 'PT404' then null;end;
 token:=public.visitor_reminder_request(owner,'reminder@example.invalid');
 assert public.visitor_reminder_address(owner) is null;
 assert public.visitor_reminder_confirm(token);
 assert public.visitor_reminder_address(owner)='reminder@example.invalid';
 assert public.visitor_reminder_address(other_id) is null;
end $$;
reset role;
do $$declare circle uuid:=current_setting('qa.circle')::uuid; job geofence_private.email_jobs; context jsonb;
begin
 assert not exists(select 1 from geofence_private.billing where space_id=circle);
 assert not exists(select 1 from geofence_private.email_jobs where space_id=circle and kind='welcome');
 for job in update geofence_private.email_jobs set state='processing',lease_until=now()+interval '2 minutes',lease_id=gen_random_uuid() where space_id=circle returning * loop
  context:=public.geofence_mail_context(job.id,job.lease_id);
  assert context->>'email'=case job.kind when 'invitation' then 'friend@example.invalid' when 'verify' then 'guest@example.invalid' end;
 end loop;
 assert (select count(*)=2 from geofence_private.email_jobs where space_id=circle);
end $$;
update billing_private.testing_settings set visitors_enabled=false where singleton;
set local role authenticated;
do $$begin
 assert not public.visitor_features_allowed();
 assert not public.geofence_is_owner(current_setting('qa.circle')::uuid);
 assert public.geofence_read(current_setting('qa.circle')::uuid) is null;
 begin perform public.membership_read();raise exception 'Guest Pro remained open';exception when insufficient_privilege then null;end;
 begin perform public.classifieds_read();raise exception 'Guest classifieds remained open';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
