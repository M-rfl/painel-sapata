"""Gera o guia de instalação do WTVB01 Notebook Logger em formato DOCX."""
from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

doc = Document()

# ── Estilos base ──────────────────────────────────────────────────────────────
style_normal = doc.styles["Normal"]
style_normal.font.name = "Calibri"
style_normal.font.size = Pt(11)

# Margens
for section in doc.sections:
    section.top_margin    = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin   = Cm(3.0)
    section.right_margin  = Cm(2.5)

# ── Helpers ───────────────────────────────────────────────────────────────────
AZUL_TITULO  = RGBColor(0x1F, 0x49, 0x7D)   # azul escuro
AZUL_CABEC_HEX  = "1F497D"
AZUL_LINHA_HEX  = "EAF0FA"
BRANCO       = RGBColor(0xFF, 0xFF, 0xFF)


def set_cell_bg(cell, hex_color: str):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def heading1(text):
    p = doc.add_heading(text, level=1)
    run = p.runs[0]
    run.font.color.rgb = AZUL_TITULO
    run.font.size = Pt(16)
    run.font.bold = True
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after  = Pt(4)
    return p


def heading2(text):
    p = doc.add_heading(text, level=2)
    run = p.runs[0]
    run.font.color.rgb = AZUL_TITULO
    run.font.size = Pt(13)
    run.font.bold = True
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after  = Pt(2)
    return p


def body(text, bold=False, italic=False, space_after=4):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(11)
    run.bold   = bold
    run.italic = italic
    p.paragraph_format.space_after = Pt(space_after)
    return p


def bullet(text, bold_prefix=None):
    p = doc.add_paragraph(style="List Bullet")
    if bold_prefix:
        r = p.add_run(bold_prefix)
        r.bold = True
        r.font.size = Pt(11)
        p.add_run(text).font.size = Pt(11)
    else:
        r = p.add_run(text)
        r.font.size = Pt(11)
    p.paragraph_format.space_after = Pt(2)
    return p


def code_block(lines):
    """Bloco de código em fonte mono com fundo cinza."""
    for line in lines:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after  = Pt(0)
        p.paragraph_format.left_indent  = Cm(0.5)
        # Fundo cinza via shading no parágrafo
        pPr = p._p.get_or_add_pPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), "F2F2F2")
        pPr.append(shd)
        run = p.add_run(line if line else " ")
        run.font.name = "Courier New"
        run.font.size = Pt(10)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def note_box(text):
    """Caixa de aviso/nota em itálico com prefixo."""
    p = doc.add_paragraph()
    r = p.add_run("Nota: ")
    r.bold = True
    r.font.size = Pt(11)
    r2 = p.add_run(text)
    r2.italic = True
    r2.font.size = Pt(11)
    p.paragraph_format.left_indent  = Cm(0.5)
    p.paragraph_format.space_after  = Pt(6)


def make_table(headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.LEFT

    # Cabeçalho
    hdr = table.rows[0]
    for i, h in enumerate(headers):
        cell = hdr.cells[i]
        cell.text = h
        cell.paragraphs[0].runs[0].bold = True
        cell.paragraphs[0].runs[0].font.color.rgb = BRANCO
        cell.paragraphs[0].runs[0].font.size = Pt(10)
        set_cell_bg(cell, AZUL_CABEC_HEX)

    # Dados
    for ri, row_data in enumerate(rows):
        row = table.rows[ri + 1]
        for ci, val in enumerate(row_data):
            cell = row.cells[ci]
            cell.text = val
            cell.paragraphs[0].runs[0].font.size = Pt(10)
            if ri % 2 == 0:
                set_cell_bg(cell, AZUL_LINHA_HEX)

    # Larguras
    if col_widths:
        for i, w in enumerate(col_widths):
            for row in table.rows:
                row.cells[i].width = Cm(w)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return table


# ══════════════════════════════════════════════════════════════════════════════
# TÍTULO
# ══════════════════════════════════════════════════════════════════════════════
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("WTVB01 Notebook Logger")
r.font.name  = "Calibri"
r.font.size  = Pt(22)
r.font.bold  = True
r.font.color.rgb = AZUL_TITULO
p.paragraph_format.space_after = Pt(2)

p2 = doc.add_paragraph()
p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
r2 = p2.add_run("Guia de Instalação e Configuração")
r2.font.name  = "Calibri"
r2.font.size  = Pt(14)
r2.font.color.rgb = RGBColor(0x44, 0x72, 0xC4)
p2.paragraph_format.space_after = Pt(2)

p3 = doc.add_paragraph()
p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
r3 = p3.add_run("Versão 1.2  ·  Accel MRO  ·  2026")
r3.font.name   = "Calibri"
r3.font.size   = Pt(10)
r3.font.italic = True
r3.font.color.rgb = RGBColor(0x80, 0x80, 0x80)
p3.paragraph_format.space_after = Pt(16)

doc.add_paragraph()

# ══════════════════════════════════════════════════════════════════════════════
# 1. REQUISITOS DE SISTEMA
# ══════════════════════════════════════════════════════════════════════════════
heading1("1. Requisitos de Sistema")

make_table(
    ["Item", "Requisito"],
    [
        ["Sistema Operacional", "Windows 10 / 11  64-bit  (GPS usa Windows Location API)"],
        ["Python",              "3.9 ou superior  (testado em Python 3.13)"],
        ["Sensor",              "WitMotion WTVB01-485"],
        ["Adaptador serial",    "USB-RS485 com chip WCH CH340 (incluído com o sensor)"],
        ["Cabo",                "RS-485: fio A → terminal A do sensor; fio B → terminal B"],
    ],
    col_widths=[4.5, 11.5],
)

# ══════════════════════════════════════════════════════════════════════════════
# 2. PASSO A PASSO
# ══════════════════════════════════════════════════════════════════════════════
heading1("2. Passo a Passo de Instalação")

# ── Passo 0 ──
heading2("Passo 0  —  Instalar o driver CH340 (Windows)")
body("Fazer ANTES de conectar o adaptador USB-RS485.", bold=True)
bullet("Baixar o driver em:", bold_prefix=None)
code_block(["https://www.wch-ic.com/products/CH340.html"])
bullet("Extrair o zip e executar SETUP.EXE.")
bullet("Reiniciar o computador se solicitado.")
bullet("Conectar o adaptador USB-RS485.")
bullet("Verificar no Gerenciador de Dispositivos → Portas (COM e LPT).")
note_box('Deve aparecer "USB-SERIAL CH340 (COMx)". Se aparecer "Dispositivo desconhecido", o driver não foi instalado corretamente.')

# ── Passo 1 ──
heading2("Passo 1  —  Instalar Python")
bullet("Baixar Python 3.9+ em: https://www.python.org/downloads/")
bullet('Marcar a opção "Add Python to PATH" durante a instalação.')
bullet("Verificar a instalação abrindo o terminal e digitando:")
code_block(["python --version"])

# ── Passo 2 ──
heading2("Passo 2  —  Copiar o projeto")
body("Copiar a pasta do projeto para a máquina de destino (pendrive, zip, git clone, etc.).")
body("A estrutura esperada é:")
code_block([
    "Accel_mro/",
    "  main.py",
    "  config.yaml",
    "  requirements.txt",
    "  list_serial_ports.py",
    "  src/",
    "  data/          ← criada automaticamente",
])

# ── Passo 3 ──
heading2("Passo 3  —  Instalar dependências")
body("Abrir o terminal na pasta do projeto e executar:")
code_block(["pip install -r requirements.txt"])
note_box('Se "pip" não estiver no PATH, usar:  py -m pip install -r requirements.txt')
body("Pacotes instalados automaticamente:")
make_table(
    ["Pacote", "Função"],
    [
        ["pymodbus==3.13.0",                        "Comunicação Modbus RTU com o sensor"],
        ["pyserial>=3.5",                           "Acesso à porta serial (COM)"],
        ["PyYAML>=6.0",                             "Leitura do arquivo config.yaml"],
        ["tzdata>=2024.1",                          "Timezones no Windows (obrigatório)"],
        ["matplotlib>=3.10",                        "Gráfico em tempo real (modo --gui)"],
        ["winrt-runtime>=3.2.1",                    "Runtime Windows para GPS"],
        ["winrt-Windows.Devices.Geolocation>=3.2.1","Windows Location API (GPS)"],
        ["winrt-Windows.Foundation>=3.2.1",         "Suporte async WinRT"],
    ],
    col_widths=[7.5, 8.5],
)

# ── Passo 4 ──
heading2("Passo 4  —  Identificar a porta serial")
body("Com o adaptador conectado, executar:")
code_block(["python list_serial_ports.py"])
body("Exemplo de saída:")
code_block(["COM10 - USB-SERIAL CH340 (COM10)"])
note_box("Windows atribui portas diferentes conforme a entrada USB usada. Sempre use a mesma entrada USB para manter o número de porta fixo.")

# ── Passo 5 ──
heading2("Passo 5  —  Configurar config.yaml")
body("Abrir o arquivo config.yaml e ajustar apenas a linha serial_port:", bold=False)
code_block([
    "serial_port: \"COM10\"   # ← trocar pelo número visto no Passo 4",
    "baudrate: 9600          # padrão de fábrica — não alterar",
    "slave_id: 80            # 0x50 hex = 80 decimal — não alterar",
    "sample_interval_seconds: 0.1",
    "output_folder: \"data\"",
    "csv_filename_prefix: \"wtvb01\"",
    "log_level: \"WARNING\"",
])
note_box('slave_id deve ser 80 (decimal), nunca "0x50". YAML não interpreta strings hex como inteiros.')

# ── Passo 6 ──
heading2("Passo 6  —  Habilitar Localização para GPS (opcional)")
bullet("Abrir: Configurações do Windows → Privacidade → Localização.")
bullet("Ativar Localização para o sistema e para aplicativos.")
body("Se não ativado, o GPS fica inativo e as colunas de GPS no CSV ficam vazias. O logger funciona normalmente sem GPS.", italic=True)

# ── Passo 7 ──
heading2("Passo 7  —  Executar o logger")
body("Modo terminal (headless):")
code_block(["python main.py"])
body("Modo com gráfico ao vivo:")
code_block(["python main.py --gui"])
body("Saída esperada ao iniciar:")
code_block([
    "GPS: fix acquired",
    "[INFO] CSV: data/wtvb01_20260525_143201.csv",
    "[INFO] Connecting to COM10...",
    "[INFO] Connected. Logging at 10.0 Hz. Ctrl+C to stop.",
    "2026-05-25T14:32:01.123-03:00  ax=0.001 g  ay=-0.002 g  az=0.998 g ...",
])
body("Parar com Ctrl+C. O CSV é fechado e o resumo da sessão é exibido.")

# ══════════════════════════════════════════════════════════════════════════════
# 3. COLUNAS DO CSV
# ══════════════════════════════════════════════════════════════════════════════
heading1("3. Colunas do CSV de Saída")
body("Os arquivos são gravados em data/wtvb01_AAAAMMDD_HHMMSS.csv com 21 colunas:")
make_table(
    ["Coluna", "Unidade", "Descrição"],
    [
        ["timestamp",       "ISO 8601",  "Data/hora com fuso horário"],
        ["ax_g",            "g",         "Aceleração X"],
        ["ay_g",            "g",         "Aceleração Y"],
        ["az_g",            "g",         "Aceleração Z (~1,0 g em repouso)"],
        ["vx_mm_s",         "mm/s",      "Velocidade de vibração X"],
        ["vy_mm_s",         "mm/s",      "Velocidade de vibração Y"],
        ["vz_mm_s",         "mm/s",      "Velocidade de vibração Z"],
        ["angle_x",         "—",         "RESERVADO — sempre vazio neste modelo"],
        ["angle_y",         "—",         "RESERVADO — sempre vazio neste modelo"],
        ["angle_z",         "—",         "RESERVADO — sempre vazio neste modelo"],
        ["temperature_c",   "°C",        "Temperatura da placa"],
        ["dx_um",           "µm",        "Deslocamento X"],
        ["dy_um",           "µm",        "Deslocamento Y"],
        ["dz_um",           "µm",        "Deslocamento Z"],
        ["freq_x_hz",       "Hz",        "Frequência de vibração X"],
        ["freq_y_hz",       "Hz",        "Frequência de vibração Y"],
        ["freq_z_hz",       "Hz",        "Frequência de vibração Z"],
        ["sensor_id",       "—",         "Identificador do sensor (config.yaml)"],
        ["gps_lat",         "°",         "Latitude GPS (vazio se sem fix)"],
        ["gps_lon",         "°",         "Longitude GPS (vazio se sem fix)"],
        ["gps_speed_mps",   "m/s",       "Velocidade GPS (vazio em posicionamento Wi-Fi)"],
    ],
    col_widths=[4.0, 2.5, 9.5],
)

# ══════════════════════════════════════════════════════════════════════════════
# 4. SOLUÇÃO DE PROBLEMAS
# ══════════════════════════════════════════════════════════════════════════════
heading1("4. Solução de Problemas")
make_table(
    ["Sintoma", "Causa Provável", "Solução"],
    [
        ["Cannot connect to COMx",
         "Porta errada ou ocupada por outro software",
         "Rodar list_serial_ports.py; fechar WitMotion software"],
        ["Todos os valores 0.0",
         "slave_id errado",
         "Confirmar slave_id: 80 no config.yaml"],
        ["Repeated read errors",
         "Fiação A/B invertida ou baud rate errado",
         "Inverter os fios A/B; confirmar baudrate: 9600"],
        ["GPS: unavailable",
         "Pacotes winrt não instalados",
         "pip install -r requirements.txt"],
        ["GPS: location access denied",
         "Permissão de localização negada",
         "Configurações → Privacidade → Localização → Ativar"],
        ["GPS: searching for fix",
         "Aguardando fix Wi-Fi (normal na 1ª leitura)",
         "Aguardar alguns segundos; o fix aparece automaticamente"],
        ["COM muda a cada replug",
         "USB plugado em entrada diferente",
         "Usar sempre a mesma entrada USB"],
        ["Dispositivo desconhecido no Gerenc. de Dispositivos",
         "Driver CH340 não instalado",
         "Seguir o Passo 0"],
        ["slave_id: '0x50' gera erro de config",
         "YAML não interpreta hex string como inteiro",
         "Usar slave_id: 80 (sem aspas, sem 0x)"],
    ],
    col_widths=[4.5, 5.0, 6.5],
)

# ══════════════════════════════════════════════════════════════════════════════
# 5. VERIFICAÇÃO RÁPIDA DE HARDWARE COM SOFTWARE WITMOTION
# ══════════════════════════════════════════════════════════════════════════════
heading1("5. Verificação com Software WitMotion (opcional)")
body("Antes de usar o logger Python, é possível confirmar que hardware e cabeamento estão corretos usando o software da WitMotion:")
bullet("Instalar o software WitMotion (buscar na página do produto em www.witmotion.hk).")
bullet("Selecionar a porta COM e baud rate 9600.")
bullet("Se valores de registros aparecerem, o hardware está OK.")
bullet("Se nada aparecer, verificar fiação, driver e slave ID antes de depurar o Python.")

# ══════════════════════════════════════════════════════════════════════════════
# Salvar
# ══════════════════════════════════════════════════════════════════════════════
output_path = "WTVB01_Guia_Instalacao.docx"
doc.save(output_path)
print(f"Documento gerado: {output_path}")
