#!/usr/bin/env python3
"""Generate per-bucket chat archive pages.

For each bucket below, writes ./{slug}/index.html — a thin static
shell that hands off to /templates/archive/archive.js. That script
renders the header, filters (category / location / date range), and
fetches the chat rows from Supabase.

Buckets collapse the original 25 per-category chats into four
always-on global rooms (Shopping / Services / Rec / Social). Each
bucket page knows about every user-facing category that routes into
it, and every venue's hotspots.json — that's how the location filter
gets populated and how each row's `hotspot_id` resolves back to a
venue name.

Events has its own per-event lifecycle and is not listed here.
"""

from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Each bucket is its own archive page. Categories under it are the
# user-facing labels from APP_META; dataUrls collect every hotspots.json
# the category covers (Grocery Stores spans walmart + HEB + target, for
# example). Keep this in sync with the APPS array in index.html.
BUCKETS = [
    {
        "slug": "shopping",
        "label": "Shopping",
        "color": "#f97316",
        "tagline": "Local sales, gift cards, market days, and weekly deals.",
        "categories": [
            {"slug": "grocerystores", "label": "Grocery Stores", "dataUrls": [
                "/data/walmart/hotspots.json",
                "/data/HEBs/hotspots.json",
                "/data/target/hotspots.json",
            ]},
            {"slug": "hardware",         "label": "Hardware Stores",  "dataUrls": ["/data/hardware/hotspots.json"]},
            {"slug": "malls",            "label": "Malls",            "dataUrls": ["/data/malls/hotspots.json"]},
            {"slug": "temporarymarkets", "label": "Pop-up Markets",   "dataUrls": ["/data/temporarymarkets/hotspots.json"]},
            {"slug": "popupshops",       "label": "Pop-up Shops",     "dataUrls": ["/data/popupshops/hotspots.json"]},
        ],
    },
    {
        "slug": "services",
        "label": "Services",
        "color": "#0ea5e9",
        "tagline": "Government, healthcare, lodging, transit, and campuses.",
        "categories": [
            {"slug": "capital",    "label": "Capitol",     "dataUrls": ["/data/capital/hotspots.json"]},
            {"slug": "airport",    "label": "Airport",     "dataUrls": ["/data/airport/hotspots.json"]},
            {"slug": "campuses",   "label": "Campuses",    "dataUrls": ["/data/campuses/hotspots.json"]},
            {"slug": "clinics",    "label": "Hospitals",   "dataUrls": ["/data/clinics/hotspots.json"]},
            {"slug": "apartments", "label": "Apartments",  "dataUrls": ["/data/apartments/hotspots.json"]},
            {"slug": "hotels",     "label": "Hotels",      "dataUrls": ["/data/hotels/hotspots.json"]},
        ],
    },
    {
        "slug": "rec",
        "label": "Rec",
        "color": "#16a34a",
        "tagline": "Parks, museums, venues, classes, and group meets.",
        "categories": [
            {"slug": "parks",             "label": "Parks",                       "dataUrls": ["/data/parks/hotspots.json"]},
            {"slug": "museums",           "label": "Museums",                     "dataUrls": ["/data/museums/hotspots.json"]},
            {"slug": "golf",              "label": "Golf Courses",                "dataUrls": ["/data/golf/hotspots.json"]},
            {"slug": "sports",            "label": "Sports Venues",               "dataUrls": ["/data/sports/hotspots.json"]},
            {"slug": "concertsshows",     "label": "Concerts & Shows",            "dataUrls": ["/data/concertsshows/hotspots.json"]},
            {"slug": "comedymics",        "label": "Comedy & Open Mics",          "dataUrls": ["/data/comedymics/hotspots.json"]},
            {"slug": "festivals",         "label": "Festivals & Fairs",           "dataUrls": ["/data/festivals/hotspots.json"]},
            {"slug": "meetupsclasses",    "label": "Meetups & Classes",           "dataUrls": ["/data/meetupsclasses/hotspots.json"]},
            {"slug": "grouprunsoutdoors", "label": "Group Runs & Outdoor Meets",  "dataUrls": ["/data/grouprunsoutdoors/hotspots.json"]},
        ],
    },
    {
        "slug": "social",
        "label": "Social",
        "color": "#e11d74",
        "tagline": "Bars, coffee, food trucks, galleries, and culture spots.",
        "categories": [
            {"slug": "pubchat",      "label": "Pubs & Bars",                "dataUrls": ["/data/pubchat/hotspots.json"]},
            {"slug": "foodtrucks",   "label": "Food Trucks",                "dataUrls": ["/data/foodtrucks/hotspots.json"]},
            {"slug": "starbucks",    "label": "Starbucks",                  "dataUrls": ["/data/starbucks/hotspots.json"]},
            {"slug": "culturespots", "label": "Culture Spots",              "dataUrls": ["/data/culturespots/hotspots.json"]},
            {"slug": "newcomers",    "label": "Newcomers",                  "dataUrls": ["/data/newcomers/hotspots.json"]},
            {"slug": "artgalleries", "label": "Art Openings & Galleries",   "dataUrls": ["/data/artgalleries/hotspots.json"]},
        ],
    },
]

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{label} chat archive · austin.chat</title>
  <meta name="description" content="{tagline_html} Browse the full thread of recent chats.">
  <link rel="canonical" href="https://austin.chat/{slug}/">
  <meta property="og:title" content="{label} chat archive · austin.chat">
  <meta property="og:description" content="{tagline_html}">
  <meta name="theme-color" content="#0e1117">
  <link rel="stylesheet" href="/templates/archive/archive.css">
</head>
<body>
  <script>window.ARCHIVE = {archive_json};</script>
  <script src="/templates/pubchat/config.js"></script>
  <script src="/templates/archive/archive.js"></script>
</body>
</html>
"""


def html_escape(s: str) -> str:
    return (s.replace("&", "&amp;")
             .replace("<", "&lt;")
             .replace(">", "&gt;")
             .replace('"', "&quot;"))


def main() -> int:
    for bucket in BUCKETS:
        archive_cfg = {
            "appId":    bucket["slug"],
            "label":    bucket["label"],
            "color":    bucket["color"],
            "tagline":  bucket["tagline"],
            "categories": bucket["categories"],
        }
        dest = REPO / bucket["slug"]
        dest.mkdir(exist_ok=True)
        html = TEMPLATE.format(
            slug=bucket["slug"],
            label=bucket["label"],
            tagline_html=html_escape(bucket["tagline"]),
            archive_json=json.dumps(archive_cfg, ensure_ascii=False),
        )
        (dest / "index.html").write_text(html)
        print(f"  wrote {bucket['slug']}/index.html")
    print(f"\n{len(BUCKETS)} archive pages written.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
