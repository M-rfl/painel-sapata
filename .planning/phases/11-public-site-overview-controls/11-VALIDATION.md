---
phase: 11
slug: public-site-overview-controls
status: planned
nyquist_compliant: true
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
| 11-01-T1 | 11-01 | 1 | PUB-03, PARAM-01 | node | `node --test tests/js/format.test.js` | ❌ W0 (created in task) | ⬜ pending |
| 11-01-T2 | 11-01 | 1 | PARAM-01, PARAM-03, PARAM-05 | node | `node --test tests/js/state.test.js tests/js/format.test.js` | ❌ W0 (created in task) | ⬜ pending |
| 11-02-T1 | 11-02 | 1 | PARAM-02, KPI-01, KPI-02 | node | `node --test tests/js/view.test.js` | ❌ W0 (created in task) | ⬜ pending |
| 11-02-T2 | 11-02 | 1 | KPI-01, KPI-02 | node (run-1 golden) | `node --test "tests/js/*.test.js"` | ❌ W0 | ⬜ pending |
| 11-03-T1 | 11-03 | 1 | KPI-03, KPI-04 | node | `node --test tests/js/stats.test.js` | ❌ W0 (created in task) | ⬜ pending |
| 11-03-T2 | 11-03 | 1 | KPI-05 | node | `node --test "tests/js/*.test.js"` (quality.test.js) | ❌ W0 (created in task) | ⬜ pending |
| 11-04-T1 | 11-04 | 1 | PUB-02 | pytest + node (clean clone) | `python -m pytest -q && node --test "tests/js/*.test.js"` | ✅ | ⬜ pending |
| 11-04-T2 | 11-04 | 1 | PUB-01, PUB-02 | pytest | `python -m pytest tests/test_pages_workflow.py -x -q` | ❌ W0 (created in task) | ⬜ pending |
| 11-05-T1 | 11-05 | 2 | PUB-01, PUB-03 | pytest | `python -m pytest tests/test_site_static.py -x -q` | ❌ W0 (created in task) | ⬜ pending |
| 11-05-T2 | 11-05 | 2 | KPI-01..05, PUB-03 | pytest + node import smoke | `python -m pytest tests/test_site_static.py -q && node --test "tests/js/*.test.js"` | ✅ after T1 | ⬜ pending |
| 11-06-T1 | 11-06 | 3 | PARAM-01, PARAM-02, PARAM-03, PARAM-05 | pytest + node | `python -m pytest tests/test_site_static.py -q && node --test "tests/js/*.test.js"` | ✅ | ⬜ pending |
| 11-06-T2 | 11-06 | 3 | PUB-03 (docs) | pytest | `python -m pytest tests/test_docs.py -q` | ✅ | ⬜ pending |
| 11-06-T3 | 11-06 | 3 | PARAM-01..05, KPI-01..05 | manual (human-verify, local) | `curl -sI http://localhost:8000/data/run-2026-10-02-l4-t102.json` | n/a | ⬜ pending |
| 11-07-T1 | 11-07 | 4 | REPO-02 (pre-push review) | pytest + node + git | `python -m pytest -q && node --test "tests/js/*.test.js" && git status --short` | ✅ | ⬜ pending |
| 11-07-T2 | 11-07 | 4 | REPO-02 | manual (human-action: remote, push, Pages source, GPS precision) | n/a | n/a | ⬜ pending |
| 11-07-T3 | 11-07 | 4 | REPO-02, PUB-01, PUB-02 | gh (read-only) + curl + pytest | `gh run list --workflow pages.yml --limit 1 --json conclusion` + `python -m pytest tests/test_docs.py tests/test_pages_workflow.py -q` | ✅ | ⬜ pending |
| 11-07-T4 | 11-07 | 4 | PUB-01 | manual (human-verify, public URL) | `curl -sSI <pages url>` | n/a | ⬜ pending |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (each test file is created in the same task as its code, TDD)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
