// Means/maxima and per-axis statistics tables. No DOM access at import time.
import { h, clear } from '../dom.js';
import { T } from '../i18n.js';
import { fmtG } from '../format.js';
import { infoBtn } from '../info.js';

const num = (v, n) => (n === 0 || !Number.isFinite(v) ? '—' : fmtG(v, 4) + ' g');
const plain = (v, n) => (n === 0 || !Number.isFinite(v) ? '—' : fmtG(v, 4));
const th = (t, cls) => h('th', { class: cls || 'num' }, t);

export function render(el, ctx) {
  const { stats, state } = ctx;
  const { medido, dinamico } = stats.mm;
  clear(el);
  el.appendChild(h('h2', null, T.secMeans, infoBtn('means', T.secMeans)));

  const rows = [
    ['AX', 0], ['AY', 1], ['AZ', 2],
  ].map(([name, i]) => h('tr', null,
    h('td', null, name),
    h('td', { class: 'num' }, num(medido.mean[i], medido.n)),
    h('td', { class: 'num' }, num(dinamico.mean[i], dinamico.n)),
    h('td', { class: 'num' }, num(medido.maxAbs[i], medido.n)),
    h('td', { class: 'num' }, num(dinamico.maxAbs[i], dinamico.n))));
  rows.push(h('tr', null,
    h('td', null, T.axRes),
    h('td', { class: 'num' }, num(medido.meanRes, medido.n)),
    h('td', { class: 'num' }, num(dinamico.meanRes, dinamico.n)),
    h('td', { class: 'num' }, num(medido.maxRes, medido.n)),
    h('td', { class: 'num' }, num(dinamico.maxRes, dinamico.n))));

  el.appendChild(h('div', { class: 'panel' },
    h('table', null,
      h('thead', null, h('tr', null, th('Eixo', ''), th('Média medido'), th('Média dinâmico'), th('Maior medido'), th('Maior dinâmico'))),
      h('tbody', null, rows)),
    h('p', { class: 'muted' }, 'Maior = maior valor absoluto (sinal preservado). Resultante dinâmica no cálculo dinâmico.')));

  const modeLabel = state.display.valueMode === 'medido' ? T.dMedido : T.dDinamico;
  const names = { ax: 'AX', ay: 'AY', az: 'AZ', res: T.axRes };
  const trs = stats.table.map((r) => h('tr', null,
    h('td', null, names[r.key]),
    h('td', { class: 'num' }, plain(r.mean, r.n)),
    h('td', { class: 'num' }, plain(r.median, r.n)),
    h('td', { class: 'num' }, plain(r.std, r.n)),
    h('td', { class: 'num' }, plain(r.p005, r.n)),
    h('td', { class: 'num' }, plain(r.p995, r.n))));
  el.appendChild(h('div', { class: 'panel' },
    h('h3', null, `${T.secAxisStats} (${modeLabel})`, infoBtn('axisStats', T.secAxisStats)),
    h('table', null,
      h('thead', null, h('tr', null, th('Eixo', ''), th(T.sMedia), th(T.sMediana), th(T.sDesvio), th(T.sP05), th(T.sP995))),
      h('tbody', null, trs))));
}
