"""Gerador do manual de usuario WTVB01 em formato .docx."""
from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

doc = Document()

# ---------------------------------------------------------------------------
# Estilos e configuracoes de pagina
# ---------------------------------------------------------------------------

# Margens A4
section = doc.sections[0]
section.page_width  = Cm(21.0)
section.page_height = Cm(29.7)
section.left_margin   = Cm(2.5)
section.right_margin  = Cm(2.5)
section.top_margin    = Cm(2.5)
section.bottom_margin = Cm(2.0)

# Cor padrao dos titulos: azul escuro
AZUL_TITULO = RGBColor(0x1F, 0x49, 0x7D)
AZUL_SUB    = RGBColor(0x2E, 0x75, 0xB6)
VERDE_NOTA  = RGBColor(0x37, 0x5A, 0x23)
VERMELHO_AV = RGBColor(0xC0, 0x39, 0x2B)

def set_run_color(run, cor):
    run.font.color.rgb = cor

def add_heading1(doc, texto):
    p = doc.add_heading(texto, level=1)
    for run in p.runs:
        run.font.color.rgb = AZUL_TITULO
        run.font.size = Pt(16)
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after  = Pt(6)
    return p

def add_heading2(doc, texto):
    p = doc.add_heading(texto, level=2)
    for run in p.runs:
        run.font.color.rgb = AZUL_SUB
        run.font.size = Pt(13)
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after  = Pt(4)
    return p

def add_heading3(doc, texto):
    p = doc.add_heading(texto, level=3)
    for run in p.runs:
        run.font.color.rgb = AZUL_SUB
        run.font.size = Pt(11)
        run.bold = True
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after  = Pt(2)
    return p

def add_body(doc, texto):
    p = doc.add_paragraph(texto)
    p.paragraph_format.space_after = Pt(6)
    for run in p.runs:
        run.font.size = Pt(11)
    return p

def add_note(doc, texto, tipo="nota"):
    """tipo: 'nota' (verde) ou 'aviso' (vermelho)"""
    p = doc.add_paragraph()
    cor = VERDE_NOTA if tipo == "nota" else VERMELHO_AV
    prefixo = "NOTA: " if tipo == "nota" else "AVISO: "
    run = p.add_run(prefixo)
    run.bold = True
    run.font.color.rgb = cor
    run.font.size = Pt(10)
    run2 = p.add_run(texto)
    run2.font.size = Pt(10)
    run2.font.color.rgb = cor
    p.paragraph_format.left_indent = Cm(0.5)
    p.paragraph_format.space_after = Pt(6)
    return p

def add_code(doc, texto):
    p = doc.add_paragraph(texto, style='No Spacing')
    p.paragraph_format.left_indent = Cm(1.0)
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after  = Pt(2)
    for run in p.runs:
        run.font.name = 'Courier New'
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(0x1A, 0x1A, 0x1A)
    # Fundo cinza claro
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), 'F2F2F2')
    pPr.append(shd)
    return p

def add_bullet(doc, texto, nivel=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Cm(0.5 + nivel * 0.5)
    run = p.add_run(texto)
    run.font.size = Pt(11)
    p.paragraph_format.space_after = Pt(2)
    return p

def add_num(doc, texto, nivel=0):
    p = doc.add_paragraph(style='List Number')
    p.paragraph_format.left_indent = Cm(0.5 + nivel * 0.5)
    run = p.add_run(texto)
    run.font.size = Pt(11)
    p.paragraph_format.space_after = Pt(4)
    return p

def add_table_row(table, cells):
    row = table.add_row()
    for i, (text, bold) in enumerate(cells):
        cell = row.cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(text)
        run.font.size = Pt(10)
        if bold:
            run.bold = True
    return row


# ===========================================================================
# CAPA
# ===========================================================================

doc.add_paragraph()
doc.add_paragraph()

p_titulo = doc.add_paragraph()
p_titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p_titulo.add_run("WTVB01-485\nAcelerômetro Industrial")
r.font.size = Pt(26)
r.font.bold = True
r.font.color.rgb = AZUL_TITULO

p_sub = doc.add_paragraph()
p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r2 = p_sub.add_run("Guia de Instalação e Uso do Software de Aquisição")
r2.font.size = Pt(16)
r2.font.color.rgb = AZUL_SUB

doc.add_paragraph()

p_ver = doc.add_paragraph()
p_ver.alignment = WD_ALIGN_PARAGRAPH.CENTER
r3 = p_ver.add_run("Versão 1.0  •  " + datetime.date.today().strftime("%B de %Y").capitalize())
r3.font.size = Pt(12)
r3.font.color.rgb = RGBColor(0x60, 0x60, 0x60)

doc.add_page_break()

# ===========================================================================
# SUMARIO (manual)
# ===========================================================================

add_heading1(doc, "Sumário")
sumario = [
    ("1", "Visão Geral do Sistema", 3),
    ("2", "Requisitos de Hardware e Software", 3),
    ("3", "Instalação do Driver USB-RS485", 4),
    ("4", "Identificação da Porta Serial", 5),
    ("5", "Configuração do Software (config.yaml)", 6),
    ("6", "Executando o Programa", 7),
    ("   6.1", "Modo Terminal (headless)", 7),
    ("   6.2", "Modo com Visualizador Gráfico (--gui)", 8),
    ("7", "Interpretando os Dados em Tempo Real", 9),
    ("8", "Arquivos CSV Gerados", 10),
    ("9", "GPS (opcional)", 11),
    ("10", "Solução de Problemas", 12),
    ("11", "Referência Rápida dos Parâmetros", 14),
]
for num, titulo, pag in sumario:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    run_num = p.add_run(f"{num}  ")
    run_num.font.size = Pt(11)
    run_num.bold = True if not num.startswith(" ") else False
    run_tit = p.add_run(titulo)
    run_tit.font.size = Pt(11)
    run_pag = p.add_run(f"  .....  {pag}")
    run_pag.font.size = Pt(10)
    run_pag.font.color.rgb = RGBColor(0x80, 0x80, 0x80)

doc.add_page_break()

# ===========================================================================
# SECAO 1 — VISAO GERAL
# ===========================================================================

add_heading1(doc, "1. Visão Geral do Sistema")

add_body(doc,
    "Este sistema permite coletar, registrar e visualizar dados em tempo real do acelerômetro "
    "industrial WitMotion WTVB01-485. O sensor mede vibração, aceleração, deslocamento, "
    "frequência e temperatura por meio de comunicação Modbus RTU via cabo USB-RS485.")

add_body(doc,
    "O software salva automaticamente cada leitura em um arquivo CSV com carimbo de data/hora "
    "no fuso horário de Brasília (America/Sao_Paulo) e, opcionalmente, exibe gráficos animados "
    "em tempo real na tela.")

add_heading2(doc, "Grandezas medidas pelo sensor")

tabela_grandezas = doc.add_table(rows=1, cols=3)
tabela_grandezas.style = 'Table Grid'
hdr = tabela_grandezas.rows[0].cells
for i, txt in enumerate(["Grandeza", "Unidade", "Eixos"]):
    run = hdr[i].paragraphs[0].add_run(txt)
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    hdr[i].paragraphs[0].paragraph_format.space_after = Pt(0)

# Cor de fundo do cabecalho
for cell in hdr:
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), '1F497D')
    tcPr.append(shd)

linhas = [
    ("Aceleração", "g (força gravitacional)", "X, Y, Z"),
    ("Velocidade de vibração", "mm/s", "X, Y, Z"),
    ("Deslocamento", "µm (micrômetros)", "X, Y, Z"),
    ("Frequência de vibração", "Hz", "X, Y, Z"),
    ("Temperatura interna", "°C", "—"),
]
for linha in linhas:
    row = tabela_grandezas.add_row()
    for i, txt in enumerate(linha):
        run = row.cells[i].paragraphs[0].add_run(txt)
        run.font.size = Pt(10)
        row.cells[i].paragraphs[0].paragraph_format.space_after = Pt(0)

doc.add_paragraph()

doc.add_page_break()

# ===========================================================================
# SECAO 2 — REQUISITOS
# ===========================================================================

add_heading1(doc, "2. Requisitos de Hardware e Software")

add_heading2(doc, "Hardware necessário")
add_bullet(doc, "Sensor WitMotion WTVB01-485")
add_bullet(doc, "Adaptador USB-RS485 (cabo com chip CH340 ou similar)")
add_bullet(doc, "Computador com Windows 10 ou superior")
add_bullet(doc, "Cabo de rede blindado (RS-485) para conexão do sensor ao adaptador")

add_heading2(doc, "Diagrama de conexão física")
add_body(doc, "A conexão entre o sensor e o computador segue o esquema abaixo:")

p_diag = doc.add_paragraph()
p_diag.paragraph_format.left_indent = Cm(1.0)
p_diag.paragraph_format.space_after = Pt(8)
r = p_diag.add_run(
    "  WTVB01-485  ──── cabo RS-485 ────  Adaptador USB-RS485  ────  USB  ────  Computador\n"
    "  (pino A+, B-)                      (pino A+, B-)               "
)
r.font.name = "Courier New"
r.font.size = Pt(10)
r.font.color.rgb = RGBColor(0x1A, 0x1A, 0x1A)

add_note(doc,
    "Respeite a polaridade: conecte o fio A+ do sensor ao terminal A+ do adaptador e "
    "o fio B- ao terminal B-. Inversão de polaridade pode impedir a comunicação.",
    tipo="aviso")

add_heading2(doc, "Software e dependências Python")
add_body(doc, "Versões mínimas recomendadas:")
add_bullet(doc, "Python 3.9 ou superior (recomendado: Python 3.11)")
add_bullet(doc, "pymodbus ≥ 3.10")
add_bullet(doc, "matplotlib ≥ 3.7 (necessário apenas para o modo --gui)")
add_bullet(doc, "pyserial ≥ 3.5")
add_bullet(doc, "pyyaml ≥ 6.0")

add_body(doc, "Para instalar todas as dependências de uma vez, execute no terminal:")
add_code(doc, "pip install pymodbus pyserial matplotlib pyyaml")

doc.add_page_break()

# ===========================================================================
# SECAO 3 — DRIVER
# ===========================================================================

add_heading1(doc, "3. Instalação do Driver USB-RS485")

add_body(doc,
    "O adaptador USB-RS485 precisa de um driver para ser reconhecido pelo Windows. "
    "A maioria dos adaptadores de baixo custo utiliza o chip CH340G ou CH341.")

add_heading2(doc, "Verificando se o driver já está instalado")
add_num(doc, "Conecte o adaptador USB-RS485 ao computador.")
add_num(doc, "Abra o Gerenciador de Dispositivos: pressione Win + X e escolha 'Gerenciador de Dispositivos'.")
add_num(doc, "Expanda a seção 'Portas (COM e LPT)'.")
add_num(doc, "Se aparecer um item como 'USB-SERIAL CH340 (COMxx)', o driver já está instalado. Anote o número da porta (ex.: COM3, COM10).")

add_heading2(doc, "Instalando o driver CH340 (se necessário)")
add_num(doc, "Se a seção 'Portas' não aparecer ou exibir 'Dispositivo Serial USB' sem número de COM, o driver precisa ser instalado.")
add_num(doc, "Baixe o driver CH340 no site oficial do fabricante: www.wch-ic.com/products/CH340.html")
add_num(doc, "Descompacte o arquivo baixado e execute o instalador (SETUP.EXE).")
add_num(doc, "Reinicie o computador se solicitado.")
add_num(doc, "Reconecte o adaptador USB e verifique novamente o Gerenciador de Dispositivos.")

add_note(doc,
    "Após a instalação do driver e conexão do adaptador, o número de porta (COMxx) "
    "será necessário para a configuração do software na próxima etapa.",
    tipo="nota")

doc.add_page_break()

# ===========================================================================
# SECAO 4 — IDENTIFICACAO DA PORTA
# ===========================================================================

add_heading1(doc, "4. Identificação da Porta Serial")

add_body(doc,
    "Antes de configurar o software, é necessário descobrir em qual porta COM o adaptador "
    "USB-RS485 foi instalado. O projeto inclui um script auxiliar para isso.")

add_heading2(doc, "Usando o script list_serial_ports.py")
add_num(doc, "Abra um terminal (Prompt de Comando ou PowerShell) na pasta do projeto.")
add_num(doc, "Execute o comando abaixo:")
add_code(doc, "python list_serial_ports.py")
add_num(doc, "O script listará todas as portas seriais disponíveis. Exemplo de saída:")
add_code(doc, "Found 1 serial port(s):")
add_code(doc, "")
add_code(doc, "  COM10            USB-SERIAL CH340 (COM10)")
add_code(doc, "                   HW: USB VID:PID=1A86:7523 SER=...")
add_num(doc, "Anote o número da porta (neste exemplo: COM10). Ele será usado no arquivo config.yaml.")

add_note(doc,
    "Se nenhuma porta for listada com o adaptador conectado, verifique o driver na Seção 3. "
    "Se o adaptador estiver conectado a uma porta USB diferente depois de configurado, "
    "execute o script novamente, pois o número de COM pode mudar.",
    tipo="aviso")

doc.add_page_break()

# ===========================================================================
# SECAO 5 — CONFIG.YAML
# ===========================================================================

add_heading1(doc, "5. Configuração do Software (config.yaml)")

add_body(doc,
    "Todas as configurações do software são definidas no arquivo config.yaml, "
    "localizado na pasta raiz do projeto. Abra-o em qualquer editor de texto.")

add_heading2(doc, "Conteúdo do arquivo config.yaml")
add_code(doc, "# Porta serial do adaptador USB-RS485")
add_code(doc, "serial_port: \"COM10\"      # ← altere para sua porta")
add_code(doc, "")
add_code(doc, "# Parâmetros de comunicação (não altere sem necessidade)")
add_code(doc, "baudrate: 9600           # padrão de fábrica do WTVB01-485")
add_code(doc, "slave_id: 80             # 0x50 hex = 80 decimal (padrão de fábrica)")
add_code(doc, "")
add_code(doc, "# Taxa de amostragem")
add_code(doc, "sample_interval_seconds: 0.1   # 10 Hz")
add_code(doc, "")
add_code(doc, "# Pasta e prefixo dos arquivos de saída")
add_code(doc, "output_folder: \"data\"")
add_code(doc, "csv_filename_prefix: \"wtvb01\"")
add_code(doc, "")
add_code(doc, "# Nível de log (DEBUG / INFO / WARNING / ERROR)")
add_code(doc, "log_level: \"WARNING\"")

add_heading2(doc, "Parâmetros importantes")

tabela_cfg = doc.add_table(rows=1, cols=3)
tabela_cfg.style = 'Table Grid'
hdr_cfg = tabela_cfg.rows[0].cells
for i, txt in enumerate(["Parâmetro", "Valor padrão", "Descrição"]):
    run = hdr_cfg[i].paragraphs[0].add_run(txt)
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    hdr_cfg[i].paragraphs[0].paragraph_format.space_after = Pt(0)
    tc = hdr_cfg[i]._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), '1F497D')
    tcPr.append(shd)

linhas_cfg = [
    ("serial_port", "COM10", "Porta onde o adaptador USB-RS485 está instalado"),
    ("baudrate", "9600", "Velocidade de comunicação (deve coincidir com o sensor)"),
    ("slave_id", "80", "Endereço Modbus do sensor (0x50 = 80 decimal)"),
    ("sample_interval_seconds", "0.1", "Intervalo entre leituras (0.1 = 10 leituras/segundo)"),
    ("output_folder", "data", "Pasta onde os arquivos CSV serão salvos"),
    ("csv_filename_prefix", "wtvb01", "Prefixo do nome do arquivo CSV"),
    ("log_level", "WARNING", "Detalhamento das mensagens de log"),
]
for linha in linhas_cfg:
    row = tabela_cfg.add_row()
    for i, txt in enumerate(linha):
        run = row.cells[i].paragraphs[0].add_run(txt)
        run.font.size = Pt(10)
        if i == 0:
            run.font.name = "Courier New"
        row.cells[i].paragraphs[0].paragraph_format.space_after = Pt(0)

doc.add_paragraph()
add_note(doc,
    "O único parâmetro que geralmente precisa ser alterado é serial_port. "
    "Todos os outros valores são os padrões de fábrica do sensor WTVB01-485.",
    tipo="nota")

doc.add_page_break()

# ===========================================================================
# SECAO 6 — EXECUTANDO
# ===========================================================================

add_heading1(doc, "6. Executando o Programa")

add_body(doc,
    "O programa possui dois modos de operação: terminal (headless) e visual (--gui). "
    "Em ambos os modos, os dados são gravados automaticamente em CSV.")

add_heading2(doc, "6.1  Modo Terminal (headless)")

add_body(doc,
    "Neste modo, o programa exibe as leituras diretamente no terminal, linha a linha, "
    "sem janelas gráficas. É ideal para servidores, scripts automáticos ou quando "
    "o computador tem recursos limitados.")

add_heading3(doc, "Como iniciar")
add_num(doc, "Abra o terminal (Prompt de Comando ou PowerShell) na pasta do projeto.")
add_num(doc, "Execute o comando:")
add_code(doc, "python main.py")
add_num(doc, "O programa exibirá mensagens de inicialização e começará a ler o sensor:")
add_code(doc, "[INFO] CSV: data\\wtvb01_20260525_143012.csv")
add_code(doc, "[INFO] Connecting to COM10...")
add_code(doc, "[INFO] Connected. Logging at 10.0 Hz. Ctrl+C to stop.")
add_code(doc, "GPS: no fix — CSV columns will be empty")
add_code(doc, "2026-05-25T14:30:13.001-03:00  ax=+0.002g  ay=-0.001g  az=+1.000g  T=25.3C")
add_code(doc, "2026-05-25T14:30:13.101-03:00  ax=+0.001g  ay=+0.000g  az=+0.999g  T=25.3C")
add_code(doc, "...")
add_num(doc, "Para encerrar a coleta, pressione Ctrl+C. O programa exibirá um resumo da sessão:")
add_code(doc, "--- Session Summary ---")
add_code(doc, "  Samples written : 1842")
add_code(doc, "  CSV file        : data\\wtvb01_20260525_143012.csv")
add_code(doc, "  Elapsed         : 3m4.2s")

add_heading2(doc, "6.2  Modo com Visualizador Gráfico (--gui)")

add_body(doc,
    "Neste modo, além da gravação em CSV, uma janela com 5 gráficos animados é aberta, "
    "exibindo todas as grandezas medidas em tempo real. O histórico exibido corresponde "
    "aos últimos 30 segundos de dados.")

add_heading3(doc, "Como iniciar")
add_num(doc, "Abra o terminal na pasta do projeto.")
add_num(doc, "Execute o comando com o parâmetro --gui:")
add_code(doc, "python main.py --gui")
add_num(doc, "O programa inicializa e abre automaticamente a janela de gráficos.")
add_num(doc, "Para encerrar, feche a janela de gráficos ou pressione Ctrl+C no terminal.")

add_heading3(doc, "Gráficos exibidos na janela")
add_bullet(doc, "Gráfico 1 — Aceleração (g): eixos ax (azul), ay (verde), az (vermelho)")
add_bullet(doc, "Gráfico 2 — Velocidade de vibração (mm/s): eixos vib_x, vib_y, vib_z")
add_bullet(doc, "Gráfico 3 — Deslocamento (µm): eixos disp_x, disp_y, disp_z")
add_bullet(doc, "Gráfico 4 — Frequência (Hz): eixos freq_x, freq_y, freq_z")
add_bullet(doc, "Gráfico 5 — Temperatura (°C): temperatura interna do sensor")

add_note(doc,
    "O eixo horizontal de todos os gráficos mostra o tempo decorrido em segundos desde "
    "o início da sessão. Os gráficos atualizam automaticamente a escala vertical para "
    "acomodar os valores medidos.",
    tipo="nota")

doc.add_page_break()

# ===========================================================================
# SECAO 7 — INTERPRETANDO DADOS
# ===========================================================================

add_heading1(doc, "7. Interpretando os Dados em Tempo Real")

add_heading2(doc, "Leitura do terminal")
add_body(doc,
    "Cada linha impressa no terminal representa uma leitura do sensor no formato:")
add_code(doc, "<timestamp>  ax=<valor>g  ay=<valor>g  az=<valor>g  T=<valor>C")
add_body(doc, "Exemplo:")
add_code(doc, "2026-05-25T14:32:01.123-03:00  ax=+0.002g  ay=-0.001g  az=+0.998g  T=26.1C")

tabela_disp = doc.add_table(rows=1, cols=2)
tabela_disp.style = 'Table Grid'
for i, txt in enumerate(["Campo", "Significado"]):
    run = tabela_disp.rows[0].cells[i].paragraphs[0].add_run(txt)
    run.bold = True; run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    tabela_disp.rows[0].cells[i].paragraphs[0].paragraph_format.space_after = Pt(0)
    tc = tabela_disp.rows[0].cells[i]._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), '1F497D')
    tcPr.append(shd)

for campo, sig in [
    ("timestamp", "Data e hora da leitura no fuso de Brasília (ISO 8601)"),
    ("ax / ay / az", "Aceleração nos três eixos em g (1g ≈ 9,8 m/s²). Em repouso: az ≈ ±1g"),
    ("T", "Temperatura interna do sensor em °C"),
]:
    row = tabela_disp.add_row()
    r0 = row.cells[0].paragraphs[0].add_run(campo); r0.font.size = Pt(10); r0.font.name = "Courier New"
    r1 = row.cells[1].paragraphs[0].add_run(sig);   r1.font.size = Pt(10)
    row.cells[0].paragraphs[0].paragraph_format.space_after = Pt(0)
    row.cells[1].paragraphs[0].paragraph_format.space_after = Pt(0)

doc.add_paragraph()

add_heading2(doc, "Valores esperados em condição normal")
add_bullet(doc, "Aceleração az ≈ ±1,0 g quando o sensor está na posição vertical (eixo Z na direção da gravidade).")
add_bullet(doc, "Aceleração ax e ay ≈ 0,0 g quando o sensor está estático e plano.")
add_bullet(doc, "Velocidade de vibração próxima de 0 mm/s quando a máquina está parada.")
add_bullet(doc, "Temperatura entre 20°C e 80°C dependendo do ambiente.")

add_note(doc,
    "Valores de velocidade de vibração acima de 10 mm/s podem indicar vibração excessiva "
    "em equipamentos industriais. Consulte as normas ISO 10816 para limites de vibração "
    "de acordo com o tipo de máquina.",
    tipo="nota")

doc.add_page_break()

# ===========================================================================
# SECAO 8 — CSV
# ===========================================================================

add_heading1(doc, "8. Arquivos CSV Gerados")

add_body(doc,
    "A cada execução do programa, um novo arquivo CSV é criado automaticamente na pasta "
    "definida em config.yaml (padrão: pasta data/). O nome do arquivo inclui a data e "
    "hora de início da sessão.")

add_heading2(doc, "Padrão de nomenclatura")
add_code(doc, "wtvb01_AAAAMMDD_HHMMSS.csv")
add_body(doc, "Exemplo: wtvb01_20260525_143012.csv (sessão iniciada em 25/05/2026 às 14:30:12)")

add_heading2(doc, "Colunas do arquivo CSV")

colunas_csv = [
    ("timestamp",     "Data e hora da leitura (ISO 8601, fuso Brasília)"),
    ("ax_g",          "Aceleração eixo X (g)"),
    ("ay_g",          "Aceleração eixo Y (g)"),
    ("az_g",          "Aceleração eixo Z (g)"),
    ("vx_mm_s",       "Velocidade de vibração eixo X (mm/s)"),
    ("vy_mm_s",       "Velocidade de vibração eixo Y (mm/s)"),
    ("vz_mm_s",       "Velocidade de vibração eixo Z (mm/s)"),
    ("angle_x",       "Ângulo X — reservado, sempre vazio neste modelo"),
    ("angle_y",       "Ângulo Y — reservado, sempre vazio neste modelo"),
    ("angle_z",       "Ângulo Z — reservado, sempre vazio neste modelo"),
    ("temperature_c", "Temperatura interna (°C)"),
    ("dx_um",         "Deslocamento eixo X (µm)"),
    ("dy_um",         "Deslocamento eixo Y (µm)"),
    ("dz_um",         "Deslocamento eixo Z (µm)"),
    ("freq_x_hz",     "Frequência de vibração eixo X (Hz)"),
    ("freq_y_hz",     "Frequência de vibração eixo Y (Hz)"),
    ("freq_z_hz",     "Frequência de vibração eixo Z (Hz)"),
    ("sensor_id",     "Identificador do sensor (padrão: wtvb01)"),
    ("gps_lat",       "Latitude GPS (vazio se GPS indisponível)"),
    ("gps_lon",       "Longitude GPS (vazio se GPS indisponível)"),
    ("gps_speed_mps", "Velocidade GPS em m/s (vazio se GPS indisponível)"),
]

tabela_csv = doc.add_table(rows=1, cols=2)
tabela_csv.style = 'Table Grid'
for i, txt in enumerate(["Coluna", "Descrição"]):
    run = tabela_csv.rows[0].cells[i].paragraphs[0].add_run(txt)
    run.bold = True; run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    tabela_csv.rows[0].cells[i].paragraphs[0].paragraph_format.space_after = Pt(0)
    tc = tabela_csv.rows[0].cells[i]._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), '1F497D')
    tcPr.append(shd)

for col, desc in colunas_csv:
    row = tabela_csv.add_row()
    r0 = row.cells[0].paragraphs[0].add_run(col)
    r0.font.size = Pt(9); r0.font.name = "Courier New"
    r1 = row.cells[1].paragraphs[0].add_run(desc)
    r1.font.size = Pt(9)
    row.cells[0].paragraphs[0].paragraph_format.space_after = Pt(0)
    row.cells[1].paragraphs[0].paragraph_format.space_after = Pt(0)

doc.add_paragraph()

add_note(doc,
    "Células vazias nas colunas angle_x/y/z são normais: esses registros são reservados "
    "no firmware do WTVB01-485 e não fornecem dados de ângulo. Da mesma forma, as colunas "
    "GPS ficam vazias quando não há receptor GPS conectado.",
    tipo="nota")

doc.add_page_break()

# ===========================================================================
# SECAO 9 — GPS
# ===========================================================================

add_heading1(doc, "9. GPS (opcional)")

add_body(doc,
    "O software pode registrar coordenadas GPS em cada linha do CSV se o computador "
    "possuir localização habilitada (GPS interno, adaptador GPS USB ou Wi-Fi/célula). "
    "O GPS funciona exclusivamente em Windows via API de Localização do Windows.")

add_heading2(doc, "Habilitando o GPS no Windows")
add_num(doc, "Abra as Configurações do Windows (Win + I).")
add_num(doc, "Navegue até Privacidade e segurança → Localização.")
add_num(doc, "Ative a opção 'Serviços de localização'.")
add_num(doc, "Ative também 'Permitir que aplicativos acessem sua localização'.")
add_num(doc, "Execute o programa normalmente. Se o GPS estiver disponível, aparecerá:")
add_code(doc, "GPS: fix acquired")
add_body(doc, "Se não houver GPS ou permissão negada, aparecerá uma das mensagens:")
add_code(doc, "GPS: no fix — CSV columns will be empty")
add_code(doc, "GPS: location access denied — enable in Windows Settings › Privacy › Location")

add_note(doc,
    "O GPS não interfere na frequência de amostragem do sensor. As coordenadas são "
    "atualizadas em segundo plano a 1 Hz e associadas à leitura mais recente do sensor.",
    tipo="nota")

doc.add_page_break()

# ===========================================================================
# SECAO 10 — SOLUCAO DE PROBLEMAS
# ===========================================================================

add_heading1(doc, "10. Solução de Problemas")

problemas = [
    (
        "Erro: Cannot connect to COMxx. Check cable and config.yaml.",
        [
            "Verifique se o adaptador USB-RS485 está conectado ao computador.",
            "Execute python list_serial_ports.py e confirme o número da porta.",
            "Abra config.yaml e corrija o campo serial_port com o valor correto.",
            "Verifique se o cabo RS-485 está conectado ao sensor com a polaridade correta (A+, B-).",
            "Verifique se outro programa (como o WitMotion PC Software) não está usando a porta.",
            "Tente desconectar e reconectar o adaptador USB.",
        ]
    ),
    (
        "Mensagem [WARN] Read failed - retrying... repetida",
        [
            "Verifique a conexão física do cabo RS-485 (contatos limpos, sem ruptura).",
            "Confirme que slave_id em config.yaml é 80 (padrão de fábrica do WTVB01-485).",
            "Confirme que baudrate é 9600 (padrão de fábrica).",
            "Certifique-se de que o sensor está alimentado (verifique tensão de alimentação: 5-30V DC).",
            "Se o sensor foi reconfigurado, ajuste slave_id e baudrate conforme a configuração atual.",
        ]
    ),
    (
        "A janela gráfica (--gui) não abre ou trava",
        [
            "Certifique-se de que matplotlib está instalado: pip install matplotlib.",
            "Execute python main.py --gui a partir da pasta raiz do projeto.",
            "Se aparecer erro sobre 'TkAgg backend', instale o suporte Tk: pip install tk.",
            "Em caso de tela preta, aguarde alguns segundos — os gráficos aparecem após a primeira leitura.",
        ]
    ),
    (
        "Nenhuma porta serial listada por list_serial_ports.py",
        [
            "Instale o driver CH340 conforme descrito na Seção 3.",
            "Tente outra porta USB do computador.",
            "Verifique no Gerenciador de Dispositivos se há algum dispositivo com sinal de erro (ícone amarelo).",
        ]
    ),
    (
        "Valores de aceleração muito altos (ex.: ax ≈ 32g)",
        [
            "Este problema ocorria em versões antigas e foi corrigido. Verifique se está usando a versão mais recente do software.",
            "Certifique-se de que o arquivo sensor.py contém a função to_signed16 aplicada nas leituras de aceleração.",
        ]
    ),
    (
        "Arquivo CSV não é criado",
        [
            "Verifique se a pasta indicada em output_folder (padrão: data) existe ou se o programa tem permissão para criá-la.",
            "Execute o programa como administrador se houver problemas de permissão de escrita.",
            "Verifique se o disco tem espaço disponível.",
        ]
    ),
    (
        "GPS: location access denied",
        [
            "Siga as instruções da Seção 9 para habilitar a localização no Windows.",
            "O programa funciona normalmente sem GPS — apenas as colunas GPS ficarão vazias no CSV.",
        ]
    ),
]

for titulo_prob, solucoes in problemas:
    add_heading2(doc, titulo_prob)
    for sol in solucoes:
        add_bullet(doc, sol)
    doc.add_paragraph()

doc.add_page_break()

# ===========================================================================
# SECAO 11 — REFERENCIA RAPIDA
# ===========================================================================

add_heading1(doc, "11. Referência Rápida dos Parâmetros")

add_heading2(doc, "Comandos principais")

tabela_cmd = doc.add_table(rows=1, cols=2)
tabela_cmd.style = 'Table Grid'
for i, txt in enumerate(["Comando", "Descrição"]):
    run = tabela_cmd.rows[0].cells[i].paragraphs[0].add_run(txt)
    run.bold = True; run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    tabela_cmd.rows[0].cells[i].paragraphs[0].paragraph_format.space_after = Pt(0)
    tc = tabela_cmd.rows[0].cells[i]._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd'); shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), '1F497D'); tcPr.append(shd)

for cmd, desc in [
    ("python list_serial_ports.py",   "Lista as portas seriais disponíveis no computador"),
    ("python main.py",                "Inicia coleta em modo terminal (sem janela gráfica)"),
    ("python main.py --gui",          "Inicia coleta com visualizador gráfico em tempo real"),
    ("Ctrl+C",                        "Encerra a coleta e exibe o resumo da sessão"),
]:
    row = tabela_cmd.add_row()
    r0 = row.cells[0].paragraphs[0].add_run(cmd);  r0.font.size = Pt(10); r0.font.name = "Courier New"
    r1 = row.cells[1].paragraphs[0].add_run(desc); r1.font.size = Pt(10)
    row.cells[0].paragraphs[0].paragraph_format.space_after = Pt(0)
    row.cells[1].paragraphs[0].paragraph_format.space_after = Pt(0)

doc.add_paragraph()

add_heading2(doc, "Parâmetros do sensor (config.yaml)")

tabela_ref = doc.add_table(rows=1, cols=4)
tabela_ref.style = 'Table Grid'
for i, txt in enumerate(["Parâmetro", "Padrão de fábrica", "Valores possíveis", "Quando alterar"]):
    run = tabela_ref.rows[0].cells[i].paragraphs[0].add_run(txt)
    run.bold = True; run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    tabela_ref.rows[0].cells[i].paragraphs[0].paragraph_format.space_after = Pt(0)
    tc = tabela_ref.rows[0].cells[i]._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd'); shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), '1F497D'); tcPr.append(shd)

for p, df, vals, quando in [
    ("serial_port",  "Depende do PC",  "COMx (Windows)",  "Sempre — cada PC tem porta diferente"),
    ("baudrate",     "9600",           "9600 / 19200 / ...", "Se o sensor foi reconfigurado"),
    ("slave_id",     "80 (0x50)",      "1–247",           "Se o sensor foi reconfigurado"),
    ("sample_interval_seconds", "0.1", "0.02–1.0",        "Para aumentar/reduzir taxa de amostragem"),
]:
    row = tabela_ref.add_row()
    for i2, txt2 in enumerate([p, df, vals, quando]):
        r = row.cells[i2].paragraphs[0].add_run(txt2)
        r.font.size = Pt(9)
        if i2 == 0:
            r.font.name = "Courier New"
        row.cells[i2].paragraphs[0].paragraph_format.space_after = Pt(0)

doc.add_paragraph()

add_heading2(doc, "Checklist de primeira utilização")
passos_check = [
    "Instalar o driver CH340 (se ainda não instalado)",
    "Conectar o adaptador USB-RS485 ao computador",
    "Conectar o cabo RS-485 entre o adaptador e o sensor (respeitar polaridade A+/B-)",
    "Alimentar o sensor (5–30V DC)",
    "Executar python list_serial_ports.py e anotar o número da porta COM",
    "Abrir config.yaml e atualizar serial_port com o número da porta anotado",
    "Executar python main.py para validar a conexão",
    "Se tudo funcionar, executar python main.py --gui para ver os gráficos",
]
for passo in passos_check:
    add_bullet(doc, passo)

doc.add_paragraph()
doc.add_paragraph()

p_rodape = doc.add_paragraph()
p_rodape.alignment = WD_ALIGN_PARAGRAPH.CENTER
r_rf = p_rodape.add_run(
    "Accel MRO  •  Software WTVB01 Notebook Logger  •  "
    + datetime.date.today().strftime("%d/%m/%Y")
)
r_rf.font.size = Pt(9)
r_rf.font.color.rgb = RGBColor(0x80, 0x80, 0x80)

# ===========================================================================
# Salvar
# ===========================================================================

output_path = r"c:\Users\Cliente\Documents\Accel_mro\WTVB01_Manual_Usuario.docx"
doc.save(output_path)
print(f"Documento salvo: {output_path}")
