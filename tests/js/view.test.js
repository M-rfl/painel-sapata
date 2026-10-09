import test from 'node:test';
import assert from 'node:assert/strict';
import { fromArrays, analyze } from '../../site/js/core/index.js';
import { normalizeFilters, rowMask, buildView } from '../../site/js/core/view.js';
import { loadRun1, golden, arr } from './helpers.js';

// Synthetic run: manual zero offset, thresholds 0.5/1/2/4 g -> class edges at 1024/2048/4096/8192 LSB.
const ZERO = { offset: { mode: 'manual', g: [0, 0, 0] } };
function synth() {
  //            0     1     2     3     4     5     6      7     8     9     10    11
  const ax = [100, 0, 0, 0, null, 6000, 0, 1500, 0, 0, 0, 100];
  const ay = [0, 1500, 0, 0, 0, 0, 10000, 0, 0, 0, 3000, 0];
  const az = [0, 0, 3000, 0, 0, 0, 0, 0, 100, 1500, 0, 0];
  const run = fromArrays({
    ax, ay, az, tMs: ax.map((_, i) => i * 100), locKey: null,
    trecho: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], trechoNames: ['A', 'B'], source: null,
  });
  run.sentido = Uint8Array.from([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
  return { run, an: analyze(run, ZERO) };
}
const ones = (m) => Array.from(m).reduce((a, b) => a + b, 0);

test('synthetic engine sanity', () => {
  const { an } = synth();
  assert.deepEqual(Array.from(an.cls), [0, 1, 2, 0, -1, 3, 4, 1, 0, 1, 2, 0]);
  assert.deepEqual(Array.from(an.domAxis), [0, 1, 2, 0, -1, 0, 1, 0, 2, 2, 1, 0]);
});

test('normalizeFilters and empty mask', () => {
  const { run, an } = synth();
  assert.deepEqual(normalizeFilters(undefined), { sentidos: [], trechos: [], eixos: [], classes: [], tFrom: null, tTo: null });
  assert.equal(ones(rowMask(run, an, undefined)), 12);
});

test('sentido filter and missing sentido field', () => {
  const { run, an } = synth();
  assert.deepEqual(Array.from(rowMask(run, an, { sentidos: [1] })), [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
  delete run.sentido;
  assert.equal(ones(rowMask(run, an, { sentidos: [0] })), 12);
  assert.equal(ones(rowMask(run, an, { sentidos: [1] })), 0);
});

test('trecho, eixo, classe filters', () => {
  const { run, an } = synth();
  assert.deepEqual(Array.from(rowMask(run, an, { trechos: [1] })), [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(Array.from(rowMask(run, an, { eixos: [2] })), [0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0]);
  assert.deepEqual(Array.from(rowMask(run, an, { classes: [3, 4] })), [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0]);
  // unclassified row 4 passes only with no eixo/classe filter
  assert.equal(rowMask(run, an, {})[4], 1);
  assert.equal(rowMask(run, an, { eixos: [0, 1, 2] })[4], 0);
  assert.equal(rowMask(run, an, { classes: [0, 1, 2, 3, 4] })[4], 0);
});

test('time window inclusive, combined AND', () => {
  const { run, an } = synth();
  assert.deepEqual(Array.from(rowMask(run, an, { tFrom: 200, tTo: 400 })), [0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(ones(rowMask(run, an, { tFrom: null, tTo: null })), 12);
  assert.deepEqual(Array.from(rowMask(run, an, { trechos: [1], sentidos: [1], classes: [1] })),
    [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0]);
});

test('buildView unfiltered KPIs', () => {
  const { run, an } = synth();
  const v = buildView(run, an, undefined);
  assert.equal(v.isFiltered, false);
  assert.equal(v.registros, 12);
  assert.equal(v.naoClassificadas, 1);
  assert.equal(v.eventos, 7);
  assert.deepEqual(v.classCounts, [4, 3, 2, 1, 1]);
  assert.deepEqual(v.classCounts, an.classCounts);
  assert.equal(v.eventos, an.eventos);
  // denominator excludes nao classificadas
  assert.ok(Math.abs(v.classPct.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.equal(v.classPct[0], 4 / 11);
  assert.deepEqual(v.impacts, an.impacts);
  assert.equal(v.impactos, an.impactos);
  assert.deepEqual(v.impactsByClass, an.impactsByClass);
  assert.deepEqual(Array.from(v.pointRows), Array.from(an.pointRows));
  assert.deepEqual(v.pointsByClass, an.pointsByClass);
});

test('buildView filtered: impacts by peak, points, axis breakdown, top trecho', () => {
  const { run, an } = synth();
  const v = buildView(run, an, { trechos: [1] });
  assert.equal(v.isFiltered, true);
  assert.equal(v.registros, 6);
  assert.equal(v.eventos, 4);
  assert.equal(v.naoClassificadas, 0);
  assert.deepEqual(v.eventosByTrecho, [0, 4]);
  assert.deepEqual(v.topTrecho, { trecho: 1, name: 'B', eventos: 4 });
  for (const im of v.impacts) assert.equal(v.mask[im.peak], 1);
  // impact peak in trecho 1 only (peak row 6 and 10)
  assert.deepEqual(v.impacts.map((i) => i.peak), an.impacts.filter((i) => run.trecho[i.peak] === 1).map((i) => i.peak));
  assert.equal(v.pontos, 1);
  assert.equal(run.trecho[v.pointRows[0]], 1);
  const sum = (rows) => rows.map((r) => r.reduce((a, b) => a + b, 0));
  assert.deepEqual(sum(v.axisByClass.medicoes), v.classCounts);
  assert.deepEqual(sum(v.axisByClass.impactos), v.impactsByClass);
  assert.deepEqual(sum(v.axisByClass.pontos), v.pointsByClass);
  // axis of the class-4 impact peak (row 6) is Y
  assert.deepEqual(v.axisByClass.impactos[4], [0, 1, 0]);
});

test('topTrecho null when no events; tie goes to lower order', () => {
  const { run, an } = synth();
  assert.equal(buildView(run, an, { classes: [0] }).topTrecho, null);
  const v = buildView(run, an, { classes: [1, 2] });
  // trecho 0: rows 1,2 -> 2 events; trecho 1: rows 7,9,10 -> 3
  assert.equal(v.topTrecho.trecho, 1);
  const w = buildView(run, an, { classes: [1, 2], tTo: 500 });
  assert.equal(w.topTrecho.trecho, 0);
  run.trechos = [{ order: 5 }, { order: 1 }];
  const tie = buildView(run, an, { classes: [1, 2], tFrom: 100, tTo: 700 }); // t0: 1,2 ; t1: 7
  assert.equal(tie.topTrecho.trecho, 0);
  const t2 = buildView(run, an, { classes: [1], tFrom: 100, tTo: 700 }); // t0: row1 ; t1: row7 -> tie
  assert.equal(t2.topTrecho.trecho, 1);
});

test('buildView does not mutate analysis', () => {
  const { run, an } = synth();
  const snap = () => JSON.stringify(an, (k, val) => (ArrayBuffer.isView(val) ? Array.from(val) : val));
  const before = snap();
  buildView(run, an, { trechos: [0], classes: [1, 2] });
  buildView(run, an, undefined);
  assert.equal(snap(), before);
});

// ---- run-1 golden and invariance ----
let r1 = null;
function run1() {
  if (!r1) { const run = loadRun1(); r1 = { run, an: analyze(run) }; }
  return r1;
}
const sumArr = (a) => a.reduce((x, y) => x + y, 0);

test('run1 unfiltered view reproduces engine totals', (t) => {
  const { run, an } = run1();
  const g = golden().exact;
  const v = buildView(run, an, undefined);
  assert.equal(v.registros, 23383);
  assert.equal(v.eventos, 2352);
  assert.equal(v.impactos, 1749);
  assert.deepEqual(v.classCounts, g.class_counts);
  assert.deepEqual(v.impactsByClass, g.impacts_by_class);
  assert.equal(v.pontos, an.pontos);
  assert.deepEqual(arr(v.pointRows), arr(an.pointRows));
  assert.equal(v.naoClassificadas, 0);
  assert.ok(Math.abs(sumArr(v.classPct) - 1) < 1e-12);
  assert.equal(v.topTrecho.name, 'Pereira Reis – Vila Olímpica');
  assert.equal(v.topTrecho.eventos, 427);
  t.diagnostic("workbook says 'Vila Olímpica – Central' 304; known Phase 9 per-trecho deviation (inferred stations, CTR 210 m)");
});

test('run1 axisByClass row sums equal class totals', () => {
  const { run, an } = run1();
  const v = buildView(run, an, undefined);
  const rs = (m) => m.map(sumArr);
  assert.deepEqual(rs(v.axisByClass.medicoes), v.classCounts);
  assert.deepEqual(rs(v.axisByClass.impactos), v.impactsByClass);
  assert.deepEqual(rs(v.axisByClass.pontos), v.pointsByClass);
});

test('run1 sentido and trecho partitions', () => {
  const { run, an } = run1();
  const s0 = buildView(run, an, { sentidos: [0] });
  const s1 = buildView(run, an, { sentidos: [1] });
  assert.equal(s0.registros, 11835);
  assert.equal(s0.registros + s1.registros, 23383);
  assert.equal(s0.eventos + s1.eventos, 2352);
  assert.equal(s0.impactos + s1.impactos, 1749);
  let imp = 0;
  let ev = 0;
  for (let k = 0; k < run.trechoNames.length; k++) {
    const v = buildView(run, an, { trechos: [k] });
    imp += v.impactos;
    ev += v.eventos;
  }
  assert.equal(imp, 1749);
  assert.equal(ev, 2352);
});

test('run1 class and eixo filters', () => {
  const { run, an } = run1();
  const c4 = buildView(run, an, { classes: [4] });
  assert.deepEqual(c4.classCounts, [0, 0, 0, 0, 56]);
  for (const im of c4.impacts) assert.equal(c4.mask[im.peak], 1);
  let reg = 0;
  for (const k of [0, 1, 2]) reg += buildView(run, an, { eixos: [k] }).registros;
  assert.equal(reg, 23383 - an.naoClassificadas);
});

test('run1 time window', () => {
  const { run, an } = run1();
  const full = buildView(run, an, { tFrom: run.tMs[0], tTo: run.tMs[run.n - 1] });
  assert.equal(full.registros, 23383);
  assert.equal(full.eventos, 2352);
  const half = buildView(run, an, { tTo: run.tMs[run.n >> 1] });
  assert.ok(half.registros < 23383 && half.registros > 0);
});

test('run1 conforme and priority stay full-run', () => {
  const { run, an } = run1();
  const before = JSON.stringify(an.conforme);
  const pri = JSON.stringify(an.priority);
  buildView(run, an, { sentidos: [1] });
  buildView(run, an, { classes: [3, 4], tTo: run.tMs[1000] });
  buildView(run, an, { trechos: [0], eixos: [1] });
  assert.equal(JSON.stringify(an.conforme), before);
  assert.equal(JSON.stringify(an.priority), pri);
  assert.equal(an.conforme.ok, true);
});
