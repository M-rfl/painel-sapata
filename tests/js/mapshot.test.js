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

// ---- compositor with recording fakes ----
import { renderMapImage } from '../../site/js/app/mapshot.js';

function makeEnv({ loadResult = () => ({ width: 256, height: 256 }), throwFirst = false, noHeat = false } = {}) {
  const log = [];
  const canvases = [];
  let toDataCalls = 0;
  function createCanvas(w, h) {
    const props = {}; const myId = canvases.length;
    const target = {};
    const ctx = new Proxy(target, {
      get(_, name) {
        if (name in props) return props[name];
        return (...args) => {
          if (name === 'setLineDash') props.dash = args[0];
          log.push({ op: name, args, state: { ...props }, owner: myId });
        };
      },
      set(_, name, v) { props[name] = v; return true; },
    });
    const c = {
      width: w, height: h, id: canvases.length,
      getContext: () => ctx,
      toDataURL(type, q) {
        toDataCalls++;
        log.push({ op: 'toDataURL', args: [type, q] });
        if (throwFirst && toDataCalls === 1) throw new Error('SecurityError');
        return 'data:image/jpeg;base64,AAAA';
      },
    };
    canvases.push(c);
    return c;
  }
  const urls = [];
  let inflight = 0; let maxInflight = 0;
  async function loadImage(url) {
    urls.push(url);
    inflight++; maxInflight = Math.max(maxInflight, inflight);
    await new Promise((r) => setTimeout(r, 1));
    inflight--;
    return loadResult(url, urls.length);
  }
  const heatCalls = [];
  function simpleheat(c) {
    const api = {
      radius: (...a) => { heatCalls.push(['radius', ...a]); return api; },
      max: (...a) => { heatCalls.push(['max', ...a]); return api; },
      data: (...a) => { heatCalls.push(['data', ...a]); return api; },
      draw: (...a) => { heatCalls.push(['draw', ...a]); return api; },
    };
    return api;
  }
  return { log, urls, heatCalls, deps: { createCanvas, loadImage, simpleheat: noHeat ? undefined : simpleheat },
    get maxInflight() { return maxInflight; } };
}

function input(extra = {}) {
  return {
    points: [[-22.90, -43.20], [-22.92, -43.17]],
    stations: [[-22.90, -43.20]],
    markers: [{ lat: -22.91, lon: -43.19, cls: 1 }, { lat: -22.915, lon: -43.18, cls: 3 }],
    heat: [[-22.91, -43.19, 0.5], [-22.911, -43.1905, 0.5]],
    heatOpts: { radius: 25, blur: 15, minOpacity: 0.3, max: 1 },
    routes: [
      { properties: { sentido: 1 }, geometry: { type: 'MultiLineString', coordinates: [[[-43.20, -22.90], [-43.17, -22.92]]] } },
      { properties: { sentido: 2 }, geometry: { type: 'MultiLineString', coordinates: [[[-43.20, -22.90], [-43.17, -22.92]]] } },
    ],
    lineCount: 1,
    classColors: ['#2e7d32', '#f9a825', '#ef6c00', '#c62828', '#6a1b9a'],
    sentidoColors: ['#1565c0', '#5d4037'],
    attribution: '© colaboradores do OpenStreetMap',
    ...extra,
  };
}

const idx = (log, pred, from = 0) => log.findIndex((e, i) => i >= from && pred(e));

test('renderMapImage result, order and styles', async () => {
  const env = makeEnv();
  const res = await renderMapImage(input(), env.deps);
  assert.equal(res.format, 'JPEG');
  assert.equal(res.width, 2000); assert.equal(res.height, 840);
  assert.equal(res.basemapFailed, false);
  assert.ok(res.tiles.requested <= 64 && res.tiles.loaded === res.tiles.requested);
  const td = env.log.find((e) => e.op === 'toDataURL');
  assert.deepEqual(td.args, ['image/jpeg', 0.9]);
  const L = env.log.filter((e) => e.owner === 0 || e.op === 'toDataURL');
  const white = idx(L, (e) => e.op === 'fillRect' && e.args[2] === 2000 && e.args[3] === 840);
  const tile = idx(L, (e) => e.op === 'drawImage' && e.args[0].width === 256);
  const stroke = idx(L, (e) => e.op === 'stroke');
  const arc = idx(L, (e) => e.op === 'arc');
  const heatDraw = idx(L, (e) => e.op === 'drawImage' && e.args[0].id === 1);
  const text = idx(L, (e) => e.op === 'fillText');
  assert.ok(white === 0 && white < tile && tile < stroke && stroke < arc && arc < heatDraw && heatDraw < text);
  const strokes = L.filter((e) => e.op === 'stroke').slice(0, 2);
  assert.equal(strokes[0].state.strokeStyle, '#1565c0');
  assert.equal(strokes[0].state.globalAlpha, 0.55);
  assert.equal(strokes[0].state.lineWidth, 10);
  assert.deepEqual(strokes[0].state.dash, []);
  assert.equal(strokes[1].state.strokeStyle, '#5d4037');
  assert.deepEqual(strokes[1].state.dash, [20, 12]);
  const arcs = L.filter((e) => e.op === 'arc');
  assert.equal(arcs.length, 3);
  assert.equal(arcs[0].args[2], 8);
  assert.equal(arcs[1].args[2], (5 + 1.5) * 2);
  assert.equal(arcs[2].args[2], (5 + 4.5) * 2);
});

test('tile urls and concurrency', async () => {
  const env = makeEnv();
  const res = await renderMapImage(input(), env.deps);
  assert.equal(env.urls.length, res.tiles.requested);
  assert.ok(env.urls.length <= 64);
  for (const u of env.urls) assert.match(u, /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
  assert.ok(env.maxInflight <= 6);
});

test('heat wiring, also with empty heat', async () => {
  const env = makeEnv();
  const inp = input();
  await renderMapImage(inp, env.deps);
  assert.deepEqual(env.heatCalls[0], ['radius', 50, 30]);
  assert.deepEqual(env.heatCalls[1], ['max', 1]);
  assert.equal(env.heatCalls[2][0], 'data');
  assert.ok(Array.isArray(env.heatCalls[2][1]));
  assert.deepEqual(env.heatCalls[3], ['draw', 0.3]);
  const env2 = makeEnv();
  await renderMapImage(input({ heat: [] }), env2.deps);
  assert.deepEqual(env2.heatCalls[2], ['data', []]);
});

test('all tiles fail -> basemapFailed, rest still drawn', async () => {
  const env = makeEnv({ loadResult: () => null });
  const res = await renderMapImage(input(), env.deps);
  assert.equal(res.basemapFailed, true);
  assert.equal(env.log.filter((e) => e.op === 'drawImage' && e.args[0].width === 256).length, 0);
  assert.ok(env.log.some((e) => e.op === 'stroke'));
  assert.ok(env.log.some((e) => e.op === 'arc'));
});

test('more than half failing -> basemapFailed', async () => {
  const env = makeEnv({ loadResult: (u, n) => (n % 3 === 0 ? { width: 256 } : null) });
  const res = await renderMapImage(input(), env.deps);
  assert.equal(res.basemapFailed, true);
});

test('tainted canvas -> redraw without tiles', async () => {
  const env = makeEnv({ throwFirst: true });
  const res = await renderMapImage(input(), env.deps);
  assert.equal(res.basemapFailed, true);
  const tds = env.log.filter((e) => e.op === 'toDataURL');
  assert.equal(tds.length, 2);
  const lastWhite = env.log.map((e, i) => (e.op === 'fillRect' && e.args[2] === 2000 ? i : -1)).filter((i) => i >= 0).pop();
  assert.equal(env.log.slice(lastWhite).filter((e) => e.op === 'drawImage' && e.args[0].width === 256).length, 0);
});

test('missing simpleheat and empty input', async () => {
  const env = makeEnv({ noHeat: true });
  const res = await renderMapImage(input(), env.deps);
  assert.equal(res.heatMissing, true);
  assert.ok(res.dataUrl);
  const env2 = makeEnv();
  const res2 = await renderMapImage(input({ points: [], stations: [], markers: [], routes: [], heat: [] }), env2.deps);
  assert.ok(res2.dataUrl);
});
