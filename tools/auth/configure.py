#!/usr/bin/env python3
"""Prepare email-code templates and publish non-secret sign-in availability.

Provider secrets belong in Supabase, never in this repository. This script
uses the existing local Supabase management token and never prints config.
"""
import argparse
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
PROJECT = 'aqbyxpiwugcvoephsvpm'


def api(method='GET', data=None):
    token = (Path.home() / '.supabase/access-token').read_text().strip()
    request = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{PROJECT}/config/auth',
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
        method=method)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply-templates', action='store_true')
    parser.add_argument('--refresh-public-config', action='store_true')
    args = parser.parse_args()
    config = api()
    fields = ['mailer_templates_confirmation_content', 'mailer_templates_magic_link_content']
    if args.apply_templates:
        template = (ROOT / 'auth/email-code.html').read_text()
        patch = {}
        for field in fields:
            previous = config.get(field) or ''
            if '{{ .Token }}' in previous:
                continue
            # Keep existing links for other apps sharing this Supabase project.
            patch[field] = (previous + '\n<p>Your Austin.chat sign-in code: <strong>{{ .Token }}</strong></p>') if previous else template
        allowed = [url for url in (config.get('uri_allow_list') or '').split(',') if url]
        callback = 'https://austin.chat/auth/callback/'
        if callback not in allowed:
            patch['uri_allow_list'] = ','.join([*allowed, callback])
        if patch:
            api('PATCH', patch)
            config = api()
        print('Email-code templates and callback URL are configured.')
    smtp = all(config.get(key) for key in ['smtp_host', 'smtp_user', 'smtp_pass', 'smtp_admin_email'])
    templates = all('{{ .Token }}' in (config.get(field) or '') for field in fields)
    email = bool(config.get('external_email_enabled') and smtp and templates)
    google = bool(config.get('external_google_enabled') and config.get('external_google_client_id') and config.get('external_google_secret'))
    if args.refresh_public_config:
        (ROOT / 'auth/config.json').write_text(json.dumps({'emailEnabled': email}, indent=2) + '\n')
    print(json.dumps({'googleConfigured': google, 'emailSenderConfigured': bool(smtp), 'emailCodeTemplatesReady': templates, 'emailReady': email}, indent=2))


if __name__ == '__main__':
    main()
