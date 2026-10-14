import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../../site/js/core/index.js';
import { buildView } from '../../site/js/core/view.js';
import { pontoRows, trechoRows } from '../../site/js/core/ranking.js';
import { toCsv, csvNum, csvText, pontosCsv, trechosCsv, csvFilename } from '../../site/js/app/csv.js';
import { loadRun1 } from './helpers.js';

test('toCsv format', () => {
  assert.equal(toCsv(['a', 'b'], [[1, 'x;y']]), '﻿a;b\r\n1;"x;y"\r\n');
  assert.equal(toCsv(['a'], [['a"b']]), '﻿a\r\n"a""b"\r\n');
  assert.equal(toCsv(['a'], [['l1\nl2']]), '﻿a\r\n"l1\nl2"\r\n');
  assert.equal(toCsv(['a', 'b'], [[null, undefined]]), '﻿a;b\r\n;\r\n');
});

test('csvNum', () => {
  assert.equal(csvNum(-0.12345, 4), '-0,1235');
  assert.equal(csvNum(1234.5, 1), '1234,5');
  assert.equal(csvNum(null), '');
  assert.equal(csvNum(NaN, 2), '');
});

test('csvText guard', () => {
  for (const s of ['=SUM(A1)', '+1', '-1', '@x']) assert.equal(csvText(s), "'" + s);
  assert.equal(csvText('Central – Gamboa'), 'Central – Gamboa');
});

const run = loadRun1();
const an = analyze(run);
const view = buildView(run, an, {});

test('pontosCsv full export', () => {
  const rows = pontoRows(run, an, view);
  const { headers, rows: out } = pontosCsv(rows);
  assert.deepEqual(headers, ['Posição', 'Hora', 'Trecho', 'Sentido', 'Eixo dominante', '|dom| (g)', 'AX din. (g)',
    'AY din. (g)', 'AZ din. (g)', 'Classe', 'Impactos no ponto', 'Google Maps']);
  assert.equal(out.length, view.pontos);
  assert.match(out[0][1], /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
  assert.match(out[0][5], /^\d+,\d{4}$/);
  const text = toCsv(headers, out);
  const lines = text.slice(1).split('\r\n');
  assert.equal(lines.length, out.length + 2);
  for (const line of lines.slice(0, -1)) {
    let inQ = false;
    let seps = 0;
    for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === ';' && !inQ) seps++; }
    assert.equal(seps + 1, headers.length);
  }
  const semGps = rows.findIndex((r) => r.url === null);
  assert.equal(out[semGps][11], '');
});

test('trechosCsv', () => {
  const rows = trechoRows(run, an, {});
  const { headers, rows: out } = trechosCsv(rows);
  assert.deepEqual(headers, ['Prioridade', 'Sentido', 'Trecho', 'IQ (%)', 'Registros', 'Eventos', 'Impactos', 'Pontos',
    'Maior classe', 'Pico |dom| (g)', 'Sem Crítico']);
  assert.equal(out.length, rows.length);
  assert.match(out[0][3], /^\d+,\d$/);
  assert.equal(out[0][8], 'Crítico');
  const sc = rows.findIndex((r) => r.semCritico);
  if (sc >= 0) assert.equal(out[sc][10], 'sim');
  assert.equal(out[0][10], '');
});

test('csvFilename', () => {
  assert.equal(csvFilename(run, 'pontos'), 'pontos-2026-10-02-l4-t102.csv');
  assert.equal(csvFilename({}, 'trechos'), 'trechos-corrida.csv');
});
