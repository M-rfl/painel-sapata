// Lazy loader for the vendored PDF libraries. resolvePdfLib is pure; loadPdfLib touches the DOM only when called.

// Relative to index.html; order matters: jsPDF first.
export const PDF_SCRIPTS = [
  'vendor/jspdf/jspdf.umd.min.js',
  'vendor/jspdf-autotable/jspdf.plugin.autotable.min.js',
];

function viaApi(jsPDF) {
  if (jsPDF.API && typeof jsPDF.API.autoTable === 'function') {
    return (doc, opts) => { doc.autoTable(opts); };
  }
  return null;
}

export function resolvePdfLib(g) {
  try {
    const jsPDF = g && g.jspdf && g.jspdf.jsPDF;
    if (typeof jsPDF !== 'function') return null;
    let autoTable = null;
    if (typeof g.autoTable === 'function') autoTable = g.autoTable;
    else autoTable = viaApi(jsPDF);
    if (!autoTable && typeof g.applyPlugin === 'function') {
      g.applyPlugin(jsPDF);
      autoTable = viaApi(jsPDF);
    }
    return autoTable ? { jsPDF, autoTable } : null;
  } catch (e) {
    return null;
  }
}

let memo = null;

function injectScript(doc, src) {
  return new Promise((resolve, reject) => {
    const el = doc.createElement('script');
    el.src = src;
    el.async = false;
    el.addEventListener('load', () => resolve());
    el.addEventListener('error', () => reject(new Error('pdf_lib_unavailable')));
    doc.head.appendChild(el);
  });
}

export function loadPdfLib(doc = globalThis.document, g = globalThis) {
  if (memo) return memo;
  const ready = resolvePdfLib(g);
  if (ready) return Promise.resolve(ready);
  memo = (async () => {
    for (const src of PDF_SCRIPTS) await injectScript(doc, src);
    const lib = resolvePdfLib(g);
    if (!lib) throw new Error('pdf_lib_unavailable');
    return lib;
  })();
  memo.catch(() => { memo = null; });
  return memo;
}
