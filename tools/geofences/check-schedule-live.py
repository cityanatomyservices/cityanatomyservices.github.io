#!/usr/bin/env python3
"""Verify real schedule/map enforcement with one disposable circle and provider test recipient."""
import argparse
import datetime as dt
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
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--browser',action='store_true');args=p.parse_args()
    keys=json.loads(c.configure.cli('projects','api-keys','--remote='+c.configure.PROJECT,'--reveal','--output','json'))
    admin=next(k['api_key'] for k in keys if k.get('name')=='service_role');owner=None;sid=str(uuid.uuid4());tag=uuid.uuid4().hex
    email='delivered+schedule-owner-'+tag+'@resend.dev';recipient='delivered+schedule-guest-'+tag+'@resend.dev';password=secrets.token_urlsafe(36)
    instant=lambda hours:(dt.datetime.now(dt.timezone.utc)+dt.timedelta(hours=hours)).isoformat()
    try:
        status,user=c.http('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'billing_test_fixture':True}},admin=admin);assert status==200;owner=str(uuid.UUID(user['id']))
        status,session=c.http('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert status==200
        api=lambda body:c.http('/functions/v1/geofences',body,session['access_token'])
        rpc=lambda name,body:c.http('/rest/v1/rpc/'+name,body,session['access_token'])
        status,settings=api({'action':'list'});assert status==200 and settings.get('freeTesting') and settings.get('emailReady'),'Free testing and the sender must be enabled'
        future={'starts_at':instant(1),'ends_at':instant(2)}
        fields={'name':'Disposable scheduled chat verification','description':'A temporary fixture, removed after verification.','latitude':30.2672,'longitude':-97.7431,'diameter':500,**future}
        status,saved=api({'action':'save','id':sid,'fields':fields,'invitations':[recipient]});assert status==200,'Schedule save returned HTTP '+str(status)
        assert api({'action':'checkout','id':sid})[0]==200
        listed=lambda:rpc('geofence_map',{})[1]['circles']
        assert not any(x['id']==sid for x in listed())
        status,public=rpc('geofence_read',{'p_id':sid});assert status==200 and public['active'] is False and public['startsAt']
        join={'p_id':sid,'p_lat':fields['latitude'],'p_lng':fields['longitude'],'p_accuracy':5,'p_timestamp':instant(0),'p_name':'Schedule QA'}
        assert rpc('geofence_chat_v2',join)[0]==410
        deadline=time.monotonic()+180
        while True:
            jobs=json.loads(c.configure.query("select state,payload from geofence_private.email_jobs where space_id='"+sid+"' and kind='invitation'",True))
            assert len(jobs)==1 and jobs[0]['state']!='failed'
            if jobs[0]['state']=='sent':break
            if time.monotonic()>deadline:raise AssertionError('Scheduled invitation delivery timed out')
            time.sleep(5)
        assert jobs[0]['payload']['to']==[recipient] and 'Austin time' in jobs[0]['payload']['text']
        assert api({'action':'schedule','id':sid,'starts_at':instant(-1),'ends_at':instant(1)})[0]==200
        row=next(x for x in listed() if x['id']==sid);assert row['active'] is True and row['activeUntil'];assert not any(k in row for k in ['email','owner_id','paidUntil','recipient'])
        join['p_timestamp']=instant(0);assert rpc('geofence_chat_v2',join)[0]==200
        closed={'starts_at':instant(-2),'ends_at':instant(-1)}
        if args.browser:
            result=subprocess.run(['node',str(ROOT/'tools/geofences/check-schedule-browser.cjs')],input=json.dumps({'session':session,'circle':row,'closed':closed}),capture_output=True,text=True,encoding='utf-8',timeout=240,cwd=ROOT)
            print(result.stdout,flush=True)
            if result.returncode:print(result.stderr[-1800:],flush=True);raise RuntimeError('Published schedule check failed; private session details suppressed')
        else:assert api({'action':'schedule','id':sid,**closed})[0]==200
        assert not any(x['id']==sid for x in listed());assert rpc('geofence_read',{'p_id':sid})[1]['active'] is False
        join['p_timestamp']=instant(0);assert rpc('geofence_chat_v2',join)[0]==410
        print('Live scheduled invitation, future/active/ended map visibility, public metadata and server chat gates passed.',flush=True)
    finally:
        if owner:
            c.configure.query("delete from geofence_private.spaces where owner_id='"+owner+"'::uuid")
            assert c.http('/auth/v1/admin/users/'+owner,admin=admin,method='DELETE')[0]==200
        print('Disposable account, circle and messages removed. Only provider test recipients were emailed; no payments.',flush=True)
if __name__=='__main__':main()
