import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeRun } from '../../site/js/core/data.js';
import { axisConverters, resultant } from '../../site/js/core/stats.js';
import { analyze } from '../../site/js/core/engine.js';
import { loadRun1, loadJson } from './helpers.js';

function synthJson() {
  const n = 8;
  return {
    schema: 1,
    meta: { n, t0: '2026-10-02T10:00:00-03:00' },
    t: { dt_ms: new Array(n).fill(100) },
    accel: { ax: new Array(n).fill(0), ay: new Array(n).fill(0), az: new Array(n).fill(-2048) },
    trecho_runs: [[0, 0]],
    trechos: [{ name: 'T0' }],
    sentido_runs: [[0, 0]],
    flag_runs: [[0, 0]],
    fix_runs: [[0, -1], [2, 0], [4, -1], [6, 1]],
    gps: { lat: [-22.9, -22.91], lon: [-43.2, null] },
    sentidos: [{ code: 0, name: 'A' }],
    stations: [],
  };
}

test('decodeRun run1 fix tables', () => {
  const json = loadJson('site/data/run-2026-10-02-l4-t102.json');
  const run = loadRun1();
  assert.ok(Number.isFinite(run.t0Ms));
  assert.equal(run.t0Ms, Date.parse(json.meta.t0));
  assert.equal(run.fixLat.length, json.gps.lat.length);
  assert.ok(run.fixLat instanceof Float64Array);
  assert.equal(run.fixLat[3], json.gps.lat[3]);
  assert.equal(run.fixLon[3], json.gps.lon[3]);
  assert.ok(run.fixRow instanceof Int32Array);
  for (let f = 0; f < run.fixRow.length; f++) {
    const r = run.fixRow[f];
    if (r < 0) continue;
    assert.equal(run.fix[r], f);
    if (r > 0) assert.notEqual(run.fix[r - 1], f);
  }
  assert.equal(run.priorFix.length, run.n);
  let last = -1;
  for (let i = 0; i < run.n; i++) {
    if (run.fix[i] >= 0) last = run.fix[i];
    assert.equal(run.priorFix[i], last);
  }
});

test('decodeRun synthetic priorFix/fixRow', () => {
  const run = decodeRun(synthJson());
  assert.deepEqual(Array.from(run.priorFix), [-1, -1, 0, 0, 0, 0, 1, 1]);
  assert.deepEqual(Array.from(run.fixRow), [2, 6]);
  assert.ok(Number.isNaN(run.fixLon[1]));
});

test('axisConverters and resultant', () => {
  const an = analyze(loadRun1());
  const med = axisConverters(an, 'medido');
  const din = axisConverters(an, 'dinamico');
  for (let k = 0; k < 3; k++) {
    assert.equal(med[k](2048), 1);
    assert.equal(din[k](77), (2 * 77 - an.off2[k]) / 4096);
  }
  assert.throws(() => axisConverters(an, 'x'));
  assert.equal(resultant(3, 4, 0), 5);
});
