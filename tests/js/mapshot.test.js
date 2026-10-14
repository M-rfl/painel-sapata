import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TILES, TILE_URL, project, fitView, toCanvas, tilePlan, mergeHeat } from '../../site/js/app/mapshot.js';
import { loadRun1 } from './helpers.js';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} !~ ${b}`);

test('constants', () => {
  assert.equal(MAX_TILES, 64);
  assert.match(TILE_URL, /^https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png$/);
});

test('project basics', () => {
  const o = project(0, 0, 0);
  near(o.x, 128); near(o.y, 128);
  near(project(10, 180, 0).x, 256);
  const a = project(-22.9, -43.2, 5);
  const b = project(-22.9, -43.2, 6);
  near(b.x, a.x * 2); near(b.y, a.y * 2);
  assert.ok(Math.abs(project(89, 0, 0).y) < 1e-6);
});

test('fitView property: points land inside padding box', () => {
  const pts = [[-22.9, -43.2], [-22.95, -43.1], [-22.88, -43.25], [-22.91, -43.15]];
  const w = 1000; const h = 420; const pad = 20;
  const v = fitView(pts, w, h, pad);
  let touch = false;
  for (const [la, lo] of pts) {
    const p = toCanvas(la, lo, v, w, h, 1);
    for (const [c, lim] of [[p.x, w], [p.y, h]]) {
      assert.ok(c >= pad - 1e-6 && c <= lim - pad + 1e-6, `${c}`);
      if (Math.abs(c - pad) < 1e-6 || Math.abs(c - (lim - pad)) < 1e-6) touch = true;
    }
  }
  assert.ok(touch);
});

test('fitView degenerate', () => {
  assert.deepEqual(fitView([], 100, 100), { zoom: 1, cx: 128, cy: 128 });
  const v = fitView([[-22.9, -43.2]], 100, 100);
  assert.equal(v.zoom, 15);
  const p = project(-22.9, -43.2, 0);
  near(v.cx, p.x); near(v.cy, p.y);
});

function coversCanvas(plan, W, H) {
  const t = plan.tiles;
  assert.ok(Math.min(...t.map((q) => q.dx)) <= 1e-9);
  assert.ok(Math.min(...t.map((q) => q.dy)) <= 1e-9);
  assert.ok(Math.max(...t.map((q) => q.dx)) + plan.size >= W - 1e-9);
  assert.ok(Math.max(...t.map((q) => q.dy)) + plan.size >= H - 1e-9);
}

test('tilePlan on run 1 respects the cap at 2x', () => {
  const run = loadRun1();
  const pts = [];
  for (let f = 0; f < run.fixLat.length; f++) {
    if (!Number.isNaN(run.fixLat[f]) && !Number.isNaN(run.fixLon[f])) pts.push([run.fixLat[f], run.fixLon[f]]);
  }
  for (const s of run.stations || []) pts.push([s.lat, s.lon]);
  const view = fitView(pts, 1000, 420, 20);
  const plan = tilePlan(view, 2000, 840, 2);
  console.log('run1 plan: z', plan.z, 'tiles', plan.tiles.length);
  assert.ok(plan.tiles.length <= 64);
  assert.ok(plan.z >= 12);
  coversCanvas(plan, 2000, 840);
});

test('tilePlan steps down when over the cap', () => {
  const view = { zoom: 12.3, cx: project(-22.9, -43.2, 0).x, cy: project(-22.9, -43.2, 0).y };
  const zt0 = Math.round(view.zoom + 1);
  const full = tilePlan(view, 2000, 840, 2, 1e9);
  assert.equal(full.z, zt0);
  const capped = tilePlan(view, 2000, 840, 2, 10);
  assert.ok(capped.tiles.length <= 10);
  assert.ok(capped.z < zt0);
  coversCanvas(capped, 2000, 840);
  for (const t of capped.tiles) assert.ok(t.x >= 0 && t.x < 2 ** capped.z && t.y >= 0 && t.y < 2 ** capped.z);
});

test('mergeHeat', () => {
  const r = 40; // cell 20
  const out = mergeHeat([[10, 10, 0.5], [12, 14, 0.25], [100, 10, 0.5], [-100, 5, 1], [30, 50, 2]], r, 1, 200, 100);
  // rows then columns: y cell 0 -> x cells 0 and 5; y cell 2 -> x cell 1
  assert.deepEqual(out, [[11, 11, 0.75], [100, 10, 0.5], [30, 50, 1]]);
});
