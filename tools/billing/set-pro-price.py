#!/usr/bin/env python3
"""Add the $5 monthly price to the existing Pro products. No subscription changes.

Default is read-only. --apply creates/reuses prices and updates product defaults;
the existing prices, keys, portals, webhooks and customer records are preserved.
"""
import argparse,importlib.util,json
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('setup',HERE/'prepare-webhook.py');setup=importlib.util.module_from_spec(spec);spec.loader.exec_module(setup)
LEGACY={'test':'price_1UYCoYPylm4UechMfDQJur0b','live':'price_1UYCyLPylm4UechMwGuCKwdH'}
PRODUCTS={'test':'prod_VZLVebM4SPstbL','live':'prod_VZLfx6PwAYLksw'}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--apply',action='store_true');args=p.parse_args()
 original=setup.stripe('whoami','--format','json')
 if original.get('account_id')!='acct_1UFxBXPylm4UechM':raise SystemExit('Expected the existing Austin.chat account.')
 results={}
 try:
  for mode in ('test','live'):
   setup.stripe('switch',original['account_id'],*(['--live'] if mode=='live' else []),'--format','json')
   def api(*parts):return setup.stripe(*parts,*(['--live'] if mode=='live' else []),'--confirm','--stripe-version=2026-10-28.endive')
   old=api('prices','retrieve',LEGACY[mode]);assert old['product']==PRODUCTS[mode] and old['unit_amount']==800 and old['currency']=='usd'
   subscriptions=api('subscriptions','list','-d','price='+old['id'],'-d','status=all','--limit=100');assert not subscriptions.get('has_more')
   counts={status:sum(s['status']==status for s in subscriptions['data']) for status in sorted({s['status'] for s in subscriptions['data']})}
   prices=api('prices','list','-d','lookup_keys[]=austin_chat_pro_monthly_usd_5','--limit=100');assert not prices.get('has_more')
   current=prices['data'][0] if prices['data'] else None
   if args.apply and not current:
    current=api('prices','create','--idempotency=austin-chat-pro-five-'+mode+'-v1','-d','product='+old['product'],'-d','unit_amount=500','-d','currency=usd','-d','recurring[interval]=month','-d','lookup_key=austin_chat_pro_monthly_usd_5')
   if current:
    assert current['product']==old['product'] and current['unit_amount']==500 and current['currency']=='usd' and current['active'] and current['livemode']==(mode=='live') and current['recurring']['interval']=='month' and current['recurring']['interval_count']==1
    if args.apply:api('products','update',old['product'],'-d','default_price='+current['id'])
   results[mode]={'price':current['id'] if current else None,'legacyPrice':old['id'],'oldSubscriptionCounts':counts}
  print(json.dumps(results,indent=2))
 finally:setup.stripe('switch',original['account_id'],*(['--live'] if original['mode']=='live' else []),'--format','json')
if __name__=='__main__':main()
