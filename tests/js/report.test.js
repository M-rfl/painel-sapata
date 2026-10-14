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
