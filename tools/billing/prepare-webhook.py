#!/usr/bin/env python3
"""Create the Austin.chat sandbox webhook and save its secret without displaying it.

Run only after the Supabase billing functions are deployed. Existing endpoints
are reused; this command never enables checkout or changes a live endpoint.
"""
import importlib.util
import json
import os
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('billing_configure', HERE/'configure.py')
configure = importlib.util.module_from_spec(spec)
spec.loader.exec_module(configure)
STRIPE = Path(os.environ.get('LOCALAPPDATA', ''))/'Programs/StripeCLI/stripe.exe'
URL = f'https://{configure.PROJECT}.supabase.co/functions/v1/stripe-webhook'
EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded',
          'checkout.session.async_payment_failed', 'customer.subscription.created',
          'customer.subscription.updated', 'customer.subscription.deleted',
          'customer.subscription.paused', 'customer.subscription.resumed',
          'invoice.paid', 'invoice.payment_failed', 'invoice.marked_uncollectible',
          'invoice.voided', 'customer.deleted']


def stripe(*args):
    result = subprocess.run([str(STRIPE), *args], capture_output=True, text=True, encoding='utf-8', timeout=60)
    if result.returncode:
        raise SystemExit('Stripe setup failed. No response bodies or credentials were printed.')
    try:
        value = json.loads(result.stdout)
    except ValueError:
        raise SystemExit('Stripe returned an unexpected response; no credentials printed.') from None
    if isinstance(value, dict) and value.get('error'):
        raise SystemExit('Stripe rejected the request; no credentials printed.')
    return value


def main():
    if not configure.is_installed():
        raise SystemExit('Deploy the billing backend first.')
    current = stripe('whoami', '--format', 'json')
    context = stripe('switch', current['account_id'], '--format', 'json')
    if context.get('account_id') != current['account_id'] or context.get('mode') != 'test':
        raise SystemExit('Expected the authorized test-mode account.')
    price = stripe('prices', 'retrieve', 'price_1UYCoYPylm4UechMfDQJur0b', '--stripe-version=2026-10-28.endive')
    if price.get('livemode') is not False or price.get('unit_amount') != 800 or price.get('currency') != 'usd':
        raise SystemExit('Expected the Austin.chat test price in this account.')
    endpoints = stripe('webhook_endpoints', 'list', '--limit=100', '--stripe-version=2026-10-28.endive')
    if endpoints.get('has_more'):
        raise SystemExit('Additional endpoints need inspection before creating one.')
    existing = [item for item in endpoints['data'] if item['url'] == URL]
    if existing:
        print(json.dumps({'endpoint': existing[0]['id'], 'status': existing[0]['status'],
                          'reused': True, 'note': 'Existing signing secret was left unchanged.'}))
        return
    portal = stripe('billing_portal', 'configurations', 'retrieve', 'bpc_1UYDFWPylm4UechMi7mK5NgH', '--stripe-version=2026-10-28.endive')
    if portal.get('livemode') is not False or portal.get('metadata', {}).get('site') != 'austin.chat':
        raise SystemExit('Unexpected test portal configuration.')
    params = ['webhook_endpoints', 'create', '--url='+URL,
              '--api-version=2026-10-28.endive', '--stripe-version=2026-10-28.endive',
              '--description=Austin.chat membership updates (test)',
              '-d', 'metadata[site]=austin.chat', '--idempotency=austin-chat-webhook-test-v1']
    params += ['--enabled-events='+event for event in EVENTS]
    created = stripe(*params)
    if created.get('livemode') is not False or not created.get('secret', '').startswith('whsec_'):
        raise SystemExit('Unexpected webhook response; no credentials printed.')
    # Keep delivery paused until the runtime key is installed and verified.
    stripe('webhook_endpoints', 'update', created['id'], '-d', 'disabled=true', '--stripe-version=2026-10-28.endive')
    configure.store_secrets({'AUSTIN_STRIPE_WEBHOOK_SECRET': created['secret'],
                             'AUSTIN_STRIPE_PORTAL': portal['id'], 'BILLING_MODE': 'test',
                             'BILLING_CHECKOUT_ENABLED': 'false'})
    print(json.dumps({'endpoint': created['id'], 'status': 'disabled', 'mode': 'test',
                      'portal': portal['id'], 'signingSecretStored': True, 'checkoutEnabled': False}))


if __name__ == '__main__':
    main()
