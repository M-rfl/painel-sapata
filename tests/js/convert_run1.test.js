import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { convertFiles } from '../../site/js/core/convert/index.js';
import { RUN1_IGNORED_META, stripMeta, firstDiff } from './convert_meta.js';
import { loadJson, repoUrl } from './helpers.js';

// Local-only: Results_1st.Run/raw is git-ignored and absent in CI.
const rawDir = repoUrl('Results_1st.Run/raw/');
const csvs = existsSync(rawDir) ? readdirSync(rawDir).filter((f) => f.toLowerCase().endsWith('.csv')) : [];

test('run-1 raw CSVs convert to the committed site JSON', { skip: csvs.length === 0 && 'no Results_1st.Run/raw/*.csv' }, () => {
  const dec = new TextDecoder('utf-8', { fatal: true });
  const files = csvs.map((name) => {
    const bytes = readFileSync(new URL(name, rawDir));
    return { name, text: dec.decode(bytes), sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  const stations = loadJson('site/data/stations.json');
  const committed = loadJson('site/data/run-2026-10-02-l4-t102.json');
  const t = Date.now();
  const { json } = convertFiles(files, stations);
  console.log(`run-1 conversion: ${Date.now() - t} ms, ${json.meta.n} rows`);
  const allowed = new Set([...Object.keys(committed.meta), 'uploaded']);
  for (const k of Object.keys(json.meta)) assert.ok(allowed.has(k), `unexpected meta key ${k}`);
  const got = stripMeta(json, RUN1_IGNORED_META);
  const exp = stripMeta(committed, RUN1_IGNORED_META);
  const d = firstDiff(got, exp);
  assert.equal(d, null, d || '');
  assert.deepEqual(got, exp);
});
