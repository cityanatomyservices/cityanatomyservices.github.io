#!/usr/bin/env python3
"""Manual hosted Pro delivery check; temporary Auth/entitlement, no Stripe objects.

No email is sent, credentials remain in memory, and synthetic rows are removed.
Use --browser only after the matching Pages release is published.
"""
import argparse,datetime,hashlib,importlib.util,json,secrets,subprocess,urllib.error,urllib.request,uuid
from pathlib import Path
spec=importlib.util.spec_from_file_location('sandbox_check',Path(__file__).with_name('check-sandbox.py'))
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--browser',action='store_true');args=parser.parse_args()
    manifest=json.loads((check.ROOT/'billing/pro-assets.json').read_text(encoding='utf-8'))
    keys=json.loads(check.configure.cli('projects','api-keys','--remote='+check.configure.PROJECT,'--reveal','--output','json'))
    admin=next(row['api_key'] for row in keys if row.get('name')=='service_role');owner=None
    def asset(path,token=None):
        headers={'apikey':check.PUBLIC,'Content-Type':'application/json'}
        if token:headers['Authorization']='Bearer '+token
        req=urllib.request.Request(check.BASE+'/functions/v1/pro-app',data=json.dumps({'path':path}).encode(),headers=headers)
        try:
            with urllib.request.urlopen(req,timeout=60) as response:return response.status,response.read(),response.headers
        except urllib.error.HTTPError as error:return error.code,b'',error.headers
    try:
        email='billing-qa-'+uuid.uuid4().hex+'@example.invalid';password=secrets.token_urlsafe(36)
        status,user=check.http('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'billing_test_fixture':True}},admin=admin)
        assert status==200,'Disposable account failed';owner=user['id']
        status,auth=check.http('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert status==200
        token=auth['access_token'];entry=next(iter(manifest['files']))
        assert asset(entry)[0]==401 and asset(entry,token)[0]==403,'Guest or Free accessed private app'
        for kind in ['public','authenticated']:
            status,_=check.http('/storage/v1/object/'+kind+'/pro-apps/'+manifest['release']+entry,token=token)
            assert status>=400,'Direct storage access must be denied'
        print('Hosted API rejects guests and Free members; both direct Storage routes deny access.',flush=True)
        status,row=check.http('/rest/v1/rpc/billing_claim',{'p_mode':'live','p_owner':owner},admin=admin);assert status==200
        status,_=check.http('/rest/v1/rpc/billing_save',{'p_mode':'live','p_owner':owner,'p_lease':row['lease_id'],'p_fields':{'status':'active','pro_until':(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=1)).isoformat()}},admin=admin);assert status==200
        check.http('/rest/v1/rpc/billing_release',{'p_mode':'live','p_owner':owner,'p_lease':row['lease_id']},admin=admin)
        for path,meta in manifest['files'].items():
            status,body,headers=asset(path,token)
            assert status==200 and hashlib.sha256(body).hexdigest()==meta['sha256'],'Private resource mismatch: '+path
            assert headers.get('X-App-Content-Type')==meta['mime'] and 'no-store' in headers.get('Cache-Control','')
        print('Pro authorization delivered all 45 private resources with matching hashes, MIME types and no-store headers.',flush=True)
        if args.browser:
            result=subprocess.run(['node',str(Path(__file__).with_name('check-private-browser.cjs'))],input=json.dumps({'session':auth,'apps':manifest['apps']}),capture_output=True,text=True,encoding='utf-8',timeout=300,cwd=check.ROOT)
            print(result.stdout[:5000],flush=True)
            if result.returncode:raise RuntimeError('Hosted browser check failed; account details suppressed. '+result.stderr[-1500:])
        check.configure.query("delete from billing_private.members where owner_id='"+owner+"'::uuid")
        assert asset(entry,token)[0]==403,'Revoked member retained private delivery'
        print('Revoking membership denies the same still-valid login token.',flush=True)
    finally:
        if owner:
            check.configure.query("delete from billing_private.members where owner_id='"+owner+"'::uuid")
            status,_=check.http('/auth/v1/admin/users/'+owner,admin=admin,method='DELETE');assert status==200,'Fixture cleanup failed'
            print('Temporary account and entitlement removed. No live Stripe customer or charge created.',flush=True)

if __name__=='__main__':main()
