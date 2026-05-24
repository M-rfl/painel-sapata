# WTVB01 Notebook Logger

## What This Is

Aplicação Python para aquisição contínua de dados do acelerômetro industrial WitMotion WTVB01-485 via Modbus RTU/RS-485, conectado a um notebook por conversor USB–RS485. Lê aceleração, velocidade de vibração, deslocamento, frequência e temperatura em tempo real, exibe no terminal e salva em CSV com timestamp fuso America/Sao_Paulo. `--gui` abre janela matplotlib com 5 subplots animados. Projetada para uso em Windows, com compatibilidade Linux/macOS.

**Status: v1.1 Real-Time Visualization shipped 2026-05-24.** Acquisition loop + live visualization both functional — `python main.py` for headless CSV logging; `python main.py --gui` for simultaneous CSV + live animated graph.

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

## Current Milestone: v1.2 GPS Data Integration

**Goal:** Enrich every CSV row with the computer's live GPS position (lat, lon, speed) using the Windows Location API — empty fields when no fix.

**Target features:**
- GPS reader module using Windows Location API (WinRT)
- `gps_lat`, `gps_lon`, `gps_speed_mps` columns appended to every CSV row
- Empty fields when no fix available (consistent with angle RESERVED pattern)
- Always-on: GPS columns always present in CSV header regardless of fix status

### Active (v1.2)

- [ ] GPS-01: Sistema lê latitude/longitude/speed do Windows Location API a cada ciclo de aquisição
- [ ] GPS-02: Colunas `gps_lat`, `gps_lon`, `gps_speed_mps` adicionadas ao CSV em cada linha
- [ ] GPS-03: Quando sem fix GPS, colunas ficam em branco (mesmo padrão dos registradores RESERVED)
- [ ] GPS-04: CSV header sempre inclui as 3 colunas GPS independente do status de fix

### Deferred (v1.3+)

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

## Context

**Shipped v1.0:** 2,064 LOC Python | 64 tests GREEN | 3 dias
**Shipped v1.1:** +707 LOC Python | 79 tests GREEN | 1 dia

**Tech Stack:** Python 3.8+ · pymodbus==3.13.0 · pyserial · PyYAML · tzdata · matplotlib>=3.10 · pathlib · csv stdlib

**Hardware:** WTVB01-485, Modbus RTU, slave ID 80 (0x50), 9600 baud, 8N1. USB-RS485 adapter (CH340/CP210x). Alimentação 5-36Vcc (recomendado 12Vcc).

**Registradores confirmados do manual oficial WTVB01-485:**
- Aceleração 0x34–0x36: `to_signed16(raw) / 32768 * 16` → g (signed)
- Velocidade 0x3A–0x3C: `raw / 100` → mm/s (unsigned)
- Ângulo 0x3D–0x3F: RESERVED — sempre None, por design
- Temperatura 0x40: `to_signed16(raw) / 100` → °C (signed)
- Deslocamento 0x41–0x43: `raw * 1.0` → µm (unsigned)
- Frequência 0x44–0x46: `raw / 10` → Hz (unsigned)

**Validação de campo:** Verificado em COM10 com sensor plano — az_g ≈ 1.0 g, ax_g/ay_g ≈ 0.0 g, 10 Hz estáveis.

**Known tech debt:**
- `test_main.py` usa `mock_csv.file_path` mas `main.py` lê `csv_logger.path` — DISP-03 CSV path não assertado no teste automatizado
- `05-VALIDATION.md` e `06-VALIDATION.md` mostram `nyquist_compliant: false` — planning artifacts não atualizados

## Constraints

- **Tech Stack**: Python + pymodbus + pyserial + pathlib + PyYAML + matplotlib — sem bibliotecas extras além disto
- **Python Version**: 3.8+ para máxima compatibilidade com Windows corporativo
- **Platform**: Windows priority (COM ports), Linux/macOS secondary
- **Extensibility**: Arquitetura modular para adicionar exportadores (MQTT, InfluxDB, REST) sem reescrever sensor.py
- **GUI Threading**: Matplotlib deve rodar na main thread (Windows Tk backend constraint) — acquisition em background thread
- **Simplicity**: Executável com `python main.py` sem configuração adicional além do config.yaml

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

---
*Last updated: 2026-05-24 after v1.2 milestone start*
