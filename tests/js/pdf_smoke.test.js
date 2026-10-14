import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolvePdfLib } from '../../site/js/app/pdflib.js';
import { renderReportPdf, toAutoCell, PAGE } from '../../site/js/app/pdf.js';
import { buildReport } from '../../site/js/app/report.js';
import { analyze } from '../../site/js/core/index.js';
import { applyGpsFilter } from '../../site/js/core/gpsfilter.js';
import { defaultState } from '../../site/js/app/state.js';
import { loadRun1, repoUrl } from './helpers.js';

// Load the vendored UMD files as classic scripts (same as the browser).
const ctx = vm.createContext({
  console, Date, TextEncoder, TextDecoder, atob, btoa, setTimeout, clearTimeout, URL, Blob, Uint8Array, ArrayBuffer,
  navigator: { userAgent: 'node-vm' },
});
vm.runInContext('var window = this; var self = this; var globalThis = this;', ctx);
for (const f of ['site/vendor/jspdf/jspdf.umd.min.js', 'site/vendor/jspdf-autotable/jspdf.plugin.autotable.min.js']) {
  vm.runInContext(readFileSync(repoUrl(f), 'utf8'), ctx, { filename: f });
}
const lib = resolvePdfLib(ctx);
assert.ok(lib, 'pdf lib resolves');

const NOW = Date.UTC(2026, 9, 14, 15, 7, 30);
const state = defaultState();
const run = applyGpsFilter(loadRun1(), state.params.gps);
const model = buildReport({ run, analysis: analyze(run, state.params), state, routes: [] }, { now: NOW });

const text = (bytes) => Buffer.from(bytes).toString('latin1');
// PDF text is WinAnsi: map the few cp1252 punctuation chars the model may contain.
const WIN = { '–': '', '—': '', '…': '', '‘': '', '’': '', '“': '', '”': '', '•': '', '€': '' };
const win = (s) => s.replace(/[–—…‘’“”•€]/g, (c) => WIN[c]).replace(/[()\\]/g, '\\$&');
const count = (hay, needle) => hay.split(needle).length - 1;

function pngDataUrl() {
  const w = 4;
  const h = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let r = 0; r < h; r++) for (let i = 0; i < w * 3; i++) raw[r * (w * 3 + 1) + 1 + i] = (i * 40 + r * 90) & 255;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  return 'data:image/png;base64,' + png.toString('base64');
}
const img = (extra = {}) => ({ dataUrl: pngDataUrl(), format: 'PNG', width: 4, height: 2, basemapFailed: false, ...extra });

function render(m = model, opts = {}) {
  const res = renderReportPdf(m, { jsPDF: lib.jsPDF, autoTable: lib.autoTable, mapImage: img(), compress: false, ...opts });
  return { ...res, txt: text(res.bytes) };
}

test('structure: A4 landscape pages and chrome', () => {
  const r = render();
  assert.ok(r.txt.startsWith('%PDF-'));
  assert.equal(r.pages, (r.txt.match(/\/Type \/Page\b(?!s)/g) || []).length);
  const boxes = r.txt.match(/\/MediaBox \[[^\]]*\]/g);
  assert.ok(boxes.length >= 1);
  for (const b of boxes) {
    const v = b.slice(11, -1).trim().split(/\s+/).map(Number);
    assert.deepEqual(v.slice(0, 2), [0, 0]);
    assert.ok(Math.abs(v[2] - 841.89) < 0.01 && Math.abs(v[3] - 595.28) < 0.01, b);
  }
  assert.ok(r.txt.includes('Relat\xf3rio de impactos'));
  assert.ok(r.txt.includes(win(model.header.title)));
  assert.ok(r.txt.includes(win(model.header.period)));
  assert.ok(r.txt.includes('Gerado em 14/10/2026 12:07'));
  assert.ok(r.txt.includes(win(model.header.methodNote.slice(0, 40))));
  for (let i = 1; i <= r.pages; i++) assert.ok(r.txt.includes(`P\xe1gina ${i} de ${r.pages}`), 'page ' + i);
  assert.ok(!r.txt.includes('\xfe\xff'));
  assert.equal(PAGE.w, 841.89);
});

test('KPIs and legend', () => {
  const r = render();
  for (const k of model.kpis) {
    assert.ok(r.txt.includes(win(k.label)), k.label);
    assert.ok(r.txt.includes(win(k.value)), k.value);
    if (k.note) assert.ok(r.txt.includes(win(k.note)), k.note);
  }
});

test('map section variants', () => {
  const ok = render(model, { mapImage: img() });
  assert.ok(ok.txt.includes('/Subtype /Image'));
  assert.ok(!ok.txt.includes(win(model.map.failNote)));
  const failed = render(model, { mapImage: img({ basemapFailed: true }) });
  assert.ok(failed.txt.includes('/Subtype /Image'));
  assert.ok(failed.txt.includes(win(model.map.failNote)));
  const none = render(model, { mapImage: null });
  assert.ok(!none.txt.includes('/Subtype /Image'));
  assert.ok(none.txt.includes(win(model.map.missingNote)));
  for (const r of [ok, failed, none]) {
    assert.ok(r.txt.includes(win(model.map.title)));
    for (const c of model.map.legend.classes) assert.ok(r.txt.includes(win(c.text)), c.text);
    for (const s of model.map.legend.sentidos) assert.ok(r.txt.includes(win(s.text)), s.text);
    for (const n of model.map.notes) assert.ok(r.txt.includes(win(n)), n);
  }
});

test('render never reads the clock', () => {
  const orig = Date.now;
  Date.now = () => { throw new Error('clock'); };
  try { render(); } finally { Date.now = orig; }
});

test('toAutoCell', () => {
  const c = toAutoCell({ text: '12', fill: [1, 2, 3], color: [4, 5, 6], align: 'right' });
  assert.deepEqual(c.styles, { fillColor: [1, 2, 3], textColor: [4, 5, 6], fontStyle: 'normal', halign: 'right' });
  assert.equal(c.content, '12');
  const d = toAutoCell({ text: 'x', bold: true, url: 'u', badge: { text: 'b' }, swatch: [9, 9, 9] });
  assert.deepEqual(Object.keys(d.styles).sort(), ['fontStyle', 'halign', 'textColor']);
  assert.equal(d.styles.fontStyle, 'bold');
  assert.equal(d.url, 'u');
  assert.deepEqual(d.swatch, [9, 9, 9]);
});

test('tables, links, badges and section order', () => {
  const r = render();
  const withUrl = model.pontos.body.flat().filter((c) => c.url);
  assert.ok(withUrl.length > 0);
  assert.equal(r.links, withUrl.length);
  assert.equal(count(r.txt, '/S /URI'), withUrl.length);
  for (const c of withUrl) assert.ok(r.txt.includes(win(c.url)), c.url);
  assert.ok(count(r.txt, 'abrir') >= r.links);

  for (const s of [model.matrices.title, model.matrices.basisLabel, model.trechos.title, model.pontos.title,
    ...model.matrices.tables.map((t) => t.caption)]) {
    assert.ok(r.txt.includes(win(s)), s);
  }
  for (const t of model.matrices.tables) assert.ok(t.caption.includes('\xbb') && !t.caption.includes('?'));
  const badges = model.trechos.body.flat().filter((c) => c.badge).length;
  assert.equal(count(r.txt, 'sem Cr\xedtico'), badges);

  const pos = [model.kpis[0].value, model.map.title, model.matrices.title, model.trechos.title, model.pontos.title]
    .map((s) => r.txt.indexOf(win(s)));
  assert.ok(pos.every((p) => p >= 0), String(pos));
  assert.deepEqual(pos.slice(1), pos.slice(1).slice().sort((a, b) => a - b));
});

test('header repeats on continuation pages', () => {
  const body = [];
  while (body.length < 120) body.push(...model.trechos.body);
  const big = { ...model, trechos: { ...model.trechos, body } };
  const base = render();
  const r = render(big);
  assert.ok(r.pages > base.pages);
  assert.ok(count(r.txt, 'Maior classe') >= 2);
});

test('one and three matrix tables', () => {
  const one = render({ ...model, matrices: { ...model.matrices, tables: model.matrices.tables.slice(0, 1) } });
  assert.ok(one.pages >= 1);
  const t = model.matrices.tables;
  const three = render({ ...model, matrices: { ...model.matrices, tables: [t[0], t[1], t[0]] } });
  assert.ok(three.pages >= 1);
});
