import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNC_KEY, epochMs, chartFrame, axisSeries, thresholdLines, channelSeries, CHANNELS, zoomWindow,
} from '../../site/js/core/series.js';
import { analyze } from '../../site/js/core/engine.js';
import { buildView } from '../../site/js/core/view.js';
import { axisValues } from '../../site/js/core/stats.js';
import { fromArrays } from '../../site/js/core/data.js';
import { loadRun1 } from './helpers.js';

let r1 = null;
function run1() {
  if (!r1) {
    const run = loadRun1();
    const an = analyze(run);
    r1 = { run, an, frame: chartFrame(run, an.params.maxJumpMs) };
  }
  return r1;
}

function synth() {
  const run = fromArrays({
    ax: [1, 2, 3, 4, 5, 6], ay: [0, 0, 0, 0, 0, 0], az: [-2048, -2048, -2048, -2048, -2048, -2048],
    tMs: [0, 100, 200, 5000, 5100, 5200],
  });
  run.t0Ms = 1000000;
  run.channels = {
    vel: { unit: 'mm/s', scale: 100, x: [100, 200, 300, 400, null, 600], y: [0, 0, 0, 0, 0, 0], z: [1, 1, 1, 1, 1, 1] },
    temp: { unit: 'C', scale: 100, v: [2500, 2500, 2500, 2500, 2500, 2500] },
  };
  return run;
}

test('SYNC_KEY and zoomWindow', () => {
  assert.ok(typeof SYNC_KEY === 'string' && SYNC_KEY.length > 0);
  assert.deepEqual(zoomWindow(100), { min: 70, max: 130 });
  assert.deepEqual(zoomWindow(100, 5), { min: 95, max: 105 });
});

test('epochMs', () => {
  const run = synth();
  assert.equal(epochMs(run, 0), 1000000);
  assert.equal(epochMs(run, 3), 1000000 + 5000);
});

test('synthetic frame gap row', () => {
  const run = synth();
  const f = chartFrame(run, 2000);
  assert.equal(f.x.length, 7);
  assert.equal(f.rowOfIdx[3], -1);
  assert.equal(f.rowOfIdx[4], 3);
  assert.equal(f.idxOfRow[3], 4);
  assert.ok(f.x[3] > f.x[2] && f.x[3] < f.x[4]);
  const an = analyze(run);
  const s = axisSeries(run, an, null, 'medido', 0, f);
  assert.equal(s.all.length, 7);
  assert.equal(s.all[3], null);
  assert.equal(s.masked[3], null);
  assert.equal(s.all[0], 1 / 2048);
});

test('run1 frame', () => {
  const { run, frame } = run1();
  assert.equal(frame.x.length, run.n + 1);
  for (let i = 1; i < frame.x.length; i++) assert.ok(frame.x[i] > frame.x[i - 1]);
  for (let r = 0; r < run.n; r++) assert.equal(frame.rowOfIdx[frame.idxOfRow[r]], r);
  assert.equal(frame.rowOfIdx.filter((v) => v === -1).length, 1);
});

for (const mode of ['medido', 'dinamico']) {
  test(`run1 no decimation ${mode}`, () => {
    const { run, an, frame } = run1();
    const v = axisValues(run, an, null, mode);
    ['ax', 'ay', 'az'].forEach((key, k) => {
      const s = axisSeries(run, an, null, mode, k, frame);
      let mx = -Infinity; let mn = Infinity;
      for (const y of s.all) if (y !== null) { if (y > mx) mx = y; if (y < mn) mn = y; }
      let vmx = -Infinity; let vmn = Infinity;
      for (const y of v[key]) { if (y > vmx) vmx = y; if (y < vmn) vmn = y; }
      assert.equal(mx, vmx);
      assert.equal(mn, vmn);
    });
  });
}

test('filter split and isolated', () => {
  const { run, an, frame } = run1();
  const view = buildView(run, an, { classes: [4] });
  const s = axisSeries(run, an, view.mask, 'dinamico', 2, frame);
  let want = 0;
  for (let i = 0; i < run.n; i++) if (an.cls[i] === 4 && run.azValid[i]) want++;
  assert.equal(s.masked.filter((v) => v !== null).length, want);
  for (const i of s.isolated) {
    assert.notEqual(s.masked[i], null);
    assert.ok(i === 0 || s.masked[i - 1] === null);
    assert.ok(i === s.masked.length - 1 || s.masked[i + 1] === null);
  }
});

test('thresholdLines', () => {
  const { an } = run1();
  const d = thresholdLines(an, 'dinamico', 2);
  assert.equal(d.length, 2 * (an.ncls - 1));
  assert.equal(d[0].cls, 1);
  assert.equal(d[0].value, an.th2[0] / 4096);
  assert.equal(d[1].value, -an.th2[0] / 4096);
  const m = thresholdLines(an, 'medido', 2);
  assert.equal(m[0].value, (an.off2[2] + an.th2[0]) / 4096);
  assert.equal(m[1].value, (an.off2[2] - an.th2[0]) / 4096);
  assert.ok(Math.abs(m[0].value - (-4036 + an.th2[0]) / 4096) < 1e-12);
});

test('channels', () => {
  assert.deepEqual(CHANNELS.map((c) => c.key), ['vel', 'disp', 'freq', 'temp']);
  assert.deepEqual(CHANNELS.map((c) => c.unit), ['mm/s', 'µm', 'Hz', '°C']);
  assert.deepEqual(CHANNELS.map((c) => c.label), ['Velocidade', 'Deslocamento', 'Frequência', 'Temperatura']);
  const run = synth();
  const f = chartFrame(run, 2000);
  const v = channelSeries(run, 'vel', f);
  assert.equal(v.unit, 'mm/s');
  assert.deepEqual(v.series.map((s) => s.name), ['X', 'Y', 'Z']);
  assert.equal(v.series[0].values[1], 2);
  assert.equal(v.series[0].values[3], null);
  assert.equal(v.series[0].values[5], null);
  const t = channelSeries(run, 'temp', f);
  assert.equal(t.series.length, 1);
  assert.equal(t.unit, '°C');
  assert.equal(t.series[0].values[0], 25);
  assert.equal(channelSeries(run, 'disp', f), null);
  run.channels = null;
  assert.equal(channelSeries(run, 'vel', f), null);
});

test('run1 channels aligned', () => {
  const { run, frame } = run1();
  for (const c of CHANNELS) {
    const cs = channelSeries(run, c.key, frame);
    assert.ok(cs);
    for (const s of cs.series) assert.equal(s.values.length, frame.x.length);
  }
});
