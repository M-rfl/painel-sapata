// Pure report model for the PDF. No document/window/Date.now: the clock is injected.
// Every string is WinAnsi-safe (pdfText) and every colour is an RGB triple decided here.
import { fmtThreshold } from './format.js';
import { T } from './i18n.js';

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
