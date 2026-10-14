// Pure module: no DOM/window. Track quality index (KPI-06).

/**
 * IQ = 1 - sum(k * count_k) / (D * N) over classified medicoes (D = ncls - 1).
 * Bands use integer arithmetic: >= 95 % Bom, >= 85 % Regular, else Ruim.
 */
export function qualityIndex(classCounts) {
  const D = classCounts.length - 1;
  let N = 0;
  let S = 0;
  classCounts.forEach((c, k) => { N += c; S += k * c; });
  if (N === 0 || D <= 0) return { value: null, band: null, n: N };
  const value = 1 - S / (D * N);
  const band = 20 * S <= D * N ? 'bom' : 100 * S <= 15 * D * N ? 'regular' : 'ruim';
  return { value, band, n: N };
}
