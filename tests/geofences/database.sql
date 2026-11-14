begin;
select set_config('geotest.owner',gen_random_uuid()::text,true),set_config('geotest.other',gen_random_uuid()::text,true),set_config('geotest.guest',gen_random_uuid()::text,true),set_config('geotest.space',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
(current_setting('geotest.owner')::uuid,'geotest-'||current_setting('geotest.owner')||'@example.invalid',now(),false),
(current_setting('geotest.other')::uuid,'geotest-'||current_setting('geotest.other')||'@example.invalid',now(),false),
(current_setting('geotest.guest')::uuid,null,null,true);
set local role anon;
do $$begin
 assert not has_schema_privilege(current_user,'geofence_private','USAGE');
 assert not has_function_privilege(current_user,'public.geofence_billing_save(text,uuid,uuid,jsonb)','EXECUTE');
 assert not has_function_privilege(current_user,'public.geofence_save_draft(uuid,uuid,jsonb)','EXECUTE');
 assert not has_function_privilege(current_user,'public.geofence_chat(uuid,double precision,double precision,double precision,timestamptz,text,boolean)','EXECUTE');
 assert public.geofence_read(current_setting('geotest.space')::uuid) is null;
end $$;
reset role;
set local role service_role;
do $$declare f jsonb:='{"name":"Courtyard","description":"Test","latitude":30.2672,"longitude":-97.7431,"diameter":500}';id uuid:=current_setting('geotest.space')::uuid;owner uuid:=current_setting('geotest.owner')::uuid;row jsonb;lease uuid;begin
 begin perform public.geofence_save_draft(current_setting('geotest.guest')::uuid,id,f);raise exception 'Guest draft accepted';exception when insufficient_privilege then null;end;
 row:=public.geofence_save_draft(owner,id,f||'{"diameter":10}'::jsonb);assert (row->>'diameter')::integer=10;
 row:=public.geofence_save_draft(owner,id,f||'{"diameter":101}'::jsonb);assert (row->>'diameter')::integer=101;
 perform public.geofence_save_draft(owner,id,f);
 assert public.geofence_owner_list(owner,'live')->0->>'diameter'='500';
 begin perform public.geofence_save_draft(current_setting('geotest.other')::uuid,id,f);raise exception 'Other owner overwrite';exception when sqlstate 'PT404' then null;end;
 begin perform public.geofence_save_draft(owner,id,f||'{"diameter":501}'::jsonb);raise exception 'Invalid diameter accepted';exception when check_violation then null;end;
 assert jsonb_array_length(public.geofence_owner_list(owner,'live'))=1;
 assert jsonb_array_length(public.geofence_owner_list(current_setting('geotest.other')::uuid,'live'))=0;
 begin perform public.geofence_billing_claim('live',id,current_setting('geotest.other')::uuid);raise exception 'Wrong owner billed';exception when sqlstate 'PT404' then null;end;
 row:=public.geofence_billing_claim('test',id,owner);lease:=(row->>'lease_id')::uuid;
 perform public.geofence_billing_save('test',id,lease,jsonb_build_object('status','active','pro_until',now()+interval '1 month'));
 perform public.geofence_billing_release('test',id,lease);
 assert public.geofence_read(id) is null,'Test payment must not publish';
 row:=public.geofence_billing_claim('live',id,owner);lease:=(row->>'lease_id')::uuid;
 begin perform public.geofence_billing_claim('live',id,owner);raise exception 'Duplicate lease';exception when sqlstate 'PT409' then null;end;
 begin perform public.geofence_save_draft(owner,id,f);raise exception 'Draft edit during checkout';exception when sqlstate 'PT409' then null;end;
 begin perform public.geofence_billing_save('live',id,gen_random_uuid(),'{"status":"active"}');raise exception 'Stale lease accepted';exception when sqlstate 'PT409' then null;end;
 perform public.geofence_billing_save('live',id,lease,jsonb_build_object('customer_id','cus_geotest_'||id,'status','active','pro_until',now()+interval '1 month','cancel_at_period_end',true));
 begin perform public.geofence_billing_save('live',id,lease,'{"customer_id":"wrong"}');raise exception 'Customer switched';exception when raise_exception then if sqlerrm<>'Customer cannot change' then raise;end if;end;
 perform public.geofence_billing_release('live',id,lease);
 assert public.geofence_read(id)->>'name'='Courtyard','Cancel at period end retains paid access';
 assert not(public.geofence_read(id)?'owner_id');
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('geotest.guest'),'is_anonymous',true)::text,true);
set local role authenticated;
do $$declare id uuid:=current_setting('geotest.space')::uuid;r jsonb;begin
 assert not has_schema_privilege(current_user,'geofence_private','USAGE');
 assert not has_function_privilege(current_user,'public.geofence_billing_claim(text,uuid,uuid)','EXECUTE');
 begin perform public.geofence_chat(id,31,-97.7431,5,clock_timestamp(),null,false);raise exception 'Outside accepted';exception when sqlstate 'PT403' then null;end;
 begin perform public.geofence_chat(id,30.26946,-97.7431,5,clock_timestamp(),null,false);raise exception 'Beyond 250m radius accepted';exception when sqlstate 'PT403' then null;end;
 r:=public.geofence_chat(id,30.26944,-97.7431,50,clock_timestamp(),null,false);assert jsonb_array_length(r->'people')=1,'Within 250m radius should join';
 begin perform public.geofence_chat(id,30.2672,-97.7431,51,clock_timestamp(),null,false);raise exception 'Inaccurate accepted';exception when sqlstate 'PT403' then null;end;
 begin perform public.geofence_chat(id,30.2672,-97.7431,5,clock_timestamp()-interval '1 minute',null,false);raise exception 'Stale accepted';exception when sqlstate 'PT403' then null;end;
 r:=public.geofence_chat(id,30.2672,-97.7431,5,clock_timestamp(),null,false);assert jsonb_array_length(r->'people')=1;
 r:=public.geofence_chat(id,30.2672,-97.7431,5,clock_timestamp(),'Hello',false);assert jsonb_array_length(r->'messages')=1;assert r->'messages'->0->>'body'='Hello';
 assert not(r->'people'->0?'user_id');
 begin perform public.geofence_chat(id,30.2672,-97.7431,5,clock_timestamp(),'Again',false);raise exception 'Rate limit missing';exception when sqlstate 'PT429' then null;end;
 perform public.geofence_chat(id,p_leave=>true);
end $$;
reset role;
do $$declare id uuid:=current_setting('geotest.space')::uuid;begin
 assert not exists(select 1 from geofence_private.people where space_id=id);
 update geofence_private.billing set pro_until=now()-interval '1 second' where space_id=id and mode='live';
 assert public.geofence_read(id) is null;
end $$;
set local role authenticated;
do $$begin begin perform public.geofence_chat(current_setting('geotest.space')::uuid,30.2672,-97.7431,5,clock_timestamp(),null,false);raise exception 'Expired geofence accepts chat';exception when sqlstate 'PT410' then null;end;end $$;
reset role;
rollback;
