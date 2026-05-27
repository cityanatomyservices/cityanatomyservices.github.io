#!/usr/bin/env python3
"""Generate per-bucket chat archive pages.

For each bucket in CATEGORIES below, writes ./{slug}/index.html — a
~25-line static shell that hands off to /templates/archive/archive.js.
That script does the real work (fetching chats from Supabase). This
script is safe to re-run; existing files are overwritten in place.

Buckets collapse the original 25 per-category chats into four
always-on global rooms (Shopping / Services / Rec / Social). Each
bucket page loads every parent venue's hotspots.json so it can
resolve `hotspot_id → venue title` for the bubble metadata.

The fifth bucket — `events` — has its own lifecycle (per-event
persistent rooms snapshotted to temporary pages) and is intentionally
left out of this generator until that lifecycle ships.
"""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# (slug, display label, color, [hotspots.json URL(s)])
# Slug == appId stored in public.chats.app — must match the bucket id
# in the live-map BUCKETS array in index.html. The hotspot URLs cover
# every parent venue that routes its chat into this bucket, so the
# archive page can render "from {venue}" tags correctly.
CATEGORIES = [
    ("shopping", "Shopping", "#f97316", [
        "/data/walmart/hotspots.json",
        "/data/HEBs/hotspots.json",
        "/data/target/hotspots.json",
        "/data/hardware/hotspots.json",
        "/data/malls/hotspots.json",
        "/data/temporarymarkets/hotspots.json",
        "/data/popupshops/hotspots.json",
    ]),
    ("services", "Services", "#0ea5e9", [
        "/data/capital/hotspots.json",
        "/data/airport/hotspots.json",
        "/data/campuses/hotspots.json",
        "/data/clinics/hotspots.json",
        "/data/apartments/hotspots.json",
        "/data/hotels/hotspots.json",
    ]),
    ("rec", "Rec", "#16a34a", [
        "/data/parks/hotspots.json",
        "/data/museums/hotspots.json",
        "/data/golf/hotspots.json",
        "/data/sports/hotspots.json",
        "/data/concertsshows/hotspots.json",
        "/data/comedymics/hotspots.json",
        "/data/festivals/hotspots.json",
        "/data/meetupsclasses/hotspots.json",
        "/data/grouprunsoutdoors/hotspots.json",
    ]),
    ("social", "Social", "#e11d74", [
        "/data/pubchat/hotspots.json",
        "/data/foodtrucks/hotspots.json",
        "/data/starbucks/hotspots.json",
        "/data/culturespots/hotspots.json",
        "/data/newcomers/hotspots.json",
        "/data/artgalleries/hotspots.json",
    ]),
]

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{label} chat archive · austin.chat</title>
  <meta name="description" content="Recent public chats from {label_lc} geofenced on austin.chat.">
  <link rel="canonical" href="https://austin.chat/{slug}/">
  <meta property="og:title" content="{label} chat archive · austin.chat">
  <meta property="og:description" content="Recent public chats from {label_lc} geofenced on austin.chat.">
  <meta name="theme-color" content="#0e1117">
  <link rel="stylesheet" href="/templates/archive/archive.css">
</head>
<body>
  <script>window.ARCHIVE = {{
    appId: {slug_q},
    label: {label_q},
    color: {color_q},
    dataUrls: {data_urls_q}
  }};</script>
  <script src="/templates/pubchat/config.js"></script>
  <script src="/templates/archive/archive.js"></script>
</body>
</html>
"""


def jsq(s: str) -> str:
    """JSON-style double-quoted string for embedding in HTML."""
    import json
    return json.dumps(s)


def jsqlist(xs: list[str]) -> str:
    import json
    return json.dumps(xs)


def main() -> int:
    for slug, label, color, urls in CATEGORIES:
        dest = REPO / slug
        dest.mkdir(exist_ok=True)
        html = TEMPLATE.format(
            slug=slug,
            label=label,
            label_lc=label.lower(),
            slug_q=jsq(slug),
            label_q=jsq(label),
            color_q=jsq(color),
            data_urls_q=jsqlist(urls),
        )
        (dest / "index.html").write_text(html)
        print(f"  wrote {slug}/index.html")
    print(f"\n{len(CATEGORIES)} archive pages written.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
