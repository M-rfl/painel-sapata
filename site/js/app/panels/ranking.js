// Ranking panel: trecho priority table + top-50 pontos table, each with CSV export (RANK-01..03, KPI-06).
// Mounted once; tbody rebuilt only when run/analysis/filters/sort/view change.
import { CLASS_NAMES } from '../../core/defaults.js';
import { trechoRows, pontoRows, topPontos, sortPontos } from '../../core/ranking.js';
import { h, clear } from '../dom.js';
import { T, topPontosTitle } from '../i18n.js';
import { infoBtn } from '../info.js';
import { fmtInt, fmtG, fmtPct, fmtDate, fmtTime } from '../format.js';
import { setUi } from '../state.js';
import { toCsv, pontosCsv, trechosCsv, csvFilename, downloadCsv } from '../csv.js';

const CLASS_TOKENS = ['--normal', '--leve', '--moderado', '--severo', '--critico'];
const ASC_FIRST = ['trecho', 'sentido', 'eixo', 'hora'];
const PONTO_COLS = [
  { key: null, label: T.rcRank },
  { key: 'hora', label: T.rcHora },
  { key: 'trecho', label: T.rcTrecho },
  { key: 'sentido', label: T.rcSentido },
  { key: 'eixo', label: T.rcEixo },
  { key: 'dom', label: T.rcDom },
  { key: 'ax', label: T.rcAx },
  { key: 'ay', label: T.rcAy },
  { key: 'az', label: T.rcAz },
  { key: 'cls', label: T.rcClasse },
  { key: 'nImp', label: T.rcImpactos },
  { key: null, label: T.rcMapa },
];
const TRECHO_COLS = [T.rcPrioridade, T.rcSentido, T.rcTrecho, T.rcIq, T.rcRegistros, T.rcEventos,
  T.rcImpactos, T.rcPontos, T.rcMaior, T.rcPico];

export function mountRanking(el, store, { onRowClick } = {}) {
  clear(el);
  let latest = null; // { run, trechos, allPontos, sort }

  const trechoBody = h('tbody');
  const pontosBody = h('tbody');
  const pontosTitle = h('span', null, '');
  const sortHeads = new Map();

  const csvBtn = (onClick) => h('span', { class: 'rank-csv' },
    h('button', { type: 'button', onClick }, T.rCsv), infoBtn('csv', T.rCsv));

  const trechoBlock = h('div', { class: 'rank-block' },
    h('h3', null, T.rTrechos, infoBtn('rankTrecho', T.rTrechos),
      csvBtn(() => {
        if (!latest) return;
        const c = trechosCsv(latest.trechos);
        downloadCsv(toCsv(c.headers, c.rows), csvFilename(latest.run, 'trechos'));
      })),
    h('div', { class: 'rank-scroll' },
      h('table', null,
        h('thead', null, h('tr', null, TRECHO_COLS.map((c) => h('th', { scope: 'col' }, c)))),
        trechoBody)));

  const headRow = h('tr', null, PONTO_COLS.map((c) => {
    if (!c.key) return h('th', { scope: 'col' }, c.label);
    const btn = h('button', {
      type: 'button', dataset: { col: c.key },
      onClick: () => store.set((s) => {
        const cur = s.ui.rankSort;
        const next = cur.col === c.key
          ? { col: c.key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
          : { col: c.key, dir: ASC_FIRST.includes(c.key) ? 'asc' : 'desc' };
        return setUi(s, 'rankSort', next);
      }),
    }, c.label);
    const th = h('th', { scope: 'col', 'aria-sort': 'none' }, btn);
    sortHeads.set(c.key, th);
    return th;
  }));

  const pontosBlock = h('div', { class: 'rank-block' },
    h('h3', null, pontosTitle, infoBtn('rankPontos', T.secRanking),
      csvBtn(() => {
        if (!latest) return;
        const c = pontosCsv(sortPontos(latest.allPontos, latest.sort));
        downloadCsv(toCsv(c.headers, c.rows), csvFilename(latest.run, 'pontos'));
      })),
    h('div', { class: 'rank-scroll' },
      h('table', { class: 'rank-pontos' }, h('thead', null, headRow), pontosBody)));

  el.appendChild(h('div', { class: 'panel' }, h('h2', null, T.secRanking),
    h('div', { class: 'rank-pair' }, trechoBlock, pontosBlock)));

  const pill = (text, cls, token) => {
    const s = h('span', { class: cls }, text);
    if (token) s.style.setProperty('--chip', `var(${token})`);
    return s;
  };

  function trechoRow(r) {
    const iqText = r.iq && r.iq.value !== null ? fmtPct(r.iq.value, 1) : '—';
    return h('tr', { class: r.selected ? 'selected' : null },
      h('td', null, pill(r.label || '—', 'lvl-pill lvl-' + r.level)),
      h('td', null, r.sentido),
      h('td', null, r.name, r.semCritico ? ' ' : null,
        r.semCritico ? h('span', { class: 'badge-semcritico' }, T.rSemCritico) : null),
      h('td', { class: 'iq-cell' + (r.iq && r.iq.band ? ' iq-' + r.iq.band : '') }, iqText),
      h('td', { class: 'num' }, fmtInt(r.registros)),
      h('td', { class: 'num' }, fmtInt(r.eventos)),
      h('td', { class: 'num' }, fmtInt(r.impactos)),
      h('td', { class: 'num' }, fmtInt(r.pontos)),
      h('td', null, r.maxCls >= 0 ? CLASS_NAMES[r.maxCls] : '—'),
      h('td', { class: 'num' }, r.peakDom === null ? '—' : fmtG(r.peakDom, 3)));
  }

  function pontoRow(r) {
    const go = () => { if (onRowClick) onRowClick(r.row); };
    const mapCell = r.url
      ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', onClick: (ev) => ev.stopPropagation() }, T.rcMapa)
      : h('span', { class: 'muted' }, T.rSemGps);
    const sw = h('span', { class: 'cls-swatch' });
    sw.style.background = `var(${CLASS_TOKENS[r.cls]})`;
    return h('tr', {
      class: 'clickable', tabindex: '0',
      onClick: go,
      onKeydown: (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } },
    },
    h('td', { class: 'num' }, fmtInt(r.rank)),
    h('td', null, fmtDate(r.tEpochMs) + ' ' + fmtTime(r.tEpochMs)),
    h('td', null, r.trecho),
    h('td', null, r.sentido),
    h('td', null, r.eixoName),
    h('td', { class: 'num' }, fmtG(r.dom, 3)),
    h('td', { class: 'num' }, fmtG(r.ax, 3)),
    h('td', { class: 'num' }, fmtG(r.ay, 3)),
    h('td', { class: 'num' }, fmtG(r.az, 3)),
    h('td', null, sw, ' ', r.className),
    h('td', { class: 'num' }, fmtInt(r.nImp)),
    h('td', null, mapCell));
  }

  let lastKey = null;
  let lastRun = null;
  let lastAnalysis = null;
  let lastView = null;
  let trechos = [];
  let allPontos = [];

  function render(ctx) {
    const { run, analysis, view, state } = ctx;
    const sort = state.ui.rankSort;
    const key = JSON.stringify([state.filters, sort]);
    if (run !== lastRun || analysis !== lastAnalysis || view !== lastView || key !== lastKey) {
      trechos = trechoRows(run, analysis, state.filters);
      allPontos = pontoRows(run, analysis, view);
      const top = sortPontos(topPontos(allPontos, 50), sort);
      clear(trechoBody);
      for (const r of trechos) trechoBody.appendChild(trechoRow(r));
      clear(pontosBody);
      for (const r of top) pontosBody.appendChild(pontoRow(r));
      pontosTitle.textContent = topPontosTitle(top.length, allPontos.length);
      lastRun = run; lastAnalysis = analysis; lastView = view; lastKey = key;
    }
    latest = { run, trechos, allPontos, sort };
    for (const [k, th] of sortHeads) {
      th.setAttribute('aria-sort', k === sort.col ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
    }
  }

  return { render };
}
