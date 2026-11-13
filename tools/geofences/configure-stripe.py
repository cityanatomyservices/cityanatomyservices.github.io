#!/usr/bin/env python3
"""Prepare the $10 geofence product/portal/webhook via an authorized Stripe CLI.

No customers, subscriptions or charges are created. Payment collection remains
OFF unless --activate is explicitly selected after published verification.
Secrets go directly to Supabase, never to stdout, source, or process arguments.
"""
import argparse,importlib.util,json,os,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('config',ROOT/'tools/billing/configure.py');config=importlib.util.module_from_spec(spec);spec.loader.exec_module(config)
URL='https://'+config.PROJECT+'.supabase.co/functions/v1/geofence-webhook'
EVENTS=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed','invoice.paid','invoice.payment_failed','invoice.marked_uncollectible','invoice.voided','customer.deleted']
def main():
 p=argparse.ArgumentParser();p.add_argument('--activate',action='store_true',help='Enable live checkout after configuration and published verification');args=p.parse_args()
 cli=os.environ.get('STRIPE_CLI') or shutil.which('stripe')
 if not cli:
  candidate=Path(os.environ.get('LOCALAPPDATA',''))/'Programs/StripeCLI/stripe.exe'
  if candidate.is_file():cli=str(candidate)
 if not cli:raise SystemExit('An authorized Stripe CLI is needed. Connect Stripe or run on the laptop where Stripe was authorized. No billing settings changed.')
 identity=subprocess.run([cli,'whoami','--format','json'],capture_output=True,text=True,timeout=30)
 if identity.returncode:raise SystemExit('Sign in to the Stripe CLI first. No billing settings changed.')
 identity=json.loads(identity.stdout)
 if identity.get('account_id')!='acct_1UFxBXPylm4UechM' or identity.get('mode')!='live':
  raise SystemExit('Select the existing Austin.chat Stripe account in live mode first: stripe switch acct_1UFxBXPylm4UechM --live. No billing settings changed.')
 def stripe(*parts):
  result=subprocess.run([cli,*parts,'--live','--confirm','--stripe-version=2026-10-28.endive'],capture_output=True,text=True,timeout=90)
  if result.returncode:raise SystemExit('Stripe configuration request failed; response suppressed to protect credentials.')
  try:value=json.loads(result.stdout[result.stdout.index('{'):])
  except (ValueError,TypeError):raise SystemExit('Unexpected Stripe response; credentials suppressed.') from None
  if value.get('error'):raise SystemExit('Stripe rejected configuration: '+str(value['error'].get('code') or value['error'].get('type'))+'. Credentials suppressed.')
  return value
 def create(resource,values,key):
  parts=[resource,'create','--idempotency='+key]
  for k,v in values.items():parts+=['-d',k+'='+str(v)]
  return stripe(*parts)
 # Confirm the existing account's catalog before creating any new live objects.
 pro=stripe('prices','retrieve','price_1UbJdfPylm4UechMB1GxVKGy')
 assert pro['livemode'] and pro['unit_amount']==500 and pro['currency']=='usd'
 prices=stripe('prices','list','-d','lookup_keys[]=austin_chat_geofence_monthly_usd','--limit=100')
 if prices['data']:price=prices['data'][0]
 else:
  product=create('products',{'name':'Austin.chat Custom Geofence','description':'One 10–100 meter chat circle, permanent map page and QR code. Monthly subscription.','metadata[site]':'austin.chat','metadata[product]':'custom_geofence'},'austin-geofence-product-live-v1')
  price=create('prices',{'product':product['id'],'unit_amount':1000,'currency':'usd','recurring[interval]':'month','lookup_key':'austin_chat_geofence_monthly_usd'},'austin-geofence-price-live-v1')
 assert price['livemode'] and price['active'] and price['unit_amount']==1000 and price['currency']=='usd' and price['recurring']['interval']=='month' and price['recurring']['interval_count']==1
 configs=stripe('billing_portal','configurations','list','--limit=100');assert not configs.get('has_more')
 existing=next((x for x in configs['data'] if x.get('metadata',{}).get('product')=='custom_geofence' and x.get('active')),None)
 portal=existing
 if not portal:
  parts=['billing_portal','configurations','create','--idempotency=austin-geofence-portal-live-v1']
  fields={'name':'Austin.chat Custom Geofences','metadata[site]':'austin.chat','metadata[product]':'custom_geofence','business_profile[headline]':'Manage your chat geofence','default_return_url':'https://austin.chat/geofences/manage/?billing=return','features[invoice_history][enabled]':'true','features[payment_method_update][enabled]':'true','features[subscription_cancel][enabled]':'true','features[subscription_cancel][mode]':'at_period_end','features[subscription_cancel][proration_behavior]':'none','features[subscription_update][enabled]':'false','features[customer_update][enabled]':'false'}
  for k,v in fields.items():parts+=['-d',k+'='+v]
  portal=stripe(*parts)
 assert portal['features']['subscription_cancel']['mode']=='at_period_end' and not portal['features']['subscription_update']['enabled']
 endpoints=stripe('webhook_endpoints','list','--limit=100');assert not endpoints.get('has_more');webhook=next((x for x in endpoints['data'] if x['url']==URL),None)
 settings={'GEOFENCE_BILLING_MODE':'live','GEOFENCE_STRIPE_PRICE':price['id'],'GEOFENCE_STRIPE_PORTAL':portal['id']}
 if not webhook:
  parts=['webhook_endpoints','create','--url='+URL,'--api-version=2026-10-28.endive','--description=Austin.chat custom geofence subscriptions','--idempotency=austin-geofence-webhook-live-v1','-d','metadata[site]=austin.chat','-d','metadata[product]=custom_geofence']+['--enabled-events='+e for e in EVENTS]
  webhook=stripe(*parts);settings['GEOFENCE_STRIPE_WEBHOOK_SECRET']=webhook['secret']
 else:
  names={r['name'] for r in json.loads(config.cli('secrets','list','--remote='+config.PROJECT,'--output','json'))}
  if 'GEOFENCE_STRIPE_WEBHOOK_SECRET' not in names:raise SystemExit('Existing geofence webhook signing secret needs to be stored securely before activation.')
 assert webhook['livemode'] and webhook['status']=='enabled' and webhook['api_version']=='2026-10-28.endive'
 assert set(EVENTS).issubset(set(webhook['enabled_events']))
 if args.activate:
  import urllib.request
  html=urllib.request.urlopen('https://austin.chat/geofences/manage/',timeout=30).read()
  assert b'20261109h' in html and b'$10/month' in html,'Publish and verify the feature before activation'
  settings['GEOFENCE_CHECKOUT_ENABLED']='true'
 else:settings['GEOFENCE_CHECKOUT_ENABLED']='false'
 config.store_secrets(settings)
 print('Custom geofence $10 USD monthly price, cancellation portal and signed webhook configured. Checkout '+('enabled.' if args.activate else 'remains disabled.'))
 print(json.dumps({'price':price['id'],'portal':portal['id'],'webhook':webhook['id']}))
if __name__=='__main__':main()
