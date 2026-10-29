"""Load an inactive network locally or through the Supabase management API.

No database passwords are embedded. --activate is separate and validates counts.
An identical version can be resumed after a connection failure.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
from admin import query

ROOT = Path(__file__).resolve().parent


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def load(folder, version, remote=False, activate=False):
    connection = None
    if remote:
        run = query
    else:
        import psycopg
        connection = psycopg.connect('dbname=austin_routing', autocommit=True)

        def run(sql):
            cursor = connection.execute(sql)
            return cursor.fetchall() if cursor.description else []

    metadata = json.loads((folder / 'network.json').read_text())
    digest = hashlib.sha256()
    for name in ('roads.jsonl', 'turns.jsonl'):
        with (folder / name).open('rb') as source:
            for block in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(block)
    metadata['sha256'] = digest.hexdigest()
    # Local paths are irrelevant to the public network metadata.
    metadata.pop('review_gpkg', None)
    extent = json.loads((ROOT / 'extent.geojson').read_text())['features'][0]['geometry']
    label = 'Austin metro · ' + metadata['osm_latest_timestamp'][:10]
    run(f"""DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM routing.networks WHERE id={version} AND metadata->>'sha256'<>{literal(metadata['sha256'])})
      THEN RAISE EXCEPTION 'Version already contains a different build; choose a new version'; END IF;
      END $$;
      INSERT INTO routing.networks(id,label,metadata,extent) VALUES({version},{literal(label)},
        {literal(json.dumps(metadata))}::jsonb,public.st_multi(public.st_setsrid(public.st_geomfromgeojson({literal(json.dumps(extent))}),4326)))
      ON CONFLICT(id) DO NOTHING;""")

    for filename in ('roads.jsonl', 'turns.jsonl'):
        count, batch, started = 0, [], time.time()

        def flush(rows):
            data = literal('[' + ','.join(rows) + ']')
            if filename == 'roads.jsonl':
                sql = f"""INSERT INTO routing.roads(version,id,way,source,target,length,fwd,rev,highway,toll,access,estimated,name,blocked,main,zone,geom)
                  SELECT {version},id,way,source,target,length,fwd,rev,highway,toll,access,estimated,name,blocked,main,zone,
                    public.st_setsrid(public.st_geomfromwkb(decode(geom,'hex')),4326)
                  FROM jsonb_to_recordset({data}::jsonb) AS e(id bigint,way bigint,source bigint,target bigint,length real,
                    fwd real,rev real,highway text,toll boolean,access text,estimated boolean,name text,blocked boolean,main boolean,zone bigint,geom text)
                  ON CONFLICT(version,id) DO NOTHING;"""
            else:
                sql = f"""INSERT INTO routing.turns(version,path) SELECT {version},path
                  FROM jsonb_to_recordset({data}::jsonb) AS t(path bigint[]) ON CONFLICT DO NOTHING;"""
            run(sql)

        with (folder / filename).open() as f:
            for line in f:
                batch.append(line.strip())
                if len(batch) == 2000:
                    flush(batch)
                    count += len(batch)
                    batch = []
                    if count % 20000 == 0:
                        print(f'{filename}: {count:,} rows ({time.time()-started:.0f}s)', flush=True)
            if batch:
                flush(batch)
                count += len(batch)
        print(f'{filename}: {count:,} rows complete', flush=True)
    run(f"""ANALYZE routing.roads; ANALYZE routing.turns;
      DO $$ BEGIN
      IF (SELECT count(*) FROM routing.roads WHERE version={version})<>{metadata['edges']}
        OR (SELECT count(*) FROM routing.turns WHERE version={version})<>{metadata['turn_paths']}
      THEN RAISE EXCEPTION 'Network counts do not match build'; END IF;
      IF EXISTS(SELECT 1 FROM routing.turns t CROSS JOIN LATERAL unnest(t.path) edge
        WHERE t.version={version} AND NOT EXISTS(SELECT 1 FROM routing.roads r WHERE r.version={version} AND r.id=edge))
      THEN RAISE EXCEPTION 'Restriction references missing road'; END IF;
      END $$;""")
    if activate:
        run(f"BEGIN; UPDATE routing.networks SET active=false WHERE active; UPDATE routing.networks SET active=true WHERE id={version}; COMMIT;")
        print(f'Network {version} activated.', flush=True)
    else:
        print(f'Network {version} loaded INACTIVE; run route checks before activation.', flush=True)
    if connection:
        connection.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', type=Path)
    parser.add_argument('--version', type=int, required=True)
    parser.add_argument('--supabase', action='store_true')
    parser.add_argument('--activate', action='store_true')
    args = parser.parse_args()
    if args.version < 1:
        sys.exit('Version must be a positive integer.')
    load(args.folder, args.version, args.supabase, args.activate)
