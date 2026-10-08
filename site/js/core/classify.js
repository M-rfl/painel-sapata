// Pure module: no DOM/window; mirrors tools/dashboard_converter/analysis_ref.py.

/** Thresholds in doubled LSB. Assumes strictly increasing input (unordered is undefined). */
export function thresholds2(thresholds_g) {
  return thresholds_g.map((t) => Math.ceil(t * 4096));
}

/** Class = number of thresholds <= dom2 (lower bound inclusive); -1 for unclassified rows. */
export function classify(dom2, valid, th2) {
  const n = dom2.length;
  const cls = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    if (!valid[i]) { cls[i] = -1; continue; }
    let c = 0;
    for (let j = 0; j < th2.length; j++) if (th2[j] <= dom2[i]) c++;
    cls[i] = c;
  }
  return cls;
}
