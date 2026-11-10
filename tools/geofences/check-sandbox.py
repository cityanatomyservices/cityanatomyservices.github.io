#!/usr/bin/env python3
"""Run real Stripe test Checkout through isolated, disposable Edge functions.

Uses the deployed restricted test key, separate QA settings, an allowlisted
disposable Auth user and test-only billing rows. Never changes production
functions/settings or copies a CLI credential into the deployment.
"""
import importlib.util
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('billing_check', ROOT/'tools/billing/check-sandbox.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)
config = check.configure
API = '2026-10-28.endive'
ACCOUNT = 'acct_1UFxBXPylm4UechM'
FUNCTION = 'geofences-qa'
HOOK = 'geofence-webhook-qa'
PREFIX = 'GEOFENCE_QA_'


def main():
    executable = os.environ.get('STRIPE_CLI') or shutil.which('stripe')
    if not executable:
        raise SystemExit('Sign in to the Stripe CLI first.')
    source = Path(os.environ.get('XDG_CONFIG_HOME', str(Path.home()/'.config')))/'stripe/config.toml'
    if not source.exists():
        raise SystemExit('A local Stripe CLI login is required.')
    with tempfile.TemporaryDirectory(prefix='austin-geofence-qa-') as directory:
        work = Path(directory)
        # An independent CLI context keeps a simultaneous owner login/mode
        # selection from accidentally directing a test mutation to live mode.
        stripe_config = work/'stripe.toml'
        shutil.copyfile(source, stripe_config)
        stripe_config.chmod(0o600)

        def stripe(*parts, context=False):
            args = [executable, '--config', str(stripe_config), *parts]
            if not context:
                args += ['--confirm', '--stripe-version='+API]
            result = subprocess.run(args, capture_output=True, text=True, timeout=90)
            if result.returncode:
                raise RuntimeError('Stripe request failed: '+parts[0]+' (private response suppressed)')
            try:
                value = json.loads(result.stdout[result.stdout.index('{'):])
            except ValueError:
                raise RuntimeError('Stripe did not return JSON (response suppressed)') from None
            if value.get('error'):
                error = value['error']
                raise RuntimeError('Stripe rejected '+parts[0]+': '+str(error.get('code') or error.get('type')))
            if value.get('livemode') is True:
                raise RuntimeError('Unexpected live Stripe object; stopping')
            return value

        stripe('switch', ACCOUNT, '--format', 'json', context=True)
        identity = stripe('whoami', '--format', 'json', context=True)
        assert identity['account_id'] == ACCOUNT and identity['mode'] == 'test'
        before = json.loads(config.cli('secrets', 'list', '--remote='+config.PROJECT, '--output', 'json'))
        before = {row['name']: row.get('digest') for row in before}
        assert not any(name.startswith(PREFIX) for name in before), 'Existing QA settings require cleanup first'
        functions = json.loads(config.cli('functions', 'list', '--remote='+config.PROJECT, '--output', 'json'))
        assert not any(row['slug'] in [FUNCTION, HOOK] for row in functions), 'Existing QA functions require cleanup first'
        keys = json.loads(config.cli('projects', 'api-keys', '--remote='+config.PROJECT, '--reveal', '--output', 'json'))
        admin = next(row['api_key'] for row in keys if row.get('name') == 'service_role')
        owners, customers, deployed, setting_names = [], [], [], []
        webhook = portal = price = product = None
        space = str(uuid.uuid4())
        stage = 'prepare test catalog'

        def api(body, user=0):
            return check.http('/functions/v1/'+FUNCTION, body, owners[user]['token'])

        def row():
            status, data = check.http('/rest/v1/rpc/geofence_billing_load',
                {'p_mode': 'test', 'p_id': space}, admin=admin)
            assert status == 200
            return data

        def wait_for(predicate):
            for _ in range(30):
                data = row()
                if data and predicate(data):
                    return data
                time.sleep(2)
            raise AssertionError('Signed webhook did not update the test billing row')

        try:
            product = stripe('products', 'create', '--name=Austin.chat Geofence QA', '-d', 'metadata[product]=custom_geofence_qa')
            price = stripe('prices', 'create', '--product='+product['id'], '--unit-amount=1000', '--currency=usd', '-d', 'recurring[interval]=month')
            portal = stripe('billing_portal', 'configurations', 'create',
                '-d', 'business_profile[headline]=Geofence QA',
                '-d', 'features[invoice_history][enabled]=true',
                '-d', 'features[payment_method_update][enabled]=true',
                '-d', 'features[subscription_cancel][enabled]=true',
                '-d', 'features[subscription_cancel][mode]=at_period_end',
                '-d', 'features[subscription_update][enabled]=false')
            stage = 'create temporary accounts'
            for _ in range(2):
                email = 'geofence-qa-'+uuid.uuid4().hex+'@example.invalid'
                password = secrets.token_urlsafe(36)
                status, user = check.http('/auth/v1/admin/users',
                    {'email': email, 'password': password, 'email_confirm': True,
                     'app_metadata': {'billing_test_fixture': True}}, admin=admin)
                assert status == 200
                owners.append({'id': user['id'], 'email': email})
                status, session = check.http('/auth/v1/token?grant_type=password', {'email': email, 'password': password})
                assert status == 200
                owners[-1]['token'] = session['access_token']
            stage = 'prepare isolated webhook and Edge functions'
            webhook = stripe('webhook_endpoints', 'create', '--url='+check.BASE+'/functions/v1/'+HOOK,
                '--api-version='+API, '--enabled-events=checkout.session.completed',
                '--enabled-events=customer.subscription.updated', '--enabled-events=customer.subscription.deleted',
                '--enabled-events=invoice.paid', '--enabled-events=invoice.payment_failed')
            settings = {PREFIX+'STRIPE_PRICE': price['id'], PREFIX+'STRIPE_PORTAL': portal['id'],
                PREFIX+'STRIPE_WEBHOOK_SECRET': webhook['secret'], PREFIX+'TEST_USERS': owners[0]['id']}
            setting_names = list(settings)
            config.store_secrets(settings)
            for folder in ['supabase/functions/_shared', 'supabase/functions/geofences',
                           'supabase/functions/stripe-webhook']:
                shutil.copytree(ROOT/folder, work/folder)
            (work/'geofences').mkdir()
            shutil.copyfile(ROOT/'geofences/model.mjs', work/'geofences/model.mjs')
            (work/'supabase/config.toml').write_text('project_id = "austin-geofence-qa"\n'+
                ''.join('\n[functions.'+name+']\nverify_jwt = false\n' for name in [FUNCTION, HOOK]))
            for name, handler in [(FUNCTION, 'geofences'), (HOOK, 'stripe-webhook')]:
                target = work/'supabase/functions'/name
                target.mkdir()
                (target/'index.ts').write_text("import Stripe from 'npm:stripe@23.1.0';\n"
                    "import {runtime} from '../_shared/geofence-runtime.mjs';\n"
                    "import {handler} from '../"+handler+"/handler.mjs';\n"
                    "const env=(name:string)=>name==='GEOFENCE_BILLING_MODE'?'test':"
                    "name==='GEOFENCE_CHECKOUT_ENABLED'?'true':"
                    "Deno.env.get(name.startsWith('GEOFENCE_')?name.replace('GEOFENCE_','GEOFENCE_QA_'):name);\n"
                    "Deno.serve(handler(runtime(env,Stripe)));\n")
                deployed.append(name)
                config.cli('functions', 'deploy', name, '--remote='+config.PROJECT, '--workdir', str(work), '--use-api', '--yes')
            print('Isolated test endpoints deployed; production settings preserved.', flush=True)
            stage = 'verify access and checkout'
            fields = {'name': 'Disposable geofence QA', 'description': 'Removed after verification',
                'latitude': 30.2672, 'longitude': -97.7431, 'diameter': 50}
            assert api({'action': 'list'})[1].get('checkoutEnabled') is True
            assert api({'action': 'list'}, 1)[0] == 403
            assert check.http('/functions/v1/'+FUNCTION, {'action': 'list'})[0] == 401
            assert api({'action': 'save', 'id': space, 'fields': fields})[0] == 200
            status, checkout = api({'action': 'checkout', 'id': space})
            assert status == 200 and checkout.get('url', '').startswith('https://checkout.stripe.com/'), 'Restricted test key could not create Checkout'
            current = row()
            customers.append(current['customer_id'])
            status, again = api({'action': 'checkout', 'id': space})
            assert status == 200 and again['url'] == checkout['url'], 'Checkout retry did not reuse session'
            session = stripe('checkout', 'sessions', 'retrieve', current['checkout_id'])
            assert session['livemode'] is False and session['amount_total'] == 1000 and session['mode'] == 'subscription'
            assert api({'action': 'save', 'id': space, 'fields': fields})[0] == 409
            assert check.http('/functions/v1/'+HOOK, {'id': 'unsigned'})[0] == 400
            print('$10 test Checkout, retry reuse, account gate, locked location and signature checks passed.', flush=True)
            stage = 'complete hosted test Checkout'
            result = subprocess.run(['node', str(ROOT/'tools/billing/checkout-browser.cjs')],
                input=json.dumps({'url': checkout['url'], 'email': owners[0]['email']}),
                capture_output=True, text=True, timeout=180, cwd=ROOT)
            if result.returncode:
                print(result.stdout[:4000], flush=True)
                raise RuntimeError('Hosted test Checkout failed; private details suppressed')
            print('Real hosted Checkout paid with Stripe test card.', flush=True)
            stage = 'verify payment webhook and isolation'
            paid = wait_for(lambda r: r['status'] == 'active' and r['pro_until'])
            assert check.http('/rest/v1/rpc/geofence_read', {'p_id': space}) == (200, None)
            assert check.http('/rest/v1/rpc/membership_read', {}, owners[0]['token'])[1]['plan'] == 'free'
            status, current = api({'action': 'status', 'id': space})
            assert status == 200 and current['status'] == 'active' and current['paidUntil']
            status, manage = api({'action': 'checkout', 'id': space})
            assert status == 200 and manage['url'].startswith('https://billing.stripe.com/')
            print('Signed payment webhook activates test subscription; live geofence and Pro stay inactive; duplicate checkout opens management.', flush=True)
            stage = 'period-end cancellation'
            stripe('subscriptions', 'update', paid['subscription_id'], '-d', 'cancel_at_period_end=true')
            current = wait_for(lambda r: r['cancel_at_period_end'])
            assert current['status'] == 'active' and current['pro_until'] == paid['pro_until']
            stage = 'immediate cancellation webhook'
            stripe('subscriptions', 'cancel', paid['subscription_id'])
            wait_for(lambda r: r['status'] == 'canceled' and not r['pro_until'])
            print('Period-end cancellation retains paid time; cancellation webhook removes entitlement.', flush=True)
        except BaseException:
            print('Sandbox check stopped at: '+stage, flush=True)
            raise
        finally:
            failures = []

            def cleanup(label, fn):
                try:
                    fn()
                except BaseException:
                    failures.append(label)

            if webhook:
                cleanup('test webhook', lambda: stripe('webhook_endpoints', 'delete', webhook['id']))
            for name in deployed:
                cleanup('function '+name, lambda name=name: config.cli('functions', 'delete', name, '--remote='+config.PROJECT, '--yes'))
            # Discover the customer even if checkout failed after creation.
            def find_customer():
                data = row()
                if data and data.get('customer_id') and data['customer_id'] not in customers:
                    customers.append(data['customer_id'])
            cleanup('discover test customer', find_customer)
            for customer in customers:
                cleanup('test customer', lambda customer=customer: stripe('customers', 'delete', customer))
            cleanup('test geofence', lambda: config.query("delete from geofence_private.spaces where id='"+space+"'::uuid"))
            for owner in owners:
                def remove(owner=owner):
                    assert check.http('/auth/v1/admin/users/'+owner['id'], admin=admin, method='DELETE')[0] == 200
                cleanup('test Auth user', remove)
            if setting_names:
                cleanup('QA settings', lambda: config.cli('secrets', 'unset', *setting_names, '--remote='+config.PROJECT, '--yes'))
            if portal:
                cleanup('archive test portal', lambda: stripe('billing_portal', 'configurations', 'update', portal['id'], '-d', 'active=false'))
            if price:
                cleanup('archive test price', lambda: stripe('prices', 'update', price['id'], '-d', 'active=false'))
            if product:
                cleanup('archive test product', lambda: stripe('products', 'update', product['id'], '-d', 'active=false'))
            after = json.loads(config.cli('secrets', 'list', '--remote='+config.PROJECT, '--output', 'json'))
            after = {r['name']: r.get('digest') for r in after}
            if after != before:
                failures.append('production settings differ')
            if failures:
                raise RuntimeError('Cleanup requires attention: '+', '.join(failures))
            print('Temporary endpoints, webhook, users and customers removed; test catalog archived. Production secret digests unchanged.', flush=True)


if __name__ == '__main__':
    main()
