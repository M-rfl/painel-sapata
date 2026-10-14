import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReportAction } from '../../site/js/app/reportaction.js';

function make(over = {}) {
  const calls = [];
  const states = [];
  const deps = {
    getSnapshot: () => { calls.push('snap'); return { run: 1 }; },
    loadLib: async () => { calls.push('lib'); return { jsPDF: 'J', autoTable: 'A' }; },
    buildReport: (snap, o) => { calls.push('build:' + o.now); return { filename: 'r.pdf', map: { input: 'MI' } }; },
    renderMap: async (i) => { calls.push('map:' + i); return { basemapFailed: false }; },
    renderPdf: (m, o) => { calls.push('pdf:' + o.jsPDF + o.autoTable + (o.mapImage ? 'M' : '-')); return { bytes: new Uint8Array([1, 2, 3]).buffer }; },
    download: (b, f) => { calls.push('dl:' + f + ':' + b.type + ':' + b.size); },
    now: () => 42,
    onState: (s) => states.push(s),
    yieldFn: async () => { calls.push('yield'); },
    ...over,
  };
  return { calls, states, action: createReportAction(deps) };
}

test('ok path', async () => {
  const { calls, states, action } = make();
  const res = await action.run();
  assert.equal(res.status, 'ok');
  assert.deepEqual(res.warnings, []);
  assert.deepEqual(calls, ['snap', 'yield', 'lib', 'build:42', 'map:MI', 'pdf:JAM', 'dl:r.pdf:application/pdf:3']);
  assert.deepEqual(states, ['busy', 'idle']);
  assert.equal(action.busy(), false);
});

test('basemap failure gives warning', async () => {
  const { calls, action } = make({ renderMap: async () => ({ basemapFailed: true }) });
  const res = await action.run();
  assert.equal(res.status, 'warning');
  assert.deepEqual(res.warnings, ['basemap']);
  assert.ok(calls.includes('pdf:JAM'));
});

test('map throw still produces pdf', async () => {
  const { calls, action } = make({ renderMap: async () => { throw new Error('x'); } });
  const res = await action.run();
  assert.equal(res.status, 'warning');
  assert.deepEqual(res.warnings, ['map']);
  assert.ok(calls.includes('pdf:JA-'));
  assert.ok(calls.some((c) => c.startsWith('dl:')));
});

for (const [name, over] of [
  ['loadLib rejects', { loadLib: async () => { throw new Error('pdf_lib_unavailable'); } }],
  ['buildReport throws', { buildReport: () => { throw new Error('b'); } }],
  ['renderPdf throws', { renderPdf: () => { throw new Error('p'); } }],
]) {
  test('total failure: ' + name, async () => {
    const { calls, states, action } = make(over);
    const res = await action.run();
    assert.equal(res.status, 'error');
    assert.ok(res.error instanceof Error);
    assert.ok(!calls.some((c) => c.startsWith('dl:')));
    assert.deepEqual(states, ['busy', 'idle']);
    assert.equal(action.busy(), false);
  });
}

test('busy guard', async () => {
  const { calls, action } = make();
  const p1 = action.run();
  assert.equal(action.busy(), true);
  const r2 = await action.run();
  assert.equal(r2.status, 'skipped');
  await p1;
  assert.equal(calls.filter((c) => c === 'lib').length, 1);
  assert.equal(action.busy(), false);
});

test('no snapshot is skipped', async () => {
  const { calls, states, action } = make({ getSnapshot: () => null });
  const res = await action.run();
  assert.equal(res.status, 'skipped');
  assert.deepEqual(calls, []);
  assert.deepEqual(states, []);
});

test('snapshot taken once even with slow map', async () => {
  let n = 0;
  const { action } = make({
    getSnapshot: () => { n++; return { run: 1 }; },
    renderMap: () => new Promise((r) => setTimeout(() => r({ basemapFailed: false }), 10)),
  });
  await action.run();
  assert.equal(n, 1);
});
