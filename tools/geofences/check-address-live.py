#!/usr/bin/env python3
"""Verify regional address lookup with a disposable account, without creating a circle."""
import argparse
import importlib.util
import json
from pathlib import Path
import secrets
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('billing_check', ROOT/'tools/billing/check-sandbox.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', action='store_true', help='Also verify the published autocomplete')
    args = parser.parse_args()
    keys = json.loads(check.configure.cli('projects', 'api-keys', '--remote='+check.configure.PROJECT, '--reveal', '--output', 'json'))
    admin = next(row['api_key'] for row in keys if row.get('name') == 'service_role')
    owner = None
    try:
        email = 'geofence-address-qa-'+uuid.uuid4().hex+'@example.invalid'
        password = secrets.token_urlsafe(36)
        status, user = check.http('/auth/v1/admin/users',
            {'email': email, 'password': password, 'email_confirm': True,
             'app_metadata': {'billing_test_fixture': True}}, admin=admin)
        assert status == 200, 'Disposable account creation failed'
        owner = user['id']
        status, session = check.http('/auth/v1/token?grant_type=password', {'email': email, 'password': password})
        assert status == 200, 'Disposable account sign-in failed'
        assert check.http('/functions/v1/geofences', {'action': 'suggest', 'address': '301 W 2'})[0] == 401
        examples = [
            ('301 W 2nd Austin', 'Travis'),
            ('200 E Main Round Rock', 'Williamson'),
            ('630 E Hopkins San Marcos', 'Hays'),
            ('1311 Chestnut Bastrop', 'Bastrop'),
            ('308 W San Antonio Lockhart', 'Caldwell'),
            ('1500 Marilla Dallas TX', None),
            ('301 W Main Llano TX', None),
            ('500 4th Ave NE Austin MN', None),
        ]
        for address, county in examples:
            time.sleep(3.3)
            status, result = check.http('/functions/v1/geofences', {'action': 'suggest', 'address': address}, session['access_token'])
            assert status == 200, 'Suggestion request failed for '+address
            matches = result.get('matches', [])
            assert (bool(matches) if county else not matches), 'Unexpected regional matches for '+address
            if county:
                assert all(m.get('county') == county for m in matches), 'Unexpected county for '+address
            print(('Included '+county if county else 'Excluded '+address)+': passed', flush=True)
        time.sleep(3.3)
        status, result = check.http('/functions/v1/geofences', {'action': 'geocode', 'address': '1500 Marilla St Dallas TX'}, session['access_token'])
        assert status == 200 and result.get('matches') == [], 'Full-address fallback admitted Dallas'
        print('Authenticated deployed suggestions and county-filtered full-address fallback: passed', flush=True)
        if args.browser:
            time.sleep(3.3)
            result = subprocess.run(['node', str(ROOT/'tools/geofences/check-address-browser.cjs')],
                input=json.dumps(session), capture_output=True, text=True, encoding='utf-8', timeout=180, cwd=ROOT)
            print(result.stdout[:2000], flush=True)
            if result.returncode:
                raise RuntimeError('Published autocomplete verification failed; private session details suppressed')
    finally:
        if owner:
            assert check.http('/auth/v1/admin/users/'+owner, admin=admin, method='DELETE')[0] == 200, 'Disposable account cleanup failed'
        print('Temporary account removed. No circles, payments or email created.', flush=True)


if __name__ == '__main__':
    main()
