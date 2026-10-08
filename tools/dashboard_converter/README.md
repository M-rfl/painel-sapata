# Conversor de CSV bruto para o dashboard

Converte a pasta de CSVs brutos do logger (arquivos `,` limpos e re-salvos do Excel com `;`) em um
JSON do site (`site/data/run-<id>.json`, schema 1) e gera um relatório de validação em markdown.

## Comando da corrida 1

```
python -m tools.dashboard_converter Results_1st.Run/raw --run-id 2026-10-02-l4-t102 --title "VLT Carioca · Linha 4 · Trem 102 (MRO 102) · Sapata coletora" --golden tests/fixtures/golden_run1.json --workbook "Results_1st.Run/treated/Final - Monitoramento de Sapata coletora - Linha 04.xlsx"
```

`--workbook` é opcional (lento). A regeneração exige os CSVs brutos locais (`Results_1st.Run/raw`, fora do git).

O relatório vai para `Results_1st.Run/validation-<run_id>.md` (pasta ignorada pelo git).

## Opções

| Opção | Padrão | Descrição |
|---|---|---|
| `run_dir` | (obrigatório) | pasta com os CSVs brutos |
| `--stations` | `Stations_GEO` | pasta com `Line*_Stat_geo.txt` |
| `--out` | `site/data/run-<run_id>.json` | JSON de saída |
| `--run-id` | `<data>-l<linha>` | identificador da corrida |
| `--title` | `Linha <n> · <dd/mm/aaaa>` | título exibido |
| `--line` | detecção automática | força a linha |
| `--radius` | 100 | raio da geocerca (m) |
| `--terminal-radius` | 200 | raio nos terminais (m) |
| `--golden` | — | JSON golden: verificação exata de contagens; também embute `meta.workbook_reference` no JSON (selo "conforme planilha"). O JSON traz `source_runs` (arquivo de origem por linha, em ordem temporal) |
| `--workbook` | — | planilha tratada (lenta, minutos); requer openpyxl |
| `--report` | `<pasta da corrida>/../validation-<run_id>.md` | relatório markdown |

## Códigos de saída

- `0`: sucesso, todas as verificações exatas OK
- `1`: erro estrutural (colunas ausentes, nenhum CSV, número de linhas diferente do golden, sem arquivos de estações); nenhum JSON é escrito
- `2`: alguma verificação exata falhou (FALHA); o JSON é escrito para inspeção

## Dependências

O conversor usa só a biblioteca padrão. Para `--workbook`: `pip install -r requirements-dashboard.txt`.

## Motor JS e testes de paridade

O motor de análise em JavaScript vive em `site/js/core/` e espelha `analysis_ref.py` (o oráculo em Python). Os testes JS rodam com `node --test` (Node >= 22.7, sem `package.json`): não passe um diretório; use `node --test` na raiz ou `node --test "tests/js/*.test.js"`.

Os casos de paridade (`tests/fixtures/parity_cases.json`) são gerados pelo oráculo com parâmetros aleatórios (semente fixa) e reexecutados em JS. Depois de alterar `analysis_ref.py` ou regenerar o JSON do site, rode `python -m tools.dashboard_converter.gen_parity` e faça commit do fixture; senão `pytest` falha (`tests/test_parity_fixture.py`).

O CI da Fase 11 deve usar `setup-node` 22 ou 24.

## O que vai para o git

O JSON do site é versionado; os CSVs brutos, a planilha e os relatórios de validação não.
