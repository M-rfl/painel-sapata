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

export function pontosNote(engine, ref) {
  return `Pontos de impacto: ${fmtInt(engine)} aqui vs ${fmtInt(ref)} na planilha (chaves de GPS diferentes); comparação apenas informativa.`;
}
