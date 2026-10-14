---
phase: 14-csv-upload
plan: 03
subsystem: converter-core
tags: [csv, recovery, fromisoformat, exact-arithmetic, parity]
requires: ["14-01"]
provides:
  - "site/js/core/convert/{errors,decimal,pynum,recover,isotime,reader}.js: pure JS port of recover.py + logger_csv.py"
  - "readRun(files) -> RunData contract for plan 14-05"
affects: [14-05, 14-06]
tech-stack:
  added: []
  patterns: ["BigInt rationals for exact grid tests", "transcribed C state machines (csv.reader, fromisoformat) validated by differential fuzzing"]
key-files:
  created:
    - site/js/core/convert/errors.js
    - site/js/core/convert/decimal.js
    - site/js/core/convert/pynum.js
    - site/js/core/convert/recover.js
    - site/js/core/convert/isotime.js
    - site/js/core/convert/reader.js
    - tests/js/convert_recover.test.js
    - tests/js/convert_reader.test.js
  modified: []
key-decisions:
  - "pyIntLog10 uses a boundary table (digits 15..20) taken from the fixture instead of Math.log10: V8 and the fixture's libm differ at the 19-digit boundary (9999999999999960064 -> 19 vs 18)"
  - "isotime.js transcribes the C fromisoformat (not _pydatetime): C differs on 'HHMM.f' tz, empty time after separator, zero-offset-with-microseconds, trailing NUL"
  - "Epoch us computed exactly with BigInt beyond 8e9 s; years > ~2255 exceed 2^53 us so they are rounded exactly like JSON.parse of the fixture integer"
requirements-completed: []
duration: 75min
completed: 2026-10-14
---

# Phase 14 Plan 03: JS recovery and raw CSV reader Summary

Cell recovery (accel k/k-1 thousands rule, GPS, scaled neighbours, plain), Python-faithful `round`/`median`, a CPython `fromisoformat` port and the logger CSV reader now run in pure JS and match the Python converter on every fixture case and on the real 23,383-row run.

## Accomplishments
- All fixture sections green: recover.{accel,alt,gps,scaled,plain,key6,log10k}, pyround (Object.is, so -0 included), 61 timestamp cases, 3 whole-file cases (run_mini, synthetic-l4, single-ptbr incl. issues, stats, origin lines, source rows/delimiter/mode).
- Extra verification not committed: 1.05M random mutations of ISO strings compared with CPython 3.13 `datetime.fromisoformat` (accept/reject, us, isoformat) with 0 mismatches; `readRun` on `Results_1st.Run/raw` equals Python `read_run` (ax, az, lat, temp, vel, disp, issues, stats, origin, sensor id).
- `csv.reader` semantics reproduced (state machine, quoted multi-line fields, `splitlines` separators, last-line `line_num`), plus Python `str.strip` whitespace set.

## Task Commits
1. Task 1: exact numeric helpers + recover.js - c66632b
2. Task 2: isotime.js + reader.js + reader tests - a2584d1

## Deviations from Plan
### Auto-fixed Issues
**1. [Rule 1 - Bug] Math.log10 path replaced by boundary table**
- **Found during:** Task 1 (fixture `log10k` was the arbiter, as the plan anticipated)
- **Issue:** V8 `Math.log10(9999999999999959040)` is 19, libm used for the fixture gives 18.999999999999996.
- **Fix:** Table of the smallest n per digit count (15..20) from the fixture; digit counts < 15 never round up; > 20 falls back to Math.log10 (still bounded by Number finiteness, > 308 digits -> unrecoverable).
- **Files:** site/js/core/convert/pynum.js. **Commit:** c66632b

**2. [Rule 1 - Bug] fromisoformat port follows the C implementation, not _pydatetime**
- **Found during:** Task 2 (fixture case `-0300.5` is accepted, which _pydatetime rejects)
- **Fix:** Transcribed `parse_hh_mm_ss_ff` / `parse_isoformat_time` of `_datetimemodule.c`; fuzz-confirmed quirks: a separator with empty time is `bad_timestamp`; an all-zero tz in whole seconds is UTC even with tz microseconds; `Z` followed by NUL accepted.
- **Files:** site/js/core/convert/isotime.js. **Commit:** a2584d1

**3. [Rule 1 - Plan inaccuracy] `us` exceeds 2^53 for years beyond ~2255**
- Plan claimed |us| < 2^53 for all years 1..9999. Computed in BigInt past 8e9 s and rounded to a double once (equal to JSON.parse of the Python integer). Realistic logger dates are exact.

### Documented intentional differences
- `parsePlain`: `inf`/`nan`/underscore digit separators are rejected (Python float() accepts them); `Fraction` text `a/b` is accepted for parity.
- `parseDecimal` rejects underscores and non-finite values (reported as unrecoverable, same outcome as Python for GPS).
- Digit strings whose double is infinite (> 308 digits) are `unrecoverable`.
- The log10 boundary table pins the libm of the machine that generated the fixture (Windows); it only matters within ~1e-15 relative of a power of ten.

## Issues Encountered
The shell heredoc/Python tooling turned `\n`, `\r` and ` ` escapes into literal characters in a few JS lines; fixed by writing the escapes via explicit byte substitution and checking with `od`.

## Self-Check: PASSED
Files and commits (c66632b, a2584d1) verified present; `node --test tests/js/convert_recover.test.js tests/js/convert_reader.test.js` 19/19 and `pytest tests/test_site_static.py` green.
