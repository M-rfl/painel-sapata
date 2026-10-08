---
phase: 9
slug: repo-hygiene-raw-csv-converter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-08
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 |
| **Config file** | `pytest.ini` (exists; add `slow` marker) |
| **Quick run command** | `python -m pytest tests/test_dashboard_converter_recover.py tests/test_dashboard_converter_stations.py tests/test_dashboard_converter_geofence.py -x` |
| **Full suite command** | `python -m pytest` (must keep the 95 logger tests green) |
| **Estimated runtime** | ~30 seconds quick (synthetic); full suite excludes `slow` workbook read unless `-m slow` |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run `python -m pytest`
- **Before `/gsd:verify-work`:** Full suite green + one manual converter run with `--workbook` showing "OK" on exact-match rows
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Task IDs are filled in by the planner; requirement → test mapping below is the contract.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | REPO-01 | integration (git) | `python -m pytest tests/test_repo_hygiene.py -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONV-01 | integration | `python -m pytest tests/test_dashboard_converter_cli.py -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONV-02 | unit | `python -m pytest tests/test_dashboard_converter_recover.py -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONV-02 | integration (skipif raw missing) | `python -m pytest tests/test_dashboard_converter_real.py -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONV-03 | unit | `python -m pytest tests/test_dashboard_converter_stations.py tests/test_dashboard_converter_geofence.py -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONV-04 | unit + real | `python -m pytest tests/test_dashboard_converter_geofence.py tests/test_dashboard_converter_real.py -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONV-05 | unit + real | `python -m pytest tests/test_dashboard_converter_geofence.py tests/test_dashboard_converter_real.py -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONV-06 | unit | `python -m pytest tests/test_dashboard_converter_writer.py -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONV-07 | integration (CI) | `python -m pytest tests/test_dashboard_site_json.py -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONV-07 | integration (slow, skipif workbook missing) | `python -m pytest tests/test_dashboard_converter_validate.py -x -m slow` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_dashboard_converter_*.py`, `tests/test_dashboard_site_json.py`, `tests/test_repo_hygiene.py` — new
- [ ] `tests/fixtures/` tiny comma and `;` CSV samples (incl. `-10.625`, `-103.125`, `0.375`, `-2.289.879.276.454.220`, `21.650.000.000.000.000`, empty GPS rows) and `golden_run1.json`
- [ ] `tools/__init__.py`, `tools/dashboard_converter/`, `requirements-dashboard.txt`
- [ ] Register `slow` marker in `pytest.ini`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `.gitignore` is the first commit of the milestone | REPO-01 | Commit ordering is history, not code state | `git log --oneline` after phase: the `.gitignore` commit precedes all converter commits of v1.3 |
| Validation report readability (side-by-side pontos/trecho with explanations) | CONV-07 | Explanation quality is a judgement | Run converter with `--workbook`, read the report |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
