"""Route regressions on either local pgRouting 4 or hosted pgRouting 3.4.

Synthetic roads live inside a rolled-back transaction. Production data is never
modified. Geographic smoke checks use an explicitly selected network version.
"""
import argparse
import json
from pathlib import Path
import time
from admin import query

FIXTURE = """
begin;
insert into routing.networks(id,label,metadata,extent) values(999999999,'transactional test','{}',
  public.st_multi(public.st_makeenvelope(-97.75,30.26,-97.72,30.29,4326)));
insert into routing.roads(version,id,way,source,target,length,fwd,rev,highway,toll,access,estimated,name,blocked,main,zone,geom)
select 999999999,id,id,s,t,public.st_length(g::public.geography),cost,-1,'residential',false,'public',false,'Test',false,true,0,g
from (values
  (1,1001,1002,60,public.st_geomfromtext('LINESTRING(-97.740 30.270,-97.739 30.270)',4326)),
  (2,1002,1003,60,public.st_geomfromtext('LINESTRING(-97.739 30.270,-97.738 30.270)',4326)),
  (3,1003,1004,60,public.st_geomfromtext('LINESTRING(-97.738 30.270,-97.737 30.270)',4326)),
  (4,1002,1005,120,public.st_geomfromtext('LINESTRING(-97.739 30.270,-97.739 30.271)',4326)),
  (5,1005,1003,120,public.st_geomfromtext('LINESTRING(-97.739 30.271,-97.738 30.270)',4326))
) e(id,s,t,cost,g);
do $$ declare r jsonb; begin
  r:=routing.calculate(-97.7398,30.270,-97.7372,30.270,false,999999999);
  if r->>'status'<>'ready' or (r->>'driveMinutes')::int<>3 then raise exception 'Direct path failed: %',r; end if;
  r:=routing.calculate(-97.7398,30.270,-97.7392,30.270,false,999999999);
  if r->>'status'<>'ready' or (r->>'distanceMeters')::int>80 or (r->>'distanceMeters')::int<40 then raise exception 'Fractional edge failed: %',r; end if;
  if abs((r->'geometry'->'coordinates'->0->>0)::float8 - (-97.7398))>0.000001 then raise exception 'Geometry is not oriented from start'; end if;
  r:=routing.calculate(-97.7372,30.270,-97.7398,30.270,false,999999999);
  if r->>'status'='ready' then raise exception 'Illegal one-way reverse accepted'; end if;
  insert into routing.turns(version,path) values(999999999,array[1,2,3]::bigint[]);
  r:=routing.calculate(-97.7398,30.270,-97.7372,30.270,false,999999999);
  if r->>'status'<>'ready' or (r->>'driveMinutes')::int<5 then raise exception 'Intermediate-way restriction detour failed: %',r; end if;
  update routing.roads set blocked=true where version=999999999 and id in (4,5);
  r:=routing.calculate(-97.7398,30.270,-97.7372,30.270,false,999999999);
  if r->>'status'='ready' then raise exception 'Prohibited-only route accepted: %',r; end if;
  update routing.roads set blocked=false where version=999999999;
  delete from routing.turns where version=999999999;
  update routing.roads set toll=true where version=999999999 and id=2;
  r:=routing.calculate(-97.7398,30.270,-97.7372,30.270,true,999999999);
  if r->>'status'<>'ready' or (r->>'usesToll')::boolean or (r->>'driveMinutes')::int<5 then raise exception 'Toll avoidance failed: %',r; end if;
  r:=routing.calculate(-98.5,31,-97.7372,30.270,false,999999999);
  if r->>'status'<>'outside_network' then raise exception 'Coverage check failed'; end if;
end $$;
rollback;
select 'fractional endpoints, direction, multi-road restriction, prohibited-only route, toll avoidance, coverage passed' as checks;
"""


def check(remote, version):
    if remote:
        run = query
    else:
        import psycopg
        connection = psycopg.connect('dbname=austin_routing', autocommit=True)

        def run(sql):
            cursor = connection.execute(sql)
            while cursor.nextset():
                pass
            return cursor.fetchall() if cursor.description else []
    print(run(FIXTURE), flush=True)
    tests = json.loads(Path(__file__).with_name('test_routes.json').read_text())
    for pair in tests:
        for avoid in (False, True):
            started = time.time()
            lon1, lat1 = pair['from']
            lon2, lat2 = pair['to']
            result = run(f"select routing.calculate({lon1},{lat1},{lon2},{lat2},{str(avoid).lower()},{version})-'geometry' as route")
            data = result[0]['route'] if remote else result[0][0]
            expected = 'needs_entrance' if 'airport' in pair['name'] else 'ready'
            if data['status'] != expected or (avoid and data.get('usesToll')):
                raise AssertionError(f"{pair['name']}, avoid={avoid}: {data}")
            print(json.dumps({'pair':pair['name'],'avoidTolls':avoid,'ms':round((time.time()-started)*1000),**data}), flush=True)


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--supabase',action='store_true')
    parser.add_argument('--version',type=int,required=True)
    args=parser.parse_args()
    check(args.supabase,args.version)
