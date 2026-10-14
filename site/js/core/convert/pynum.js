// Pure module: no DOM/window.
// Python-faithful numeric helpers (round(), statistics.median, float(Fraction), int(log10(n))).

const F64 = new DataView(new ArrayBuffer(8));

function bitLen(n) { return n === 0n ? 0 : n.toString(2).length; }

// BigInt num/den (den > 0) -> correctly rounded double (half-even), == Python float(Fraction(num, den)).
export function ratToFloat(num, den) {
  if (den < 0n) { num = -num; den = -den; }
  if (num === 0n) return 0;
  const neg = num < 0n;
  if (neg) num = -num;
  const e = bitLen(num) - bitLen(den);
  const s = 55 - e;
  let q;
  let sticky;
  if (s >= 0) {
    const a = num << BigInt(s);
    q = a / den; sticky = a % den !== 0n;
  } else {
    const b = den << BigInt(-s);
    q = num / b; sticky = num % b !== 0n;
  }
  const drop = Math.max(bitLen(q) - 53, s - 1074);
  let m = q;
  if (drop > 0) {
    const mask = (1n << BigInt(drop)) - 1n;
    const rem = q & mask;
    const half = 1n << BigInt(drop - 1);
    m = q >> BigInt(drop);
    if (rem > half || (rem === half && (sticky || (m & 1n) === 1n))) m += 1n;
  }
  const r = Number(m) * 2 ** (drop - s);
  return neg ? -r : r;
}

// Python round(x, nd) for floats: exact binary value, correctly rounded, ties to even.
export function pyRound(x, nd) {
  if (!Number.isFinite(x) || x === 0) return x;
  if (nd > 323) return x;
  if (nd < -308) return x < 0 ? -0 : 0;
  F64.setFloat64(0, x);
  const bits = F64.getBigUint64(0);
  const expBits = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & 0xfffffffffffffn;
  const m = expBits === 0 ? frac : frac | (1n << 52n);
  const e = (expBits === 0 ? 1 : expBits) - 1075;
  let num = m;
  let den = 1n;
  if (nd >= 0) num *= 10n ** BigInt(nd); else den *= 10n ** BigInt(-nd);
  if (e >= 0) num <<= BigInt(e); else den <<= BigInt(-e);
  let q = num / den;
  const r = num % den;
  const twice = 2n * r;
  if (twice > den || (twice === den && (q & 1n) === 1n)) q += 1n;
  const out = nd >= 0 ? ratToFloat(q, 10n ** BigInt(nd)) : ratToFloat(q * 10n ** BigInt(-nd), 1n);
  return x < 0 ? -out : out;
}

export function pyMedian(values) {
  const a = Array.from(values).sort((p, q) => p - q);
  const n = a.length;
  if (n === 0) throw new Error('no median of empty data');
  return n % 2 === 1 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}

// Smallest n (by digit count) for which CPython's float log10 rounds UP to the next integer, as observed on
// the platform that generated tests/fixtures/upload_parity.json (the fixture recover.log10k is the arbiter).
// V8's Math.log10 disagrees with that libm in the last ulp at the 19-digit boundary, so a table replaces it.
// Digit counts below 15 never round up (k = digits - 1).
const LOG10_ROUNDUP = {
  15: 999999999999998n,
  16: 9999999999999979n,
  17: 99999999999999593n,
  18: 999999999999995969n,
  19: 9999999999999960065n,
  20: 99999999999999598592n,
};

// Python int(math.log10(n)) for a positive BigInt: log10 of the DOUBLE nearest n rounds up just below a power
// of ten (999999999999999 -> 15), so this is NOT digits.length - 1.
export function pyIntLog10(n) {
  const d = n.toString().length;
  if (d > 20) return Math.trunc(Math.log10(Number(n)));
  const boundary = LOG10_ROUNDUP[d];
  return boundary !== undefined && n >= boundary ? d : d - 1;
}
