# Requirements: WTVB01 Notebook Logger

**Defined:** 2026-05-19
**Core Value:** O sensor deve conectar, ler e salvar dados confiáveis em CSV — se isso não funcionar, nada mais importa.

## v1 Requirements

### Connection (CONN)

- [x] **CONN-01**: Sistema conecta ao sensor WitMotion WTVB01-485 via Modbus RTU na porta serial configurada (COM* no Windows, /dev/ttyUSB* no Linux, /dev/tty.usbserial* no macOS)
- [ ] **CONN-02**: Sistema desconecta graciosamente ao pressionar Ctrl+C, fechando a conexão Modbus e o arquivo CSV corretamente
- [x] **CONN-03**: Em falhas de comunicação transientes, sistema registra o erro, exibe aviso no terminal e continua tentando — não encerra o processo
- [x] **CONN-04**: Script list_serial_ports.py lista todas as portas seriais disponíveis com nome do dispositivo (ex: "COM3 - USB-SERIAL CH340")

### Data Acquisition (ACQ)

- [x] **ACQ-01**: Sistema lê todos os 19 registradores Modbus (0x34 a 0x46) em uma única chamada burst por ciclo de polling
- [x] **ACQ-02**: Converte aceleração X/Y/Z (registradores 0x34–0x36): `signed_16 / 32768 * 16` → unidade g
- [x] **ACQ-03**: Lê velocidade de vibração X/Y/Z (registradores 0x3A–0x3C) → unidade mm/s
- [x] **ACQ-04**: Lê ângulo de vibração X/Y/Z (registradores 0x3D–0x3F)
- [x] **ACQ-05**: Lê temperatura (registrador 0x40) → unidade °C
- [x] **ACQ-06**: Lê deslocamento de vibração X/Y/Z (registradores 0x41–0x43) → unidade µm
- [x] **ACQ-07**: Lê frequência de vibração X/Y/Z (registradores 0x44–0x46) → unidade Hz
- [x] **ACQ-08**: Converte corretamente valores signed 16-bit (valores negativos não devem aparecer como ~32g)
- [x] **ACQ-09**: Classe WitMotionSensor expõe método read_all_data() retornando dataclass SensorReading com todas as variáveis em unidades físicas

### Data Storage (STORE)

- [ ] **STORE-01**: Arquivo CSV criado no startup com nome baseado em data/hora (ex: `wtvb01_20260519_143201.csv`)
- [ ] **STORE-02**: CSV contém colunas: timestamp, ax_g, ay_g, az_g, vx_mm_s, vy_mm_s, vz_mm_s, angle_x, angle_y, angle_z, temperature_c, dx_um, dy_um, dz_um, freq_x_hz, freq_y_hz, freq_z_hz, sensor_id
- [x] **STORE-03**: Timestamp em formato ISO 8601 com offset UTC explícito e microssegundos (ex: `2026-05-19T14:32:01.123456-03:00`) usando timezone America/Sao_Paulo
- [ ] **STORE-04**: Arquivo CSV é flushed após cada linha para evitar perda de dados em crash ou desligamento abrupto
- [ ] **STORE-05**: Diretório de saída é criado automaticamente se não existir
- [ ] **STORE-06**: Em falha de leitura parcial, linha é gravada com campos em branco para os canais falhos, preservando timestamp e dados parciais

### Display (DISP)

- [ ] **DISP-01**: Leituras são exibidas no terminal em tempo real com timestamp e valores formatados por canal
- [ ] **DISP-02**: Mensagens de status de conexão exibidas no terminal (conectado, erro, reconectando)
- [ ] **DISP-03**: Ao encerrar com Ctrl+C, exibe resumo da sessão (total de leituras, arquivo CSV gerado, duração)

### Configuration (CFG)

- [x] **CFG-01**: Arquivo config.yaml com campos: serial_port, baudrate, slave_id, sample_interval_seconds, output_folder, csv_filename_prefix
- [x] **CFG-02**: Configuração validada no startup com mensagens de erro legíveis (ex: "serial_port não configurado — edite config.yaml")
- [x] **CFG-03**: Valores padrão para parâmetros opcionais: baudrate=9600, slave_id=80, sample_interval_seconds=0.1, output_folder="data"

### Utilities & Logging (UTIL)

- [x] **UTIL-01**: Log de erros e status gravado em arquivo rotativo (logging.handlers.RotatingFileHandler)
- [x] **UTIL-02**: Nível de log configurável; erros de comunicação Modbus sempre registrados com timestamp
- [x] **UTIL-03**: Módulos organizados em src/ (sensor.py, config_loader.py, csv_logger.py, utils.py) com src/__init__.py

### Documentation (DOC)

- [ ] **DOC-01**: README.md com instruções de instalação (pip install -r requirements.txt) para Windows, Linux e macOS
- [ ] **DOC-02**: README.md inclui como identificar porta serial no Windows (Gerenciador de Dispositivos), Linux (ls /dev/ttyUSB*) e macOS (ls /dev/tty.usb*)
- [ ] **DOC-03**: README.md inclui seção de troubleshooting com os 12 cenários especificados: sensor não responde, porta COM não encontrada, porta ocupada, erro de permissão, valores zerados, inversão A/B, baud rate incorreto, slave ID incorreto, driver USB–RS485 não instalado, diferença entre COM3/COM4, como testar com software WitMotion antes do Python
- [x] **DOC-04**: requirements.txt com versões pinadas (pymodbus==3.13.0, pyserial, PyYAML, tzdata, backports.zoneinfo)

## v2 Requirements

### Dashboard Integration

- **DASH-01**: Exibição de dados em tempo real via dashboard web (Grafana, Streamlit ou similar)
- **DASH-02**: Publicação de dados via MQTT para integração com sistemas SCADA/CBM

### Database Export

- **DB-01**: Exportação de leituras para InfluxDB para histórico e análise de tendências
- **DB-02**: Exportação para SQLite como opção leve sem servidor

### Multi-Sensor

- **MULTI-01**: Suporte a múltiplos sensores no mesmo barramento RS-485 com slave IDs diferentes
- **MULTI-02**: CSV separado por sensor_id com configuração de múltiplos slaves

### Signal Analysis

- **SIG-01**: Cálculo de RMS de vibração em janelas de tempo
- **SIG-02**: FFT básica para análise de frequência dominante

## Out of Scope

| Feature | Reason |
|---------|--------|
| GUI / TUI | Terminal suficiente para teste de bancada; adiciona complexidade sem valor imediato |
| Análise de sinal (FFT, filtros) | Pós-coleta no CSV; fora do escopo do logger |
| Alertas / alarmes automáticos | Requer thresholds validados em campo — v2+ |
| Suporte multi-sensor simultâneo | Apenas 1 sensor nesta versão; arquitetura já prepara para expansão |
| Auto-detecção de porta serial | Aumenta complexidade; config.yaml explícito é mais confiável em campo |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 2 | Complete |
| CONN-02 | Phase 3 | Pending |
| CONN-03 | Phase 2 | Complete |
| CONN-04 | Phase 1 | Complete |
| ACQ-01 | Phase 2 | Complete |
| ACQ-02 | Phase 2 | Complete |
| ACQ-03 | Phase 2 | Complete |
| ACQ-04 | Phase 2 | Complete |
| ACQ-05 | Phase 2 | Complete |
| ACQ-06 | Phase 2 | Complete |
| ACQ-07 | Phase 2 | Complete |
| ACQ-08 | Phase 2 | Complete |
| ACQ-09 | Phase 2 | Complete |
| STORE-01 | Phase 3 | Pending |
| STORE-02 | Phase 3 | Pending |
| STORE-03 | Phase 1 | Pending |
| STORE-04 | Phase 3 | Pending |
| STORE-05 | Phase 3 | Pending |
| STORE-06 | Phase 3 | Pending |
| DISP-01 | Phase 3 | Pending |
| DISP-02 | Phase 3 | Pending |
| DISP-03 | Phase 3 | Pending |
| CFG-01 | Phase 1 | Complete |
| CFG-02 | Phase 1 | Complete |
| CFG-03 | Phase 1 | Complete |
| UTIL-01 | Phase 1 | Pending |
| UTIL-02 | Phase 1 | Pending |
| UTIL-03 | Phase 1 | Pending |
| DOC-01 | Phase 4 | Pending |
| DOC-02 | Phase 4 | Pending |
| DOC-03 | Phase 4 | Pending |
| DOC-04 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-19*
*Last updated: 2026-05-19 after roadmap creation (4 phases, 31/31 mapped)*
