import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../../site/js/core/index.js';
import { haversineM, gpsKey, rejectedFixes, applyGpsFilter } from '../../site/js/core/gpsfilter.js';
import { loadRun1, arr } from './helpers.js';

const GPS = { maxSpeedKmh: 50, maxFixGapS: 120 };

test('haversine', () => {
  assert.ok(Math.abs(haversineM(0, 0, 1, 0) - 111194.93) < 0.01);
  assert.equal(haversineM(1, 2, 1, 2), 0);
  assert.equal(haversineM(1, 2, 3, 4), haversineM(3, 4, 1, 2));
});

test('gpsKey', () => {
  assert.equal(gpsKey(GPS), gpsKey({ ...GPS }));
  assert.notEqual(gpsKey(GPS), gpsKey({ ...GPS, maxSpeedKmh: 60 }));
  assert.notEqual(gpsKey(GPS), gpsKey({ ...GPS, maxFixGapS: 60 }));
});

// 1 deg lat ~ 111194.93 m; use latitude offsets for chosen speeds.
function synth(fixes) {
  // fixes: [tSec, lat|NaN]; one row per fix, plus nothing else
  const n = fixes.length;
  return {
    n,
    tMs: Float64Array.from(fixes, (f) => f[0] * 1000),
    fix: Int32Array.from(fixes, (_, i) => i),
    locId: Int32Array.from(fixes, (_, i) => i),
    trecho: new Int32Array(n),
    fixLat: Float64Array.from(fixes, (f) => f[1]),
    fixLon: new Float64Array(n).fill(0),
    fixRow: Int32Array.from(fixes, (_, i) => i),
    priorFix: Int32Array.from(fixes, (_, i) => i),
  };
}
const dLat = (m) => m / 111194.9266;

test('synthetic rules', () => {
  // 10 s at 50 km/h = 138.888.. m
  const exact = 50 / 3.6 * 10;
  assert.deepEqual(rejectedFixes(synth([[0, 0], [10, dLat(exact * 0.999)]]), GPS), []);
  assert.deepEqual(rejectedFixes(synth([[0, 0], [10, dLat(exact * 1.01)]]), GPS), [1]);
  // dt > gap accepted, dt <= 0 accepted
  assert.deepEqual(rejectedFixes(synth([[0, 0], [121, 5]]), GPS), []);
  assert.deepEqual(rejectedFixes(synth([[5, 0], [5, 5]]), GPS), []);
  // chain of outliers compared with last accepted
  assert.deepEqual(rejectedFixes(synth([[0, 0], [10, 1], [20, 1.0001], [30, 0.0005]]), GPS), [1, 2]);
  // NaN skipped
  assert.deepEqual(rejectedFixes(synth([[0, 0], [10, NaN], [20, dLat(10)]]), GPS), []);
});

test('applyGpsFilter synthetic', () => {
  const run = synth([[0, 0], [10, 1], [20, dLat(10)]]);
  const before = { fix: arr(run.fix), locId: arr(run.locId) };
  const d = applyGpsFilter(run, GPS);
  assert.deepEqual(d.gpsRejected, [1]);
  assert.deepEqual(arr(d.fix), [0, -1, 2]);
  assert.deepEqual(arr(d.locId), [0, -1, 2]);
  assert.deepEqual(arr(d.priorFix), [0, 0, 2]);
  assert.deepEqual(arr(run.fix), before.fix);
  assert.deepEqual(arr(run.locId), before.locId);
  assert.equal(d.fixLat, run.fixLat);
  const none = applyGpsFilter(run, { maxSpeedKmh: 1e9, maxFixGapS: 120 });
  assert.deepEqual(none.gpsRejected, []);
  assert.equal(none.locId, run.locId);
});

test('run 1: fix 31 rejected, pontos 98, raw 99', () => {
  const raw = loadRun1();
  assert.deepEqual(rejectedFixes(raw, GPS), [31]);
  const rawA = analyze(raw);
  const d = applyGpsFilter(raw, GPS);
  let was = 0;
  let now = 0;
  for (let i = 0; i < raw.n; i++) {
    if (raw.fix[i] === 31) { was++; if (d.locId[i] === -1) now++; }
  }
  assert.equal(was, 185);
  assert.equal(now, 185);
  const dA = analyze(d);
  assert.deepEqual(dA.classCounts, [21031, 1611, 512, 173, 56]);
  assert.equal(dA.eventos, 2352);
  assert.equal(dA.impactos, 1749);
  assert.deepEqual(dA.classCounts, rawA.classCounts);
  assert.equal(dA.pontos, 98);
  assert.equal(analyze(loadRun1()).pontos, 99);
});

test('run 1: permissive speed rejects nothing', () => {
  const raw = loadRun1();
  const d = applyGpsFilter(raw, { maxSpeedKmh: 300, maxFixGapS: 120 });
  assert.deepEqual(d.gpsRejected, []);
  assert.deepEqual(arr(d.locId), arr(raw.locId));
});
