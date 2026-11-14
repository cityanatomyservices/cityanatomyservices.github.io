#!/usr/bin/env python3
"""Check the deployed diameter limits with an unactivated disposable draft."""
import argparse
import importlib.util
import json
from pathlib import Path
import secrets
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('billing_check', ROOT/'tools/billing/check-sandbox.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', action='store_true', help='Verify the published desktop and phone form')
    args = parser.parse_args()
    keys = json.loads(check.configure.cli('projects', 'api-keys', '--remote='+check.configure.PROJECT, '--reveal', '--output', 'json'))
    admin = next(row['api_key'] for row in keys if row.get('name') == 'service_role')
    owner, space = None, str(uuid.uuid4())
    try:
        email = 'geofence-diameter-qa-'+uuid.uuid4().hex+'@example.invalid'
        password = secrets.token_urlsafe(36)
        status, user = check.http('/auth/v1/admin/users',
            {'email': email, 'password': password, 'email_confirm': True,
             'app_metadata': {'billing_test_fixture': True}}, admin=admin)
        assert status == 200, 'Disposable account creation failed'
        owner = str(uuid.UUID(user['id']))
        status, session = check.http('/auth/v1/token?grant_type=password', {'email': email, 'password': password})
        assert status == 200, 'Disposable account sign-in failed'
        fields = {'name': 'Disposable diameter verification', 'description': '', 'latitude': 30.2672, 'longitude': -97.7431}
        for diameter in [10, 100, 101, 500]:
            status, draft = check.http('/functions/v1/geofences', {'action': 'save', 'id': space,
                'fields': {**fields, 'diameter': diameter}}, session['access_token'])
            assert status == 200 and draft.get('diameter') == diameter, 'Draft save failed for diameter '+str(diameter)
        for diameter in [9, 501, 500.5]:
            status, _ = check.http('/functions/v1/geofences', {'action': 'save', 'id': space,
                'fields': {**fields, 'diameter': diameter}}, session['access_token'])
            assert status == 422, 'Invalid diameter accepted: '+str(diameter)
        status, listed = check.http('/functions/v1/geofences', {'action': 'list'}, session['access_token'])
        assert status == 200 and listed['spaces'][0]['diameter'] == 500, 'Saved diameter did not persist'
        assert check.http('/rest/v1/rpc/geofence_read', {'p_id': space}) == (200, None), 'Unactivated draft became public'
        print('Deployed API/database: 10, 100, 101 and 500 meters saved; 9, 501 and fractional values rejected; draft remains private.', flush=True)
        if args.browser:
            result = subprocess.run(['node', str(ROOT/'tools/geofences/check-address-browser.cjs')],
                input=json.dumps(session), capture_output=True, text=True, encoding='utf-8', timeout=180, cwd=ROOT)
            print(result.stdout[:2000], flush=True)
            if result.returncode:
                print(result.stderr[-2000:], flush=True)  # Browser helper emits only its sanitized error message.
                raise RuntimeError('Published diameter form verification failed; private session details suppressed')
    finally:
        if owner:
            check.configure.query("delete from geofence_private.spaces where id='"+space+"'::uuid and owner_id='"+owner+"'::uuid")
            assert check.http('/auth/v1/admin/users/'+owner, admin=admin, method='DELETE')[0] == 200
        print('Disposable draft/account removed. No circle activation, payments or email.', flush=True)


if __name__ == '__main__':
    main()
