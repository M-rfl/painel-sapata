import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, DEFAULT_PARAMS } from '../../site/js/core/index.js';
import { loadRun1, golden, arr } from './helpers.js';

test('golden run 1 at defaults', (t) => {
  const run = loadRun1();
  const ex = golden().exact;
  const r = analyze(run, DEFAULT_PARAMS);
  assert.deepEqual(arr(r.mediansLsb), ex.medians_lsb);
  assert.deepEqual(r.classCounts, ex.class_counts);
  assert.equal(r.eventos, ex.eventos);
  assert.equal(r.impactos, ex.impactos);
  assert.deepEqual(r.impactsByClass, ex.impacts_by_class);
  assert.equal(r.naoClassificadas, 0);
  assert.equal(r.pontos, 99);
  t.diagnostic(`pontos=${r.pontos} (workbook reference ${golden().reference.pontos}); points_by_class=${r.pointsByClass}`);
});

test('manual offset equal to workbook medians reproduces defaults', () => {
  const run = loadRun1();
  const base = analyze(run);
  const g = base.mediansLsb.map((m) => m / 2048);
  const r = analyze(run, { ...DEFAULT_PARAMS, offset: { mode: 'manual', g } });
  assert.deepEqual(r.classCounts, base.classCounts);
  assert.equal(r.eventos, base.eventos);
  assert.equal(r.impactos, base.impactos);
});

test('thresholds and gap change results consistently', () => {
  const run = loadRun1();
  const base = analyze(run);
  assert.ok(analyze(run, { thresholds_g: [0.4, 1, 2, 4] }).eventos > base.eventos);
  assert.ok(analyze(run, { gap: 1 }).impactos < base.impactos);
});

test('analyze does not mutate params', () => {
  const p = { thresholds_g: [0.5, 1, 2, 4], offset: { mode: 'median' }, gap: 0, maxJumpMs: 2000 };
  const copy = JSON.parse(JSON.stringify(p));
  analyze(loadRun1(), p);
  assert.deepEqual(p, copy);
});

test('golden per-trecho, priority and region split', () => {
  const r = analyze(loadRun1());
  const sum = (k) => r.perTrecho.reduce((a, t) => a + t[k], 0);
  assert.equal(sum('records'), 23383);
  assert.equal(sum('eventos'), 2352);
  assert.equal(sum('impactos'), 1749);
  assert.deepEqual(r.perTrecho.map((t) => t.maxCls),
    [4, 0, 4, 4, 0, 4, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 4]);
  const idx = (l) => r.priority.filter((p) => p.level === l).map((p) => p.trecho).sort((a, b) => a - b);
  assert.equal(idx(1).length, 15);
  assert.deepEqual(idx(2), [7, 14, 16]);
  assert.deepEqual(idx(4), [1, 4]);
  assert.deepEqual(r.regionSplit.records, [10839, 12544]);
  assert.deepEqual(r.regionSplit.eventos, [1262, 1090]);
});

test('golden conforme', () => {
  const run = loadRun1();
  assert.deepEqual(analyze(run).conforme, { available: true, ok: true, reasons: [] });
  const c1 = analyze(run, { thresholds_g: [0.5, 1, 2, 3.9] }).conforme;
  assert.equal(c1.ok, false);
  assert.equal(c1.reasons[0], 'limiares alterados');
  const g = analyze(run).mediansLsb.map((m) => m / 2048);
  assert.deepEqual(analyze(run, { offset: { mode: 'manual', g } }).conforme.reasons, ['offset manual']);
  const c2 = analyze(run, { gap: 1 }).conforme;
  assert.ok(c2.reasons.includes('agrupamento alterado'));
  assert.ok(c2.reasons.some((x) => /^impactos [\d.]+ ≠ 1\.749$/.test(x)), c2.reasons.join('|'));
  assert.deepEqual(analyze(run, { maxJumpMs: 1000 }).conforme.reasons, ['salto de tempo alterado']);
  assert.deepEqual(analyze({ ...run, reference: null }).conforme, { available: false, ok: null, reasons: [] });
});
