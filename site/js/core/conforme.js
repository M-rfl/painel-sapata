// Pure module: no DOM/window. "Conforme planilha" check against meta.workbook_reference.
import { DEFAULT_PARAMS } from './defaults.js';

const nf = new Intl.NumberFormat('pt-BR');
const fmt = (v) => (Array.isArray(v) ? v.map((x) => nf.format(x)).join('/') : nf.format(v));
const same = (a, b) => (Array.isArray(a)
  ? Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i])
  : a === b);

/** Compare a full-run result with the workbook reference. Returns { available, ok, reasons }. */
export function conformeCheck(result, params, reference) {
  if (reference == null) return { available: false, ok: null, reasons: [] };
  const reasons = [];
  if (!same(Array.from(params.thresholds_g), Array.from(reference.thresholds_g))) reasons.push('limiares alterados');
  if (params.offset?.mode !== 'median') reasons.push('offset manual');
  if (params.gap !== DEFAULT_PARAMS.gap) reasons.push('agrupamento alterado');
  if (params.maxJumpMs !== DEFAULT_PARAMS.maxJumpMs) reasons.push('salto de tempo alterado');

  const kpi = (label, actual, expected) => {
    if (!same(actual, expected)) reasons.push(`${label} ${fmt(actual)} ≠ ${fmt(expected)}`);
  };
  if (reference.class_counts) kpi('classes', result.classCounts, reference.class_counts);
  if (reference.eventos != null) kpi('eventos', result.eventos, reference.eventos);
  if (reference.impactos != null) kpi('impactos', result.impactos, reference.impactos);
  if (reference.impacts_by_class) kpi('impactos por classe', result.impactsByClass, reference.impacts_by_class);
  const hasSplit = reference.sentido_records || reference.sentido_eventos;
  if (hasSplit && !result.regionSplit) {
    reasons.push('divisão por arquivo indisponível');
  } else if (hasSplit) {
    if (reference.sentido_records) kpi('registros por sentido', result.regionSplit.records, reference.sentido_records);
    if (reference.sentido_eventos) kpi('eventos por sentido', result.regionSplit.eventos, reference.sentido_eventos);
  }
  return { available: true, ok: reasons.length === 0, reasons };
}
