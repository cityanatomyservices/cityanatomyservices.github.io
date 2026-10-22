#!/usr/bin/env python3
"""
build-list-csv.py — Export a sellable list (materialized view) to CSV.

Reads from the materialized view named `list_<slug>` in Supabase Postgres
(connection via libpq env vars, same as the load-zoning workflow), writes
the full export to --out, and a buyer-facing sample of N rows to
--sample-out (used as the public teaser shown on services/lists/).

Run via the refresh-lists.yml GitHub workflow after refresh_lists.sql has
rebuilt the view.

Usage:
    python3 scripts/build-list-csv.py \\
        --slug contractor_active_permits \\
        --out  exports/contractor_active_permits.csv \\
        --sample-out content/list-samples/contractor_active_permits.csv \\
        --sample-rows 20
"""

from __future__ import annotations

import argparse
import csv
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def run_psql_csv(sql: str) -> list[list[str]]:
    """Run a single SELECT via psql in CSV mode and return rows including header."""
    cmd = ["psql", "-v", "ON_ERROR_STOP=1", "--csv", "-c", sql]
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return list(csv.reader(result.stdout.splitlines()))


def export_list(slug: str, out_path: Path, sample_out: Path | None,
                sample_rows: int) -> int:
    view = f"public.list_{slug}"

    # Sanity: confirm the view exists before SELECTing from it.
    check = run_psql_csv(
        f"select to_regclass('{view}') is not null as exists"
    )
    if len(check) < 2 or check[1][0].lower() not in ("t", "true"):
        print(f"ERROR: materialized view {view} does not exist", file=sys.stderr)
        return 1

    # Full export.
    rows = run_psql_csv(f"select * from {view};")
    if not rows:
        print(f"ERROR: empty psql response for {view}", file=sys.stderr)
        return 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)

    n_data = max(0, len(rows) - 1)
    print(f"Wrote {out_path} ({n_data} rows)")

    # Sample teaser. Static row count, deterministic order so the public
    # teaser doesn't churn each refresh when the underlying set is stable.
    if sample_out is not None:
        sample = run_psql_csv(
            f"select * from {view} "
            f"order by issued_date desc nulls last, permit_id "
            f"limit {int(sample_rows)};"
        )
        sample_out.parent.mkdir(parents=True, exist_ok=True)
        with sample_out.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            # Buyer-facing teaser: prepend a comment row that names the
            # source and refresh timestamp. CSV consumers tolerate a
            # leading comment row when documented.
            stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
            w.writerow([f"# Sample of {slug} — refreshed {stamp} UTC. "
                        f"Source: data.austintexas.gov + OpenStreetMap. "
                        f"Full list available at austin.chat/services/lists/."])
            w.writerows(sample)
        print(f"Wrote {sample_out} ({max(0, len(sample) - 1)} rows)")

    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Export a sellable list to CSV.")
    p.add_argument("--slug", required=True,
                   help="List slug; reads from public.list_<slug>")
    p.add_argument("--out", required=True, help="Full CSV export path")
    p.add_argument("--sample-out", default="",
                   help="Optional public sample CSV path")
    p.add_argument("--sample-rows", type=int, default=20)
    args = p.parse_args()

    if not os.environ.get("PGPASSWORD") and not os.environ.get("PGSERVICE"):
        print("ERROR: no PGPASSWORD or PGSERVICE in env; "
              "set libpq vars before invoking", file=sys.stderr)
        return 2

    sample_out = Path(args.sample_out) if args.sample_out else None
    return export_list(args.slug, Path(args.out), sample_out, args.sample_rows)


if __name__ == "__main__":
    sys.exit(main())
