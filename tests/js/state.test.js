import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, DEFAULT_PARAMS } from '../../site/js/core/index.js';
import {
  defaultState, setThresholdText, setFilter, setDisplay, resetState, paramsKey, createStore,
} from '../../site/js/app/state.js';
import { loadRun1 } from './helpers.js';

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

test('defaultState matches contract and is independent', () => {
  const s = defaultState();
  assert.deepEqual(s, {
    params: { thresholds_g: [0.5, 1, 2, 4], offset: { mode: 'median' }, gap: 0, maxJumpMs: 2000 },
    inputs: { thresholdText: ['0,5', '1', '2', '4'], thresholdError: null, thresholdFieldErrors: [false, false, false, false] },
    filters: { sentidos: [], trechos: [], eixos: [], classes: [], tFrom: null, tTo: null },
    display: { valueMode: 'dinamico', heatMetric: 'dom', radius: 15, intensity: 1 },
  });
  s.params.thresholds_g[0] = 9;
  s.params.offset.mode = 'x';
  assert.deepEqual(defaultState().params.thresholds_g, [0.5, 1, 2, 4]);
  assert.deepEqual(DEFAULT_PARAMS.thresholds_g, [0.5, 1, 2, 4]);
  assert.equal(DEFAULT_PARAMS.offset.mode, 'median');
});

test('setThresholdText valid and invalid', () => {
  const s = deepFreeze(defaultState());
  const a = setThresholdText(s, 0, '0,4');
  assert.deepEqual(a.params.thresholds_g, [0.4, 1, 2, 4]);
  assert.equal(a.inputs.thresholdError, null);
  assert.equal(a.inputs.thresholdText[0], '0,4');

  const b = setThresholdText(s, 1, '1,');
  assert.deepEqual(b.params.thresholds_g, [0.5, 1, 2, 4]);
  assert.equal(typeof b.inputs.thresholdError, 'string');
  assert.equal(b.inputs.thresholdFieldErrors[1], true);
  assert.equal(b.inputs.thresholdText[1], '1,');

  const c = setThresholdText(s, 2, '0,7');
  assert.deepEqual(c.params.thresholds_g, [0.5, 1, 2, 4]);
  assert.equal(c.inputs.thresholdError, 'Os limiares devem ser crescentes.');

  const d = setThresholdText(c, 2, '3');
  assert.deepEqual(d.params.thresholds_g, [0.5, 1, 3, 4]);
  assert.equal(d.inputs.thresholdError, null);
  assert.deepEqual(d.inputs.thresholdFieldErrors, [false, false, false, false]);
});

test('setFilter', () => {
  const s = deepFreeze(defaultState());
  const input = [3, 1, 3, 2];
  const a = setFilter(s, 'sentidos', input);
  assert.deepEqual(a.filters.sentidos, [1, 2, 3]);
  assert.notEqual(a.filters.sentidos, input);
  for (const k of ['trechos', 'eixos', 'classes']) {
    assert.deepEqual(setFilter(s, k, [2, 0]).filters[k], [0, 2]);
  }
  assert.equal(setFilter(s, 'tFrom', 1000).filters.tFrom, 1000);
  assert.equal(setFilter(setFilter(s, 'tTo', 5), 'tTo', null).filters.tTo, null);
  assert.throws(() => setFilter(s, 'nope', []), /filtro desconhecido: nope/);
});

test('setDisplay', () => {
  const s = deepFreeze(defaultState());
  assert.equal(setDisplay(s, 'valueMode', 'medido').display.valueMode, 'medido');
  assert.throws(() => setDisplay(s, 'valueMode', 'x'));
  for (const m of ['dom', 'ax', 'ay', 'az', 'resDin']) assert.equal(setDisplay(s, 'heatMetric', m).display.heatMetric, m);
  assert.throws(() => setDisplay(s, 'heatMetric', 'bogus'));
  assert.equal(setDisplay(s, 'radius', 1).display.radius, 5);
  assert.equal(setDisplay(s, 'radius', 99).display.radius, 40);
  assert.equal(setDisplay(s, 'intensity', 0).display.intensity, 0.2);
  assert.equal(setDisplay(s, 'intensity', 10).display.intensity, 3);
});

test('reset restores defaults and conforme', () => {
  let s = defaultState();
  s = setThresholdText(s, 0, '0,4');
  s = setFilter(s, 'sentidos', [1]);
  s = setFilter(s, 'trechos', [2, 3]);
  s = setDisplay(s, 'valueMode', 'medido');
  s = setDisplay(s, 'heatMetric', 'az');
  s = setDisplay(s, 'radius', 30);
  const run = loadRun1();
  assert.equal(analyze(run, s.params).conforme.ok, false);
  const r = resetState();
  assert.deepEqual(r, defaultState());
  assert.equal(analyze(run, r.params).conforme.ok, true);
});

test('paramsKey', () => {
  const a = defaultState().params;
  const b = defaultState().params;
  assert.equal(paramsKey(a), paramsKey(b));
  const c = setThresholdText(defaultState(), 0, '0,4').params;
  assert.notEqual(paramsKey(a), paramsKey(c));
});

test('createStore', () => {
  const store = createStore(defaultState());
  const seen = [];
  const unsub = store.subscribe((s) => seen.push(s));
  store.set((s) => setDisplay(s, 'radius', 25));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].display.radius, 25);
  assert.equal(store.get().display.radius, 25);
  store.reset();
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[1], defaultState());
  unsub();
  store.set((s) => setDisplay(s, 'radius', 10));
  assert.equal(seen.length, 2);
});
