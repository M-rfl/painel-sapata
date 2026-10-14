// Pure module: no DOM/window.
// Portuguese UI string table. Class names come from core/defaults.js (CLASS_NAMES).
import { fmtInt } from './format.js';

export const T = Object.freeze({
  pageTitle: 'Monitoramento de Sapata Coletora — Painel da Corrida',
  loading: 'Carregando dados…',
  loadError: 'Não foi possível carregar os dados da corrida.',
  share: 'Copiar link',
  shareOk: 'Link copiado',
  shareFail: 'Não foi possível copiar; copie o endereço da barra do navegador.',
  linkIgnored: 'Alguns parâmetros do link foram ignorados',
  close: 'Fechar',

  // KPI labels
  kpiRegistros: 'registros',
  kpiEventos: 'eventos',
  kpiImpactos: 'impactos',
  kpiPontos: 'pontos de impacto',
  kpiTrecho: 'trecho com mais eventos',
  kpiIQ: 'índice de qualidade da via',
  iqBom: 'Bom',
  iqRegular: 'Regular',
  iqRuim: 'Ruim',

  // Sections
  // Analysis parameters
  secAnalise: 'Parâmetros de análise',
  pOffset: 'Valor de repouso (offset)',
  pMediana: 'Mediana',
  pManual: 'Manual',
  pGap: 'Agrupamento (amostras)',
  pSalto: 'Separar impactos após intervalo de (s)',
  pGpsVel: 'GPS: velocidade máxima (km/h)',
  pGpsFix: 'GPS: intervalo máximo entre fixes (s)',

  secOverview: 'Visão geral',
  secClasses: 'Classes de severidade',
  secMeans: 'Médias e máximos',
  secAxisStats: 'Estatísticas por eixo',
  secQuality: 'Qualidade dos dados',
  secThresholds: 'Limiares de severidade',
  secFilters: 'Filtros',
  secDisplay: 'Exibição',
  secCharts: 'Séries temporais',
  maisCanais: 'Mais canais',
  resetZoom: 'Ver corrida inteira',
  foraFiltro: 'Fora do filtro',
  semDados: 'Sem dados para este canal.',

  // Filters
  fSentido: 'Sentido',
  fTrecho: 'Trecho',
  fEixo: 'Eixo dominante',
  fClasse: 'Classe',
  fTempo: 'Janela de tempo',
  fTodos: 'Todos',

  // Display
  dValores: 'Valores',
  dMedido: 'Medido',
  dDinamico: 'Dinâmico',
  dMetrica: 'Métrica do mapa de calor',
  dDom: 'Eixo dominante',
  dAx: 'AX',
  dAy: 'AY',
  dAz: 'AZ',
  dResDin: 'Resultante dinâmica',
  dRaio: 'Raio',
  dIntensidade: 'Intensidade',
  dNota: 'Métrica, raio e intensidade valem para o mapa de calor (ative-o no mapa).',

  // Map
  secMap: 'Mapa do percurso',
  mapCalor: 'Mapa de calor',
  popHora: 'Hora',
  popTrecho: 'Trecho',
  popSentido: 'Sentido',
  popAxDin: 'AX din.',
  popAyDin: 'AY din.',
  popAzDin: 'AZ din.',
  popClasse: 'Classe',
  popGoogle: 'Abrir no Google Maps',
  legSentidos: 'Sentidos',
  legClasses: 'Pontos de impacto',

  // Conformity badge
  badgeOk: 'Conforme planilha',
  badgeDiff: 'Divergente da planilha',
  badgeOkDetail: 'Classes, eventos, impactos e divisão por sentido iguais à planilha de referência.',

  reset: 'Restaurar padrões',

  // Quality
  qCobertura: 'Cobertura GPS',
  qSemPosicao: 'Amostras sem posição',
  qCanaisVazios: 'Canais vazios',
  qRetorno: 'Intervalo de retorno',
  qAvisos: 'Avisos dos arquivos de estações',
  qNenhumAviso: 'nenhum aviso',
  qInferidas: 'Estações inferidas',
  qNaoClassificadas: 'Não classificadas',

  // Stats headers
  sMedia: 'Média',
  sMediana: 'Mediana',
  sDesvio: 'Desvio padrão',
  sP05: 'P0,5',
  sP995: 'P99,5',
  sMaxAbs: 'Maior valor absoluto',

  // Matrix
  secMatrix: 'Matriz trecho × severidade',
  mBase: 'Base',
  mImpactos: 'Impactos',
  mMedicoes: 'Medições',
  mPontos: 'Pontos',
  mTotal: 'Total',
  mTrecho: 'Trecho',

  // Ranking
  secRanking: 'Ranking',
  rTrechos: 'Trechos por prioridade',
  rCsv: 'Exportar CSV',
  rSemCritico: 'sem Crítico',
  rSemGps: 'sem GPS',
  rcPrioridade: 'Prioridade',
  rcSentido: 'Sentido',
  rcTrecho: 'Trecho',
  rcIq: 'IQ',
  rcRegistros: 'Registros',
  rcEventos: 'Eventos',
  rcImpactos: 'Impactos',
  rcPontos: 'Pontos',
  rcMaior: 'Maior classe',
  rcPico: 'Pico |dom| (g)',
  rcRank: '#',
  rcHora: 'Hora',
  rcEixo: 'Eixo dominante',
  rcDom: '|dom| (g)',
  rcAx: 'AX din. (g)',
  rcAy: 'AY din. (g)',
  rcAz: 'AZ din. (g)',
  rcClasse: 'Classe',
  rcMapa: 'Mapa',

  // Axis names
  axAX: 'AX Longitudinal',
  axAY: 'AY Lateral',
  axAZ: 'AZ Vertical',
  axRes: 'Resultante',
});

// Info (i) button texts: short explanations derived from the engine rules (core/*.js).
export const INFO_LABEL = 'Explicar parâmetro';
export const INFO_CLOSE = 'Fechar explicação';

export const INFO = Object.freeze({
  kpiIQ: 'Índice de qualidade da via: IQ = 100 % × (1 − (0,25·Leve + 0,5·Moderado + 0,75·Severo + 1·Crítico) / N), onde N é o número de medições classificadas nos filtros atuais (as não classificadas ficam fora). Os pesos seguem a ordem das classes e valem também para limiares editados. Faixas: 95 % ou mais é Bom, de 85 a 95 % é Regular, abaixo de 85 % é Ruim (95 % exato conta como Bom; o valor exibido é arredondado a 1 casa, então 94,96 % aparece como 95,0 % mas é Regular). Com filtro de classe, o índice considera só as classes marcadas. Mostra "—" quando não há medições.',
  analise: 'Parâmetros que mudam o cálculo da análise: valor de repouso (offset), agrupamento e separação de impactos. Alterar offset, agrupamento ou separação desliga a comparação "Conforme planilha". Os limites de GPS não afetam essa comparação.',
  pOffset: 'Valor de repouso de cada eixo. Mediana usa a mediana da corrida inteira por eixo, nunca filtrada. Manual aceita valores em g, com vírgula ou ponto e com sinal; ao escolher Manual, os campos são preenchidos com a mediana atual.',
  pGap: 'Número de amostras abaixo de Leve toleradas dentro de um mesmo impacto. Com 0, só amostras consecutivas formam um impacto.',
  pSalto: 'Intervalo de tempo entre amostras que inicia um novo impacto. Também quebra as linhas dos gráficos.',
  pGpsVel: 'Um fix de GPS que implicaria velocidade acima deste valor desde o último fix aceito é descartado, e suas amostras ficam sem GPS. Isso muda pontos, mapa e ranking.',
  pGpsFix: 'A checagem de velocidade só vale quando o intervalo entre fixes é de até este valor. Fixes mais distantes no tempo são aceitos.',
  kpiRegistros: 'Número de amostras (linhas) do sensor que passam pelos filtros atuais. Sem filtros, é a corrida inteira.',
  kpiEventos: 'Amostra classificada como Leve ou pior. A classe vem do maior desvio entre os eixos AX, AY e AZ em relação ao valor de repouso (dinâmico), comparado com os limiares de severidade.',
  kpiImpactos: 'Agrupamento de eventos em sequência: amostras consecutivas com classe Leve ou pior formam um único impacto. Um intervalo maior que o configurado em Parâmetros de análise (padrão 2 s) entre amostras inicia um novo impacto. A classe do impacto é a maior classe do grupo.',
  kpiPontos: 'Um ponto por local (posição GPS); quando não há GPS, um por trecho. Cada ponto representa o evento mais forte do local; em empate vale o primeiro.',
  kpiTrecho: 'Trecho com o maior número de eventos dentro dos filtros atuais. Em empate, vale o trecho que vem primeiro no percurso.',
  badge: 'Indica se classes, eventos, impactos e a divisão por sentido calculados aqui são iguais aos da planilha de referência, com os limiares padrão. Se os limiares forem alterados, a comparação deixa de se aplicar.',
  classes: 'Quantidade e percentual de cada classe de severidade. A classe é o número de limiares menores ou iguais ao maior desvio dinâmico da amostra (limite inferior inclusivo). Os valores X, Y, Z mostram qual eixo dominou.',
  classesMedicoes: 'Cada amostra classificada conta uma vez. O percentual é sobre as amostras classificadas; amostras sem leitura válida ficam fora.',
  classesImpactos: 'Cada impacto conta uma vez, na sua classe máxima. O eixo mostrado é o do pico do impacto.',
  classesPontos: 'Cada ponto (local) conta uma vez, na classe do seu evento mais forte.',
  means: 'Média e maior valor absoluto de cada eixo, em g. Medido é o valor lido do sensor; dinâmico é o medido menos o valor de repouso do eixo. O maior valor mantém o sinal. A resultante é a raiz da soma dos quadrados dos três eixos.',
  axisStats: 'Média, mediana, desvio padrão (amostral, n-1) e percentis 0,5 e 99,5 por eixo, em g, conforme o modo de valores escolhido (medido ou dinâmico). Percentis usam interpolação linear como PERCENTILE.INC do Excel.',
  quality: 'Resumo da qualidade da corrida inteira; não é afetado pelos filtros.',
  qCobertura: 'Percentual de amostras que têm posição GPS (amostras com GPS dividido pelo total).',
  qSemPosicao: 'Quantidade de amostras sem posição GPS. Elas não entram na contagem de pontos por local.',
  qCanaisVazios: 'Canais auxiliares do sensor (velocidade, deslocamento, frequência, temperatura) em que todas as leituras são zero ou nulas.',
  qRetorno: 'Pausa longa entre amostras consecutivas, típica da virada do trem no terminal, com a duração e o terminal.',
  qInferidas: 'Estações que não constavam nos arquivos e foram deduzidas pela posição, com a menor distância (em metros) até a estação.',
  qNaoClassificadas: 'Amostras sem leitura válida nos eixos de aceleração; não recebem classe e ficam fora dos percentuais.',
  qIrrecuperaveis: 'Valores do arquivo de origem que não puderam ser lidos nem corrigidos na conversão.',
  qAmbiguos: 'Valores do arquivo de origem com mais de uma leitura possível na conversão.',
  qAvisos: 'Avisos gerados ao ler os arquivos de estações durante a conversão dos dados.',
  qCanais: 'Para cada canal auxiliar, o percentual de leituras iguais a zero ou nulas. Valores altos indicam canal sem sinal.',
  thresholds: 'Valores mínimos, em g, de cada classe. Uma amostra entra na classe quando o maior desvio dinâmico é maior ou igual ao limiar (limite inferior inclusivo). Os limiares devem ser crescentes.',
  fSentido: 'Mostra só as amostras do sentido de circulação marcado. A divisão vem da detecção pelas estações. Vazio significa todos.',
  fTrecho: 'Mostra só as amostras dos trechos marcados, agrupados por sentido e na ordem do percurso. Vazio significa todos.',
  fEixo: 'Mostra só as amostras cujo eixo de maior desvio dinâmico é o marcado. Amostras sem classificação saem quando este filtro é usado. Vazio significa todos.',
  fClasse: 'Mostra só as amostras da classe de severidade marcada. Amostras sem classificação saem quando este filtro é usado. Vazio significa todas.',
  fTempo: 'Limita as amostras ao intervalo entre os horários De e Até, em passos de 1 s, no horário de Brasília.',
  display: 'Opções de exibição. Valores muda as tabelas de estatísticas; métrica, raio e intensidade controlam o mapa de calor.',
  dValores: 'Medido é a leitura do sensor em g. Dinâmico é a leitura menos o valor de repouso (mediana de cada eixo na corrida).',
  dMetrica: 'Grandeza que pesa cada posição GPS no mapa de calor: eixo dominante, um eixo isolado ou a resultante dinâmica.',
  dRaio: 'Raio, em pixels, de cada ponto do mapa de calor.',
  dIntensidade: 'Multiplica o peso de cada posição antes da escala fixa, em que o limiar Crítico vale o máximo (cor mais forte).',
  charts: 'Aceleração em g nos eixos AX, AY e AZ ao longo da corrida, no modo escolhido em Exibição (medido ou dinâmico). Arraste sobre um gráfico para ampliar; clique duas vezes ou use o botão para voltar à corrida inteira. As linhas tracejadas são os limiares de severidade (±), nas cores das classes; no modo medido elas são deslocadas pelo valor de repouso do eixo. Cinza são as amostras fora dos filtros. Quebras na linha são intervalos sem dados (virada no terminal, amostras ausentes). Nenhuma amostra é escondida em qualquer ampliação.',
  maisCanais: 'Velocidade (mm/s), deslocamento (µm), frequência (Hz) e temperatura (°C) medidos pelo sensor, com o mesmo eixo de tempo e a mesma ampliação dos gráficos de aceleração. Canais com todas as leituras iguais a zero indicam ausência de sinal (veja Qualidade dos dados).',
  map: 'Mapa base OpenStreetMap. A linha segue o percurso GPS, colorida por sentido; trechos apagados estão fora do filtro e as quebras são intervalos sem GPS maiores que 120 s ou mudança de sentido. Os círculos são pontos de impacto, coloridos e dimensionados pela pior classe do ponto. Clicar num círculo ou na linha leva os gráficos àquele instante, com ampliação de ±30 s. A linha sob o mapa conta os pontos de impacto e eventos que não têm GPS e por isso não aparecem.',
  mapCalor: 'Mostra um ponto por posição GPS. O peso é o maior valor da métrica escolhida entre as amostras filtradas daquela posição. A escala é fixa: o limiar Crítico corresponde à cor máxima e não depende dos filtros. Densidade de amostras não é usada.',
  matrix: 'Linhas são os trechos na ordem do percurso, uma tabela por sentido; colunas são as classes. A cor da coluna é a cor da classe, com intensidade proporcional ao maior valor da coluna nas duas tabelas. A matriz segue os filtros de sentido, eixo e tempo e ignora os de trecho e classe, para continuar toda selecionável. Um toque na célula substitui o filtro de trecho e classe; tocar de novo na mesma célula limpa; com Ctrl ou Shift a célula é adicionada, e a seleção vale para todas as combinações de trechos e classes marcados. Células selecionadas ficam contornadas.',
  matrixBase: 'Define o que cada célula conta. Impactos: um por impacto, pela amostra de pico. Medições: cada amostra classificada, incluindo Normal. Pontos: um por local, na pior classe do local.',
  rankTrecho: 'Prioridade da corrida inteira, de Alta (1) a Monitorar (4), pela classe dos impactos do trecho; não muda com os filtros. Contagens e IQ seguem os filtros, exceto o de trecho, que só destaca linhas. "sem Crítico" indica que nenhuma medição do trecho chegou à classe mais alta na corrida inteira.',
  rankPontos: 'Os 50 pontos de maior |dom| entre os pontos filtrados, os mesmos do mapa. Clicar no cabeçalho reordena esses 50. Clicar numa linha leva os gráficos e o mapa ao ponto.',
  csv: 'Arquivo para Excel em português: separador ponto e vírgula, vírgula decimal e horário de Brasília. Exporta as linhas filtradas na ordem atual; em pontos, todos os pontos filtrados, não só os 50.',
  share: 'O endereço da página guarda limiares, parâmetros de análise, filtros, exibição, mapa de calor, base da matriz e ordenação do ranking. Não guarda a ampliação dos gráficos nem a posição do mapa. "Restaurar padrões" limpa o link.',
  resetZoom: 'Volta todos os gráficos para a corrida inteira. Os filtros não são alterados.',
});

export function topPontosTitle(n, total) {
  return `Top ${fmtInt(n)} de ${fmtInt(total)} pontos`;
}

export function pontosNote(engine, ref) {
  return `Pontos de impacto: ${fmtInt(engine)} aqui vs ${fmtInt(ref)} na planilha (chaves de GPS diferentes); comparação apenas informativa.`;
}

export function semGpsNote(pontos, eventos) {
  if (pontos === 0 && eventos === 0) return 'Todos os pontos de impacto têm posição GPS.';
  const p = pontos === 1 ? '1 ponto de impacto' : `${fmtInt(pontos)} pontos de impacto`;
  const e = eventos === 1 ? '1 evento' : `${fmtInt(eventos)} eventos`;
  return `${p} sem GPS (${e}) — não aparecem no mapa.`;
}

export function gpsRejectedNote(n, vmax) {
  const v = Number.isInteger(vmax) ? fmtInt(vmax) : String(vmax).replace('.', ',');
  const lead = n === 1 ? '1 fix de GPS descartado' : `${fmtInt(n)} fixes de GPS descartados`;
  return `${lead} por velocidade implícita acima de ${v} km/h.`;
}

export function nImpactosNote(n) {
  return n === 1 ? '1 impacto neste ponto' : `${fmtInt(n)} impactos neste ponto`;
}
