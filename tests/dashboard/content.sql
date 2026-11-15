begin;
do $$begin
  perform set_config('content.qa_owner',gen_random_uuid()::text,true);
  perform set_config('content.qa_other',gen_random_uuid()::text,true);
  perform set_config('content.qa_id',gen_random_uuid()::text,true);
end $$;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
  (current_setting('content.qa_owner')::uuid,'content-'||current_setting('content.qa_owner')||'@example.invalid',now(),false),
  (current_setting('content.qa_other')::uuid,'content-'||current_setting('content.qa_other')||'@example.invalid',now(),false);
insert into dashboard_private.admins(owner_id,verified_email) values(current_setting('content.qa_owner')::uuid,'content-'||current_setting('content.qa_owner')||'@example.invalid');
set local role anon;
do $$begin
  assert not has_schema_privilege(current_user,'dashboard_private','USAGE');
  assert not has_function_privilege(current_user,'public.content_desk_save(uuid,integer,jsonb)','EXECUTE');
  begin perform public.content_desk_lists();raise exception using errcode='PT500';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('content.qa_other'),'is_anonymous',false)::text,true);end $$;
set local role authenticated;
do $$begin
  begin perform public.content_desk_lists();raise exception using errcode='PT500';exception when insufficient_privilege then null;end;
  begin perform public.content_desk_save(current_setting('content.qa_id')::uuid,0,'{"title":"No","intro":"","items":[]}');raise exception using errcode='PT500';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('content.qa_owner'),'is_anonymous',false)::text,true);end $$;
set local role authenticated;
do $$declare a jsonb;b jsonb;test_id uuid:=current_setting('content.qa_id');other_id uuid:=gen_random_uuid();begin
  assert not has_schema_privilege(current_user,'dashboard_private','USAGE');
  begin perform 1 from dashboard_private.content_lists;raise exception using errcode='PT500';exception when insufficient_privilege then null;end;
  a:=public.content_desk_save(test_id,0,'{"title":"Tomorrow","intro":"My words","items":[{"id":"event:1","title":"Fixture","note":"Private draft"}]}');
  assert (a->>'revision')::integer=1;
  b:=public.content_desk_save(other_id,0,'{"title":"Weekend","intro":"","items":[]}');
  assert jsonb_array_length(public.content_desk_lists())=2;
  a:=public.content_desk_save(test_id,1,'{"title":"Revised","intro":"Saved","items":[]}');
  assert (a->>'revision')::integer=2;assert public.content_desk_get(other_id)->'document'->>'title'='Weekend';
  begin perform public.content_desk_save(test_id,1,'{"title":"Stale","intro":"","items":[]}');raise exception using errcode='PT500';exception when sqlstate 'PT409' then null;end;
  begin perform public.content_desk_save(test_id,0,'{"title":"Collision","intro":"","items":[]}');raise exception using errcode='PT500';exception when sqlstate 'PT409' then null;end;
  begin perform public.content_desk_delete(test_id,1);raise exception using errcode='PT500';exception when sqlstate 'PT409' then null;end;
  begin perform public.content_desk_save(gen_random_uuid(),0,'{"title":"Bad","intro":"","items":{}}');raise exception using errcode='PT500';exception when invalid_parameter_value then null;end;
  assert public.content_desk_delete(other_id,1);assert jsonb_array_length(public.content_desk_lists())=1;
  assert public.content_desk_get(test_id)->'document'->>'title'='Revised';
end $$;
reset role;
-- A second allowlisted owner still cannot read, overwrite or remove the first owner's list.
insert into dashboard_private.admins(owner_id,verified_email) values(current_setting('content.qa_other')::uuid,'content-'||current_setting('content.qa_other')||'@example.invalid');
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('content.qa_other'),'is_anonymous',false)::text,true);end $$;
set local role authenticated;
do $$begin
  assert jsonb_array_length(public.content_desk_lists())=0;
  begin perform public.content_desk_get(current_setting('content.qa_id')::uuid);raise exception using errcode='PT500';exception when no_data_found then null;end;
  begin perform public.content_desk_save(current_setting('content.qa_id')::uuid,2,'{"title":"Forged","intro":"","items":[]}');raise exception using errcode='PT500';exception when sqlstate 'PT409' then null;end;
  begin perform public.content_desk_delete(current_setting('content.qa_id')::uuid,2);raise exception using errcode='PT500';exception when sqlstate 'PT409' then null;end;
end $$;
reset role;
delete from dashboard_private.admins where owner_id=current_setting('content.qa_other')::uuid;
set local role authenticated;
do $$begin begin perform public.content_desk_lists();raise exception using errcode='PT500';exception when insufficient_privilege then null;end;end $$;
rollback;
