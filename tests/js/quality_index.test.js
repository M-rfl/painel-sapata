import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../../site/js/core/index.js';
import { buildView } from '../../site/js/core/view.js';
import { qualityIndex } from '../../site/js/core/quality_index.js';
import { loadRun1 } from './helpers.js';

test('run 1 anchor 96,4 % Bom', () => {
  const q = qualityIndex([21031, 1611, 512, 173, 56]);
  assert.ok(Math.abs(q.value - (1 - 3378 / 93532)) < 1e-12);
  assert.equal(q.band, 'bom');
  assert.equal(q.n, 23383);
});

test('band edges are integer exact', () => {
  assert.deepEqual([[16, 4, 0, 0, 0], [8, 12, 0, 0, 0], [7, 13, 0, 0, 0], [17, 3, 0, 0, 0]].map((c) => qualityIndex(c).band),
    ['bom', 'regular', 'ruim', 'bom']);
  assert.equal(qualityIndex([16, 4, 0, 0, 0]).value, 0.95);
  assert.equal(qualityIndex([8, 12, 0, 0, 0]).value, 0.85);
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
