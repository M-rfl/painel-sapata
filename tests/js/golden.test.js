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
