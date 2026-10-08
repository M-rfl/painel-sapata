// Pure module: no DOM/window; mirrors tools/dashboard_converter/analysis_ref.py.

/** Group event rows (cls >= 1) into impacts with one forward scan. */
export function groupImpacts(dom2, cls, tMs, gap, maxJumpMs) {
  const out = [];
  let cur = null;
  let last = -1;
  for (let i = 0; i < cls.length; i++) {
    if (cls[i] < 1) continue;
    if (cur === null || (i - last - 1) > gap || (tMs[i] - tMs[last]) > maxJumpMs) {
      cur = { start: i, end: i, peak: i, cls: cls[i], nEv: 0 };
      out.push(cur);
    }
    if (dom2[i] > dom2[cur.peak]) cur.peak = i;
    if (cls[i] > cur.cls) cur.cls = cls[i];
    cur.end = i;
    cur.nEv++;
    last = i;
  }
  return out;
}

/** One point per location (or per trecho when no GPS): strongest event row, first max wins. */
export function pointsByLocation(dom2, cls, locId, trecho) {
  const best = new Map();
  for (let i = 0; i < cls.length; i++) {
    if (cls[i] < 1) continue;
    const key = locId[i] >= 0 ? locId[i] : -1 - trecho[i];
    const b = best.get(key);
    if (b === undefined || dom2[i] > dom2[b]) best.set(key, i);
  }
  return Int32Array.from(best.values()).sort();
}
