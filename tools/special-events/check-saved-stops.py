#!/usr/bin/env python3
"""Check event notebooks and RLS in a rolled-back transaction; no user exports."""
import argparse
import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('configure',ROOT/'tools/billing/configure.py')
configure=importlib.util.module_from_spec(spec);spec.loader.exec_module(configure)
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--migrate',action='store_true');args=parser.parse_args()
sql='begin;\n'
if args.migrate:
    migration=(ROOT/'supabase/migrations/0017_special_event_stop_saves.sql').read_text()
    sql+=migration.replace('begin;','',1).rsplit('commit;',1)[0]
sql+=(ROOT/'tests/special-events/saved-stops.sql').read_text()+'\nrollback;'
configure.query(sql)
print('Private stop notes/Favorites, account/event isolation, stale edits, limits and retirement passed; transaction rolled back.')
