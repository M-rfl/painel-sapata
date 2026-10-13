// Accessible "(i)" info button + popover. No DOM access at import time.
// Button toggles aria-expanded; Esc, outside click/tap and a second activation close it.
import { h } from './dom.js';
import { INFO, INFO_LABEL, INFO_CLOSE } from './i18n.js';

let seq = 0;
let wired = false;

function closeAll(except) {
  for (const wrap of document.querySelectorAll('.info.open')) {
    if (wrap === except) continue;
    setOpen(wrap, false);
  }
}

function setOpen(wrap, open) {
  const btn = wrap.querySelector('.info-btn');
  const pop = wrap.querySelector('.info-pop');
  wrap.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  btn.setAttribute('aria-label', (open ? INFO_CLOSE : INFO_LABEL) + ': ' + btn.dataset.name);
  pop.hidden = !open;
}

function wire() {
  if (wired) return;
  wired = true;
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const open = document.querySelector('.info.open');
    if (!open) return;
    setOpen(open, false);
    open.querySelector('.info-btn').focus();
  });
  document.addEventListener('click', (ev) => {
    const inside = ev.target.closest && ev.target.closest('.info');
    closeAll(inside || null);
  });
}

/** Info button for the INFO[key] text; `name` is the card/parameter name used in the aria-label. */
export function infoBtn(key, name) {
  wire();
  const text = INFO[key];
  const id = `info-${key}-${++seq}`;
  const btn = h('button', {
    type: 'button', class: 'info-btn', 'aria-expanded': 'false', 'aria-controls': id,
    'aria-label': `${INFO_LABEL}: ${name || key}`, dataset: { name: name || key },
    onClick: (ev) => {
      ev.preventDefault();
      const wrap = ev.currentTarget.closest('.info');
      const open = !wrap.classList.contains('open');
      closeAll(wrap);
      setOpen(wrap, open);
    },
  }, 'i');
  const pop = h('span', { class: 'info-pop', id, role: 'note', hidden: true }, text);
  return h('span', { class: 'info' }, btn, pop);
}
