# WTVB01 Notebook Logger

## What This Is

Aplicação Python para aquisição contínua de dados do acelerômetro industrial WitMotion WTVB01-485 via Modbus RTU/RS-485, conectado a um notebook por conversor USB–RS485. Lê aceleração, velocidade de vibração, deslocamento, frequência, ângulo e temperatura em tempo real, exibe no terminal e salva em CSV com timestamp fuso America/Sao_Paulo. Projetada para uso em Windows, com compatibilidade básica Linux/macOS.

## Core Value

O sensor deve conectar, ler e salvar dados confiáveis em CSV — se isso não funcionar, nada mais importa.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Conectar ao sensor WitMotion WTVB01-485 via Modbus RTU pela porta serial configurada
- [ ] Ler todos os registradores: aceleração X/Y/Z, velocidade vibração, ângulo, temperatura, deslocamento, frequência
- [ ] Converter valores brutos (signed 16-bit) em unidades físicas (g, mm/s, °C, µm, Hz)
- [ ] Exibir leituras no terminal em tempo real com timestamp
- [ ] Salvar leituras em CSV com todas as colunas definidas e timestamp fuso America/Sao_Paulo
- [ ] Arquivo config.yaml para porta COM, baudrate, slave_id, intervalo de amostragem
- [ ] Script list_serial_ports.py para identificar portas disponíveis no sistema
- [ ] Tratamento de erros de comunicação com retry — não encerrar em falhas transientes
- [ ] Encerramento seguro com Ctrl+C fechando a conexão Modbus corretamente
- [ ] Logs de erro e status em arquivo
- [ ] README.md completo com instalação, uso e troubleshooting
- [ ] Estrutura modular (sensor.py, config_loader.py, csv_logger.py, utils.py) preparada para extensão futura

### Out of Scope

- Dashboard em tempo real — planejado para próximos meses, não nesta versão
- Banco de dados (InfluxDB, PostgreSQL, SQLite) — integração futura, CSV é suficiente agora
- Suporte a múltiplos sensores simultâneos — apenas 1 sensor por execução nesta versão
- Interface gráfica (GUI/TUI) — terminal é suficiente para teste de bancada
- Análise de sinal (FFT, filtros) — pós-coleta, fora do escopo do logger

## Context

**Hardware:** WitMotion WTVB01-485, Modbus RTU, RS-485, slave ID 0x50 (decimal 80), 9600 baud, 8N1.

**Conexão:** Cabo USB fornecido pelo equipamento contém conversor USB–RS485 integrado. Após conectar, Windows reconhece porta COM virtual (CH340/CP210x/FTDI). Alimentação obrigatória por fonte externa 5-36Vcc (recomendado 12Vcc para testes).

**Registradores Modbus:**
- Aceleração X/Y/Z: 0x34–0x36 → `signed_16 / 32768 * 16` (g)
- Velocidade vibração X/Y/Z: 0x3A–0x3C (mm/s)
- Ângulo X/Y/Z: 0x3D–0x3F
- Temperatura: 0x40 (°C)
- Deslocamento X/Y/Z: 0x41–0x43 (µm)
- Frequência X/Y/Z: 0x44–0x46 (Hz)

**Objetivo imediato:** Validar comunicação em bancada e confirmar dados corretos antes de qualquer integração com sistema CBM/dashboard ferroviário (horizonte: próximos meses).

**Usuário final:** Notebook Windows, possivelmente iniciante em Python. Simplicidade de execução é essencial.

## Constraints

- **Tech Stack**: Python + pymodbus + pyserial + pathlib + PyYAML — sem bibliotecas extras desnecessárias
- **Python Version**: 3.8+ para máxima compatibilidade com Windows corporativo
- **Platform**: Windows priority (COM ports), Linux/macOS secondary (/dev/ttyUSB*, /dev/tty.usbserial*)
- **Extensibility**: Arquitetura modular para facilitar adição de exportadores (MQTT, InfluxDB, REST) sem reescrever sensor.py
- **Simplicity**: Executável com `python main.py` sem configuração adicional além do config.yaml

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| pymodbus para Modbus RTU | Biblioteca mais madura e mantida para Python; suporte ativo | — Pending |
| config.yaml (não .env ou CLI args) | Mais legível para iniciantes; fácil editar sem conhecer CLI | — Pending |
| CSV como único destino de saída | Suficiente para teste de bancada; fácil integrar depois com pandas/InfluxDB | — Pending |
| Módulos separados (sensor/logger/config) | Permite substituir partes sem reescrever o todo — ex: trocar CSV por DB | — Pending |
| Timezone America/Sao_Paulo explícito | Dados industriais precisam de timestamp inequívoco para CBM | — Pending |

---
*Last updated: 2026-05-19 after initialization*
