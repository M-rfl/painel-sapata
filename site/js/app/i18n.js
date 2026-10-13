// Pure module: no DOM/window.
// Portuguese UI string table. Class names come from core/defaults.js (CLASS_NAMES).
import { fmtInt } from './format.js';

export const T = Object.freeze({
  pageTitle: 'Monitoramento de Sapata Coletora — Painel da Corrida',
  loading: 'Carregando dados…',
  loadError: 'Não foi possível carregar os dados da corrida.',

  // KPI labels
  kpiRegistros: 'registros',
  kpiEventos: 'eventos',
  kpiImpactos: 'impactos',
  kpiPontos: 'pontos de impacto',
  kpiTrecho: 'trecho com mais eventos',

  // Sections
  secOverview: 'Visão geral',
  secClasses: 'Classes de severidade',
  secMeans: 'Médias e máximos',
  secAxisStats: 'Estatísticas por eixo',
  secQuality: 'Qualidade dos dados',
  secThresholds: 'Limiares de severidade',
  secFilters: 'Filtros',
  secDisplay: 'Exibição',

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
  dNota: 'Usado pelo mapa (próxima etapa).',

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
  kpiRegistros: 'Número de amostras (linhas) do sensor que passam pelos filtros atuais. Sem filtros, é a corrida inteira.',
  kpiEventos: 'Amostra classificada como Leve ou pior. A classe vem do maior desvio entre os eixos AX, AY e AZ em relação ao valor de repouso (dinâmico), comparado com os limiares de severidade.',
  kpiImpactos: 'Agrupamento de eventos em sequência: amostras consecutivas com classe Leve ou pior formam um único impacto. Um intervalo maior que 2 s entre amostras inicia um novo impacto. A classe do impacto é a maior classe do grupo.',
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
  display: 'Opções de exibição. Valores muda as tabelas de estatísticas; as demais opções serão usadas pelo mapa de calor na próxima etapa.',
  dValores: 'Medido é a leitura do sensor em g. Dinâmico é a leitura menos o valor de repouso (mediana de cada eixo na corrida).',
  dMetrica: 'Grandeza que o mapa de calor usará: eixo dominante, um eixo isolado ou a resultante dinâmica. Ainda sem efeito nesta etapa.',
  dRaio: 'Raio dos pontos do mapa de calor. Ainda sem efeito nesta etapa.',
  dIntensidade: 'Intensidade do mapa de calor. Ainda sem efeito nesta etapa.',
});

export function pontosNote(engine, ref) {
  return `Pontos de impacto: ${fmtInt(engine)} aqui vs ${fmtInt(ref)} na planilha (chaves de GPS diferentes); comparação apenas informativa.`;
}
