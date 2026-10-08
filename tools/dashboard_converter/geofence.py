"""Line scoring, sentido segmentation and trecho assignment from GPS fixes.

Algorithm: a forward-only "station progress" state machine.

Why forward-only: Wi-Fi based fixes are noisy (tens to hundreds of metres) and
arrive every ~30 s.  Earlier experiments that tracked, per station, the "last
fix inside the geofence" produced non-monotone trecho boundaries.  Here the
machine only ever advances along the station sequence of one direction:

* A station is "entered" by the first coordinate sample inside its radius
  (``radius_m``; ``terminal_radius_m`` for the first/last station of a
  direction).  Up to two stations may be skipped (they are *inferred*, never
  merged into an 'A - C' trecho).
* Dwelling inside a station radius keeps the samples in the *arriving* trecho;
  the next trecho starts at the first coordinate sample outside the radius.
* A sentido ends when the train arrives at the terminal and leaves its radius;
  the opposite direction starts there.  If the terminal is never hit, two
  backward station hits in decreasing order confirm a reversal and the
  turnaround is placed at the sample closest to the terminal.
* Samples without coordinates are never seen by the machine; they inherit the
  trecho by sample index and carry FLAG_SEM_GPS.
"""
from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass, field

from .geo import haversine_m
from .model import (
    FLAG_EDGE, FLAG_INFERRED_STATION, FLAG_SEM_GPS, Assignment, LineDef, LineScore,
    SentidoDef, StationPassage, TrechoDef, Turnaround,
)
from .stations import display_name


# ----------------------------------------------------------------------------
# Line scoring
# ----------------------------------------------------------------------------

def _unique_stations(lines: list[LineDef]) -> dict[str, tuple[float, float]]:
    out: dict[str, tuple[float, float]] = {}
    for ln in lines:
        for d in ln.directions:
            for s in d.stations:
                out.setdefault(s.code, (s.lat, s.lon))
    return out


def score_lines(lat, lon, lines, radius_m: float = 100.0,
                terminal_radius_m: float = 200.0) -> list[LineScore]:
    coords = _unique_stations(lines)
    cache: dict[tuple[float, float], dict[str, float]] = {}
    observed: set[str] = set()
    hit_any: dict[str, float] = {}      # code -> min distance seen
    for la, lo in zip(lat, lon):
        if la is None or lo is None:
            continue
        key = (float(la), float(lo))
        dists = cache.get(key)
        if dists is None:
            dists = {c: haversine_m(key[0], key[1], p[0], p[1]) for c, p in coords.items()}
            cache[key] = dists
            best = min(dists, key=dists.get)
            if dists[best] <= radius_m:
                observed.add(best)
            for c, dv in dists.items():
                if dv < hit_any.get(c, float("inf")):
                    hit_any[c] = dv
    scores: list[LineScore] = []
    for ln in lines:
        terms = ln.terminals
        hits = {c for c in ln.codes
                if hit_any.get(c, float("inf")) <= (terminal_radius_m if c in terms else radius_m)}
        in_line = len(hits)
        n_term = len(terms & hits)
        off = len(observed - ln.codes)
        scores.append(LineScore(ln.line_id, float(in_line + 3 * n_term - 2 * off), in_line, off, n_term))
    scores.sort(key=lambda s: (-s.score, s.line_id))
    return scores


# ----------------------------------------------------------------------------
# Segmentation
# ----------------------------------------------------------------------------

@dataclass
class _Seg:
    d: int
    start: int
    n_st: int
    end: int = -1
    method_in: str = "start"          # 'start' | 'terminal' | 'reversal'
    stat: list[str] = field(default_factory=list)
    enter: list = field(default_factory=list)
    bnd: list = field(default_factory=list)
    k0: int | None = None
    j: int = -1
    dwell: bool = False
    win0: int | None = None           # window start for station 0 min distance

    def __post_init__(self):
        self.stat = ["not_reached"] * self.n_st
        self.enter = [None] * self.n_st
        self.bnd = [None] * self.n_st


def _max_gap(timestamps, lo: int, hi: int) -> float | None:
    if timestamps is None or hi <= lo:
        return None
    best = 0.0
    for i in range(lo, min(hi, len(timestamps) - 1)):
        dt = timestamps[i + 1] - timestamps[i]
        sec = dt.total_seconds() if hasattr(dt, "total_seconds") else float(dt)
        best = max(best, sec)
    return best


def _initial_direction(C, dist, line: LineDef, r_of, notes) -> int:
    codes = sorted(line.codes)
    hits: list[str] = []
    for p in range(len(C)):
        best, bd = None, float("inf")
        for c in codes:
            dv = dist[c][p]
            if dv < bd:
                best, bd = c, dv
        if best is not None and bd <= r_of(best):
            if best not in hits:
                hits.append(best)
                if len(hits) == 3:
                    break
    if not hits:
        notes.append("no station hit: direction 1 assumed, whole run flagged edge")
        return 0
    counts = []
    for d in line.directions:
        idx = {c: i for i, c in enumerate(d.codes)}
        cnt = sum(1 for a, b in zip(hits, hits[1:])
                  if a in idx and b in idx and idx[b] > idx[a])
        counts.append(cnt)
    top = max(counts)
    cands = [i for i, c in enumerate(counts) if c == top]
    if len(cands) == 1:
        return cands[0]
    first = [i for i in cands if line.directions[i].codes[0] == hits[0]]
    if len(first) == 1:
        return first[0]
    notes.append("initial direction undecided: direction 1 assumed")
    return 0


def _segment(C, dist, line: LineDef, init_dir, radius_m, terminal_radius_m, timestamps):
    m = len(C)
    nd = len(line.directions)
    segs: list[_Seg] = []
    turns: list[Turnaround] = []

    def new_seg(d, start, method):
        sg = _Seg(d, start, len(line.directions[d].stations), method_in=method)
        segs.append(sg)
        return sg

    seg = new_seg(init_dir, 0, "start")
    p = 0
    guard = 0
    cand = None
    while p < m and guard < 50 * (m + 10):
        guard += 1
        s = C[p]
        S = line.directions[seg.d].stations
        last = len(S) - 1

        def r(k, last=last):
            return terminal_radius_m if k in (0, last) else radius_m

        def dd(k, p=p, S=S):
            return dist[S[k].code][p]

        if seg.dwell:
            if dd(seg.j) <= r(seg.j):
                p += 1
                continue
            seg.bnd[seg.j] = s
            seg.dwell = False
            if seg.j == last:
                arrive = seg.enter[last]
                turns.append(Turnaround(s, "terminal", S[last].code,
                                        _max_gap(timestamps, arrive, s)))
                seg.end = s
                prev = seg
                seg = new_seg((seg.d + 1) % nd, s, "terminal")
                seg.win0 = prev.enter[last]
                seg.stat[0] = "hit"
                seg.enter[0] = s
                seg.bnd[0] = s
                seg.k0 = 0
                seg.j = 0
                cand = None
                S = line.directions[seg.d].stations
                last = len(S) - 1

                def r(k, last=last):  # noqa: F811
                    return terminal_radius_m if k in (0, last) else radius_m

                def dd(k, p=p, S=S):  # noqa: F811
                    return dist[S[k].code][p]

        j = seg.j
        lo = j + 1
        hi = last if j < 0 else min(j + 3, last)
        found = None
        for k in range(lo, hi + 1):
            if dd(k) <= r(k):
                found = k
                break
        if found is not None:
            if j >= 0:
                for q in range(j + 1, found):
                    seg.stat[q] = "inferred"
            if seg.k0 is None:
                seg.k0 = found
            seg.stat[found] = "hit"
            seg.enter[found] = s
            seg.j = found
            seg.dwell = True
            cand = None
            p += 1
            continue

        if j >= 1:
            if cand is None:
                for q in range(j, -1, -1):
                    if dd(q) <= r(q):
                        cand = (q, p)
                        break
            else:
                for q2 in range(0, cand[0]):
                    if dd(q2) <= r(q2):
                        # reversal confirmed
                        t_code = S[last].code
                        lo_pos = bisect_right(C, seg.bnd[j] - 1)
                        window = range(lo_pos, cand[1] + 1)
                        pstar = min(window, key=lambda x: dist[t_code][x])
                        for q in range(j + 1, last + 1):
                            seg.stat[q] = "inferred"
                        tidx = C[pstar]
                        turns.append(Turnaround(tidx, "reversal", t_code,
                                                _max_gap(timestamps, seg.bnd[j], C[cand[1]])))
                        seg.end = tidx
                        seg = new_seg((seg.d + 1) % nd, tidx, "reversal")
                        seg.stat[0] = "inferred"
                        seg.bnd[0] = tidx
                        seg.k0 = 0
                        seg.j = 0
                        cand = None
                        p = pstar
                        break
                else:
                    p += 1
                    continue
                continue
            p += 1
            continue
        p += 1
    seg.end = -2  # fixed by caller (n)
    return segs, turns


def _resolve_boundaries(seg: _Seg, S, C, dist, n: int) -> None:
    last = len(S) - 1
    end = seg.end
    for k in range(0, last):
        if seg.stat[k] != "inferred" or seg.bnd[k] is not None:
            continue
        prev = None
        for a in range(k - 1, -1, -1):
            if seg.bnd[a] is not None:
                prev = seg.bnd[a]
                break
        if prev is None:
            prev = seg.start
        nxt = end
        for b in range(k + 1, last + 1):
            if seg.stat[b] == "hit" and seg.enter[b] is not None:
                nxt = seg.enter[b]
                break
        lo_pos = bisect_right(C, prev)
        best, bd = None, float("inf")
        pos = lo_pos
        while pos < len(C) and C[pos] < nxt:
            dv = dist[S[k].code][pos]
            if dv < bd:
                best, bd = C[pos], dv
            pos += 1
        b_idx = nxt if best is None else best
        seg.bnd[k] = max(b_idx, prev)


def expand_runs(runs, n: int) -> list[int]:
    out = [0] * n
    for i, (start, val) in enumerate(runs):
        stop = runs[i + 1][0] if i + 1 < len(runs) else n
        for x in range(start, stop):
            out[x] = val
    return out


def _rle(values) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    for i, v in enumerate(values):
        if not runs or runs[-1][1] != v:
            runs.append((i, v))
    return runs


def assign(lat, lon, lines, *, radius_m: float = 100.0, terminal_radius_m: float = 200.0,
           line_override: int | None = None, timestamps=None) -> Assignment:
    n = len(lat)
    notes: list[str] = []
    scores = score_lines(lat, lon, lines, radius_m, terminal_radius_m)
    ambiguous = False
    if line_override is not None:
        chosen = next((l for l in lines if l.line_id == line_override), None)
        if chosen is None:
            raise ValueError(f"line override {line_override}: no such line")
        notes.append(f"line override: {line_override}")
    else:
        chosen = next(l for l in lines if l.line_id == scores[0].line_id)
        ambiguous = len(scores) > 1 and scores[0].score - scores[1].score < 1
        if len(scores) > 1:
            notes.append(f"line {scores[0].line_id} score {scores[0].score:g}, "
                         f"runner-up line {scores[1].line_id} score {scores[1].score:g}")
        if ambiguous:
            notes.append(f"ambiguous line: {scores[0].line_id} vs {scores[1].line_id}")

    # per-coordinate-sample distances for the chosen line
    C = [i for i in range(n) if lat[i] is not None and lon[i] is not None]
    coords = {}
    for d in chosen.directions:
        for s in d.stations:
            coords.setdefault(s.code, (s.lat, s.lon))
    cache: dict[tuple[float, float], dict[str, float]] = {}
    dist: dict[str, list[float]] = {c: [] for c in coords}
    for i in C:
        key = (float(lat[i]), float(lon[i]))
        dv = cache.get(key)
        if dv is None:
            dv = {c: haversine_m(key[0], key[1], p[0], p[1]) for c, p in coords.items()}
            cache[key] = dv
        for c in coords:
            dist[c].append(dv[c])

    terms = chosen.terminals

    def r_of(code):
        return terminal_radius_m if code in terms else radius_m

    init_dir = _initial_direction(C, dist, chosen, r_of, notes) if C else 0
    segs, turns = _segment(C, dist, chosen, init_dir, radius_m, terminal_radius_m, timestamps)
    segs[-1].end = n
    for sg in segs:
        if sg.end == -1:
            sg.end = n

    # global trecho / sentido definitions
    sentidos: list[SentidoDef] = []
    trechos: list[TrechoDef] = []
    offsets: list[int] = []
    order = 0
    for d in chosen.directions:
        a, b = d.from_code, d.to_code
        sentidos.append(SentidoDef(f"{a}-{b}",
                                   f"Sentido {d.index + 1} — {display_name(a)} → {display_name(b)}",
                                   d.index))
        offsets.append(len(trechos))
        for s1, s2 in zip(d.stations, d.stations[1:]):
            order += 1
            trechos.append(TrechoDef(f"{s1.code}-{s2.code}",
                                     f"{display_name(s1.code)} – {display_name(s2.code)}",
                                     d.index, order, s1.code, s2.code))

    sentido_arr = [0] * n
    trecho_arr = [0] * n
    flag_arr = [0] * n
    for i in range(n):
        if lat[i] is None or lon[i] is None:
            flag_arr[i] |= FLAG_SEM_GPS

    passages: list[StationPassage] = []
    not_hit: list[tuple[int, str, float | None]] = []
    for si, sg in enumerate(segs):
        S = chosen.directions[sg.d].stations
        last = len(S) - 1
        if sg.end < sg.start:
            sg.end = sg.start
        _resolve_boundaries(sg, S, C, dist, n)
        k0 = sg.k0
        # trecho ranges
        t_base = 0 if k0 is None else max(k0 - 1, 0)
        cur = t_base
        i = sg.start
        bps = []
        if k0 is not None:
            for t in range(k0, last):
                if sg.bnd[t] is None:
                    break
                bps.append((sg.bnd[t], t))
        pos = sg.start
        for bp, t in bps:
            bp = max(min(bp, sg.end), pos)
            for x in range(pos, bp):
                trecho_arr[x] = offsets[sg.d] + cur
            pos, cur = bp, t
        for x in range(pos, sg.end):
            trecho_arr[x] = offsets[sg.d] + cur
        for x in range(sg.start, sg.end):
            sentido_arr[x] = sg.d
            t_local = trecho_arr[x] - offsets[sg.d]
            if sg.stat[t_local] == "inferred" or sg.stat[t_local + 1] == "inferred":
                flag_arr[x] |= FLAG_INFERRED_STATION
        # edge flags
        if k0 is None:
            for x in range(sg.start, sg.end):
                flag_arr[x] |= FLAG_EDGE
        else:
            if si == 0:
                for x in range(sg.start, min(sg.enter[k0], sg.end)):
                    flag_arr[x] |= FLAG_EDGE
            if si == len(segs) - 1 and not sg.dwell and sg.bnd[sg.j] is not None and sg.j < last:
                for x in range(sg.bnd[sg.j], sg.end):
                    flag_arr[x] |= FLAG_EDGE
        # passages
        for k in range(len(S)):
            w_lo = sg.start
            if k == 0 and sg.win0 is not None:
                w_lo = sg.win0
            lo_pos = bisect_right(C, w_lo - 1)
            hi_pos = bisect_right(C, sg.end - 1)
            md = None
            if hi_pos > lo_pos:
                md = min(dist[S[k].code][lo_pos:hi_pos])
            passages.append(StationPassage(sg.d, si, S[k].code, sg.stat[k], md, sg.bnd[k]))
            if sg.stat[k] == "inferred":
                not_hit.append((sg.d, S[k].code, md))

    return Assignment(
        line_id=chosen.line_id,
        line_scores=scores,
        ambiguous=ambiguous,
        sentidos=sentidos,
        trechos=trechos,
        sentido_runs=_rle(sentido_arr),
        trecho_runs=_rle(trecho_arr),
        flag_runs=_rle(flag_arr),
        passages=passages,
        stations_not_hit=not_hit,
        turnarounds=turns,
        notes=notes,
    )
