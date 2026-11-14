#!/usr/bin/env python3
"""Validate scheduled chat access and the public map; optionally apply/deploy."""
import argparse
import importlib.util
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('config',ROOT/'tools/billing/configure.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--apply',action='store_true');p.add_argument('--functions',action='store_true');args=p.parse_args()
    installed=json.loads(c.query("select to_regprocedure('public.geofence_map()') is not null as installed",True))[0]['installed']
    migration=(ROOT/'supabase/migrations/0024_geofence_schedule_map.sql').read_text(encoding='utf-8')
    checks=(ROOT/'tests/geofences/schedule.sql').read_text(encoding='utf-8')
    c.query(checks if installed else migration.rsplit('commit;',1)[0]+checks.replace('begin;','',1))
    print('Schedule boundaries, ownership, active-map privacy, invitations and billing isolation passed; fixtures rolled back.',flush=True)
    if args.apply and not installed:c.query(migration);installed=True;print('Migration 0024 applied.',flush=True)
    if args.functions:
        if not installed:raise SystemExit('Apply migration 0024 before deployment.')
        c.cli('functions','deploy','geofences','geofence-send','--remote='+c.PROJECT,'--use-api','--yes')
        print('Geofence management and email sender deployed; billing and email settings unchanged.',flush=True)
if __name__=='__main__':main()
