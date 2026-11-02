"""Preflight a new classifieds migration with rolled-back fixtures, then install it."""
from pathlib import Path
import argparse
import json
import urllib.request
import urllib.error
ROOT=Path(__file__).resolve().parents[2]
PROJECT='aqbyxpiwugcvoephsvpm'
def query(sql):
    token=(Path.home()/'.supabase/access-token').read_text().strip()
    req=urllib.request.Request('https://api.supabase.com/v1/projects/'+PROJECT+'/database/query',
        data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=60) as response:return json.load(response)
    except urllib.error.HTTPError as error:
        # SQL has no credentials or real account data; only expose the error message.
        try:message=json.loads(error.read()).get('message','Query failed')
        except Exception:message='Query failed'
        raise SystemExit(f'Supabase SQL check failed ({error.code}): {message}') from None
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install',action='store_true')
    args=parser.parse_args()
    if query("select to_regclass('classifieds_private.ads') is not null as installed")[0]['installed']:
        raise SystemExit('Classifieds is already installed. Do not replay the initial migration.')
    migration=(ROOT/'supabase/migrations/0011_classifieds.sql').read_text()
    checks=(ROOT/'tests/classifieds/database.sql').read_text()
    # One transaction: migration + Auth/ads fixtures + rollback. No test ad is published.
    query(migration.rsplit('commit;',1)[0]+checks.replace('begin;','',1))
    print('Database authorization, ownership, limits, revisions, counts and pagination passed; fixtures rolled back.')
    if args.install:
        query(migration)
        print('Classifieds database installed.')
