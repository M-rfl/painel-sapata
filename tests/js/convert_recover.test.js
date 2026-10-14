import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadJson } from './helpers.js';
import { parseDecimal, cmpDecimal, roundHalfUp6 } from '../../site/js/core/convert/decimal.js';
import { pyRound, pyMedian, pyIntLog10, ratToFloat } from '../../site/js/core/convert/pynum.js';
import {
  recoverAccel, alternativeAccelReading, recoverGps, resolveScaled, parsePlain, isThousandsShaped,
} from '../../site/js/core/convert/recover.js';

const fx = loadJson('tests/fixtures/upload_parity.json');

test('recover.accel fixture cases', () => {
  assert.ok(fx.recover.accel.length > 100);
  for (const c of fx.recover.accel) {
    assert.deepStrictEqual(recoverAccel(c.text, c.ptbr), { lsb: c.lsb, reason: c.reason }, JSON.stringify(c));
  }
});

test('recover.alt fixture cases', () => {
  for (const c of fx.recover.alt) assert.strictEqual(alternativeAccelReading(c.text), c.alt, JSON.stringify(c));
});

test('recover.gps fixture cases', () => {
  for (const c of fx.recover.gps) {
    assert.deepStrictEqual(recoverGps(c.text, c.axis, c.ptbr), { value: c.value, reason: c.reason }, JSON.stringify(c));
  }
});

test('recover.scaled fixture cases', () => {
  for (const c of fx.recover.scaled) {
    assert.deepStrictEqual(resolveScaled(c.text, c.kind, c.neighbours, c.column_median),
      { value: c.value, reason: c.reason }, JSON.stringify(c));
  }
});

test('recover.plain fixture cases', () => {
  for (const c of fx.recover.plain) {
    if (c.error) assert.throws(() => parsePlain(c.text, c.ptbr), JSON.stringify(c));
    else assert.ok(Object.is(parsePlain(c.text, c.ptbr), c.value), JSON.stringify(c));
  }
});

test('recover.key6 fixture cases', () => {
  for (const c of fx.recover.key6) assert.strictEqual(roundHalfUp6(c.text), c.key, c.text);
});

test('recover.log10k fixture cases (CPython float log10 round-up)', () => {
  for (const c of fx.recover.log10k) assert.strictEqual(pyIntLog10(BigInt(c.n)), c.k, c.n);
  assert.strictEqual(pyIntLog10(999999999999999n), 15);
});

test('pyround fixture cases', () => {
  assert.ok(fx.pyround.length > 50);
  for (const c of fx.pyround) assert.ok(Object.is(pyRound(c.x, c.nd), c.value), JSON.stringify(c));
});

test('pyRound literals are half-even on the exact binary value', () => {
  assert.strictEqual(pyRound(2.25, 1), 2.2);
  assert.strictEqual(pyRound(2.35, 1), 2.4);
  assert.strictEqual(pyRound(0.125, 2), 0.12);
  assert.strictEqual(pyRound(2.675, 2), 2.67);
  assert.strictEqual(pyRound(-2.25, 1), -2.2);
  assert.strictEqual(pyRound(1.25, 1), 1.2);
  assert.strictEqual(pyRound(1e-7, 6), 0);
  assert.strictEqual(pyRound(6e-7, 6), 1e-6);
  assert.ok(Object.is(pyRound(-1e-7, 6), -0));
  assert.strictEqual(pyRound(1234.5, -2), 1200);
});

test('pyMedian and ratToFloat', () => {
  assert.strictEqual(pyMedian([1, 2, 3, 4]), 2.5);
  assert.strictEqual(pyMedian([3, 1, 2]), 2);
  assert.strictEqual(ratToFloat(1n, 3n), 1 / 3);
  assert.strictEqual(ratToFloat(1n, 10n), 0.1);
  assert.strictEqual(ratToFloat(-7n, 2n), -3.5);
  // 2^53 + 1 is a tie between 2^53 and 2^53 + 2: rounds to even (2^53); +3 ties up to 2^53 + 4
  assert.strictEqual(ratToFloat(2n ** 53n + 1n, 1n), 2 ** 53);
  assert.strictEqual(ratToFloat(2n ** 53n + 3n, 1n), 2 ** 53 + 4);
  assert.strictEqual(ratToFloat(1n, 2n ** 1074n), 5e-324);
});

test('decimal helpers', () => {
  assert.deepStrictEqual(parseDecimal('-0012.50'), { neg: true, digits: '1250', scale: 2 });
  assert.strictEqual(parseDecimal('nan'), null);
  assert.strictEqual(parseDecimal('1_0'), null);
  assert.strictEqual(cmpDecimal('-22.92', '-22.920'), 0);
  assert.strictEqual(cmpDecimal('-22.9200001', '-22.92'), -1);
  assert.strictEqual(cmpDecimal('1E+2', '99.99'), 1);
});

test('misc recovery literals', () => {
  assert.ok(isThousandsShaped('-10.625'));
  assert.ok(!isThousandsShaped('0.500'));
  assert.deepStrictEqual(recoverAccel('3/4', false), { lsb: 1536, reason: 'plain' });
  assert.deepStrictEqual(recoverAccel('1/0', false), { lsb: null, reason: 'unrecoverable' });
});
