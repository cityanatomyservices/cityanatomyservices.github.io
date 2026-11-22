#!/usr/bin/env python3
"""Prepare, inspect or toggle temporary free access without changing Stripe secrets.

--prepare validates/applies migration 0019. --deploy updates billing functions.
--enable/--disable control free activation and access together; disabling creates
no charges or subscriptions. Existing paid billing and Substack records remain.
"""
import argparse,importlib.util,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('config',ROOT/'tools/billing/configure.py');config=importlib.util.module_from_spec(spec);spec.loader.exec_module(config)

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--prepare',action='store_true');p.add_argument('--deploy',action='store_true');group=p.add_mutually_exclusive_group();group.add_argument('--enable',action='store_true');group.add_argument('--disable',action='store_true')
 group.add_argument('--enable-visitors',action='store_true',help='Open visitor features with an individual guest identity and free Pro/geofences.')
 group.add_argument('--disable-visitors',action='store_true',help='Restore registered-only visitor features and keep current free-testing prices.')
 args=p.parse_args()
 installed=json.loads(config.query("select to_regclass('billing_private.testing_settings') is not null as installed",True))[0]['installed']
 if args.prepare:
  migration=(ROOT/'supabase/migrations/0019_temporary_testing_billing.sql').read_text(encoding='utf-8');checks=(ROOT/'tests/billing/free-testing.sql').read_text(encoding='utf-8')
  config.query(checks if installed else migration.rsplit('commit;',1)[0]+checks.replace('begin;','',1))
  print('Ownership, free activation, no billing writes, GPS gates and disable/re-enable checks passed; fixtures rolled back.',flush=True)
  if not installed:config.query(migration);installed=True;print('Migration 0019 applied with free testing OFF.',flush=True)
 if not installed:raise SystemExit('Prepare migration 0019 first.')
 if args.deploy:
  config.cli('functions','deploy','billing','stripe-webhook','geofences','geofence-webhook','pro-app','--remote='+config.PROJECT,'--use-api','--yes');print('Functions deployed; Stripe settings preserved.',flush=True)
 if args.enable_visitors:
  print(config.query("update billing_private.testing_settings set visitors_enabled=true,pro_enabled=true,geofences_enabled=true where singleton returning visitors_enabled,pro_enabled,geofences_enabled"))
 elif args.disable_visitors or args.disable:
  paid=",pro_enabled=false,geofences_enabled=false" if args.disable else ""
  print(config.query("update billing_private.testing_settings set visitors_enabled=false"+paid+" where singleton returning visitors_enabled,pro_enabled,geofences_enabled"))
 elif args.enable:
  value='true' if args.enable else 'false'
  print(config.query(f'select public.access_testing_set({value},{value}) as settings'))
 else:print(config.query("select jsonb_build_object('visitorsEnabled',visitors_enabled,'proEnabled',pro_enabled,'geofencesEnabled',geofences_enabled) as settings from billing_private.testing_settings where singleton"))
if __name__=='__main__':main()
