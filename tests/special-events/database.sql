-- Executed only inside a transaction that the runner rolls back. Fixtures
-- never send auth messages or survive the check; output contains no user data.
select set_config('event.qa_owner',gen_random_uuid()::text,true);
select set_config('event.qa_other',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 (current_setting('event.qa_owner')::uuid,'event-qa-'||current_setting('event.qa_owner')||'@example.invalid',now(),false),
 (current_setting('event.qa_other')::uuid,'event-qa-'||current_setting('event.qa_other')||'@example.invalid',now(),false);
insert into public.special_events(id,title,page_path,dates,closes_at) values
 ('qa-scope-a','Fixture A','/maps/qa-scope-a/','["2026-11-14"]',now()+interval '1 day'),
 ('qa-scope-b','Fixture B','/maps/qa-scope-b/','["2026-11-14"]',now()+interval '1 day');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('event.qa_owner'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$
declare main uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); settings jsonb:='{"schemaVersion":2,"date":"2026-11-14","days":["2026-11-14"],"daySettings":{"2026-11-14":{"name":"2026-11-14","bufferMinutes":20}}}'; items jsonb;
begin
 items:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'day','2026-11-14','source',jsonb_build_object('key','place:qa','title','Main place'),'schedule',jsonb_build_object('note','Keep main note')));
 perform public.planner_save_scoped('main',main,0,settings,items);
 items:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'day','2026-11-14','source',jsonb_build_object('key','special-event:qa-scope-a:stop:2026-11-14','eventId','qa-scope-a','title','Studio'),'schedule',jsonb_build_object('note','Keep event note','start','2026-11-14T12:00:00-06:00')));
 perform public.planner_save_scoped('qa-scope-a',a,0,settings,items);
 perform public.planner_save_scoped('qa-scope-b',b,0,settings,'[]');
 if public.planner_load(null)->'plan'->>'id'<>main::text then raise exception 'Legacy load leaked an event'; end if;
 if public.planner_load_scoped('qa-scope-a',main)->'plan'->>'id'<>a::text then raise exception 'Scope did not own load'; end if;
 begin perform public.planner_save(main,1,settings,items);raise exception 'Legacy mixed save accepted';exception when sqlstate 'PT422' then null;end;
 begin perform public.planner_save_scoped('qa-scope-b',b,1,settings,items);raise exception 'Other event save accepted';exception when sqlstate 'PT422' then null;end;
 begin perform public.planner_save_scoped('qa-scope-a',a,0,settings,items);raise exception 'Stale revision accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.planner_save_scoped('qa-scope-a',gen_random_uuid(),0,settings,items);raise exception 'Duplicate collection accepted';exception when sqlstate 'PT409' then null;end;
 begin update public.planner_plans set scope='qa-scope-b' where id=a;raise exception 'Plan scope changed';exception when raise_exception then if sqlerrm<>'A plan cannot change its event' then raise;end if;end;
 begin update public.planner_items set plan_id=main where plan_id=a;raise exception 'Direct item leak accepted';exception when insufficient_privilege then null;end;
 if public.planner_load_scoped('qa-scope-a',null)->'plan'->'items'->0->'schedule'->>'note'<>'Keep event note' then raise exception 'Event note lost';end if;
 perform set_config('event.qa_main',main::text,true);perform set_config('event.qa_a',a::text,true);
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('event.qa_other'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$begin
 if public.planner_load_scoped('qa-scope-a',current_setting('event.qa_a')::uuid) is not null then raise exception 'Other owner leaked';end if;
 begin perform public.special_events_cleanup();raise exception 'Member could purge events';exception when insufficient_privilege then null;end;
 begin delete from public.special_events where id='qa-scope-a';raise exception 'Member deleted registry';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('event.qa_owner'),'is_anonymous',true)::text,true);
set local role authenticated;
do $$begin
 if public.planner_load_scoped('qa-scope-a',null) is not null then raise exception 'Guest read saved plans';end if;
end $$;
reset role;
update public.special_events set closes_at=now()-interval '49 hours' where id='qa-scope-a';
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('event.qa_owner'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$begin
 if public.planner_load_scoped('qa-scope-a',null) is not null then raise exception 'Expired plan was readable';end if;
 begin perform public.planner_save_scoped('qa-scope-a',current_setting('event.qa_a')::uuid,1,'{}','[]');raise exception 'Expired plan recreated';exception when sqlstate 'PT410' then null;end;
end $$;
reset role;
select public.special_events_cleanup();
do $$begin
 if exists(select 1 from public.planner_plans where scope='qa-scope-a') or exists(select 1 from public.planner_items where plan_id=current_setting('event.qa_a')::uuid) then raise exception 'Event data survived cleanup';end if;
 if not exists(select 1 from public.planner_plans where id=current_setting('event.qa_main')::uuid) or not exists(select 1 from public.planner_plans where scope='qa-scope-b') then raise exception 'Cleanup affected unrelated plans';end if;
 if not exists(select 1 from public.planner_items where plan_id=current_setting('event.qa_main')::uuid and schedule->>'note'='Keep main note') then raise exception 'Main note lost';end if;
end $$;
