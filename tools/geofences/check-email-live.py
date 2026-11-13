#!/usr/bin/env python3
"""Verify automated geofence mail using only Resend's labeled test recipients.

Creates/removes disposable Supabase users and circles. Never sends fixture
messages to real visitors. Keeps private recipient addresses/tokens in memory.
"""
import base64,importlib.util,json,secrets,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('check',ROOT/'tools/billing/check-sandbox.py');c=importlib.util.module_from_spec(s);s.loader.exec_module(c)

def main():
 keys=json.loads(c.configure.cli('projects','api-keys','--remote='+c.configure.PROJECT,'--reveal','--output','json'));admin=next(v['api_key'] for v in keys if v['name']=='service_role')
 owner=None;sid=str(uuid.uuid4());email='delivered+geofence-'+uuid.uuid4().hex+'@resend.dev';other='delivered+alerts-'+uuid.uuid4().hex+'@resend.dev';password=secrets.token_urlsafe(36)
 try:
  status,user=c.http('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'billing_test_fixture':True}},admin=admin);assert status==200;owner=str(uuid.UUID(user['id']))
  status,auth=c.http('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert status==200;token=auth['access_token']
  def api(body):return c.http('/functions/v1/geofences',body,token)
  status,data=api({'action':'list'});assert status==200 and data['emailReady'] and data['freeTesting']
  fields={'name':'Disposable email verification','description':'Resend test recipient only. Removed after verification.','latitude':30.2672,'longitude':-97.7431,'diameter':50}
  assert api({'action':'save','id':sid,'fields':fields})[0]==200
  assert api({'action':'notifications','id':sid,'enabled':True,'email':other})[0]==200
  assert api({'action':'checkout','id':sid})[0]==200
  def jobs():return json.loads(c.configure.query(f"select kind,state,provider_id,payload,events from geofence_private.email_jobs where space_id='{sid}' order by created_at",True))
  def wait_sent(kinds):
   deadline=time.monotonic()+160
   while time.monotonic()<deadline:
    rows=jobs()
    if any(r['state']=='failed' for r in rows):raise AssertionError('Email provider rejected a fixture; inspect private job result without printing recipient data.')
    if all(any(r['kind']==kind and r['state']=='sent' and r['provider_id'] for r in rows) for kind in kinds):return rows
    time.sleep(5)
   raise AssertionError('Scheduled email did not reach provider acceptance within the check window.')
  rows=wait_sent(['welcome','verify']);welcome=next(r for r in rows if r['kind']=='welcome')['payload'];assert welcome['to']==[email]
  assert 'https://austin.chat/geofences/?id='+sid in welcome['text'];attachment=welcome['attachments'][0];assert attachment['content_id']=='geofence-qr' and base64.b64decode(attachment['content']).startswith(b'\x89PNG\r\n\x1a\n')
  verify=next(r for r in rows if r['kind']=='verify')['payload'];assert verify['to']==[other];verify_token=verify['text'].split('/notifications/#verify/')[1].split()[0]
  print('Automatic Cron delivery accepted: owner link/PNG QR email and alternate-address verification email.',flush=True)
  assert c.http('/functions/v1/geofence-email',{'action':'verify','token':verify_token})[0]==200
  chat={'p_id':sid,'p_lat':30.2672,'p_lng':-97.7431,'p_accuracy':5,'p_timestamp':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()}
  assert c.http('/rest/v1/rpc/geofence_chat',chat,token)[0]==200
  assert c.http('/rest/v1/rpc/geofence_chat',{'p_id':sid,'p_leave':True},token)[0]==200
  rows=wait_sent(['activity']);activity=next(r for r in rows if r['kind']=='activity');assert len(activity['events'])==2 and activity['payload']['to']==[other]
  stop_token=activity['payload']['text'].split('/notifications/#stop/')[1].split()[0];assert c.http('/functions/v1/geofence-email',{'action':'stop','token':stop_token})[0]==200
  status,value=api({'action':'list'});assert status==200 and value['notifications'][sid]['enabled'] is False
  count=len(rows);chat['p_timestamp']=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat();assert c.http('/rest/v1/rpc/geofence_chat',chat,token)[0]==200;assert c.http('/rest/v1/rpc/geofence_chat',{'p_id':sid,'p_leave':True},token)[0]==200;assert len(jobs())==count
  assert api({'action':'checkout','id':sid})[0]==200;assert len(jobs())==count
  assert c.http('/functions/v1/geofence-send',{})[0]==401
  print('Automatic arrival/departure email accepted; opt-out stops later alerts; repeated activation does not resend welcome. No real visitor emailed.',flush=True)
 finally:
  c.configure.query(f"delete from geofence_private.spaces where id='{sid}'")
  if owner:assert c.http('/auth/v1/admin/users/'+owner,admin=admin,method='DELETE')[0]==200
  print('Disposable email account, circle, preferences, jobs and chat records removed.',flush=True)
if __name__=='__main__':main()
