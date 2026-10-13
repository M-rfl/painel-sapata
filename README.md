# WTVB01 Notebook Logger

Modbus RTU data logger for WitMotion WTVB01-485 vibration sensor.
Reads 19 registers per sample, writes timestamped CSV rows, displays live values in the terminal.

---

## Hardware Prerequisites

- WitMotion WTVB01-485 vibration sensor
- USB-RS485 adapter with WCH CH340 chip (the adapter that ships with the sensor)
- RS-485 cable: A wire to sensor terminal A, B wire to sensor terminal B

---

## Step 0: Install CH340 Driver (Windows only)

**Do this before connecting the adapter or running any Python command.**

1. Download the latest Windows driver from the official WCH page:
   https://www.wch-ic.com/products/CH340.html
2. Extract the zip, run `SETUP.EXE`, restart if prompted.
3. Plug in the USB-RS485 adapter.
4. Verify: Device Manager > Ports (COM & LPT) should show **USB-SERIAL CH340 (COM3)** or similar.

> Linux and macOS: the CH340 kernel driver is included in the OS. No installation needed.

---

## Step 1: Install Python Dependencies

```
pip install -r requirements.txt
```

Notes:
- On Windows, use `py -m pip install -r requirements.txt` if `pip` is not on PATH.
- `tzdata` is mandatory on Windows for timezone support; it is already listed in `requirements.txt`.

---

## Step 2: Identify Serial Port

| OS | Command | Typical result |
|----|---------|----------------|
| Windows | Device Manager > Ports (COM & LPT) | USB-SERIAL CH340 (COM3) |
| Linux | `ls /dev/ttyUSB*` | `/dev/ttyUSB0` |
| macOS | `ls /dev/tty.usbserial*` | `/dev/tty.usbserial-...` or `/dev/tty.wchusbserial*` |

Or use the universal helper (works on all OS):
```
python list_serial_ports.py
```
Output example: `COM3 - USB-SERIAL CH340 (COM3)`

---

## Step 3: Configure config.yaml

Edit `config.yaml` and set `serial_port` to the port found in Step 2:

```yaml
# REQUIRED — set to your port (run list_serial_ports.py to discover)
serial_port: "COM3"           # Windows example; use /dev/ttyUSB0 on Linux

# Connection parameters — change only if reconfigured on sensor
baudrate: 9600                # Factory default
slave_id: 80                  # 0x50 hex = 80 decimal — factory default

# Sampling
sample_interval_seconds: 0.1  # 10 Hz

# Output
output_folder: "data"
csv_filename_prefix: "wtvb01"
```

**Important:** `slave_id` must be a decimal integer (`80`), not the hex string `"0x50"`.

---

## Step 4: Run the Logger

```
python main.py
```

Expected output:
```
[INFO] Connected to WTVB01-485 on COM3
[INFO] Writing CSV: data/wtvb01_20260521_143201.csv
2026-05-21T14:32:01.123456-03:00  ax=0.001 g  ay=-0.002 g  az=0.998 g ...
2026-05-21T14:32:01.223456-03:00  ax=0.001 g  ay=-0.002 g  az=0.998 g ...
^C
[INFO] Session ended: 42 samples written | data/wtvb01_20260521_143201.csv | 4.2 s
```

Stop with **Ctrl+C**. The session summary prints and the CSV file is safely closed.

---

## Output Files

CSV files are written to `data/wtvb01_YYYYMMDD_HHMMSS.csv`.

18 columns:

| Column | Unit | Notes |
|--------|------|-------|
| timestamp | ISO 8601 `-03:00` | e.g. `2026-05-21T14:32:01.123456-03:00` |
| ax_g | g | Acceleration X |
| ay_g | g | Acceleration Y |
| az_g | g | Acceleration Z (~1.0 g at rest) |
| vx_mm_s | mm/s | Vibration velocity X |
| vy_mm_s | mm/s | Vibration velocity Y |
| vz_mm_s | mm/s | Vibration velocity Z |
| angle_x | — | **Always empty** (registers 0x3D-0x3F are RESERVED on WTVB01-485) |
| angle_y | — | **Always empty** |
| angle_z | — | **Always empty** |
| temperature_c | °C | Board temperature |
| dx_um | µm | Displacement X |
| dy_um | µm | Displacement Y |
| dz_um | µm | Displacement Z |
| freq_x_hz | Hz | Vibration frequency X |
| freq_y_hz | Hz | Vibration frequency Y |
| freq_z_hz | Hz | Vibration frequency Z |
| sensor_id | — | From config.yaml (default: `wtvb01`) |

> The three angle columns are always empty for this sensor model. This is expected behaviour, not a bug.

---

## Troubleshooting

### Scenario 1: Sensor not responding (repeated read errors)

**Symptoms:** `[WARN] Read failed — retrying...` repeats; no data appears in CSV.

**Root cause:** Wiring problem, wrong slave ID, or wrong baud rate.

**Fix:**
1. Check A/B wiring polarity (see Scenario 6).
2. Verify `slave_id: 80` and `baudrate: 9600` in `config.yaml`.
3. Use WitMotion software to confirm hardware independently (see Scenario 12).

---

### Scenario 2: COM port not found / config error at startup

**Symptoms:** `[config error] serial_port is required` or `Cannot connect to COMx`.

**Root cause:** `serial_port` not set in `config.yaml`, or the port number is wrong.

**Fix:**
1. Run `python list_serial_ports.py` to see available ports.
2. Update `serial_port:` in `config.yaml` with the correct port.

---

### Scenario 3: Port busy / "Access is denied" (Windows)

**Symptoms:** `Cannot connect to COM3` immediately after a previous run, or when another application is using the port.

**Root cause:** Only one process can hold a serial port at a time on Windows.

**Fix:**
1. Close any other serial terminal, WitMotion software, or previous Python process.
2. Check Task Manager for zombie `python.exe` processes and end them.

---

### Scenario 4: Permission error (Linux / macOS)

**Symptoms:** `[Errno 13] Permission denied: '/dev/ttyUSB0'`

**Root cause:** User is not in the `dialout` group (Linux) or `uucp` group (macOS).

**Fix (Linux):**
```
sudo usermod -aG dialout $USER
```
Log out and back in for the change to take effect.

**Fix (macOS):** Permission errors are rare. As a temporary workaround:
```
sudo chmod a+rw /dev/tty.usbserial-*
```
Do not run `sudo python main.py` — that is an antipattern.

---

### Scenario 5: Zero values on all channels

**Symptoms:** All CSV fields read `0.0`; no errors in terminal.

**Root cause:** The sensor is responding but returning register values of 0. Either the slave ID is wrong (a different device on the bus is responding) or the sensor is powered but not vibrating (some channels legitimately read 0 at rest).

**Fix:**
1. Confirm `slave_id: 80` in `config.yaml`.
2. Check `az_g` — it should read approximately `1.0 g` with the sensor resting flat. If it reads exactly `0.0`, the slave ID is wrong.

---

### Scenario 6: A/B inversion (Modbus errors despite correct port and slave ID)

**Symptoms:** Constant read errors; adapter TX/RX LEDs blink but no valid responses arrive.

**Root cause:** RS-485 A and B terminals are swapped.

**Fix:** Swap the two wires at either the sensor terminal or the adapter terminal. RS-485 is polarity-sensitive.

---

### Scenario 7: Wrong baud rate

**Symptoms:** Consistent read errors; adapter LEDs blink but no valid Modbus frames are received.

**Root cause:** `baudrate:` in `config.yaml` does not match the sensor configuration. The factory default is 9600 bps.

**Fix:** Set `baudrate: 9600` in `config.yaml`. If the sensor was previously reconfigured, use WitMotion software (see Scenario 12) to determine the current baud rate.

---

### Scenario 8: Wrong slave ID

**Symptoms:** Modbus exception or "Device error response" in logs; all channels read 0 or return error responses.

**Root cause:** `slave_id:` in `config.yaml` does not match the sensor. The WTVB01-485 factory default is **80 decimal (= 0x50 hex)**.

**Fix:** Set `slave_id: 80` in `config.yaml`. Note: write `80`, not `"0x50"` — YAML does not parse quoted hex strings as integers.

---

### Scenario 9: USB-RS485 driver not installed (Windows)

**Symptoms:** Device Manager shows "USB Serial Device" or "Unknown Device" under "Other devices" — no COM port is assigned.

**Root cause:** WCH CH340 driver not installed.

**Fix:** Download and install the driver from https://www.wch-ic.com/products/CH340.html, reconnect the adapter, and verify a COM port appears in Device Manager under Ports (COM & LPT). (See Step 0 above.)

---

### Scenario 10: COM port changes after replug (COM3 vs COM4 confusion)

**Symptoms:** Logger worked on COM3 yesterday; today `python list_serial_ports.py` shows COM4.

**Root cause:** Windows assigns COM port numbers based on the USB port used. Plugging into a different USB port gives a different number.

**Fix:**
1. Always plug into the same USB port.
2. Or update `serial_port:` in `config.yaml` after every replug.
3. Run `python list_serial_ports.py` after every replug to confirm the current port.

---

### Scenario 11: slave_id as hex string ("0x50" vs 80 confusion)

**Symptoms:** Config validation error: `slave_id must be an integer`.

**Root cause:** Some WitMotion documentation shows the slave address as `0x50` (hexadecimal). YAML does not parse quoted hex strings as integers.

**Fix:** In `config.yaml`, write `slave_id: 80` (decimal integer, no quotes). Never write `slave_id: "0x50"`.

---

### Scenario 12: How to test with WitMotion software before running Python

**Purpose:** Verify the physical hardware chain (wiring, power, driver) independently of the Python logger.

**Tool:** WitMotion provides a serial debug assistant for Windows. Search for "WitMotion software download" at https://www.witmotion.hk or visit:
https://github.com/WITMOTION/WitStandardProtocol_JY61/tree/master

> Note: the exact software name varies by product; look for "WTRTK232", "WT Serial Debug Assistant", or the sensor-specific PC tool on the WitMotion product page.

**Steps:**
1. Install the WitMotion software.
2. Select the COM port and baud rate 9600.
3. If sensor register values appear in the software, the hardware chain is confirmed good.
4. If no values appear, check wiring, driver, and slave ID settings before debugging the Python logger.

## Painel da corrida (site/)

O painel é um site estático em português (`site/`) que mostra a visão geral de uma corrida de campo: indicadores, classes de severidade, médias e máximos, estatísticas por eixo e qualidade dos dados, com limiares, filtros e opções de exibição editáveis no navegador.

### Prévia local

```
python -m tools.serve_site
```

Abra http://localhost:8000/. O servidor desativa o cache do navegador, então cada recarga já mostra a versão atual dos scripts (com `python -m http.server` o navegador pode manter módulos antigos — nesse caso use Ctrl+Shift+R). Abrir `site/index.html` direto (`file://`) não funciona, pois a página carrega o JSON da corrida por `fetch`.

### Regenerar os dados

```
python -m tools.dashboard_converter Results_1st.Run/raw --run-id 2026-10-02-l4-t102 --title "VLT Carioca · Linha 4 · Trem 102 (MRO 102) · Sapata coletora" --golden tests/fixtures/golden_run1.json --workbook "Results_1st.Run/treated/Final - Monitoramento de Sapata coletora - Linha 04.xlsx"
```

Exige os CSVs brutos locais (fora do git). Detalhes em `tools/dashboard_converter/README.md`.

### Testes

```
python -m pytest
node --test "tests/js/*.test.js"
```

Node >= 22.7, sem npm.

### Publicação

O workflow `.github/workflows/pages.yml` publica apenas `site/` no GitHub Pages, e somente quando as duas suítes de testes passam.

URL pública: (definida após a criação do repositório)
