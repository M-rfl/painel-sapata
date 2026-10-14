// Axis orientation popup: header icon + native <dialog> with the embedded image (Phase 16).
import { h } from '../dom.js';
import { T } from '../i18n.js';
import { AXIS_IMAGE } from '../axisimage.js';

const SVG = 'http://www.w3.org/2000/svg';

function icon() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', 'M12 14V3M12 14l9 5M12 14l-9 5');
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '2');
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(p);
  return svg;
}

export function mountAxes(el) {
  let dlg = null;
  const build = () => {
    const closeBtn = h('button', { type: 'button', class: 'axes-close', onClick: () => dlg.close() }, T.axesClose);
    const img = h('img', { src: AXIS_IMAGE, alt: T.axesAlt, class: 'axes-img', decoding: 'async', width: 1024, height: 683 });
    dlg = h('dialog', { class: 'axes-dialog', 'aria-labelledby': 'axes-title' },
      h('div', { class: 'axes-body' },
        h('div', { class: 'axes-head' }, h('h2', { id: 'axes-title' }, T.axes), closeBtn),
        img,
        h('p', { class: 'axes-legend' }, T.axesLegend)));
    // Backdrop click: dialog has no padding, so a click targeting the dialog itself is outside .axes-body.
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => btn.focus());
    document.body.appendChild(dlg);
  };
  const btn = h('button', {
    type: 'button', class: 'axes-btn', 'aria-label': T.axes, title: T.axes, 'aria-haspopup': 'dialog',
    onClick: () => { if (!dlg) build(); if (!dlg.open) dlg.showModal(); },
  });
  btn.appendChild(icon());
  el.replaceChildren(btn);
}
