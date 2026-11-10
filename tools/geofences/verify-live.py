#!/usr/bin/env python3
"""Verify the deployed live geofence key/catalog without a customer or charge."""
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
    parser.add_argument('--enabled', action='store_true', help='Expect purchases enabled')
    parser.add_argument('--browser', action='store_true', help='Verify published phone form; requires --enabled')
    args = parser.parse_args()
    if args.browser and not args.enabled:
        parser.error('--browser requires --enabled')
    keys = json.loads(check.configure.cli('projects', 'api-keys', '--remote='+check.configure.PROJECT, '--reveal', '--output', 'json'))
    admin = next(row['api_key'] for row in keys if row.get('name') == 'service_role')
    owner, space = None, str(uuid.uuid4())
    try:
        email = 'geofence-qa-'+uuid.uuid4().hex+'@example.invalid'
        password = secrets.token_urlsafe(36)
        status, user = check.http('/auth/v1/admin/users',
            {'email': email, 'password': password, 'email_confirm': True,
             'app_metadata': {'billing_test_fixture': True}}, admin=admin)
        assert status == 200
        owner = user['id']
        status, session = check.http('/auth/v1/token?grant_type=password', {'email': email, 'password': password})
        assert status == 200

        def api(body):
            return check.http('/functions/v1/geofences', body, session['access_token'])

        status, result = api({'action': 'list'})
        assert status == 200 and result['checkoutEnabled'] is args.enabled
        fields = {'name': 'Disposable live configuration check', 'description': '',
            'latitude': 30.2672, 'longitude': -97.7431, 'diameter': 50}
        assert api({'action': 'save', 'id': space, 'fields': fields})[0] == 200
        # An empty billing row lets status() run the real Stripe price/portal
        # reads using the deployed restricted key, without creating a customer.
        status, row = check.http('/rest/v1/rpc/geofence_billing_claim',
            {'p_mode': 'live', 'p_id': space, 'p_owner': owner}, admin=admin)
        assert status == 200 and row['customer_id'] is None
        status, _ = check.http('/rest/v1/rpc/geofence_billing_release',
            {'p_mode': 'live', 'p_id': space, 'p_lease': row['lease_id']}, admin=admin)
        assert status in (200, 204), 'Could not release verification lease'
        status, current = api({'action': 'status', 'id': space})
        assert status == 200 and current['status'] == 'none' and current['paidUntil'] is None, 'Live restricted key/catalog check failed'
        assert check.http('/rest/v1/rpc/geofence_read', {'p_id': space}) == (200, None)
        assert check.http('/functions/v1/geofence-webhook', {'id': 'unsigned'})[0] == 400
        if not args.enabled:
            assert api({'action': 'checkout', 'id': space})[0] == 503
        print('Deployed live key reads the $10/month price and cancellation portal; unsigned webhooks rejected; unpaid map stays unavailable. Checkout '+('enabled.' if args.enabled else 'disabled.'), flush=True)
        if args.browser:
            result = subprocess.run(['node', str(ROOT/'tools/geofences/check-live-browser.cjs')],
                input=json.dumps(session), capture_output=True, text=True, timeout=150, cwd=ROOT)
            print(result.stdout[:2000], flush=True)
            if result.returncode:
                raise RuntimeError('Published phone form verification failed; private browser details suppressed')
    finally:
        check.configure.query("delete from geofence_private.spaces where id='"+space+"'::uuid")
        if owner:
            assert check.http('/auth/v1/admin/users/'+owner, admin=admin, method='DELETE')[0] == 200
        print('Temporary draft/billing row/account removed. No live Stripe customer, subscription or charge created.', flush=True)


if __name__ == '__main__':
    main()
