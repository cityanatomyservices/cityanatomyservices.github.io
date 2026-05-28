"""Build data/austinfeed/feed.json from every source in `sources/`.

Add a lane by dropping a module into `sources/` that exposes a
top-level `scrape() -> list[FeedItem]`. The module name is the source
id; a failure in one source never blocks the others.

Usage:
    python -m tools.austin_feed.run
    python -m tools.austin_feed.run --dry-run
"""

from __future__ import annotations

import argparse
import importlib
import pkgutil
import sys
from pathlib import Path

# Allow `python -m tools.austin_feed.run` without `pip install -e`.
REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO))

from tools.austin_feed.common import FeedItem, write_feed   # noqa: E402
from tools.austin_feed import sources                       # noqa: E402


def discover_sources():
    for _, name, _ in pkgutil.iter_modules(sources.__path__):
        if name.startswith("_"):
            continue
        mod = importlib.import_module(f"tools.austin_feed.sources.{name}")
        if hasattr(mod, "scrape"):
            yield name, mod.scrape


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="print the feed JSON instead of writing it")
    args = ap.parse_args()

    items: list[FeedItem] = []
    for name, scrape in discover_sources():
        try:
            batch = scrape() or []
        except Exception as e:
            print(f"[{name}] failed: {e}")
            continue
        print(f"[{name}] {len(batch)} items")
        items.extend(batch)

    doc = write_feed(items, dry_run=args.dry_run)
    print(f"\n{len(doc['items'])} items written (after expiry + sort).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
