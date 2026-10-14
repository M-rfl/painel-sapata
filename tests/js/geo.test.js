import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fixMatched, trackSegments, hoverPosition, nearestFix, googleMapsUrl,
} from '../../site/js/core/geo.js';
import { analyze } from '../../site/js/core/engine.js';
import { buildView } from '../../site/js/core/view.js';
import { loadRun1 } from './helpers.js';

function synthRun(times, sentido, rows) {
  const nF = times.length;
  const r = rows || Array.from({ length: nF }, (_, i) => i);
  const n = r.length;
  const tMs = Float64Array.from(r.map((_, i) => times[i] * 1000));
  const fix = Int32Array.from(r.map((_, i) => i));
  return {
    n, tMs, fix, fixRow: Int32Array.from(r.map((_, i) => i)),
    fixLat: Float64Array.from(times.map((_, i) => -22 + i * 0.001)),
    fixLon: Float64Array.from(times.map((_, i) => -43 + i * 0.001)),
    sentido: Uint8Array.from(sentido),
    priorFix: Int32Array.from(r.map((_, i) => i)),
    meta: { workbook_defaults: { max_fix_gap_s: 120 } },
  };
}

test('trackSegments breaks at gap and sentido change', () => {
  const run = synthRun([0, 30, 60, 300, 330, 360], [0, 0, 0, 0, 1, 1]);
  const segs = trackSegments(run, new Uint8Array(6).fill(1));
  assert.equal(segs.length, 2);
  assert.deepEqual(segs[0].fixes, [0, 1, 2]);
  assert.deepEqual(segs[1].fixes, [4, 5]);
  assert.ok(segs.every((s) => s.matched && s.latlngs.length >= 2));
});

test('trackSegments splits matched / unmatched sharing the boundary vertex', () => {
  const run = synthRun([0, 30, 60, 90], [0, 0, 0, 0]);
  const segs = trackSegments(run, Uint8Array.from([1, 1, 0, 0]));
  assert.equal(segs.length, 2);
  assert.deepEqual(segs[0].fixes, [0, 1, 2]);
  assert.equal(segs[0].matched, true);
  assert.deepEqual(segs[1].fixes, [2, 3]);
  assert.equal(segs[1].matched, false);
});

test('fixMatched follows the mask', () => {
  const run = synthRun([0, 30, 60], [0, 0, 0]);
  assert.deepEqual(Array.from(fixMatched(run, Uint8Array.from([1, 0, 1]))), [1, 0, 1]);
});

test('run 1 segments respect sentido and gap', () => {
  const run = loadRun1();
  const an = analyze(run);
  const view = buildView(run, an, {});
  const segs = trackSegments(run, fixMatched(run, view.mask));
  console.log('run1 segments:', segs.length);
  assert.ok(segs.length >= 2);
  for (const s of segs) {
    assert.ok(s.matched);
    for (let i = 1; i < s.fixes.length; i++) {
      const ra = run.fixRow[s.fixes[i - 1]];
      const rb = run.fixRow[s.fixes[i]];
      assert.equal(run.sentido[ra], run.sentido[rb]);
      assert.ok(run.tMs[rb] - run.tMs[ra] <= 120000);
    }
  }
  const sentidos = new Set(segs.map((s) => s.sentido));
  assert.ok(sentidos.size >= 2);
});

test('hoverPosition and nearestFix', () => {
  const run = loadRun1();
  const tunnel = Array.from(run.fix).findIndex((f, i) => f < 0 && run.priorFix[i] >= 0);
  assert.ok(tunnel >= 0);
  const h = hoverPosition(run, tunnel);
  assert.equal(h.noGps, true);
  assert.equal(h.lat, run.fixLat[run.priorFix[tunnel]]);
  const r = run.fixRow[37];
  assert.deepEqual(hoverPosition(run, r), { fix: run.fix[r], lat: run.fixLat[run.fix[r]], lon: run.fixLon[run.fix[r]], noGps: false });
  assert.equal(hoverPosition(run, null), null);
  assert.equal(hoverPosition(run, -1), null);
  const nf = nearestFix(run, run.fixLat[37], run.fixLon[37]);
  assert.equal(run.fixLat[nf], run.fixLat[37]);
  assert.equal(run.fixLon[nf], run.fixLon[37]);
});

test('googleMapsUrl', () => {
  assert.equal(googleMapsUrl(-22.9, -43.2), 'https://www.google.com/maps?q=-22.900000,-43.200000');
});
