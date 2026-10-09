import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentile, describe, axisValues, meansMaxima, axisStatsTable } from '../../site/js/core/stats.js';
import { analyze } from '../../site/js/core/engine.js';
import { fromArrays } from '../../site/js/core/data.js';
import { loadRun1 } from './helpers.js';

const close = (a, b, dp) => Math.abs(a - b) < 0.5 * 10 ** -dp;

test('percentile PERCENTILE.INC', () => {
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(percentile([10], 0.995), 10);
  assert.ok(close(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.995), 9.955, 6));
  assert.ok(Number.isNaN(percentile([], 0.5)));
});

test('describe', () => {
  const d = describe(Float64Array.from([2, 4, 4, 4, 5, 5, 7, 9]));
  assert.equal(d.n, 8);
  assert.equal(d.mean, 5);
  assert.equal(d.median, 4.5);
  assert.ok(close(d.std, 2.13809, 5));
  assert.equal(d.min, 2);
  assert.equal(d.max, 9);
  assert.equal(d.maxAbs, 9);
  assert.equal(describe(Float64Array.from([-3, 1, 2])).maxAbs, -3);
  assert.equal(describe(Float64Array.from([3, -3])).maxAbs, 3);
  assert.equal(describe(Float64Array.from([5])).std, 0);
  assert.ok(Number.isNaN(describe([]).std));
});

test('axisValues synthetic masking and conversion', () => {
  const run = fromArrays({
    ax: [2048, 4096, null, 1024], ay: [0, 0, 0, 0], az: [0, 0, 0, 2048], tMs: [0, 1, 2, 3],
  });
  const an = { off2: [2048, 0, 0] };
  const mask = Uint8Array.from([1, 1, 1, 0]);
  const m = axisValues(run, an, mask, 'medido');
  assert.deepEqual(Array.from(m.ax), [1, 2]);
  assert.deepEqual(Array.from(m.res), [1, 2]);
  const d = axisValues(run, an, null, 'dinamico');
  assert.equal(d.ax.length, 3);
  assert.equal(d.ax[0], (4096 - 2048) / 4096);
  assert.ok(close(d.res[2], 1, 9));
  assert.throws(() => axisValues(run, an, null, 'x'));
});

test('run 1 golden means/maxima', () => {
  const run = loadRun1();
  const an = analyze(run);
  const mask = new Uint8Array(run.n).fill(1);
  const mm = meansMaxima(run, an, mask);
  [0.04303, -0.01147, -0.98747].forEach((v, k) => assert.ok(close(mm.medido.mean[k], v, 5), `mean ${k}`));
  assert.ok(close(mm.medido.meanRes, 1.06105, 5));
  assert.ok(close(mm.dinamico.meanRes, 0.27438, 5));
  [10.1636, -10.7070, -12.6455].forEach((v, k) => assert.ok(close(mm.medido.maxAbs[k], v, 4), `max ${k}`));
  assert.ok(close(mm.medido.maxRes, 17.7306, 4));
  assert.ok(close(mm.dinamico.maxRes, 17.1108, 4));
});

test('axisStatsTable', () => {
  const run = loadRun1();
  const an = analyze(run);
  const mask = new Uint8Array(run.n).fill(1);
  const din = axisStatsTable(run, an, mask, 'dinamico');
  assert.deepEqual(din.map((r) => r.key), ['ax', 'ay', 'az', 'res']);
  for (const r of din.slice(0, 3)) assert.ok(Math.abs(r.median) <= 1 / 4096 + 1e-12, r.key);
  const med = axisStatsTable(run, an, mask, 'medido');
  assert.ok(close(med[2].mean, -0.987, 3));
  assert.ok(Math.abs(din[2].mean) < 0.1);
  assert.throws(() => axisStatsTable(run, an, mask, 'foo'));
  const none = axisStatsTable(run, an, new Uint8Array(run.n), 'medido');
  assert.equal(none[0].n, 0);
  assert.ok(Number.isNaN(none[0].mean));
});
