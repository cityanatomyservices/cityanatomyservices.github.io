-- Disposable fixtures; the runner always rolls this transaction back.
select set_config('event.qa_owner',gen_random_uuid()::text,true);
select set_config('event.qa_other',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 (current_setting('event.qa_owner')::uuid,'event-qa-'||current_setting('event.qa_owner')||'@example.invalid',now(),false),
 (current_setting('event.qa_other')::uuid,'event-qa-'||current_setting('event.qa_other')||'@example.invalid',now(),false);
insert into public.special_events(id,title,page_path,dates,closes_at) values
 ('qa-save-a','Fixture A','/maps/qa-save-a/','["2026-11-14"]',now()+interval '1 day'),
 ('qa-save-b','Fixture B','/maps/qa-save-b/','["2026-11-14"]',now()+interval '1 day');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('event.qa_owner'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$declare owner uuid:=current_setting('event.qa_owner')::uuid; saved jsonb;begin
 saved:=public.special_event_stop_set('qa-save-a',owner,'one','note','"Private note"','""');
 saved:=public.special_event_stop_set('qa-save-a',owner,'one','favorite','true','false');
 if saved->>'note' is distinct from 'Private note' or saved->>'favorite' is distinct from 'true' then raise exception 'Independent field lost';end if;
 perform public.special_event_stop_set('qa-save-b',owner,'one','note','"Other event"','""');
 if jsonb_array_length(public.special_event_stops_load('qa-save-a',owner))<>1 then raise exception 'Event scope leaked';end if;
 begin perform public.special_event_stop_set('qa-save-a',owner,'one','note','"Stale"','""');raise exception 'Stale note overwritten';exception when sqlstate 'PT409' then null;end;
 begin perform public.special_event_stop_set('qa-save-a',owner,'one','favorite','false','false');raise exception 'Stale Favorite overwritten';exception when sqlstate 'PT409' then null;end;
 begin perform public.special_event_stop_set('qa-save-a',owner,'two','note',to_jsonb(repeat('x',2001)),'""');raise exception 'Long note accepted';exception when sqlstate 'PT422' then null;end;
 begin perform public.special_event_stop_set('qa-save-a',owner,'two','note','null','""');raise exception 'Invalid note accepted';exception when sqlstate 'PT422' then null;end;
 begin perform public.special_event_stop_set('main',owner,'one','note','"No"','""');raise exception 'Main scope accepted';exception when sqlstate 'PT410' then null;end;
 begin insert into public.special_event_stop_saves(owner_id,event_id,stop_id) values(owner,'qa-save-a','direct');raise exception 'Direct insert allowed';exception when insufficient_privilege then null;end;
 begin update public.special_event_stop_saves set note='Bypass';raise exception 'Direct update allowed';exception when insufficient_privilege then null;end;
 saved:=public.special_event_stop_set('qa-save-a',owner,'one','favorite','false','true');
 if saved->>'note' is distinct from 'Private note' then raise exception 'Removing Favorite deleted note';end if;
 saved:=public.special_event_stop_set('qa-save-a',owner,'one','note','""','"Private note"');
 if saved->>'note' is distinct from '' then raise exception 'Note could not be cleared';end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('event.qa_other'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.special_event_stop_saves) then raise exception 'Other account read notes';end if;
 if public.special_event_stops_load('qa-save-a',current_setting('event.qa_owner')::uuid)<>'[]'::jsonb then raise exception 'Other account load leaked';end if;
 begin perform public.special_event_stop_set('qa-save-a',current_setting('event.qa_owner')::uuid,'one','note','"Wrong account"','""');raise exception 'Wrong owner accepted';exception when sqlstate 'PT401' then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('event.qa_owner'),'is_anonymous',true)::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.special_event_stop_saves) then raise exception 'Guest read notes';end if;
 begin perform public.special_event_stop_set('qa-save-a',current_setting('event.qa_owner')::uuid,'one','favorite','true','false');raise exception 'Guest save accepted';exception when sqlstate 'PT401' then null;end;
end $$;
reset role;
insert into public.special_event_stop_saves(owner_id,event_id,stop_id)
 select current_setting('event.qa_owner')::uuid,'qa-save-a','limit-'||n from generate_series(1,999) n;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('event.qa_owner'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$begin
 begin perform public.special_event_stop_set('qa-save-a',current_setting('event.qa_owner')::uuid,'over-limit','favorite','true','false');raise exception 'Saved-stop limit bypassed';exception when sqlstate 'PT422' then null;end;
end $$;
reset role;
update public.special_events set closes_at=now()-interval '49 hours' where id='qa-save-a';
set local role authenticated;
do $$begin
 if public.special_event_stops_load('qa-save-a',current_setting('event.qa_owner')::uuid)<>'[]'::jsonb then raise exception 'Expired notes read';end if;
 begin perform public.special_event_stop_set('qa-save-a',current_setting('event.qa_owner')::uuid,'one','note','"Late"','""');raise exception 'Expired save accepted';exception when sqlstate 'PT410' then null;end;
end $$;
reset role;
select public.special_events_cleanup();
do $$begin
 if exists(select 1 from public.special_event_stop_saves where event_id='qa-save-a') then raise exception 'Retired notes survived';end if;
 if (select note from public.special_event_stop_saves where event_id='qa-save-b' and owner_id=current_setting('event.qa_owner')::uuid) is distinct from 'Other event' then raise exception 'Other event was affected';end if;
end $$;
