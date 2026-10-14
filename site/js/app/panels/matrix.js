// Trecho x severidade matrices (MTX-01, MTX-02). Mounted once; tables rebuilt only when counts can change.
import { CLASS_NAMES } from '../../core/defaults.js';
import { buildMatrix, cellClick, isCellSelected } from '../../core/matrix.js';
import { h, clear } from '../dom.js';
import { T } from '../i18n.js';
import { infoBtn } from '../info.js';
import { fmtInt } from '../format.js';
import { setFilter, setUi, MATRIX_BASES } from '../state.js';

const CLASS_TOKENS = ['--normal', '--leve', '--moderado', '--severo', '--critico'];
const BASIS_LABELS = { impactos: T.mImpactos, medicoes: T.mMedicoes, pontos: T.mPontos };

export function mountMatrix(el, store) {
  clear(el);
  const radios = new Map();
  const pair = h('div', { class: 'matrix-pair' });
  const group = h('div', { class: 'matrix-basis', role: 'radiogroup', 'aria-label': T.mBase }, T.mBase + ':');
  for (const b of MATRIX_BASES) {
    const input = h('input', {
      type: 'radio', name: 'matrix-basis', value: b,
      onChange: () => store.set((s) => setUi(s, 'matrixBasis', b)),
    });
    radios.set(b, input);
    group.appendChild(h('label', { class: 'ctl-check' }, input, ' ', BASIS_LABELS[b]));
  }
  group.appendChild(infoBtn('matrixBase', T.mBase));
  el.appendChild(h('div', { class: 'panel' },
    h('h2', null, T.secMatrix, infoBtn('matrix', T.secMatrix)), group, pair));

  pair.addEventListener('click', (ev) => {
    const btn = ev.target.closest && ev.target.closest('.mx-cell');
    if (!btn) return;
    const t = Number(btn.dataset.t);
    const c = Number(btn.dataset.c);
    const additive = ev.ctrlKey || ev.shiftKey || ev.metaKey;
    store.set((s) => {
      const f = cellClick(s.filters, t, c, additive);
      return setFilter(setFilter(s, 'trechos', f.trechos), 'classes', f.classes);
    });
  });

  let lastRun = null;
  let lastAnalysis = null;
  let lastKey = null;

  function buildTables(m) {
    clear(pair);
    for (const sent of m.sentidos) {
      const head = h('tr', null, h('th', { scope: 'col' }, T.mTrecho),
        m.columns.map((c) => h('th', { scope: 'col' }, CLASS_NAMES[c])),
        h('th', { scope: 'col' }, T.mTotal));
      const body = sent.rows.map((r) => h('tr', null,
        h('th', { scope: 'row' }, r.name),
        m.columns.map((c) => {
          const n = r.counts[c];
          const share = m.colMax[c] > 0 ? Math.round(100 * n / m.colMax[c]) : 0;
          const btn = h('button', {
            type: 'button', class: 'mx-cell', 'aria-pressed': 'false',
            dataset: { t: String(r.trecho), c: String(c) },
            'aria-label': `${r.name}, ${CLASS_NAMES[c]}: ${fmtInt(n)}`,
          }, fmtInt(n));
          btn.style.background = `color-mix(in srgb, var(${CLASS_TOKENS[c]}) ${share}%, white)`;
          if (share > 55) btn.style.color = '#fff';
          return h('td', null, btn);
        }),
        h('td', { class: 'mx-total' }, fmtInt(r.total))));
      pair.appendChild(h('table', null,
        sent.name ? h('caption', null, sent.name) : null,
        h('thead', null, head), h('tbody', null, body)));
    }
  }

  function render(ctx) {
    const { run, analysis, state } = ctx;
    const f = state.filters;
    const basis = state.ui.matrixBasis;
    const key = JSON.stringify([basis, f.sentidos, f.eixos, f.tFrom, f.tTo]);
    if (run !== lastRun || analysis !== lastAnalysis || key !== lastKey) {
      buildTables(buildMatrix(run, analysis, f, basis));
      lastRun = run; lastAnalysis = analysis; lastKey = key;
    }
    for (const btn of pair.querySelectorAll('.mx-cell')) {
      const sel = isCellSelected(f, Number(btn.dataset.t), Number(btn.dataset.c));
      btn.classList.toggle('selected', sel);
      btn.setAttribute('aria-pressed', sel ? 'true' : 'false');
    }
    for (const [b, input] of radios) input.checked = b === basis;
  }

  return { render };
}
