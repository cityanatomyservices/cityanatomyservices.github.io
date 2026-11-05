#!/usr/bin/env python3
"""Private owner tools for the manual Austin.chat/Substack membership bundle.

Uses the existing Supabase CLI login. No Stripe objects, Substack subscriptions
or emails are created. Subscriber details are written only outside Git repos.
"""
import argparse
import csv
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess

import configure

ROOT = configure.ROOT
REPORT_SQL = """
select u.email as site_email, s.verified_email as verified_substack_email,
  coalesce(b.status='active' and b.pro_until>now(),false) as site_paid_active,
  b.pro_until as site_paid_through, b.cancel_at_period_end as site_cancel_at_period_end,
  b.status as site_payment_status, b.updated_at as site_billing_last_checked,
  coalesce(s.revoked_at is null and s.pro_until>now() and s.verified_email=lower(btrim(u.email)),false) as substack_site_access_active,
  s.subscription_plan as substack_plan, s.pro_until as substack_verified_through,
  s.verified_at as substack_last_verified, s.revoked_at as substack_revoked_at,
  case when s.owner_id is not null and s.verified_email<>lower(btrim(u.email)) then 'Re-verify changed email'
    when b.status='active' and b.pro_until>now() and s.revoked_at is null and s.pro_until>now() then 'Review possible duplicate billing'
    when b.status='active' and b.pro_until>now() then 'Check included Substack comp'
    when s.revoked_at is null and s.pro_until>now() then 'Substack included site access'
    when s.owner_id is not null then 'Verify Substack renewal before extending'
    else 'Check expiry of site-funded Substack comp' end as review_action
from auth.users u
left join billing_private.members b on b.owner_id=u.id and b.mode='live'
left join billing_private.substack_memberships s on s.owner_id=u.id
where not coalesce(u.is_anonymous,true) and u.email_confirmed_at is not null
  and (b.customer_id is not null or s.owner_id is not null)
order by u.email;
"""
HEADERS = ['site_email', 'verified_substack_email', 'site_paid_active', 'site_paid_through',
           'site_cancel_at_period_end', 'site_payment_status', 'site_billing_last_checked',
           'substack_site_access_active', 'substack_plan', 'substack_verified_through',
           'substack_last_verified', 'substack_revoked_at', 'review_action']


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def email_input():
    value = input('Verified Substack subscriber email (same as site login): ').strip().lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
        raise SystemExit('Enter a complete email address. Nothing changed.')
    return value


def paid_through(value):
    """Require an exact, timezone-aware timestamp; never guess a renewal date."""
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise ValueError('Use an ISO timestamp with a timezone, for example 2026-12-05T18:00:00Z.') from None
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError('The paid-through timestamp must include a timezone.')
    if result <= datetime.now(timezone.utc):
        raise ValueError('The verified paid-through date must be in the future.')
    return result.astimezone(timezone.utc).isoformat()


def report_path(value):
    target = Path(value).expanduser().resolve()
    if target.suffix.lower() != '.csv':
        raise ValueError('Choose a .csv report filename.')
    if target == ROOT or ROOT in target.parents or any((p / '.git').exists() for p in target.parents):
        raise ValueError('Subscriber reports must be saved outside every Git repository.')
    if target.exists():
        raise ValueError('That report already exists. Choose a new filename.')
    return target


def csv_cell(value):
    text = '' if value is None else str(value)
    # Protect spreadsheet viewers from formulas in user-supplied email fields.
    return "'" + text if text.lstrip().startswith(('=', '+', '-', '@')) else text


def write_report(target, rows):
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('x', encoding='utf-8-sig', newline='') as out:
        writer = csv.writer(out)
        writer.writerow(HEADERS)
        for row in rows:
            writer.writerow([csv_cell(row.get(key)) for key in HEADERS])


def installed():
    rows = json.loads(configure.query("select to_regclass('billing_private.substack_memberships') is not null as installed", True))
    return rows[0]['installed'] is True


def deploy():
    migration = (ROOT / 'supabase/migrations/0014_substack_billing.sql').read_text(encoding='utf-8')
    checks = (ROOT / 'tests/billing/substack.sql').read_text(encoding='utf-8')
    if not installed():
        configure.query(migration.rsplit('commit;', 1)[0] + checks.replace('begin;', '', 1))
        print('Substack permissions and membership preflight passed; all fixtures rolled back.')
        configure.query(migration)
    configure.query(checks)
    configure.query((ROOT / 'tests/billing/database.sql').read_text(encoding='utf-8'))
    print('Substack and existing Stripe database checks passed; all fixtures rolled back.')
    configure.cli('functions', 'deploy', 'billing', 'stripe-webhook', '--remote=' + configure.PROJECT, '--use-api', '--yes')
    print('Manual Substack access and duplicate-checkout protection deployed. Billing activation settings preserved.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('deploy', help='Preflight, install the migration and deploy the existing billing functions')
    report = commands.add_parser('report', help='Export a private reconciliation CSV; no accounts are changed')
    report.add_argument('--output', required=True, help='New CSV filename outside every Git repository')
    grant = commands.add_parser('grant', help='Grant or renew site Pro after checking an actual paid Substack subscription')
    grant.add_argument('--plan', choices=['monthly', 'annual', 'founding'], required=True)
    grant.add_argument('--until', required=True, help='Verified paid-through ISO timestamp with timezone')
    commands.add_parser('revoke', help='Remove only the Substack-derived site grant, preserving site-paid access')
    args = parser.parse_args()
    if args.command == 'deploy':
        deploy()
        return
    # Validate export destinations and dates before any remote query.
    target = report_path(args.output) if args.command == 'report' else None
    until = paid_through(args.until) if args.command == 'grant' else None
    if not installed():
        raise SystemExit('Deploy the Substack membership migration first.')
    if args.command == 'report':
        rows = json.loads(configure.query(REPORT_SQL, True))
        write_report(target, rows)
        print(f'Private report saved: {target} ({len(rows)} members). No emails or accounts changed.')
        return
    email = email_input()
    if args.command == 'grant':
        if input('Verified a currently paid monthly, annual or founding Substack subscription and its paid-through date? Type yes: ').strip().lower() != 'yes':
            raise SystemExit('Nothing changed.')
        result = json.loads(configure.query('select public.billing_substack_grant(' + literal(email) + ',' +
                                           literal(args.plan) + ',' + literal(until) + '::timestamptz) as result'))[0]['result']
        print('Included site Pro access granted through ' + until + '. No charge or email was created.')
        if result.get('hasSiteBilling'):
            print('This member also has a site billing account. Review existing subscriptions; none was canceled.')
    else:
        if input('Revoke the Substack-derived site grant for that verified email? Type yes: ').strip().lower() != 'yes':
            raise SystemExit('Nothing changed.')
        configure.query('select public.billing_substack_revoke(' + literal(email) + ')')
        print('Substack-derived access revoked if present. Site-paid access was preserved.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        if isinstance(error, ValueError):
            raise SystemExit(str(error)) from None
        raise SystemExit('The operation could not finish. Check connection, CLI access and report location. No credentials printed.') from None
