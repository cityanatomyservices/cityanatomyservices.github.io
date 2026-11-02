#!/usr/bin/env python3
"""Deploy email reminders or securely connect the existing Resend account.
Credentials are read in memory and never written to the repository or printed.
"""
import argparse
import getpass
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
PROJECT = 'aqbyxpiwugcvoephsvpm'


def api(path, data=None, method=None):
    token = (Path.home() / '.supabase/access-token').read_text().strip()
    request = urllib.request.Request('https://api.supabase.com/v1/projects/' + PROJECT + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
        method=method or ('POST' if data is not None else 'GET'))
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        # Never echo a management response: it can contain submitted secrets.
        raise SystemExit(f'Supabase setup request failed (HTTP {error.code}).') from None


def query(sql):
    return api('/database/query', {'query': sql})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--deploy', action='store_true')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--enable', action='store_true', help='Prompt privately for a Resend sending API key')
    mode.add_argument('--disable', action='store_true')
    args = parser.parse_args()
    if args.deploy:
        query((ROOT / 'supabase/migrations/0010_event_reminders.sql').read_text())
        print('Reminder database installed.')
        cron_secret = secrets.token_hex(32)
        api('/secrets', [{'name': 'REMINDER_CRON_SECRET', 'value': cron_secret}])
        # The random secret contains only hex. No credentials in Cron commands.
        query("""
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
do $block$
declare sid uuid;
begin
  select id into sid from vault.secrets where name='austin_reminder_cron';
  if sid is null then perform vault.create_secret('%s','austin_reminder_cron');
  else perform vault.update_secret(sid,'%s'); end if;
end $block$;
create or replace function public.reminder_tick() returns void
language plpgsql security definer set search_path='' as $fn$
begin
  perform net.http_post(
    url:='https://%s.supabase.co/functions/v1/reminder-send',
    headers:=jsonb_build_object('Content-Type','application/json','x-reminder-cron',
      (select decrypted_secret from vault.decrypted_secrets where name='austin_reminder_cron')),
    body:='{}'::jsonb,timeout_milliseconds:=120000);
end $fn$;
revoke all on function public.reminder_tick() from public,anon,authenticated,service_role;
do $block$
begin
  if not exists(select 1 from cron.job where jobname='austin-email-reminders') then
    perform cron.schedule('austin-email-reminders','* * * * *','select public.reminder_tick()');
    perform cron.alter_job(jobid,active:=false) from cron.job where jobname='austin-email-reminders';
  end if;
end $block$;
""" % (cron_secret, cron_secret, PROJECT))
        cli = shutil.which('supabase') or str(Path.home() / '.local/bin/supabase')
        env = dict(os.environ, SUPABASE_ACCESS_TOKEN=(Path.home() / '.supabase/access-token').read_text().strip())
        subprocess.run([cli, 'functions', 'deploy', 'reminders', 'reminder-send', '--project-ref', PROJECT, '--use-api'], cwd=ROOT, env=env, check=True)
        print('Functions and private Cron schedule installed. Existing activation is preserved.')
    if args.enable:
        key = os.environ.get('RESEND_API_KEY') or getpass.getpass('Resend sending API key (hidden): ').strip()
        if not key.startswith('re_') or len(key) < 15:
            raise SystemExit('Expected a Resend API key. No settings changed.')
        api('/secrets', [{'name': 'RESEND_API_KEY', 'value': key},
                        {'name': 'REMINDER_FROM', 'value': 'Austin.chat <no-reply@login.austin.chat>'},
                        {'name': 'REMINDERS_ENABLED', 'value': 'true'}])
        query("select cron.alter_job(jobid,active:=true) from cron.job where jobname='austin-email-reminders'")
        print('Email reminders enabled. Verify delivery with an event selected in your own account.')
    if args.disable:
        api('/secrets', [{'name': 'REMINDERS_ENABLED', 'value': 'false'}])
        query("select cron.alter_job(jobid,active:=false) from cron.job where jobname='austin-email-reminders'")
        print('Email reminders paused; selections are preserved.')
    names = {row['name'] for row in api('/secrets')}
    print(json.dumps({'resendKeyStored': 'RESEND_API_KEY' in names,
                      'senderStored': 'REMINDER_FROM' in names,
                      'cron': query("select jobname,active from cron.job where jobname='austin-email-reminders'")}, indent=2))


if __name__ == '__main__':
    main()
