"""Pass an in-memory cleanup credential to the isolated live chat browser check."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('billing_config', ROOT/'tools/billing/configure.py')
config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config)
keys = json.loads(config.cli('projects', 'api-keys', '--remote='+config.PROJECT, '--reveal', '--output', 'json'))
admin = next((k['api_key'] for k in keys if k['name']=='service_role'), None)
if not admin:
    raise SystemExit('Cleanup access unavailable; no browser started.')
result = subprocess.run(['node', 'tools/special-events/check-stops-live.cjs', *sys.argv[1:]],
                        cwd=ROOT, input=json.dumps({'admin':admin}), text=True)
raise SystemExit(result.returncode)
