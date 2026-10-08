// Pure module: no DOM/window; mirrors tools/dashboard_converter/analysis_ref.py.
import { DEFAULT_PARAMS, PRIORITY_NAMES } from './defaults.js';
import { restOffset2, dominant } from './dynamics.js';
import { thresholds2, classify } from './classify.js';
import { groupImpacts, pointsByLocation } from './events.js';
import { perTrecho, trechoPriority, regionSplit } from './aggregate.js';

/** Run the full rules pipeline. Does not mutate run or params. */
export function analyze(run, params = DEFAULT_PARAMS) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const { med2, off2 } = restOffset2(run, p.offset);
  const { dom2, domAxis } = dominant(run, off2);
  const th2 = thresholds2(p.thresholds_g);
  const ncls = th2.length + 1;
  const cls = classify(dom2, run.valid, th2);

  const classCounts = new Array(ncls).fill(0);
  let eventos = 0;
  let naoClassificadas = 0;
  for (let i = 0; i < run.n; i++) {
    const c = cls[i];
    if (c < 0) { naoClassificadas++; continue; }
    classCounts[c]++;
    if (c >= 1) eventos++;
  }

  const impacts = groupImpacts(dom2, cls, run.tMs, p.gap, p.maxJumpMs);
  const impactsByClass = new Array(ncls).fill(0);
  for (const im of impacts) impactsByClass[im.cls]++;

  const pointRows = pointsByLocation(dom2, cls, run.locId, run.trecho);
  const pointsByClass = new Array(ncls).fill(0);
  for (const r of pointRows) pointsByClass[cls[r]]++;

  const perT = perTrecho(run, cls, impacts, pointRows, dom2, ncls);
  const priority = trechoPriority(perT, run.trechoNames, ncls)
    .map((x) => ({ ...x, label: PRIORITY_NAMES[x.level] }));
  const split = regionSplit(run.region, run.nRegions, cls);

  const result = {
    params: p, med2, off2, mediansLsb: med2.map((m) => m / 2), th2, ncls,
    dom2, domAxis, cls, naoClassificadas, classCounts, eventos,
    impacts, impactos: impacts.length, impactsByClass,
    pointRows, pontos: pointRows.length, pointsByClass,
    perTrecho: perT, priority, regionSplit: split,
  };
  return result;
}
