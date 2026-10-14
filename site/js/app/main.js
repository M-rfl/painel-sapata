// Entry point: fetch JSON -> decodeRun -> store -> memoized analyze -> buildView -> render panels.
import { decodeRun } from '../core/data.js';
import { analyze } from '../core/engine.js';
import { buildView } from '../core/view.js';
import { applyGpsFilter, gpsKey } from '../core/gpsfilter.js';
import { meansMaxima, axisStatsTable } from '../core/stats.js';
import { qualitySummary } from '../core/quality.js';
import { createStore, defaultState, paramsKey } from './state.js';
import { createSession, createDisposers, isShareable } from './session.js';
import { parseHash, serialize, hashContext } from './urlstate.js';
import { fmtDateTime } from './format.js';
import { T } from './i18n.js';
import { render as renderOverview } from './panels/overview.js';
import { render as renderClasses } from './panels/classes.js';
import { render as renderStats } from './panels/stats.js';
import { render as renderQuality } from './panels/quality.js';
import { createLink } from './link.js';
import { mountCharts } from './panels/charts.js';
import { mountMap } from './panels/map.js';
import { mountMatrix } from './panels/matrix.js';
import { mountRanking } from './panels/ranking.js';
import { mountShare, showIgnoredNotice } from './panels/share.js';
import { mountReport } from './panels/report.js';
import { mountControls, renderControls } from './panels/controls.js';
import { convertFiles, ConvertError } from '../core/convert/index.js';
import { readSelected, failureNotice, loadedMessage, bannerText } from './uploadio.js';
import { mountUpload, setBusy, showUploadError, showUploadInfo, showBanner, hideBanner } from './upload.js';

const DATA_URL = 'data/run-2026-10-02-l4-t102.json';
const STATIONS_URL = 'data/stations.json';

const PANELS = [
  ['overview', renderOverview],
  ['classes', renderClasses],
  ['stats', renderStats],
  ['quality', renderQuality],
];

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

const MOUNT_IDS = ['controls', 'overview', 'map', 'charts', 'matrix', 'ranking', 'classes', 'stats', 'quality'];

// Header share control persists across mounts; getUrl reads whichever store is current.
let share = null;
let currentStore = null;
// Latest dashboard state for the PDF report, read at click time.
let reportCtx = null;

function writeHash(hsh) {
  try { history.replaceState(null, '', hsh ? '#' + hsh : location.pathname + location.search); } catch (_) { /* ignore */ }
}

function mountDashboard(run, { uploaded = false, fresh = false } = {}) {
  const disposers = createDisposers();
  try {
    reportCtx = null;
    for (const id of MOUNT_IDS) {
      const old = document.getElementById(id);
      old.replaceWith(old.cloneNode(false));
    }
    document.getElementById('title').textContent = run.meta.title;
    document.getElementById('run-date').textContent = fmtDateTime(run.meta.t0);

    const quality = qualitySummary(run, null);
    const noticeEl = document.getElementById('notice');
    noticeEl.hidden = true;

    let init;
    if (uploaded || fresh) {
      init = { state: defaultState(), ignored: [] };
      writeHash('');
    } else {
      init = parseHash(location.hash, hashContext(run));
    }
    const store = createStore(init.state);
    currentStore = store;
    if (init.ignored.length) showIgnoredNotice(noticeEl, init.ignored);

    if (!share) {
      share = mountShare(document.getElementById('share'), () => {
        const hsh = serialize(currentStore.get());
        return location.origin + location.pathname + location.search + (hsh ? '#' + hsh : '');
      });
    }
    share.setEnabled(isShareable(run));

    // Live URL: debounced replaceState (no history entries); empty state -> no hash. Never for uploaded runs.
    if (!uploaded) {
      let lastWritten = serialize(store.get());
      if (location.hash.replace(/^#/, '') !== lastWritten) writeHash(lastWritten);
      let timer = 0;
      disposers.add(() => clearTimeout(timer));
      disposers.add(store.subscribe(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const hsh = serialize(store.get());
          if (hsh === lastWritten) return;
          lastWritten = hsh;
          writeHash(hsh);
        }, 250);
      }));
      const onHashChange = () => {
        const hsh = location.hash.replace(/^#/, '');
        if (hsh === lastWritten) return;
        const p = parseHash(location.hash, hashContext(run));
        lastWritten = serialize(p.state);
        store.set(() => p.state);
        if (p.ignored.length) showIgnoredNotice(noticeEl, p.ignored);
      };
      window.addEventListener('hashchange', onHashChange);
      disposers.add(() => window.removeEventListener('hashchange', onHashChange));
    }

    const link = createLink();
    const charts = mountCharts(document.getElementById('charts'), link, run);
    disposers.add(() => charts.destroy());
    const map = mountMap(document.getElementById('map'), link, run, store);
    disposers.add(() => map.destroy());
    const matrix = mountMatrix(document.getElementById('matrix'), store);
    const ranking = mountRanking(document.getElementById('ranking'), store, { onRowClick: (row) => { link.select(row); map.focus(row); } });

    let memoKey = null;
    let analysis = null;
    let gpsMemo = { key: null, run: null };

    function update() {
      const state = store.get();
      const gk = gpsKey(state.params.gps);
      if (gk !== gpsMemo.key) gpsMemo = { key: gk, run: applyGpsFilter(run, state.params.gps) };
      const r = gpsMemo.run;
      const key = paramsKey(state.params);
      if (key !== memoKey) {
        const t0 = performance.now();
        analysis = analyze(r, state.params);
        memoKey = key;
        // Pitfall 7: if this exceeds ~50 ms, Plan 06 coalesces updates with requestAnimationFrame.
        console.debug('analyze ms', (performance.now() - t0).toFixed(1));
      }
      const view = buildView(r, analysis, state.filters);
      const stats = {
        mm: meansMaxima(r, analysis, view.mask),
        table: axisStatsTable(r, analysis, view.mask, state.display.valueMode),
      };
      const ctx = { run: r, baseRun: run, analysis, view, state, stats, quality: { ...quality, naoClassificadas: analysis.naoClassificadas } };
      for (const [id, render] of PANELS) render(document.getElementById(id), ctx);
      charts.render(ctx);
      map.render(ctx);
      matrix.render(ctx);
      ranking.render(ctx);
      renderControls(state);
      reportCtx = { run: r, analysis, state, getRoutes: map.getRouteFeatures };
    }

    mountControls(document.getElementById('controls'), store, run);
    disposers.add(store.subscribe(update));
    // Debug handle for manual inspection in the console.
    window.__painel = { store, run, link, session };
    setStatus('');
    update();
    return { destroy: () => disposers.run() };
  } catch (err) {
    reportCtx = null;
    disposers.run();
    throw err;
  }
}

const session = createSession(mountDashboard);

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
  session.showExample(run);
  mountUpload(document.getElementById('upload'), { onFiles: handleFiles });
  mountReport(document.getElementById('report'), {
    getSnapshot: () => (reportCtx
      ? { run: reportCtx.run, analysis: reportCtx.analysis, state: reportCtx.state, routes: reportCtx.getRoutes() }
      : null),
  });
}

// Stations are fetched lazily on the first upload and cached; the page load never needs them.
let stationsPromise = null;
function loadStations() {
  if (!stationsPromise) {
    stationsPromise = fetch(STATIONS_URL)
      .then((resp) => {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      })
      .catch((err) => {
        stationsPromise = null;
        console.error(err);
        throw new ConvertError('stations_unavailable');
      });
  }
  return stationsPromise;
}

const uploadInfo = new WeakMap();

async function handleFiles(fileList) {
  setBusy(true);
  const res = await session.tryLoad(async () => {
    const { files, ignored } = await readSelected(fileList);
    const stations = await loadStations();
    await new Promise((r) => setTimeout(r, 0)); // let "Processando…" paint
    const t0 = performance.now();
    const { json, summary } = convertFiles(files, stations);
    const run = decodeRun(json);
    console.debug('convert ms', (performance.now() - t0).toFixed(1));
    uploadInfo.set(run, { summary, ignored });
    return run;
  });
  setBusy(session.busy());
  if (res.stale) return; // superseded by a newer pick or by restoreExample(): show nothing
  const noticeEl = document.getElementById('notice');
  if (res.ok) {
    const { summary, ignored } = uploadInfo.get(res.run);
    showBanner(document.getElementById('upload-banner'), bannerText(summary), backToExample);
    showUploadInfo(noticeEl, loadedMessage(summary, ignored));
  } else {
    console.error(res.error);
    if (res.fatal) setStatus(T.loadError);
    showUploadError(noticeEl, failureNotice(res.error)); // view untouched: session mounted nothing
  }
}

function backToExample() {
  session.restoreExample();
  hideBanner(document.getElementById('upload-banner'));
  setBusy(false);
}

start();
