// Pure module: no DOM/window; mirrors tools/dashboard_converter/analysis_ref.py.
export const CLASS_NAMES = ['Normal', 'Leve', 'Moderado', 'Severo', 'Crítico'];
export const PRIORITY_NAMES = [null, 'Alta', 'Média', 'Baixa', 'Monitorar']; // index = level
export const DEFAULT_PARAMS = Object.freeze({
  thresholds_g: Object.freeze([0.5, 1, 2, 4]),
  offset: Object.freeze({ mode: 'median' }),
  gap: 0,
  maxJumpMs: 2000,
});
export const DEFAULT_GPS = Object.freeze({ maxSpeedKmh: 50, maxFixGapS: 120 });
