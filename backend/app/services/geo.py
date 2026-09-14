"""Where roles and people are, coarsely: city -> region, so location can count in matching.

Ashby postings use free-text locations ("Austin, Texas", "San Francisco, Austin, New York City",
"Southern Europe"); contacts carry one city. Everything is reduced to a small set of regions.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

REGION_LABELS: Final[dict[str, str]] = {
    "north_america": "North America",
    "latam": "Latin America",
    "europe": "Europe",
    "mena": "Middle East",
    "apac": "Asia-Pacific",
}

# City (or country / area as Ashby writes it) -> region. Lowercase keys.
_PLACE_REGION: Final[dict[str, str]] = {
    # North America
    "san francisco": "north_america",
    "sf": "north_america",
    "bay area": "north_america",
    "new york city": "north_america",
    "new york": "north_america",
    "nyc": "north_america",
    "seattle": "north_america",
    "austin": "north_america",
    "los angeles": "north_america",
    "boston": "north_america",
    "chicago": "north_america",
    "denver": "north_america",
    "washington dc": "north_america",
    "washington, d.c.": "north_america",
    "toronto": "north_america",
    "vancouver": "north_america",
    "united states": "north_america",
    "usa": "north_america",
    "canada": "north_america",
    # Latin America
    "mexico city": "latam",
    "sao paolo": "latam",
    "sao paulo": "latam",
    "são paulo": "latam",
    "buenos aires": "latam",
    "bogota": "latam",
    "brazil": "latam",
    "mexico": "latam",
    # Europe
    "london": "europe",
    "berlin": "europe",
    "paris": "europe",
    "amsterdam": "europe",
    "dublin": "europe",
    "madrid": "europe",
    "barcelona": "europe",
    "lisbon": "europe",
    "milan": "europe",
    "zurich": "europe",
    "stockholm": "europe",
    "munich": "europe",
    "southern europe": "europe",
    "europe": "europe",
    "uk": "europe",
    "united kingdom": "europe",
    "germany": "europe",
    "france": "europe",
    # Middle East
    "riyadh": "mena",
    "doha": "mena",
    "dubai": "mena",
    "abu dhabi": "mena",
    "tel aviv": "mena",
    "saudi arabia": "mena",
    "uae": "mena",
    "qatar": "mena",
    "mena": "mena",
    # Asia-Pacific
    "tokyo": "apac",
    "osaka": "apac",
    "singapore": "apac",
    "sydney": "apac",
    "melbourne": "apac",
    "seoul": "apac",
    "south korea": "apac",
    "korea": "apac",
    "bangalore": "apac",
    "bengaluru": "apac",
    "mumbai": "apac",
    "hyderabad": "apac",
    "india": "apac",
    "japan": "apac",
    "australia": "apac",
    "hong kong": "apac",
    "taipei": "apac",
    "jakarta": "apac",
    "manila": "apac",
    "auckland": "apac",
    "apac": "apac",
    "anz": "apac",
}

# Qualifiers that appear after a comma and add nothing ("Austin, Texas").
_QUALIFIERS: Final[frozenset[str]] = frozenset(
    {"texas", "tx", "california", "ca", "ny", "washington", "wa", "massachusetts", "ma", "remote"}
)

REMOTE_LABELS: Final[frozenset[str]] = frozenset({"remote", "anywhere", "distributed", ""})


@dataclass(frozen=True)
class Place:
    city: str
    region: str


def _clean(token: str) -> str:
    return token.strip().strip("()").strip().lower()


def places(location: str | None) -> list[Place]:
    """Every recognisable city in a free-text location, in order. Unknown text yields nothing."""
    if not location:
        return []
    out: list[Place] = []
    for raw in location.replace("/", ",").replace(" or ", ",").split(","):
        token = _clean(raw)
        if not token or token in _QUALIFIERS or token in REMOTE_LABELS:
            continue
        region = _PLACE_REGION.get(token)
        if region is None:
            continue
        place = Place(city=raw.strip(), region=region)
        if place not in out:
            out.append(place)
    return out


def regions_of(location: str | None) -> frozenset[str]:
    return frozenset(p.region for p in places(location))


def is_remote_location(location: str | None) -> bool:
    return _clean(location or "") in REMOTE_LABELS


def cities_in_regions(regions: frozenset[str]) -> list[str]:
    """Contact-style city names (title case) that fall in the given regions."""
    return sorted(
        {
            k.title()
            if k not in {"nyc", "sf", "uk", "usa", "uae", "apac", "anz", "mena"}
            else k.upper()
            for k, r in _PLACE_REGION.items()
            if r in regions
        }
    )


@dataclass(frozen=True)
class LocationMatch:
    value: float
    label: str
    detail: str


def location_match(
    *, role_location: str | None, role_is_remote: bool, contact_location: str | None
) -> LocationMatch:
    """How well a person's current city suits a role's location.

    Same city 1.0, same region 0.5, elsewhere 0.0. A remote role still favours its own region
    (timezones) but only softly penalises the rest. A person listed as remote is a partial fit
    everywhere: nobody knows where they are.
    """
    role_places = places(role_location)
    role_cities = {p.city.lower() for p in role_places}
    role_regions = {p.region for p in role_places}
    contact_places = places(contact_location)
    where = (contact_location or "").strip() or "Unknown location"

    if not role_places:
        return LocationMatch(1.0, "Location open", f"{where} · role has no fixed location")
    if is_remote_location(contact_location) or not contact_places:
        value = 0.6 if role_is_remote else 0.5
        return LocationMatch(value, "Location unknown", f"{where} · could be anywhere")

    contact = contact_places[0]
    if contact.city.lower() in role_cities:
        return LocationMatch(1.0, "Same city", where)
    region_label = REGION_LABELS.get(contact.region, contact.region)
    if contact.region in role_regions:
        return LocationMatch(
            1.0 if role_is_remote else 0.5, "Same region", f"{where} · {region_label}"
        )
    value = 0.6 if role_is_remote else 0.0
    suffix = "remote role" if role_is_remote else "would need to relocate"
    return LocationMatch(value, "Different region", f"{where} · {suffix}")
