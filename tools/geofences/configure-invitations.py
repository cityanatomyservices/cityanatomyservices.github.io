#!/usr/bin/env python3
"""Validate and install private invitation storage and activation-only delivery."""
import argparse
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('config',ROOT/'tools/billing/configure.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--functions',action='store_true')
    args=parser.parse_args()
    installed=json.loads(c.query("select to_regclass('geofence_private.invitations') is not null as installed",True))[0]['installed']
    migration=(ROOT/'supabase/migrations/0022_geofence_invitations.sql').read_text(encoding='utf-8')
    existing=(ROOT/'tests/geofences/email.sql').read_text(encoding='utf-8').rsplit('rollback;',1)[0]
    checks=existing+(ROOT/'tests/geofences/invitations.sql').read_text(encoding='utf-8').replace('begin;','',1)
    c.query(checks if installed else migration.rsplit('commit;',1)[0]+checks.replace('begin;','',1))
    print('Invitation ownership, privacy, draft isolation, activation, delivery and retry checks passed; fixtures rolled back.',flush=True)
    if args.apply and not installed:
        c.query(migration);installed=True;print('Migration 0022 applied.',flush=True)
    if args.functions:
        if not installed:raise SystemExit('Apply migration 0022 before deployment.')
        c.cli('functions','deploy','geofences','geofence-send','--remote='+c.PROJECT,'--use-api','--yes')
        print('Management and email worker deployed. Existing billing and email settings preserved.',flush=True)

if __name__=='__main__':main()
