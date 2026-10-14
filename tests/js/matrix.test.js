import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../../site/js/core/index.js';
import { buildView } from '../../site/js/core/view.js';
import { buildMatrix, cellClick, isCellSelected } from '../../site/js/core/matrix.js';
import { loadRun1 } from './helpers.js';

const run = loadRun1();
const A = analyze(run);
const allRows = (m) => m.sentidos.flatMap((s) => s.rows);
const colSum = (m, c) => allRows(m).reduce((a, r) => a + r.counts[c], 0);

test('impactos basis ties to analysis', () => {
  const m = buildMatrix(run, A, {}, 'impactos');
  assert.deepEqual(m.columns, [1, 2, 3, 4]);
  assert.equal(allRows(m).reduce((a, r) => a + r.total, 0), 1749);
  for (const c of m.columns) assert.equal(colSum(m, c), A.impactsByClass[c]);
});

test('medicoes and pontos basis', () => {
  const m = buildMatrix(run, A, {}, 'medicoes');
  assert.deepEqual(m.columns, [0, 1, 2, 3, 4]);
  assert.equal(allRows(m).reduce((a, r) => a + r.total, 0), 23383 - A.naoClassificadas);
  for (const c of m.columns) assert.equal(colSum(m, c), A.classCounts[c]);
  const p = buildMatrix(run, A, {}, 'pontos');
  assert.deepEqual(p.columns, [1, 2, 3, 4]);
  assert.equal(allRows(p).reduce((a, r) => a + r.total, 0), A.pontos);
});

test('structure and shading', () => {
  const m = buildMatrix(run, A, {}, 'impactos');
  const seen = allRows(m).map((r) => r.trecho).sort((a, b) => a - b);
  assert.deepEqual(seen, run.trechos.map((_, i) => i));
  m.sentidos.forEach((s, si) => {
    const ord = s.rows.map((r) => run.trechos[r.trecho].order);
    assert.deepEqual(ord, [...ord].sort((a, b) => a - b));
    s.rows.forEach((r) => assert.equal(run.trechos[r.trecho].sentido, si));
    for (const r of s.rows) assert.equal(r.total, m.columns.reduce((a, c) => a + r.counts[c], 0));
  });
  for (const c of m.columns) assert.equal(m.colMax[c], Math.max(...allRows(m).map((r) => r.counts[c])));
});

test('filter semantics', () => {
  const base = buildMatrix(run, A, {}, 'impactos');
  assert.deepEqual(buildMatrix(run, A, { trechos: [2], classes: [4] }, 'impactos'), base);
  const s0 = buildMatrix(run, A, { sentidos: [0] }, 'impactos');
  for (const r of s0.sentidos[1].rows) assert.equal(r.total, 0);
  const ex = buildMatrix(run, A, { eixos: [2] }, 'impactos');
  assert.notDeepEqual(ex, base);
  const tw = buildMatrix(run, A, { tFrom: 0, tTo: run.tMs[Math.floor(run.n / 2)] }, 'impactos');
  assert.notDeepEqual(tw, base);
  assert.throws(() => buildMatrix(run, A, {}, 'x'));
});

test('cellClick reducer', () => {
  const E = { trechos: [], classes: [] };
  assert.deepEqual(cellClick(E, 5, 3, false), { trechos: [5], classes: [3] });
  assert.deepEqual(cellClick({ trechos: [5], classes: [3] }, 5, 3, false), E);
  assert.deepEqual(cellClick({ trechos: [5], classes: [3] }, 7, 2, false), { trechos: [7], classes: [2] });
  assert.deepEqual(cellClick({ trechos: [5], classes: [3] }, 7, 2, true), { trechos: [5, 7], classes: [2, 3] });
  assert.deepEqual(cellClick({ trechos: [5], classes: [3] }, 5, 3, true), { trechos: [5], classes: [3] });
});

test('isCellSelected', () => {
  assert.equal(isCellSelected({ trechos: [], classes: [] }, 1, 1), false);
  assert.equal(isCellSelected({ trechos: [1], classes: [] }, 1, 3), true);
  assert.equal(isCellSelected({ trechos: [1], classes: [2] }, 1, 3), false);
  assert.equal(isCellSelected({ trechos: [], classes: [3] }, 9, 3), true);
});

test('click consistency with buildView', () => {
  const mi = buildMatrix(run, A, {}, 'impactos');
  const mm = buildMatrix(run, A, {}, 'medicoes');
  let checked = 0;
  for (const r of allRows(mi)) {
    for (const c of [1, 4]) {
      const f = cellClick({}, r.trecho, c, false);
      const v = buildView(run, A, f);
      assert.equal(v.impactos, r.counts[c]);
      const rm = allRows(mm).find((x) => x.trecho === r.trecho);
      assert.equal(v.registros, rm.counts[c]);
      checked++;
    }
  }
  assert.ok(checked > 0);
});
