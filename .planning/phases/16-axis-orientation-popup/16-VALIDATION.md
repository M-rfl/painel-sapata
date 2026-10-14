---
phase: 16
slug: axis-orientation-popup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-14
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (static site guards) + `node --test` (JS, Node 24 in CI) |
| **Config file** | `pytest.ini` |
| **Quick run command** | `python -m pytest tests/test_site_static.py -q` |
| **Full suite command** | `python -m pytest -q` and `node --test "tests/js/*.test.js"` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest tests/test_site_static.py -q`
- **After every plan wave:** Run `python -m pytest -q` and `node --test "tests/js/*.test.js"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| (filled by planner/executor) | | | HELP-01 | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_site_static.py` — `test_axes_wiring`, `test_axis_image_embedded` (HELP-01)
- [ ] `tests/test_gen_axis_image.py` — generator builds a valid WebP module, 1024×683 (`importorskip("PIL")`)
- [ ] `Pillow==12.2.0` in `requirements-dashboard.txt`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dialog behaviour in a real browser | HELP-01 | No jsdom/browser harness in repo | Click the header icon → popup "Orientação dos eixos" opens; Esc, backdrop click and "Fechar" close it; Tab stays inside; focus returns to the icon; no horizontal scroll at 360 px; Network tab shows no image request; image has no visible artifacts around the X/Y/Z badges |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
