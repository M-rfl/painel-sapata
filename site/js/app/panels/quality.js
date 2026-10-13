// Data-quality card (full run, not filtered). No DOM access at import time.
import { h, clear } from '../dom.js';
import { T } from '../i18n.js';
import { fmtInt, fmtPct, fmtDuration, fmtDateTime } from '../format.js';
import { infoBtn } from '../info.js';

const CH = { vel: 'Velocidade', disp: 'Deslocamento', freq: 'Frequência', temp: 'Temperatura' };

function chName(c) {
  const base = CH[c.channel] || c.channel;
  const unit = c.unit ? ` (${c.unit})` : '';
  return c.axis === 'v' ? base + unit : `${base} ${c.axis.toUpperCase()}${unit}`;
}

const row = (label, value, key) => h('tr', null, h('td', null, label, infoBtn(key, label)), h('td', { class: 'num' }, value));

export function render(el, ctx) {
  const q = ctx.quality;
  clear(el);
  el.appendChild(h('h2', null, T.secQuality, infoBtn('quality', T.secQuality)));

  const gps = q.gpsCoverage == null ? '—'
    : `${fmtPct(q.gpsCoverage)} (${fmtInt(q.rowsWithGps)} de ${fmtInt(q.n)})`;
  const empty = q.emptyChannels.length ? q.emptyChannels.map(chName).join(', ') : 'nenhum';
  const turn = q.turnarounds.length
    ? q.turnarounds.map((t) => `${fmtDuration(t.gapS)}${t.terminal ? ' em ' + t.terminal : ''}`).join('; ')
    : '—';
  const warn = q.stationWarnings.length
    ? h('ul', null, q.stationWarnings.map((w) => h('li', null, typeof w === 'string' ? w : JSON.stringify(w))))
    : T.qNenhumAviso;
  const inferred = q.inferredStations.length
    ? q.inferredStations.map((s) => `${s.code} (${fmtInt(s.minDistM)} m)`).join(', ')
    : 'nenhuma';

  el.appendChild(h('div', { class: 'panel' },
    h('table', null, h('tbody', null,
      row(T.qCobertura, gps, 'qCobertura'),
      row(T.qSemPosicao, q.rowsWithoutGps == null ? '—' : fmtInt(q.rowsWithoutGps), 'qSemPosicao'),
      row(T.qCanaisVazios, empty, 'qCanaisVazios'),
      row(T.qRetorno, turn, 'qRetorno'),
      row(T.qInferidas, inferred, 'qInferidas'),
      row(T.qNaoClassificadas, q.naoClassificadas == null ? '—' : fmtInt(q.naoClassificadas), 'qNaoClassificadas'),
      row('Valores irrecuperáveis', q.unrecovered == null ? '—' : fmtInt(q.unrecovered), 'qIrrecuperaveis'),
      row('Valores ambíguos', q.ambiguous == null ? '—' : fmtInt(q.ambiguous), 'qAmbiguos'))),
    h('h3', null, T.qAvisos, infoBtn('qAvisos', T.qAvisos)),
    h('div', null, warn)));

  if (q.channels.length) {
    el.appendChild(h('div', { class: 'panel' },
      h('h3', null, 'Canais: parcela de zeros ou nulos', infoBtn('qCanais', 'Canais')),
      h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Canal'), h('th', { class: 'num' }, '% zero/nulo'))),
        h('tbody', null, q.channels.map((c) => h('tr', null,
          h('td', null, chName(c)), h('td', { class: 'num' }, fmtPct(c.share))))))));
  }

  el.appendChild(h('p', { class: 'muted' },
    'Este cartão descreve a corrida inteira (não é afetado pelos filtros). ',
    q.converterVersion ? `Conversor ${q.converterVersion}` : null,
    q.generatedAt ? `, gerado em ${fmtDateTime(q.generatedAt)}` : null));
}
