"""Tolerant parser for the Stations_GEO/Line*_Stat_geo.txt files.

The files are hand-edited: irregular spaces, CRLF or LF, no trailing newline,
accented UTF-8, a wrong 'LINHA 4:' banner in the Line2 file. The line id is
therefore taken from the FILE NAME. Anything unparsable becomes a
StationWarning instead of an exception.
"""
from __future__ import annotations

import re
from pathlib import Path

from .geo import haversine_m
from .model import Direction, LineDef, Station, StationWarning

_ENTRY = re.compile(r"^\s*([A-Z]{3})\s*\(([^)]*)\)\s*:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$")
_HEADER = re.compile(r"^\s*([A-Z]{3})\s*->\s*([A-Z]{3})\s*$")
_BANNER = re.compile(r"^\s*LINHA\s+\d+\s*:\s*$", re.IGNORECASE)
_FILE_ID = re.compile(r"Line(\d+)_", re.IGNORECASE)

DISPLAY_NAMES: dict[str, str] = {
    # Workbook names (Line 4)
    "TIG": "Terminal Gentileza",
    "RDV": "Rodoviária",
    "EQD": "Equador",
    "PRE": "Pereira Reis",
    "VOL": "Vila Olímpica",
    "CTR": "Central",
    "COT": "Cristiano Ottoni/Pequena África",
    "SAR": "Saara",
    "TRD": "Tiradentes",
    "CLB": "Colombo",
    "PXV": "Praça XV",
    "GMB": "Gamboa",
    "SCT": "Santo Cristo",
    "CDG": "Cordeiro da Graça",
    # Other lines
    "PFM": "Praia Formosa",
    "PVD": "Providência",
    "HMN": "Harmonia",
    "PNV": "Parada dos Navios",
    "PMS": "Parada dos Museus",
    "SBT": "São Bento",
    "CDL": "Candelária",
    "SST": "Sete de Setembro",
    "CRC": "Carioca",
    "CNL": "Cinelândia",
    "ACL": "Antônio Carlos",
    "SDU": "Santos Dumont",
    "UTP": "Utopia",
    "CDS": "Cidade do Samba",
    "CAM": "Camerino",
    "STR": "Santa Rita",
}


def display_name(code: str, fallback: str | None = None) -> str:
    if code in DISPLAY_NAMES:
        return DISPLAY_NAMES[code]
    if fallback:
        return fallback.title()
    return code


def parse_station_file(path) -> tuple[LineDef, list[StationWarning]]:
    path = Path(path)
    m = _FILE_ID.search(path.name)
    line_id = int(m.group(1)) if m else 0
    warnings: list[StationWarning] = []
    fname = path.name
    text = path.read_text(encoding="utf-8-sig")

    blocks: list[tuple[str, str, list[Station]]] = []
    for lineno, raw in enumerate(text.splitlines(), start=1):
        if not raw.strip() or _BANNER.match(raw):
            continue
        h = _HEADER.match(raw)
        if h:
            blocks.append((h.group(1), h.group(2), []))
            continue
        e = _ENTRY.match(raw)
        if e and blocks:
            blocks[-1][2].append(
                Station(e.group(1), e.group(2).strip(), float(e.group(3)), float(e.group(4)))
            )
            continue
        warnings.append(StationWarning(
            "unparsed_line", f"{fname}:{lineno}: cannot parse {raw.strip()!r}", fname, lineno))

    directions: list[Direction] = []
    for idx, (a, b, stations) in enumerate(blocks):
        seen: set[str] = set()
        for s in stations:
            if s.code in seen:
                warnings.append(StationWarning(
                    "duplicate_code_in_direction",
                    f"{fname}: code {s.code} repeated in direction {a}->{b}", fname))
            seen.add(s.code)
        if stations and (stations[0].code != a or stations[-1].code != b):
            warnings.append(StationWarning(
                "header_mismatch",
                f"{fname}: header {a}->{b} but block runs {stations[0].code}..{stations[-1].code}",
                fname))
        directions.append(Direction(line_id, idx, tuple(stations)))
    return LineDef(line_id, f"Linha {line_id}", fname, directions), warnings


def _cross_checks(lines: list[LineDef]) -> list[StationWarning]:
    out: list[StationWarning] = []
    by_code: dict[str, list[tuple[float, float, str]]] = {}
    for ln in lines:
        for d in ln.directions:
            for s in d.stations:
                by_code.setdefault(s.code, []).append((s.lat, s.lon, ln.source_file))
    # conflicting coordinates for the same code
    for code, entries in by_code.items():
        lat0, lon0, f0 = entries[0]
        for lat, lon, f in entries[1:]:
            if abs(lat - lat0) > 1e-9 or abs(lon - lon0) > 1e-9:
                out.append(StationWarning(
                    "conflicting_coordinates",
                    f"{code}: ({lat0}, {lon0}) in {f0} vs ({lat}, {lon}) in {f}", f))
                break
    # identical coordinates for different codes
    by_coord: dict[tuple[float, float], set[str]] = {}
    for code, entries in by_code.items():
        for lat, lon, _ in entries:
            by_coord.setdefault((round(lat, 9), round(lon, 9)), set()).add(code)
    for (lat, lon), codes in by_coord.items():
        cs = sorted(codes)
        for i in range(len(cs)):
            for j in range(i + 1, len(cs)):
                out.append(StationWarning(
                    "identical_coordinates",
                    f"{cs[i]} and {cs[j]} share coordinates ({lat}, {lon})"))
    return out


def load_stations(stations_dir) -> tuple[list[LineDef], list[StationWarning]]:
    stations_dir = Path(stations_dir)
    parsed = [parse_station_file(p) for p in stations_dir.glob("Line*_Stat_geo.txt")]
    parsed.sort(key=lambda t: t[0].line_id)
    lines = [p[0] for p in parsed]
    warnings = [w for p in parsed for w in p[1]]
    warnings.extend(_cross_checks(lines))
    return lines, warnings


def geofence_overlap_warnings(lines: list[LineDef], radius_m: float = 100.0) -> list[StationWarning]:
    out: list[StationWarning] = []
    seen: set[frozenset[str]] = set()
    for ln in lines:
        for d in ln.directions:
            for a, b in zip(d.stations, d.stations[1:]):
                key = frozenset((a.code, b.code))
                if key in seen:
                    continue
                dist = haversine_m(a.lat, a.lon, b.lat, b.lon)
                if dist < 2 * radius_m:
                    seen.add(key)
                    out.append(StationWarning(
                        "geofence_overlap",
                        f"{a.code}-{b.code}: {dist:.0f} m apart, geofences (r={radius_m:g} m) overlap",
                        ln.source_file))
    return out
