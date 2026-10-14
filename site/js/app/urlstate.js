// Pure module: no DOM/window/location. main.js passes the hash string in.
// Compact, human-readable hash (#lim=0,5;1;2;4&sent=0&...) with only non-default keys.
import { DEFAULT_PARAMS, DEFAULT_GPS } from '../core/defaults.js';
import { parseDecimal } from './format.js';
import {
  defaultState, setThresholdText, setOffsetText, setOffsetMode, setAnalysisText,
  setFilter, setDisplay, setUi, HEAT_METRICS, RADIUS_RANGE, INTENSITY_RANGE,
} from './state.js';

const KEY_ORDER = [
  'lim', 'of', 'gap', 'salto', 'vmax', 'fixmax', 'sent', 'trc', 'eixo', 'cls',
  'de', 'ate', 'modo', 'met', 'raio', 'int', 'calor', 'mtx', 'ord',
];
const ANALYSIS_TEXT_KEYS = { gap: 'gap', salto: 'salto', vmax: 'vmax', fixmax: 'fixmax' };
const MTX_OUT = { medicoes: 'med', pontos: 'pto' };
const MTX_IN = { imp: 'impactos', med: 'medicoes', pto: 'pontos' };

const numText = (x) => String(x).replace('.', ',');

export function hashContext(run) {
  return {
    nSentidos: run.sentidos ? run.sentidos.length : 1,
    nTrechos: run.trechoNames.length,
    tMin: run.tMs[0],
    tMax: run.tMs[run.n - 1],
  };
}

export function serialize(state) {
  const { params: p, filters: f, display: d, ui } = state;
  const out = [];
  const add = (k, v) => out.push(k + '=' + v);
  const sameLim = p.thresholds_g.length === DEFAULT_PARAMS.thresholds_g.length
    && p.thresholds_g.every((v, i) => v === DEFAULT_PARAMS.thresholds_g[i]);
  if (!sameLim) add('lim', p.thresholds_g.map(numText).join(';'));
  if (p.offset.mode === 'manual') add('of', p.offset.g.map(numText).join(';'));
  if (p.gap !== DEFAULT_PARAMS.gap) add('gap', p.gap);
  if (p.maxJumpMs !== DEFAULT_PARAMS.maxJumpMs) add('salto', numText(p.maxJumpMs / 1000));
  if (p.gps.maxSpeedKmh !== DEFAULT_GPS.maxSpeedKmh) add('vmax', numText(p.gps.maxSpeedKmh));
  if (p.gps.maxFixGapS !== DEFAULT_GPS.maxFixGapS) add('fixmax', numText(p.gps.maxFixGapS));
  if (f.sentidos.length) add('sent', f.sentidos.join(','));
  if (f.trechos.length) add('trc', f.trechos.join(','));
  if (f.eixos.length) add('eixo', f.eixos.join(','));
  if (f.classes.length) add('cls', f.classes.join(','));
  if (f.tFrom !== null) add('de', Math.round(f.tFrom));
  if (f.tTo !== null) add('ate', Math.round(f.tTo));
  if (d.valueMode === 'medido') add('modo', 'med');
  if (d.heatMetric !== 'dom') add('met', d.heatMetric);
  if (d.radius !== 15) add('raio', numText(d.radius));
  if (d.intensity !== 1) add('int', numText(d.intensity));
  if (ui.heat) add('calor', 1);
  if (ui.matrixBasis !== 'impactos') add('mtx', MTX_OUT[ui.matrixBasis]);
  if (ui.rankSort.col !== 'dom' || ui.rankSort.dir !== 'desc') add('ord', ui.rankSort.col + ':' + ui.rankSort.dir);
  return out.join('&');
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function parseIndexList(val, bound) {
  const parts = val.split(',');
  const nums = parts.map((x) => (/^\d+$/.test(x) ? Number(x) : NaN));
  if (!nums.length || !nums.every((n) => Number.isInteger(n) && n < bound)) throw new Error('lista inválida');
  return nums;
}

function parseTime(val, ctx) {
  if (!/^\d+$/.test(val)) throw new Error('tempo inválido');
  const t = Number(val);
  if (!(t >= ctx.tMin && t <= ctx.tMax)) throw new Error('tempo fora da corrida');
  return t;
}

function parseRanged(val, [lo, hi]) {
  const v = parseDecimal(val);
  if (!Number.isFinite(v) || v < lo || v > hi) throw new Error('fora da faixa');
  return v;
}

function applyKey(s, key, val, ctx) {
  switch (key) {
    case 'lim': {
      const parts = val.split(';');
      if (parts.length !== s.params.thresholds_g.length) throw new Error('limiares');
      let t = s;
      parts.forEach((x, i) => { t = setThresholdText(t, i, x); });
      if (t.inputs.thresholdError !== null) throw new Error('limiares');
      return t;
    }
    case 'of': {
      const parts = val.split(';');
      if (parts.length !== 3) throw new Error('offset');
      let t = s;
      parts.forEach((x, i) => { t = setOffsetText(t, i, x); });
      t = setOffsetMode(t, 'manual');
      if (t.inputs.offsetError !== null) throw new Error('offset');
      return t;
    }
    case 'gap': case 'salto': case 'vmax': case 'fixmax': {
      const t = setAnalysisText(s, ANALYSIS_TEXT_KEYS[key], val);
      if (t.inputs.analysisErrors[key] !== null) throw new Error(key);
      return t;
    }
    case 'sent': return setFilter(s, 'sentidos', parseIndexList(val, ctx.nSentidos));
    case 'trc': return setFilter(s, 'trechos', parseIndexList(val, ctx.nTrechos));
    case 'eixo': return setFilter(s, 'eixos', parseIndexList(val, 3));
    case 'cls': return setFilter(s, 'classes', parseIndexList(val, s.params.thresholds_g.length + 1));
    case 'de': {
      const t = parseTime(val, ctx);
      if (s.filters.tTo !== null && t > s.filters.tTo) throw new Error('de > ate');
      return setFilter(s, 'tFrom', t);
    }
    case 'ate': {
      const t = parseTime(val, ctx);
      if (s.filters.tFrom !== null && t < s.filters.tFrom) throw new Error('ate < de');
      return setFilter(s, 'tTo', t);
    }
    case 'modo':
      if (val === 'med') return setDisplay(s, 'valueMode', 'medido');
      if (val === 'din') return setDisplay(s, 'valueMode', 'dinamico');
      throw new Error('modo');
    case 'met':
      if (!HEAT_METRICS.includes(val)) throw new Error('met');
      return setDisplay(s, 'heatMetric', val);
    case 'raio': return setDisplay(s, 'radius', parseRanged(val, RADIUS_RANGE));
    case 'int': return setDisplay(s, 'intensity', parseRanged(val, INTENSITY_RANGE));
    case 'calor':
      if (val !== '0' && val !== '1') throw new Error('calor');
      return setUi(s, 'heat', val === '1');
    case 'mtx':
      if (!Object.hasOwn(MTX_IN, val)) throw new Error('mtx');
      return setUi(s, 'matrixBasis', MTX_IN[val]);
    case 'ord': {
      const [col, dir, extra] = val.split(':');
      if (extra !== undefined) throw new Error('ord');
      return setUi(s, 'rankSort', { col, dir });
    }
    default:
      throw new Error('chave desconhecida');
  }
}

export function parseHash(hash, ctx) {
  const c = {
    nSentidos: Infinity, nTrechos: Infinity, tMin: -Infinity, tMax: Infinity, ...(ctx || {}),
  };
  let state = defaultState();
  const ignored = [];
  const map = new Map();
  try {
    const raw = typeof hash === 'string' ? hash.replace(/^#/, '') : '';
    for (const part of raw.split('&')) {
      if (part === '') continue;
      const i = part.indexOf('=');
      const k = safeDecode(i < 0 ? part : part.slice(0, i));
      const v = i < 0 ? '' : safeDecode(part.slice(i + 1));
      map.set(k, v);
    }
  } catch {
    return { state, ignored: ['#'] };
  }
  for (const k of map.keys()) {
    if (!KEY_ORDER.includes(k)) ignored.push(k);
  }
  for (const key of KEY_ORDER) {
    if (!map.has(key)) continue;
    try {
      state = applyKey(state, key, map.get(key), c);
    } catch {
      ignored.push(key);
    }
  }
  return { state, ignored };
}
