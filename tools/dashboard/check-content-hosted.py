"""Verify hosted editorial RPCs with disposable accounts, without emailing or changing owner lists."""
import importlib.util
import json
from pathlib import Path
import secrets
import uuid
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('billing_check',ROOT/'tools/billing/check-sandbox.py')
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)
def main():
    keys=json.loads(check.configure.cli('projects','api-keys','--remote='+check.configure.PROJECT,'--reveal','--output','json'))
    admin=next(row['api_key'] for row in keys if row.get('name')=='service_role')
    users=[]
    def rpc(name,body,token=None):return check.http('/rest/v1/rpc/'+name,body,token=token)
    try:
        for _ in range(2):
            email='content-qa-'+uuid.uuid4().hex+'@example.invalid';password=secrets.token_urlsafe(36)
            status,user=check.http('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'content_test_fixture':True}},admin=admin)
            assert status==200,'Fixture creation failed';users.append({'id':user['id'],'email':email})
            status,auth=check.http('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert status==200,'Fixture sign-in failed';users[-1]['token']=auth['access_token']
        owner,other=users
        assert rpc('content_desk_lists',{})[0]>=400
        assert rpc('content_desk_lists',{},other['token'])[0]==403
        check.configure.query("insert into dashboard_private.admins(owner_id,verified_email) values('"+owner['id']+"','"+owner['email']+"')")
        token=owner['token'];list_id=str(uuid.uuid4());document={'title':'Fixture editorial list','intro':'Private test only','items':[{'id':'event:fixture','title':'Fixture event','note':'Saved note'}]}
        status,saved=rpc('content_desk_save',{'p_id':list_id,'p_revision':0,'p_document':document},token);assert status==200 and saved['revision']==1,'Create failed'
        status,result=rpc('content_desk_get',{'p_id':list_id},token);assert status==200 and result['document']==document,'Round trip failed'
        status,rows=rpc('content_desk_lists',{},token);assert status==200 and len(rows)==1 and rows[0]['count']==1
        assert rpc('content_desk_get',{'p_id':list_id},other['token'])[0]==403
        document['intro']='Updated safely';status,saved=rpc('content_desk_save',{'p_id':list_id,'p_revision':1,'p_document':document},token);assert status==200 and saved['revision']==2
        assert rpc('content_desk_save',{'p_id':list_id,'p_revision':1,'p_document':document},token)[0]==409,'Stale revision overwrote a list'
        assert rpc('content_desk_delete',{'p_id':list_id,'p_revision':1},token)[0]==409
        assert rpc('content_desk_delete',{'p_id':list_id,'p_revision':2},token)[0]==200
        assert rpc('content_desk_lists',{},token)[1]==[]
        check.configure.query("delete from dashboard_private.admins where owner_id='"+owner['id']+"'")
        assert rpc('content_desk_lists',{},token)[0]==403
        print('Hosted content desk: guest/member denial, owner CRUD, private round trip, revision conflicts and revocation passed.')
    finally:
        for user in reversed(users):
            check.configure.query("delete from billing_private.members where owner_id='"+user['id']+"'")
            status,_=check.http('/auth/v1/admin/users/'+user['id'],admin=admin,method='DELETE');assert status==200,'Fixture cleanup failed'
        print('Disposable accounts and lists removed. No email or real owner content changed.')
if __name__=='__main__':main()
