import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareLines } from '../../site/js/core/convert/stations.js';
import { assign, scoreLines } from '../../site/js/core/convert/geofence.js';
import { loadJson } from './helpers.js';

const lines = prepareLines(loadJson('site/data/stations.json'));
const fixture = loadJson('tests/fixtures/upload_parity.json');

function near(a, b, label) {
  if (a === null || b === null) { assert.equal(a, b, label); return; }
  assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${label}: ${a} vs ${b}`);
}

for (const c of fixture.geofence) {
  test(`scoreLines ${c.name}`, () => {
    assert.deepEqual(scoreLines(c.lat, c.lon, lines, 100, 200), c.expected.line_scores);
  });

  test(`assign ${c.name}`, () => {
    const got = assign(c.lat, c.lon, lines, { radiusM: 100, terminalRadiusM: 200, timestampsUs: c.ts_us });
    const exp = c.expected;
    const strip = (a) => a.map(({ min_dist_m, ...r }) => r);
    for (const k of ['line_id', 'ambiguous', 'line_scores', 'sentidos', 'trechos', 'sentido_runs',
      'trecho_runs', 'flag_runs', 'notes']) {
      assert.deepEqual(got[k], exp[k], k);
    }
    assert.deepEqual(strip(got.passages), strip(exp.passages), 'passages');
    got.passages.forEach((p, i) => near(p.min_dist_m, exp.passages[i].min_dist_m, `passage ${i} min_dist_m`));
    assert.deepEqual(got.stations_not_hit.map((r) => [r[0], r[1]]),
      exp.stations_not_hit.map((r) => [r[0], r[1]]), 'stations_not_hit');
    got.stations_not_hit.forEach((r, i) => near(r[2], exp.stations_not_hit[i][2], 'not_hit dist'));
    assert.deepEqual(got.turnarounds.map(({ gap_s, ...r }) => r),
      exp.turnarounds.map(({ gap_s, ...r }) => r), 'turnarounds');
    got.turnarounds.forEach((t, i) => near(t.gap_s, exp.turnarounds[i].gap_s, 'gap_s'));
  });
}

test('no-gps case is flagged sem-GPS+edge (note only when coordinates exist, as in Python)', () => {
  const c = fixture.geofence.find((x) => x.name === 'no-gps');
  const got = assign(c.lat, c.lon, lines, { timestampsUs: c.ts_us });
  assert.deepEqual(got.flag_runs, [[0, 3]]);
  assert.deepEqual(got.notes, c.expected.notes);
});
