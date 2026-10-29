"""Supabase management SQL transport. Credentials stay outside the repository."""
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request

PROJECT = os.environ.get('SUPABASE_PROJECT_REF', 'aqbyxpiwugcvoephsvpm')


def query(sql):
    token = os.environ.get('SUPABASE_ACCESS_TOKEN')
    if not token:
        token = (Path.home() / '.supabase/access-token').read_text().strip()
    data = json.dumps({'query': sql}).encode()
    for attempt in range(5):
        request = urllib.request.Request(
            f'https://api.supabase.com/v1/projects/{PROJECT}/database/query', data=data,
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 502, 503, 504) and attempt < 4:
                time.sleep(min(15, 2 ** attempt))
                continue
            raise RuntimeError(f'Supabase SQL {exc.code}: {exc.read().decode()[:1500]}') from None


if __name__ == '__main__':
    import sys
    print(json.dumps(query(Path(sys.argv[1]).read_text()), indent=2))
