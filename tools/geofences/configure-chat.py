#!/usr/bin/env python3
"""Validate and apply geofence chat names and conversation retention."""
import argparse
import importlib.util
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('config',ROOT/'tools/billing/configure.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    installed=json.loads(c.query("select to_regclass('geofence_private.conversations') is not null as installed",True))[0]['installed']
    migration=(ROOT/'supabase/migrations/0023_geofence_chat_sessions.sql').read_text(encoding='utf-8')
    checks=(ROOT/'tests/geofences/chat-sessions.sql').read_text(encoding='utf-8')
    c.query(checks if installed else migration.rsplit('commit;',1)[0]+checks.replace('begin;','',1))
    print('Guest/profile names, message privacy, conversation lifecycle and deletion checks passed; fixtures rolled back.',flush=True)
    if args.apply and not installed:c.query(migration);print('Migration 0023 applied.',flush=True)

if __name__=='__main__':main()
