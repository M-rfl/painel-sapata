// Control column: thresholds, filters, display options, reset.
// Built once by mountControls; renderControls only syncs values/checked/error states from state.
// Controls only change state; main.js recomputes.
import { CLASS_NAMES } from '../../core/defaults.js';
import { h } from '../dom.js';
import { T } from '../i18n.js';
import { infoBtn } from '../info.js';
import { fmtTime, fmtDate } from '../format.js';
import {
  setThresholdText, setFilter, setDisplay,
  HEAT_METRICS, RADIUS_RANGE, INTENSITY_RANGE,
} from '../state.js';

const THRESHOLD_LABELS = ['Leve ≥', 'Moderado ≥', 'Severo ≥', 'Crítico ≥'];
const AXIS_LABELS = ['X Longitudinal', 'Y Lateral', 'Z Vertical'];
const CLASS_COLORS = ['--normal', '--leve', '--moderado', '--severo', '--critico'];
const METRIC_LABELS = { dom: T.dDom, ax: T.dAx, ay: T.dAy, az: T.dAz, resDin: T.dResDin };
const NOTE_SENTIDO = 'Divisão por sentido detectada pelas estações (a planilha usa a divisão por arquivo).';
const CLEAR = 'limpar';
const FROM = 'De';
const TO = 'Até';
const GAP_MS = 1000;

let refs = null;

/**
 * Clock label for an elapsed-ms value: wall clock = Date.parse(meta.t0) + (tMs - run.tMs[0]),
 * shown in America/Sao_Paulo by the format helpers.
 */
function clockLabel(run, tMs) {
  const base = Date.parse(run.meta.t0);
  const d = new Date(base + (tMs - run.tMs[0]));
  return fmtDate(d) + ' ' + fmtTime(d);
}

function group(title, infoKey, ...children) {
  return h('fieldset', { class: 'ctl-group' }, h('legend', null, title, infoBtn(infoKey, title)), ...children);
}

// Info button kept outside <label> so activating it never toggles the control.
function line(control, infoKey, name) {
  return h('div', { class: 'ctl-line' }, control, infoBtn(infoKey, name));
}

function checkbox(label, onChange, extra) {
  const input = h('input', { type: 'checkbox', onChange });
  const lab = h('label', { class: 'ctl-check' }, input, ' ', label);
  if (extra) lab.style.setProperty('--chip', extra);
  return { input, lab };
}

function clearLink(onClick) {
  return h('button', { type: 'button', class: 'ctl-clear', onClick }, CLEAR);
}

export function mountControls(el, store, run) {
  while (el.firstChild) el.removeChild(el.firstChild);
  const r = { run, thr: [], sentido: [], trecho: new Map(), eixo: [], classe: [] };

  const toggleList = (key, value, on) => store.set((s) => {
    const cur = new Set(s.filters[key]);
    if (on) cur.add(value); else cur.delete(value);
    return setFilter(s, key, [...cur]);
  });
  const clearList = (key) => store.set((s) => setFilter(s, key, []));

  // Thresholds
  const thrRow = h('div', { class: 'ctl-thr' });
  THRESHOLD_LABELS.forEach((label, i) => {
    const input = h('input', {
      type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': label + ' (g)',
      onInput: (ev) => store.set((s) => setThresholdText(s, i, ev.target.value)),
    });
    r.thr.push(input);
    thrRow.appendChild(h('label', null, h('span', null, label + ' (g)'), input));
  });
  r.thrError = h('p', { class: 'ctl-error', role: 'alert' });
  const gThr = group(T.secThresholds, 'thresholds', thrRow, r.thrError);

  // Sentido
  const gSent = group(T.fSentido, 'fSentido');
  run.sentidos.forEach((s, i) => {
    const c = checkbox(s.name, (ev) => toggleList('sentidos', i, ev.target.checked));
    r.sentido.push(c.input);
    gSent.appendChild(c.lab);
  });
  gSent.appendChild(clearLink(() => clearList('sentidos')));
  gSent.appendChild(h('p', { class: 'muted' }, NOTE_SENTIDO));

  // Trecho grouped by sentido, route order
  const gTrecho = group(T.fTrecho, 'fTrecho');
  run.sentidos.forEach((s, si) => {
    const list = run.trechos
      .map((t, idx) => ({ ...t, idx }))
      .filter((t) => t.sentido === si)
      .sort((a, b) => a.order - b.order);
    if (!list.length) return;
    gTrecho.appendChild(h('h4', null, s.name));
    for (const t of list) {
      const c = checkbox(t.name, (ev) => toggleList('trechos', t.idx, ev.target.checked));
      r.trecho.set(t.idx, c.input);
      gTrecho.appendChild(c.lab);
    }
  });
  gTrecho.appendChild(clearLink(() => clearList('trechos')));

  // Eixo dominante
  const gEixo = group(T.fEixo, 'fEixo');
  AXIS_LABELS.forEach((label, i) => {
    const c = checkbox(label, (ev) => toggleList('eixos', i, ev.target.checked));
    c.lab.classList.add('chip');
    r.eixo.push(c.input);
    gEixo.appendChild(c.lab);
  });
  gEixo.appendChild(clearLink(() => clearList('eixos')));

  // Classe
  const gClasse = group(T.fClasse, 'fClasse');
  CLASS_NAMES.forEach((name, i) => {
    const c = checkbox(name, (ev) => toggleList('classes', i, ev.target.checked), `var(${CLASS_COLORS[i]})`);
    c.lab.classList.add('chip', 'chip-class');
    r.classe.push(c.input);
    gClasse.appendChild(c.lab);
  });
  gClasse.appendChild(clearLink(() => clearList('classes')));

  // Time window (basis: elapsed ms, step 1 s; full range = null)
  const tMin = run.tMs[0];
  const tMax = run.tMs[run.n - 1];
  r.tMin = tMin;
  r.tMax = tMax;
  const mkRange = (onInput) => h('input', {
    type: 'range', min: tMin, max: tMax, step: GAP_MS, value: tMin, onInput,
  });
  r.tFrom = mkRange((ev) => store.set((s) => {
    let v = Number(ev.target.value);
    const hi = s.filters.tTo ?? tMax;
    if (v > hi) v = hi;
    return setFilter(s, 'tFrom', v <= tMin ? null : v);
  }));
  r.tTo = mkRange((ev) => store.set((s) => {
    let v = Number(ev.target.value);
    const lo = s.filters.tFrom ?? tMin;
    if (v < lo) v = lo;
    return setFilter(s, 'tTo', v >= tMax ? null : v);
  }));
  r.tTo.value = tMax;
  r.tFromLabel = h('span', { class: 'ctl-val' });
  r.tToLabel = h('span', { class: 'ctl-val' });
  const gTempo = group(
    T.fTempo, 'fTempo',
    h('label', { class: 'ctl-range' }, h('span', null, FROM), r.tFrom, r.tFromLabel),
    h('label', { class: 'ctl-range' }, h('span', null, TO), r.tTo, r.tToLabel),
    h('p', { class: 'muted' }, 'Horário de Brasília (America/Sao_Paulo).'),
  );

  // Display
  r.mode = {};
  const modeRow = h('div', { class: 'ctl-modes' });
  for (const [val, label] of [['medido', T.dMedido], ['dinamico', T.dDinamico]]) {
    const input = h('input', {
      type: 'radio', name: 'valueMode', value: val,
      onChange: () => store.set((s) => setDisplay(s, 'valueMode', val)),
    });
    r.mode[val] = input;
    modeRow.appendChild(h('label', { class: 'ctl-check' }, input, ' ', label));
  }
  r.metric = h('select', {
    onChange: (ev) => store.set((s) => setDisplay(s, 'heatMetric', ev.target.value)),
  }, HEAT_METRICS.map((m) => h('option', { value: m }, METRIC_LABELS[m])));
  r.radius = h('input', {
    type: 'range', min: RADIUS_RANGE[0], max: RADIUS_RANGE[1], step: 1,
    onInput: (ev) => store.set((s) => setDisplay(s, 'radius', ev.target.value)),
  });
  r.intensity = h('input', {
    type: 'range', min: INTENSITY_RANGE[0], max: INTENSITY_RANGE[1], step: 0.1,
    onInput: (ev) => store.set((s) => setDisplay(s, 'intensity', ev.target.value)),
  });
  r.radiusLabel = h('span', { class: 'ctl-val' });
  r.intensityLabel = h('span', { class: 'ctl-val' });
  const gDisp = group(
    T.secDisplay, 'display',
    h('div', null, h('span', { class: 'ctl-sub' }, T.dValores), infoBtn('dValores', T.dValores), modeRow),
    line(h('label', { class: 'ctl-row' }, h('span', null, T.dMetrica), r.metric), 'dMetrica', T.dMetrica),
    line(h('label', { class: 'ctl-range' }, h('span', null, T.dRaio), r.radius, r.radiusLabel), 'dRaio', T.dRaio),
    line(h('label', { class: 'ctl-range' }, h('span', null, T.dIntensidade), r.intensity, r.intensityLabel), 'dIntensidade', T.dIntensidade),
    h('p', { class: 'muted' }, T.dNota),
  );

  const resetBtn = h('button', {
    type: 'button', class: 'ctl-reset', onClick: () => store.reset(),
  }, T.reset);

  el.appendChild(gThr);
  el.appendChild(gSent);
  el.appendChild(gTrecho);
  el.appendChild(gEixo);
  el.appendChild(gClasse);
  el.appendChild(gTempo);
  el.appendChild(gDisp);
  el.appendChild(resetBtn);

  refs = r;
  renderControls(store.get());
}

export function renderControls(state) {
  const r = refs;
  if (!r) return;
  const { inputs, filters, display } = state;

  r.thr.forEach((input, i) => {
    // Never rewrite the field being typed in when it already matches state (keeps caret).
    if (input.value !== inputs.thresholdText[i]) input.value = inputs.thresholdText[i];
    const bad = !!inputs.thresholdFieldErrors[i];
    input.classList.toggle('field-error', bad);
    if (bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  });
  r.thrError.textContent = inputs.thresholdError || '';

  r.sentido.forEach((c, i) => { c.checked = filters.sentidos.includes(i); });
  for (const [idx, c] of r.trecho) c.checked = filters.trechos.includes(idx);
  r.eixo.forEach((c, i) => { c.checked = filters.eixos.includes(i); });
  r.classe.forEach((c, i) => { c.checked = filters.classes.includes(i); });

  const from = filters.tFrom ?? r.tMin;
  const to = filters.tTo ?? r.tMax;
  r.tFrom.value = from;
  r.tTo.value = to;
  r.tFromLabel.textContent = clockLabel(r.run, from);
  r.tToLabel.textContent = clockLabel(r.run, to);

  for (const [val, c] of Object.entries(r.mode)) c.checked = display.valueMode === val;
  r.metric.value = display.heatMetric;
  r.radius.value = display.radius;
  r.intensity.value = display.intensity;
  r.radiusLabel.textContent = String(display.radius);
  r.intensityLabel.textContent = String(display.intensity).replace('.', ',');
}
