#!/usr/bin/env python3
"""Verify enabled free testing with disposable accounts; never alter billing setup."""
import importlib.util,json,secrets,subprocess,uuid,urllib.request
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('check',HERE/'check-sandbox.py');check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)

def main():
 status,flags=check.http('/rest/v1/rpc/access_testing_status',{})
 assert status==200 and flags=={'proEnabled':True,'geofencesEnabled':True},'Enable testing before this verification.'
 keys=json.loads(check.configure.cli('projects','api-keys','--remote='+check.configure.PROJECT,'--reveal','--output','json'));admin=next(r['api_key'] for r in keys if r['name']=='service_role')
 owners=[];sessions=[]
 try:
  for index in range(2):
   email='free-testing-qa-'+uuid.uuid4().hex+'@example.invalid';password=secrets.token_urlsafe(36)
   status,user=check.http('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'billing_test_fixture':True}},admin=admin)
   assert status==200;owners.append(str(uuid.UUID(user['id'])))
   status,auth=check.http('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert status==200;sessions.append(auth)
  token=sessions[0]['access_token']
  status,value=check.http('/functions/v1/pro-app',{'path':'/moontowertour/app.html'},token);assert status==403
  run=subprocess.run(['node',str(HERE/'check-testing-live.cjs')],input=json.dumps(sessions[0]),capture_output=True,text=True,encoding='utf-8',timeout=240,cwd=check.ROOT)
  if run.returncode:raise RuntimeError('Published free testing UI failed: '+run.stderr[-1500:])
  print(run.stdout,flush=True)
  status,value=check.http('/rest/v1/rpc/membership_read',{},token);assert status==200 and value['plan']=='pro' and value['temporaryAccess'] and value['paidThrough'] is None and not value['hasBilling']
  status,value=check.http('/functions/v1/geofences',{'action':'list'},token);assert status==200 and len(value['spaces'])==1
  space=value['spaces'][0];assert space['temporaryAccess'] and not space['hasBilling'] and space['latitude']==30.2672 and space['longitude']==-97.7431
  status,_=check.http('/functions/v1/geofences',{'action':'checkout','id':space['id']},sessions[1]['access_token']);assert status==404,'Foreign owner cannot activate'
  status,value=check.http('/functions/v1/billing',{'action':'checkout'},token);assert status==200 and value['activated'],'Repeated activation is safe'
  rows=json.loads(check.configure.query(f"select (select count(*) from billing_private.members where owner_id='{owners[0]}') as pro_rows,(select count(*) from geofence_private.billing where space_id='{space['id']}') as geofence_rows",True));assert rows==[{'pro_rows':0,'geofence_rows':0}]
  manifest=json.loads((check.ROOT/'billing/pro-assets.json').read_text())
  for app in manifest['apps'].values():
   request=urllib.request.Request(check.BASE+'/functions/v1/pro-app',data=json.dumps({'path':app['entry']}).encode(),headers={'apikey':check.PUBLIC,'Authorization':'Bearer '+token,'Content-Type':'application/json'})
   with urllib.request.urlopen(request,timeout=60) as response:assert response.status==200 and len(response.read())>100
  print('Real free grants verified: all nine private app entries, owner isolation, repeat activation and zero paid billing rows.',flush=True)
 finally:
  for owner in owners:
   check.configure.query(f"delete from geofence_private.spaces where owner_id='{owner}'")
   status,_=check.http('/auth/v1/admin/users/'+owner,admin=admin,method='DELETE');assert status==200
  print('Disposable accounts, circles, messages and temporary grants removed. No payment objects created.',flush=True)
if __name__=='__main__':main()
