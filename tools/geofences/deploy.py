#!/usr/bin/env python3
"""Validate/apply custom-geofence storage and deploy functions; never enable charging."""
import argparse,importlib.util,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('billing_configure',ROOT/'tools/billing/configure.py');config=importlib.util.module_from_spec(spec);spec.loader.exec_module(config)
def main():
 p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');p.add_argument('--functions',action='store_true');args=p.parse_args()
 installed=json.loads(config.query("select to_regclass('geofence_private.spaces') is not null as installed",True))[0]['installed']
 migration=(ROOT/'supabase/migrations/0018_custom_geofences.sql').read_text();checks=(ROOT/'tests/geofences/database.sql').read_text()
 config.query(checks if installed else migration.rsplit('commit;',1)[0]+checks.replace('begin;','',1))
 print('Geofence database ownership, payment isolation, leases, geometry, GPS and ephemeral chat checks passed; fixtures rolled back.',flush=True)
 if args.apply and not installed:config.query(migration);print('Migration 0018 applied.',flush=True)
 if args.functions:
  if not(installed or args.apply):raise SystemExit('Apply migration first.')
  config.cli('functions','deploy','geofences','geofence-webhook','--remote='+config.PROJECT,'--use-api','--yes');print('Geofence functions deployed; existing payment settings unchanged.',flush=True)
if __name__=='__main__':main()
