// pt-BR Excel CSV export (RANK-03). Pure functions first; downloadCsv is the only DOM access and runs lazily.
import { fmtDate, fmtTime } from './format.js';
import { CLASS_NAMES } from '../core/defaults.js';

const BOM = '﻿';
const SEP = ';';
const EOL = '\r\n';

const q = (v) => {
  const t = v === null || v === undefined ? '' : String(v);
  return /[;"\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};

export function toCsv(headers, rows) {
  return BOM + [headers, ...rows].map((r) => r.map(q).join(SEP)).join(EOL) + EOL;
}

/** Decimal with comma, no thousands grouping. */
export function csvNum(x, d = 0) {
  if (x === null || x === undefined || Number.isNaN(x)) return '';
  return x.toFixed(d).replace('.', ',');
}

/** Formula-injection guard for text columns. */
export function csvText(s) {
  if (s === null || s === undefined) return '';
  const t = String(s);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

export const csvDateTime = (ms) => fmtDate(ms) + ' ' + fmtTime(ms);

export function pontosCsv(rows) {
  const headers = ['Posição', 'Hora', 'Trecho', 'Sentido', 'Eixo dominante', '|dom| (g)', 'AX din. (g)', 'AY din. (g)',
    'AZ din. (g)', 'Classe', 'Impactos no ponto', 'Google Maps'];
  return {
    headers,
    rows: rows.map((r) => [
      String(r.rank), csvDateTime(r.tEpochMs), csvText(r.trecho), csvText(r.sentido), r.eixoName,
      csvNum(r.dom, 4), csvNum(r.ax, 4), csvNum(r.ay, 4), csvNum(r.az, 4),
      r.className, String(r.nImp), r.url || '',
    ]),
  };
}

export function trechosCsv(rows) {
  const headers = ['Prioridade', 'Sentido', 'Trecho', 'IQ (%)', 'Registros', 'Eventos', 'Impactos', 'Pontos',
    'Maior classe', 'Pico |dom| (g)', 'Sem Crítico'];
  return {
    headers,
    rows: rows.map((r) => [
      r.label || '', csvText(r.sentido), csvText(r.name),
      r.iq && r.iq.value !== null ? csvNum(r.iq.value * 100, 1) : '',
      String(r.registros), String(r.eventos), String(r.impactos), String(r.pontos),
      r.maxCls >= 0 ? CLASS_NAMES[r.maxCls] : '', csvNum(r.peakDom, 4), r.semCritico ? 'sim' : '',
    ]),
  };
}

export function csvFilename(run, kind) {
  const id = (run && run.meta && run.meta.run_id) || 'corrida';
  return `${kind}-${id}.csv`;
}

/** Browser only: trigger a download. Never called at import time. */
export function downloadCsv(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
