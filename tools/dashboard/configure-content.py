"""Install private editorial-list storage; preflight and checks roll back their fixtures."""
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/billing'))
import configure as billing
checks=(ROOT/'tests/dashboard/content.sql').read_text(encoding='utf-8')
installed=json.loads(billing.query("select to_regclass('dashboard_private.content_lists') is not null as installed",True))[0]['installed']
migration=(ROOT/'supabase/migrations/0025_content_desk.sql').read_text(encoding='utf-8')
# Existing lists are retained while routine definitions and grants are refreshed.
deployment=migration if not installed else 'begin;\n'+migration[migration.index('create or replace function'):]
billing.query(deployment.rsplit('commit;',1)[0]+checks.replace('begin;','',1))
print('Content-desk authorization, revisions and isolation preflight passed; fixtures rolled back.',flush=True)
billing.query(deployment)
print('Private content-list storage installed and verified; no owner lists were changed.')
