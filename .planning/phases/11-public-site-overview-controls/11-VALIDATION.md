---
phase: 11
slug: public-site-overview-controls
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-08
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node ≥ 22.7; local Node 24) for JS; pytest for Python |
| **Config file** | `pytest.ini` (slow deselected); none for Node (no package.json) |
| **Quick run command** | `node --test "tests/js/*.test.js"` |
| **Full suite command** | `pytest` and `node --test "tests/js/*.test.js"` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/js/*.test.js"` (plus the specific pytest file when touching workflow/static checks)
- **After every plan wave:** Run `pytest` and the full `node --test "tests/js/*.test.js"`
- **Before `/gsd:verify-work`:** Full suite must be green, a green Actions run on the pushed remote, and a human check of the public URL
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | — | — | PUB-02 | pytest | `pytest tests/test_pages_workflow.py -x` | ❌ W0 | ⬜ pending |
| TBD | — | — | PUB-01 | pytest | `pytest tests/test_site_static.py -x` | ❌ W0 | ⬜ pending |
| TBD | — | — | PUB-03, PARAM-01 | node | `node --test tests/js/format.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | PARAM-01, PARAM-03, PARAM-05 | node | `node --test tests/js/state.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | KPI-01, KPI-02, PARAM-02 | node | `node --test tests/js/view.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | KPI-03, KPI-04 | node | `node --test tests/js/stats.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | KPI-05 | node | `node --test tests/js/quality.test.js` | ❌ W0 | ⬜ pending |

*Task IDs are filled in by the planner. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/js/format.test.js` — PUB-03, PARAM-01
- [ ] `tests/js/stats.test.js` — KPI-03, KPI-04
- [ ] `tests/js/view.test.js` — KPI-01, KPI-02, PARAM-02
- [ ] `tests/js/state.test.js` — PARAM-01/03/05 (state in a DOM-free module)
- [ ] `tests/js/quality.test.js` — KPI-05
- [ ] `tests/test_pages_workflow.py`, `tests/test_site_static.py` — PUB-01, PUB-02

*No framework install needed — Node and pytest already present.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Public remote exists and Pages URL answers 200 | REPO-02 | Needs the user's GitHub account and repo creation | Create the public remote, push, set Pages source to "GitHub Actions", run `gh api repos/{owner}/{repo}/pages`, open the URL |
| Layout, labels, tooltips, error styling, no console errors | PUB-03, PARAM-01..05 | No headless browser in the stack | `python -m http.server -d site`, open in a browser, exercise thresholds/filters/reset |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
