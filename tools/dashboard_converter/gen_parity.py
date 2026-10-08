"""Deterministic Python<->JS parity fixture generator.

    python -m tools.dashboard_converter.gen_parity [--out tests/fixtures/parity_cases.json]

Cases are produced by the Python oracle (analysis_ref.reference_analysis) with seeded random,
mostly non-default parameters. tests/js/parity.test.js replays them against the JS engine;
tests/test_parity_fixture.py fails if the committed fixture is stale.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
from pathlib import Path

from .analysis_ref import _median2, half_up, reference_analysis, thresholds2
from .writer import decode_samples, load_site_json

SEED = 20261002
ROOT = Path(__file__).resolve().parents[2]
RUN1_PATH = "site/data/run-2026-10-02-l4-t102.json"
DEFAULT_OUT = "tests/fixtures/parity_cases.json"

DEFAULT_THRESHOLDS = [0.5, 1.0, 2.0, 4.0]
MAX_JUMP_POOL = [2000, 1000, 500, 150]
GAP_POOL = [0, 1, 2, 3, 5]
WORKBOOK_MEDIANS_G = [0.0458984375, -0.0185546875, -0.9853515625]
REST = (94, -38, -2018)


# ---------------------------------------------------------------- params

def _rand_thresholds(rng: random.Random) -> list:
    pick = rng.random()
    if pick < 0.2:
        return list(DEFAULT_THRESHOLDS)
    if pick < 0.4:
        return [0.7, 1.1, 2.3, 4.7]
    vals = sorted(rng.sample(range(10, 601), 4))  # 0.10 .. 6.00 g
    return [round(v / 100, 2) for v in vals]


def _rand_offset(rng: random.Random, rest_g, force_manual=False, special=None) -> dict:
    if not force_manual and special is None and rng.random() < 0.4:
        return {"mode": "median"}
    g = [round(r + rng.uniform(-0.05, 0.05), 6) for r in rest_g]
    if special == "half":
        g[0] = 189 / 4096          # exact half-step (k odd)
        g[1] = -0.0003662109375    # -1.5/4096, negative half-step
        g[2] = round(rest_g[2], 6)
    return {"mode": "manual", "g": g}


def _rand_params(rng: random.Random, rest_g, special=None) -> dict:
    return {
        "thresholds_g": _rand_thresholds(rng),
        "offset": _rand_offset(rng, rest_g, special=special),
        "gap": rng.choice(GAP_POOL),
        "maxJumpMs": rng.choice(MAX_JUMP_POOL),
    }


def _oracle_kwargs(params: dict) -> dict:
    return {
        "thresholds": params["thresholds_g"],
        "offset": params["offset"],
        "gap": params["gap"],
        "max_jump_ms": params["maxJumpMs"],
    }


# ---------------------------------------------------------------- expected

def _expected(res: dict, order: list) -> dict:
    pt = res["per_trecho"]
    zero = {"records": 0, "eventos": 0, "impactos": 0, "pontos": 0}
    return {
        "medians_lsb": res["medians_lsb"],
        "offsets2": res["offsets2"],
        "class_counts": res["class_counts"],
        "eventos": res["eventos"],
        "impactos": res["impactos"],
        "impact_starts": res["impact_starts"],
        "impact_peaks": res["impact_peaks"],
        "impacts_by_class": res["impacts_by_class"],
        "pontos": res["pontos"],
        "point_rows": res["point_rows"],
        "points_by_class": res["points_by_class"],
        "unclassified": res["unclassified"],
        "class_digest": res["class_digest"],
        "per_trecho": [[pt.get(nm, zero)[k] for k in ("records", "eventos", "impactos", "pontos")]
                       for nm in order],
        "priority": [[p["trecho"], p["level"], p["top_count"], p["peak_dom2"]] for p in res["priority"]],
        "region_records": res["region_records"],
        "region_eventos": res["region_eventos"],
    }


# ---------------------------------------------------------------- synthetic

def _synthetic_case(k: int, seed: int) -> dict:
    rng = random.Random(seed + k)
    n = rng.randint(150, 400)
    special = "half" if k == 3 else None
    rest_g = [r / 2048 for r in REST]
    params = _rand_params(rng, rest_g, special=special)
    if k == 0:
        params["thresholds_g"] = list(DEFAULT_THRESHOLDS)
    if k == 1:
        params["maxJumpMs"] = 150  # stress: below the sample period
    if k == 2:
        params["gap"] = 2
    mj, gap = params["maxJumpMs"], params["gap"]

    ax = [REST[0] + rng.randint(-6, 6) for _ in range(n)]
    ay = [REST[1] + rng.randint(-6, 6) for _ in range(n)]
    az = [REST[2] + rng.randint(-6, 6) for _ in range(n)]
    cols = [ax, ay, az]

    # trechos: unique names, contiguous blocks
    m = rng.randint(3, 5)
    names = [f"S{k}-T{j}" for j in range(m)]
    cuts = [n * j // m + rng.randint(-8, 8) for j in range(1, m)]
    bounds = [0] + cuts + [n]
    trecho = []
    for j in range(m):
        trecho += [j] * (bounds[j + 1] - bounds[j])

    # locations: repeated keys from a small pool, two no-GPS stretches in two trechos
    pool = [f"L{k}-{j}" for j in range(max(12, n // 8))]
    loc = [rng.choice(pool) for _ in range(n)]
    for j in rng.sample(range(m), 2):
        s = rng.randint(bounds[j], bounds[j + 1] - 12)
        for i in range(s, s + rng.randint(6, 11)):
            loc[i] = None

    # offsets exactly as the oracle will compute them (from base data)
    if params["offset"]["mode"] == "median":
        off2 = [_median2(c) for c in cols]
    else:
        off2 = [half_up(g * 4096) for g in params["offset"]["g"]]
    th2 = thresholds2(params["thresholds_g"])

    def set_dev(i, axis, d2, sign):
        """Set row i axis so that |2v - off2| is d2 (or d2+-1 when the parity cannot match)."""
        v2 = off2[axis] + sign * d2
        cols[axis][i] = v2 // 2 if v2 % 2 == 0 else (v2 + sign) // 2

    def tie_dev(d2):
        """Largest D <= d2 with parity matching off2 of axis 0."""
        return d2 if (d2 - off2[0]) % 2 == 0 else d2 - 1

    used = set()

    def free(i):
        return i not in used

    def mark(*rows):
        used.update(rows)

    # random event clusters
    for _ in range(max(6, n // 14)):
        s = rng.randint(1, n - 6)
        if not all(free(s + d) for d in range(-1, 5)):
            continue
        length = rng.randint(1, 4)
        axis = rng.randrange(3)
        base = rng.randint(int(0.15 * 4096), int(6 * 4096))
        for d in range(length):
            set_dev(s + d, rng.randrange(3) if rng.random() < 0.3 else axis,
                    max(2, base + rng.randint(-200, 200)), rng.choice((-1, 1)))
        mark(*range(s - 1, s + length + 1))

    def place(width=6):
        for _ in range(200):
            s = rng.randint(2, n - width - 2)
            if all(free(s + d) for d in range(-1, width + 1)):
                mark(*range(s - 1, s + width + 1))
                return s
        return None

    # values exactly on / just under each threshold
    for t in th2:
        for d in (t, t - 1):
            s = place(1)
            if s is not None:
                set_dev(s, rng.randrange(3), d, rng.choice((-1, 1)))

    # axis ties X=Y, Y=Z, X=Y=Z (same signed deviation target; best effort on parity)
    for combo in ((0, 1), (1, 2), (0, 1, 2)):
        s = place(1)
        if s is None:
            continue
        big = rng.choice(th2[1:] + [th2[0]]) + rng.randint(0, 600)
        for a in combo:
            D = big if (big - off2[a]) % 2 == 0 else big - 1
            set_dev(s, a, D, 1)

    # peak ties inside an impact, and a tie for one location
    s = place(3)
    if s is not None:
        big = tie_dev(th2[1] + 400)
        set_dev(s, 0, big, 1)
        set_dev(s + 1, 0, big, -1)
        set_dev(s + 2, 0, big - 4, 1)
    s = place(1)
    s2 = place(1)
    if s is not None and s2 is not None:
        loc[s2] = loc[s] = loc[s] or f"L{k}-tie"
        D = tie_dev(th2[1] + 100)
        set_dev(s, 0, D, 1)
        set_dev(s2, 0, D, -1)

    # events at row 0 and n - 1
    set_dev(0, 1, th2[1] + 50, 1)
    set_dev(n - 1, 2, th2[0] + 50, -1)
    mark(0, n - 1)

    # pairs separated by exactly gap and gap + 1 Normal rows
    for sep in (gap, gap + 1):
        s = place(sep + 2)
        if s is not None:
            set_dev(s, 0, th2[0] + 100, 1)
            set_dev(s + sep + 1, 0, th2[0] + 100, -1)

    # time axis: 180 +- 5 ms steps, then injected jumps next to events
    steps = [0] + [180 + rng.randint(-5, 5) for _ in range(n - 1)]
    for jump in (mj, mj + 1, 600_000):
        s = place(2)
        if s is not None:
            set_dev(s, 0, th2[0] + 200, 1)
            set_dev(s + 1, 1, th2[0] + 200, 1)
            steps[s + 1] = jump  # event-to-event delta equals the jump exactly
    t_ms = []
    acc = 1000
    for st in steps:
        acc += st
        t_ms.append(acc)

    # None in each axis: alone, and inside an event run
    for c, col in enumerate(cols):
        s = place(1)
        if s is not None:
            col[s] = None
        s = place(4)
        if s is not None:
            set_dev(s, (c + 1) % 3, th2[1] + 100, 1)
            col[s + 1] = None
            set_dev(s + 2, (c + 1) % 3, th2[1] + 100, 1)

    # sources: second-appearing file index lower
    cut = rng.randint(n // 4, 3 * n // 4)
    source = [1] * cut + [0] * (n - cut)
    if k % 3 == 2:
        c2 = rng.randint(cut + 1, n - 1)
        source = [1] * cut + [0] * (c2 - cut) + [2] * (n - c2)

    trecho_name = [names[t] for t in trecho]
    res = reference_analysis(ax, ay, az, loc, trecho_name, **_oracle_kwargs(params),
                             t_ms=t_ms, trecho_order=names, region=source)
    return {
        "name": f"synthetic-{k + 1:02d}",
        "source": "synthetic",
        "input": {"ax": ax, "ay": ay, "az": az, "t_ms": t_ms, "loc": loc,
                  "trecho": trecho, "trechos": names, "source": source},
        "params": params,
        "expected": _expected(res, names),
    }


# ---------------------------------------------------------------- run 1

def inputs_sha256(obj: dict) -> str:
    payload = [obj["t"]["dt_ms"], obj["accel"]["ax"], obj["accel"]["ay"], obj["accel"]["az"],
               obj["fix_runs"], obj["trecho_runs"], obj.get("source_runs"),
               obj["gps"]["lat"], obj["gps"]["lon"], [t["name"] for t in obj["trechos"]]]
    return hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode("utf-8")).hexdigest()


def _run1_cases(seed: int) -> tuple[list, str]:
    obj = load_site_json(ROOT / RUN1_PATH)
    dec = decode_samples(obj)
    order = [t["name"] for t in obj["trechos"]]
    rng = random.Random(seed + 1000)
    workbook_off = {"mode": "manual", "g": list(WORKBOOK_MEDIANS_G)}
    plist = [
        {"thresholds_g": list(DEFAULT_THRESHOLDS), "offset": {"mode": "median"}, "gap": 0, "maxJumpMs": 2000},
        {"thresholds_g": list(DEFAULT_THRESHOLDS), "offset": workbook_off, "gap": 0, "maxJumpMs": 2000},
    ]
    for j in range(6):
        p = _rand_params(rng, WORKBOOK_MEDIANS_G, special="half" if j == 2 else None)
        if j == 0:
            p["gap"] = max(p["gap"], 1)
        if j == 1:
            p["maxJumpMs"] = 150
        if j == 3:
            p["offset"] = {"mode": "manual", "g": [round(g + 0.01, 6) for g in WORKBOOK_MEDIANS_G]}
            p["gap"] = 3
        plist.append(p)
    tags = ["default", "workbook-offset"] + [f"random{j + 1}" for j in range(6)]
    cases = []
    for idx, (p, tag) in enumerate(zip(plist, tags)):
        res = reference_analysis(dec["ax"], dec["ay"], dec["az"], dec["loc_key"], dec["trecho_name"],
                                 **_oracle_kwargs(p), t_ms=dec["t_ms"], trecho_order=order,
                                 region=dec["source"])
        cases.append({"name": f"run1-{idx + 1:02d}-{tag}", "source": RUN1_PATH,
                      "params": p, "expected": _expected(res, order)})
    return cases, inputs_sha256(obj)


# ---------------------------------------------------------------- public

def build_cases(seed: int = SEED) -> dict:
    synthetic = [_synthetic_case(k, seed) for k in range(10)]
    run1, digest = _run1_cases(seed)
    return {
        "generator": "python -m tools.dashboard_converter.gen_parity",
        "seed": seed,
        "oracle": "analysis_ref",
        "inputs_sha256": {RUN1_PATH: digest},
        "cases": synthetic + run1,
    }


def _dumps(x) -> str:
    return json.dumps(x, ensure_ascii=False, indent=None, separators=(",", ":"))


def dumps_fixture(obj: dict) -> str:
    head = ",".join(f"{_dumps(k)}:{_dumps(v)}" for k, v in obj.items() if k != "cases")
    body = ",\n".join(_dumps(c) for c in obj["cases"])
    return "{" + head + ',"cases":[\n' + body + "\n]}\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args(argv)
    out = Path(args.out)
    if not out.is_absolute():
        out = ROOT / out
    obj = build_cases()
    text = dumps_fixture(obj)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(text.encode("utf-8"))
    print(f"{len(obj['cases'])} cases, {out.stat().st_size / 1024:.1f} KB -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
