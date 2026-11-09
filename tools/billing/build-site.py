#!/usr/bin/env python3
"""Build the Pages artifact from tracked files, excluding every private Pro asset."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess

ROOT=Path(__file__).resolve().parents[2]


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('output');args=parser.parse_args()
    output=Path(args.output).resolve()
    if output.exists():raise SystemExit('Use a new output directory; this builder does not delete existing files.')
    # Only create/copy. No computed recursive deletion or moving occurs.
    manifest=json.loads((ROOT/'billing/pro-assets.json').read_text(encoding='utf-8'))
    spec=importlib.util.spec_from_file_location('pro_package',ROOT/'tools/billing/package-apps.py')
    package=importlib.util.module_from_spec(spec);spec.loader.exec_module(package)
    if package.manifest()['release']!=manifest['release']:
        raise SystemExit('Pro catalog or sources changed. Package/upload private apps before publishing.')
    retention_spec=importlib.util.spec_from_file_location('event_retention',ROOT/'tools/special-events/retention.py')
    retention=importlib.util.module_from_spec(retention_spec);retention_spec.loader.exec_module(retention)
    expired=retention.expired_events(ROOT);event_paths=retention.exclusions(expired)
    private=set(manifest['files'])
    tracked=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
    for name in filter(None,tracked):
        if retention.excluded(name,event_paths):continue
        path=ROOT/name
        if '/'+name in private:
            raw=path.read_bytes()
            if path.suffix in {'.html','.js','.css','.json','.geojson','.svg'}:raw=raw.replace(b'\r\n',b'\n')
            if hashlib.sha256(raw).hexdigest()!=manifest['files']['/'+name]['sha256']:
                raise SystemExit('Private app sources changed. Repackage and upload before publishing: '+name)
            continue
        target=output/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(retention.filtered(name,path.read_bytes(),expired)) if expired and name in {'home.json','special-events/registry.json'} else shutil.copyfile(path,target)
    for name in private:
        assert not (output/name.lstrip('/')).exists(),'Private app asset leaked into Pages'
    for name in manifest['apps']:
        assert (output/name.strip('/')/'index.html').is_file(),'Missing public app entry'
    print(f'Pages artifact ready; {len(private)} private app resources and {len(expired)} expired events excluded.')


if __name__=='__main__':main()
