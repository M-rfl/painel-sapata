"""Regenerate site/data/routes/linha-{N}-sentido-{S}.geojson from OpenStreetMap relations.

Usage: python tools/fetch_routes.py
Route geometry (c) OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
Only way members are used (stops/platforms skipped); coordinates rounded to 6 decimals.
"""
import json
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "site" / "data" / "routes"
# (line, sentido, relation id, name)
RELATIONS = [
    (4, 1, 19644242, "Terminal Gentileza → Praça XV"),
    (4, 2, 19644243, "Praça XV → Terminal Gentileza"),
    (2, 1, 7064052, "Praia Formosa → Praça XV"),
    (2, 2, 7064053, "Praça XV → Praia Formosa"),
    (1, 1, 6667528, "Terminal Intermodal Gentileza → Santos Dumont"),
    (1, 2, 6667529, "Santos Dumont → Terminal Intermodal Gentileza"),
    (3, 1, 9453118, "Santos Dumont → Central"),
    (3, 2, 9453119, "Central → Santos Dumont"),
]


def fetch(rid):
    url = f"https://www.openstreetmap.org/api/0.6/relation/{rid}/full.json"
    req = urllib.request.Request(url, headers={"User-Agent": "accel-mro-route-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def build(rid):
    data = fetch(rid)
    nodes = {e["id"]: e for e in data["elements"] if e["type"] == "node"}
    ways = {e["id"]: e for e in data["elements"] if e["type"] == "way"}
    rel = next(e for e in data["elements"] if e["type"] == "relation")
    lines = []
    for m in rel["members"]:
        if m["type"] != "way" or m.get("role", "").startswith(("platform", "stop")):
            continue
        w = ways.get(m["ref"])
        if not w:
            continue
        coords = [[round(nodes[n]["lon"], 6), round(nodes[n]["lat"], 6)] for n in w["nodes"] if n in nodes]
        if len(coords) >= 2:
            lines.append(coords)
    return rel.get("tags", {}), lines


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for line, sentido, rid, name in RELATIONS:
        tags, lines = build(rid)
        if not lines:
            raise SystemExit(f"relation {rid} has no way members")
        fc = {
            "type": "Feature",
            "properties": {"line": line, "sentido": sentido, "relation": rid, "name": name,
                           "osm_name": tags.get("name", ""),
                           "attribution": "OpenStreetMap contributors, ODbL 1.0"},
            "geometry": {"type": "MultiLineString", "coordinates": lines},
        }
        p = OUT / f"linha-{line}-sentido-{sentido}.geojson"
        p.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(p.name, rid, len(lines), "ways", p.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
