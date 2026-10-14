// Upload control: button + hidden input + whole-window drag&drop, busy status, notices and banner.
import { h } from './dom.js';
import { T } from './i18n.js';
import { infoBtn } from './info.js';

let dropWired = false;

function wireDrop(onFiles) {
  if (dropWired) return;
  dropWired = true;
  const overlay = () => document.getElementById('drop-overlay');
  let depth = 0;
  const hasFiles = (e) => !!(e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files'));
  const hide = () => { depth = 0; const o = overlay(); if (o) o.hidden = true; };
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (!hasFiles(e)) return;
    depth += 1;
    const o = overlay();
    if (o) o.hidden = false;
  });
  window.addEventListener('dragover', (e) => {
    // Without preventDefault the browser would navigate to the dropped file.
    e.preventDefault();
    if (hasFiles(e)) { const o = overlay(); if (o) o.hidden = false; }
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) hide();
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    hide();
    const list = e.dataTransfer ? [...e.dataTransfer.files] : [];
    if (list.length) onFiles(list);
  });
}

export function mountUpload(el, { onFiles }) {
  const input = h('input', { type: 'file', accept: '.csv,text/csv', multiple: true, hidden: true });
  const btn = h('button', { type: 'button', class: 'upload-btn', onClick: () => input.click() }, T.upload);
  input.addEventListener('change', () => {
    const list = [...input.files];
    input.value = '';
    if (list.length) onFiles(list);
  });
  el.replaceChildren(btn, infoBtn('upload', T.upload), input);
  wireDrop(onFiles);
}

export function setBusy(busy) {
  document.getElementById('status').textContent = busy ? T.uploadBusy : '';
  const main = document.querySelector('main');
  if (main) {
    if (busy) main.setAttribute('aria-busy', 'true');
    else main.removeAttribute('aria-busy');
  }
}

function showNotice(el, message, { error }) {
  if (!el) return;
  const close = h('button', { type: 'button', class: 'notice-close', 'aria-label': T.close, onClick: () => { el.hidden = true; } }, '×');
  el.className = error ? 'notice notice--error' : 'notice';
  el.setAttribute('role', error ? 'alert' : 'status');
  el.replaceChildren(message + ' ', close);
  el.hidden = false;
}

export function showUploadError(noticeEl, message) {
  showNotice(noticeEl, message, { error: true });
}

export function showUploadInfo(noticeEl, message) {
  showNotice(noticeEl, message, { error: false });
}

export function showBanner(el, text, onBack) {
  if (!el) return;
  el.replaceChildren(text + ' ', h('button', { type: 'button', class: 'upload-back', onClick: onBack }, T.uploadBack));
  el.hidden = false;
}

export function hideBanner(el) {
  if (!el) return;
  el.hidden = true;
  el.replaceChildren();
}
