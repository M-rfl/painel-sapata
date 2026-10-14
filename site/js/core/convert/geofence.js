// Line-by-line port of tools/dashboard_converter/geofence.py.
// Do not "improve" the algorithm: known deviations are accepted (parity with Python).
import { haversineM } from './geo.js';

const FLAG_SEM_GPS = 1;
const FLAG_EDGE = 2;
const FLAG_INFERRED_STATION = 4;

function fmtG(v) {
  return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(6)));
}

function bisectRight(a, x) {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (x < a[mid]) hi = mid; else lo = mid + 1;
  }
  return lo;
}

function distsFor(la, lo, coords) {
  const out = new Map();
  for (const [c, p] of coords) out.set(c, haversineM(la, lo, p[0], p[1]));
  return out;
}

function uniqueStations(lines) {
  const out = new Map();
  for (const ln of lines) {
    for (const d of ln.directions) {
      for (const s of d.stations) {
        if (!out.has(s.code)) out.set(s.code, [s.lat, s.lon]);
      }
    }
  }
  return out;
}

export function scoreLines(lat, lon, lines, radiusM = 100.0, terminalRadiusM = 200.0) {
  const coords = uniqueStations(lines);
  const cache = new Map();
  const observed = new Set();
  const hitAny = new Map();
  for (let i = 0; i < lat.length; i++) {
    const la = lat[i];
    const lo = lon[i];
    if (la === null || lo === null || la === undefined || lo === undefined) continue;
    const key = la + ',' + lo;
    if (!cache.has(key)) {
      const dists = distsFor(la, lo, coords);
      cache.set(key, dists);
      let best = null;
      let bd = Infinity;
      for (const [c, dv] of dists) {
        if (best === null || dv < bd) { best = c; bd = dv; }
      }
      if (dists.get(best) <= radiusM) observed.add(best);
      for (const [c, dv] of dists) {
        const cur = hitAny.has(c) ? hitAny.get(c) : Infinity;
        if (dv < cur) hitAny.set(c, dv);
      }
    }
  }
  const scores = [];
  for (const ln of lines) {
    const terms = ln.terminals;
    let inLine = 0;
    let nTerm = 0;
    for (const c of ln.codes) {
      const h = hitAny.has(c) ? hitAny.get(c) : Infinity;
      if (h <= (terms.has(c) ? terminalRadiusM : radiusM)) {
        inLine++;
        if (terms.has(c)) nTerm++;
      }
    }
    let off = 0;
    for (const c of observed) if (!ln.codes.has(c)) off++;
    scores.push({
      line_id: ln.lineId,
      score: inLine + 3 * nTerm - 2 * off,
      in_line: inLine,
      off_line: off,
      terminals: nTerm,
    });
  }
  scores.sort((a, b) => (b.score - a.score) || (a.line_id - b.line_id));
  return scores;
}

function newSeg(d, start, nSt, method) {
  return {
    d,
    start,
    n_st: nSt,
    end: -1,
    method_in: method,
    stat: new Array(nSt).fill('not_reached'),
    enter: new Array(nSt).fill(null),
    bnd: new Array(nSt).fill(null),
    k0: null,
    j: -1,
    dwell: false,
    win0: null,
  };
}

function maxGap(tsUs, lo, hi) {
  if (tsUs === null || tsUs === undefined || hi <= lo) return null;
  let best = 0.0;
  const stop = Math.min(hi, tsUs.length - 1);
  for (let i = lo; i < stop; i++) {
    const sec = (tsUs[i + 1] - tsUs[i]) / 1e6;
    best = Math.max(best, sec);
  }
  return best;
}

function initialDirection(C, dist, line, rOf, notes) {
  const codes = Array.from(line.codes).sort();
  const hits = [];
  for (let p = 0; p < C.length; p++) {
    let best = null;
    let bd = Infinity;
    for (const c of codes) {
      const dv = dist.get(c)[p];
      if (dv < bd) { best = c; bd = dv; }
    }
    if (best !== null && bd <= rOf(best)) {
      if (!hits.includes(best)) {
        hits.push(best);
        if (hits.length === 3) break;
      }
    }
  }
  if (hits.length === 0) {
    notes.push('no station hit: direction 1 assumed, whole run flagged edge');
    return 0;
  }
  const counts = [];
  for (const d of line.directions) {
    const idx = new Map(d.codes.map((c, i) => [c, i]));
    let cnt = 0;
    for (let i = 0; i + 1 < hits.length; i++) {
      const a = hits[i];
      const b = hits[i + 1];
      if (idx.has(a) && idx.has(b) && idx.get(b) > idx.get(a)) cnt++;
    }
    counts.push(cnt);
  }
  const top = Math.max(...counts);
  const cands = [];
  counts.forEach((c, i) => { if (c === top) cands.push(i); });
  if (cands.length === 1) return cands[0];
  const first = cands.filter((i) => line.directions[i].codes[0] === hits[0]);
  if (first.length === 1) return first[0];
  notes.push('initial direction undecided: direction 1 assumed');
  return 0;
}

function segment(C, dist, line, initDir, radiusM, terminalRadiusM, timestamps) {
  const m = C.length;
  const nd = line.directions.length;
  const segs = [];
  const turns = [];

  const mkSeg = (d, start, method) => {
    const sg = newSeg(d, start, line.directions[d].stations.length, method);
    segs.push(sg);
    return sg;
  };

  let seg = mkSeg(initDir, 0, 'start');
  let p = 0;
  let guard = 0;
  let cand = null;
  while (p < m && guard < 50 * (m + 10)) {
    guard++;
    const s = C[p];
    let S = line.directions[seg.d].stations;
    let last = S.length - 1;
    const r = (k) => ((k === 0 || k === last) ? terminalRadiusM : radiusM);
    const dd = (k) => dist.get(S[k].code)[p];

    if (seg.dwell) {
      if (dd(seg.j) <= r(seg.j)) {
        p += 1;
        continue;
      }
      seg.bnd[seg.j] = s;
      seg.dwell = false;
      if (seg.j === last) {
        const arrive = seg.enter[last];
        turns.push({
          index: s, method: 'terminal', terminal_code: S[last].code,
          gap_s: maxGap(timestamps, arrive, s),
        });
        seg.end = s;
        const prev = seg;
        seg = mkSeg((seg.d + 1) % nd, s, 'terminal');
        seg.win0 = prev.enter[last];
        seg.stat[0] = 'hit';
        seg.enter[0] = s;
        seg.bnd[0] = s;
        seg.k0 = 0;
        seg.j = 0;
        cand = null;
        S = line.directions[seg.d].stations;
        last = S.length - 1;
      }
    }

    const j = seg.j;
    const lo = j + 1;
    const hi = j < 0 ? last : Math.min(j + 3, last);
    let found = null;
    for (let k = lo; k <= hi; k++) {
      if (dd(k) <= r(k)) { found = k; break; }
    }
    if (found !== null) {
      if (j >= 0) {
        for (let q = j + 1; q < found; q++) seg.stat[q] = 'inferred';
      }
      if (seg.k0 === null) seg.k0 = found;
      seg.stat[found] = 'hit';
      seg.enter[found] = s;
      seg.j = found;
      seg.dwell = true;
      cand = null;
      p += 1;
      continue;
    }

    if (j >= 1) {
      if (cand === null) {
        for (let q = j; q >= 0; q--) {
          if (dd(q) <= r(q)) { cand = [q, p]; break; }
        }
      } else {
        let confirmed = false;
        for (let q2 = 0; q2 < cand[0]; q2++) {
          if (dd(q2) <= r(q2)) {
            const tCode = S[last].code;
            const loPos = bisectRight(C, seg.bnd[j] - 1);
            let pstar = null;
            let pd = Infinity;
            for (let x = loPos; x <= cand[1]; x++) {
              const dv = dist.get(tCode)[x];
              if (pstar === null || dv < pd) { pstar = x; pd = dv; }
            }
            for (let q = j + 1; q <= last; q++) seg.stat[q] = 'inferred';
            const tidx = C[pstar];
            turns.push({
              index: tidx, method: 'reversal', terminal_code: tCode,
              gap_s: maxGap(timestamps, seg.bnd[j], C[cand[1]]),
            });
            seg.end = tidx;
            seg = mkSeg((seg.d + 1) % nd, tidx, 'reversal');
            seg.stat[0] = 'inferred';
            seg.bnd[0] = tidx;
            seg.k0 = 0;
            seg.j = 0;
            cand = null;
            p = pstar;
            confirmed = true;
            break;
          }
        }
        if (confirmed) continue;
        p += 1;
        continue;
      }
      p += 1;
      continue;
    }
    p += 1;
  }
  seg.end = -2;
  return { segs, turns };
}

function resolveBoundaries(seg, S, C, dist) {
  const last = S.length - 1;
  const end = seg.end;
  for (let k = 0; k < last; k++) {
    if (seg.stat[k] !== 'inferred' || seg.bnd[k] !== null) continue;
    let prev = null;
    for (let a = k - 1; a >= 0; a--) {
      if (seg.bnd[a] !== null) { prev = seg.bnd[a]; break; }
    }
    if (prev === null) prev = seg.start;
    let nxt = end;
    for (let b = k + 1; b <= last; b++) {
      if (seg.stat[b] === 'hit' && seg.enter[b] !== null) { nxt = seg.enter[b]; break; }
    }
    const loPos = bisectRight(C, prev);
    let best = null;
    let bd = Infinity;
    let pos = loPos;
    const dk = dist.get(S[k].code);
    while (pos < C.length && C[pos] < nxt) {
      const dv = dk[pos];
      if (dv < bd) { best = C[pos]; bd = dv; }
      pos++;
    }
    const bIdx = best === null ? nxt : best;
    seg.bnd[k] = Math.max(bIdx, prev);
  }
}

export function expandRuns(runs, n) {
  const out = new Array(n).fill(0);
  for (let i = 0; i < runs.length; i++) {
    const [start, val] = runs[i];
    const stop = i + 1 < runs.length ? runs[i + 1][0] : n;
    for (let x = start; x < stop; x++) out[x] = val;
  }
  return out;
}

function rle(values) {
  const runs = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!runs.length || runs[runs.length - 1][1] !== v) runs.push([i, v]);
  }
  return runs;
}

export function assign(lat, lon, lines, { radiusM = 100, terminalRadiusM = 200, timestampsUs = null } = {}) {
  const n = lat.length;
  const notes = [];
  const scores = scoreLines(lat, lon, lines, radiusM, terminalRadiusM);
  const chosen = lines.find((l) => l.lineId === scores[0].line_id);
  const ambiguous = scores.length > 1 && scores[0].score - scores[1].score < 1;
  if (scores.length > 1) {
    notes.push(`line ${scores[0].line_id} score ${fmtG(scores[0].score)}, `
      + `runner-up line ${scores[1].line_id} score ${fmtG(scores[1].score)}`);
  }
  if (ambiguous) notes.push(`ambiguous line: ${scores[0].line_id} vs ${scores[1].line_id}`);

  const has = (i) => lat[i] !== null && lon[i] !== null && lat[i] !== undefined && lon[i] !== undefined;
  const C = [];
  for (let i = 0; i < n; i++) if (has(i)) C.push(i);
  const coords = new Map();
  const display = new Map();
  for (const d of chosen.directions) {
    for (const s of d.stations) {
      if (!coords.has(s.code)) coords.set(s.code, [s.lat, s.lon]);
      if (!display.has(s.code)) display.set(s.code, s.display);
    }
  }
  const cache = new Map();
  const dist = new Map();
  for (const c of coords.keys()) dist.set(c, []);
  for (const i of C) {
    const key = lat[i] + ',' + lon[i];
    let dv = cache.get(key);
    if (dv === undefined) {
      dv = distsFor(lat[i], lon[i], coords);
      cache.set(key, dv);
    }
    for (const c of coords.keys()) dist.get(c).push(dv.get(c));
  }

  const terms = chosen.terminals;
  const rOf = (code) => (terms.has(code) ? terminalRadiusM : radiusM);

  const initDir = C.length ? initialDirection(C, dist, chosen, rOf, notes) : 0;
  const { segs, turns } = segment(C, dist, chosen, initDir, radiusM, terminalRadiusM, timestampsUs);
  segs[segs.length - 1].end = n;
  for (const sg of segs) if (sg.end === -1) sg.end = n;

  const sentidos = [];
  const trechos = [];
  const offsets = [];
  let order = 0;
  for (const d of chosen.directions) {
    const a = d.fromCode;
    const b = d.toCode;
    sentidos.push({
      code: `${a}-${b}`,
      name: `Sentido ${d.index + 1} — ${display.get(a)} → ${display.get(b)}`,
      direction_index: d.index,
    });
    offsets.push(trechos.length);
    for (let i = 0; i + 1 < d.stations.length; i++) {
      const s1 = d.stations[i];
      const s2 = d.stations[i + 1];
      order += 1;
      trechos.push({
        id: `${s1.code}-${s2.code}`,
        name: `${display.get(s1.code)} – ${display.get(s2.code)}`,
        sentido: d.index,
        order,
        from_code: s1.code,
        to_code: s2.code,
      });
    }
  }

  const sentidoArr = new Array(n).fill(0);
  const trechoArr = new Array(n).fill(0);
  const flagArr = new Array(n).fill(0);
  for (let i = 0; i < n; i++) if (!has(i)) flagArr[i] |= FLAG_SEM_GPS;

  const passages = [];
  const notHit = [];
  for (let si = 0; si < segs.length; si++) {
    const sg = segs[si];
    const S = chosen.directions[sg.d].stations;
    const last = S.length - 1;
    if (sg.end < sg.start) sg.end = sg.start;
    resolveBoundaries(sg, S, C, dist);
    const k0 = sg.k0;
    const tBase = k0 === null ? 0 : Math.max(k0 - 1, 0);
    let cur = tBase;
    const bps = [];
    if (k0 !== null) {
      for (let t = k0; t < last; t++) {
        if (sg.bnd[t] === null) break;
        bps.push([sg.bnd[t], t]);
      }
    }
    let pos = sg.start;
    for (const [bp0, t] of bps) {
      const bp = Math.max(Math.min(bp0, sg.end), pos);
      for (let x = pos; x < bp; x++) trechoArr[x] = offsets[sg.d] + cur;
      pos = bp;
      cur = t;
    }
    for (let x = pos; x < sg.end; x++) trechoArr[x] = offsets[sg.d] + cur;
    for (let x = sg.start; x < sg.end; x++) {
      sentidoArr[x] = sg.d;
      const tLocal = trechoArr[x] - offsets[sg.d];
      if (sg.stat[tLocal] === 'inferred' || sg.stat[tLocal + 1] === 'inferred') {
        flagArr[x] |= FLAG_INFERRED_STATION;
      }
    }
    if (k0 === null) {
      for (let x = sg.start; x < sg.end; x++) flagArr[x] |= FLAG_EDGE;
    } else {
      if (si === 0) {
        for (let x = sg.start; x < Math.min(sg.enter[k0], sg.end); x++) flagArr[x] |= FLAG_EDGE;
      }
      if (si === segs.length - 1 && !sg.dwell && sg.bnd[sg.j] !== null && sg.j < last) {
        for (let x = sg.bnd[sg.j]; x < sg.end; x++) flagArr[x] |= FLAG_EDGE;
      }
    }
    for (let k = 0; k < S.length; k++) {
      let wLo = sg.start;
      if (k === 0 && sg.win0 !== null) wLo = sg.win0;
      const loPos = bisectRight(C, wLo - 1);
      const hiPos = bisectRight(C, sg.end - 1);
      let md = null;
      if (hiPos > loPos) {
        const dk = dist.get(S[k].code);
        md = Infinity;
        for (let x = loPos; x < hiPos; x++) if (dk[x] < md) md = dk[x];
      }
      passages.push({
        sentido: sg.d, segment: si, code: S[k].code, status: sg.stat[k],
        min_dist_m: md, boundary_idx: sg.bnd[k],
      });
      if (sg.stat[k] === 'inferred') notHit.push([sg.d, S[k].code, md]);
    }
  }

  return {
    line_id: chosen.lineId,
    line_scores: scores,
    ambiguous,
    sentidos,
    trechos,
    sentido_runs: rle(sentidoArr),
    trecho_runs: rle(trechoArr),
    flag_runs: rle(flagArr),
    passages,
    stations_not_hit: notHit,
    turnarounds: turns,
    notes,
  };
}
