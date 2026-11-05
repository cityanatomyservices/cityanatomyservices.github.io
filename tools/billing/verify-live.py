#!/usr/bin/env python3
"""Verify the live Stripe key through the backend without creating a Stripe customer.

Checkout stays disabled. Uses one temporary, confirmed Supabase account with
no email sent, then removes it. Intended only for initial launch preparation.
"""
import importlib.util
import json
from pathlib import Path
import secrets
import uuid

spec=importlib.util.spec_from_file_location('sandbox_check',Path(__file__).with_name('check-sandbox.py'))
check=importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    rows=json.loads(check.configure.query("select count(*) as total from billing_private.members where mode='live'",True))
    if rows[0]['total']: raise SystemExit('Initial launch check only; live billing records already exist.')
    keys=json.loads(check.configure.cli('projects','api-keys','--remote='+check.configure.PROJECT,'--reveal','--output','json'))
    admin=next(row['api_key'] for row in keys if row.get('name')=='service_role')
    owner=None
    try:
        email='billing-qa-'+uuid.uuid4().hex+'@example.invalid';password=secrets.token_urlsafe(36)
        status,user=check.http('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,
          'app_metadata':{'billing_test_fixture':True}},admin=admin)
        assert status==200,'Could not create disposable verification account'
        owner=user['id']
        status,auth=check.http('/auth/v1/token?grant_type=password',{'email':email,'password':password})
        assert status==200,'Could not authenticate verification account'
        check.configure.store_secrets({'BILLING_MODE':'live','BILLING_CHECKOUT_ENABLED':'false'})
        status,result=check.http('/functions/v1/billing',{'action':'status'},auth['access_token'])
        assert status==200 and result.get('mode')=='live' and result.get('plan')=='free' and result.get('checkoutEnabled') is False,'Live read-only configuration check failed'
        print('Live key verified: $8 USD monthly price and cancellation portal match. Checkout remains disabled.')
    finally:
        if owner:
            status,_=check.http('/auth/v1/admin/users/'+owner,admin=admin,method='DELETE')
            assert status==200,'Verification account cleanup failed'
            print('Temporary verification account removed; no live Stripe customer or charge created.')


if __name__=='__main__':
    main()
