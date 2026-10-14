// Pure module: no DOM/window.
// Single state model (params / inputs / filters / display) with pure transitions.
import { DEFAULT_PARAMS, DEFAULT_GPS } from '../core/defaults.js';
import { parseDecimal, parseSignedDecimal, validateThresholds, fmtThreshold } from './format.js';

export const HEAT_METRICS = ['dom', 'ax', 'ay', 'az', 'resDin'];
export const VALUE_MODES = ['medido', 'dinamico'];
export const RADIUS_RANGE = [5, 40];
export const INTENSITY_RANGE = [0.2, 3];

export const MATRIX_BASES = ['impactos', 'medicoes', 'pontos'];
export const RANK_SORT_KEYS = ['hora', 'trecho', 'sentido', 'eixo', 'dom', 'ax', 'ay', 'az', 'cls', 'nImp'];
export const ANALYSIS_KEYS = ['gap', 'salto', 'vmax', 'fixmax'];

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
      gps: { ...DEFAULT_GPS },
    },
    inputs: {
      thresholdText: DEFAULT_PARAMS.thresholds_g.map(fmtThreshold),
      thresholdError: null,
      thresholdFieldErrors: new Array(n).fill(false),
      offsetMode: 'median',
      offsetText: ['', '', ''],
      offsetError: null,
      gapText: String(DEFAULT_PARAMS.gap),
      saltoText: '2',
      vmaxText: String(DEFAULT_GPS.maxSpeedKmh),
      fixmaxText: String(DEFAULT_GPS.maxFixGapS),
      analysisErrors: { gap: null, salto: null, vmax: null, fixmax: null },
    },
    filters: { sentidos: [], trechos: [], eixos: [], classes: [], tFrom: null, tTo: null },
    display: { valueMode: 'dinamico', heatMetric: 'dom', radius: 15, intensity: 1 },
    ui: { heat: false, matrixBasis: 'impactos', rankSort: { col: 'dom', dir: 'desc' } },
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
      ...state.inputs,
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

const OFFSET_ERR = 'Informe os três offsets em g (ex.: -0,9854), entre -16 e 16.';

function parseOffsets(texts) {
  const g = texts.map(parseSignedDecimal);
  return g.every((x) => Number.isFinite(x) && Math.abs(x) <= 16) ? g : null;
}

export function setOffsetMode(state, mode, prefillText) {
  if (mode !== 'median' && mode !== 'manual') throw new Error('modo de offset inválido: ' + mode);
  if (mode === 'median') {
    return {
      ...state,
      params: { ...state.params, offset: { mode: 'median' } },
      inputs: { ...state.inputs, offsetMode: 'median', offsetError: null },
    };
  }
  const empty = state.inputs.offsetText.every((t) => String(t).trim() === '');
  const offsetText = empty && prefillText ? Array.from(prefillText, String) : state.inputs.offsetText.slice();
  const g = parseOffsets(offsetText);
  return {
    ...state,
    params: g ? { ...state.params, offset: { mode: 'manual', g } } : state.params,
    inputs: { ...state.inputs, offsetMode: 'manual', offsetText, offsetError: g ? null : OFFSET_ERR },
  };
}

export function setOffsetText(state, k, text) {
  if (!Number.isInteger(k) || k < 0 || k > 2) throw new Error('eixo de offset inválido: ' + k);
  const offsetText = state.inputs.offsetText.slice();
  offsetText[k] = text;
  if (state.inputs.offsetMode !== 'manual') {
    return { ...state, inputs: { ...state.inputs, offsetText } };
  }
  const g = parseOffsets(offsetText);
  return {
    ...state,
    params: g ? { ...state.params, offset: { mode: 'manual', g } } : state.params,
    inputs: { ...state.inputs, offsetText, offsetError: g ? null : OFFSET_ERR },
  };
}

const ANALYSIS_RULES = {
  gap: {
    textKey: 'gapText',
    error: 'O agrupamento deve ser um número inteiro de amostras entre 0 e 1000.',
    parse: (t) => (/^\d+$/.test(t.trim()) ? Number(t) : NaN),
    ok: (v) => v >= 0 && v <= 1000,
    apply: (p, v) => ({ ...p, gap: v }),
  },
  salto: {
    textKey: 'saltoText',
    error: 'O intervalo de separação deve estar entre 0,1 e 3600 s.',
    parse: parseDecimal,
    ok: (v) => v >= 0.1 && v <= 3600,
    apply: (p, v) => ({ ...p, maxJumpMs: Math.round(v * 1000) }),
  },
  vmax: {
    textKey: 'vmaxText',
    error: 'A velocidade máxima do GPS deve estar entre 1 e 300 km/h.',
    parse: parseDecimal,
    ok: (v) => v >= 1 && v <= 300,
    apply: (p, v) => ({ ...p, gps: { ...p.gps, maxSpeedKmh: v } }),
  },
  fixmax: {
    textKey: 'fixmaxText',
    error: 'O intervalo máximo entre fixes do GPS deve estar entre 1 e 3600 s.',
    parse: parseDecimal,
    ok: (v) => v >= 1 && v <= 3600,
    apply: (p, v) => ({ ...p, gps: { ...p.gps, maxFixGapS: v } }),
  },
};

export function setAnalysisText(state, key, text) {
  const r = ANALYSIS_RULES[key];
  if (!ANALYSIS_KEYS.includes(key) || !r) throw new Error('parâmetro de análise desconhecido: ' + key);
  const v = r.parse(String(text));
  const valid = Number.isFinite(v) && r.ok(v);
  return {
    ...state,
    params: valid ? r.apply(state.params, v) : state.params,
    inputs: {
      ...state.inputs,
      [r.textKey]: text,
      analysisErrors: { ...state.inputs.analysisErrors, [key]: valid ? null : r.error },
    },
  };
}

export function setUi(state, key, value) {
  let v;
  switch (key) {
    case 'heat':
      if (typeof value !== 'boolean') throw new Error('heat inválido: ' + value);
      v = value;
      break;
    case 'matrixBasis':
      if (!MATRIX_BASES.includes(value)) throw new Error('matrixBasis inválido: ' + value);
      v = value;
      break;
    case 'rankSort':
      if (!value || !RANK_SORT_KEYS.includes(value.col) || (value.dir !== 'asc' && value.dir !== 'desc')) {
        throw new Error('rankSort inválido');
      }
      v = { col: value.col, dir: value.dir };
      break;
    default:
      throw new Error('opção de interface desconhecida: ' + key);
  }
  return { ...state, ui: { ...state.ui, [key]: v } };
}

// Doubled-LSB medians -> g texts (6 dp so halfUp(g*4096) recovers the integer exactly).
export function offsetPrefill(med2) {
  return Array.from(med2, (m) => String(Number((m / 4096).toFixed(6))).replace('.', ','));
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
    gps: params.gps,
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
