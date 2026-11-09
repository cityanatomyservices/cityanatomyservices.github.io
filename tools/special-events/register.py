#!/usr/bin/env python3
"""Register/update one event's dates and 48-hour retention; no credentials are printed.

First add its entry to special-events/registry.json. Review computed dates with
this command, then use --apply to update both the server registry and this file.
The last published participant closing or general event closing wins.
"""
import argparse
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[2]


def closing(event):
    dates=event['dates'];offset=event['utcOffset'];hours=event['hours']
    last=max(dates)
    if hours['close']<=hours['open']:
        last=(datetime.fromisoformat(last)+timedelta(days=1)).date().isoformat()
    ends=[datetime.fromisoformat(last+'T'+hours['close']+':00'+offset)]
    for feature in event['features']:
        p=feature['properties']
        if p.get('end'):
            ends.append(datetime.fromisoformat(p['end']))
        for profile in p.get('profiles',[]):
            for day,windows in profile['availability'].get('days',{}).items():
                for window in windows:
                    d=datetime.fromisoformat(day)+timedelta(days=bool(window.get('nextDay')))
                    ends.append(datetime.fromisoformat(d.date().isoformat()+'T'+window['close']+':00'+offset))
    return max(ends)


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('id');parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    if not re.fullmatch('[a-z0-9-]+',args.id) or args.id=='main':raise SystemExit('Invalid event ID')
    file=ROOT/'special-events/registry.json';registry=json.loads(file.read_text());entry=next((e for e in registry if e['id']==args.id),None)
    if not entry or entry['data']!='/special-events/data/'+args.id+'.geojson' or not re.fullmatch('/maps/[a-z0-9-]+/',entry['page']):raise SystemExit('Add a valid event entry to registry.json first.')
    event=json.loads((ROOT/entry['data'].lstrip('/')).read_text());assert event['id']==args.id
    closes=closing(event);expires=closes.astimezone(timezone.utc)+timedelta(hours=48)
    if expires<=datetime.now(timezone.utc):raise SystemExit('Expired events cannot be registered again.')
    entry.update(title=event['title'],dates=event['dates'],closesAt=closes.isoformat(),expiresAt=expires.astimezone(closes.tzinfo).isoformat())
    print(json.dumps(entry,indent=2))
    if not args.apply:return
    spec=importlib.util.spec_from_file_location('configure',ROOT/'tools/billing/configure.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
    quote=lambda value:"'"+value.replace("'","''")+"'"
    values=[entry['id'],entry['title'],entry['page'],json.dumps(entry['dates']),entry['closesAt']]
    c.query('insert into public.special_events(id,title,page_path,dates,closes_at) values('+','.join(map(quote,values))+') on conflict(id) do update set title=excluded.title,page_path=excluded.page_path,dates=excluded.dates,closes_at=excluded.closes_at;')
    file.write_text(json.dumps(registry,indent=2,ensure_ascii=False)+'\n')
    home_path=ROOT/'home.json';home=json.loads(home_path.read_text())
    for chip in home['chips']:
        for card in chip.get('cards',[]):
            if '/maps/'+card.get('slug','')+'/'==entry['page']:card.update(eventId=entry['id'],expiresAt=entry['expiresAt'])
    home_path.write_text(json.dumps(home,indent=2,ensure_ascii=False)+'\n')
    print('Server deadline and local catalog updated. Publish the site changes together.')


if __name__=='__main__':main()
