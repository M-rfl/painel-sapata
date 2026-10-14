# Phase 16: Axis Orientation Popup - Research

**Researched:** 2026-10-14
**Domain:** Vanilla-JS static site (no build), native `<dialog>`, image embedding
**Confidence:** HIGH (codebase read directly, encoding sizes measured locally; `<dialog>` behaviour from platform knowledge, not re-verified against MDN, so MEDIUM on fine points listed in Pitfalls)

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase. Constraints come from the ROADMAP goal and the orchestrator brief:

- Header icon on the public dashboard (`site/`) opens a popup titled "Orientação dos eixos" with the tram image: X (red, along track), Y (green, lateral), Z (blue, vertical).
- Image embedded as a base64 data URI, with no separate image request.
- Close by button, Esc, and backdrop click. Keyboard accessible. Portuguese (pt-BR). Works at phone width.
- Source asset: `.planning/phases/16-axis-orientation-popup/orientacao-eixos.png` (1536x1024, 2.6 MB) must be re-encoded smaller (~100-200 KB) first.
</user_constraints>

<phase_requirements>
## Phase Requirements

No IDs are assigned (ROADMAP says "TBD"). Proposed: add a new `### Help` group under v1.3 in REQUIREMENTS.md and map it to Phase 16 in Traceability (update the coverage count 49 to 50).

| ID | Description | Research Support |
|----|-------------|-----------------|
| HELP-01 | User opens a popup titled "Orientação dos eixos" from a header icon and sees the vehicle image with the X (red, along track), Y (green, lateral) and Z (blue, vertical) sensor axes; the image is embedded as base64 (no extra request); closes with button, Esc or backdrop click; keyboard accessible, pt-BR, usable at phone width | Native `<dialog>` pattern, embedded WebP module, generator script, static guards (below) |
</phase_requirements>

## Summary

Nothing in the site is a modal today. The only overlay-like pattern is the `(i)` popover in `site/js/app/info.js` (button with `aria-expanded`, document-level Esc and outside-click handlers), which is not suitable for a modal image. Use a native `<dialog>` opened with `showModal()`. That gives Esc-to-close (the `cancel` event), a focus trap, inert background, `::backdrop`, and focus return to the opener, with no custom code. Backdrop click is the one thing to hand-write, and it is about 3 lines.

The header pattern is established by Phase 15: an empty `<span id="...">` slot in `<header class="top">` in `index.html`, a `mountX(el)` function in `site/js/app/panels/x.js` that does `el.replaceChildren(...)`, a call in `main.js`, Portuguese strings in `T` in `i18n.js`, CSS in `app.css`, and static guards in `tests/test_site_static.py`. Follow it exactly.

Pillow 12.2.0 is installed locally with WebP support (verified). Measured sizes at 1024 px wide: WebP q80 = 117 KB (base64 156 KB), WebP q70 = 92 KB (base64 122 KB), JPEG q80 = 151 KB. WebP is about 25% smaller than JPEG at the same visual quality and is supported by every browser the site already requires (jsPDF, ES modules, uPlot).

**Primary recommendation:** Re-encode to 1024x683 WebP (quality 78, method 6, about 105 KB, about 140 KB base64) using a reproducible generator `tools/gen_axis_image.py`; write the data URI into a generated one-line module `site/js/app/axisimage.js` (`export const AXIS_IMAGE = 'data:image/webp;base64,...'`); build a `panels/axes.js` that mounts a header icon button plus a native `<dialog>` created via the `h()` helper.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `<dialog>` + `showModal()` | platform | Modal, Esc, focus trap, backdrop | No dependency, a11y built in; project has no build/CDN |
| Existing `h()` (`site/js/app/dom.js`) | in repo | DOM construction | `innerHTML` is banned by `test_panels_do_not_use_innerhtml` |
| Pillow | 12.2.0 (local; pin in requirements-dashboard.txt) | Resize + WebP encode in the generator | Already installed; WebP supported (`features.check('webp')` True) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WebP | JPEG q72-80 | 20-30% bigger (127-151 KB at 1024); only choose if very old Safari (<14) matters. It does not here |
| Embedded JS module | Inline in `index.html` | Inline makes `index.html` 190 KB, breaks the readable shell, and the static tests regex-read it (`test_no_english_ui_words_in_html` strips only script/style). Rejected |
| Embedded JS module | `<img src="img/x.webp">` | Violates "no separate request" |
| Native `<dialog>` | ARIA div modal with hand-rolled focus trap | More code and more bugs; no benefit |

**Installation (generator only; the site needs nothing):**
```bash
python -m pip install Pillow==12.2.0   # add this line to requirements-dashboard.txt
```
Pillow is dev-only like openpyxl. CI installs requirements-dashboard.txt, so the generator test can run there; guard with `pytest.importorskip("PIL")` anyway.

## Architecture Patterns

### Recommended Project Structure
```
site/index.html                    # + <span id="axes"></span> in <header class="top"> after #report
site/js/app/axisimage.js           # GENERATED. one line: export const AXIS_IMAGE = 'data:image/webp;base64,...'
site/js/app/panels/axes.js         # mountAxes(el): icon button + <dialog>
site/js/app/i18n.js                # + T.axes* strings
site/js/app/main.js                # + import and mountAxes(document.getElementById('axes'))
site/css/app.css                   # + .axes-btn, dialog.axes-dialog, ::backdrop
tools/gen_axis_image.py            # reproducible PNG -> WebP -> data URI module
tests/test_site_static.py          # + test_axes_wiring, test_axis_image_embedded
tests/test_axis_image.py (or in static) # optional generator test, importorskip("PIL")
```

### Pattern 1: Header slot + mount function (Phase 15 pattern)
**What:** empty span in the header, `mountX(el)` fills it with `el.replaceChildren(...)`. Panels never touch anything outside their own element.
**Placement:** `<span id="axes"></span>` after `<span id="report"></span>`. Existing `test_report_wiring` asserts `upload < report < </header>`, so adding after `report` keeps it green. Note `.top` uses `align-items: baseline`; give the icon button `align-self: center`.

### Pattern 2: Native dialog with backdrop click
```javascript
// site/js/app/panels/axes.js
import { h } from '../dom.js';
import { T } from '../i18n.js';
import { AXIS_IMAGE } from '../axisimage.js';

const SVG = 'http://www.w3.org/2000/svg';
function icon() {                       // h() creates HTML-namespace elements only; build the SVG manually
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '18'); svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const p = document.createElementNS(SVG, 'path');   // 3 axes from a common origin: Z up, X right-down, Y left-down
  p.setAttribute('d', 'M12 14V3M12 14l9 5M12 14l-9 5');
  p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round');
  svg.appendChild(p);
  return svg;
}

export function mountAxes(el) {
  let dlg = null;
  const build = () => {                 // lazy: <img> (and its decode) is created only on first open
    const close = h('button', { type: 'button', class: 'axes-close', onClick: () => dlg.close() }, T.axesClose);
    const img = h('img', { src: AXIS_IMAGE, alt: T.axesAlt, class: 'axes-img', decoding: 'async' });
    dlg = h('dialog', { class: 'axes-dialog', 'aria-labelledby': 'axes-title' },
      h('div', { class: 'axes-body' },
        h('div', { class: 'axes-head' }, h('h2', { id: 'axes-title' }, T.axes), close),
        img, h('p', { class: 'axes-legend' }, T.axesLegend)));
    // Backdrop click: the dialog has padding 0, so a click whose target is the <dialog> itself is outside .axes-body
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
  };
  const btn = h('button', { type: 'button', class: 'axes-btn', 'aria-label': T.axes, title: T.axes,
    onClick: () => { if (!dlg) build(); dlg.showModal(); } });
  btn.appendChild(icon());
  el.replaceChildren(btn);
}
```
Esc: handled natively (`cancel` then `close`); do NOT add a keydown handler (it would also fight `info.js`'s document Esc handler for no reason). Focus returns to `btn` automatically on close in current browsers; if wanted for old engines, add `dlg.addEventListener('close', () => btn.focus())` (harmless).

### Pattern 3: CSS (existing tokens, no dark mode exists; UI-01 is deferred)
```css
.axes-btn { align-self: center; display: inline-flex; padding: 0.3rem; border: 1px solid var(--border); border-radius: 6px; background: var(--card); color: var(--text); cursor: pointer; }
.axes-btn:hover { background: #e0e7ff; border-color: #3730a3; color: #3730a3; }
.axes-btn:focus-visible, .axes-close:focus-visible { outline: 2px solid #3730a3; outline-offset: 2px; }
dialog.axes-dialog { padding: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--card); color: var(--text); width: min(92vw, 880px); max-height: 92vh; overflow: auto; }
dialog.axes-dialog::backdrop { background: rgba(0, 0, 0, 0.55); }
.axes-body { padding: 0.75rem 1rem 1rem; }
.axes-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.axes-head h2 { margin: 0; font-size: 1.1rem; }
.axes-img { display: block; width: 100%; height: auto; margin-top: 0.5rem; border-radius: 6px; }
.axes-legend { color: var(--muted); font-size: 0.85rem; }
```
Do not set `display` on `dialog.axes-dialog` itself (it overrides `display:none` of a closed dialog); that is why layout lives on the inner `.axes-body`. `width: min(92vw, 880px)` and `width:100%; height:auto` image make it phone-safe (360 px wide: image about 330 px). A 1024-px source covers a 3x phone screen (about 1100 device px) adequately.

### Strings (add to `T` in i18n.js; follow the existing `report*` block style)
- `axes: 'Orientação dos eixos'`
- `axesClose: 'Fechar'`
- `axesAlt: 'Bonde (VLT) visto de frente e de lado com os eixos do sensor: X em vermelho ao longo da via, Y em verde lateral, Z em azul vertical.'`
- `axesLegend: 'X (vermelho): ao longo da via. Y (verde): lateral. Z (azul): vertical.'` (the legend as visible text keeps color-blind users and screen readers covered)

Image check (viewed): Z up (blue) from a white origin dot, X (red) pointing forward along the rails, Y (green) pointing left of the vehicle. The legend should not claim sign directions beyond the image.

### Generator (`tools/gen_axis_image.py`)
```python
"""Re-encode the axis PNG to WebP and write site/js/app/axisimage.js (one line, LF). Dev tool; needs Pillow."""
import base64, io, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".planning/phases/16-axis-orientation-popup/orientacao-eixos.png"
OUT = ROOT / "site/js/app/axisimage.js"
WIDTH, QUALITY = 1024, 78

def build(src: Path = SRC) -> str:
    im = Image.open(src).convert("RGB")
    im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "WEBP", quality=QUALITY, method=6)
    uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    return ("// GENERATED by tools/gen_axis_image.py from orientacao-eixos.png. Do not edit.\n"
            f"export const AXIS_IMAGE = '{uri}';\n")

if __name__ == "__main__":
    OUT.write_bytes(build(Path(sys.argv[1]) if len(sys.argv) > 1 else SRC).encode("utf-8"))  # write_bytes: LF on Windows
```
Reproducibility caveat: WebP bytes depend on the libwebp version bundled in Pillow, so do NOT test "regenerating yields identical bytes". Test only structure/decoding (see Validation). Pin Pillow in requirements-dashboard.txt to document the version used. Keep the source PNG under `.planning/` (the asset is already there; do not copy 2.6 MB elsewhere).

### Anti-Patterns to Avoid
- **Inline base64 in `index.html`:** unreadable shell, 190 KB HTML, noisy diffs.
- **`innerHTML` for the dialog or SVG:** blocked by the static guard; use `h()` and `createElementNS`.
- **Custom Esc/keydown handler or focus trap:** native dialog already does it.
- **Styling `display` on the `<dialog>` element** or putting padding on it (breaks the `ev.target === dlg` backdrop test).
- **Putting the data URI in `i18n.js`:** keeps strings file reviewable; use a dedicated module.
- **Adding the PNG or WebP to `site/` as a file:** `test_index_urls_relative_and_resolve` is fine, but it violates the "no separate request" criterion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap / inert background / Esc | keydown + tabindex juggling | `dialog.showModal()` | Built in, correct in all current browsers |
| Backdrop | extra overlay div | `dialog::backdrop` | Native, click target is the dialog |
| Image shrinking | manual canvas/base64 by hand | Pillow in `tools/gen_axis_image.py` | Reproducible, reviewable |
| Icon asset | icon font or external SVG file | 1 inline SVG path via `createElementNS` | No requests, uses `currentColor` |

## Common Pitfalls

### Pitfall 1: Backdrop click never fires, or fires inside the content
**What goes wrong:** with padding on the `<dialog>` the padding area counts as "the dialog", and clicks near the edge do not close; or content clicks close it.
**How to avoid:** padding 0 on the dialog, content in `.axes-body`; close only when `ev.target === dlg`.
**Warning signs:** text selection drag that ends on the backdrop closing the popup is a known browser quirk (mouseup target); acceptable.

### Pitfall 2: `info.js` document Esc handler
**What goes wrong:** `info.js` listens to Escape on `document`; it only acts if `.info.open` exists, so there is no conflict, but the dialog's own Esc must not be preventDefault-ed by it. It is not. Leave as is.

### Pitfall 3: Header alignment
`.top` is `align-items: baseline`; an SVG-only button has no text baseline and may sit oddly. Use `align-self: center` on `.axes-btn`.

### Pitfall 4: Static guards scanning the data URI
`test_module_graph_resolves_and_relative` applies `IMPORT_RE`/`FETCH_RE` to every `.js` under `site/js`; base64 has no quotes or whitespace so it cannot false-match, and `_strip_comments` only strips lines that START with `//` (keep the generated header comment as a standalone line, as in the generator). `test_core_is_pure` only scans `core/`. Keep the module in `app/`.

### Pitfall 5: Windows line endings
Write with `write_bytes(...encode())` (not `write_text`, which would emit CRLF on Windows). There is no `.gitattributes` rule for `site/js`; optionally add `site/js/app/axisimage.js -text linguist-generated` so the long line is never rewritten and is collapsed in diffs.

### Pitfall 6: Python pin
The memory note says `upload_parity.json` ties CI to Python 3.13.14. Pillow does not touch that; do not alter the workflow's Python pin. Pillow 12.x supports 3.13.

### Pitfall 7: Hidden-test dialog support
`node --test` tests in this repo are DOM-free (helpers.js, pure modules). Do not try to unit-test `showModal`; put DOM behaviour under static guards plus a manual browser checkpoint (as Phase 15-06 did).

## Code Examples

main.js wiring (next to the existing `mountReport` call near line 185):
```javascript
import { mountAxes } from './panels/axes.js';
// ...
mountAxes(document.getElementById('axes'));
```
index.html:
```html
  <span id="report"></span>
  <span id="axes"></span>
</header>
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| div overlay + focus-trap JS | `<dialog>` + `showModal()` (Baseline widely available since 2022) | Esc, trap, inert, backdrop for free |
| JPEG/PNG for photos | WebP | about 25% smaller than JPEG; PNG 2.6 MB becomes about 105 KB |

## Open Questions

1. **Quality sign-off on the re-encode**
   - Known: sizes measured; text labels (X/Y/Z badges) are large and survive q70-80.
   - Unclear: visual check of q78 by the user.
   - Recommendation: the plan includes a human check at the browser checkpoint; fall back to q85 (about 130 KB, still within budget) if artifacts show around the badges.
2. **Info `(i)` button next to the icon?** Not needed: the popup is self-explanatory; skipping avoids adding an INFO key (the `info.test.js` REQUIRED list does not need updating). Recommendation: no info button.
3. **Do Y/X/Z sign directions need stating?** Only describe what the image shows (see Strings).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (static site guards, `pytest.ini` in root) and `node --test` (JS engine tests, Node 24 in CI) |
| Config file | `pytest.ini` |
| Quick run command | `python -m pytest tests/test_site_static.py -q` |
| Full suite command | `python -m pytest -q` and `node --test "tests/js/*.test.js"` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HELP-01 | `#axes` slot in header after `#report`, before `</header>`; `main.js` calls `mountAxes(`; panel uses `showModal(`, `aria-labelledby`, `ev.target === dlg`, `T.axesClose`, no `innerHTML`, no `fetch(`/`import(` | static | `pytest tests/test_site_static.py::test_axes_wiring -x` | Wave 0 |
| HELP-01 | `axisimage.js` exports a `data:image/webp;base64,` URI, decodes as base64 to a RIFF/WEBP file, size 40-250 KB (base64 under about 330 KB), file is LF-only with no `\r`; index.html still has no `data:`/`<img` and stays under 4 KB | static | `pytest tests/test_site_static.py::test_axis_image_embedded -x` | Wave 0 |
| HELP-01 | Strings pt-BR: `T.axes === 'Orientação dos eixos'`, `axesClose`, `axesAlt`, `axesLegend` exist | node | `node --test tests/js/axes_strings.test.js` (or extend an existing i18n test) | Wave 0 |
| HELP-01 | Generator builds a valid module from the PNG (Pillow present): output parses, WebP decodes to 1024 x 683 | unit | `pytest tests/test_gen_axis_image.py -x` (use `pytest.importorskip("PIL")`; skip if the PNG is absent) | Wave 0 |
| HELP-01 | Real-browser behaviour: click opens; Esc, backdrop click and Fechar close; Tab stays inside; focus returns to the icon; 360 px width fits without horizontal scroll; Network tab shows no image request | manual-only (no jsdom/browser harness in repo) | Browser checkpoint, as in 15-06 | n/a |

### Sampling Rate
- **Per task commit:** `python -m pytest tests/test_site_static.py -q`
- **Per wave merge:** `python -m pytest -q` plus `node --test "tests/js/*.test.js"`
- **Phase gate:** both full suites green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_site_static.py` additions: `test_axes_wiring`, `test_axis_image_embedded`
- [ ] `tests/test_gen_axis_image.py` (optional but recommended)
- [ ] `Pillow==12.2.0` line in `requirements-dashboard.txt`
- [ ] Existing `test_no_english_ui_words_in_html` is unaffected (no English words added)

## Sources

### Primary (HIGH confidence)
- Repo files read: `site/index.html`, `site/js/app/panels/report.js`, `info.js`, `dom.js`, `site/css/app.css`, `tests/test_site_static.py`, `tests/js/info.test.js`, `.github/workflows/*.yml`, `requirements-dashboard.txt`, `.planning/REQUIREMENTS.md`, `ROADMAP.md`, `15-05-SUMMARY.md`, `config.json`
- Local measurement with Pillow 12.2.0 (WebP/JPEG sizes at 800/960/1024 px) and a visual read of the source PNG

### Secondary (MEDIUM confidence)
- `<dialog>` semantics (Esc via `cancel`, `::backdrop`, focus restoration, backdrop click via target check): platform knowledge, not re-fetched this session; verify in the manual browser checkpoint

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - local tooling verified, no new runtime dependencies
- Architecture: HIGH - mirrors the Phase 15 pattern in this repo
- Pitfalls: MEDIUM - dialog quirks from knowledge, verified by the manual checkpoint

**Research date:** 2026-10-14
**Valid until:** 2026-11-14
