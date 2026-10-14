// Pure module: no DOM/window.
// Port of tools/dashboard_converter/recover.py: per-cell recovery of values mangled by a pt-BR Excel re-save.
// Exact arithmetic only (BigInt rationals); nothing is ever guessed.
import { parseDecimal, formatDecimal, cmpDecimal } from './decimal.js';
import { pyMedian, pyIntLog10, ratToFloat } from './pynum.js';

const ACCEL_PER_G = 2048n;
const ACCEL_MAX_G = 16n;
const GRID_TOL = 1e-6;

const THOU = /^-?[1-9]\d{0,2}(\.\d{3})+$/;
const GPS_THOU = /^-?\d{1,3}(\.\d{3})+$/;
const DEC_COMMA = /^-?\d+,\d+$/;
const FRACTION_RE = /^([+-]?)(?:(\d+)\/(\d+)|(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?)$/;
const FLOAT_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

const LAT_ENVELOPE = ['-22.92', '-22.88'];
const LON_ENVELOPE = ['-43.22', '-43.16'];

export const SCALED_RANGES = {
  temp: [-40.0, 85.0],
  vel: [0.0, 655.35],
  disp: [0.0, 65535.0],
  freq: [0.0, 6553.5],
};

// Python str.strip() whitespace (differs from JS trim at \x1c-\x1f, \x85, U+FEFF).
const PY_WS = '\t\n\v\f\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000';
const STRIP_RE = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, 'g');
export function pyStrip(text) { return text.replace(STRIP_RE, ''); }

export function isThousandsShaped(text) { return THOU.test(pyStrip(text)); }

const abs = (x) => (x < 0n ? -x : x);
const pow10 = (k) => 10n ** BigInt(k);

// Python round() of an exact rational (nearest integer, ties to even).
function roundRat(num, den) {
  let q = num / den; // truncates toward zero
  let r = num % den;
  if (r < 0n) { q -= 1n; r += den; } // floor
  const twice = 2n * r;
  if (twice > den || (twice === den && (q & 1n) === 1n)) q += 1n;
  return q;
}

// x = v * 2048 for v = num/den -> { lsb, onGrid }  (Python: abs(float(x - round(x))) <= GRID_TOL)
function gridOf(num, den) {
  const xn = num * ACCEL_PER_G;
  const lsb = roundRat(xn, den);
  const diff = abs(xn - lsb * den);
  return { lsb, onGrid: !(ratToFloat(diff, den) > GRID_TOL) };
}

function thousandsDigits(text) {
  return { n: BigInt(text.replace('-', '').replace(/\./g, '')), sign: text.startsWith('-') ? -1n : 1n };
}

// Python Fraction(text) -> { num, den } or null (ValueError / ZeroDivisionError).
function parseFraction(text) {
  const m = FRACTION_RE.exec(text);
  if (!m) return null;
  const sign = m[1] === '-' ? -1n : 1n;
  if (m[2] !== undefined) {
    const den = BigInt(m[3]);
    if (den === 0n) return null;
    return { num: sign * BigInt(m[2]), den };
  }
  const ip = m[4] || '';
  const fp = m[5] || '';
  if (ip === '' && fp === '') return null; // needs a digit
  let num = BigInt(ip + fp || '0');
  let den = pow10(fp.length);
  const exp = m[6] === undefined ? 0 : Number(m[6]);
  if (exp >= 0) num *= pow10(exp); else den *= pow10(-exp);
  return { num: sign * num, den };
}

export function recoverAccel(text, ptbr = true) {
  text = pyStrip(text);
  if (text === '') return { lsb: null, reason: 'empty' };
  if (ptbr && DEC_COMMA.test(text)) text = text.replace(',', '.');
  let rule = 'plain';
  let num;
  let den;
  if (ptbr && THOU.test(text)) {
    const { n, sign } = thousandsDigits(text);
    if (n <= ACCEL_MAX_G) { num = sign * n; den = 1n; rule = 'k'; } else {
      if (!Number.isFinite(Number(n))) return { lsb: null, reason: 'unrecoverable' };
      const k = pyIntLog10(n);
      const yn = sign * n;
      const yd = pow10(k);
      if (abs(yn) <= ACCEL_MAX_G * yd && gridOf(yn, yd).onGrid) { num = yn; den = yd; rule = 'k'; } else {
        num = sign * n; den = pow10(k - 1); rule = 'k-1';
      }
    }
  } else {
    const f = parseFraction(text);
    if (!f) return { lsb: null, reason: 'unrecoverable' };
    num = f.num; den = f.den;
  }
  const { lsb, onGrid } = gridOf(num, den);
  if (!onGrid) return { lsb: null, reason: 'off_grid' };
  if (abs(num) > ACCEL_MAX_G * den) return { lsb: null, reason: 'out_of_range' };
  return { lsb: Number(lsb), reason: rule };
}

export function alternativeAccelReading(text) {
  text = pyStrip(text);
  if (!THOU.test(text)) return null;
  const chosen = recoverAccel(text, true).lsb;
  const { n, sign } = thousandsDigits(text);
  if (!Number.isFinite(Number(n))) return null;
  const k = pyIntLog10(n);
  for (const kk of [k, k - 1, k - 2]) {
    if (kk < 0) continue;
    const num = sign * n;
    const den = pow10(kk);
    if (abs(num) > ACCEL_MAX_G * den) continue;
    const g = gridOf(num, den);
    if (!g.onGrid) continue;
    const lsb = Number(g.lsb);
    if (lsb !== chosen) return lsb;
  }
  return null;
}

export function recoverGps(text, axis, ptbr = true) {
  text = pyStrip(text);
  if (text === '') return { value: null, reason: 'empty' };
  let dec;
  let reason;
  if (ptbr && GPS_THOU.test(text)) {
    const digits = text.replace('-', '').replace(/\./g, '');
    dec = parseDecimal(digits);
    dec = { neg: text.startsWith('-'), digits: dec.digits, scale: digits.length - 2 };
    reason = 'recovered';
  } else {
    dec = parseDecimal(text);
    reason = 'plain';
  }
  if (!dec) return { value: null, reason: 'unrecoverable' };
  const value = formatDecimal(dec);
  const [lo, hi] = axis === 'lat' ? LAT_ENVELOPE : LON_ENVELOPE;
  if (!(cmpDecimal(value, lo) >= 0 && cmpDecimal(value, hi) <= 0)) return { value: null, reason: 'out_of_envelope' };
  return { value, reason };
}

export function scaledCandidates(text) {
  text = pyStrip(text);
  const neg = text.startsWith('-');
  const digits = text.replace('-', '').replace(/\./g, '').replace(/0+$/, '') || '0';
  const out = [];
  for (const ints of [1, 2, 3]) {
    let v = Number(`${digits}e${ints - digits.length}`);
    if (neg) v = -v;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export function resolveScaled(text, kind, neighbours, columnMedian = null) {
  const [lo, hi] = SCALED_RANGES[kind];
  const cands = scaledCandidates(text).filter((c) => lo <= c && c <= hi);
  if (cands.length === 0) return { value: null, reason: 'out_of_range' };
  let ref;
  let reason;
  if (neighbours.length > 0) { ref = pyMedian(neighbours); reason = 'neighbour'; } else if (columnMedian !== null && columnMedian !== undefined) {
    ref = columnMedian; reason = 'column_median';
  } else return { value: null, reason: 'no_neighbours' };
  let best = cands[0];
  let bestD = Math.abs(best - ref);
  for (let i = 1; i < cands.length; i++) {
    const d = Math.abs(cands[i] - ref);
    if (d < bestD) { best = cands[i]; bestD = d; }
  }
  return { value: best, reason };
}

// Python float(text) after the optional decimal-comma replace; '' -> null; invalid -> plain Error.
export function parsePlain(text, ptbr = false) {
  text = pyStrip(text);
  if (text === '') return null;
  if (ptbr && DEC_COMMA.test(text)) text = text.replace(',', '.');
  if (!FLOAT_RE.test(text)) throw new Error('invalid');
  return Number(text);
}
