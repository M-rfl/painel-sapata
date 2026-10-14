import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  pdfText, mixWhite, hexToRgb, reportFilename, methodNote,
  CLASS_HEX, IQ_HEX, LVL_STYLE, BADGE_SEMCRITICO, TEXT_RGB, MUTED_RGB,
} from '../../site/js/app/report.js';
import { INFO } from '../../site/js/app/i18n.js';
import { defaultState } from '../../site/js/app/state.js';
import { loadRun1, repoUrl } from './helpers.js';

const rgb = (hex) => hexToRgb(hex);

test('pdfText maps glyphs outside WinAnsi', () => {
  assert.equal(pdfText('Sentido 1 — Terminal Gentileza → Praça XV'), 'Sentido 1 — Terminal Gentileza » Praça XV');
  assert.equal(pdfText('−0,5'), '-0,5');
  assert.equal(pdfText('≥ 98'), '>= 98');
  assert.equal(pdfText('≤'), '<=');
  assert.equal(pdfText('a‑b'), 'a-b');
  assert.equal(pdfText('←'), '«');
  const keep = 'áçãõ×–—…·µ±°|«»';
  assert.equal(pdfText(keep), keep);
  assert.equal(pdfText('日本'), '??');
  assert.equal(pdfText(null), '');
  assert.equal(pdfText(undefined), '');
  const s = 'Sentido → ≥ − ‑ ← 日';
  assert.equal(pdfText(pdfText(s)), pdfText(s));
});

test('route and sentido names survive pdfText without "?"', () => {
  const dir = repoUrl('site/data/routes/');
  for (const f of readdirSync(dir)) {
    const g = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    assert.ok(!pdfText(g.properties.name).includes('?'), f);
  }
  for (const s of loadRun1().sentidos) assert.ok(!pdfText(s.name).includes('?'), s.name);
});

test('colour helpers', () => {
  assert.deepEqual(mixWhite([198, 40, 40], 100), [198, 40, 40]);
  assert.deepEqual(mixWhite([198, 40, 40], 0), [255, 255, 255]);
  assert.deepEqual(mixWhite([0, 0, 0], 50), [128, 128, 128]);
  assert.deepEqual(hexToRgb('#2e7d32'), [46, 125, 50]);
});

test('colours do not drift from app.css', () => {
  const css = readFileSync(repoUrl('site/css/app.css'), 'utf8');
  const token = (name) => {
    const m = css.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})'));
    assert.ok(m, 'token --' + name + ' not found in app.css');
    return m[1].toLowerCase();
  };
  const body = (selector) => {
    const esc = selector.replace(/\./g, '\\.');
    const m = css.match(new RegExp('(?:^|\\n)' + esc + '\\s*\\{([^}]*)\\}'));
    assert.ok(m, 'selector ' + selector + ' not found in app.css');
    return m[1];
  };
  ['normal', 'leve', 'moderado', 'severo', 'critico'].forEach((n, i) => assert.equal(CLASS_HEX[i], token(n), n));
  assert.deepEqual(TEXT_RGB, rgb(token('text')));
  assert.deepEqual(MUTED_RGB, rgb(token('muted')));
  assert.equal(IQ_HEX.regular, body('.iq-cell.iq-regular').match(/color:\s*(#[0-9a-f]{6})/i)[1].toLowerCase());
  assert.equal(IQ_HEX.bom, token('normal'));
  assert.equal(IQ_HEX.ruim, token('severo'));
  const lvlTok = { 1: 'critico', 2: 'severo', 3: 'moderado', 4: 'leve' };
  for (const n of [1, 2, 3, 4]) {
    const b = body('.lvl-' + n);
    const bg = b.match(/background:\s*var\(--(\w+)\)/);
    assert.ok(bg, '.lvl-' + n + ' background');
    assert.equal(bg[1], lvlTok[n]);
    assert.deepEqual(LVL_STYLE[n].fill, rgb(token(lvlTok[n])));
    const col = b.match(/(?:^|[;\s])color:\s*(#[0-9a-fA-F]{6})/);
    assert.deepEqual(LVL_STYLE[n].color, col ? rgb(col[1]) : [255, 255, 255]);
  }
  const pill = body('.lvl-pill');
  assert.ok(/background:\s*var\(--muted\)/.test(pill) && /color:\s*#fff/.test(pill));
  assert.deepEqual(LVL_STYLE.default, { fill: MUTED_RGB, color: [255, 255, 255] });
  const sc = body('.badge-semcritico');
  assert.deepEqual(BADGE_SEMCRITICO.fill, rgb(sc.match(/background:\s*(#[0-9a-f]{6})/i)[1]));
  assert.deepEqual(BADGE_SEMCRITICO.color, rgb(sc.match(/[;\s]color:\s*(#[0-9a-f]{6})/i)[1]));
});

test('reportFilename', () => {
  assert.equal(reportFilename(loadRun1()), 'relatorio-2026-10-02-l4-t102.pdf');
  assert.equal(reportFilename({ meta: { run_id: 'up-1' } }), 'relatorio-up-1.pdf');
  assert.equal(reportFilename({ meta: {} }), 'relatorio-corrida.pdf');
});

test('methodNote', () => {
  const p = defaultState().params;
  assert.equal(methodNote(p),
    'Limites 0,5 / 1 / 2 / 4 g; offset mediana; agrupamento 0; separação 2 s; GPS até 50 km/h, intervalo 120 s; corrida completa, sem filtros');
  assert.ok(methodNote({ ...p, thresholds_g: [0.3, 0.8, 1.5, 3] }).startsWith('Limites 0,3 / 0,8 / 1,5 / 3 g; '));
  const man = methodNote({ ...p, offset: { mode: 'manual', g: [-0.9854, 0.01, 1.0] } });
  assert.ok(man.includes('offset manual X -0,9854 / Y 0,01 / Z 1 g;'), man);
  assert.ok(!man.includes('−'));
});

test('INFO.report exists', () => {
  assert.ok(INFO.report.length > 20);
});

// ---- buildReport ----
const { buildReport, WHITE } = await import('../../site/js/app/report.js');
const { analyze } = await import('../../site/js/core/index.js');
const { applyGpsFilter } = await import('../../site/js/core/gpsfilter.js');
const { buildView } = await import('../../site/js/core/view.js');
const { buildMatrix } = await import('../../site/js/core/matrix.js');
const { pontoRows, topPontos, sortPontos } = await import('../../site/js/core/ranking.js');
const { heatPoints, pontoMarkers, unplacedCounts } = await import('../../site/js/core/geo.js');
const { qualityIndex } = await import('../../site/js/core/quality_index.js');
const { CLASS_NAMES } = await import('../../site/js/core/defaults.js');
const fmt = await import('../../site/js/app/format.js');
const { T, semGpsNote } = await import('../../site/js/app/i18n.js');

const NOW = Date.UTC(2026, 9, 14, 15, 7, 30);
const raw = loadRun1();

function ctxFor(state, base = raw) {
  const run = applyGpsFilter(base, state.params.gps);
  return { run, analysis: analyze(run, state.params), state };
}
const build = (state, extra = {}, base = raw) => buildReport({ ...ctxFor(state, base), ...extra }, { now: NOW });

function walk(v, fn) {
  if (typeof v === 'string') fn(v);
  else if (Array.isArray(v)) v.forEach((x) => walk(x, fn));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) if (k !== 'url' && k !== 'routes') walk(x, fn);
  }
}

test('every model string is WinAnsi-safe', () => {
  const m = build(defaultState());
  let count = 0;
  walk(m, (s) => { count++; assert.match(s, /^[\x00-\xFF–—…‘’“”•€]*$/, s); });
  assert.ok(count > 100);
});

test('matrix cells mirror the page', () => {
  const st = defaultState();
  const c = ctxFor(st);
  const m = build(st).matrices;
  const mx = buildMatrix(c.run, c.analysis, {}, 'impactos');
  assert.equal(m.basisLabel, 'Base: Impactos');
  assert.equal(m.tables.length, mx.sentidos.length);
  m.tables.forEach((t, si) => {
    const sent = mx.sentidos[si];
    assert.equal(t.caption, pdfText(sent.name));
    assert.deepEqual(t.head, ['Trecho', ...mx.columns.map((k) => CLASS_NAMES[k]), 'Total']);
    t.body.forEach((row, ri) => {
      const r = sent.rows[ri];
      assert.equal(row[0].text, pdfText(r.name));
      assert.equal(row[0].bold, true);
      mx.columns.forEach((k, ci) => {
        const share = mx.colMax[k] > 0 ? Math.round(100 * r.counts[k] / mx.colMax[k]) : 0;
        const cell = row[ci + 1];
        assert.equal(cell.text, fmt.fmtInt(r.counts[k]));
        assert.deepEqual(cell.fill, mixWhite(hexToRgb(CLASS_HEX[k]), share));
        assert.deepEqual(cell.color, share > 55 ? WHITE : TEXT_RGB);
        assert.equal(cell.align, 'right');
      });
      const last = row[row.length - 1];
      assert.equal(last.text, fmt.fmtInt(r.total));
      assert.equal(last.align, 'right');
      assert.ok(!last.bold);
    });
  });
  assert.ok(!JSON.stringify(m).includes('selected'));
});

test('matrix basis follows state.ui.matrixBasis', () => {
  const sums = {};
  for (const [b, label, cols] of [['impactos', 'Base: Impactos', 4], ['medicoes', 'Base: Medições', 5], ['pontos', 'Base: Pontos', 4]]) {
    const st = defaultState();
    st.ui = { ...st.ui, matrixBasis: b };
    const m = build(st).matrices;
    assert.equal(m.basisLabel, label);
    assert.equal(m.tables[0].head.length, cols + 2);
    sums[b] = JSON.stringify(m.tables[0].body);
  }
  assert.notEqual(sums.impactos, sums.medicoes);
  assert.notEqual(sums.impactos, sums.pontos);
});

test('trecho table', () => {
  const m = build(defaultState()).trechos;
  assert.deepEqual(m.head, ['Prioridade', 'Sentido', 'Trecho', 'IQ', 'Registros', 'Eventos', 'Impactos', 'Pontos', 'Maior classe', 'Pico |dom| (g)']);
  assert.ok(m.body.length > 5);
  let semCrit = 0;
  for (const row of m.body) {
    assert.equal(row.length, 10);
    const [prio, , name, iq, reg, , , , , peak] = row;
    assert.equal(prio.bold, true);
    assert.ok(prio.fill && prio.color);
    if (name.badge) {
      semCrit++;
      assert.deepEqual(name.badge, { text: 'sem Crítico', fill: [229, 231, 235], color: [55, 65, 81] });
    }
    if (iq.text !== '—') assert.ok(iq.bold && iq.color);
    assert.equal(reg.align, 'right');
    assert.ok(peak.text === '—' || /^\d+,\d{3}$/.test(peak.text));
  }
  assert.ok(semCrit > 0);
});

test('pontos table: top 50 by |dom| displayed in current sort', () => {
  const st = defaultState();
  const c = ctxFor(st);
  const all = pontoRows(c.run, c.analysis, buildView(c.run, c.analysis, {}));
  const top = topPontos(all, 50);
  const m = build(st).pontos;
  assert.equal(m.title, `Top ${top.length} de ${all.length} pontos`);
  assert.equal(m.body.length, top.length);
  assert.equal(m.head.length, 12);
  assert.equal(m.body[0][0].text, '1');
  const cls = m.body[0][9];
  assert.equal(cls.text, top[0].className);
  assert.deepEqual(cls.swatch, hexToRgb(CLASS_HEX[top[0].cls]));
  for (const row of m.body) {
    const cell = row[11];
    if (cell.url) { assert.equal(cell.text, 'abrir'); assert.deepEqual(cell.color, [21, 101, 192]); }
    else { assert.equal(cell.text, 'sem GPS'); assert.deepEqual(cell.color, MUTED_RGB); }
  }
  const st2 = defaultState();
  st2.ui = { ...st2.ui, rankSort: { col: 'hora', dir: 'asc' } };
  const m2 = build(st2).pontos;
  const expect = sortPontos(top, { col: 'hora', dir: 'asc' });
  assert.deepEqual(m2.body.map((r) => r[0].text), expect.map((r) => fmt.fmtInt(r.rank)));
  assert.deepEqual([...m2.body.map((r) => r[0].text)].sort(), [...m.body.map((r) => r[0].text)].sort());
});

test('filters are ignored', () => {
  const clean = defaultState();
  const filtered = defaultState();
  filtered.filters = {
    ...filtered.filters, sentidos: [1], trechos: [0], eixos: [2], classes: [4],
    tFrom: raw.tMs[0] + 60000, tTo: raw.tMs[0] + 600000,
  };
  const a = build(clean);
  const b = build(filtered);
  assert.deepEqual(b.kpis, a.kpis);
  assert.deepEqual(b.matrices, a.matrices);
  assert.deepEqual(b.trechos, a.trechos);
  assert.deepEqual(b.pontos, a.pontos);
  assert.deepEqual(b.map.input.heat, a.map.input.heat);
  assert.deepEqual(b.map.input.markers, a.map.input.markers);
});

test('params are honoured', () => {
  const a = build(defaultState());
  const st = defaultState();
  st.params = { ...st.params, thresholds_g: [0.3, 0.8, 1.5, 3] };
  const b = build(st);
  assert.notEqual(b.kpis[2].value, a.kpis[2].value);
  assert.ok(b.header.methodNote.includes('Limites 0,3 / 0,8 / 1,5 / 3 g'));
});

test('KPIs', () => {
  const st = defaultState();
  const c = ctxFor(st);
  const view = buildView(c.run, c.analysis, {});
  const k = build(st).kpis;
  assert.equal(k.length, 5);
  const iq = qualityIndex(view.classCounts);
  assert.equal(k[0].value, fmt.fmtPct(iq.value, 1));
  assert.equal(k[0].note, { bom: T.iqBom, regular: T.iqRegular, ruim: T.iqRuim }[iq.band]);
  assert.deepEqual(k[0].color, hexToRgb(IQ_HEX[iq.band]));
  assert.deepEqual(k[0].noteFill, hexToRgb(IQ_HEX[iq.band]));
  assert.deepEqual(k.slice(1).map((x) => x.value),
    [view.registros, view.eventos, view.impactos, view.pontos].map(fmt.fmtInt));
  assert.ok(k.slice(1).every((x) => x.note === null && x.noteFill === null));
});

test('header', () => {
  const st = defaultState();
  const m = build(st);
  assert.equal(m.now, NOW);
  assert.equal(m.header.generatedAt, 'Gerado em 14/10/2026 12:07');
  assert.equal(m.header.uploaded, null);
  assert.equal(m.docTitle, 'Relatório de impactos');
  assert.equal(m.pageTemplate, 'Página {i} de {n}');
  assert.match(m.header.period, /^Período: \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2} – \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
  assert.ok(m.header.methodNote.startsWith('Método: Limites 0,5'));
  assert.ok(m.header.methodNote.endsWith('corrida completa, sem filtros'));
  assert.equal(m.filename, 'relatorio-2026-10-02-l4-t102.pdf');

  const up = { ...raw, meta: { ...raw.meta, uploaded: true, run_id: 'up-1', title: 'Linha 4 · 02/10/2026 (arquivo enviado)' } };
  const mu = build(st, {}, up);
  const names = raw.meta.source.files.map((f) => f.name).join(', ');
  assert.equal(mu.header.uploaded, `Dados enviados: ${names} (${fmt.fmtInt(raw.meta.n)} linhas)`);
  assert.equal(mu.filename, 'relatorio-up-1.pdf');
  assert.equal(mu.header.title, 'Linha 4 · 02/10/2026 (arquivo enviado)');
});

test('map input and legend', () => {
  const st = defaultState();
  const c = ctxFor(st);
  const view = buildView(c.run, c.analysis, {});
  const m = build(st).map;
  assert.deepEqual(m.input.heat, heatPoints(c.run, c.analysis, view.mask, st.display.heatMetric, st.display.intensity));
  assert.deepEqual(m.input.heatOpts, { radius: 15, blur: 9, minOpacity: 0.3, max: 1 });
  assert.deepEqual(m.input.markers, pontoMarkers(c.run, c.analysis, view).map((x) => ({ lat: x.lat, lon: x.lon, cls: x.cls })));
  let fixes = 0;
  for (let f = 0; f < c.run.fixLat.length; f++) if (!Number.isNaN(c.run.fixLat[f])) fixes++;
  assert.equal(m.input.points.length, fixes + (c.run.stations || []).length);
  assert.equal(m.input.lineCount, 0);
  assert.equal(m.input.attribution, '© colaboradores do OpenStreetMap');
  assert.deepEqual(m.input.classColors, CLASS_HEX);
  assert.deepEqual(m.legend.classes.map((x) => x.text), ['Leve', 'Moderado', 'Severo', 'Crítico']);
  assert.deepEqual(m.legend.sentidos.map((x) => x.text), c.run.sentidos.map((s) => pdfText(s.name)));
  assert.deepEqual(m.legend.sentidos.map((x) => x.dashed), [false, true]);
  const un = unplacedCounts(c.run, c.analysis, view);
  assert.equal(m.notes[0], pdfText(semGpsNote(un.pontos, un.eventos)));
  assert.equal(m.notes.length, (c.run.gpsRejected || []).length > 0 ? 2 : 1);
  assert.equal(m.failNote, T.reportMapFail);
  assert.equal(m.missingNote, T.reportMapMissing);

  const routes = [2, 1].map((s) => JSON.parse(readFileSync(repoUrl(`site/data/routes/linha-4-sentido-${s}.geojson`), 'utf8')));
  const mr = build(st, { routes }).map;
  assert.equal(mr.input.lineCount, 1);
  assert.equal(mr.input.routes, routes);
  assert.equal(mr.legend.sentidos[0].text, 'Sentido 1: Terminal Gentileza » Praça XV');
  assert.equal(mr.legend.sentidos[1].dashed, true);
});
