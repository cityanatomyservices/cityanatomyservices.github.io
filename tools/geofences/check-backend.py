#!/usr/bin/env python3
"""Disposable accounts verify deployed geofence API. No payment or Stripe objects."""
import importlib.util,json,secrets,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('billing_check',ROOT/'tools/billing/check-sandbox.py');check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)
keys=json.loads(check.configure.cli('projects','api-keys','--remote='+check.configure.PROJECT,'--reveal','--output','json'));admin=next(r['api_key'] for r in keys if r.get('name')=='service_role')
users=[];space=str(uuid.uuid4())
try:
 for _ in range(2):
  email='geofence-qa-'+uuid.uuid4().hex+'@example.invalid';password=secrets.token_urlsafe(32)
  status,user=check.http('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True},admin=admin);assert status==200;users.append({'id':user['id']})
  status,session=check.http('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert status==200;users[-1]['token']=session['access_token']
 def call(i,body):return check.http('/functions/v1/geofences',body,users[i]['token'])
 status,result=call(0,{'action':'list'});assert status==200 and result['spaces']==[] and result['checkoutEnabled'] is False
 fields={'name':'Disposable verification','description':'Temporary test, removed immediately','latitude':30.2672,'longitude':-97.7431,'diameter':50}
 status,result=call(0,{'action':'save','id':space,'fields':fields});assert status==200 and result['id']==space
 assert call(1,{'action':'save','id':space,'fields':fields})[0]==404
 assert call(0,{'action':'save','id':space,'fields':{**fields,'diameter':501}})[0]==422
 assert call(0,{'action':'checkout','id':space})[0]==503
 status,result=check.http('/rest/v1/rpc/geofence_read',{'p_id':space});assert status==200 and result is None
 status,result=call(0,{'action':'geocode','address':'301 W 2nd St Austin TX 78701'});assert status==200 and len(result['matches'])>0
 print('Deployed API: confirmed accounts, draft save, owner isolation, size validation, Census address lookup, unpublished unpaid page and disabled checkout passed.',flush=True)
finally:
 check.configure.query("delete from geofence_private.spaces where id='"+space+"'::uuid")
 for u in users:
  status,_=check.http('/auth/v1/admin/users/'+u['id'],admin=admin,method='DELETE');assert status==200
 print('Temporary drafts/accounts removed. No Stripe customer, purchase or charge created.',flush=True)
