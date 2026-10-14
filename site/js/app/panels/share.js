// "Copiar link" button with feedback, and the ignored-link-parameters notice.
import { h } from '../dom.js';
import { T } from '../i18n.js';
import { infoBtn } from '../info.js';

function legacyCopy(text) {
  const ta = h('textarea', { 'aria-hidden': 'true', readonly: true, style: { position: 'fixed', left: '-9999px', top: '0' } });
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
  ta.remove();
  return ok;
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) { /* fall through to legacy path */ }
  }
  return legacyCopy(text);
}

export function mountShare(el, getUrl) {
  const feedback = h('span', { class: 'share-feedback', 'aria-live': 'polite' });
  let timer = 0;
  let enabled = true;
  const btn = h('button', {
    type: 'button',
    class: 'share-btn',
    onClick: async () => {
      if (!enabled) return;
      const ok = await copyText(getUrl());
      feedback.textContent = ok ? T.shareOk : T.shareFail;
      clearTimeout(timer);
      timer = setTimeout(() => { feedback.textContent = ''; }, ok ? 2000 : 6000);
    },
  }, T.share);
  el.replaceChildren(btn, infoBtn('share', T.share), feedback);
  return {
    setEnabled(value) {
      enabled = !!value;
      btn.disabled = !enabled;
      if (enabled) btn.removeAttribute('title');
      else btn.title = T.shareUnavailable;
      if (!enabled) feedback.textContent = '';
    },
  };
}

export function showIgnoredNotice(el, keys) {
  if (!el) return;
  const close = h('button', { type: 'button', class: 'notice-close', 'aria-label': T.close, onClick: () => { el.hidden = true; } }, '×');
  el.replaceChildren(T.linkIgnored + ': ' + keys.join(', ') + '. ', close);
  el.hidden = false;
}
