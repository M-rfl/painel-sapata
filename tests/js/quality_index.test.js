import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../../site/js/core/index.js';
import { buildView } from '../../site/js/core/view.js';
import { qualityIndex } from '../../site/js/core/quality_index.js';
import { loadRun1 } from './helpers.js';

test('run 1 anchor 96,4 % Regular', () => {
  const q = qualityIndex([21031, 1611, 512, 173, 56]);
  assert.ok(Math.abs(q.value - (1 - 3378 / 93532)) < 1e-12);
  assert.equal(q.band, 'regular');
  assert.equal(q.n, 23383);
});

test('band edges are integer exact', () => {
  // D = 4: S/N = 0.08 -> 98 %, S/N = 0.4 -> 90 %
  assert.deepEqual([[23, 2, 0, 0, 0], [15, 10, 0, 0, 0], [14, 11, 0, 0, 0], [24, 1, 0, 0, 0], [22, 3, 0, 0, 0]].map((c) => qualityIndex(c).band),
    ['bom', 'regular', 'ruim', 'bom', 'regular']);
  assert.equal(qualityIndex([23, 2, 0, 0, 0]).value, 0.98);
  assert.equal(qualityIndex([15, 10, 0, 0, 0]).value, 0.9);
  const q = qualityIndex([1, 0, 1]);
  assert.equal(q.value, 0.5);
  assert.equal(q.band, 'ruim');
});

test('empty gives null', () => {
  assert.deepEqual(qualityIndex([0, 0, 0, 0, 0]), { value: null, band: null, n: 0 });
});

test('follows filters', () => {
  const run = loadRun1();
  const an = analyze(run);
  const all = qualityIndex(buildView(run, an, {}).classCounts);
  const s0 = qualityIndex(buildView(run, an, { sentidos: [0] }).classCounts);
  assert.notEqual(all.value, s0.value);
});
