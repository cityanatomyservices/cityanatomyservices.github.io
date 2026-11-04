#!/usr/bin/env python3
"""Stage the live Austin.chat portal/webhook; never enable payment collection.

The authorized Stripe CLI performs configuration. Signing secrets go directly
to Supabase. This leaves the working test key and active test runtime intact.
"""
import importlib.util
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('sandbox_setup',HERE/'prepare-webhook.py')
setup=importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


def main():
    original=setup.stripe('whoami','--format','json')
    current=setup.stripe('switch',original['account_id'],'--live','--format','json')
    if current.get('mode')!='live': raise SystemExit('Expected authorized live mode.')
    def api(*args):
        return setup.stripe(*args,'--stripe-version=2026-10-28.endive','--live','--confirm')
    try:
        price=api('prices','retrieve','price_1UYCyLPylm4UechMwGuCKwdH')
        if price.get('livemode') is not True or price.get('unit_amount')!=800 or price.get('currency')!='usd':
            raise SystemExit('Expected the Austin.chat live price.')
        endpoints=api('webhook_endpoints','list','--limit=100')
        if endpoints.get('has_more'): raise SystemExit('Inspect remaining endpoints before creating another.')
        existing=[item for item in endpoints['data'] if item['url']==setup.URL]
        if existing:
            print(json.dumps({'endpoint':existing[0]['id'],'status':existing[0]['status'],'reused':True,'signingSecretUnchanged':True}))
            return
        configs=api('billing_portal','configurations','list','--limit=100')
        if configs.get('has_more'): raise SystemExit('Inspect remaining portal configurations first.')
        matches=[p for p in configs['data'] if p.get('metadata',{}).get('site')=='austin.chat' and p.get('active')]
        if matches:
            portal=matches[0]
        else:
            data={'name':'Austin.chat Pro','metadata[site]':'austin.chat',
                  'business_profile[headline]':'Manage your Austin.chat membership',
                  'default_return_url':'https://austin.chat/?billing=return',
                  'features[invoice_history][enabled]':'true','features[payment_method_update][enabled]':'true',
                  'features[subscription_cancel][enabled]':'true','features[subscription_cancel][mode]':'at_period_end',
                  'features[subscription_cancel][proration_behavior]':'none','features[subscription_update][enabled]':'false',
                  'features[customer_update][enabled]':'false'}
            args=['billing_portal','configurations','create','--idempotency=austin-chat-portal-live-v1']
            for key,value in data.items(): args.extend(['-d',key+'='+value])
            portal=api(*args)
        params=['webhook_endpoints','create','--url='+setup.URL,'--api-version=2026-10-28.endive',
                '--description=Austin.chat membership updates (live)','-d','metadata[site]=austin.chat',
                '--idempotency=austin-chat-webhook-live-v1']
        params+=['--enabled-events='+event for event in setup.EVENTS]
        created=api(*params)
        if created.get('livemode') is not True or not created.get('secret','').startswith('whsec_'):
            raise SystemExit('Unexpected webhook response; no credentials printed.')
        api('webhook_endpoints','update',created['id'],'-d','disabled=true')
        setup.configure.store_secrets({'AUSTIN_STRIPE_LIVE_WEBHOOK_SECRET':created['secret'],
                                       'AUSTIN_STRIPE_LIVE_PORTAL':portal['id']})
        print(json.dumps({'endpoint':created['id'],'status':'disabled','portal':portal['id'],
                          'portalIsDefault':portal['is_default'],'signingSecretStored':True,'activeRuntimeUnchanged':True}))
    finally:
        setup.stripe('switch',original['account_id'],*(['--live'] if original['mode']=='live' else []),'--format','json')


if __name__=='__main__':
    main()
