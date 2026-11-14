#!/usr/bin/env python3
"""Validate/apply custom-geofence storage and deploy functions; never enable charging."""
import argparse,importlib.util,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('billing_configure',ROOT/'tools/billing/configure.py');config=importlib.util.module_from_spec(spec);spec.loader.exec_module(config)
def main():
 p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');p.add_argument('--functions',action='store_true');args=p.parse_args()
 installed=json.loads(config.query("select to_regclass('geofence_private.spaces') is not null as installed",True))[0]['installed']
 migration=(ROOT/'supabase/migrations/0018_custom_geofences.sql').read_text(encoding='utf-8');diameter=(ROOT/'supabase/migrations/0021_geofence_diameter.sql').read_text(encoding='utf-8');checks=(ROOT/'tests/geofences/database.sql').read_text(encoding='utf-8')
 expanded=installed and json.loads(config.query("select pg_get_constraintdef(oid) like '%500%' as expanded from pg_constraint where conrelid='geofence_private.spaces'::regclass and conname='spaces_diameter_check'",True))[0]['expanded']
 pending=([migration] if not installed else [])+([diameter] if not expanded else [])
 # Exercise pending schema changes and fixtures in one transaction, then roll back.
 sql='begin;\n'+''.join(m.replace('begin;','',1).rsplit('commit;',1)[0] for m in pending)+checks.replace('begin;','',1)
 config.query(sql)
 print('Geofence database ownership, payment isolation, leases, geometry, GPS and ephemeral chat checks passed; fixtures rolled back.',flush=True)
 if args.apply and not installed:config.query(migration);print('Migration 0018 applied.',flush=True)
 if args.apply and not expanded:config.query(diameter);expanded=True;print('Migration 0021 applied: 10–500 meter diameters.',flush=True)
 if args.functions:
  if not(installed or args.apply):raise SystemExit('Apply migration first.')
  if not expanded:raise SystemExit('Apply the 500-meter diameter migration first.')
  config.cli('functions','deploy','geofences','geofence-webhook','--remote='+config.PROJECT,'--use-api','--yes');print('Geofence functions deployed; existing payment settings unchanged.',flush=True)
if __name__=='__main__':main()
