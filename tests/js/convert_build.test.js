import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { convertFiles } from '../../site/js/core/convert/index.js';
import { decodeRun, analyze, DEFAULT_PARAMS, DEFAULT_GPS, conformeCheck } from '../../site/js/core/index.js';
import { applyGpsFilter } from '../../site/js/core/gpsfilter.js';
import { buildView } from '../../site/js/core/view.js';
import { loadJson } from './helpers.js';

const stations = loadJson('site/data/stations.json');
const fixture = loadJson('tests/fixtures/upload_parity.json');
const withSha = (files) => files.map((f) => ({
  ...f, sha256: createHash('sha256').update(Buffer.from(f.text, 'utf8')).digest('hex'),
}));

for (const name of ['synthetic-l4', 'single-ptbr']) {
  test(`converted ${name} feeds the dashboard core unchanged`, () => {
    const c = fixture.files.find((x) => x.name === name);
    const { json } = convertFiles(withSha(c.files), stations, { requireKnownLine: false });
    const run = decodeRun(JSON.parse(JSON.stringify(json)));
    assert.equal(run.reference, null);
    const filtered = applyGpsFilter(run, DEFAULT_GPS);
    const an = analyze(filtered, DEFAULT_PARAMS);
    const view = buildView(filtered, an, undefined);
    assert.ok(view);
    assert.ok(run.trechos.length > 0);
    assert.ok(run.sentidos.length > 0);
    const conf = conformeCheck(an, DEFAULT_PARAMS, run.reference);
    assert.equal(conf.available, false);
  });
}
