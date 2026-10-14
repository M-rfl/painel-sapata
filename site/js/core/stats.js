// Pure module: no DOM/window. Statistics behind the overview KPIs (means/maxima, per-axis table).
// Label rule: "Maior = maior valor absoluto, sinal preservado".

export const LSB_PER_G = 2048;
const MODES = ['medido', 'dinamico'];

/**
 * Percentile of an ASCENDING-sorted array using Excel PERCENTILE.INC (linear interpolation,
 * rank h = p*(n-1)). The workbook "Estatisticas" sheet is assumed to use this method (MEDIUM confidence).
 */
export function percentile(sorted, p) {
  const n = sorted.length;
  if (n === 0) return NaN;
  const h = p * (n - 1);
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

/** Descriptive statistics of a numeric array (sample std, n-1). */
export function describe(values) {
  const n = values.length;
  if (n === 0) {
    return { n: 0, mean: NaN, median: NaN, std: NaN, p005: NaN, p995: NaN, min: NaN, max: NaN, maxAbs: NaN };
  }
  const sorted = Float64Array.from(values).sort();
  let sum = 0;
  let maxAbs = values[0];
  for (let i = 0; i < n; i++) {
    sum += values[i];
    if (Math.abs(values[i]) > Math.abs(maxAbs)) maxAbs = values[i];
  }
  const mean = sum / n;
  let std = 0;
  if (n > 1) {
    let ss = 0;
    for (let i = 0; i < n; i++) { const d = values[i] - mean; ss += d * d; }
    std = Math.sqrt(ss / (n - 1));
  }
  return {
    n, mean, median: percentile(sorted, 0.5), std,
    p005: percentile(sorted, 0.005), p995: percentile(sorted, 0.995),
    min: sorted[0], max: sorted[n - 1], maxAbs,
  };
}

function checkMode(mode) {
  if (!MODES.includes(mode)) throw new Error(`stats: unknown mode "${mode}"`);
}

/** Per-axis LSB -> g converters. medido: l/2048; dinamico: (2l - off2)/4096. */
export function axisConverters(analysis, mode) {
  checkMode(mode);
  if (mode === 'medido') {
    return [(l) => l / LSB_PER_G, (l) => l / LSB_PER_G, (l) => l / LSB_PER_G];
  }
  const o = analysis.off2;
  return [(l) => (2 * l - o[0]) / 4096, (l) => (2 * l - o[1]) / 4096, (l) => (2 * l - o[2]) / 4096];
}

export function resultant(x, y, z) { return Math.sqrt(x * x + y * y + z * z); }

/** Per-axis g values (+ resultant) over rows with mask[i] && valid[i]; mask null = all rows. */
export function axisValues(run, analysis, mask, mode) {
  const [fx, fy, fz] = axisConverters(analysis, mode);
  let m = 0;
  for (let i = 0; i < run.n; i++) if ((!mask || mask[i]) && run.valid[i]) m++;
  const ax = new Float64Array(m);
  const ay = new Float64Array(m);
  const az = new Float64Array(m);
  const res = new Float64Array(m);
  let k = 0;
  for (let i = 0; i < run.n; i++) {
    if (!((!mask || mask[i]) && run.valid[i])) continue;
    const x = fx(run.ax[i]); const y = fy(run.ay[i]); const z = fz(run.az[i]);
    ax[k] = x; ay[k] = y; az[k] = z;
    res[k] = resultant(x, y, z);
    k++;
  }
  return { ax, ay, az, res };
}

function meanMax(v) {
  const n = v.ax.length;
  if (n === 0) {
    return { mean: [NaN, NaN, NaN], meanRes: NaN, maxAbs: [NaN, NaN, NaN], maxRes: NaN, n: 0 };
  }
  const arrs = [v.ax, v.ay, v.az];
  const mean = []; const maxAbs = [];
  for (const a of arrs) {
    let s = 0; let mx = a[0];
    for (let i = 0; i < n; i++) {
      s += a[i];
      if (Math.abs(a[i]) > Math.abs(mx)) mx = a[i];
    }
    mean.push(s / n); maxAbs.push(mx);
  }
  let sr = 0; let maxRes = v.res[0];
  for (let i = 0; i < n; i++) { sr += v.res[i]; if (v.res[i] > maxRes) maxRes = v.res[i]; }
  return { mean, meanRes: sr / n, maxAbs, maxRes, n };
}

/** Means and maxima, medido and dinamico, one pass per mode. */
export function meansMaxima(run, analysis, mask) {
  return {
    medido: meanMax(axisValues(run, analysis, mask, 'medido')),
    dinamico: meanMax(axisValues(run, analysis, mask, 'dinamico')),
  };
}

/** Per-axis statistics table: rows ax, ay, az, res. */
export function axisStatsTable(run, analysis, mask, mode) {
  const v = axisValues(run, analysis, mask, mode);
  return ['ax', 'ay', 'az', 'res'].map((key) => ({ key, ...describe(v[key]) }));
}
