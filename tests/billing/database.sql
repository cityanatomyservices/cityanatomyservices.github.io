-- Only generated, rolled-back fixtures. Safe after migration in a preflight transaction.
begin;
do $$begin
  perform set_config('billing.qa_a',gen_random_uuid()::text,true);
  perform set_config('billing.qa_b',gen_random_uuid()::text,true);
  perform set_config('billing.qa_guest',gen_random_uuid()::text,true);
end $$;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 (current_setting('billing.qa_a')::uuid,'billing-'||current_setting('billing.qa_a')||'@example.invalid',now(),false),
 (current_setting('billing.qa_b')::uuid,'billing-'||current_setting('billing.qa_b')||'@example.invalid',now(),false),
 (current_setting('billing.qa_guest')::uuid,null,null,true);
set local role anon;
do $$begin
  assert not has_schema_privilege(current_user,'billing_private','USAGE');
  assert not has_function_privilege(current_user,'public.billing_load(text,uuid,text)','EXECUTE');
  assert not has_function_privilege(current_user,'public.billing_claim(text,uuid)','EXECUTE');
  assert not has_function_privilege(current_user,'public.billing_save(text,uuid,uuid,jsonb)','EXECUTE');
  assert not has_function_privilege(current_user,'public.billing_release(text,uuid,uuid)','EXECUTE');
  begin perform public.membership_read();raise exception 'Guest reads must fail';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('billing.qa_a'),'is_anonymous',false)::text,true);end $$;
set local role authenticated;
do $$begin
  assert public.membership_read()->>'plan'='free';
  assert public.membership_read()->>'hasBilling'='false';
  assert not has_schema_privilege(current_user,'billing_private','USAGE');
  assert not has_function_privilege(current_user,'public.billing_load(text,uuid,text)','EXECUTE');
  assert not has_function_privilege(current_user,'public.billing_claim(text,uuid)','EXECUTE');
  assert not has_function_privilege(current_user,'public.billing_save(text,uuid,uuid,jsonb)','EXECUTE');
  assert not has_function_privilege(current_user,'public.billing_release(text,uuid,uuid)','EXECUTE');
end $$;
reset role;
set local role service_role;
do $$declare entry jsonb; lease uuid;begin
  begin perform public.billing_claim('live',current_setting('billing.qa_guest')::uuid);raise exception 'Guest cannot be billed';exception when insufficient_privilege then null;end;
  entry:=public.billing_claim('test',current_setting('billing.qa_a')::uuid);lease:=(entry->>'lease_id')::uuid;
  entry:=public.billing_save('test',current_setting('billing.qa_a')::uuid,lease,
    jsonb_build_object('customer_id','cus_test_'||current_setting('billing.qa_a'),'status','active','pro_until',now()+interval '30 days'));
  perform public.billing_release('test',current_setting('billing.qa_a')::uuid,lease);
end $$;
reset role;
set local role authenticated;
do $$begin assert public.membership_read()->>'plan'='free','Test purchases must never grant live Pro';end $$;
reset role;
set local role service_role;
do $$declare entry jsonb; lease uuid;begin
  entry:=public.billing_claim('live',current_setting('billing.qa_a')::uuid);lease:=(entry->>'lease_id')::uuid;
  perform set_config('billing.qa_lease',lease::text,true);
  begin perform public.billing_claim('live',current_setting('billing.qa_a')::uuid);raise exception 'Second lease must fail';exception when sqlstate 'PT409' then null;end;
  begin perform public.billing_save('live',current_setting('billing.qa_a')::uuid,gen_random_uuid(),'{}');raise exception 'Stale lease must fail';exception when sqlstate 'PT409' then null;end;
  begin perform public.billing_save('live',current_setting('billing.qa_a')::uuid,null,'{}');raise exception 'Null lease must fail';exception when sqlstate 'PT409' then null;end;
  entry:=public.billing_save('live',current_setting('billing.qa_a')::uuid,lease,
    jsonb_build_object('customer_id','cus_live_'||current_setting('billing.qa_a'),'status','active',
      'subscription_id','sub_fixture','pro_until',now()+interval '30 days','cancel_at_period_end',true));
  assert public.billing_load('live',null,entry->>'customer_id')->>'owner_id'=current_setting('billing.qa_a');
  assert public.billing_load('test',null,entry->>'customer_id') is null;
  perform public.billing_release('live',current_setting('billing.qa_a')::uuid,lease);
  begin perform public.billing_save('live',current_setting('billing.qa_a')::uuid,lease,'{}');raise exception 'Released lease must fail';exception when sqlstate 'PT409' then null;end;
end $$;
reset role;
set local role authenticated;
do $$declare result jsonb;begin
  result:=public.membership_read();assert result->>'plan'='pro';assert result->>'cancelAtPeriodEnd'='true';
  assert not result ? 'customer_id';assert not result ? 'subscription_id';assert not result ? 'lease_id';
end $$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('billing.qa_b'),'is_anonymous',false)::text,true);end $$;
set local role authenticated;
do $$begin assert public.membership_read()->>'plan'='free','Another account must remain Free';end $$;
reset role;
-- A stale paid record cannot give access beyond the paid-through date.
update billing_private.members set pro_until=now()-interval '1 second' where mode='live' and owner_id=current_setting('billing.qa_a')::uuid;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('billing.qa_a'),'is_anonymous',false)::text,true);end $$;
set local role authenticated;
do $$begin assert public.membership_read()->>'plan'='free';end $$;
reset role;
-- A replacement worker invalidates the old token even if the old worker releases late.
set local role service_role;
do $$declare entry jsonb; lease uuid;begin
  entry:=public.billing_claim('live',current_setting('billing.qa_a')::uuid);lease:=(entry->>'lease_id')::uuid;
  perform public.billing_release('live',current_setting('billing.qa_a')::uuid,current_setting('billing.qa_lease')::uuid);
  assert public.billing_load('live',current_setting('billing.qa_a')::uuid)->>'lease_id'=lease::text;
  perform public.billing_release('live',current_setting('billing.qa_a')::uuid,lease);
end $$;
reset role;
-- Unconfirmed users and forged non-anonymous claims cannot read entitlements.
update auth.users set email_confirmed_at=null where id=current_setting('billing.qa_a')::uuid;
set local role authenticated;
do $$begin begin perform public.membership_read();raise exception 'Unconfirmed user';exception when insufficient_privilege then null;end;end $$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('billing.qa_guest'),'is_anonymous',false)::text,true);end $$;
set local role authenticated;
do $$begin begin perform public.membership_read();raise exception 'Forged guest';exception when insufficient_privilege then null;end;end $$;
reset role;
rollback;
