// Pure module: no DOM/window.
// pt-BR formatting, strict decimal parsing and threshold validation.

const TZ = 'America/Sao_Paulo';

const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decFmts = new Map();
function decFmt(d) {
  if (!decFmts.has(d)) {
    decFmts.set(d, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  }
  return decFmts.get(d);
}
const pctFmts = new Map();
function pctFmt(d) {
  if (!pctFmts.has(d)) {
    pctFmts.set(d, new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }));
  }
  return pctFmts.get(d);
}
const thrFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export const fmtInt = (v) => intFmt.format(v);
export const fmtDec = (v, d) => decFmt(d).format(v);
export const fmtG = (v, d = 4) => fmtDec(v, d);
export const fmtPct = (v, d = 1) => pctFmt(d).format(v);
export const fmtDate = (d) => dateFmt.format(d instanceof Date ? d : new Date(d));
export const fmtTime = (d) => timeFmt.format(d instanceof Date ? d : new Date(d));
export const fmtDateTime = (d) => fmtDate(d) + ' ' + fmtTime(d);
export const fmtThreshold = (v) => thrFmt.format(v);

function secs(s) {
  const r = Math.round(s * 10) / 10;
  return fmtDec(r, Number.isInteger(r) ? 0 : 1);
}

export function fmtDuration(seconds) {
  const s = Number(seconds);
  if (s < 60) return `${secs(s)} s`;
  if (s < 3600) {
    const min = Math.floor(s / 60);
    const rest = Math.round((s - min * 60) * 10) / 10;
    if (rest >= 60) return `${min + 1} min 0 s`;
    return `${min} min ${secs(rest)} s`;
  }
  const total = Math.floor(s / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

// Strict: digits with optional single ',' or '.' decimal part. No thousand separators.
export function parseDecimal(text) {
  const t = String(text).trim();
  if (!/^\d+([.,]\d+)?$/.test(t)) return NaN;
  return Number(t.replace(',', '.'));
}

export const MAX_THRESHOLD_G = 16;

export function validateThresholds(vals) {
  const n = vals.length;
  const fieldErrors = new Array(n).fill(false);
  const fail = (error) => ({ ok: false, error, fieldErrors });

  let bad = false;
  vals.forEach((v, i) => { if (!Number.isFinite(v)) { fieldErrors[i] = true; bad = true; } });
  if (bad) return fail('Informe números válidos (use vírgula ou ponto como separador decimal).');

  if (vals[0] <= 0) {
    fieldErrors[0] = true;
    return fail('O primeiro limiar deve ser maior que zero.');
  }
  vals.forEach((v, i) => { if (v > MAX_THRESHOLD_G) { fieldErrors[i] = true; bad = true; } });
  if (bad) return fail('Os limiares devem ser no máximo 16 g (faixa do sensor).');

  for (let i = 1; i < n; i++) {
    if (vals[i] <= vals[i - 1]) { fieldErrors[i] = true; bad = true; }
  }
  if (bad) return fail('Os limiares devem ser crescentes.');

  return { ok: true, error: null, fieldErrors };
}

// Signed variant for manual offsets (g may be negative): optional +/- then digits with optional ',' or '.'.
export function parseSignedDecimal(text) {
  const t = String(text).trim();
  if (!/^[+-]?\d+([.,]\d+)?$/.test(t)) return NaN;
  return Number(t.replace(',', '.'));
}
