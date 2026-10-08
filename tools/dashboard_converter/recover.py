"""Per-cell recovery of values mangled by an Excel pt-BR re-save.

WHY: opening the raw CSV in a pt-BR Excel and saving it as ';' CSV strips the
decimal point from some cells and re-displays the resulting integer with '.'
as thousands separator (e.g. -1.0625 g -> '-10.625'). Float-repr padding
(15/17 significant digits) adds trailing zero groups ('21.650.000.000.000.000'
= 21.65). The rules here reverse that, verified with 0 mismatches against the
treated workbook. Nothing is ever guessed: a value that cannot be recovered
returns None together with a reason.

All functions are pure (no I/O).
"""
from __future__ import annotations

import math
import re
import statistics
from decimal import Decimal, InvalidOperation
from fractions import Fraction

ACCEL_PER_G = 2048
ACCEL_MAX_G = 16
GRID_TOL = 1e-6

THOU = re.compile(r"^-?[1-9]\d{0,2}(\.\d{3})+$")
GPS_THOU = re.compile(r"^-?\d{1,3}(\.\d{3})+$")
DEC_COMMA = re.compile(r"^-?\d+,\d+$")

LAT_ENVELOPE = (Decimal("-22.92"), Decimal("-22.88"))
LON_ENVELOPE = (Decimal("-43.22"), Decimal("-43.16"))

SCALED_RANGES = {
    "temp": (-40.0, 85.0),
    "vel": (0.0, 655.35),
    "disp": (0.0, 65535.0),
    "freq": (0.0, 6553.5),
}


def is_thousands_shaped(text: str) -> bool:
    return bool(THOU.match(text.strip()))


def _on_grid(v: Fraction) -> bool:
    x = v * ACCEL_PER_G
    return abs(float(x - round(x))) <= GRID_TOL


def recover_accel(text: str, ptbr: bool = True) -> tuple[int | None, str]:
    """Recover an acceleration cell to signed LSB counts (1/2048 g)."""
    text = text.strip()
    if text == "":
        return None, "empty"
    if ptbr and DEC_COMMA.match(text):
        text = text.replace(",", ".")
    rule = "plain"
    try:
        if ptbr and THOU.match(text):
            n = int(text.replace("-", "").replace(".", ""))
            sign = -1 if text.startswith("-") else 1
            if n <= ACCEL_MAX_G:
                v = Fraction(sign * n)
                rule = "k"
            else:
                k = int(math.log10(n))
                y = sign * Fraction(n, 10 ** k)
                if abs(y) <= ACCEL_MAX_G and _on_grid(y):
                    v, rule = y, "k"
                else:
                    v, rule = sign * Fraction(n, 10 ** (k - 1)), "k-1"
        else:
            v = Fraction(text)
    except (ValueError, ZeroDivisionError):
        return None, "unrecoverable"
    x = v * ACCEL_PER_G
    lsb = round(x)
    if abs(float(x - lsb)) > GRID_TOL:
        return None, "off_grid"
    if abs(v) > ACCEL_MAX_G:
        return None, "out_of_range"
    return int(lsb), rule


def alternative_accel_reading(text: str) -> int | None:
    """The OTHER on-grid, in-range reading of a thousands-shaped cell (LSB), or None."""
    text = text.strip()
    if not THOU.match(text):
        return None
    chosen, _ = recover_accel(text, ptbr=True)
    n = int(text.replace("-", "").replace(".", ""))
    sign = -1 if text.startswith("-") else 1
    k = int(math.log10(n))
    for kk in (k, k - 1, k - 2):
        if kk < 0:
            continue
        v = sign * Fraction(n, 10 ** kk)
        if abs(v) > ACCEL_MAX_G or not _on_grid(v):
            continue
        lsb = int(round(v * ACCEL_PER_G))
        if lsb != chosen:
            return lsb
    return None


def recover_gps(text: str, axis: str, ptbr: bool = True) -> tuple[Decimal | None, str]:
    """Recover a coordinate cell; axis is 'lat' or 'lon'."""
    text = text.strip()
    if text == "":
        return None, "empty"
    try:
        if ptbr and GPS_THOU.match(text):
            neg = text.startswith("-")
            digits = text.replace("-", "").replace(".", "")
            value = Decimal(digits).scaleb(-(len(digits) - 2))
            if neg:
                value = -value
            reason = "recovered"
        else:
            value = Decimal(text)
            reason = "plain"
    except InvalidOperation:
        return None, "unrecoverable"
    if not value.is_finite():
        return None, "unrecoverable"
    lo, hi = LAT_ENVELOPE if axis == "lat" else LON_ENVELOPE
    if not (lo <= value <= hi):
        return None, "out_of_envelope"
    return value, reason


def scaled_candidates(text: str) -> list[float]:
    """Candidate values with 1..3 integer digits for a thousands-shaped scaled cell."""
    text = text.strip()
    neg = text.startswith("-")
    digits = text.replace("-", "").replace(".", "").rstrip("0") or "0"
    out: list[float] = []
    for ints in (1, 2, 3):
        v = float(Decimal(digits).scaleb(ints - len(digits)))
        if neg:
            v = -v
        if v not in out:
            out.append(v)
    return out


def resolve_scaled(
    text: str,
    kind: str,
    neighbours: list[float],
    column_median: float | None = None,
) -> tuple[float | None, str]:
    """Pick the candidate nearest to neighbouring plain values (or the column median)."""
    lo, hi = SCALED_RANGES[kind]
    cands = [c for c in scaled_candidates(text) if lo <= c <= hi]
    if not cands:
        return None, "out_of_range"
    if neighbours:
        ref, reason = statistics.median(neighbours), "neighbour"
    elif column_median is not None:
        ref, reason = column_median, "column_median"
    else:
        return None, "no_neighbours"
    return min(cands, key=lambda c: abs(c - ref)), reason


def parse_plain(text: str, ptbr: bool = False) -> float | None:
    """Parse a plain numeric cell; '' -> None; invalid -> ValueError."""
    text = text.strip()
    if text == "":
        return None
    if ptbr and DEC_COMMA.match(text):
        text = text.replace(",", ".")
    return float(text)
