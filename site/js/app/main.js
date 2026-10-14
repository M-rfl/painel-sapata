// Entry point: fetch JSON -> decodeRun -> store -> memoized analyze -> buildView -> render panels.
import { decodeRun } from '../core/data.js';
import { analyze } from '../core/engine.js';
import { buildView } from '../core/view.js';
import { meansMaxima, axisStatsTable } from '../core/stats.js';
import { qualitySummary } from '../core/quality.js';
import { createStore, defaultState, paramsKey } from './state.js';
import { fmtDateTime } from './format.js';
import { T } from './i18n.js';
import { render as renderOverview } from './panels/overview.js';
import { render as renderClasses } from './panels/classes.js';
import { render as renderStats } from './panels/stats.js';
import { render as renderQuality } from './panels/quality.js';
import { createLink } from './link.js';
import { mountCharts } from './panels/charts.js';
import { mountControls, renderControls } from './panels/controls.js';

const DATA_URL = 'data/run-2026-10-02-l4-t102.json';

const PANELS = [
  ['overview', renderOverview],
  ['classes', renderClasses],
  ['stats', renderStats],
  ['quality', renderQuality],
];

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

async function start() {
  let run;
  try {
    const resp = await fetch(DATA_URL);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    run = decodeRun(await resp.json());
  } catch (err) {
    console.error(err);
    setStatus(T.loadError);
    return;
  }

  document.getElementById('title').textContent = run.meta.title;
  document.getElementById('run-date').textContent = fmtDateTime(run.meta.t0);

  const quality = qualitySummary(run, null);
  const store = createStore(defaultState());

  const link = createLink();
  const charts = mountCharts(document.getElementById('charts'), link, run);

  let memoKey = null;
  let analysis = null;

  function update() {
    const state = store.get();
    const key = paramsKey(state.params);
    if (key !== memoKey) {
      const t0 = performance.now();
      analysis = analyze(run, state.params);
      memoKey = key;
      // Pitfall 7: if this exceeds ~50 ms, Plan 06 coalesces updates with requestAnimationFrame.
      console.debug('analyze ms', (performance.now() - t0).toFixed(1));
    }
    const view = buildView(run, analysis, state.filters);
    const stats = {
      mm: meansMaxima(run, analysis, view.mask),
      table: axisStatsTable(run, analysis, view.mask, state.display.valueMode),
    };
    const ctx = { run, analysis, view, state, stats, quality: { ...quality, naoClassificadas: analysis.naoClassificadas } };
    for (const [id, render] of PANELS) render(document.getElementById(id), ctx);
    charts.render(ctx);
    renderControls(state);
  }

  mountControls(document.getElementById('controls'), store, run);
  store.subscribe(update);
  // Debug handle for manual inspection in the console.
  window.__painel = { store, run, link };
  setStatus('');
  update();
}

start();
