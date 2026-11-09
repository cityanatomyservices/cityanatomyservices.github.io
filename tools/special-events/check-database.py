#!/usr/bin/env python3
"""Exercise scoped plans/RLS/expiry in rolled-back SQL; --migrate tests the split too."""
import argparse
import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('configure',ROOT/'tools/billing/configure.py')
configure=importlib.util.module_from_spec(spec);spec.loader.exec_module(configure)
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--migrate',action='store_true');args=parser.parse_args()
sql='begin;\n'
if args.migrate:
    sql+='create temporary table event_qa_before as select id,owner_id,source,schedule,plan_day from public.planner_items;\n'
    migration=(ROOT/'supabase/migrations/0016_special_event_plans.sql').read_text()
    sql+=migration.replace('begin;','',1).rsplit('commit;',1)[0]
    sql+='''do $$begin
      if exists(select * from event_qa_before except select id,owner_id,source,schedule,plan_day from public.planner_items)
        or (select count(*) from event_qa_before)<>(select count(*) from public.planner_items) then raise exception 'Migration changed existing visit data';end if;
      if exists(select 1 from public.planner_items i join public.planner_plans p on p.id=i.plan_id where p.scope<>public.planner_source_scope(i.source)) then raise exception 'Mixed plans survived';end if;
    end $$;\n'''
sql+=(ROOT/'tests/special-events/database.sql').read_text()+'\nrollback;'
configure.query(sql)
print('Database isolation, migration preservation, RLS, revision and expiry checks passed; transaction rolled back.' if args.migrate else 'Database isolation, RLS, revision and expiry checks passed; transaction rolled back.')
