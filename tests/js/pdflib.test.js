import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { PDF_SCRIPTS, resolvePdfLib } from '../../site/js/app/pdflib.js';
import { repoUrl } from './helpers.js';

function fakeJsPDF() { const F = function F() {}; F.API = {}; return F; }

test('PDF_SCRIPTS order', () => {
  assert.equal(PDF_SCRIPTS.length, 2);
  assert.match(PDF_SCRIPTS[0], /jspdf\.umd/);
  assert.match(PDF_SCRIPTS[1], /autotable/);
});

test('global autoTable function', () => {
  const F = fakeJsPDF(); const fn = () => {};
  const r = resolvePdfLib({ jspdf: { jsPDF: F }, autoTable: fn });
  assert.equal(r.jsPDF, F); assert.equal(r.autoTable, fn);
});

test('API.autoTable wrapper', () => {
  const F = fakeJsPDF(); const calls = [];
  F.API.autoTable = () => {};
  const r = resolvePdfLib({ jspdf: { jsPDF: F } });
  const doc = { autoTable: (o) => calls.push(o) };
  assert.equal(r.autoTable(doc, { a: 1 }), undefined);
  assert.deepEqual(calls, [{ a: 1 }]);
});

test('applyPlugin fallback', () => {
  const F = fakeJsPDF(); let n = 0;
  const ap = (X) => { n++; X.API.autoTable = () => {}; };
  const r = resolvePdfLib({ jspdf: { jsPDF: F }, applyPlugin: ap });
  assert.equal(n, 1); assert.equal(typeof r.autoTable, 'function');
});

test('null cases never throw', () => {
  assert.equal(resolvePdfLib({}), null);
  assert.equal(resolvePdfLib(null), null);
  assert.equal(resolvePdfLib({ jspdf: { jsPDF: fakeJsPDF() } }), null);
  assert.equal(resolvePdfLib({ autoTable: () => {} }), null);
  assert.equal(resolvePdfLib({ jspdf: { jsPDF: fakeJsPDF() }, applyPlugin() { throw new Error('x'); } }), null);
});

test('real UMD files as classic scripts in a vm sandbox', (t) => {
  const files = ['site/vendor/jspdf/jspdf.umd.min.js', 'site/vendor/jspdf-autotable/jspdf.plugin.autotable.min.js'];
  const ctx = vm.createContext({ console, TextEncoder, TextDecoder, atob, btoa, setTimeout, clearTimeout, URL, Blob, Uint8Array, ArrayBuffer, navigator: { userAgent: 'node-vm' } });
  vm.runInContext('var window = this; var self = this; var globalThis = this;', ctx);
  for (const f of files) vm.runInContext(readFileSync(repoUrl(f), 'utf8'), ctx, { filename: f });
  t.diagnostic('globals: ' + Object.keys(ctx).filter((k) => /pdf|auto|plugin/i.test(k)).join(','));
  const lib = resolvePdfLib(ctx);
  assert.notEqual(lib, null);
  const doc = new lib.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  lib.autoTable(doc, { head: [['a']], body: [['b']] });
  assert.ok(doc.lastAutoTable.finalY > 0);
  t.diagnostic('branch: ' + (typeof ctx.autoTable === 'function' ? 'global autoTable' : (ctx.applyPlugin ? 'applyPlugin/API' : 'API.autoTable')));
});
