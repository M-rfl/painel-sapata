import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, parseHash, hashContext } from '../../site/js/app/urlstate.js';
import {
  defaultState, setThresholdText, setOffsetMode, setOffsetText, setAnalysisText,
  setFilter, setDisplay, setUi,
} from '../../site/js/app/state.js';
import { loadRun1 } from './helpers.js';
import { readFileSync } from 'node:fs';

const ctx = hashContext(loadRun1());

const slices = (s) => ({ params: s.params, filters: s.filters, display: s.display, ui: s.ui });

test('hashContext', () => {
  assert.ok(ctx.nTrechos > 0 && ctx.nSentidos >= 1);
  assert.ok(ctx.tMax > ctx.tMin);
});

test('default state serializes to empty string and parses back', () => {
  assert.equal(serialize(defaultState()), '');
  const r = parseHash('', ctx);
  assert.deepEqual(r.state, defaultState());
  assert.deepEqual(r.ignored, []);
});

test('documented example and key order', () => {
  let s = defaultState();
  s = setThresholdText(s, 3, '3,5');
  s = setFilter(s, 'sentidos', [0]);
  s = setFilter(s, 'classes', [3, 4]);
  s = setDisplay(s, 'valueMode', 'medido');
  assert.equal(serialize(s), 'lim=0,5;1;2;3,5&sent=0&cls=3,4&modo=med');
});

function fullState() {
  let s = defaultState();
  s = setThresholdText(s, 0, '0,12345');
  s = setThresholdText(s, 3, '3,5');
  s = setOffsetMode(s, 'manual', ['0,0459', '-0,0186', '-0,9854']);
  s = setAnalysisText(s, 'gap', '3');
  s = setAnalysisText(s, 'salto', '2,5');
  s = setAnalysisText(s, 'vmax', '60');
  s = setAnalysisText(s, 'fixmax', '90');
  s = setFilter(s, 'sentidos', [0]);
  s = setFilter(s, 'trechos', [0, 1]);
  s = setFilter(s, 'eixos', [0, 2]);
  s = setFilter(s, 'classes', [1, 2, 3]);
  s = setFilter(s, 'tFrom', Math.round(ctx.tMin + 1000));
  s = setFilter(s, 'tTo', Math.round(ctx.tMax - 1000));
  s = setDisplay(s, 'valueMode', 'medido');
  s = setDisplay(s, 'heatMetric', 'az');
  s = setDisplay(s, 'radius', 30);
  s = setDisplay(s, 'intensity', 1.5);
  s = setUi(s, 'heat', true);
  s = setUi(s, 'matrixBasis', 'pontos');
  s = setUi(s, 'rankSort', { col: 'trecho', dir: 'asc' });
  return s;
}

function roundTrip(s) {
  const h = serialize(s);
  const r = parseHash('#' + h, ctx);
  assert.deepEqual(r.ignored, [], h);
  assert.deepEqual(slices(r.state), slices(s), h);
  assert.equal(serialize(r.state), h);
  return r.state;
}

test('round trip of a fully non-default state', () => {
  const s = fullState();
  const r = roundTrip(s);
  assert.equal(r.inputs.thresholdText[0], '0,12345');
  assert.equal(r.inputs.offsetMode, 'manual');
});

test('round trip of single-key variations', () => {
  const d = defaultState();
  const variants = [
    setOffsetMode(d, 'manual', ['-0,5', '0', '1']),
    setAnalysisText(d, 'gap', '1000'),
    setAnalysisText(d, 'salto', '0,1'),
    setDisplay(d, 'heatMetric', 'resDin'),
    setDisplay(d, 'radius', 5),
    setDisplay(d, 'intensity', 0.2),
    setUi(d, 'matrixBasis', 'medicoes'),
    setUi(d, 'rankSort', { col: 'nImp', dir: 'desc' }),
    setUi(d, 'rankSort', { col: 'dom', dir: 'asc' }),
    setFilter(d, 'eixos', [1]),
  ];
  for (const v of variants) roundTrip(v);
});

test('invalid pieces are ignored individually and reported', () => {
  const cases = [
    ['foo=1', 'foo'], ['gap=x', 'gap'], ['lim=1;0,5;2;4', 'lim'], ['lim=0,5;1', 'lim'],
    ['trc=99', 'trc'], ['sent=5', 'sent'], ['cls=7', 'cls'], ['eixo=3', 'eixo'],
    ['de=-5', 'de'], [`de=${ctx.tMax + 10}`, 'de'], ['raio=99', 'raio'], ['int=9', 'int'],
    ['met=x', 'met'], ['modo=y', 'modo'], ['mtx=x', 'mtx'], ['ord=foo:asc', 'ord'],
    ['ord=dom:up', 'ord'], ['calor=2', 'calor'], ['of=1;2', 'of'], ['sent=', 'sent'],
  ];
  for (const [frag, key] of cases) {
    const r = parseHash('#' + frag + '&vmax=70&fixmax=90', ctx);
    assert.ok(r.ignored.includes(key), frag);
    if (key !== 'fixmax') {
      assert.equal(r.state.params.gps.maxSpeedKmh, 70, frag);
      assert.equal(r.state.params.gps.maxFixGapS, 90, frag);
    }
  }
  const r = parseHash(`#de=${ctx.tMin + 5000}&ate=${ctx.tMin + 1000}`, ctx);
  assert.deepEqual(r.ignored, ['ate']);
  assert.equal(r.state.filters.tTo, null);
});

test('garbage never throws', () => {
  for (const h of ['', '#', '#&&&', '#=', '#lim', '%E0%A4%A', undefined, null, 42, '#%', '#a=%E0%A4%A&lim=%zz']) {
    const r = parseHash(h, ctx);
    assert.ok(r.state && Array.isArray(r.ignored));
  }
  let seed = 12345;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789=&;,:%#-+. ';
  const keys = ['lim', 'of', 'gap', 'sent', 'cls', 'de', 'ord', 'mtx', 'raio'];
  for (let i = 0; i < 200; i++) {
    let h = '#';
    const len = Math.floor(rnd() * 40);
    for (let j = 0; j < len; j++) {
      if (rnd() < 0.15) h += keys[Math.floor(rnd() * keys.length)] + '=';
      h += alphabet[Math.floor(rnd() * alphabet.length)];
    }
    const r = parseHash(h, ctx);
    assert.ok(r.state && Array.isArray(r.ignored), h);
    serialize(r.state);
  }
});

test('percent-encoded input is decoded', () => {
  const r = parseHash('lim=0%2C5%3B1%3B2%3B4&sent=0', ctx);
  assert.deepEqual(r.ignored, []);
  assert.equal(r.state.filters.sentidos[0], 0);
  const t = parseHash('#lim=0%2C5%3B1%3B2%3B3%2C5', ctx);
  assert.deepEqual(t.state.params.thresholds_g, [0.5, 1, 2, 3.5]);
});

test('urlstate.js is pure (no DOM globals)', () => {
  const src = readFileSync(new URL('../../site/js/app/urlstate.js', import.meta.url), 'utf8');
  assert.ok(!/\b(document|window|location|URLSearchParams)\b/.test(src.replace(/\/\/.*$/gm, '')));
});
