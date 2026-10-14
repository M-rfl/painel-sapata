import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { convertFiles } from '../../site/js/core/convert/index.js';
import { UPLOAD_ONLY_META, stripMeta, firstDiff } from './convert_meta.js';
import { loadJson } from './helpers.js';

const stations = loadJson('site/data/stations.json');
const fixture = loadJson('tests/fixtures/upload_parity.json');
const withSha = (files) => files.map((f) => ({
  ...f, sha256: createHash('sha256').update(Buffer.from(f.text, 'utf8')).digest('hex'),
}));

for (const c of fixture.files) {
  test(`whole-file parity ${c.name}`, () => {
    const { json } = convertFiles(withSha(c.files), stations, { requireKnownLine: false });
    const got = stripMeta(json, UPLOAD_ONLY_META);
    const exp = stripMeta(c.expected, UPLOAD_ONLY_META);
    const d = firstDiff(got, exp);
    assert.equal(d, null, d || '');
    assert.deepEqual(got, exp);
  });
}

test('upload meta flags', () => {
  const c = fixture.files[0];
  const { json } = convertFiles(withSha(c.files), stations, { requireKnownLine: false, generatedAt: 'X' });
  assert.equal(json.meta.uploaded, true);
  assert.equal(json.meta.converter_version, 'js');
  assert.equal(json.meta.generated_at, 'X');
  assert.ok(!('workbook_reference' in json.meta));
});

test('synthetic-l4 pins Python half-even rounding', () => {
  const c = fixture.files.find((x) => x.name === 'synthetic-l4');
  const { json } = convertFiles(withSha(c.files), stations, { requireKnownLine: false });
  assert.equal(json.quality.max_gap_s, 2.2);
  assert.equal(json.quality.turnarounds[0].gap_s, 1.2);
});
