// PDF renderer: maps the pure report model to jsPDF calls. jsPDF/autoTable are injected; no DOM, no clock.
import { TEXT_RGB, MUTED_RGB } from './report.js';

export const PAGE = { w: 841.89, h: 595.28, margin: 28, top: 52, bottom: 36 };

const BORDER_RGB = [229, 231, 235];
const WHITE_RGB = [255, 255, 255];

/** Model cell -> autotable cell (custom props survive into d.cell.raw). */
export function toAutoCell(cell) {
  const styles = {
    fillColor: cell.fill,
    textColor: cell.color ?? TEXT_RGB,
    fontStyle: cell.bold ? 'bold' : 'normal',
    halign: cell.align ?? 'left',
  };
  for (const k of Object.keys(styles)) if (styles[k] === undefined) delete styles[k];
  return { content: cell.text, url: cell.url, badge: cell.badge, swatch: cell.swatch, styles };
}

function hooks(doc, counter) {
  return {
    didParseCell(d) {
      if (d.section !== 'body') return;
      const raw = d.cell.raw;
      if (!raw || typeof raw !== 'object') return;
      const pad = d.cell.styles.cellPadding;
      const p = typeof pad === 'number' ? { top: pad, right: pad, bottom: pad, left: pad } : { ...pad };
      let changed = false;
      if (raw.swatch) { p.left += 10; changed = true; }
      if (raw.badge) {
        const prev = doc.getFontSize();
        doc.setFontSize(6.5);
        p.right += doc.getTextWidth(raw.badge.text) * 0.85 + 10;
        doc.setFontSize(prev);
        changed = true;
      }
      if (changed) d.cell.styles.cellPadding = p;
    },
    didDrawCell(d) {
      if (d.section !== 'body') return;
      const raw = d.cell.raw;
      if (!raw || typeof raw !== 'object') return;
      const { x, y, width: w, height: h } = d.cell;
      if (raw.swatch) {
        doc.setFillColor(...raw.swatch);
        doc.circle(x + 6, y + h / 2, 3, 'F');
      }
      if (raw.badge) {
        const prev = doc.getFontSize();
        doc.setFontSize(6.5);
        const tw = doc.getTextWidth(raw.badge.text);
        const bw = tw + 8;
        const bh = 10;
        const bx = x + w - bw - 3;
        const by = y + (h - bh) / 2;
        doc.setFillColor(...raw.badge.fill);
        doc.roundedRect(bx, by, bw, bh, 3, 3, 'F');
        doc.setTextColor(...raw.badge.color);
        doc.text(raw.badge.text, bx + 4, by + 7.2);
        doc.setFontSize(prev);
      }
      if (raw.url) {
        doc.link(x, y, w, h, { url: raw.url });
        counter.links++;
      }
    },
  };
}

export function renderReportPdf(model, { jsPDF, autoTable, mapImage = null, compress = true }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress });
  doc.setCreationDate(new Date(model.now));
  doc.setProperties({ title: model.docTitle + ' - ' + model.header.title, creator: 'Painel Sapata' });
  doc.setFont('helvetica', 'normal');

  const counter = { links: 0 };
  const cw = PAGE.w - 2 * PAGE.margin;
  let y = PAGE.top;

  const ensure = (height) => {
    if (y + height > PAGE.h - PAGE.bottom) {
      doc.addPage();
      y = PAGE.top;
    }
  };
  const font = (size, style = 'normal', color = TEXT_RGB) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  // ---- header block ----
  font(16, 'bold');
  doc.text(model.docTitle, PAGE.margin, y + 12);
  y += 20;
  font(11);
  doc.text(model.header.title, PAGE.margin, y + 8);
  y += 15;
  font(9, 'normal', MUTED_RGB);
  doc.text(model.header.period, PAGE.margin, y + 7);
  y += 12;
  doc.text(model.header.generatedAt, PAGE.margin, y + 7);
  y += 12;
  if (model.header.uploaded) {
    font(9, 'bold');
    doc.text(model.header.uploaded, PAGE.margin, y + 7);
    y += 12;
  }
  font(8.5, 'normal', MUTED_RGB);
  const noteLines = doc.splitTextToSize(model.header.methodNote, cw);
  doc.text(noteLines, PAGE.margin, y + 7);
  y += noteLines.length * 10.5 + 8;

  // ---- KPI cards ----
  const gap = 8;
  const kw = (cw - gap * (model.kpis.length - 1)) / model.kpis.length;
  const kh = 48;
  ensure(kh + 10);
  model.kpis.forEach((k, i) => {
    const x = PAGE.margin + i * (kw + gap);
    doc.setDrawColor(...BORDER_RGB);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, kw, kh, 3, 3, 'S');
    font(8, 'normal', MUTED_RGB);
    doc.text(k.label, x + 8, y + 14);
    font(15, 'bold', k.color);
    doc.text(k.value, x + 8, y + 36);
    if (k.note) {
      const vw = doc.getTextWidth(k.value);
      font(8, 'bold', WHITE_RGB);
      const nw = doc.getTextWidth(k.note) + 10;
      const nx = x + 8 + vw + 8;
      doc.setFillColor(...k.noteFill);
      doc.roundedRect(nx, y + 25, nw, 14, 7, 7, 'F');
      font(8, 'bold', WHITE_RGB);
      doc.text(k.note, nx + 5, y + 35);
    }
  });
  y += kh + 14;

  // ---- map section ----
  const mapH = cw * 420 / 1000;
  const legendH = 44 + model.map.notes.length * 11;
  ensure(18 + mapH + legendH);
  font(11, 'bold');
  doc.text(model.map.title, PAGE.margin, y + 9);
  y += 16;
  if (mapImage) {
    doc.addImage(mapImage.dataUrl, mapImage.format, PAGE.margin, y, cw, mapH);
    doc.setDrawColor(...BORDER_RGB);
    doc.setLineWidth(0.6);
    doc.rect(PAGE.margin, y, cw, mapH, 'S');
    y += mapH + 4;
    if (mapImage.basemapFailed) {
      font(8, 'normal', MUTED_RGB);
      doc.text(model.map.failNote, PAGE.margin, y + 7);
      y += 11;
    }
  } else {
    doc.setFillColor(244, 245, 247);
    doc.rect(PAGE.margin, y, cw, mapH, 'F');
    font(9, 'normal', MUTED_RGB);
    doc.text(model.map.missingNote, PAGE.margin + cw / 2, y + mapH / 2, { align: 'center' });
    y += mapH + 4;
  }
  // legend
  y += 4;
  let lx = PAGE.margin;
  const legendItem = (width) => {
    if (lx + width > PAGE.margin + cw) { lx = PAGE.margin; y += 14; }
  };
  font(8);
  for (const s of model.map.legend.sentidos) {
    const tw = doc.getTextWidth(s.text);
    legendItem(18 + 4 + tw + 14);
    doc.setDrawColor(...s.color);
    doc.setLineWidth(2);
    if (s.dashed) doc.setLineDashPattern([6, 4], 0);
    doc.line(lx, y + 4, lx + 18, y + 4);
    if (s.dashed) doc.setLineDashPattern([], 0);
    font(8);
    doc.text(s.text, lx + 22, y + 7);
    lx += 22 + tw + 14;
  }
  doc.setLineWidth(0.6);
  for (const c of model.map.legend.classes) {
    font(8);
    const tw = doc.getTextWidth(c.text);
    legendItem(10 + tw + 14);
    doc.setFillColor(...c.color);
    doc.circle(lx + 3, y + 4, 3, 'F');
    doc.text(c.text, lx + 10, y + 7);
    lx += 10 + tw + 14;
  }
  y += 16;
  font(8, 'normal', MUTED_RGB);
  for (const n of model.map.notes) {
    doc.text(n, PAGE.margin, y + 7);
    y += 11;
  }
  y += 8;

  // ---- tables ----
  const common = (extraMargin = {}) => ({
    margin: { left: PAGE.margin, right: PAGE.margin, top: PAGE.top, bottom: PAGE.bottom, ...extraMargin },
    showHead: 'everyPage',
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2, lineColor: BORDER_RGB, lineWidth: 0.4, textColor: TEXT_RGB },
    headStyles: { fillColor: [244, 245, 247], textColor: TEXT_RGB, fontStyle: 'bold' },
    ...hooks(doc, counter),
  });
  const bodyOf = (t) => t.body.map((r) => r.map(toAutoCell));

  // matrices
  ensure(60);
  font(11, 'bold');
  doc.text(model.matrices.title, PAGE.margin, y + 9);
  y += 14;
  font(8.5, 'normal', MUTED_RGB);
  doc.text(model.matrices.basisLabel, PAGE.margin, y + 7);
  y += 16;
  const tables = model.matrices.tables;
  const half = PAGE.w / 2 + 6;
  for (let i = 0; i < tables.length; i += 2) {
    const pair = tables.slice(i, i + 2);
    const maxRows = Math.max(...pair.map((t) => t.body.length));
    ensure((maxRows + 2) * 13 + 16);
    const startY = y + 12;
    let bottom = startY;
    const page0 = doc.getNumberOfPages();
    pair.forEach((t, j) => {
      doc.setPage(page0);
      font(9, 'bold');
      const single = pair.length === 1;
      const left = single || j === 0 ? PAGE.margin : half;
      doc.text(t.caption, left, y + 8);
      const extra = single ? {} : (j === 0 ? { right: half } : { left: half });
      autoTable(doc, { ...common(extra), head: [t.head], body: bodyOf(t), startY });
      bottom = Math.max(bottom, doc.lastAutoTable.finalY);
    });
    y = bottom + 14;
  }

  // trecho table
  ensure(14 + 3 * 14 + 14);
  font(11, 'bold');
  doc.text(model.trechos.title, PAGE.margin, y + 9);
  y += 14;
  autoTable(doc, { ...common(), head: [model.trechos.head], body: bodyOf(model.trechos), startY: y });
  y = doc.lastAutoTable.finalY + 14;

  // pontos table
  ensure(14 + 3 * 14 + 14);
  font(11, 'bold');
  doc.text(model.pontos.title, PAGE.margin, y + 9);
  y += 14;
  autoTable(doc, { ...common(), head: [model.pontos.head], body: bodyOf(model.pontos), startY: y });
  y = doc.lastAutoTable.finalY + 14;

  // ---- page chrome (second pass) ----
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    font(8, 'normal', MUTED_RGB);
    doc.text(`${model.docTitle} · ${model.header.title}`, PAGE.margin, 28);
    doc.text(model.header.generatedAt, PAGE.w - PAGE.margin, 28, { align: 'right' });
    doc.text(model.pageTemplate.replace('{i}', String(i)).replace('{n}', String(n)), PAGE.w - PAGE.margin, PAGE.h - 18, { align: 'right' });
  }

  return { bytes: doc.output('arraybuffer'), pages: n, links: counter.links };
}
