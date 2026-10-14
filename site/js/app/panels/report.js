// "Gerar PDF" header button: busy state, direct download and feedback. Touches nothing outside its own element.
import { h } from '../dom.js';
import { T } from '../i18n.js';
import { infoBtn } from '../info.js';
import { createReportAction } from '../reportaction.js';
import { loadPdfLib } from '../pdflib.js';
import { buildReport } from '../report.js';
import { renderMapImage } from '../mapshot.js';
import { renderReportPdf } from '../pdf.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function mountReport(el, { getSnapshot }) {
  const btn = h('button', { type: 'button', class: 'report-btn' }, T.report);
  const feedback = h('span', { class: 'report-feedback', 'aria-live': 'polite' });
  let timer = 0;
  const reset = () => {
    clearTimeout(timer);
    feedback.textContent = '';
    feedback.className = 'report-feedback';
    feedback.removeAttribute('role');
  };
  const onState = (s) => {
    if (s === 'busy') {
      btn.disabled = true;
      btn.textContent = T.reportBusy;
      reset();
    } else {
      btn.disabled = false;
      btn.textContent = T.report;
    }
  };
  const action = createReportAction({
    getSnapshot,
    loadLib: () => loadPdfLib(),
    buildReport,
    renderMap: (input) => renderMapImage(input),
    renderPdf: renderReportPdf,
    download: downloadBlob,
    now: Date.now,
    onState,
  });
  btn.addEventListener('click', async () => {
    const res = await action.run();
    if (res.status === 'ok') {
      feedback.textContent = T.reportOk;
      timer = setTimeout(() => { feedback.textContent = ''; }, 4000);
    } else if (res.status === 'warning') {
      feedback.className = 'report-feedback report-feedback--warn';
      feedback.textContent = res.warnings.includes('map') ? T.reportMapMissingWarning : T.reportMapWarning;
    } else if (res.status === 'error') {
      console.error(res.error);
      feedback.setAttribute('role', 'alert');
      feedback.textContent = T.reportError;
    }
  });
  el.replaceChildren(btn, infoBtn('report', T.report), feedback);
}
