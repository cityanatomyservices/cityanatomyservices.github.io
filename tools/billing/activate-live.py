#!/usr/bin/env python3
"""Enable the prepared $5 subscription after hosted-app checks pass.

Manual launch command, never CI. No customers, purchases or charges are created.
Checks the published private-file exclusions, Stripe price/account/webhook, then
switches this integration's endpoints and enables checkout. Retains test keys.
"""
import concurrent.futures,importlib.util,json,urllib.error,urllib.request
from pathlib import Path
spec=importlib.util.spec_from_file_location('setup',Path(__file__).with_name('prepare-webhook.py'))
setup=importlib.util.module_from_spec(spec);spec.loader.exec_module(setup)
LIVE_WEBHOOK='we_1UYDmVPylm4UechMuIWp8adD'
TEST_WEBHOOK='we_1UYDGcPylm4UechMvq87q7Al'

def main():
    manifest=json.loads((setup.configure.ROOT/'billing/pro-assets.json').read_text(encoding='utf-8'))
    with urllib.request.urlopen('https://austin.chat/billing/pro-assets.json',timeout=30) as response:published=json.load(response)
    assert published['release']==manifest['release'],'Private release does not match the published site'
    def missing(path):
        try:
            with urllib.request.urlopen('https://austin.chat'+path,timeout=30):return False
        except urllib.error.HTTPError as error:return error.code==404
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        assert all(pool.map(missing,manifest['files'])),'A private resource is still publicly hosted'
    print('Published site excludes all 45 private app resources.',flush=True)
    original=setup.stripe('whoami','--format','json');activated=False
    try:
        setup.stripe('switch',original['account_id'],'--live','--format','json')
        def live(*args):return setup.stripe(*args,'--live','--confirm','--stripe-version=2026-10-28.endive')
        account=live('accounts','retrieve')
        assert account['id']==original['account_id'] and account.get('charges_enabled'),'Stripe account is not ready for live charges'
        price=live('prices','retrieve','price_1UbJdfPylm4UechMB1GxVKGy')
        assert price['active'] and price['livemode'] and price['unit_amount']==500 and price['currency']=='usd' and price['recurring']['interval']=='month' and price['recurring']['interval_count']==1
        endpoint=live('webhook_endpoints','retrieve',LIVE_WEBHOOK)
        assert endpoint['url']==setup.URL and endpoint['livemode'] and endpoint['api_version']=='2026-10-28.endive' and set(setup.EVENTS)<=set(endpoint['enabled_events'])
        live('webhook_endpoints','update',LIVE_WEBHOOK,'-d','disabled=false')
        setup.stripe('switch',original['account_id'],'--format','json')
        setup.stripe('webhook_endpoints','update',TEST_WEBHOOK,'-d','disabled=true','--confirm')
        setup.configure.store_secrets({'BILLING_MODE':'live','BILLING_CHECKOUT_ENABLED':'true','BILLING_TEST_USERS':'none'})
        activated=True
        print('Live $5/month checkout enabled; live webhook enabled; sandbox webhook disabled. No purchase or charge made.',flush=True)
    finally:
        if not activated:setup.configure.store_secrets({'BILLING_CHECKOUT_ENABLED':'false'})
        setup.stripe('switch',original['account_id'],*(['--live'] if original['mode']=='live' else []),'--format','json')

if __name__=='__main__':main()
