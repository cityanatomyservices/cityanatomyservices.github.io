#!/usr/bin/env python3
"""Verify invitation delivery using only Resend test recipients and disposable accounts."""
import argparse
import base64
import importlib.util
import json
from pathlib import Path
import secrets
import subprocess
import time
import uuid

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('check',ROOT/'tools/billing/check-sandbox.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--browser',action='store_true');args=parser.parse_args()
    keys=json.loads(c.configure.cli('projects','api-keys','--remote='+c.configure.PROJECT,'--reveal','--output','json'))
    admin=next(k['api_key'] for k in keys if k.get('name')=='service_role')
    owner=None;guests=[];tag=uuid.uuid4().hex
    email='delivered+geofence-owner-'+tag+'@resend.dev'
    invitees=['delivered+geofence-invite-'+str(i)+'-'+tag+'@resend.dev' for i in range(2)]
    password=secrets.token_urlsafe(36);profile='WizardQA'+tag[:8]
    try:
        status,user=c.http('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'billing_test_fixture':True}},admin=admin)
        assert status==200;owner=str(uuid.UUID(user['id']))
        status,session=c.http('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert status==200
        status,_=c.http('/rest/v1/profiles?id=eq.'+owner,{'handle':profile},admin=admin,method='PATCH');assert status in (200,204)
        def api(body):return c.http('/functions/v1/geofences',body,session['access_token'])
        status,value=api({'action':'list'});assert status==200 and value.get('freeTesting') and value.get('emailReady'),'Free testing and the email sender must be enabled'
        if args.browser:
            result=subprocess.run(['node',str(ROOT/'tools/geofences/check-wizard-live.cjs')],input=json.dumps({'session':session,'invitees':invitees,'profileName':profile}),capture_output=True,text=True,encoding='utf-8',timeout=300,cwd=ROOT)
            for line in result.stdout.splitlines():
                if line.startswith('__QA_GUESTS__'):guests.extend(str(uuid.UUID(x)) for x in json.loads(line[len('__QA_GUESTS__'):]))
                else:print(line,flush=True)
            if result.returncode:
                print(result.stderr[-1800:],flush=True)
                raise RuntimeError('Published wizard verification failed; private session details suppressed')
        else:
            sid=str(uuid.uuid4());fields={'name':'Disposable invitation verification','description':'Provider test recipients only.','latitude':30.2672,'longitude':-97.7431,'diameter':500}
            assert api({'action':'save','id':sid,'fields':fields,'invitations':[invitees[0],invitees[0].upper(),invitees[1]]})[0]==200
            count=json.loads(c.configure.query("select count(*) as count from geofence_private.email_jobs where space_id='"+sid+"'",True))[0]['count'];assert count==0,'Draft sent email'
            assert api({'action':'checkout','id':sid})[0]==200
        status,listed=api({'action':'list'});assert status==200 and len(listed['spaces'])==(2 if args.browser else 1)
        spaces=[str(uuid.UUID(x['id'])) for x in listed['spaces']]
        for sid in spaces:
            assert listed['invitations'][sid]['total']==2
            assert api({'action':'checkout','id':sid})[0]==200  # Idempotent; cannot resend.
        query="select j.space_id,j.kind,j.state,j.provider_id,j.payload from geofence_private.email_jobs j join geofence_private.spaces s on s.id=j.space_id where s.owner_id='"+owner+"'"
        deadline=time.monotonic()+180
        while True:
            jobs=json.loads(c.configure.query(query,True));invites=[j for j in jobs if j['kind']=='invitation']
            assert not any(j['state']=='failed' for j in jobs),'Provider rejected a test message; recipient details suppressed'
            if len(invites)==len(spaces)*2 and all(j['state']=='sent' and j['provider_id'] for j in invites):break
            if time.monotonic()>deadline:raise AssertionError('Invitation delivery did not complete before the deadline')
            time.sleep(5)
        for sid in spaces:
            delivered=[j for j in invites if j['space_id']==sid]
            assert {j['payload']['to'][0] for j in delivered}==set(invitees)
            for job in delivered:
                payload=job['payload'];assert len(payload['to'])==1 and not payload.get('cc') and not payload.get('bcc')
                assert 'https://austin.chat/geofences/?id='+sid in payload['text']
                assert 'notifications/#' not in payload['text'] and 'one-time invitation' in payload['text']
                assert base64.b64decode(payload['attachments'][0]['content']).startswith(b'\x89PNG\r\n\x1a\n')
        print('Real invitation delivery passed: individual test recipients, permanent links, PNG QR codes and no duplicate sends after repeated activation.',flush=True)
    finally:
        if owner:
            c.configure.query("delete from geofence_private.spaces where owner_id='"+owner+"'::uuid")
            assert c.http('/auth/v1/admin/users/'+owner,admin=admin,method='DELETE')[0]==200
        for guest in guests:assert c.http('/auth/v1/admin/users/'+guest,admin=admin,method='DELETE')[0]==200
        print('Disposable accounts, circles, conversations and invitation records removed. Only provider test recipients were emailed; no payments.',flush=True)

if __name__=='__main__':main()
