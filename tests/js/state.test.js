import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, DEFAULT_PARAMS } from '../../site/js/core/index.js';
import {
  defaultState, setThresholdText, setFilter, setDisplay, resetState, paramsKey, createStore,
  setOffsetMode, setOffsetText, setAnalysisText, setUi, offsetPrefill,
} from '../../site/js/app/state.js';
import { halfUp } from '../../site/js/core/dynamics.js';
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
    params: {
      thresholds_g: [0.5, 1, 2, 4], offset: { mode: 'median' }, gap: 0, maxJumpMs: 2000,
      gps: { maxSpeedKmh: 50, maxFixGapS: 120 },
    },
    inputs: {
      thresholdText: ['0,5', '1', '2', '4'], thresholdError: null, thresholdFieldErrors: [false, false, false, false],
      offsetMode: 'median', offsetText: ['', '', ''], offsetError: null,
      gapText: '0', saltoText: '2', vmaxText: '50', fixmaxText: '120',
      analysisErrors: { gap: null, salto: null, vmax: null, fixmax: null },
    },
    filters: { sentidos: [], trechos: [], eixos: [], classes: [], tFrom: null, tTo: null },
    display: { valueMode: 'dinamico', heatMetric: 'dom', radius: 15, intensity: 1 },
    ui: { heat: false, matrixBasis: 'impactos', rankSort: { col: 'dom', dir: 'desc' } },
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

test('setOffsetMode and setOffsetText', () => {
  const s = deepFreeze(defaultState());
  const pre = ['0,0459', '-0,0186', '-0,9854'];
  const a = setOffsetMode(s, 'manual', pre);
  assert.deepEqual(a.inputs.offsetText, pre);
  assert.deepEqual(a.params.offset, { mode: 'manual', g: [0.0459, -0.0186, -0.9854] });
  assert.equal(a.inputs.offsetMode, 'manual');
  const typed = setOffsetText(setOffsetMode(s, 'median'), 0, '1');
  assert.equal(typed.params.offset.mode, 'median');
  const keep = setOffsetMode(typed, 'manual', pre);
  assert.equal(keep.inputs.offsetText[0], '1');
  assert.equal(keep.inputs.offsetText[1], '');
  const m = setOffsetMode(deepFreeze(a), 'median');
  assert.deepEqual(m.params.offset, { mode: 'median' });
  assert.equal(m.inputs.offsetError, null);
  assert.deepEqual(m.inputs.offsetText, pre);
  assert.throws(() => setOffsetMode(s, 'x'));
  for (const bad of ['abc', '17', '-16,5']) {
    const b = setOffsetText(deepFreeze(a), 1, bad);
    assert.deepEqual(b.params.offset, a.params.offset);
    assert.equal(typeof b.inputs.offsetError, 'string');
  }
  const ok = setOffsetText(deepFreeze(a), 1, '-0,5');
  assert.deepEqual(ok.params.offset.g, [0.0459, -0.5, -0.9854]);
  assert.equal(ok.inputs.offsetError, null);
});

test('setAnalysisText', () => {
  const s = deepFreeze(defaultState());
  assert.equal(setAnalysisText(s, 'gap', '3').params.gap, 3);
  for (const bad of ['1,5', '-1', '1001']) {
    const r = setAnalysisText(s, 'gap', bad);
    assert.equal(r.params.gap, 0);
    assert.equal(typeof r.inputs.analysisErrors.gap, 'string');
    assert.equal(r.inputs.gapText, bad);
  }
  assert.equal(setAnalysisText(s, 'salto', '2,5').params.maxJumpMs, 2500);
  for (const bad of ['0', '3601']) assert.equal(typeof setAnalysisText(s, 'salto', bad).inputs.analysisErrors.salto, 'string');
  assert.equal(setAnalysisText(s, 'vmax', '60').params.gps.maxSpeedKmh, 60);
  for (const bad of ['0', '301']) assert.equal(typeof setAnalysisText(s, 'vmax', bad).inputs.analysisErrors.vmax, 'string');
  assert.equal(setAnalysisText(s, 'fixmax', '90').params.gps.maxFixGapS, 90);
  for (const bad of ['0', '3601']) assert.equal(typeof setAnalysisText(s, 'fixmax', bad).inputs.analysisErrors.fixmax, 'string');
  const fixed = setAnalysisText(setAnalysisText(s, 'gap', 'x'), 'gap', '2');
  assert.equal(fixed.inputs.analysisErrors.gap, null);
  assert.equal(fixed.params.gap, 2);
  assert.throws(() => setAnalysisText(s, 'nope', '1'));
});

test('setUi', () => {
  const s = deepFreeze(defaultState());
  assert.equal(setUi(s, 'heat', true).ui.heat, true);
  assert.equal(setUi(s, 'matrixBasis', 'medicoes').ui.matrixBasis, 'medicoes');
  assert.deepEqual(setUi(s, 'rankSort', { col: 'trecho', dir: 'asc' }).ui.rankSort, { col: 'trecho', dir: 'asc' });
  assert.throws(() => setUi(s, 'matrixBasis', 'x'));
  assert.throws(() => setUi(s, 'rankSort', { col: 'x', dir: 'asc' }));
  assert.throws(() => setUi(s, 'rankSort', { col: 'dom', dir: 'up' }));
  assert.throws(() => setUi(s, 'heat', 1));
  assert.throws(() => setUi(s, 'nope', 1));
});

test('offsetPrefill round-trips doubled LSB and reproduces run 1', () => {
  const back = (txts) => txts.map((t) => halfUp(Number(t.replace(',', '.')) * 4096));
  assert.deepEqual(back(offsetPrefill([92, -38, -4036])), [92, -38, -4036]);
  const run = loadRun1();
  const base = analyze(run, DEFAULT_PARAMS);
  const real = offsetPrefill(base.med2);
  assert.deepEqual(back(real), Array.from(base.med2));
  const st = setOffsetMode(defaultState(), 'manual', real);
  assert.equal(st.inputs.offsetError, null);
  const man = analyze(run, st.params);
  assert.deepEqual(man.classCounts, base.classCounts);
  assert.deepEqual(man.eventos, base.eventos);
  assert.deepEqual(man.impactos, base.impactos);
  assert.equal(man.conforme.ok, false);
});

test('paramsKey covers offset.g, gap, jump, gps; reset clears all slices', () => {
  const k = paramsKey(defaultState().params);
  let s = defaultState();
  for (const [key, txt] of [['gap', '1'], ['salto', '3'], ['vmax', '60'], ['fixmax', '60']]) {
    assert.notEqual(paramsKey(setAnalysisText(s, key, txt).params), k, key);
  }
  const m1 = setOffsetMode(s, 'manual', ['0', '0', '-1']);
  const m2 = setOffsetText(m1, 0, '0,1');
  assert.notEqual(paramsKey(m1.params), paramsKey(m2.params));
  s = setUi(setAnalysisText(m2, 'gap', '4'), 'heat', true);
  assert.deepEqual(resetState(), defaultState());
});
