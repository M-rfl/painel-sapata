import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  expandRuns, fromArrays, decodeRun,
  halfUp, median2, restOffset2, dominant, thresholds2, classify,
  groupImpacts, pointsByLocation,
  perTrecho, trechoPriority, regionSplit, conformeCheck, DEFAULT_PARAMS,
} from '../../site/js/core/index.js';
import { loadRun1, loadJson, arr, fnv1a } from './helpers.js';

// ---------- data ----------
test('fnv1a empty', () => assert.equal(fnv1a([]), '811c9dc5'));

test('expandRuns', () => {
  assert.deepEqual(arr(expandRuns([[0, 5], [2, 7]], 4)), [5, 5, 7, 7]);
});

test('fromArrays null mask', () => {
  const r = fromArrays({ ax: [1, null, 3], ay: [1, 2, 3], az: [1, 2, 3], tMs: [0, 1, 2], locKey: [null, null, null], trecho: [0, 0, 0], trechoNames: ['A'], source: null });
  assert.deepEqual(arr(r.valid), [1, 0, 1]);
  assert.deepEqual(arr(r.axValid), [1, 0, 1]);
  assert.equal(r.ax[1], 0);
  assert.equal(r.region, null);
});

test('fromArrays locKey and region', () => {
  const r = fromArrays({ ax: [0, 0, 0, 0, 0], ay: [0, 0, 0, 0, 0], az: [0, 0, 0, 0, 0], tMs: [0, 1, 2, 3, 4], locKey: ['a', null, 'b', 'a', null], trecho: [0, 0, 0, 0, 0], trechoNames: ['A'], source: [1, 1, 0, 0, 1] });
  assert.deepEqual(arr(r.locId), [0, -1, 1, 0, -1]);
  assert.deepEqual(arr(r.region), [0, 0, 1, 1, 0]);
  assert.equal(r.nRegions, 2);
});

test('decodeRun run 1', () => {
  const r = loadRun1();
  assert.equal(r.n, 23383);
  assert.equal(r.tMs[0], 0);
  assert.ok(r.tMs[1] > 0 && r.tMs[2] > r.tMs[1]);
  assert.equal(new Set(arr(r.locId).filter((x) => x >= 0)).size, 99);
  assert.equal(r.trechoNames.length, 20);
  const j = loadJson('site/data/run-2026-10-02-l4-t102.json');
  if (!j.meta.workbook_reference) assert.equal(r.reference, null);
  if (!j.source_runs) assert.equal(r.region, null); else assert.notEqual(r.region, null);
});

test('decodeRun rejects other schema', () => {
  assert.throws(() => decodeRun({ schema: 2 }));
  assert.throws(() => decodeRun({}));
});

// ---------- dynamics / classify ----------
const mk = (ax, ay = null, az = null) => fromArrays({
  ax, ay: ay ?? ax.map(() => 0), az: az ?? ax.map(() => 0),
  tMs: ax.map((_, i) => i * 100), locKey: ax.map(() => null), trecho: ax.map(() => 0), trechoNames: ['T'], source: null,
});

test('median2', () => {
  assert.equal(median2([1, 2, 3]), 4);
  assert.equal(median2([0, 1, 5, 6]), 6);
  assert.equal(median2([0, 1, 2, 4]), 3);
  assert.equal(median2([]), 0);
  assert.equal(median2([-10, -2, 5]), -4);
  assert.equal(median2([100, -5, 7, 2, -300]), 4);
});

test('halfUp', () => {
  assert.equal(halfUp(2.5), 3);
  assert.equal(halfUp(-2.5), -2);
  assert.equal(halfUp(-4035.5), -4035);
});

test('restOffset2 ignores nulls and manual offset', () => {
  const r = fromArrays({ ax: [1, null, 3, 9], ay: [0, 0, 0, 0], az: [0, 0, 0, 0], tMs: [0, 1, 2, 3], locKey: [null, null, null, null], trecho: [0, 0, 0, 0], trechoNames: ['T'], source: null });
  assert.equal(restOffset2(r, { mode: 'median' }).med2[0], 6);
  const m = restOffset2(r, { mode: 'manual', g: [0.0458984375, -0.0185546875, -0.9853515625] });
  assert.deepEqual(m.off2, [188, -76, -4036]);
});

test('dominant ties X > Y > Z', () => {
  let r = mk([1500], [1500], [0]);
  assert.equal(dominant(r, [0, 0, 0]).domAxis[0], 0);
  r = mk([1500], [1600], [0]);
  assert.equal(dominant(r, [0, 0, 0]).domAxis[0], 1);
  r = mk([0], [1500], [1500]);
  assert.equal(dominant(r, [0, 0, 0]).domAxis[0], 1);
});

test('thresholds2', () => {
  assert.deepEqual(thresholds2([0.5, 1, 2, 4]), [2048, 4096, 8192, 16384]);
  assert.deepEqual(thresholds2([0.7]), [2868]);
});

function classes(vals, th = [0.5, 1, 2, 4]) {
  const r = mk(vals);
  const { dom2 } = dominant(r, [0, 0, 0]);
  return arr(classify(dom2, r.valid, thresholds2(th)));
}

test('inclusive thresholds', () => {
  assert.deepEqual(classes([1024, 1023, 2048, 4096, 8192]), [1, 0, 2, 3, 4]);
});

test('threshold 0.7', () => {
  assert.deepEqual(classes([1434, 1433], [0.7]), [1, 0]);
});

test('unclassified row', () => {
  const r = fromArrays({ ax: [5, null], ay: [0, 0], az: [0, 0], tMs: [0, 1], locKey: [null, null], trecho: [0, 0], trechoNames: ['T'], source: null });
  const { dom2, domAxis } = dominant(r, [0, 0, 0]);
  assert.deepEqual(arr(classify(dom2, r.valid, [2048])), [0, -1]);
  assert.equal(dom2[1], 0);
  assert.equal(domAxis[1], -1);
});

// ---------- events ----------
const evCls = (n, rows, extra = {}) => {
  const c = new Int8Array(n);
  for (const r of rows) c[r] = 1;
  for (const [k, v] of Object.entries(extra)) c[k] = v;
  return c;
};
const flatT = (n, step = 100) => Float64Array.from({ length: n }, (_, i) => i * step);

test('groupImpacts basic and peak/class', () => {
  const cls = evCls(10, [2, 3, 7], { 3: 3 });
  const dom2 = new Int32Array(10); dom2[2] = 5; dom2[3] = 9; dom2[7] = 3;
  const im = groupImpacts(dom2, cls, flatT(10), 0, 2000);
  assert.deepEqual(im.map((x) => x.start), [2, 7]);
  assert.equal(im[0].cls, 3);
  assert.equal(im[0].peak, 3);
  assert.equal(im[0].nEv, 2);
  const tie = groupImpacts(new Int32Array(10).fill(4), evCls(10, [2, 3]), flatT(10), 0, 2000);
  assert.equal(tie[0].peak, 2);
});

test('gap', () => {
  const d = new Int32Array(10);
  assert.equal(groupImpacts(d, evCls(10, [2, 4]), flatT(10), 0, 2000).length, 2);
  assert.equal(groupImpacts(d, evCls(10, [2, 4]), flatT(10), 1, 2000).length, 1);
  assert.equal(groupImpacts(d, evCls(10, [2, 5]), flatT(10), 1, 2000).length, 2);
  assert.equal(groupImpacts(d, evCls(10, [2, 5]), flatT(10), 2, 2000).length, 1);
});

test('unclassified between events counts toward gap', () => {
  const c = evCls(10, [6, 8], { 7: -1 });
  const d = new Int32Array(10);
  assert.equal(groupImpacts(d, c, flatT(10), 0, 2000).length, 2);
  assert.equal(groupImpacts(d, c, flatT(10), 1, 2000).length, 1);
});

test('time jump', () => {
  const d = new Int32Array(4);
  const c = evCls(4, [1, 2]);
  const t = (dt) => Float64Array.from([0, 0, dt, dt + 1]);
  assert.equal(groupImpacts(d, c, t(2000), 0, 2000).length, 1);
  assert.equal(groupImpacts(d, c, t(2001), 0, 2000).length, 2);
});

test('pointsByLocation', () => {
  const n = 13;
  const cls = evCls(n, [3, 4, 8, 12]);
  const dom2 = new Int32Array(n); dom2[3] = 1100; dom2[4] = 1500; dom2[8] = 10; dom2[12] = 7;
  const locId = new Int32Array(n).fill(-1);
  locId[3] = 0; locId[4] = 0; locId[8] = 1;
  const trecho = new Int32Array(n); trecho[12] = 1;
  assert.deepEqual(arr(pointsByLocation(dom2, cls, locId, trecho)), [4, 8, 12]);
  const tied = new Int32Array(n).fill(5);
  assert.deepEqual(arr(pointsByLocation(tied, evCls(n, [3, 4]), locId, trecho)), [3]);
});

// ---------- aggregate ----------
function synth(trechos, imps) {
  const n = trechos.length;
  const run = { n, trecho: Int32Array.from(trechos), trechoNames: ['A', 'B', 'C', 'D', 'E'] };
  const cls = new Int8Array(n);
  const dom2 = new Int32Array(n);
  const impacts = imps.map(([peak, c, d]) => { cls[peak] = c; dom2[peak] = d; return { start: peak, end: peak, peak, cls: c, nEv: 1 }; });
  return { run, cls, dom2, impacts };
}

test('perTrecho levels and empty trecho', () => {
  const s = synth([0, 1, 2, 3, 0], [[0, 4, 9], [1, 3, 8], [2, 2, 7], [3, 1, 6]]);
  const pt = perTrecho(s.run, s.cls, s.impacts, [], s.dom2, 5);
  const pr = trechoPriority(pt, s.run.trechoNames, 5);
  assert.deepEqual(pr.map((x) => x.level), [1, 2, 3, 4, 4]);
  assert.equal(pt[4].topCount, 0);
  assert.equal(pt[4].peakDom2, 0);
  assert.equal(pt[4].records, 0);
});

test('priority ordering', () => {
  const pt = [
    { maxCls: 4, topCount: 1, peakDom2: 5 }, { maxCls: 4, topCount: 2, peakDom2: 1 },
    { maxCls: 4, topCount: 1, peakDom2: 9 }, { maxCls: 4, topCount: 1, peakDom2: 9 },
  ];
  assert.deepEqual(trechoPriority(pt, ['a', 'b', 'c', 'd'], 5).map((x) => x.trecho), [1, 2, 3, 0]);
});

test('impact counts for trecho of its peak; peakDom2 from all event rows', () => {
  const run = { n: 3, trecho: Int32Array.from([0, 1, 1]), trechoNames: ['A', 'B'] };
  const cls = Int8Array.from([4, 4, 1]);
  const dom2 = Int32Array.from([5, 10, 50]);
  const pt = perTrecho(run, cls, [{ start: 0, end: 2, peak: 1, cls: 4, nEv: 3 }], [], dom2, 5);
  assert.equal(pt[0].impactos, 0);
  assert.equal(pt[1].impactos, 1);
  assert.equal(pt[1].maxCls, 4);
  assert.equal(pt[1].peakDom2, 50);
});

test('custom class count follows index mapping', () => {
  assert.equal(trechoPriority([{ maxCls: 3, topCount: 1, peakDom2: 1 }], ['A'], 4)[0].level, 1);
});

test('regionSplit', () => {
  const cls = Int8Array.from([0, 1, 0, 0, 2, 0]);
  assert.deepEqual(regionSplit(Int32Array.from([0, 0, 0, 1, 1, 1]), 2, cls), { records: [3, 3], eventos: [1, 1] });
  assert.equal(regionSplit(null, 0, cls), null);
});

test('conformeCheck unavailable, pt-BR formatting, split rules', () => {
  const base = { classCounts: [1, 2], eventos: 2, impactos: 1749, impactsByClass: [1], regionSplit: null };
  const th = { thresholds_g: [0.5, 1, 2, 4] };
  assert.deepEqual(conformeCheck(base, DEFAULT_PARAMS, null), { available: false, ok: null, reasons: [] });
  assert.deepEqual(conformeCheck(base, DEFAULT_PARAMS, { ...th, impactos: 1750 }).reasons, ['impactos 1.749 ≠ 1.750']);
  assert.equal(conformeCheck(base, DEFAULT_PARAMS, { ...th, impactos: 1749 }).ok, true);
  assert.deepEqual(conformeCheck(base, DEFAULT_PARAMS, { ...th, sentido_records: [1, 2] }).reasons, ['divisão por arquivo indisponível']);
  assert.equal(conformeCheck(base, DEFAULT_PARAMS, th).ok, true);
});
