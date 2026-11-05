-- Generated fixtures only; all changes, including grant history, are rolled back.
begin;
do $$begin
  perform set_config('substack.qa_a',gen_random_uuid()::text,true);
  perform set_config('substack.qa_b',gen_random_uuid()::text,true);
end $$;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
  (current_setting('substack.qa_a')::uuid,'substack-'||current_setting('substack.qa_a')||'@example.invalid',now(),false),
  (current_setting('substack.qa_b')::uuid,'substack-'||current_setting('substack.qa_b')||'@example.invalid',now(),false);
set local role anon;
do $$begin
  assert not has_schema_privilege(current_user,'billing_private','USAGE');
  assert not has_function_privilege(current_user,'public.billing_substack_access(uuid)','EXECUTE');
  assert not has_function_privilege(current_user,'public.billing_substack_grant(text,text,timestamptz)','EXECUTE');
  assert not has_function_privilege(current_user,'public.billing_substack_revoke(text)','EXECUTE');
end $$;
reset role;
set local role authenticated;
do $$begin
  assert not has_schema_privilege(current_user,'billing_private','USAGE');
  assert not has_function_privilege(current_user,'public.billing_substack_access(uuid)','EXECUTE');
  assert not has_function_privilege(current_user,'public.billing_substack_grant(text,text,timestamptz)','EXECUTE');
  assert not has_function_privilege(current_user,'public.billing_substack_revoke(text)','EXECUTE');
  begin perform public.billing_substack_grant('forged@example.invalid','monthly',now()+interval '1 month');
    raise exception 'Self-grant must fail';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
do $$declare email text:='substack-'||current_setting('substack.qa_a')||'@example.invalid'; result jsonb;begin
  begin perform public.billing_substack_grant(email,'free',now()+interval '1 month');raise exception using errcode='PT500';exception when raise_exception then null;end;
  begin perform public.billing_substack_grant(email,'monthly',now()-interval '1 second');raise exception using errcode='PT500';exception when raise_exception then null;end;
  begin perform public.billing_substack_grant(email,'monthly','infinity');raise exception using errcode='PT500';exception when raise_exception then null;end;
  begin perform public.billing_substack_grant('missing@example.invalid','monthly',now()+interval '1 month');raise exception using errcode='PT500';exception when raise_exception then null;end;
  result:=public.billing_substack_grant(upper(email),'monthly',now()+interval '1 month');
  assert result->>'hasSiteBilling'='false';
  assert public.billing_substack_access(current_setting('substack.qa_a')::uuid) is not null;
  assert public.billing_substack_access(current_setting('substack.qa_b')::uuid) is null;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('substack.qa_a'),'is_anonymous',false)::text,true);end $$;
set local role authenticated;
do $$declare result jsonb;begin
  result:=public.membership_read();
  assert result->>'plan'='pro';assert result->>'source'='substack';assert result->>'hasBilling'='false';
  assert not result ? 'verified_email';assert not result ? 'owner_id';
end $$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('substack.qa_b'),'is_anonymous',false)::text,true);end $$;
set local role authenticated;
do $$begin assert public.membership_read()->>'plan'='free';end $$;
reset role;
-- The same confirmed account must still own the verified email.
update auth.users set email='changed-'||id||'@example.invalid' where id=current_setting('substack.qa_a')::uuid;
do $$begin assert public.billing_substack_access(current_setting('substack.qa_a')::uuid) is null;end $$;
update auth.users set email='substack-'||id||'@example.invalid',email_confirmed_at=null where id=current_setting('substack.qa_a')::uuid;
do $$begin
  assert public.billing_substack_access(current_setting('substack.qa_a')::uuid) is null;
  begin perform public.billing_substack_grant('substack-'||current_setting('substack.qa_a')||'@example.invalid','annual',now()+interval '1 year');
    raise exception using errcode='PT500';exception when raise_exception then null;end;
end $$;
update auth.users set email_confirmed_at=now(),is_anonymous=true where id=current_setting('substack.qa_a')::uuid;
do $$begin assert public.billing_substack_access(current_setting('substack.qa_a')::uuid) is null;end $$;
update auth.users set is_anonymous=false where id=current_setting('substack.qa_a')::uuid;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('substack.qa_a'),'is_anonymous',false)::text,true);end $$;
-- Test Stripe access never contributes. Annual and founding grants are supported.
insert into billing_private.members(mode,owner_id,status,pro_until) values
  ('test',current_setting('substack.qa_a')::uuid,'active',now()+interval '2 years');
do $$declare email text:='substack-'||current_setting('substack.qa_a')||'@example.invalid';begin
  perform public.billing_substack_grant(email,'annual',now()+interval '1 year');
  perform public.billing_substack_grant(email,'founding',now()+interval '1 year');
  assert public.billing_substack_access(current_setting('substack.qa_a')::uuid)->>'subscriptionPlan'='founding';
end $$;
update billing_private.substack_memberships set pro_until=now()-interval '1 second' where owner_id=current_setting('substack.qa_a')::uuid;
set local role authenticated;
do $$begin assert public.membership_read()->>'plan'='free','Expired grants must not unlock Pro';end $$;
reset role;
-- Independent paid sources: cancellation or revocation cannot erase the other.
insert into billing_private.members(mode,owner_id,status,pro_until) values
  ('live',current_setting('substack.qa_a')::uuid,'active',now()+interval '10 days');
do $$begin perform public.billing_substack_grant('substack-'||current_setting('substack.qa_a')||'@example.invalid','annual',now()+interval '1 year');end $$;
set local role authenticated;
do $$declare result jsonb;begin
  result:=public.membership_read();assert result->>'source'='both';
  assert (result->>'paidThrough')::timestamptz>now()+interval '11 months';
end $$;
reset role;
update billing_private.members set status='canceled',pro_until=null where mode='live' and owner_id=current_setting('substack.qa_a')::uuid;
set local role authenticated;
do $$begin assert public.membership_read()->>'source'='substack';end $$;
reset role;
update billing_private.members set status='active',pro_until=now()+interval '10 days' where mode='live' and owner_id=current_setting('substack.qa_a')::uuid;
set local role service_role;
do $$begin perform public.billing_substack_revoke('substack-'||current_setting('substack.qa_a')||'@example.invalid');end $$;
reset role;
set local role authenticated;
do $$begin assert public.membership_read()->>'source'='site';assert public.membership_read()->>'plan'='pro';end $$;
reset role;
update billing_private.members set pro_until=now()-interval '1 second' where mode='live' and owner_id=current_setting('substack.qa_a')::uuid;
set local role authenticated;
do $$begin assert public.membership_read()->>'plan'='free';end $$;
reset role;
do $$begin assert (select count(*) from billing_private.substack_history where owner_id=current_setting('substack.qa_a')::uuid)=5;end $$;
rollback;
