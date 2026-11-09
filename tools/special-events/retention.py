"""Exclude expired event pages and data from each Pages artifact.

The existing sports workflow triggers publication every 15 minutes, including
runs without score changes. Browser and database deadlines do not depend on
Actions timing. Source-control history and visitors' exports are not erased.
"""
from datetime import datetime, timezone
import json
from pathlib import PurePosixPath


def expired_events(root, now=None):
    now = now or datetime.now(timezone.utc)
    events = json.loads((root/'special-events/registry.json').read_text())
    return [e for e in events if datetime.fromisoformat(e['expiresAt']) <= now]


def exclusions(events):
    paths = set()
    for event in events:
        paths.add(event['page'].lstrip('/'))
        paths.add(event['data'].lstrip('/'))
        for asset in event.get('assets', []):
            # Only explicitly assigned event assets; shared theme/code remain.
            if not asset.startswith('/special-events/assets/'+event['id']+'/') or '..' in PurePosixPath(asset).parts:
                raise ValueError('Unsafe event-specific asset path')
            paths.add(asset.lstrip('/'))
    return paths


def excluded(name, paths):
    return any(name == p or p.endswith('/') and name.startswith(p) for p in paths)


def filtered(name, raw, events):
    if name == 'home.json':
        home = json.loads(raw); ids = {e['id'] for e in events}
        for chip in home['chips']:
            if 'cards' in chip:
                chip['cards'] = [c for c in chip['cards'] if c.get('eventId') not in ids]
        home['retiredSpecialEvents'] = sorted(set(home.get('retiredSpecialEvents', [])) | {e['page'] for e in events})
        return (json.dumps(home, indent=2, ensure_ascii=False)+'\n').encode()
    if name == 'special-events/registry.json':
        ids = {e['id'] for e in events}
        return (json.dumps([e for e in json.loads(raw) if e['id'] not in ids], indent=2)+'\n').encode()
    return raw
