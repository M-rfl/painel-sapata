import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { INFO } from '../../site/js/app/i18n.js';

const dir = new URL('../../site/js/app/panels/', import.meta.url);
const sources = readdirSync(dir).filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');

const REQUIRED = [
  'kpiRegistros', 'kpiEventos', 'kpiImpactos', 'kpiPontos', 'kpiTrecho', 'kpiIQ', 'badge',
  'classes', 'classesMedicoes', 'classesImpactos', 'classesPontos', 'means', 'axisStats',
  'quality', 'qCobertura', 'qSemPosicao', 'qCanaisVazios', 'qRetorno', 'qInferidas',
  'qNaoClassificadas', 'qIrrecuperaveis', 'qAmbiguos', 'qAvisos', 'qCanais',
  'thresholds', 'fSentido', 'fTrecho', 'fEixo', 'fClasse', 'fTempo', 'display',
  'dValores', 'dMetrica', 'dRaio', 'dIntensidade',
  'charts', 'maisCanais', 'resetZoom', 'map', 'mapCalor',
];

test('every required info key has non-empty Portuguese text', () => {
  for (const k of REQUIRED) {
    assert.equal(typeof INFO[k], 'string', k);
    assert.ok(INFO[k].trim().length > 20, k);
  }
});

test('every info key used by panels exists and every required key is used', () => {
  const used = new Set();
  for (const m of sources.matchAll(/(?:infoBtn\(|line\([^\n]*?|row\([^\n]*?,\s*|group\([^\n]*?,\s*|card\([^\n]*?,\s*|block\('[^']*',\s*)'([A-Za-z]+)'/g)) used.add(m[1]);
  for (const m of sources.matchAll(/infoBtn\('([A-Za-z]+)'/g)) used.add(m[1]);
  for (const k of used) {
    if (!(k in INFO)) continue;
    assert.ok(INFO[k].trim(), k);
  }
  for (const k of REQUIRED) assert.ok(sources.includes(`'${k}'`), `key not referenced by any panel: ${k}`);
  for (const m of sources.matchAll(/infoBtn\('([A-Za-z]+)'/g)) assert.ok(m[1] in INFO, `unknown info key ${m[1]}`);
});

test('info texts are Portuguese (no obvious English filler)', () => {
  for (const [k, v] of Object.entries(INFO)) {
    assert.ok(!/\b(the|the |is a|click)\b/i.test(v), k);
  }
});
