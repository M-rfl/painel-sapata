// Pure module: no DOM/window; mirrors tools/dashboard_converter/analysis_ref.py.

/** Round half up (toward +infinity). Deliberately not the built-in rounding helper. */
export function halfUp(x) { return Math.floor(x + 0.5); }

/** Twice the median of the values (integer). Empty -> 0. */
export function median2(values) {
  const s = Int32Array.from(values).sort(); // typed-array sort is numeric
  const n = s.length;
  if (n === 0) return 0;
  if (n % 2) return 2 * s[(n - 1) >> 1];
  return s[n / 2 - 1] + s[n / 2];
}

/** Rest offsets in doubled LSB. offset: {mode:'median'} | {mode:'manual', g:[gx,gy,gz]}. */
export function restOffset2(run, offset = { mode: 'median' }) {
  const axes = [run.ax, run.ay, run.az];
  const oks = [run.axValid, run.ayValid, run.azValid];
  const med2 = axes.map((a, k) => {
    const vals = [];
    for (let i = 0; i < run.n; i++) if (oks[k][i]) vals.push(a[i]);
    return median2(vals);
  });
  const off2 = offset && offset.mode === 'manual'
    ? offset.g.map((g) => halfUp(g * 4096))
    : med2.slice();
  return { med2, off2 };
}

/** Dominant deviation per row in doubled LSB; ties go X > Y > Z. */
export function dominant(run, off2) {
  const n = run.n;
  const dom2 = new Int32Array(n);
  const domAxis = new Int8Array(n).fill(-1);
  const axes = [run.ax, run.ay, run.az];
  for (let i = 0; i < n; i++) {
    if (!run.valid[i]) continue;
    let best = -1;
    let axis = -1;
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(2 * axes[k][i] - off2[k]);
      if (d > best) { best = d; axis = k; }
    }
    dom2[i] = best;
    domAxis[i] = axis;
  }
  return { dom2, domAxis };
}
