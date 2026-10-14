# WTVB01 Notebook Logger

## What This Is

Aplicação Python para aquisição contínua de dados do acelerômetro industrial WitMotion WTVB01-485 via Modbus RTU/RS-485, conectado a um notebook por conversor USB–RS485. Lê aceleração, velocidade de vibração, deslocamento, frequência e temperatura em tempo real, exibe no terminal e salva em CSV com timestamp fuso America/Sao_Paulo. `--gui` abre janela matplotlib com 5 subplots animados. Projetada para uso em Windows, com compatibilidade Linux/macOS.

O projeto também inclui um **painel web público** (GitHub Pages, em português) para análise pós-corrida: um conversor Python transforma os CSVs brutos do logger em JSON, e o site recalcula no navegador classes de severidade, eventos, impactos, pontos e prioridade por trecho, com gráficos, mapa, matriz, rankings, upload de CSV e relatório PDF.

**First field campaign done (2026-10-02):** VLT Carioca · Linha 4 · Trem 102 (MRO 102), sapata coletora, 00:30–01:58, 23.383 registros (~5 Hz), both sentidos (TIG-PXV / PXV-TIG), 21 trechos. Pre-treated result in `Results_1st.Run/Final - Monitoramento de Sapata coletora - Linha 04.xlsx` (12 sheets), now used only as the validation reference.

## Current State

**Shipped: v1.3 Field Run Dashboard (2026-10-14).** The public dashboard is at https://github.com/M-rfl/painel-sapata (GitHub Pages, deployed by Actions only after pytest and `node --test` pass). What it has:
- `python -m tools.dashboard_converter` turns raw logger CSVs into schema-1 site JSON. Trecho comes from the station geofences and sentido is detected from the station sequence. The output matches the workbook's classes, eventos and impactos exactly.
- A pure JS analysis engine with golden and Python↔JS parity tests, and the "conforme planilha" badge at defaults.
- KPIs and a quality index, stats, a data-quality card, synced uPlot charts, a Leaflet map (OSM routes, impact markers, heat map), a trecho × severidade matrix, ranking tables with CSV export, and live thresholds, filters and analysis parameters with a shareable URL.
- Client-side upload of any raw logger CSV (a JS converter port, parity-tested), a "Gerar PDF" report and an "Orientação dos eixos" popup.

The logger itself (`src/`, `main.py`) is unchanged since v1.2, apart from the GPS migration from `winsdk` to the `winrt-*` packages.

## Next Milestone Goals

Not defined yet; run `/gsd:new-milestone`. Candidates carried from v1.3:
- Fix the per-trecho deviation at inferred stations (CTR/EQD/SCT). This needs a converter change, a data regeneration and a JS converter port update.
- More field runs: a multi-run selector and before/after comparison (RUN-01/02), with run-scoped converter output already in place.
- Dashboard polish: mobile layout (MOB-01), chart brushing that filters the map (CHART-06), dark mode, PNG export.
- v1.3 tech debt: PDF before routes load, quality card vs GPS filter, `main.js` mount tests.

## Core Value

O sensor deve conectar, ler e salvar dados confiáveis em CSV — se isso não funcionar, nada mais importa.

## Requirements

### Validated (v1.0)

- ✓ Conectar ao sensor WTVB01-485 via Modbus RTU pela porta serial configurada — v1.0
- ✓ Ler todos os 19 registradores (0x34–0x46) em uma única chamada burst por ciclo — v1.0
- ✓ Converter aceleração X/Y/Z: `to_signed16(raw) / 32768 * 16` → g — v1.0
- ✓ Ler velocidade de vibração X/Y/Z → mm/s (SCALE_VEL = 1/100, SDK confirmed) — v1.0
- ✓ Ler temperatura → °C (SCALE_TEMP = 1/100, manual §6.4.8) — v1.0
- ✓ Ler deslocamento X/Y/Z → µm (SCALE_DISP = 1.0, manual §6.4.9) — v1.0
- ✓ Ler frequência X/Y/Z → Hz (SCALE_FREQ = 1/10, manual §6.4.10) — v1.0
- ✓ Converter valores signed 16-bit corretamente (sem anomalia ~32 g) — v1.0
- ✓ WitMotionSensor.read_all_data() retorna SensorReading dataclass — v1.0
- ✓ Exibir leituras no terminal em tempo real com timestamp — v1.0
- ✓ Mensagens de status de conexão no terminal (conectado, erro, reconectando) — v1.0
- ✓ Resumo de sessão ao encerrar com Ctrl+C (leituras, arquivo CSV, duração) — v1.0
- ✓ Arquivo CSV criado no startup com nome baseado em data/hora — v1.0
- ✓ CSV com 18 colunas, timestamp ISO 8601 com offset UTC, sensor_id último — v1.0
- ✓ CSV flushed após cada linha — v1.0
- ✓ Diretório de saída criado automaticamente se não existir — v1.0
- ✓ Falha de leitura parcial gravada com campos em branco no CSV — v1.0
- ✓ Desconexão graciosa ao pressionar Ctrl+C — v1.0
- ✓ Em falhas transientes: registra erro, avisa terminal, continua tentando — v1.0
- ✓ Script list_serial_ports.py lista portas com nome do dispositivo — v1.0
- ✓ config.yaml com todos os campos; validação no startup com mensagens legíveis — v1.0
- ✓ Valores padrão para parâmetros opcionais — v1.0
- ✓ Log rotativo de erros e status (RotatingFileHandler 1 MB, 5 backups) — v1.0
- ✓ Módulos organizados em src/ (sensor.py, config_loader.py, csv_logger.py, utils.py) — v1.0
- ✓ README.md completo: instalação Windows/Linux/macOS, identificação de porta serial nos 3 OS, 12 cenários de troubleshooting — v1.0
- ✓ requirements.txt com versões pinadas (pymodbus==3.13.0) — v1.0

### Validated (v1.1)

- ✓ `src/visualizer.py` — PlotManager class with FuncAnimation, 5 subplots, thread-safe deque buffer — v1.1
- ✓ `main.py` — `--gui` argparse flag, background acquisition thread, graceful shutdown with GUI open — v1.1
- ✓ 30-second rolling window (deque maxlen=300 at 10 Hz) per channel — v1.1
- ✓ All 13 live channels displayed: ax/ay/az (g), vib X/Y/Z (mm/s), disp X/Y/Z (µm), freq X/Y/Z (Hz), temp (°C) — v1.1
- ✓ CSV logging unchanged when --gui is used — v1.1

### Validated (v1.2)

- ✓ `src/gps_reader.py` — GPSReader class reading lat/lon/speed from Windows Location API via `winsdk` — v1.2
- ✓ `GPSReader.get_location()` returns `(lat, lon, speed_mps)` or `(None, None, None)` when no GPS fix — v1.2
- ✓ GPS polling non-blocking — 1 Hz background daemon thread, never delays 10 Hz sensor loop — v1.2
- ✓ Terminal GPS status line at startup: "GPS: fix acquired" / "GPS: no fix — CSV columns will be empty" — v1.2
- ✓ `SensorReading` extended with `gps_lat`, `gps_lon`, `gps_speed_mps` (`Optional[float]`, backward-compatible) — v1.2
- ✓ CSV always has 21 columns; `gps_lat`, `gps_lon`, `gps_speed_mps` as the last 3 — v1.2
- ✓ GPS `None` serialized as `""` in CSV (same `_cell()` pattern as angle RESERVED registers) — v1.2
- ✓ App starts normally with no GPS hardware, import failure, or denied permission — no crash — v1.2
- ✓ Permission-denied message: "GPS: location access denied — enable in Windows Settings › Privacy › Location" — v1.2

### Validated (v1.3)

- ✓ Run data, workbook, logs and caches git-ignored before the first push (REPO-01) — v1.3
- ✓ One-command converter: raw logger CSVs (comma or mangled pt-BR `;`) → schema-versioned compact site JSON, with trecho by station geofence, sentido from the station sequence and "sem GPS" tunnel inference (CONV-01..06) — v1.3
- ✓ Converter validation against the workbook: classes 21.031/1.611/512/173/56, eventos 2.352 and impactos 1.749 exact; pontos and per-trecho side by side (CONV-07) — v1.3 (per-trecho deviation at inferred stations accepted)
- ✓ Browser analysis engine: dynamic component, dominant axis, 5 classes, eventos/impactos/pontos, trecho priority, "conforme planilha" badge, golden and Python↔JS parity tests (CORE-01..06) — v1.3
- ✓ Public pt-BR GitHub Pages site deployed by Actions, gated on pytest and `node --test` (REPO-02, PUB-01..03) — v1.3
- ✓ Overview KPIs, class %, means/maxima, per-axis stats, data-quality card, track quality index (KPI-01..06) — v1.3
- ✓ Synchronized AX/AY/AZ charts with zoom, medido/dinâmico, thresholds, gaps and secondary channels (CHART-01..05) — v1.3
- ✓ OSM map with routes per sentido, stations, severity markers with popups, fixed-scale heat map, unplaced count, filter-driven; chart↔map hover/click (MAP-01..06, SYNC-01) — v1.3 (OSM routes replace the GPS-fix track, engineer-approved)
- ✓ Trecho × severidade matrix with click-to-filter; top-50 pontos and trecho priority tables; CSV export (MTX-01/02, RANK-01..03) — v1.3
- ✓ Thresholds, filters, display and analysis parameters, reset, shareable URL (PARAM-01..05, SHARE-01) — v1.3
- ✓ Client-side raw CSV upload re-renders every view, no backend (UPLOAD-01) — v1.3
- ✓ In-browser PDF report of the loaded run (REPORT-01) — v1.3
- ✓ "Orientação dos eixos" popup with a base64-embedded image (HELP-01) — v1.3

### Active

(None. Define them with `/gsd:new-milestone`.)

### Deferred (v1.4+)

- [ ] Fix the per-trecho deviation at inferred stations (CTR 210 m, EQD 159 m, SCT): trechos 1 and 4 show 0 impactos, and the top trecho differs from the workbook
- [ ] MOB-01: mobile single-column layout with controls in a drawer
- [ ] RUN-01 / RUN-02: multi-run selector and side-by-side run comparison
- [ ] CHART-06: range brushing on a chart filters the map
- [ ] UI-01: dark mode for the dashboard; EXP-01: PNG export of charts and map; GEO-01: position interpolation between GPS fixes

- [ ] Validar escala de velocidade de vibração em campo com equipamento de referência (SCALE_VEL = 1/100 confirmar mm/s)
- [ ] Corrigir test_main.py: `mock_csv.file_path` → `mock_csv.path` (4 locations) — teste correctness fix
- [ ] angle_x/y/z sempre None (registradores 0x3D-0x3F RESERVED) — investigar se firmware futuro disponibilizará
- [ ] VIZ-07: Configurable time window via `config.yaml` (`plot_window_seconds`)
- [ ] VIZ-08: Selective channel display (show/hide individual subplots)
- [ ] VIZ-09: Peak detection annotations on acceleration subplot
- [ ] VIZ-10: Dark mode / light mode toggle

### Out of Scope

- Dashboard em tempo real — planejado para horizonte de meses
- Banco de dados (InfluxDB, SQLite) — pós-coleta no CSV é suficiente agora
- Suporte a múltiplos sensores simultâneos — apenas 1 sensor por execução nesta versão
- Análise de sinal (FFT, filtros) — fora do escopo do logger
- Auto-detecção de porta serial — config.yaml explícito é mais confiável em campo
- Pause/resume button in graph — complexity without clear benefit
- Zoom/pan in live plot — conflicts with FuncAnimation scroll mode
- Graph-only mode (no CSV) — CSV is core value, always logged
- Access control / private dashboard — the user confirmed public publication of run data (including 6-dp GPS) is fine
- Time × trecho heat map — not selected; geographic + trecho × severidade only
- Backend/server or database for the dashboard — static GitHub Pages only; uploads and the PDF are processed in the browser
- Density-weighted heat map — misleading, because repeated GPS fixes (~30 s apart) would show dwell time instead of severity
- Changes to the logger for dashboard purposes — the dashboard is additive

## Context

**Shipped v1.0:** 2,064 LOC Python | 64 tests GREEN | 3 dias
**Shipped v1.1:** +707 LOC Python | 79 tests GREEN | 1 dia
**Shipped v1.2:** +1,661 LOC net | 95 tests GREEN | 1 dia
**Shipped v1.3:** ~6.600 LOC JS (`site/js`) + ~3.550 LOC Python (`tools/`) | pytest 289 + `node --test` 296 GREEN | 7 dias, 47 plans

**Tech Stack (logger):** Python 3.8+ · pymodbus==3.13.0 · pyserial · PyYAML · tzdata · matplotlib>=3.10 · winrt-runtime + winrt-Windows.Devices.Geolocation + winrt-Windows.Foundation (Windows Location API; `winsdk` no longer exists on PyPI) · pathlib · csv stdlib

**Tech Stack (dashboard):** Static site, vanilla ES modules, no build step. Vendored libraries: uPlot 1.6.32, Leaflet 1.9.4, leaflet.heat 0.2.0, jsPDF 4.2.1, jspdf-autotable 5.0.8. The converter is in `tools/dashboard_converter` with dev-only deps in `requirements-dashboard.txt` (Pillow for the axis image generator). CI runs on GitHub Actions (ubuntu, xvfb, Python pinned to 3.13.14 for the upload parity oracle). The local preview is `python -m tools.serve_site`.

**Hardware:** WTVB01-485, Modbus RTU, slave ID 80 (0x50), 9600 baud, 8N1. USB-RS485 adapter (CH340/CP210x). Alimentação 5-36Vcc (recomendado 12Vcc).

**Registradores confirmados do manual oficial WTVB01-485:**
- Aceleração 0x34–0x36: `to_signed16(raw) / 32768 * 16` → g (signed)
- Velocidade 0x3A–0x3C: `raw / 100` → mm/s (unsigned)
- Ângulo 0x3D–0x3F: RESERVED — sempre None, por design
- Temperatura 0x40: `to_signed16(raw) / 100` → °C (signed)
- Deslocamento 0x41–0x43: `raw * 1.0` → µm (unsigned)
- Frequência 0x44–0x46: `raw / 10` → Hz (unsigned)

**Validação de campo:** Verificado em COM10 com sensor plano — az_g ≈ 1.0 g, ax_g/ay_g ≈ 0.0 g, 10 Hz estáveis.

**Field run data facts (Results_1st.Run, for v1.3):**
- Original data had lost decimal separators (accel recovered via 1/2048 g resolution; GPS like `-2289879276454220` → `-22.8987927645422`). The converter recovers them from the raw CSVs, and the workbook's treated sheet is used only for validation.
- Axes: AX = Longitudinal, AY = Lateral, AZ = Vertical (AZ includes −1 g); "dinâmico" = medido − mediana do eixo
- Severity on |dominant-axis dynamic value|: Normal < 0,5 g ≤ Leve < 1 ≤ Moderado < 2 ≤ Severo < 4 ≤ Crítico
- Evento = medição ≥ Leve; impacto = consecutive event measurements grouped; ponto de impacto = 1 per GPS location (max value)
- GPS fix only every ~30 s; 2.020 registros without coordinates (tunnel / Central → Saara)
- Raw logger CSVs in `Results_1st.Run/raw/` (`2. PXV-TIG.csv` 12.544 rows, clean comma CSV; `3. TIG-PXV.csv` 10.839 rows, re-saved by pt-BR Excel: `;` delimiter and thousands-dot mangling of lat/lon/accel/temp/vel/freq — recoverable with the aba 11 rules). 12.544 + 10.839 = 23.383 = workbook rows. Raw has sub-second ISO timestamps (~5.5 Hz, median Δt 0.18 s) that the workbook lacks; no trecho/sentido columns (sentido from filename); gps_speed_mps always empty
- Vibration velocity (≤ ~4.7 mm/s), displacement (≤ ~3.570 µm), frequency (≤ ~6.9 Hz) and temperature (~21–22 °C) are populated in ~80% of samples in the raw CSVs — dropped from the workbook's treated sheet; angles None
- Public remote: `M-rfl/painel-sapata`. Pushing `master` triggers the test-gated Pages deploy.
- Run 1 at defaults: 23.383 registros, 2.352 eventos, 1.749 impactos, pontos 99 raw / 98 with the GPS jump filter (fix 31 rejected), IQ 96,4 % (Regular)

**Known tech debt:**
- `test_main.py` usa `mock_csv.file_path` mas `main.py` lê `csv_logger.path` — DISP-03 CSV path não assertado no teste automatizado
- `05-VALIDATION.md`, `06-VALIDATION.md` e `09-VALIDATION.md` mostram `nyquist_compliant: false` — planning artifacts não atualizados
- Dashboard (v1.3 audit): per-trecho deviation at inferred stations; a PDF made before the routes load has no route lines; the quality card ignores the GPS filter; an upload-failure rollback drops the example URL state; no automated test for `main.js` mount wiring; REQUIREMENTS MAP-01/MAP-02 wording drift
- Legacy `tests/test_visualizer.py` is flaky on Tk/Tcl init on Windows

## Constraints

- **Tech Stack**: Python + pymodbus + pyserial + pathlib + PyYAML + matplotlib — sem bibliotecas extras além disto
- **Python Version**: 3.8+ para máxima compatibilidade com Windows corporativo
- **Platform**: Windows priority (COM ports), Linux/macOS secondary
- **Extensibility**: Arquitetura modular para adicionar exportadores (MQTT, InfluxDB, REST) sem reescrever sensor.py
- **GUI Threading**: Matplotlib deve rodar na main thread (Windows Tk backend constraint) — acquisition em background thread
- **Simplicity**: Executável com `python main.py` sem configuração adicional além do config.yaml
- **Dashboard (v1.3)**: Static site only (GitHub Pages, no backend); UI in Portuguese; all parameter recalculation client-side; logger tech-stack constraint does not apply to the site — converter may add dev-only deps (e.g. openpyxl) kept out of the logger's runtime requirements

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| pymodbus==3.13.0 pinado exato | API break de 2.x→3.x; unit= removido em 3.5, slave= em 3.10 | ✓ Good — zero deprecation warnings |
| config.yaml (não .env ou CLI args) | Mais legível para iniciantes; fácil editar | ✓ Good — funciona bem em campo |
| CSV como único destino de saída | Suficiente para teste de bancada; pandas/InfluxDB depois | ✓ Good — simples e confiável |
| Módulos separados (sensor/logger/config/utils) | Substituir partes sem reescrever — ex: trocar CSV por DB | ✓ Good — isolamento de responsabilidades |
| Timezone America/Sao_Paulo explícito | Timestamp inequívoco para dados CBM industriais | ✓ Good — sem ambiguidade de UTC offset |
| SensorReading definido em utils.py | Evita import circular entre sensor.py e csv_logger.py | ✓ Good — sem circular imports |
| device_id= (pymodbus 3.13.0 API) | slave= removido em 3.10, unit= em 3.5 | ✓ Good — API correta confirmada |
| None para registradores RESERVED | Ângulo 0x3D-0x3F RESERVED no manual — retorna None em vez de valor errado | ✓ Good — documentado no README |
| `_REG_COUNT = 0x46 - 0x34 + 1` | Self-documenting — range de registradores visível | ✓ Good — hardening aprovado em testes |
| `open(newline='')` no CSV | Windows: previne CRCRLF double-ending | ✓ Good — CSV legível em Excel |
| `getattr(config, 'sensor_id', 'wtvb01')` | AppConfig não tem sensor_id — fallback evita churn no Phase 1 | ✓ Good — extensível sem reescrever |
| KeyboardInterrupt no nível mais externo | Session summary sempre executa antes do finally | ✓ Good — zero dados perdidos em Ctrl+C |
| Matplotlib main thread / acquisition background thread | Windows TkAgg constraint: plt.show() must block main thread | ✓ Good — no GUI freeze observed |
| deque(maxlen=300) per channel (v1.1) | 30s × 10 Hz rolling buffer — thread-safe under CPython GIL | ✓ Good — correct buffer behavior confirmed |
| Deferred import of PlotManager inside _run_gui_mode (v1.1) | Prevents TkAgg backend activation on headless/test import of main.py | ✓ Good — 79 tests pass headlessly |
| patch('src.visualizer.PlotManager') not 'main.PlotManager' (v1.1) | PlotManager never bound in main namespace due to deferred import | ✓ Good — mock target is correct |
| stop_event.wait(timeout=...) instead of time.sleep() in _acquire (v1.1) | Responds to stop signal immediately; no 100ms lag on shutdown | ✓ Good — clean shutdown confirmed |
| Shutdown order: stop→join→summary→sensor.close→csv.close (v1.1) | join before close prevents write-to-closed-file race | ✓ Good — no data loss on close |
| `winsdk` conditional import with `_WINSDK_AVAILABLE` flag (v1.2) | Resilience: module-level guard so app starts even if `winsdk` absent or import fails | ✓ Good — no crash on machines without GPS |
| asyncio.run() per poll() call (v1.2) | Acceptable at 1 Hz; avoids shared event loop with sensor thread | ✓ Good — no interference with acquisition loop |
| poll/cache split in GPSReader (v1.2) | `get_location()` returns cached value instantly; `poll()` does I/O — ensures 10 Hz loop never blocks on GPS | ✓ Good — acquisition timing unaffected |
| speed=None normalized to 0.0 (v1.2) | Windows returns None for speed when fix exists but speed is unavailable; caller gets a float, never None | ✓ Good — consistent with documented behavior |
| GPS columns appended as last 3 (after sensor_id) in CSV (v1.2) | Consistent with SensorReading field order; STORE-02 invariant (sensor_id last) relaxed to sensor_id before GPS fields | ✓ Good — no existing column index changed |
| gps_lat/lon/speed_mps use `field(default=None)` in SensorReading (v1.2) | All 79 existing tests construct SensorReading without GPS kwargs — backward-compatible zero-change | ✓ Good — 95/95 tests GREEN with no changes to older tests |
| Raw logger CSVs as primary source, workbook only for validation (v1.3) | Raw CSVs keep sub-second time and the vel/disp/freq/temp channels; the workbook is the golden reference | ✓ Good — exact class/eventos/impactos parity |
| Trecho by station geofence, sentido from the station sequence (v1.3) | Works for any line and direction without filename conventions | ⚠️ Revisit — inferred stations (CTR/EQD/SCT) collapse trechos |
| Accel as integer 1/2048 g counts; JS owns the rules, Python owns quantization (v1.3) | Exact integer comparisons on both sides make parity testable | ✓ Good — golden and parity tests stable |
| Static GitHub Pages with test-gated Actions deploy (v1.3) | No backend to run; a failing test never publishes | ✓ Good |
| GPS published at 6 dp (v1.3) | The user accepted that the exact track is public | ✓ Good — confirmed 2026-10-13 |
| OSM relation routes instead of the GPS-fix track on the map (v1.3) | Engineer-directed at the 12-06 browser checkpoint | ✓ Good — engineer-approved; REQUIREMENTS wording not updated |
| GPS jump filter as a derived run outside analyze() (v1.3) | Keeps the engine pure and the workbook parity intact | ✓ Good — 98 pontos baseline approved |
| URL hash state, disabled for uploaded runs (v1.3) | A share link cannot restore data that only exists in the viewer's browser | ✓ Good |
| Line-by-line JS port of the converter for uploads, tested against a Python oracle fixture (v1.3) | Uploads must give the same numbers as the bundled run | ✓ Good — run-1 parity; CI pinned to Python 3.13.14 |
| PDF via vendored jsPDF, full run with current params, lazy-loaded (v1.3) | No backend; the report is independent of transient filters | ✓ Good — routes can be missing if clicked very early |
| Axis image as a base64 WebP ES module (v1.3) | One fewer request; the generator keeps it reproducible | ✓ Good — 144 KB module |

---
*Last updated: 2026-10-14 after v1.3 milestone*
