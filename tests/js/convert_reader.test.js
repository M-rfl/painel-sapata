import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadJson } from './helpers.js';
import { parseTimestamp } from '../../site/js/core/convert/isotime.js';
import { readRun } from '../../site/js/core/convert/reader.js';
import { ConvertError } from '../../site/js/core/convert/errors.js';

const fx = loadJson('tests/fixtures/upload_parity.json');
const sha = (text) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
const withSha = (files) => files.map((f) => ({ name: f.name, text: f.text, sha256: sha(f.text) }));
const caseOf = (name) => fx.files.find((f) => f.name === name);

test('timestamps fixture: accept/reject exactly like Python 3.13 fromisoformat', () => {
  assert.ok(fx.timestamps.length > 50);
  for (const c of fx.timestamps) {
    if (c.ok) {
      assert.deepStrictEqual(parseTimestamp(c.text), { us: c.us, iso: c.iso, date: c.date, dmy: c.dmy }, c.text);
    } else {
      assert.throws(() => parseTimestamp(c.text), (e) => e instanceof ConvertError && e.code === c.error, c.text);
    }
  }
});

test('timestamp literals', () => {
  assert.equal(parseTimestamp('2026-10-02T00:40:00.180000-03:00').iso, '2026-10-02T00:40:00.180000-03:00');
  assert.equal(parseTimestamp('2026-10-02T00:40:00-03:00').iso, '2026-10-02T00:40:00-03:00');
  assert.equal(parseTimestamp('2026-10-02T00:40:00Z').iso, '2026-10-02T00:40:00+00:00');
  assert.equal(parseTimestamp('2026-10-02T00:40:00.18-03:00').iso, '2026-10-02T00:40:00.180000-03:00');
  assert.throws(() => parseTimestamp('2026-10-02T00:30:00'), (e) => e.code === 'naive_timestamp');
  assert.throws(() => parseTimestamp('garbage'), (e) => e.code === 'bad_timestamp');
  assert.throws(() => parseTimestamp('2026-10-02T'), (e) => e.code === 'bad_timestamp');
});

function checkWholeFile(name) {
  const c = caseOf(name);
  const ex = c.expected;
  const run = readRun(withSha(c.files));
  assert.deepStrictEqual(run.ax, ex.accel.ax);
  assert.deepStrictEqual(run.ay, ex.accel.ay);
  assert.deepStrictEqual(run.az, ex.accel.az);
  assert.equal(run.tsUs.length, ex.meta.n);
  const dt = run.tsUs.map((u, i) => (i === 0 ? 0 : (u - run.tsUs[i - 1]) / 1000));
  assert.deepStrictEqual(dt, ex.t.dt_ms);
  assert.equal(run.t0.iso, ex.meta.t0);
  assert.deepStrictEqual(run.sources, ex.meta.source.files);
  assert.equal(run.sensorId, ex.meta.sensor_id);
  assert.equal(run.issues.filter((i) => i.value === null).length, ex.quality.unrecovered_values);
  assert.equal(run.issues.filter((i) => i.reason === 'ambiguous_resolved_by_rule').length, ex.quality.ambiguous_values);
  assert.equal(run.lat.filter((v) => v !== null).length, ex.quality.rows_with_gps);
  return run;
}

test('readRun run_mini: mixed comma + ; files merged by time with physical line numbers', () => {
  const run = checkWholeFile('run_mini');
  assert.deepStrictEqual(run.sources.map((s) => s.name), ['2. B-A.csv', '3. A-B.csv']);
  // the ';' file ("3. A-B.csv") starts earlier, so file index 1 comes first; lines are 1-based physical
  assert.deepStrictEqual(run.origin[0], [1, 2]);
  assert.ok(run.origin.every(([f, l]) => (f === 0 || f === 1) && l >= 2));
  for (let i = 1; i < run.tsUs.length; i++) assert.ok(run.tsUs[i] >= run.tsUs[i - 1]);
});

test('readRun synthetic-l4 and single-ptbr', () => {
  const run = checkWholeFile('synthetic-l4');
  const stats = run.recoveryStats;
  assert.ok(stats['accel_k-1'] >= 3);
  assert.equal(stats.unrecovered, 1);
  checkWholeFile('single-ptbr');
});

test('file order does not matter', () => {
  const c = caseOf('synthetic-l4');
  const a = readRun(withSha(c.files));
  const b = readRun(withSha([...c.files].reverse()));
  assert.deepStrictEqual(b, a);
});

const HEAD = 'timestamp,ax_g,ay_g,az_g,gps_lat,gps_lon\n';
const ROW = '2026-10-02T00:40:00.000000-03:00,0.5,0,1,-22.9,-43.17\n';

test('structural errors carry stable codes and data only', () => {
  const one = (text) => readRun([{ name: 'a.csv', text, sha256: 'x' }]);
  assert.throws(() => one(''), (e) => e.code === 'empty_file' && e.detail.file === 'a.csv');
  assert.throws(() => one('timestamp,ax_g\n'), (e) => e.code === 'missing_column' && e.detail.column === 'ay_g');
  assert.throws(() => one(HEAD), (e) => e.code === 'no_rows');
  assert.throws(() => readRun([]), (e) => e.code === 'no_files');
  assert.throws(() => one(HEAD + '\n2026-10-02T00:40:00,0,0,0,,\n'),
    (e) => e.code === 'naive_timestamp' && e.detail.line === 3 && e.detail.file === 'a.csv');
  assert.throws(() => one(HEAD + 'nope,0,0,0,,\n'), (e) => e.code === 'bad_timestamp' && e.detail.text === 'nope');
});

test('BOM, CRLF, blank rows and quoting', () => {
  const plain = readRun([{ name: 'a.csv', text: HEAD + ROW + ROW.replace('00:40:00.0', '00:40:00.1'), sha256: 'x' }]);
  const bom = readRun([{ name: 'a.csv', text: '﻿' + HEAD.replace(/\n/g, '\r\n') + ROW.replace('\n', '\r\n') + '\r\n   \r\n' + ROW.replace('00:40:00.0', '00:40:00.1').replace('\n', '\r\n'), sha256: 'x' }]);
  assert.deepStrictEqual(bom.ax, plain.ax);
  assert.deepStrictEqual(bom.tsUs, plain.tsUs);
  assert.deepStrictEqual(bom.origin, [[0, 2], [0, 5]]);
  const q = readRun([{ name: 'a.csv', text: HEAD + '"2026-10-02T00:40:00.000000-03:00","0.5","0","1","-22.9","-43.17"\n', sha256: 'x' }]);
  assert.deepStrictEqual(q.ax, [1024]);
  assert.equal(q.lat[0], '-22.9');
});
