import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  fmtInt, fmtDec, fmtG, fmtPct, fmtDate, fmtTime, fmtDateTime, fmtDuration,
  fmtThreshold, parseDecimal, validateThresholds,
} from '../../site/js/app/format.js';
import { T, pontosNote } from '../../site/js/app/i18n.js';

const norm = (s) => s.replace('−', '-');
const D = new Date('2026-10-02T00:30:56.060-03:00');

test('number formatters pt-BR', () => {
  assert.equal(fmtInt(21031), '21.031');
  assert.equal(fmtInt(0), '0');
  assert.equal(fmtDec(0.5, 1), '0,5');
  assert.equal(norm(fmtG(-0.98747, 5)), '-0,98747');
  assert.equal(fmtPct(21363 / 23383), '91,4%');
  assert.equal(fmtThreshold(0.5), '0,5');
  assert.equal(fmtThreshold(4), '4');
});

test('date formatters in America/Sao_Paulo', () => {
  assert.equal(fmtDateTime(D), '02/10/2026 00:30:56');
  assert.equal(fmtTime(D), '00:30:56');
  assert.equal(fmtDate(D), '02/10/2026');
  assert.equal(fmtDateTime(D.getTime()), '02/10/2026 00:30:56');
});

test('fmtDateTime is zone independent', () => {
  const url = new URL('../../site/js/app/format.js', import.meta.url).href;
  const script = `import(${JSON.stringify(url)}).then(m=>console.log(m.fmtDateTime(new Date('2026-10-02T00:30:56.060-03:00'))))`;
  const out = execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: 'UTC' } }).toString().trim();
  assert.equal(out, '02/10/2026 00:30:56');
});

test('fmtDuration', () => {
  assert.equal(fmtDuration(566.7), '9 min 26,7 s');
  assert.equal(fmtDuration(42), '42 s');
  assert.equal(fmtDuration(3900), '1 h 05 min');
});

test('parseDecimal strict', () => {
  assert.equal(parseDecimal('0,5'), 0.5);
  assert.equal(parseDecimal('0.5'), 0.5);
  assert.equal(parseDecimal(' 2 '), 2);
  assert.equal(parseDecimal('10'), 10);
  for (const bad of ['1,5abc', '1.000,5', '1,000.5', '', '  ', '-1', '1,', ',5', 'abc']) {
    assert.ok(Number.isNaN(parseDecimal(bad)), `should reject ${JSON.stringify(bad)}`);
  }
});

test('validateThresholds', () => {
  assert.equal(validateThresholds([0.5, 1, 2, 4]).ok, true);
  let r = validateThresholds([0.5, 0.5, 2, 4]);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'Os limiares devem ser crescentes.');
  assert.equal(r.fieldErrors[1], true);
  r = validateThresholds([NaN, 1, 2, 4]);
  assert.equal(r.ok, false);
  assert.match(r.error, /vírgula ou ponto/);
  assert.equal(r.fieldErrors[0], true);
  assert.equal(validateThresholds([0, 1, 2, 4]).ok, false);
  assert.equal(validateThresholds([0.5, 1, 2, 17]).ok, false);
  assert.equal(validateThresholds([0.5, 1, 2, 16]).ok, true);
});

test('i18n strings are Portuguese and non-empty', () => {
  const deny = /\b(the|filter|filters|reset|threshold|loading|error|records|events|impacts|points|settings|show|hide)\b/i;
  for (const [k, v] of Object.entries(T)) {
    assert.equal(typeof v, 'string', k);
    assert.ok(v.length > 0, k);
    assert.ok(!deny.test(v), `${k}: ${v}`);
  }
  const note = pontosNote(99, 101);
  assert.ok(note.includes('99') && note.includes('101'));
  assert.ok(pontosNote(1000, 2000).includes('1.000'));
});
