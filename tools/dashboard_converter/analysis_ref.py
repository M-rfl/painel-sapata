"""Reference analysis reproducing the workbook rules (see .planning/research/WORKBOOK-CRITERIA.md).

This is the oracle used by validate.py and tests/test_dashboard_site_json.py. Phase 10's
JS engine must agree with it (parity tests there).

Arithmetic is done in doubled LSB units so a .5 median never causes float edge errors.
"""
from __future__ import annotations

from .model import ACCEL_PER_G


def _median2(values: list[int]) -> int:
    """Twice the median, as an integer."""
    s = sorted(values)
    n = len(s)
    if n == 0:
        return 0
    if n % 2:
        return 2 * s[n // 2]
    return s[n // 2 - 1] + s[n // 2]


def reference_analysis(ax, ay, az, loc_key, trecho_name, *,
                       thresholds=(0.5, 1.0, 2.0, 4.0)) -> dict:
    n = len(ax)
    axes = (ax, ay, az)
    med2 = [_median2([v for v in a if v is not None]) for a in axes]
    th2 = [round(t * ACCEL_PER_G * 2) for t in thresholds]
    ncls = len(thresholds) + 1

    cls: list[int | None] = [None] * n
    dom_abs = [0] * n  # doubled LSB
    unclassified = 0
    for i in range(n):
        vals = (ax[i], ay[i], az[i])
        if any(v is None for v in vals):
            unclassified += 1
            continue
        best = -1
        for k in range(3):  # ties: X > Y > Z (strict greater keeps the earlier axis)
            d = abs(2 * vals[k] - med2[k])
            if d > best:
                best = d
        dom_abs[i] = best
        cls[i] = sum(1 for t in th2 if best >= t)

    class_counts = [0] * ncls
    for c in cls:
        if c is not None:
            class_counts[c] += 1
    eventos = sum(1 for c in cls if c is not None and c >= 1)

    impact_starts: list[int] = []
    impacts_by_class = [0] * ncls
    impact_peak: list[int] = []
    i = 0
    while i < n:
        if cls[i] is not None and cls[i] >= 1:
            j = i
            peak = i
            mx = cls[i]
            while j < n and cls[j] is not None and cls[j] >= 1:
                if dom_abs[j] > dom_abs[peak]:
                    peak = j
                mx = max(mx, cls[j])
                j += 1
            impact_starts.append(i)
            impact_peak.append(peak)
            impacts_by_class[mx] += 1
            i = j
        else:
            i += 1

    best_row: dict[str, int] = {}
    for i in range(n):
        if cls[i] is None or cls[i] < 1:
            continue
        key = loc_key[i] if loc_key[i] is not None else "SEM GPS | " + trecho_name[i]
        if key not in best_row or dom_abs[i] > dom_abs[best_row[key]]:
            best_row[key] = i
    point_rows = sorted(best_row.values())
    points_by_class = [0] * ncls
    for r in point_rows:
        points_by_class[cls[r]] += 1

    per_trecho: dict[str, dict] = {}
    for i in range(n):
        per_trecho.setdefault(trecho_name[i], {"records": 0, "eventos": 0, "impactos": 0, "pontos": 0})
        per_trecho[trecho_name[i]]["records"] += 1
        if cls[i] is not None and cls[i] >= 1:
            per_trecho[trecho_name[i]]["eventos"] += 1
    for p in impact_peak:
        per_trecho[trecho_name[p]]["impactos"] += 1
    for r in point_rows:
        per_trecho[trecho_name[r]]["pontos"] += 1

    return {
        "medians_lsb": [m / 2 for m in med2],
        "class_per_row": cls,
        "class_counts": class_counts,
        "eventos": eventos,
        "impactos": len(impact_starts),
        "impact_starts": impact_starts,
        "impacts_by_class": impacts_by_class,
        "pontos": len(point_rows),
        "point_rows": point_rows,
        "points_by_class": points_by_class,
        "per_trecho": per_trecho,
        "unclassified": unclassified,
    }
