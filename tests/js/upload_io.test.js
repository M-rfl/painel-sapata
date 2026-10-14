import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isCsvName, selectCsv, readSelected, errorMessage, loadedMessage, bannerText } from '../../site/js/app/uploadio.js';
import { ConvertError, ERROR_CODES, MAX_FILES, MAX_FILE_BYTES } from '../../site/js/core/convert/index.js';
import { T } from '../../site/js/app/i18n.js';

const f = (name, bytes = [0x61]) => new File([new Uint8Array(bytes)], name);
const spy = (name, size, buf = new Uint8Array([0x61]).buffer) => {
  const o = { name, size, calls: 0, arrayBuffer: async () => { o.calls++; return buf; } };
  return o;
};

test('isCsvName', () => {
  for (const n of ['a.csv', 'B.CSV', '2. PXV-TIG.csv']) assert.equal(isCsvName(n), true, n);
  for (const n of ['a.txt', 'a.csv.txt', 'csv', '.csvx']) assert.equal(isCsvName(n), false, n);
});

test('selectCsv splits csv and ignored in order', () => {
  const [a, n, b, i] = [f('a.csv'), f('notes.txt'), f('B.CSV'), f('img.png')];
  const r = selectCsv([a, n, b, i]);
  assert.deepEqual(r.csv, [a, b]);
  assert.deepEqual(r.ignored, ['notes.txt', 'img.png']);
});

test('selectCsv errors', () => {
  assert.throws(() => selectCsv([f('notes.txt')]), (e) => e.code === 'no_csv' && e.detail.ignored[0] === 'notes.txt');
  assert.throws(() => selectCsv([]), (e) => e.code === 'no_files');
});

test('too many files: no read', async () => {
  const files = Array.from({ length: MAX_FILES + 1 }, (_, i) => spy(`f${i}.csv`, 1));
  await assert.rejects(readSelected(files), (e) => e.code === 'too_many_files' && e.detail.max === 6);
  assert.ok(files.every((x) => x.calls === 0));
});

test('too large checked before any read', async () => {
  const ok = spy('ok.csv', 10);
  const big = spy('big.csv', MAX_FILE_BYTES + 1);
  await assert.rejects(readSelected([ok, big]), (e) => e.code === 'too_large' && e.detail.file === 'big.csv' && e.detail.max === 60);
  assert.equal(ok.calls, 0);
  assert.equal(big.calls, 0);
});

test('bad encoding and read failure', async () => {
  await assert.rejects(readSelected([f('x.csv', [0x61, 0xff, 0x62])]), (e) => e.code === 'bad_encoding' && e.detail.file === 'x.csv');
  const rej = { name: 'r.csv', size: 3, arrayBuffer: async () => { throw new Error('boom'); } };
  await assert.rejects(readSelected([rej]), (e) => e.code === 'read_failed' && e.detail.file === 'r.csv');
});

test('BOM stripped, sha over raw bytes, empty file', async () => {
  const bytes = [0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62];
  const { files, ignored } = await readSelected([f('a.csv', bytes), f('e.csv', []), f('n.txt')]);
  assert.equal(files[0].text, 'a,b');
  assert.equal(files[0].sha256, createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
  assert.equal(files[1].text, '');
  assert.deepEqual(ignored, ['n.txt']);
  assert.equal(files[0].name, 'a.csv');
});

test('errorMessage covers every code in pt-BR', () => {
  const detail = { file: 'a.csv', line: 1234, column: 'ax', text: 'zz', channel: 'AX', index: 5678, mb: 61.2, max: 60 };
  for (const code of ERROR_CODES) {
    const m = errorMessage(new ConvertError(code, detail));
    assert.ok(typeof m === 'string' && m.length > 0, code);
    assert.ok(!/undefined|null|NaN|\{/.test(m), `${code}: ${m}`);
  }
  assert.ok(errorMessage(new ConvertError('empty_file', { file: 'a.csv' })).includes('a.csv'));
  assert.ok(errorMessage(new ConvertError('bad_timestamp', detail)).includes('1.234'));
  assert.ok(errorMessage(new ConvertError('naive_timestamp', detail)).includes('1.234'));
  assert.equal(errorMessage(new Error('x')), T.uploadErrGeneric);
});

test('loadedMessage', () => {
  const s = { rows: 23383, files: ['a.csv'], lineName: 'Linha 4', ambiguous: false, lineHits: 5, unrecovered: 0 };
  const m = loadedMessage(s, []);
  assert.ok(m.includes('23.383') && m.includes('Linha 4') && m.includes('0 valores não recuperados'), m);
  assert.ok(!m.includes('Ignorados'));
  const m2 = loadedMessage({ ...s, ambiguous: true, lineHits: 1 }, ['notes.txt']);
  assert.ok(m2.includes(T.uploadWarnAmbiguous) && m2.includes(T.uploadWarnFewStations));
  assert.ok(m2.includes('Ignorados (não são .csv): notes.txt.'));
});

test('bannerText', () => {
  const t = bannerText({ rows: 23383, files: ['a.csv', 'b.csv'] });
  assert.ok(t.includes('a.csv') && t.includes('b.csv') && t.includes('23.383'));
  assert.ok(/servidor/.test(t));
});
