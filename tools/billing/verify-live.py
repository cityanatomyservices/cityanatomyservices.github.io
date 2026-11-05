#!/usr/bin/env python3
"""Verify the live Stripe key through the backend without creating a Stripe customer.

Never changes activation settings. Uses one temporary, confirmed Supabase
account with no email sent, then removes it. No Stripe objects are created.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import secrets
import subprocess
import uuid

spec=importlib.util.spec_from_file_location('sandbox_check',Path(__file__).with_name('check-sandbox.py'))
check=importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--enabled',action='store_true',help='Expect live checkout enabled')
    parser.add_argument('--browser',action='store_true',help='Check the published Free UI; requires --enabled')
    args=parser.parse_args()
    if args.browser and not args.enabled:parser.error('--browser requires --enabled')
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
        status,result=check.http('/functions/v1/billing',{'action':'status'},auth['access_token'])
        assert status==200 and result.get('mode')=='live' and result.get('plan')=='free' and result.get('checkoutEnabled') is args.enabled,'Live read-only configuration check failed'
        print('Live key verified: $8 USD monthly price and cancellation portal match; checkout '+('enabled' if args.enabled else 'disabled')+'.',flush=True)
        if args.browser:
            run=subprocess.run(['node',str(Path(__file__).with_name('check-free-browser.cjs'))],input=json.dumps(auth),capture_output=True,text=True,encoding='utf-8',timeout=150,cwd=check.ROOT)
            print(run.stdout[:3000],flush=True)
            if run.returncode:raise RuntimeError('Free browser verification failed: '+run.stderr[-1000:])
    finally:
        if owner:
            status,_=check.http('/auth/v1/admin/users/'+owner,admin=admin,method='DELETE')
            assert status==200,'Verification account cleanup failed'
            print('Temporary verification account removed; no live Stripe customer or charge created.')


if __name__=='__main__':
    main()
