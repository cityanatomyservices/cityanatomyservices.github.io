-- Run after migration in a transaction. All fixtures roll back, including Auth users.
begin;
do $$begin
  perform set_config('classifieds.qa_a',gen_random_uuid()::text,true);
  perform set_config('classifieds.qa_b',gen_random_uuid()::text,true);
  perform set_config('classifieds.qa_guest',gen_random_uuid()::text,true);
end$$;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 (current_setting('classifieds.qa_a')::uuid,'classifieds-'||current_setting('classifieds.qa_a')||'@example.invalid',now(),false),
 (current_setting('classifieds.qa_b')::uuid,'classifieds-'||current_setting('classifieds.qa_b')||'@example.invalid',now(),false),
 (current_setting('classifieds.qa_guest')::uuid,null,null,true);
set local role anon;
do $$begin
  begin perform public.classifieds_read();raise exception 'Anonymous reads must fail';exception when insufficient_privilege then null;end;
  assert not has_schema_privilege(current_user,'classifieds_private','USAGE');
end$$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('classifieds.qa_guest'),'is_anonymous',true)::text,true);end$$;
set local role authenticated;
do $$begin
  begin perform public.classifieds_read();raise exception 'Guest reads must fail';exception when insufficient_privilege then null;end;
  begin perform public.classifieds_save(current_setting('classifieds.qa_guest')::uuid,'free','Guest','No',0);raise exception 'Guest writes must fail';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('classifieds.qa_a'),'is_anonymous',false)::text,true);end$$;
set local role authenticated;
do $$declare response jsonb; saved jsonb;begin
  response:=public.classifieds_read();assert jsonb_array_length(response->'categories')=8;
  assert response->'mine'='null'::jsonb;
  saved:=public.classifieds_save(current_setting('classifieds.qa_a')::uuid,'for-sale',' Desk ',' Call (512) 555-0123, visit 123 Main Street, or write to chosen@example.invalid. ',0);
  perform set_config('classifieds.qa_ad_a',saved->>'id',true);
  assert saved->>'title'='Desk';assert saved->>'revision'='1';
  assert not saved ? 'email';assert not saved ? 'owner_id';
  assert saved->>'body' like '%chosen@example.invalid%';
  response:=public.classifieds_read('for-sale');assert response->>'total'='1';assert response#>>'{ads,0,mine}'='true';
  begin perform public.classifieds_save(current_setting('classifieds.qa_a')::uuid,'jobs','Second','No',0);raise exception 'Duplicate ad must fail';exception when sqlstate 'PT409' then null;end;
  begin perform public.classifieds_save(current_setting('classifieds.qa_a')::uuid,'unknown','Title','Body',1,current_setting('classifieds.qa_ad_a')::uuid);raise exception 'Unknown category must fail';exception when invalid_parameter_value then null;end;
  begin perform public.classifieds_save(current_setting('classifieds.qa_a')::uuid,'free','','Body',1,current_setting('classifieds.qa_ad_a')::uuid);raise exception 'Empty title must fail';exception when invalid_parameter_value then null;end;
  begin perform public.classifieds_save(current_setting('classifieds.qa_a')::uuid,'free','Title',repeat('x',1001),1,current_setting('classifieds.qa_ad_a')::uuid);raise exception 'Long paragraph must fail';exception when invalid_parameter_value then null;end;
  begin perform public.classifieds_delete(current_setting('classifieds.qa_a')::uuid,0,current_setting('classifieds.qa_ad_a')::uuid);raise exception 'Stale delete must fail';exception when sqlstate 'PT409' then null;end;
  begin perform * from classifieds_private.ads;raise exception 'Direct table reads must fail';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('classifieds.qa_b'),'is_anonymous',false)::text,true);end$$;
set local role authenticated;
do $$declare response jsonb;begin
  response:=public.classifieds_read('for-sale');assert response#>>'{ads,0,mine}'='false';assert response#>'{ads,0,revision}'='null'::jsonb;
  assert response->'mine'='null'::jsonb;assert response::text not like '%'||current_setting('classifieds.qa_a')||'%';
  begin perform public.classifieds_save(current_setting('classifieds.qa_a')::uuid,'free','Spoof','No',1,current_setting('classifieds.qa_ad_a')::uuid);raise exception 'Another owner must fail';exception when insufficient_privilege then null;end;
  begin perform public.classifieds_delete(current_setting('classifieds.qa_a')::uuid,1,current_setting('classifieds.qa_ad_a')::uuid);raise exception 'Another owner delete must fail';exception when insufficient_privilege then null;end;
  perform public.classifieds_save(current_setting('classifieds.qa_b')::uuid,'services','<img src=x onerror=alert(1)>','Plain text, not rendered HTML.',0);
  assert public.classifieds_read('services')->>'total'='1';
end$$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('classifieds.qa_a'),'is_anonymous',false)::text,true);end$$;
set local role authenticated;
do $$declare response jsonb;begin
  response:=public.classifieds_save(current_setting('classifieds.qa_a')::uuid,'free','Updated',E'One\n\nparagraph.',1,current_setting('classifieds.qa_ad_a')::uuid);
  assert response->>'revision'='2';assert response->>'body'='One paragraph.';
  assert public.classifieds_read('for-sale')->>'total'='0';assert public.classifieds_read('free')->>'total'='1';
  begin perform public.classifieds_save(current_setting('classifieds.qa_a')::uuid,'free','Stale','No',1,current_setting('classifieds.qa_ad_a')::uuid);raise exception 'Stale update must fail';exception when sqlstate 'PT409' then null;end;
  perform public.classifieds_delete(current_setting('classifieds.qa_a')::uuid,2,current_setting('classifieds.qa_ad_a')::uuid);
  assert public.classifieds_read()->'mine'='null'::jsonb;
  perform public.classifieds_save(current_setting('classifieds.qa_a')::uuid,'gigs','New after delete','Allowed.',0);
  begin perform public.classifieds_save(current_setting('classifieds.qa_a')::uuid,'free','Old form','No',1,current_setting('classifieds.qa_ad_a')::uuid);raise exception 'Deleted/recreated ad must reject old form';exception when sqlstate 'PT409' then null;end;
end$$;
reset role;
-- A forged non-anonymous claim still cannot elevate an anonymous Auth record.
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('classifieds.qa_guest'),'is_anonymous',false)::text,true);end$$;
set local role authenticated;
do $$begin
  begin perform public.classifieds_read();raise exception 'Forged guest claim must fail';exception when insufficient_privilege then null;end;
end$$;
reset role;
-- Unconfirmed and deleted accounts cannot reuse an old token to read or write.
update auth.users set email_confirmed_at=null where id=current_setting('classifieds.qa_a')::uuid;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('classifieds.qa_a'),'is_anonymous',false)::text,true);end$$;
set local role authenticated;
do $$begin
  begin perform public.classifieds_read();raise exception 'Unconfirmed account must fail';exception when insufficient_privilege then null;end;
end$$;
reset role;
delete from auth.users where id=current_setting('classifieds.qa_a')::uuid;
do $$begin assert not exists(select 1 from classifieds_private.ads where owner_id=current_setting('classifieds.qa_a')::uuid);end$$;
set local role authenticated;
do $$begin
  begin perform public.classifieds_read();raise exception 'Deleted account must fail';exception when insufficient_privilege then null;end;
end$$;
reset role;
-- Pagination does not lose or repeat records with the same creation timestamp.
insert into auth.users(id,email,email_confirmed_at,is_anonymous)
  select gen_random_uuid(),'classifieds-pagination-'||gen_random_uuid()||'@example.invalid',now(),false from generate_series(1,23);
insert into classifieds_private.ads(owner_id,category,title,body)
  select id,'community','Fixture note','Paragraph.' from auth.users where email like 'classifieds-pagination-%@example.invalid';
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('classifieds.qa_b'),'is_anonymous',false)::text,true);end$$;
set local role authenticated;
do $$declare first_page jsonb; second_page jsonb;begin
  first_page:=public.classifieds_read('community',0);second_page:=public.classifieds_read('community',20);
  assert jsonb_array_length(first_page->'ads')=20;assert jsonb_array_length(second_page->'ads')=3;
  assert first_page->>'more'='true';assert second_page->>'more'='false';
  assert not exists(select 1 from jsonb_array_elements(first_page->'ads') a,jsonb_array_elements(second_page->'ads') b where a->>'id'=b->>'id');
end$$;
reset role;
rollback;
