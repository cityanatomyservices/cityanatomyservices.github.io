#!/usr/bin/env python3
"""Prepare Austin.chat billing; checkout remains disabled until launch checks pass.

Uses Supabase CLI's existing login. Secrets are entered privately and passed in
a temporary file outside the repository, removed immediately after upload.
Neither CLI responses nor credentials are echoed on failure.
"""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PROJECT = 'aqbyxpiwugcvoephsvpm'


def cli(*args):
    npx = shutil.which('npx.cmd' if os.name == 'nt' else 'npx')
    if not npx:
        raise SystemExit('Install Node.js to run the Supabase setup helper.')
    result = subprocess.run([npx, '--yes', 'supabase@3.0.0', *args,
                             '--agent', 'no', '--output-format', 'text'],
                            cwd=ROOT, capture_output=True, text=True, encoding='utf-8', timeout=180)
    if result.returncode:
        raise SystemExit('Supabase request failed. Check CLI sign-in and project access. No credentials were printed.')
    return result.stdout


def query(sql, read_only=False):
    # Only migration/fixture SQL, never credentials, goes into this temporary file.
    handle, filename = tempfile.mkstemp(prefix='austin-billing-', suffix='.sql')
    try:
        with os.fdopen(handle, 'w', encoding='utf-8') as out:
            out.write(sql)
        return cli('db', 'query', '--remote='+PROJECT, '--file', filename,
                   *(['--read-only'] if read_only else ['--yes']), '--output', 'json')
    finally:
        Path(filename).unlink(missing_ok=True)


def is_installed():
    result = json.loads(query("select to_regclass('billing_private.members') is not null as billing_installed", True))
    def values(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key == 'billing_installed':
                    yield item
                else:
                    yield from values(item)
        elif isinstance(value, list):
            for item in value:
                yield from values(item)
    found = list(values(result))
    if len(found) != 1 or not isinstance(found[0], bool):
        raise SystemExit('Could not confirm database state; no changes made.')
    return found[0]


def store_secrets(settings):
    # No secret on the process command line, in console output, or in source control.
    handle, filename = tempfile.mkstemp(prefix='austin-billing-private-', suffix='.env')
    try:
        with os.fdopen(handle, 'w', encoding='utf-8') as out:
            for name, value in settings.items():
                if not re.fullmatch(r'[A-Za-z0-9_,.-]+', value):
                    raise SystemExit('Unexpected secret format; nothing uploaded.')
                out.write(f'{name}={value}\n')
        cli('secrets', 'set', '--remote='+PROJECT, '--env-file', filename, '--yes')
    finally:
        Path(filename).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--deploy', action='store_true')
    parser.add_argument('--connect', choices=['test', 'live'], help='Store billing credentials privately, keeping checkout disabled')
    args = parser.parse_args()
    installed = is_installed()
    if args.deploy:
        checks = (ROOT/'tests/billing/database.sql').read_text(encoding='utf-8')
        migration = (ROOT/'supabase/migrations/0012_billing.sql').read_text(encoding='utf-8')
        if not installed:
            query(migration.rsplit('commit;', 1)[0]+checks.replace('begin;', '', 1))
            print('Database permissions, account isolation and lease checks passed; fixtures rolled back.')
            query(migration)
            installed = True
        else:
            query(checks)
            print('Existing billing database passed checks; fixtures rolled back.')
        cli('functions', 'deploy', 'billing', 'stripe-webhook', '--remote='+PROJECT, '--use-api', '--yes')
        print('Billing functions deployed. Existing activation settings were preserved.')
    if args.connect:
        if not installed:
            raise SystemExit('Deploy the billing database before connecting Stripe.')
        mode = args.connect
        key = getpass.getpass(f'Stripe {mode} restricted API key (hidden): ').strip()
        signing = getpass.getpass('Stripe webhook signing secret (hidden): ').strip()
        portal = input('Austin.chat billing portal configuration ID: ').strip()
        if not key.startswith('rk_'+mode+'_') or not signing.startswith('whsec_') or not portal.startswith('bpc_'):
            raise SystemExit('Key, webhook or portal format did not match; nothing uploaded.')
        prefix = 'AUSTIN_STRIPE_LIVE_' if mode == 'live' else 'AUSTIN_STRIPE_'
        settings = {prefix+'KEY': key, prefix+'WEBHOOK_SECRET': signing,
                    prefix+'PORTAL': portal, 'BILLING_MODE': mode, 'BILLING_CHECKOUT_ENABLED': 'false'}
        if mode == 'test':
            owners = input('Confirmed Supabase test account IDs (comma-separated UUIDs): ').strip()
            if not owners or any(not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', item.strip()) for item in owners.split(',')):
                raise SystemExit('Valid test account IDs required; nothing uploaded.')
            settings['BILLING_TEST_USERS'] = ','.join(item.strip() for item in owners.split(','))
        store_secrets(settings)
        print('Stripe credentials stored in Supabase. Checkout is still disabled.')
    print('Billing database: '+('installed' if installed else 'not installed'))


if __name__ == '__main__':
    try:
        main()
    except subprocess.TimeoutExpired:
        raise SystemExit('Supabase request timed out. Check connection and retry; no credentials printed.') from None
