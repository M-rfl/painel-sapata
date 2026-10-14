import test from 'node:test';
import assert from 'node:assert/strict';
import { T } from '../../site/js/app/i18n.js';

test('axes strings are pt-BR', () => {
  assert.equal(T.axes, 'Orientação dos eixos');
  assert.equal(T.axesClose, 'Fechar');
  assert.equal(T.axesLegend, 'X (vermelho): ao longo da via. Y (verde): lateral. Z (azul): vertical.');
  assert.equal(typeof T.axesAlt, 'string');
  for (const w of ['X', 'Y', 'Z', 'vermelho', 'verde', 'azul']) assert.ok(T.axesAlt.includes(w), w);
  for (const k of ['axes', 'axesClose', 'axesAlt', 'axesLegend']) {
    for (const bad of ['Close', 'Axis', 'axes orientation']) assert.ok(!T[k].includes(bad), `${k}:${bad}`);
  }
});
