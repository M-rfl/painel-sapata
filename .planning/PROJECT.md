# WTVB01 Notebook Logger

## What This Is

Aplicação Python para aquisição contínua de dados do acelerômetro industrial WitMotion WTVB01-485 via Modbus RTU/RS-485, conectado a um notebook por conversor USB–RS485. Lê aceleração, velocidade de vibração, deslocamento, frequência, ângulo e temperatura em tempo real, exibe no terminal e salva em CSV com timestamp fuso America/Sao_Paulo. Projetada para uso em Windows, com compatibilidade Linux/macOS.

**Status: v1.0 MVP shipped 2026-05-21.** Core acquisition loop is fully functional — `python main.py` connects, reads at 10 Hz, writes timestamped CSV, and exits cleanly on Ctrl+C.

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

### Active (next milestone)

- [ ] Validar escala de velocidade de vibração em campo com equipamento de referência (SCALE_VEL = 1/100 confirmar mm/s)
- [ ] angle_x/y/z sempre None (registradores 0x3D-0x3F RESERVED) — investigar se firmware futuro disponibilizará estes registradores
- [ ] Verificação automatizada do CSV path no session summary (corrigir test_main.py: mock_csv.file_path → mock_csv.path)

### Out of Scope

- Dashboard em tempo real — planejado para horizonte de meses
- Banco de dados (InfluxDB, SQLite) — pós-coleta no CSV é suficiente agora
- Suporte a múltiplos sensores simultâneos — apenas 1 sensor por execução nesta versão
- Interface gráfica (GUI/TUI) — terminal suficiente para teste de bancada
- Análise de sinal (FFT, filtros) — fora do escopo do logger
- Auto-detecção de porta serial — config.yaml explícito é mais confiável em campo

## Context

**Shipped v1.0:** 2,064 LOC Python | 64 tests GREEN | 3 dias de desenvolvimento

**Tech Stack:** Python 3.8+ · pymodbus==3.13.0 · pyserial · PyYAML · tzdata · pathlib · csv stdlib

**Hardware:** WTVB01-485, Modbus RTU, slave ID 80 (0x50), 9600 baud, 8N1. USB-RS485 adapter (CH340/CP210x). Alimentação 5-36Vcc (recomendado 12Vcc).

**Registradores confirmados do manual oficial WTVB01-485:**
- Aceleração 0x34–0x36: `to_signed16(raw) / 32768 * 16` → g (signed)
- Velocidade 0x3A–0x3C: `raw / 100` → mm/s (unsigned)
- Ângulo 0x3D–0x3F: RESERVED — sempre None, por design
- Temperatura 0x40: `to_signed16(raw) / 100` → °C (signed)
- Deslocamento 0x41–0x43: `raw * 1.0` → µm (unsigned)
- Frequência 0x44–0x46: `raw / 10` → Hz (unsigned)

**Validação de campo:** Verificado em COM10 com sensor plano — az_g ≈ 1.0 g, ax_g/ay_g ≈ 0.0 g, 10 Hz estáveis.

**Tech debt pendente:**
- `test_main.py` usa `mock_csv.file_path` mas `main.py` lê `csv_logger.path` — DISP-03 CSV path não assertado no teste automatizado
- Comentários em `utils.py` dizem "scale TBD" para campos de velocidade/deslocamento/frequência — desatualizados após confirmação do manual
- `02-02-PLAN.md` (hardware checkpoint de Phase 2) nunca executado — verificação de campo realizada no Phase 3

## Constraints

- **Tech Stack**: Python + pymodbus + pyserial + pathlib + PyYAML — sem bibliotecas extras
- **Python Version**: 3.8+ para máxima compatibilidade com Windows corporativo
- **Platform**: Windows priority (COM ports), Linux/macOS secondary
- **Extensibility**: Arquitetura modular para adicionar exportadores (MQTT, InfluxDB, REST) sem reescrever sensor.py
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

---
*Last updated: 2026-05-21 after v1.0 MVP milestone*
