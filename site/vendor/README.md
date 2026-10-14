# Bibliotecas vendorizadas

Sem CDN e sem etapa de build (decisao travada, STACK.md). Arquivos copiados sem alteracao dos tarballs do npm.

| Biblioteca | Versao | Pacote npm | Tarball | Licenca |
|---|---|---|---|---|
| uPlot | 1.6.32 | uplot | https://registry.npmjs.org/uplot/-/uplot-1.6.32.tgz | MIT |
| Leaflet | 1.9.4 | leaflet | https://registry.npmjs.org/leaflet/-/leaflet-1.9.4.tgz | BSD-2-Clause |
| leaflet.heat | 0.2.0 | leaflet.heat | https://registry.npmjs.org/leaflet.heat/-/leaflet.heat-0.2.0.tgz | BSD-2-Clause |

## sha256

```
9010b843aad8e450890fc18dae2dfec00e68c10da775515801c42878afbb0da1  leaflet-heat/LICENSE
eb952aae5806a1102729f291bab887dde783ace859819a354827a776e73e486a  leaflet-heat/leaflet-heat.js
53e8dc25862014e4324741ca18fbe3611e11d42ef69f59f86ea8c5389647d4cb  leaflet/LICENSE
a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6  leaflet/leaflet.css
db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a  leaflet/leaflet.js
600a10dc5cd110de0699510d322afcbe01c7ca90b4c5f48adc20314c70aac753  leaflet/leaflet.js.map
8f989229699b4fe2f1a0432d0e9edc338a8a911e250e2d1b01ecd770a5f5b1bd  uplot/LICENSE
19c8d4c6ad88929a79f4ae49d6f7161566dfd0ba3d15cc495e974f787eb78f1f  uplot/uPlot.iife.min.js
df630c6a8d6f8eeaff264b50f73ce5b114f646ffd9a0bb74f049b0a00135fa04  uplot/uPlot.min.css
```

## Como atualizar

Rode `npm pack <pacote>@<versao>` em um diretorio temporario, extraia, copie os mesmos arquivos de `package/dist/` (mais `LICENSE`) e atualize versoes e hashes acima.

O diretorio `images/` do Leaflet esta ausente de proposito: so usamos `L.circleMarker` e controles customizados (nunca `L.marker` com icone padrao nem `L.control.layers`).

## Dados de rotas (OpenStreetMap)

`site/data/routes/linha-{N}-sentido-{S}.geojson` contem a geometria das relacoes OSM de cada linha/sentido (somente ways), (c) colaboradores do OpenStreetMap, licenca ODbL 1.0 (https://www.openstreetmap.org/copyright). Regenerar com `python tools/fetch_routes.py`.
