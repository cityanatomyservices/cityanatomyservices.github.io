"""School-lunch lane — Austin ISD Nutrislice (no API key).

Nutrislice exposes weekly menus as JSON:
  /menu/api/weeks/school/<school>/menu-type/<type>/<YYYY>/<MM>/<DD>/

The school + menu-type slugs MUST be confirmed against the live
Nutrislice site (austinisd.nutrislice.com) — defaults below are
placeholders. Surfaces today's entrée line per configured menu. Fails
soft if the slugs are wrong or the day has no menu (weekend/holiday).
"""

from __future__ import annotations

from datetime import date

from tools.austin_feed.common import FeedItem, get_json

DISTRICT = "austinisd"
# (display label, school-slug, menu-type-slug). CONFIRM these slugs.
MENUS = [
    ("Elementary lunch", "elementary-school", "lunch"),
    ("Middle school lunch", "middle-school", "lunch"),
    ("High school lunch", "high-school", "lunch"),
]


def _today_items(day) -> list[dict]:
    out = []
    for d in day.get("menu_items", []):
        food = d.get("food")
        if food and food.get("name"):
            out.append(food["name"])
    return out


def scrape() -> list[FeedItem]:
    today = date.today()
    base = f"https://{DISTRICT}.nutrislice.com/menu/api/weeks"
    web = f"https://{DISTRICT}.nutrislice.com/menu"
    items: list[FeedItem] = []

    for label, school, mtype in MENUS:
        url = f"{base}/school/{school}/menu-type/{mtype}/{today.year}/{today.month:02d}/{today.day:02d}/"
        try:
            data = get_json(url)
        except Exception as e:
            print(f"  lunch: {label} skipped ({e})")
            continue

        days = data.get("days") or []
        match = next((d for d in days if d.get("date") == today.isoformat()), None)
        if not match:
            continue
        names = _today_items(match)
        if not names:
            continue
        # Top few entrées keep the headline ticker-sized.
        preview = ", ".join(names[:3])
        items.append(FeedItem(
            id=f"lunch-{school}-{today.isoformat()}",
            lane="lunch",
            headline=f"{label}: {preview}",
            link=f"{web}/{school}/{mtype}/",
            detail=", ".join(names),
            published=today.isoformat(),
            expires=today.isoformat() + "T23:59:59Z",
        ))

    return items
