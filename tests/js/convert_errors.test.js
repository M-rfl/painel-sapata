import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { convertFiles, ConvertError, ERROR_CODES, MAX_FILES } from '../../site/js/core/convert/index.js';
import { loadJson } from './helpers.js';

const stations = loadJson('site/data/stations.json');
const fixture = loadJson('tests/fixtures/upload_parity.json');
const synth = fixture.files.find((c) => c.name === 'synthetic-l4').files;
const sha = (t) => createHash('sha256').update(Buffer.from(t, 'utf8')).digest('hex');
const mk = (name, text) => ({ name, text, sha256: sha(text) });
const base = synth.find((f) => f.text.split('\n')[0].includes(',gps_lat')) || synth[0];

// edit the comma-delimited base file row by row (header = row 0)
function edit(fn) {
  const rows = base.text.split('\n');
  const out = rows.map((line, i) => (i === 0 || line === '' ? line : fn(line.split(','), i).join(',')));
  return mk('x.csv', out.join('\n'));
}
const GPS_LAT = 18;
const GPS_LON = 19;
const GPS_SPEED = 20;

function code(fn) {
  try { fn(); } catch (e) {
    assert.ok(e instanceof ConvertError, `not a ConvertError: ${e && e.stack}`);
    assert.ok(ERROR_CODES.includes(e.code), e.code);
    return e;
  }
  assert.fail('expected ConvertError');
  return null;
}

test('no_files / too_many_files', () => {
  assert.equal(code(() => convertFiles([], stations)).code, 'no_files');
  const many = Array.from({ length: MAX_FILES + 1 }, (_, i) => mk(`${i}.csv`, 'not even parsed'));
  const e = code(() => convertFiles(many, stations));
  assert.equal(e.code, 'too_many_files');
  assert.equal(e.detail.max, MAX_FILES);
});

test('empty_file', () => {
  assert.equal(code(() => convertFiles([mk('a.csv', '')], stations)).code, 'empty_file');
});

test('missing_column', () => {
  const t = base.text.replace('gps_lat', 'gps_latx');
  const e = code(() => convertFiles([mk('a.csv', t)], stations));
  assert.equal(e.code, 'missing_column');
  assert.equal(e.detail.column, 'gps_lat');
  assert.equal(e.detail.file, 'a.csv');
});

test('bad_timestamp: garbage and impossible date', () => {
  const e = code(() => convertFiles([edit((c, i) => { if (i === 1) c[0] = 'garbage'; return c; })], stations));
  assert.equal(e.code, 'bad_timestamp');
  assert.equal(e.detail.file, 'x.csv');
  assert.equal(e.detail.line, 2);
  assert.equal(e.detail.text, 'garbage');
  const e2 = code(() => convertFiles([edit((c, i) => { if (i === 1) c[0] = '2026-02-30T08:00:00.180000-03:00'; return c; })], stations));
  assert.equal(e2.code, 'bad_timestamp');
});

test('naive_timestamp', () => {
  const e = code(() => convertFiles([edit((c, i) => { if (i === 1) c[0] = '2026-10-02T08:00:00.180000'; return c; })], stations));
  assert.equal(e.code, 'naive_timestamp');
});

test('no_rows (header only)', () => {
  const head = base.text.split('\n')[0] + '\n';
  assert.equal(code(() => convertFiles([mk('a.csv', head)], stations)).code, 'no_rows');
});

test('channel_off_grid', () => {
  const e = code(() => convertFiles([edit((c, i) => { if (i === 1) c[10] = '21.655'; return c; })], stations));
  assert.equal(e.code, 'channel_off_grid');
  assert.equal(e.detail.channel, 'temp');
});

test('unknown_line: all GPS 50 km away (outside envelope)', () => {
  const f = edit((c) => {
    if (c[GPS_LAT] !== '') { c[GPS_LAT] = String(Number(c[GPS_LAT]) + 0.45); }
    return c;
  });
  assert.equal(code(() => convertFiles([f], stations)).code, 'unknown_line');
  // Python-equivalent conversion still available
  const { json } = convertFiles([f], stations, { requireKnownLine: false });
  assert.equal(json.meta.n, f.text.split('\n').filter((l, i) => i > 0 && l).length);
});

test('unknown_line: GPS inside the envelope but far from every station', () => {
  // shift roughly 450 m north then also 450 m east: still inside Rio, away from every station
  const f = edit((c) => {
    if (c[GPS_LAT] !== '') {
      c[GPS_LAT] = String(Number(c[GPS_LAT]) + 0.02);
      c[GPS_LON] = String(Number(c[GPS_LON]) + 0.02);
    }
    return c;
  });
  assert.equal(code(() => convertFiles([f], stations)).code, 'unknown_line');
});

test('unknown_line: no GPS at all', () => {
  const f = edit((c) => { c[GPS_LAT] = ''; c[GPS_LON] = ''; c[GPS_SPEED] = ''; return c; });
  assert.equal(code(() => convertFiles([f], stations)).code, 'unknown_line');
});

test('guard is not stricter than Pitfall 9: a single station hit converts', () => {
  const first = base.text.split('\n')[1].split(',');
  const lat0 = first[GPS_LAT];
  const lon0 = first[GPS_LON];
  const f = edit((c) => {
    if (c[GPS_LAT] !== lat0 || c[GPS_LON] !== lon0) { c[GPS_LAT] = ''; c[GPS_LON] = ''; c[GPS_SPEED] = ''; }
    return c;
  });
  const { json, summary } = convertFiles([f], stations);
  assert.equal(summary.lineHits, 1);
  assert.equal(summary.rows, json.meta.n);
});

test('ambiguous line converts and is reported', () => {
  const first = base.text.split('\n')[1].split(',');
  const lat0 = first[GPS_LAT];
  const lon0 = first[GPS_LON];
  const f = edit((c) => {
    if (c[GPS_LAT] !== lat0 || c[GPS_LON] !== lon0) { c[GPS_LAT] = ''; c[GPS_LON] = ''; c[GPS_SPEED] = ''; }
    return c;
  });
  const { json, summary } = convertFiles([f], stations);
  assert.equal(summary.ambiguous, json.meta.line.ambiguous);
});

test('summary matches the JSON', () => {
  const { json, summary } = convertFiles(synth.map((f) => mk(f.name, f.text)), stations);
  assert.equal(summary.rows, json.meta.n);
  assert.equal(summary.rowsWithoutGps, json.quality.rows_without_gps);
  assert.equal(summary.ambiguous, json.meta.line.ambiguous);
  assert.equal(summary.lineId, json.meta.line.id);
  assert.equal(summary.unrecovered, json.quality.unrecovered_values);
  assert.equal(summary.ambiguousValues, json.quality.ambiguous_values);
  assert.deepEqual(summary.files, json.meta.source.files.map((s) => s.name));
  assert.equal(summary.lineHits, json.meta.line.scores.length ? summary.lineHits : 0);
  assert.ok(summary.lineHits >= 2);
});
