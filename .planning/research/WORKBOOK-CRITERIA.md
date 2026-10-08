# Workbook Criteria — Results_1st.Run (source of truth for JS re-implementation)

Extracted 2026-10-08 from `Results_1st.Run/Final - Monitoramento de Sapata coletora - Linha 04.xlsx`, sheet `11 — CRITÉRIOS` (plus `00 — PAINEL`). Use these as golden values: at default parameters the dashboard MUST reproduce them.

## Campaign
VLT Carioca · Linha 4 · Trem 102 (MRO 102) · Sensor wtvb01 · 02/10/2026 00:30–01:58 (America/Sao_Paulo) · ~5 Hz.

## Source data
- Use sheet `02 — DADOS TRATADOS` (23.383 rows). Raw sheet `01` lost decimal separators.
- Accel recovery: if |x| > 16 g → divide by 10^INT(LOG10|x|) if result is a multiple of 1/2048 g, else by 10^(INT(LOG10|x|)−1).
- GPS recovery: if |lat|>90 or |lon|>180 → x / 10^(INT(LOG10|x|) − 1) (keeps 2 integer digits).
- GPS envelope: lat −22.92…−22.88, lon −43.22…−43.16.
- Registros com coordenada 21.363 · sem coordenada 2.020.

## Analysis parameters (defaults)
| Param | Default | Notes |
|---|---|---|
| Rest-level offset AX (median) | 0.0458984375 g | dinâmico = medido − mediana |
| Rest-level offset AY (median) | −0.0185546875 g | |
| Rest-level offset AZ (median) | −0.9853515625 g | ≈ gravity |
| Max plausible speed between fixes | 50 km/h | GPS jump filter |
| Max interval between fixes for speed | 120 s | |

## Derived fields
- Resultante = √(AX²+AY²+AZ²) (includes gravity); Resultante dinâmica = √(AXd²+AYd²+AZd²).
- Eixo dominante = axis with max |dynamic component|; severity value = |that component|.
- Classes (lower bound inclusive): Normal < 0,5 ≤ Leve < 1 ≤ Moderado < 2 ≤ Severo < 4 ≤ Crítico (g).
- Evento = measurement ≥ Leve.
- Impacto agrupado = run of consecutive event measurements (row order); class = max measurement in run.
- Ponto de impacto = per location, the single event measurement with max |eixo dominante|. Location = GPS coordinate (repeats ~30 s); no GPS → the trecho.
- Velocidade estimada = haversine distance to next fix / Δt × 3.6, valid if Δt ≤ 120 s and v ≤ 50 km/h.
- "Valor elevado" highlight = dynamic component outside the axis P0.5–P99.5.

## Trecho priority
1 — Alta: ≥ 1 ponto Crítico · 2 — Média: no Crítico, ≥ 1 Severo · 3 — Baixa: only Moderado · 4 — Monitorar: only Leve or none.

## Sentido mapping
TIG-PXV → Sentido 1 — Terminal Gentileza → Praça XV · PXV-TIG → Sentido 2 — Praça XV → Terminal Gentileza.

## Trechos (padronizado, ordem)
S1: 1 Terminal Gentileza – Rodoviária · 2 Rodoviária – Equador · 3 Equador – Pereira Reis · 4 Pereira Reis – Vila Olímpica · 5 Vila Olímpica – Central · 6 Central – Cristiano Ottoni/Pequena África · 7 Cristiano Ottoni/Pequena África – Saara · 8 Saara – Tiradentes · 9 Tiradentes – Colombo · 10 Colombo – Praça XV
S2: 11 Praça XV – Colombo · 12 Colombo – Tiradentes · 13 Tiradentes – Saara · 14 Saara – Cristiano Ottoni/Pequena África · 15 Cristiano Ottoni/Pequena África – Central · 16 Central – Gamboa · 17 Central – Dentro do Túnel · 18 Gamboa – Santo Cristo · 19 Santo Cristo – Cordeiro da Graça · 20 Cordeiro da Graça – Rodoviária · 21 Rodoviária – Terminal Gentileza

## Colour legend (farol)
Normal = verde · Leve = amarelo · Moderado = laranja · Severo = vermelho · Crítico = roxo.

## Golden totals (default params, no filters)
| Metric | Value |
|---|---|
| Total registros | 23.383 |
| Normal / Leve / Moderado / Severo / Crítico (medições) | 21.031 / 1.611 / 512 / 173 / 56 |
| Eventos (medições ≥ Leve) | 2.352 |
| Impactos agrupados | 1.749 (Leve 1.112 · Mod 423 · Sev 159 · Crít 55) |
| Pontos de impacto | 101 (Leve 8 · Mod 16 · Sev 36 · Crít 41) |
| Trechos sem impacto Crítico | 6 of 21 |
| Trechos com ponto Crítico | 15 of 21 |
| Trecho com mais eventos | Vila Olímpica – Central (304) |
| Média AX / AY / AZ | 0.04303 / −0.01147 / −0.98747 g |
| Média resultante / resultante dinâmica | 1.06105 / 0.27438 g |
| Maior AX / AY / AZ (medido) | 10.1636 / −10.7070 / −12.6455 g |
| Maior resultante / resultante dinâmica | 17.7306 / 17.1108 g |
| #1 ponto | 01:53:16, Santo Cristo – Cordeiro da Graça, −22.896797, −43.202990, AZ din −11.66 g Crítico |
| Sentido 1 / 2 registros | 10.839 / 12.544 · eventos 1.262 / 1.090 |
