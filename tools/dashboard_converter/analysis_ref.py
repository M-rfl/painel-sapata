"""Reference analysis reproducing the workbook rules (see .planning/research/WORKBOOK-CRITERIA.md).

This is the oracle used by validate.py and tests/test_dashboard_site_json.py. Phase 10's
JS engine must agree with it (parity tests there).

Arithmetic is done in doubled LSB units so a .5 median never causes float edge errors.

Conventions shared with the JS engine (Phase 10):
1. Thresholds: th2 = ceil(t * 4096) (doubled LSB); dom2 >= th2 is exactly |dom| >= t g.
   JS uses Math.ceil(t * 4096), the identical IEEE product.
2. Manual offsets: off2 = floor(g * 4096 + 0.5) (half-up, never round()).
3. gap = max number of non-event rows (Normal OR unclassified) allowed between two
   consecutive events of one impact; pure index distance. Unclassified rows count toward
   the gap. Default 0 = workbook behavior.
4. Time jump: an event starts a new impact if t_ms[i] - t_ms[last_event] > max_jump_ms
   (measured event-to-event, strict >; equal does not split). t_ms=None disables the split.
5. Sentido change and GPS never affect grouping (pure row order).
"""
from __future__ import annotations

import math


def _median2(values: list[int]) -> int:
    """Twice the median, as an integer."""
    s = sorted(values)
    n = len(s)
    if n == 0:
        return 0
    if n % 2:
        return 2 * s[n // 2]
    return s[n // 2 - 1] + s[n // 2]


def half_up(x) -> int:
    return math.floor(x + 0.5)


def thresholds2(thresholds) -> list[int]:
    return [math.ceil(t * 4096) for t in thresholds]


def reference_analysis(ax, ay, az, loc_key, trecho_name, *,
                       thresholds=(0.5, 1.0, 2.0, 4.0), offset=None, gap=0,
                       t_ms=None, max_jump_ms=2000) -> dict:
    n = len(ax)
    axes = (ax, ay, az)
    med2 = [_median2([v for v in a if v is not None]) for a in axes]
    if offset is None or offset.get("mode") == "median":
        off2 = list(med2)
    elif offset.get("mode") == "manual":
        off2 = [half_up(g * 4096) for g in offset["g"]]
    else:
        raise ValueError(f"unknown offset mode: {offset.get('mode')!r}")
    th2 = thresholds2(thresholds)
    ncls = len(thresholds) + 1

    cls: list[int | None] = [None] * n
    dom_abs = [0] * n  # doubled LSB
    dom_axis = [-1] * n
    unclassified = 0
    for i in range(n):
        vals = (ax[i], ay[i], az[i])
        if any(v is None for v in vals):
            unclassified += 1
            continue
        best = -1
        bk = 0
        for k in range(3):  # ties: X > Y > Z (strict greater keeps the earlier axis)
            d = abs(2 * vals[k] - off2[k])
            if d > best:
                best = d
                bk = k
        dom_abs[i] = best
        dom_axis[i] = bk
        cls[i] = sum(1 for t in th2 if best >= t)

    class_counts = [0] * ncls
    for c in cls:
        if c is not None:
            class_counts[c] += 1
    eventos = sum(1 for c in cls if c is not None and c >= 1)

    impacts: list[dict] = []
    cur = None
    last = -1
    for i in range(n):
        c = cls[i]
        if c is None or c < 1:
            continue
        split = (cur is None or (i - last - 1) > gap
                 or (t_ms is not None and t_ms[i] - t_ms[last] > max_jump_ms))
        if split:
            cur = {"start": i, "peak": i, "cls": c}
            impacts.append(cur)
        if dom_abs[i] > dom_abs[cur["peak"]]:
            cur["peak"] = i
        if c > cur["cls"]:
            cur["cls"] = c
        last = i
    impact_starts = [m["start"] for m in impacts]
    impact_peak = [m["peak"] for m in impacts]
    impacts_by_class = [0] * ncls
    for m in impacts:
        impacts_by_class[m["cls"]] += 1

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
        "offsets2": off2,
        "dom_axis_per_row": dom_axis,
        "class_per_row": cls,
        "class_counts": class_counts,
        "eventos": eventos,
        "impactos": len(impact_starts),
        "impact_starts": impact_starts,
        "impact_peaks": impact_peak,
        "impacts_by_class": impacts_by_class,
        "pontos": len(point_rows),
        "point_rows": point_rows,
        "points_by_class": points_by_class,
        "per_trecho": per_trecho,
        "unclassified": unclassified,
    }
