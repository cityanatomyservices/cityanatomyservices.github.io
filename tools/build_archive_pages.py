#!/usr/bin/env python3
"""Generate per-category archive pages.

For each category in CATEGORIES below, writes ./{slug}/index.html — a
~25-line static shell that hands off to /templates/archive/archive.js.
That script does the real work (fetching chats from Supabase). This
script is safe to re-run; existing files are overwritten in place.

Keep CATEGORIES in sync with the APPS array in index.html.
"""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# (slug, display label, color, [hotspots.json URL(s)])
# Slug == appId stored in public.chats.app, matching the live-map APPS array.
CATEGORIES = [
    ("pubchat",          "Pubs & Bars",       "#e11d74", ["/data/pubchat/hotspots.json"]),
    ("foodtrucks",       "Food Trucks",       "#10b981", ["/data/foodtrucks/hotspots.json"]),
    ("parks",            "Parks",             "#16a34a", ["/data/parks/hotspots.json"]),
    ("culturespots",     "Culture Spots",     "#d946ef", ["/data/culturespots/hotspots.json"]),
    ("museums",          "Museums",           "#a16207", ["/data/museums/hotspots.json"]),
    ("capital",          "Capitol",           "#1e40af", ["/data/capital/hotspots.json"]),
    ("airport",          "Airport",           "#fb923c", ["/data/airport/hotspots.json"]),
    ("campuses",         "Campuses",          "#bf5700", ["/data/campuses/hotspots.json"]),
    ("clinics",          "Hospitals",         "#ef4444", ["/data/clinics/hotspots.json"]),
    ("grocerystores",    "Grocery Stores",    "#7c3aed", [
        "/data/walmart/hotspots.json",
        "/data/HEBs/hotspots.json",
        "/data/target/hotspots.json",
    ]),
    ("hardware",         "Hardware Stores",   "#ea580c", ["/data/hardware/hotspots.json"]),
    ("golf",             "Golf Courses",      "#047857", ["/data/golf/hotspots.json"]),
    ("starbucks",        "Starbucks",         "#006241", ["/data/starbucks/hotspots.json"]),
    ("malls",            "Malls",             "#65a30d", ["/data/malls/hotspots.json"]),
    ("newcomers",        "Newcomers",         "#14b8a6", ["/data/newcomers/hotspots.json"]),
    ("apartments",       "Apartments",        "#475569", ["/data/apartments/hotspots.json"]),
    ("hotels",           "Hotels",            "#0891b2", ["/data/hotels/hotspots.json"]),
    ("sports",           "Sports Venues",     "#facc15", ["/data/sports/hotspots.json"]),
    ("temporarymarkets",   "Pop-up Markets",            "#f59e0b", ["/data/temporarymarkets/hotspots.json"]),
    ("festivals",          "Festivals & Fairs",         "#f43f5e", ["/data/festivals/hotspots.json"]),
    ("concertsshows",      "Concerts & Shows",          "#be123c", ["/data/concertsshows/hotspots.json"]),
    ("comedymics",         "Comedy & Open Mics",        "#fbbf24", ["/data/comedymics/hotspots.json"]),
    ("artgalleries",       "Art Openings & Galleries",  "#a855f7", ["/data/artgalleries/hotspots.json"]),
    ("popupshops",         "Pop-up Shops",              "#c2410c", ["/data/popupshops/hotspots.json"]),
    ("meetupsclasses",     "Meetups & Classes",         "#38bdf8", ["/data/meetupsclasses/hotspots.json"]),
    ("grouprunsoutdoors",  "Group Runs & Outdoor Meets","#22c55e", ["/data/grouprunsoutdoors/hotspots.json"]),
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
