#!/usr/bin/env python3
"""Exercise deployed billing with temporary Auth users and Stripe test objects.

No real payments or email. Secrets/session URLs stay in memory; fixtures are
removed and checkout disabled in finally. Run manually after connecting the
restricted test key. Never runs as part of ordinary CI.
"""
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.error
import urllib.request
import uuid

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('billing_configure',HERE/'configure.py')
configure=importlib.util.module_from_spec(spec)
spec.loader.exec_module(configure)
ROOT=configure.ROOT
BASE='https://'+configure.PROJECT+'.supabase.co'
PUBLIC='sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN'
STRIPE=Path(os.environ.get('LOCALAPPDATA',''))/'Programs/StripeCLI/stripe.exe'
WEBHOOK='we_1UYDGcPylm4UechMvq87q7Al'


def stripe(*args):
    result=subprocess.run([str(STRIPE),*args],capture_output=True,text=True,encoding='utf-8',timeout=60)
    if result.returncode: raise RuntimeError('Stripe CLI request failed (response suppressed).')
    # Destructive CLI commands prepend an account/mode confirmation banner.
    start=result.stdout.find('{')
    if start<0: raise RuntimeError('Stripe CLI returned no JSON (response suppressed).')
    value=json.loads(result.stdout[start:])
    if isinstance(value,dict) and value.get('error'): raise RuntimeError('Stripe rejected a test request (response suppressed).')
    return value


def http(path,body=None,token=None,admin=None,method=None):
    headers={'Content-Type':'application/json','apikey':admin or PUBLIC}
    if token: headers['Authorization']='Bearer '+token
    elif admin: headers['Authorization']='Bearer '+admin
    req=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method or ('POST' if body is not None else 'GET'))
    try:
        with urllib.request.urlopen(req,timeout=60) as response:
            data=response.read()
            return response.status,json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        try: value=json.load(error)
        except ValueError: value={}
        return error.code,value


def main():
    context=stripe('whoami','--format','json')
    if context.get('mode')!='test': raise SystemExit('Switch Stripe CLI to the authorized sandbox first.')
    price=stripe('prices','retrieve','price_1UYCoYPylm4UechMfDQJur0b','--stripe-version=2026-10-28.endive')
    assert price.get('livemode') is False and price['unit_amount']==800,'Expected test price'
    live=json.loads(configure.query("select exists(select 1 from billing_private.members where mode='live' and customer_id is not null) as has_live_billing",True))
    if live[0]['has_live_billing']: raise SystemExit('Use a separate test deployment after live billing begins.')
    keys=json.loads(configure.cli('projects','api-keys','--remote='+configure.PROJECT,'--reveal','--output','json'))
    admin=next((row['api_key'] for row in keys if row.get('name')=='service_role'),None)
    if not admin: raise SystemExit('Server access is required for disposable test accounts.')
    owners=[];customers=[];stage='create temporary test accounts';browser_success=False
    try:
        for index in range(2):
            email='billing-qa-'+uuid.uuid4().hex+'@example.invalid';password=secrets.token_urlsafe(36)
            status,user=http('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,
              'app_metadata':{'billing_test_fixture':True}},admin=admin)
            assert status==200 and user.get('id'),'Could not create disposable test account'
            owners.append({'id':user['id'],'email':email})
            status,auth=http('/auth/v1/token?grant_type=password',{'email':email,'password':password})
            assert status==200 and auth.get('access_token'),'Could not sign in test account'
            owners[-1]['token']=auth['access_token']
        stage='configure test allowlist'
        configure.store_secrets({'BILLING_MODE':'test','BILLING_TEST_USERS':owners[0]['id'],'BILLING_CHECKOUT_ENABLED':'true'})
        stripe('webhook_endpoints','update',WEBHOOK,'-d','disabled=false','--stripe-version=2026-10-28.endive')
        token=owners[0]['token']
        stage='confirm test runtime key and account restrictions'
        status,body=http('/functions/v1/billing',{'action':'status'},token)
        assert status==200 and body.get('mode')=='test' and body.get('checkoutEnabled') is True, 'Test runtime is unavailable (check key mode/format)'
        assert body['plan']=='free'
        assert http('/functions/v1/billing',{'action':'checkout'},owners[1]['token'])[0]==403
        assert http('/functions/v1/billing',{'action':'checkout'})[0]==401
        assert http('/functions/v1/billing',{'action':'checkout','customer_id':'cus_forged'},token)[0]==400
        print('Sandbox credentials, confirmed-account access and request isolation: passed',flush=True)
        stage='create hosted checkout using the restricted runtime key'
        status,checkout=http('/functions/v1/billing',{'action':'checkout'},token)
        assert status==200 and checkout.get('url','').startswith('https://checkout.stripe.com/'), 'Checkout failed; restricted-key permissions need inspection'
        status,second=http('/functions/v1/billing',{'action':'checkout'},token)
        assert status==200 and checkout['url']==second['url'],'Repeated checkout did not reuse session'
        status,row=http('/rest/v1/rpc/billing_load',{'p_mode':'test','p_owner':owners[0]['id']},admin=admin)
        assert status==200 and row.get('customer_id') and row.get('checkout_id')
        customers.append(row['customer_id'])
        session=stripe('checkout','sessions','retrieve',row['checkout_id'],'--stripe-version=2026-10-28.endive')
        assert session['livemode'] is False and session['amount_total']==800 and session['mode']=='subscription'
        status,portal=http('/functions/v1/billing',{'action':'portal'},token)
        assert status==200 and portal.get('url','').startswith('https://billing.stripe.com/'),'Restricted key cannot create portal session'
        print('Checkout price, session reuse and customer portal: passed',flush=True)
        stage='complete hosted Checkout with a Stripe test card'
        result=subprocess.run(['node',str(HERE/'checkout-browser.cjs')],input=json.dumps({'url':checkout['url'],'email':owners[0]['email']}),
                              capture_output=True,text=True,encoding='utf-8',timeout=180,cwd=ROOT)
        if result.returncode:
            print(result.stdout[:5000],flush=True)
            raise RuntimeError('Hosted Checkout browser check failed (private details suppressed).')
        browser_success=True
        print('Hosted Checkout test-card payment: passed',flush=True)
        stage='wait for signed payment webhooks'
        for _ in range(20):
            _,row=http('/rest/v1/rpc/billing_load',{'p_mode':'test','p_owner':owners[0]['id']},admin=admin)
            if row.get('status')=='active' and row.get('pro_until'): break
            time.sleep(2)
        assert row.get('status')=='active' and row.get('pro_until'),'Paid webhook did not grant test Pro'
        # Browser RPC is always live-only, so sandbox Pro must still read Free.
        status,live=http('/rest/v1/rpc/membership_read',{},token)
        assert status==200 and live['plan']=='free','Sandbox purchase leaked into live membership'
        status,current=http('/functions/v1/billing',{'action':'status'},token)
        assert status==200 and current['plan']=='pro'
        status,again=http('/functions/v1/billing',{'action':'checkout'},token)
        assert status==200 and again.get('url','').startswith('https://billing.stripe.com/'),'Active member offered duplicate checkout'
        print('Signed webhook grants test Pro; live membership stays Free; duplicate subscription prevented: passed',flush=True)
        stage='cancellation at period end'
        stripe('subscriptions','update',row['subscription_id'],'-d','cancel_at_period_end=true','--stripe-version=2026-10-28.endive')
        for _ in range(10):
            status,current=http('/functions/v1/billing',{'action':'status'},token)
            if status==200 and current.get('cancelAtPeriodEnd') is True: break
            time.sleep(1)
        assert status==200 and current['plan']=='pro' and current['cancelAtPeriodEnd'] is True,'Period-end cancellation did not retain paid access'
        stage='immediate cancellation webhook'
        stripe('subscriptions','cancel',row['subscription_id'],'--stripe-version=2026-10-28.endive','--confirm')
        for _ in range(20):
            _,latest=http('/rest/v1/rpc/billing_load',{'p_mode':'test','p_owner':owners[0]['id']},admin=admin)
            if latest.get('status')=='canceled' and not latest.get('pro_until'): break
            time.sleep(2)
        assert latest.get('status')=='canceled' and not latest.get('pro_until'),'Cancellation webhook did not remove Pro'
        print('Period-end access and cancellation webhook: passed',flush=True)
    except Exception as error:
        print('FAILED at '+stage+': '+str(error)[:220],flush=True)
        raise SystemExit(1) from None
    finally:
        # Close the test gate first, including on a failed test.
        configure.store_secrets({'BILLING_CHECKOUT_ENABLED':'false','BILLING_TEST_USERS':'none'})
        for owner in owners:
            _,row=http('/rest/v1/rpc/billing_load',{'p_mode':'test','p_owner':owner['id']},admin=admin)
            if row and row.get('customer_id') and row['customer_id'] not in customers: customers.append(row['customer_id'])
        for customer in customers:
            stripe('customers','delete',customer,'--confirm','--stripe-version=2026-10-28.endive')
        if owners:
            ids=','.join("'"+str(uuid.UUID(owner['id']))+"'" for owner in owners)
            configure.query("delete from billing_private.members where mode='test' and owner_id in ("+ids+")")
            for owner in owners:
                status,_=http('/auth/v1/admin/users/'+owner['id'],admin=admin,method='DELETE')
                assert status==200,'Test account cleanup failed'
        print('Temporary customers/accounts removed; checkout disabled.',flush=True)


if __name__=='__main__':
    main()
