import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fixMatched, trackSegments, pontoMarkers, unplacedCounts, heatPoints, hoverPosition, nearestFix, googleMapsUrl,
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

function ctx(filters, params) {
  const run = loadRun1();
  const an = analyze(run, params);
  return { run, an, view: buildView(run, an, filters || {}) };
}

test('pontoMarkers: one per placeable ponto with popup fields', () => {
  const { run, an, view } = ctx();
  const mk = pontoMarkers(run, an, view);
  const un = unplacedCounts(run, an, view);
  assert.equal(mk.length, view.pontos - un.pontos);
  for (const m of mk) {
    assert.equal(m.cls, an.cls[m.row]);
    assert.ok(m.url.startsWith('https://www.google.com/maps?q='));
    assert.ok(m.className && m.trecho && m.sentido);
  }
  assert.ok(mk.reduce((s, m) => s + m.nImpactos, 0) <= view.impactos);
  for (let i = 1; i < mk.length; i++) assert.ok(mk[i].cls >= mk[i - 1].cls);
});

test('MAP-06: markers follow filters and thresholds', () => {
  const base = ctx();
  const def = pontoMarkers(base.run, base.an, base.view);
  const f = ctx({ classes: [4] });
  const crit = pontoMarkers(f.run, f.an, f.view);
  assert.ok(crit.every((m) => m.cls === 4));
  assert.ok(crit.length < def.length);
  const t = ctx({}, { thresholds_g: [0.5, 1, 2, 3] });
  const dist = (a) => [0, 1, 2, 3, 4].map((c) => a.filter((m) => m.cls === c).length).join();
  assert.notEqual(dist(pontoMarkers(t.run, t.an, t.view)), dist(def));
});

test('unplacedCounts shrink under sentido filter', () => {
  const a = unplacedCounts(...Object.values(ctx()));
  const c = ctx({ sentidos: [0] });
  const b = unplacedCounts(c.run, c.an, c.view);
  assert.ok(b.pontos <= a.pontos && b.eventos <= a.eventos);
});

test('heatPoints: fixed scale, intensity, unknown metric', () => {
  const { run, an, view } = ctx();
  const h = heatPoints(run, an, view.mask, 'dom', 1);
  assert.ok(h.length > 0 && h.length <= run.fixLat.length);
  assert.ok(h.every((p) => p[2] > 0 && p[2] <= 1));
  const t = run.trecho[run.fixRow[37]];
  const f = ctx({ trechos: [t] });
  const hf = heatPoints(f.run, f.an, f.view.mask, 'dom', 1);
  const key = (p) => `${p[0]},${p[1]}`;
  const m1 = new Map(h.map((p) => [key(p), p[2]]));
  let shared = 0;
  for (const p of hf) if (m1.has(key(p)) && m1.get(key(p)) === p[2]) shared++;
  assert.ok(shared > 0);
  const h2 = heatPoints(run, an, view.mask, 'dom', 2);
  assert.equal(h2.length, h.length);
  h.forEach((p, i) => { if (p[2] < 0.5) assert.ok(Math.abs(h2[i][2] - 2 * p[2]) < 1e-12); });
  for (const mt of ['ax', 'ay', 'az', 'resDin']) assert.ok(heatPoints(run, an, view.mask, mt, 1).length > 0);
  assert.throws(() => heatPoints(run, an, view.mask, 'xx', 1));
});
