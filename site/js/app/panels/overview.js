// KPI cards + conformity badge. No DOM access at import time.
import { h, clear } from '../dom.js';
import { T, pontosNote } from '../i18n.js';
import { fmtInt } from '../format.js';
import { infoBtn } from '../info.js';

function card(label, value, note, key) {
  return h('div', { class: 'card' },
    h('div', { class: 'label' }, label, infoBtn(key, label)),
    h('div', { class: 'value' }, value),
    note ? h('div', { class: 'note' }, note) : null);
}

function renderBadge(analysis) {
  const el = document.getElementById('badge');
  if (!el) return;
  clear(el);
  const c = analysis.conforme;
  if (!c || c.available === false) return;
  if (c.ok) el.appendChild(h('span', { class: 'badge ok', title: T.badgeOkDetail }, T.badgeOk));
  else el.appendChild(h('span', { class: 'badge warn', title: c.reasons.join('; ') }, T.badgeDiff));
  el.appendChild(infoBtn('badge', c.ok ? T.badgeOk : T.badgeDiff));
}

export function render(el, ctx) {
  const { view, analysis, run } = ctx;
  clear(el);
  renderBadge(analysis);

  const filt = view.isFiltered;
  const total = (n) => (filt ? `de ${fmtInt(n)}` : null);
  const mark = filt ? h('span', { class: 'tag-filtered' }, 'filtrado') : null;

  const ref = run.reference && run.reference.pontos;
  const pontosExtra = !filt && ref != null ? pontosNote(view.pontos, ref) : null;
  const top = view.topTrecho;

  el.appendChild(h('h2', null, T.secOverview, mark));
  el.appendChild(h('div', { class: 'cards' },
    card(T.kpiRegistros, fmtInt(view.registros), total(run.n), 'kpiRegistros'),
    card(T.kpiEventos, fmtInt(view.eventos), total(analysis.eventos), 'kpiEventos'),
    card(T.kpiImpactos, fmtInt(view.impactos), total(analysis.impactos), 'kpiImpactos'),
    card(T.kpiPontos, fmtInt(view.pontos), filt ? total(analysis.pontos) : pontosExtra, 'kpiPontos'),
    card(T.kpiTrecho, top ? top.name : '—', top ? `${fmtInt(top.eventos)} eventos` : null, 'kpiTrecho')));
}
