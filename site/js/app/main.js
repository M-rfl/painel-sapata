// Entry point: fetch JSON -> decodeRun -> store -> memoized analyze -> buildView -> render panels.
import { decodeRun } from '../core/data.js';
import { analyze } from '../core/engine.js';
import { buildView } from '../core/view.js';
import { meansMaxima, axisStatsTable } from '../core/stats.js';
import { qualitySummary } from '../core/quality.js';
import { createStore, defaultState, paramsKey } from './state.js';
import { fmtDateTime } from './format.js';
import { T } from './i18n.js';

const DATA_URL = 'data/run-2026-10-02-l4-t102.json';

const PANELS = [];

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
  }

  // Plan 11-06: controls mount here (mountControls).
  store.subscribe(update);
  // Debug handle for manual inspection in the console.
  window.__painel = { store, run };
  setStatus('');
  update();
}

start();
