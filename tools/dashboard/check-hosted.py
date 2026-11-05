#!/usr/bin/env python3
"""Manual API check with disposable accounts; no emails or Stripe objects."""
import importlib.util
import json
from pathlib import Path
import secrets
import uuid

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('billing_check', ROOT / 'tools/billing/check-sandbox.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    keys = json.loads(check.configure.cli('projects', 'api-keys', '--remote=' + check.configure.PROJECT, '--reveal', '--output', 'json'))
    admin = next(row['api_key'] for row in keys if row.get('name') == 'service_role')
    users = []

    def rpc(name, body, token=None):
        return check.http('/rest/v1/rpc/' + name, body, token=token)

    try:
        for _ in range(2):
            email = 'dashboard-qa-' + uuid.uuid4().hex + '@example.invalid'
            password = secrets.token_urlsafe(36)
            status, user = check.http('/auth/v1/admin/users', {'email': email, 'password': password,
                'email_confirm': True, 'app_metadata': {'dashboard_test_fixture': True}}, admin=admin)
            assert status == 200, 'Disposable account creation failed'
            users.append({'id': user['id'], 'email': email})
            status, auth = check.http('/auth/v1/token?grant_type=password', {'email': email, 'password': password})
            assert status == 200
            users[-1]['token'] = auth['access_token']
        owner, member = users
        assert rpc('dashboard_catalog', {})[0] >= 400
        assert rpc('dashboard_catalog', {}, member['token'])[0] == 403
        assert rpc('dashboard_substack_grant', {'p_email': member['email'], 'p_plan': 'annual',
            'p_until': '2099-01-01T00:00:00Z'}, member['token'])[0] == 403
        check.configure.query("insert into dashboard_private.admins(owner_id,verified_email) values('" + owner['id'] + "','" + owner['email'] + "')")
        status, catalog = rpc('dashboard_catalog', {}, owner['token'])
        assert status == 200 and len(catalog) >= 18
        status, result = rpc('dashboard_query', {'p_report': 'members', 'p_search': member['id']}, owner['token'])
        assert status == 200 and len(result['rows']) == 1
        assert 'encrypted_password' not in result['rows'][0]
        print('Hosted dashboard: guests and ordinary members denied; authorized reports succeed.', flush=True)

        import datetime
        until = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)).isoformat()
        status, _ = rpc('dashboard_substack_grant', {'p_email': member['email'], 'p_plan': 'annual', 'p_until': until}, owner['token'])
        assert status == 200
        status, membership = rpc('membership_read', {}, member['token'])
        assert status == 200 and membership['plan'] == 'pro' and membership['source'] == 'substack'
        status, _ = check.http('/functions/v1/billing', {'action': 'checkout'}, token=member['token'])
        assert status == 409, 'Active Substack access must reject duplicate site checkout'
        manifest = json.loads((ROOT / 'billing/pro-assets.json').read_text())
        import urllib.request, urllib.error
        entry = next(iter(manifest['files']))

        def private_status():
            req = urllib.request.Request(check.BASE + '/functions/v1/pro-app', data=json.dumps({'path': entry}).encode(),
                headers={'apikey': check.PUBLIC, 'Authorization': 'Bearer ' + member['token'], 'Content-Type': 'application/json'})
            try:
                with urllib.request.urlopen(req, timeout=30) as response:
                    response.read()
                    return response.status
            except urllib.error.HTTPError as error:
                return error.code

        assert private_status() == 200
        status, _ = rpc('dashboard_substack_revoke', {'p_email': member['email']}, owner['token'])
        assert status in (200, 204)
        assert rpc('membership_read', {}, member['token'])[1]['plan'] == 'free'
        assert private_status() == 403
        check.configure.query("delete from dashboard_private.admins where owner_id='" + owner['id'] + "'")
        assert rpc('dashboard_catalog', {}, owner['token'])[0] == 403
        print('Hosted Substack grant unlocks private apps, blocks duplicate checkout, and revokes correctly. Admin revocation also takes effect immediately.', flush=True)
    finally:
        for user in reversed(users):
            check.configure.query("delete from billing_private.members where owner_id='" + user['id'] + "'")
            status, _ = check.http('/auth/v1/admin/users/' + user['id'], admin=admin, method='DELETE')
            assert status == 200, 'Fixture cleanup failed'
        print('Disposable accounts and all grants removed. No email, charge, subscription or Stripe customer created.', flush=True)


if __name__ == '__main__':
    main()
