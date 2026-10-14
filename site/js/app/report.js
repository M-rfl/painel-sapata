// Pure report model for the PDF. No document/window/Date.now: the clock is injected.
// Every string is WinAnsi-safe (pdfText) and every colour is an RGB triple decided here.
import { CLASS_NAMES } from '../core/defaults.js';
import { buildView } from '../core/view.js';
import { trechoRows, pontoRows, topPontos, sortPontos } from '../core/ranking.js';
import { buildMatrix } from '../core/matrix.js';
import { qualityIndex } from '../core/quality_index.js';
import { pontoMarkers, heatPoints, unplacedCounts } from '../core/geo.js';
import { epochMs } from '../core/series.js';
import { fmtInt, fmtG, fmtPct, fmtDate, fmtTime, fmtDateTime, fmtThreshold } from './format.js';
import { T, topPontosTitle, semGpsNote, gpsRejectedNote } from './i18n.js';

const GLYPHS = { '→': '»', '←': '«', '−': '-', '‑': '-', '≥': '>=', '≤': '<=' };

/** Make a string safe for the standard PDF (WinAnsi) font. */
export function pdfText(s) {
  return String(s ?? '')
    .replace(/[→←−‑≥≤]/g, (c) => GLYPHS[c])
    .replace(/[^\x00-\xFF–—…‘’“”•€]/g, '?');
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Class colour at `share` percent over white (same as CSS color-mix(... share%, white)). */
export function mixWhite(rgb, share) {
  return rgb.map((c) => Math.round(c * share / 100 + 255 * (1 - share / 100)));
}

export const CLASS_HEX = ['#2e7d32', '#f9a825', '#ef6c00', '#c62828', '#6a1b9a'];
export const SENTIDO_HEX = ['#1565c0', '#5d4037'];
export const IQ_HEX = { bom: '#2e7d32', regular: '#b26a00', ruim: '#c62828' };
export const TEXT_RGB = [31, 41, 51];
export const MUTED_RGB = [107, 114, 128];
export const LINK_RGB = [21, 101, 192];
export const WHITE = [255, 255, 255];
export const LVL_STYLE = {
  1: { fill: hexToRgb(CLASS_HEX[4]), color: WHITE },
  2: { fill: hexToRgb(CLASS_HEX[3]), color: WHITE },
  3: { fill: hexToRgb(CLASS_HEX[2]), color: WHITE },
  4: { fill: hexToRgb(CLASS_HEX[1]), color: TEXT_RGB },
  default: { fill: MUTED_RGB, color: WHITE },
};
export const BADGE_SEMCRITICO = { fill: [229, 231, 235], color: [55, 65, 81] };

export function reportFilename(run) {
  return `relatorio-${run?.meta?.run_id || 'corrida'}.pdf`;
}

export function methodNote(params) {
  const lim = params.thresholds_g.map(fmtThreshold).join(' / ');
  const o = params.offset;
  const off = o && o.mode === 'manual'
    ? `manual X ${fmtThreshold(o.g[0])} / Y ${fmtThreshold(o.g[1])} / Z ${fmtThreshold(o.g[2])} g`
    : 'mediana';
  const g = params.gps;
  return pdfText([
    `Limites ${lim} g`,
    `offset ${off}`,
    `agrupamento ${params.gap}`,
    `separação ${fmtThreshold(params.maxJumpMs / 1000)} s`,
    `GPS até ${g.maxSpeedKmh} km/h, intervalo ${g.maxFixGapS} s`,
    T.reportFullRun,
  ].join('; '));
}

const CLASS_RGB = CLASS_HEX.map(hexToRgb);
const IQ_RGB = { bom: hexToRgb(IQ_HEX.bom), regular: hexToRgb(IQ_HEX.regular), ruim: hexToRgb(IQ_HEX.ruim) };
const SENTIDO_RGB = SENTIDO_HEX.map(hexToRgb);
const BASIS_LABELS = { impactos: T.mImpactos, medicoes: T.mMedicoes, pontos: T.mPontos };
const DASH = '—';

const TRECHO_HEAD = [T.rcPrioridade, T.rcSentido, T.rcTrecho, T.rcIq, T.rcRegistros, T.rcEventos,
  T.rcImpactos, T.rcPontos, T.rcMaior, T.rcPico];
const PONTO_HEAD = [T.rcRank, T.rcHora, T.rcTrecho, T.rcSentido, T.rcEixo, T.rcDom, T.rcAx, T.rcAy, T.rcAz,
  T.rcClasse, T.rcImpactos, T.rcMapa];

const num = (text) => ({ text: pdfText(text), align: 'right' });
const txt = (text) => ({ text: pdfText(text) });
const head = (cols) => cols.map(pdfText);

function headerBlock(run, state, now) {
  const meta = run.meta || {};
  const first = run.n > 0 ? fmtDateTime(epochMs(run, 0)) : DASH;
  const last = run.n > 0 ? fmtDateTime(epochMs(run, run.n - 1)) : DASH;
  let uploaded = null;
  if (meta.uploaded === true) {
    const names = ((meta.source && meta.source.files) || []).map((f) => f.name).join(', ');
    uploaded = pdfText(`${T.reportUploaded}: ${names} (${fmtInt(meta.n ?? run.n)} ${T.reportLinhas})`);
  }
  return {
    title: pdfText(meta.title),
    period: pdfText(`${T.reportPeriod}: ${first} – ${last}`),
    generatedAt: pdfText(`${T.reportGenerated} ${fmtDate(now)} ${fmtTime(now).slice(0, 5)}`),
    uploaded,
    methodNote: pdfText(`${T.reportMethod}: ${methodNote(state.params)}`),
  };
}

function kpiBlock(view) {
  const iq = qualityIndex(view.classCounts);
  const iqRgb = iq.band ? IQ_RGB[iq.band] : TEXT_RGB;
  const plain = (label, value) => ({
    label: pdfText(label), value: pdfText(fmtInt(value)), note: null, color: TEXT_RGB, noteFill: null,
  });
  return [
    {
      label: pdfText(T.kpiIQ),
      value: iq.value === null ? DASH : pdfText(fmtPct(iq.value, 1)),
      note: iq.band ? pdfText(T['iq' + iq.band[0].toUpperCase() + iq.band.slice(1)]) : null,
      color: iqRgb,
      noteFill: iq.band ? iqRgb : null,
    },
    plain(T.kpiRegistros, view.registros),
    plain(T.kpiEventos, view.eventos),
    plain(T.kpiImpactos, view.impactos),
    plain(T.kpiPontos, view.pontos),
  ];
}

function routeLines(routes) {
  return new Set(routes.map((f) => f.properties && f.properties.line)).size;
}

function legendSentidos(run, routes, lineCount) {
  if (lineCount === 1) {
    return routes.slice().sort((a, b) => a.properties.sentido - b.properties.sentido).map((f) => {
      const i = f.properties.sentido - 1;
      return {
        text: pdfText(`Sentido ${f.properties.sentido}: ${f.properties.name}`),
        color: SENTIDO_RGB[i % SENTIDO_RGB.length],
        dashed: i > 0,
      };
    });
  }
  return (run.sentidos || []).map((s, i) => ({
    text: pdfText(s.name), color: SENTIDO_RGB[i % SENTIDO_RGB.length], dashed: i > 0,
  }));
}

function mapBlock(run, analysis, state, routes, view) {
  const d = state.display;
  const points = [];
  for (let f = 0; f < run.fixLat.length; f++) {
    if (!Number.isNaN(run.fixLat[f]) && !Number.isNaN(run.fixLon[f])) points.push([run.fixLat[f], run.fixLon[f]]);
  }
  const stations = (run.stations || []).map((s) => [s.lat, s.lon]);
  for (const s of stations) points.push(s);
  const lineCount = routeLines(routes);
  const un = unplacedCounts(run, analysis, view);
  const notes = [pdfText(semGpsNote(un.pontos, un.eventos))];
  const nRej = run.gpsRejected ? run.gpsRejected.length : 0;
  if (nRej > 0) notes.push(pdfText(gpsRejectedNote(nRej, state.params.gps.maxSpeedKmh)));
  return {
    title: pdfText(T.secMap),
    input: {
      points,
      stations,
      markers: pontoMarkers(run, analysis, view).map((m) => ({ lat: m.lat, lon: m.lon, cls: m.cls })),
      heat: heatPoints(run, analysis, view.mask, d.heatMetric, d.intensity),
      heatOpts: { radius: d.radius, blur: Math.round(d.radius * 0.6), minOpacity: 0.3, max: 1 },
      routes,
      lineCount,
      classColors: CLASS_HEX,
      sentidoColors: SENTIDO_HEX,
      attribution: pdfText(T.reportAttribution),
    },
    legend: {
      sentidos: legendSentidos(run, routes, lineCount),
      classes: CLASS_NAMES.slice(1).map((name, i) => ({ text: pdfText(name), color: CLASS_RGB[i + 1] })),
    },
    notes,
    failNote: pdfText(T.reportMapFail),
    missingNote: pdfText(T.reportMapMissing),
  };
}

function matrixCell(n, c, colMax) {
  const share = colMax[c] > 0 ? Math.round(100 * n / colMax[c]) : 0;
  return {
    text: pdfText(fmtInt(n)),
    fill: mixWhite(CLASS_RGB[c], share),
    color: share > 55 ? WHITE : TEXT_RGB,
    align: 'right',
  };
}

function matrixBlock(run, analysis, basis) {
  const m = buildMatrix(run, analysis, {}, basis);
  return {
    title: pdfText(T.secMatrix),
    basisLabel: pdfText(`${T.mBase}: ${BASIS_LABELS[basis]}`),
    tables: m.sentidos.map((sent) => ({
      caption: pdfText(sent.name),
      head: head([T.mTrecho, ...m.columns.map((c) => CLASS_NAMES[c]), T.mTotal]),
      body: sent.rows.map((r) => [
        { text: pdfText(r.name), bold: true },
        ...m.columns.map((c) => matrixCell(r.counts[c], c, m.colMax)),
        num(fmtInt(r.total)),
      ]),
    })),
  };
}

function trechoRow(r) {
  const lvl = LVL_STYLE[r.level] || LVL_STYLE.default;
  const name = { text: pdfText(r.name) };
  if (r.semCritico) {
    name.badge = { text: pdfText(T.rSemCritico), fill: BADGE_SEMCRITICO.fill, color: BADGE_SEMCRITICO.color };
  }
  const iq = { text: r.iq && r.iq.value !== null ? pdfText(fmtPct(r.iq.value, 1)) : DASH };
  if (r.iq && r.iq.band) { iq.color = IQ_RGB[r.iq.band]; iq.bold = true; }
  return [
    { text: pdfText(r.label || DASH), fill: lvl.fill, color: lvl.color, bold: true },
    txt(r.sentido), name, iq,
    num(fmtInt(r.registros)), num(fmtInt(r.eventos)), num(fmtInt(r.impactos)), num(fmtInt(r.pontos)),
    txt(r.maxCls >= 0 ? CLASS_NAMES[r.maxCls] : DASH),
    num(r.peakDom === null ? DASH : fmtG(r.peakDom, 3)),
  ];
}

function pontoRow(r) {
  const mapCell = r.url
    ? { text: pdfText(T.reportAbrir), url: r.url, color: LINK_RGB }
    : { text: pdfText(T.reportSemGps), color: MUTED_RGB };
  return [
    num(fmtInt(r.rank)), txt(fmtDate(r.tEpochMs) + ' ' + fmtTime(r.tEpochMs)), txt(r.trecho), txt(r.sentido),
    txt(r.eixoName), num(fmtG(r.dom, 3)), num(fmtG(r.ax, 3)), num(fmtG(r.ay, 3)), num(fmtG(r.az, 3)),
    { text: pdfText(r.className), swatch: CLASS_RGB[r.cls] },
    num(fmtInt(r.nImp)), mapCell,
  ];
}

/**
 * Report model for the whole loaded run: filters in `state` are ignored on purpose.
 * Honours state.params (via the given analysis), state.ui.matrixBasis, state.ui.rankSort and state.display.
 */
export function buildReport({ run, analysis, state, routes = [] }, { now }) {
  const view = buildView(run, analysis, {});
  const trechos = trechoRows(run, analysis, {});
  const all = pontoRows(run, analysis, view);
  const top = sortPontos(topPontos(all, 50), state.ui.rankSort);
  return {
    now,
    filename: reportFilename(run),
    docTitle: pdfText(T.reportTitle),
    pageTemplate: pdfText(T.reportPage),
    header: headerBlock(run, state, now),
    kpis: kpiBlock(view),
    map: mapBlock(run, analysis, state, routes, view),
    matrices: matrixBlock(run, analysis, state.ui.matrixBasis),
    trechos: { title: pdfText(T.rTrechos), head: head(TRECHO_HEAD), body: trechos.map(trechoRow) },
    pontos: { title: pdfText(topPontosTitle(top.length, all.length)), head: head(PONTO_HEAD), body: top.map(pontoRow) },
  };
}
