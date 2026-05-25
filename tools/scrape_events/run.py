"""Run every event scraper and merge results into data/<slug>/hotspots.json.

Add new scrapers by dropping a module into `sources/` that exposes a
top-level `scrape()` function returning `list[Event]`. The module name
is the source id; failures in one scraper don't block the others.

Usage:
    python -m tools.scrape_events.run

Designed to run hermetically in CI: only stdlib + venues.py lookups,
no live geocoding. Past events are NOT removed by this script —
render-time gating in index.html handles disappearance from the map.
A separate prune step can clean the JSON files later if file bloat
becomes an issue.
"""

from __future__ import annotations

import importlib
import pkgutil
import sys
from pathlib import Path

# Allow `python -m tools.scrape_events.run` to work without `pip install -e`.
REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO))

from tools.scrape_events.common import Event, merge_into_data_file  # noqa: E402
from tools.scrape_events.venues import VENUES                       # noqa: E402
from tools.scrape_events import sources                              # noqa: E402


def discover_scrapers():
    for _, name, _ in pkgutil.iter_modules(sources.__path__):
        if name.startswith("_"):
            continue
        mod = importlib.import_module(f"tools.scrape_events.sources.{name}")
        if hasattr(mod, "scrape"):
            yield name, mod.scrape


def main() -> int:
    all_events: list[Event] = []
    for name, scrape in discover_scrapers():
        try:
            batch = scrape() or []
        except Exception as e:
            print(f"[{name}] failed: {e}")
            continue
        print(f"[{name}] {len(batch)} events")
        all_events.extend(batch)

    if not all_events:
        print("No events fetched. Nothing to merge.")
        return 0

    summary = merge_into_data_file(all_events, VENUES)
    print("\nSummary:")
    for slug, s in sorted(summary.items()):
        print(f"  {slug:20s} +{s['added']} added, ~{s['updated']} updated, {s['skipped_no_coords']} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
