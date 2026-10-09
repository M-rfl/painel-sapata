// Class counts/% with dominant-axis breakdown. No DOM access at import time.
import { h, clear } from '../dom.js';
import { T } from '../i18n.js';
import { fmtInt, fmtPct } from '../format.js';
import { CLASS_NAMES } from '../../core/defaults.js';

const COLORS = ['var(--normal)', 'var(--leve)', 'var(--moderado)', 'var(--severo)', 'var(--critico)'];

function block(title, counts, pcts, axisGrid, axes, extra) {
  const lab = [`X ${axes.ax}`, `Y ${axes.ay}`, `Z ${axes.az}`];
  const rows = counts.map((n, c) => {
    const a = axisGrid[c];
    return h('div', { class: 'bar-row' },
      h('span', null, h('span', { class: 'chip', style: { background: COLORS[c] } }), CLASS_NAMES[c]),
      h('div', { class: 'bar-track' },
        h('div', { class: 'bar-fill', style: { width: `${(pcts[c] || 0) * 100}%`, background: COLORS[c] } })),
      h('span', { title: lab.join(' · ') }, `${fmtInt(n)} (${fmtPct(pcts[c] || 0)})`,
        h('div', { class: 'axes' }, `X ${fmtInt(a[0])} · Y ${fmtInt(a[1])} · Z ${fmtInt(a[2])}`)));
  });
  return h('div', { class: 'panel' }, h('h3', null, title), rows, extra || null);
}

export function render(el, ctx) {
  const { view, run } = ctx;
  const axes = (run.meta && run.meta.axes) || { ax: 'Longitudinal', ay: 'Lateral', az: 'Vertical' };
  clear(el);
  el.appendChild(h('h2', null, T.secClasses));
  const nc = view.naoClassificadas > 0
    ? h('div', { class: 'muted' }, `${T.qNaoClassificadas}: ${fmtInt(view.naoClassificadas)}`) : null;
  el.appendChild(block('Medições', view.classCounts, view.classPct, view.axisByClass.medicoes, axes, nc));
  el.appendChild(block('Impactos', view.impactsByClass, view.impactsPct, view.axisByClass.impactos, axes));
  el.appendChild(block('Pontos', view.pointsByClass, view.pointsPct, view.axisByClass.pontos, axes));
  el.appendChild(h('p', { class: 'muted' }, '% de medições sobre medições classificadas.'));
}
