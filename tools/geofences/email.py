#!/usr/bin/env python3
"""Prepare geofence email delivery using the installed Resend key and sender.

--apply installs migration 0020 after rollback tests; --functions deploys email
and management endpoints. --enable activates a separate authenticated Cron job.
Existing Auth, reminder and billing credentials/configuration are preserved.
"""
import argparse,importlib.util,json,secrets
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('config',ROOT/'tools/billing/configure.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--apply',action='store_true');p.add_argument('--functions',action='store_true');g=p.add_mutually_exclusive_group();g.add_argument('--enable',action='store_true');g.add_argument('--disable',action='store_true');args=p.parse_args()
 installed=json.loads(c.query("select to_regclass('geofence_private.email_jobs') is not null as installed",True))[0]['installed']
 migration=(ROOT/'supabase/migrations/0020_geofence_email.sql').read_text(encoding='utf-8');checks=(ROOT/'tests/geofences/email.sql').read_text(encoding='utf-8')
 c.query(checks if installed else migration.rsplit('commit;',1)[0]+checks.replace('begin;','',1));print('Email database permissions, owner isolation, verification, queue deduplication and delivery leases passed; fixtures rolled back.',flush=True)
 if args.apply and not installed:c.query(migration);installed=True;print('Migration 0020 applied.',flush=True)
 if args.functions:
  if not installed:raise SystemExit('Apply the migration first.')
  c.cli('functions','deploy','geofences','geofence-send','geofence-email','--remote='+c.PROJECT,'--use-api','--yes');print('Geofence email and management functions deployed.',flush=True)
 if args.enable:
  if not installed:raise SystemExit('Apply the migration first.')
  names={v['name'] for v in json.loads(c.cli('secrets','list','--remote='+c.PROJECT,'--output','json'))}
  assert {'RESEND_API_KEY','REMINDER_FROM'}<=names,'Connect the existing email sender first.'
  vault_ready=json.loads(c.query("select exists(select 1 from vault.secrets where name='austin_geofence_cron') as ready",True))[0]['ready']
  if 'GEOFENCE_CRON_SECRET' not in names or not vault_ready:
   secret=secrets.token_hex(32);c.store_secrets({'GEOFENCE_CRON_SECRET':secret})
   c.query("do $$declare sid uuid;begin select id into sid from vault.secrets where name='austin_geofence_cron';if sid is null then perform vault.create_secret('"+secret+"','austin_geofence_cron');else perform vault.update_secret(sid,'"+secret+"');end if;end $$;")
  c.query("""
create or replace function public.geofence_mail_tick() returns void language plpgsql security definer set search_path='' as $$
begin perform net.http_post(url:='https://aqbyxpiwugcvoephsvpm.supabase.co/functions/v1/geofence-send',headers:=jsonb_build_object('Content-Type','application/json','x-geofence-cron',(select decrypted_secret from vault.decrypted_secrets where name='austin_geofence_cron')),body:='{}'::jsonb,timeout_milliseconds:=120000);end $$;
revoke all on function public.geofence_mail_tick() from public,anon,authenticated,service_role;
select cron.schedule('austin-geofence-email','* * * * *','select public.geofence_mail_tick()');
update cron.job set active=true where jobname='austin-geofence-email';
""")
  c.store_secrets({'GEOFENCE_EMAIL_ENABLED':'true'});print('Geofence email enabled. Existing Resend, Auth, reminder and billing settings preserved.',flush=True)
 if args.disable:
  c.store_secrets({'GEOFENCE_EMAIL_ENABLED':'false'});c.query("update cron.job set active=false where jobname='austin-geofence-email'");print('Geofence email paused.',flush=True)
if __name__=='__main__':main()
