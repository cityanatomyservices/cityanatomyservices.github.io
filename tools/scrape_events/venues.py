"""Venue name → (lng, lat) lookup table.

Scrapers emit `venue_name` strings; this module maps them to coordinates
without hitting a geocoding service (keeps the GitHub Action hermetic).
Add new entries here when a scraper hits an unknown venue.
"""

# Keep the keys lowercase for consistent lookup.
VENUES: dict[str, tuple[float, float]] = {
    # Festival + market venues
    "palmer events center":     (-97.7556, 30.2630),
    "austin convention center": (-97.7400, 30.2640),
    "zilker park":              (-97.7710, 30.2685),
    "lakeline park":            (-97.8175, 30.4750),
    "pease park":               (-97.7563, 30.2935),
    "distribution hall":        (-97.7220, 30.2620),
    "republic square":          (-97.7466, 30.2691),
    "browning hangar":          (-97.7039, 30.2987),
    "plaza saltillo":           (-97.7261, 30.2616),
    "barton creek square":      (-97.8016, 30.2604),
    "the domain":               (-97.7253, 30.4014),
    "fair market":              (-97.7335, 30.2616),

    # Brewery yards (Austin Flea rotation)
    "zilker brewing":           (-97.7314, 30.2628),
    "the brewtorium":           (-97.6957, 30.3306),
    "meanwhile brewing":        (-97.7475, 30.2070),
    "oasis brewing":            (-97.6960, 30.2628),
    "hi sign brewing":          (-97.6900, 30.2360),
    "central machine works":    (-97.6873, 30.2602),

    # Concert venues
    "acl live at the moody theater": (-97.7464, 30.2647),
    "stubb's bbq":              (-97.7363, 30.2696),
    "mohawk":                   (-97.7361, 30.2715),
    "antone's nightclub":       (-97.7421, 30.2666),
    "the long center":          (-97.7522, 30.2599),
    "empire control room":      (-97.7378, 30.2683),
    "paramount theatre":        (-97.7430, 30.2693),
    "continental club":         (-97.7531, 30.2520),
    "cactus cafe":              (-97.7395, 30.2862),

    # Comedy
    "cap city comedy club":     (-97.7165, 30.4006),
    "coldtowne theater":        (-97.7330, 30.3253),
    "fallout theater":          (-97.7445, 30.2716),
    "velveeta room":            (-97.7390, 30.2670),
    "the creek and the cave":   (-97.7385, 30.2671),
    "esther's follies":         (-97.7395, 30.2672),

    # Galleries
    "the contemporary austin · jones center": (-97.7434, 30.2700),
    "blanton museum of art":    (-97.7388, 30.2811),
    "canopy":                   (-97.6981, 30.2748),
    "icosa collective":         (-97.6981, 30.2750),
    "mass gallery":             (-97.6960, 30.2530),
    "wally workman gallery":    (-97.7567, 30.2724),
    "lora reynolds gallery":    (-97.7510, 30.2671),

    # Outdoors / fitness
    "lou neff point":           (-97.7660, 30.2640),
    "auditorium shores":        (-97.7559, 30.2647),
    "barton springs pool":      (-97.7700, 30.2640),
    "spyglass trailhead":       (-97.7842, 30.2602),
    "texas rowing center":      (-97.7591, 30.2719),
    "austin bouldering project": (-97.6989, 30.2666),
    "rogue running":            (-97.7613, 30.2685),
}


def lookup(name: str) -> tuple[float, float] | None:
    """Return (lng, lat) for `name`, case-insensitive. None if missing."""
    return VENUES.get(name.strip().lower())
