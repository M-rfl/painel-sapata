// Pure module: no DOM/window.
// Single state model (params / inputs / filters / display) with pure transitions.
import { DEFAULT_PARAMS } from '../core/defaults.js';
import { parseDecimal, validateThresholds, fmtThreshold } from './format.js';

export const HEAT_METRICS = ['dom', 'ax', 'ay', 'az', 'resDin'];
export const VALUE_MODES = ['medido', 'dinamico'];
export const RADIUS_RANGE = [5, 40];
export const INTENSITY_RANGE = [0.2, 3];

const LIST_FILTERS = ['sentidos', 'trechos', 'eixos', 'classes'];
const TIME_FILTERS = ['tFrom', 'tTo'];

export function defaultState() {
  const n = DEFAULT_PARAMS.thresholds_g.length;
  return {
    params: {
      thresholds_g: [...DEFAULT_PARAMS.thresholds_g],
      offset: { ...DEFAULT_PARAMS.offset },
      gap: DEFAULT_PARAMS.gap,
      maxJumpMs: DEFAULT_PARAMS.maxJumpMs,
    },
    inputs: {
      thresholdText: DEFAULT_PARAMS.thresholds_g.map(fmtThreshold),
      thresholdError: null,
      thresholdFieldErrors: new Array(n).fill(false),
    },
    filters: { sentidos: [], trechos: [], eixos: [], classes: [], tFrom: null, tTo: null },
    display: { valueMode: 'dinamico', heatMetric: 'dom', radius: 15, intensity: 1 },
  };
}

export function setThresholdText(state, idx, text) {
  const thresholdText = state.inputs.thresholdText.slice();
  thresholdText[idx] = text;
  const parsed = thresholdText.map(parseDecimal);
  const v = validateThresholds(parsed);
  return {
    ...state,
    params: v.ok ? { ...state.params, thresholds_g: parsed } : state.params,
    inputs: {
      thresholdText,
      thresholdError: v.ok ? null : v.error,
      thresholdFieldErrors: v.fieldErrors,
    },
  };
}

export function setFilter(state, key, value) {
  let v;
  if (LIST_FILTERS.includes(key)) {
    v = [...new Set(Array.from(value, Number))].sort((a, b) => a - b);
  } else if (TIME_FILTERS.includes(key)) {
    v = value === null ? null : Number(value);
  } else {
    throw new Error('filtro desconhecido: ' + key);
  }
  return { ...state, filters: { ...state.filters, [key]: v } };
}

const clamp = (x, [lo, hi]) => Math.min(hi, Math.max(lo, Number(x)));

export function setDisplay(state, key, value) {
  let v;
  switch (key) {
    case 'valueMode':
      if (!VALUE_MODES.includes(value)) throw new Error('valueMode inválido: ' + value);
      v = value;
      break;
    case 'heatMetric':
      if (!HEAT_METRICS.includes(value)) throw new Error('heatMetric inválido: ' + value);
      v = value;
      break;
    case 'radius':
      v = clamp(value, RADIUS_RANGE);
      break;
    case 'intensity':
      v = clamp(value, INTENSITY_RANGE);
      break;
    default:
      throw new Error('opção de exibição desconhecida: ' + key);
  }
  return { ...state, display: { ...state.display, [key]: v } };
}

export function resetState() {
  return defaultState();
}

export function paramsKey(params) {
  return JSON.stringify({
    thresholds_g: params.thresholds_g,
    offset: params.offset,
    gap: params.gap,
    maxJumpMs: params.maxJumpMs,
  });
}

export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  const emit = () => { for (const fn of [...subs]) fn(state); };
  return {
    get: () => state,
    set(updater) { state = updater(state); emit(); },
    reset() { state = resetState(); emit(); },
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}
