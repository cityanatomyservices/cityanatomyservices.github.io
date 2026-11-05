#!/usr/bin/env python3
"""Deploy the owner-only reporting dashboard without publishing any account details."""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/billing'))
import configure as billing


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--deploy', action='store_true')
    parser.add_argument('--authorize', action='store_true', help='Prompt for a confirmed owner email')
    args = parser.parse_args()
    installed = json.loads(billing.query("select to_regclass('dashboard_private.admins') is not null as installed", True))[0]['installed']
    if args.deploy:
        migration = (ROOT / 'supabase/migrations/0015_dashboard.sql').read_text(encoding='utf-8')
        checks = (ROOT / 'tests/dashboard/database.sql').read_text(encoding='utf-8')
        if not installed:
            billing.query(migration.rsplit('commit;', 1)[0] + checks.replace('begin;', '', 1))
            print('Dashboard permission, query and pagination preflight passed; fixtures rolled back.')
            billing.query(migration)
            installed = True
        billing.query(checks)
        print('Dashboard database checks passed; fixtures rolled back.')
    if args.authorize:
        if not installed:
            raise SystemExit('Deploy the dashboard migration first.')
        email = input('Confirmed owner sign-in email: ').strip().lower()
        if not email or '@' not in email or '\n' in email or '\r' in email:
            raise SystemExit('Invalid email; no authorization changed.')
        quoted = "'" + email.replace("'", "''") + "'"
        billing.query("""do $authorize$ declare member uuid; matches int;begin
          select count(*) into matches from auth.users where lower(btrim(email))=""" + quoted + """
            and not coalesce(is_anonymous,true) and email_confirmed_at is not null;
          if matches<>1 then raise exception 'Exactly one confirmed account must match';end if;
          select id into member from auth.users where lower(btrim(email))=""" + quoted + """
            and not coalesce(is_anonymous,true) and email_confirmed_at is not null;
          insert into dashboard_private.admins(owner_id,verified_email) values(member,""" + quoted + """)
            on conflict(owner_id) do update set verified_email=excluded.verified_email;
          end $authorize$;""")
        print('Confirmed owner authorized. No email or account details saved in source.')


if __name__ == '__main__':
    main()
