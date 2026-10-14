import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../../site/js/core/index.js';
import { buildView } from '../../site/js/core/view.js';
import { qualityIndex } from '../../site/js/core/quality_index.js';
import { trechoRows, pontoRows, topPontos, sortPontos, AXIS_NAMES } from '../../site/js/core/ranking.js';
import { googleMapsUrl } from '../../site/js/core/geo.js';
import { epochMs } from '../../site/js/core/series.js';
import { loadRun1 } from './helpers.js';

const run = loadRun1();
const an = analyze(run);
const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);
const SORT_KEYS = ['hora', 'trecho', 'sentido', 'eixo', 'dom', 'ax', 'ay', 'az', 'cls', 'nImp'];

test('trechoRows order is full-run priority regardless of filters', () => {
  const order = an.priority.map((p) => p.trecho);
  for (const f of [{}, { sentidos: [1] }, { classes: [4] }]) {
    const rows = trechoRows(run, an, f);
    assert.deepEqual(rows.map((r) => r.trecho), order);
    rows.forEach((r, i) => { assert.equal(r.level, an.priority[i].level); assert.equal(r.label, an.priority[i].label); });
  }
});

test('trechoRows totals tie out unfiltered', () => {
  const rows = trechoRows(run, an, {});
  assert.equal(sum(rows, 'registros'), run.n);
  assert.equal(sum(rows, 'eventos'), an.eventos);
  assert.equal(sum(rows, 'impactos'), 1749);
  assert.equal(sum(rows, 'pontos'), an.pontos);
  for (const r of rows) assert.deepEqual(r.iq, qualityIndex(r.classCounts));
});

test('trecho filter only marks rows', () => {
  const base = trechoRows(run, an, {});
  const sel = trechoRows(run, an, { trechos: [3] });
  assert.equal(sel.length, base.length);
  sel.forEach((r, i) => {
    assert.equal(r.selected, r.trecho === 3);
    assert.deepEqual({ ...r, selected: false }, { ...base[i], selected: false });
  });
});

test('sentido filter empties other-sentido rows', () => {
  const rows = trechoRows(run, an, { sentidos: [0] });
  const other = rows.filter((r) => r.sentidoIdx === 1);
  assert.ok(other.length > 0);
  for (const r of other) { assert.equal(r.registros, 0); assert.equal(r.iq.value, null); }
});

test('semCritico from full-run medicoes', () => {
  const top = an.ncls - 1;
  const cnt = new Array(run.trechoNames.length).fill(0);
  for (let i = 0; i < run.n; i++) if (an.cls[i] === top) cnt[run.trecho[i]]++;
  for (const f of [{}, { sentidos: [0] }, { classes: [1] }]) {
    for (const r of trechoRows(run, an, f)) {
      assert.equal(r.semCritico, cnt[r.trecho] === 0);
      if (r.level === 1) assert.equal(r.semCritico, false);
    }
  }
});

test('maxCls and peakDom come from masked rows', () => {
  const rows = trechoRows(run, an, {});
  for (const r of rows) {
    let mc = -1; let pk = -1;
    for (let i = 0; i < run.n; i++) {
      if (run.trecho[i] !== r.trecho) continue;
      if (an.cls[i] > mc) mc = an.cls[i];
      if (an.cls[i] >= 1 && an.dom2[i] > pk) pk = an.dom2[i];
    }
    assert.equal(r.maxCls, mc);
    assert.equal(r.peakDom, pk >= 0 ? pk / 4096 : null);
  }
});

test('pontoRows basics', () => {
  const view = buildView(run, an, {});
  const rows = pontoRows(run, an, view);
  assert.equal(rows.length, view.pontos);
  assert.equal(rows.length, 99);
  rows.forEach((r, i) => {
    assert.equal(r.rank, i + 1);
    if (i > 0) assert.ok(rows[i - 1].dom > r.dom || (rows[i - 1].dom === r.dom && rows[i - 1].row < r.row));
    assert.equal(r.tEpochMs, epochMs(run, r.row));
    assert.equal(r.eixoName, AXIS_NAMES[r.eixo]);
    assert.equal(r.dom, an.dom2[r.row] / 4096);
  });
  assert.equal(sum(rows, 'nImp'), view.impactos);
  let semGps = 0;
  for (const r of rows) {
    const f = run.fix[r.row];
    if (run.locId[r.row] >= 0 && f >= 0) assert.equal(r.url, googleMapsUrl(run.fixLat[f], run.fixLon[f]));
    else { semGps++; assert.equal(r.url, null); assert.equal(r.lat, null); assert.equal(r.lon, null); }
  }
  assert.ok(semGps >= 1);
});

test('top 50 and sort', () => {
  const rows = pontoRows(run, an, buildView(run, an, {}));
  const top = topPontos(rows);
  assert.equal(top.length, 50);
  assert.deepEqual(top, rows.slice(0, 50));
  assert.equal(topPontos(rows.slice(0, 7)).length, 7);
  const snap = top.map((r) => r.row);
  for (const col of SORT_KEYS) {
    for (const dir of ['asc', 'desc']) {
      const s = sortPontos(top, { col, dir });
      assert.deepEqual(s.map((r) => r.row).sort((a, b) => a - b), snap.slice().sort((a, b) => a - b));
    }
  }
  assert.deepEqual(top.map((r) => r.row), snap);
  const byTrecho = sortPontos(top, { col: 'trecho', dir: 'asc' });
  for (let i = 1; i < byTrecho.length; i++) assert.ok(byTrecho[i - 1].trecho.localeCompare(byTrecho[i].trecho, 'pt-BR') <= 0);
  const byCls = sortPontos(top, { col: 'cls', dir: 'desc' });
  for (let i = 1; i < byCls.length; i++) {
    if (byCls[i - 1].cls === byCls[i].cls) assert.ok(byCls[i - 1].rank < byCls[i].rank);
  }
  assert.throws(() => sortPontos(top, { col: 'nope', dir: 'asc' }));
});

test('classe filter', () => {
  const view = buildView(run, an, { classes: [4] });
  const rows = pontoRows(run, an, view);
  assert.equal(rows.length, view.pontos);
  assert.ok(rows.every((r) => r.cls === 4));
});
