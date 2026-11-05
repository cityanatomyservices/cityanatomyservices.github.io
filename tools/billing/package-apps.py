#!/usr/bin/env python3
"""Package Pro app resources, upload them privately, and describe Pages exclusions.

Source stays in GitHub. The Pages artifact must exclude every file in the
generated manifest. Only the pro-app Edge function may read the private bucket.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import urllib.error
import urllib.request
from urllib.parse import urlparse

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('billing_configure',HERE/'configure.py')
configure=importlib.util.module_from_spec(spec);spec.loader.exec_module(configure)
ROOT=configure.ROOT
MIMES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
       '.css':'text/css; charset=utf-8','.json':'application/json','.geojson':'application/geo+json',
       '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
       '.mp3':'audio/mpeg','.woff2':'font/woff2'}

def source_bytes(file):
    raw=file.read_bytes()
    return raw.replace(b'\r\n',b'\n') if file.suffix in {'.html','.js','.css','.json','.geojson','.svg'} else raw


def manifest():
    home=json.loads((ROOT/'home.json').read_text(encoding='utf-8'))
    reports=json.loads((ROOT/'apps/reports/reports.json').read_text(encoding='utf-8'))
    apps={};paths=set()
    for app in next(c['cards'] for c in home['chips'] if c['label']=='Apps'):
        if app.get('requiredPlan')!='pro':continue
        entry=urlparse(app['app']).path
        directory=(ROOT/entry.lstrip('/')).parent
        apps['/apps/'+app['slug']+'/']={'title':app['title'],'entry':entry}
        for file in directory.rglob('*'):
            if file.is_file() and file.name!='index.html' and file.suffix in MIMES:paths.add(file)
    for app in reports:
        if app.get('requiredPlan')!='pro':continue
        directory=ROOT/'apps'/app['id'];entry='/apps/'+app['id']+'/map.html'
        apps['/apps/'+app['id']+'/']={'title':app['title'],'entry':entry}
        for name in ['map.html','config.js','data.geojson']:paths.add(directory/name)
    files={}
    for file in sorted(paths):
        raw=source_bytes(file);name='/'+file.relative_to(ROOT).as_posix()
        files[name]={'sha256':hashlib.sha256(raw).hexdigest(),'size':len(raw),'mime':MIMES[file.suffix]}
    release=hashlib.sha256(json.dumps({'apps':apps,'files':files},sort_keys=True).encode()).hexdigest()
    return {'release':release,'apps':apps,'files':files}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--upload',action='store_true');args=parser.parse_args()
    value=manifest();raw=(json.dumps(value,indent=2)+'\n').encode()
    (ROOT/'billing/pro-assets.json').write_bytes(raw)
    print(f"Packaged {len(value['apps'])} apps, {len(value['files'])} private files, {sum(f['size'] for f in value['files'].values())} bytes.")
    if not args.upload:return
    policies=json.loads(configure.query("select exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='pro_app_files_backend_only') as installed",True))
    if not policies[0]['installed']:
        configure.query((ROOT/'supabase/migrations/0013_pro_app_storage.sql').read_text(encoding='utf-8'))
    keys=json.loads(configure.cli('projects','api-keys','--remote='+configure.PROJECT,'--reveal','--output','json'))
    key=next(row['api_key'] for row in keys if row.get('name')=='service_role')
    def request(path,body=None,method='GET',mime='application/json'):
        req=urllib.request.Request('https://'+configure.PROJECT+'.supabase.co/storage/v1/'+path,
            data=body,method=method,headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':mime,'x-upsert':'true'})
        try:
            with urllib.request.urlopen(req,timeout=60) as response:return response.read()
        except urllib.error.HTTPError as error:
            raise SystemExit(f'Private storage request failed (HTTP {error.code}); credentials suppressed.') from None
    buckets=json.loads(request('bucket'))
    bucket=next((b for b in buckets if b['id']=='pro-apps'),None)
    if bucket and bucket.get('public'):raise SystemExit('The Pro bucket must be private; no files uploaded.')
    if not bucket:request('bucket',json.dumps({'id':'pro-apps','name':'pro-apps','public':False,'file_size_limit':10485760}).encode(),'POST')
    for path,entry in value['files'].items():
        body=source_bytes(ROOT/path.lstrip('/'));assert hashlib.sha256(body).hexdigest()==entry['sha256']
        request('object/pro-apps/'+value['release']+path,body,'POST',entry['mime'])
    request('object/pro-apps/'+value['release']+'/manifest.json',raw,'POST')
    configure.store_secrets({'PRO_APPS_RELEASE':value['release']})
    print('Private resources uploaded and active release recorded. No public storage URLs were created.')


if __name__=='__main__':main()
