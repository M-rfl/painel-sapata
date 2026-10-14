---
phase: 14-csv-upload
plan: 06
subsystem: upload-ui
tags: [upload, drag-drop, i18n, pt-BR, csv-upload]
requires: ["14-02", "14-05"]
provides:
  - "app/uploadio.js: isCsvName, selectCsv, readSelected, errorMessage, failureNotice, loadedMessage, bannerText"
  - "app/upload.js: mountUpload, setBusy, showUploadError, showUploadInfo, showBanner, hideBanner"
  - "main.js handleFiles -> session.tryLoad; lazy stations.json"
affects: [14-07]
key-files:
  created: [site/js/app/uploadio.js, site/js/app/upload.js, tests/js/upload_io.test.js]
  modified: [site/js/app/main.js, site/js/app/i18n.js, site/index.html, site/css/app.css, tests/js/info.test.js, tests/js/format.test.js, tests/test_site_static.py]
key-decisions:
  - "Error notice = uploadFailed + reason + uploadKept (failureNotice); errorMessage returns the reason only"
  - "stations.json fetched lazily on first upload and cached; failure clears cache and raises stations_unavailable"
metrics:
  duration: ~20min
  completed: 2026-10-14
---

# Phase 14 Plan 06: Upload UI and wiring Summary

Header "Carregar CSV" button plus whole-window drop zone feed a `.csv`-only, capped, fatal-UTF-8 reader into `convertFiles` through `session.tryLoad`, with pt-BR errors, a "dados enviados" banner and "Voltar à corrida de exemplo".

## Commits
- 17dd5c5 uploadio.js + i18n + node tests
- 833e636 upload.js, index.html shell, CSS, info test
- b2221f2 main.js wiring and static guards

## Verification
- `node --test tests/js/*.test.js`: 241 pass, 0 fail.
- `pytest tests/test_site_static.py tests/test_upload_fixture.py`: green.
- Browser smoke not run (full check is 14-07).

## Deviations from Plan
**[Rule 3 - Blocking] format.test.js i18n test** asserted every `T` value is a string; the nested `T.uploadErrors` object broke it. Test now flattens nested objects (still checks every string). Also added upload.js to the info test's scanned sources as planned.

## Self-Check: PASSED
