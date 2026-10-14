// Pure module: no DOM/window.
// Exact decimal numbers kept as text (Python format(Decimal, 'f') form); no floats anywhere.

const DEC_RE = /^([+-]?)(\d+\.?\d*|\.\d+)(?:[eE]([+-]?\d+))?$/;

// Python Decimal(text) syntax (finite values only) -> { neg, digits, scale } with
// value = (neg ? -1 : 1) * BigInt(digits) * 10^-scale ; null for anything else (incl. nan/inf).
export function parseDecimal(text) {
  const m = DEC_RE.exec(text);
  if (!m) return null;
  const mant = m[2];
  const dot = mant.indexOf('.');
  const intPart = dot < 0 ? mant : mant.slice(0, dot);
  const frac = dot < 0 ? '' : mant.slice(dot + 1);
  const exp = m[3] === undefined ? 0 : Number(m[3]);
  const digits = (intPart + frac).replace(/^0+(?=\d)/, '');
  return { neg: m[1] === '-', digits, scale: frac.length - exp };
}

// Python format(Decimal, 'f') of a parsed decimal.
export function formatDecimal(d) {
  const exp = -d.scale;
  let body;
  if (exp >= 0) body = d.digits + '0'.repeat(exp);
  else {
    const left = d.digits.length + exp;
    if (left <= 0) body = '0.' + '0'.repeat(-left) + d.digits;
    else body = d.digits.slice(0, left) + '.' + d.digits.slice(left);
  }
  return (d.neg ? '-' : '') + body;
}

function scaledInt(d, scale) {
  const v = BigInt(d.digits) * 10n ** BigInt(scale - d.scale);
  return d.neg ? -v : v;
}

export function cmpDecimal(a, b) {
  const x = parseDecimal(a);
  const y = parseDecimal(b);
  if (!x || !y) throw new Error('invalid decimal');
  const s = Math.max(x.scale, y.scale);
  const u = scaledInt(x, s);
  const v = scaledInt(y, s);
  return u < v ? -1 : u > v ? 1 : 0;
}

// Python key6(Decimal(text)): quantize to 6 decimals, ROUND_HALF_UP (away from zero), format 'f'.
export function roundHalfUp6(text) {
  const d = parseDecimal(text);
  if (!d) throw new Error('invalid decimal');
  let n = BigInt(d.digits);
  if (d.scale <= 6) n *= 10n ** BigInt(6 - d.scale);
  else {
    const div = 10n ** BigInt(d.scale - 6);
    const q = n / div;
    n = 2n * (n % div) >= div ? q + 1n : q;
  }
  const s = n.toString().padStart(7, '0');
  return (d.neg ? '-' : '') + s.slice(0, -6) + '.' + s.slice(-6);
}
