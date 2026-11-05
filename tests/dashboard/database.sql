-- Generated fixtures only. Reports never print real rows during verification.
begin;
do $$begin
  perform set_config('dashboard.qa_admin',gen_random_uuid()::text,true);
  perform set_config('dashboard.qa_other',gen_random_uuid()::text,true);
end $$;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
  (current_setting('dashboard.qa_admin')::uuid,'dashboard-'||current_setting('dashboard.qa_admin')||'@example.invalid',now(),false),
  (current_setting('dashboard.qa_other')::uuid,'dashboard-'||current_setting('dashboard.qa_other')||'@example.invalid',now(),false);
insert into dashboard_private.admins(owner_id,verified_email) values
  (current_setting('dashboard.qa_admin')::uuid,'dashboard-'||current_setting('dashboard.qa_admin')||'@example.invalid');
set local role anon;
do $$begin
  assert not has_schema_privilege(current_user,'dashboard_private','USAGE');
  assert not has_function_privilege(current_user,'public.dashboard_query(text,text,timestamptz,timestamptz,text,text,integer)','EXECUTE');
  begin perform public.dashboard_catalog();raise exception using errcode='PT500';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('dashboard.qa_other'),'is_anonymous',false)::text,true);end $$;
set local role authenticated;
do $$begin
  assert not public.dashboard_authorized();
  assert not has_schema_privilege(current_user,'dashboard_private','USAGE');
  begin perform public.dashboard_catalog();raise exception using errcode='PT500';exception when insufficient_privilege then null;end;
  begin perform public.dashboard_query('members');raise exception using errcode='PT500';exception when insufficient_privilege then null;end;
  begin perform public.dashboard_substack_grant('forged@example.invalid','monthly',now()+interval '1 month');raise exception using errcode='PT500';exception when insufficient_privilege then null;end;
  begin perform public.dashboard_substack_revoke('forged@example.invalid');raise exception using errcode='PT500';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.messages(room,user_id,handle,emoji,text,created_at) values
  (current_setting('dashboard.qa_admin'),current_setting('dashboard.qa_admin')::uuid,'fixture','x','first',now()-interval '2 days'),
  (current_setting('dashboard.qa_admin'),current_setting('dashboard.qa_admin')::uuid,'fixture','x','second',now()-interval '1 day'),
  (current_setting('dashboard.qa_admin'),current_setting('dashboard.qa_admin')::uuid,'fixture','x','third',now());
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('dashboard.qa_admin'),'is_anonymous',false)::text,true);end $$;
set local role authenticated;
do $$declare page jsonb; next_page jsonb; report jsonb;begin
  assert public.dashboard_authorized();assert jsonb_array_length(public.dashboard_catalog())>=18;
  page:=public.dashboard_query('chat','',null,null,current_setting('dashboard.qa_admin'),'',2);
  assert jsonb_array_length(page->'rows')=2;assert (page->>'more')::boolean;
  next_page:=public.dashboard_query('chat','',null,null,current_setting('dashboard.qa_admin'),page->>'cursor',2);
  assert jsonb_array_length(next_page->'rows')=1;assert not (next_page->>'more')::boolean;
  assert page->'rows'->0->>'id'<>next_page->'rows'->0->>'id';
  page:=public.dashboard_query('chat','second',null,null,current_setting('dashboard.qa_admin'));
  assert jsonb_array_length(page->'rows')=1;assert page->'rows'->0->>'text'='second';
  page:=public.dashboard_query('chat','',now()-interval '12 hours',null,current_setting('dashboard.qa_admin'));
  assert jsonb_array_length(page->'rows')=1;
  page:=public.dashboard_query('members',current_setting('dashboard.qa_admin'));
  assert jsonb_array_length(page->'rows')=1;
  assert not page->'rows'->0 ? 'encrypted_password';assert not page->'rows'->0 ? 'checkout_id';
  -- Every server-owned query must compile against the deployed schema.
  for report in select value from jsonb_array_elements(public.dashboard_catalog()) loop
    page:=public.dashboard_query(report->>'id','',null,null,'','',1);
    assert jsonb_typeof(page->'rows')='array';
  end loop;
  begin perform public.dashboard_query('auth.users;drop table public.messages');raise exception using errcode='PT500';exception when invalid_parameter_value then null;end;
  begin perform public.dashboard_query('chat','',null,null,'','',1001);raise exception using errcode='PT500';exception when invalid_parameter_value then null;end;
  page:=public.dashboard_query('chat',''';drop table public.messages;--');assert jsonb_array_length(page->'rows')=0;
  perform public.dashboard_substack_grant('dashboard-'||current_setting('dashboard.qa_other')||'@example.invalid','annual',now()+interval '1 year');
  perform public.dashboard_substack_revoke('dashboard-'||current_setting('dashboard.qa_other')||'@example.invalid');
end $$;
reset role;
update auth.users set email_confirmed_at=null where id=current_setting('dashboard.qa_admin')::uuid;
set local role authenticated;
do $$begin assert not public.dashboard_authorized();begin perform public.dashboard_query('chat');raise exception using errcode='PT500';exception when insufficient_privilege then null;end;end $$;
reset role;
update auth.users set email_confirmed_at=now(),email='changed-'||id||'@example.invalid' where id=current_setting('dashboard.qa_admin')::uuid;
set local role authenticated;
do $$begin assert not public.dashboard_authorized();end $$;
reset role;
update auth.users set email='dashboard-'||id||'@example.invalid',is_anonymous=true where id=current_setting('dashboard.qa_admin')::uuid;
set local role authenticated;
do $$begin assert not public.dashboard_authorized();end $$;
reset role;
update auth.users set is_anonymous=false where id=current_setting('dashboard.qa_admin')::uuid;
delete from dashboard_private.admins where owner_id=current_setting('dashboard.qa_admin')::uuid;
set local role authenticated;
do $$begin assert not public.dashboard_authorized();begin perform public.dashboard_query('members');raise exception using errcode='PT500';exception when insufficient_privilege then null;end;end $$;
reset role;
rollback;
