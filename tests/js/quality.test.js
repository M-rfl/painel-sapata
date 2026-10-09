import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualitySummary, channelEmptiness } from '../../site/js/core/quality.js';
import { analyze } from '../../site/js/core/engine.js';
import { fromArrays } from '../../site/js/core/data.js';
import { loadRun1 } from './helpers.js';

test('decodeRun keeps channels, quality, flagBits', () => {
  const run = loadRun1();
  assert.deepEqual(Object.keys(run.channels).sort(), ['disp', 'freq', 'temp', 'vel']);
  assert.equal(run.quality.rows_with_gps, 21363);
  assert.deepEqual(run.flagBits, { sem_gps: 1, edge: 2, inferred_station: 4 });
});

test('channelEmptiness synthetic', () => {
  const ch = {
    vel: { unit: 'mm/s', x: [null, null], y: [0, 0], z: [0, 1, null, 2] },
    temp: { unit: 'C', v: [1, 2] },
  };
  const e = channelEmptiness(ch);
  const get = (c, a) => e.find((r) => r.channel === c && r.axis === a);
  assert.equal(get('vel', 'x').empty, true);
  assert.equal(get('vel', 'y').empty, true);
  assert.equal(get('vel', 'z').empty, false);
  assert.equal(get('vel', 'z').share, 0.5);
  assert.equal(get('temp', 'v').share, 0);
  assert.equal(get('vel', 'z').unit, 'mm/s');
});

test('qualitySummary run 1', () => {
  const run = loadRun1();
  const s = qualitySummary(run, analyze(run));
  assert.equal(s.n, 23383);
  assert.equal(s.rowsWithGps, 21363);
  assert.equal(s.rowsWithoutGps, 2020);
  assert.ok(Math.abs(s.gpsCoverage - 0.91361) < 5e-6);
  assert.deepEqual(s.turnarounds, [{ gapS: 566.7, terminal: 'PXV', index: 11835 }]);
  assert.equal(s.maxGapS, 566.7);
  assert.deepEqual(s.stationWarnings, []);
  assert.equal(s.inferredStations.length, 5);
  assert.ok('code' in s.inferredStations[0] && 'sentido' in s.inferredStations[0] && 'minDistM' in s.inferredStations[0]);
  assert.equal(s.unrecovered, 0);
  assert.equal(s.ambiguous, 0);
  assert.equal(s.naoClassificadas, 0);
  let c = 0;
  for (let i = 0; i < run.n; i++) if (run.flags[i] & 1) c++;
  assert.equal(s.semGpsRows, c);
  assert.deepEqual(s.emptyChannels, []);
  const velx = s.channels.find((r) => r.channel === 'vel' && r.axis === 'x');
  assert.ok(Math.abs(velx.share - 0.172) < 0.005);
  assert.equal(s.channels.find((r) => r.channel === 'temp').share, 0);
  assert.equal(s.converterVersion, '1.0.0');
  assert.equal(typeof s.generatedAt, 'string');
});

test('qualitySummary without quality/channels', () => {
  const run = fromArrays({ ax: [1], ay: [1], az: [1], tMs: [0] });
  const s = qualitySummary(run, null);
  assert.equal(s.rowsWithGps, null);
  assert.equal(s.gpsCoverage, null);
  assert.deepEqual(s.turnarounds, []);
  assert.deepEqual(s.channels, []);
  assert.deepEqual(s.emptyChannels, []);
});
