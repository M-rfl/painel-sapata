// Pure module: no DOM/window.
// Port of CPython 3.13 datetime.fromisoformat (the C implementation, _datetimemodule.c) to integer epoch
// microseconds + datetime.isoformat() text, plus the logger_csv rule that naive timestamps are rejected.
// No Date.parse / Date.UTC: both normalise or remap values Python rejects.
import { ConvertError } from './errors.js';

const NUL = '\0';

function isDigit(c) { return c >= '0' && c <= '9'; }

// Bounded reads on the whole buffer: out of range reads the C string terminator.
function at(s, i) { return i < s.length ? s[i] : NUL; }

function bad() { return new ConvertError('bad_timestamp'); }

// parse_digits: exactly n ASCII digits at pos -> { v, p } or null (n = 0 succeeds with 0).
function parseDigits(s, pos, n) {
  let v = 0;
  for (let i = 0; i < n; i++) {
    const c = at(s, pos + i);
    if (!isDigit(c)) return null;
    v = v * 10 + (c.charCodeAt(0) - 48);
  }
  return { v, p: pos + n };
}

function isLeap(y) { return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0); }
function daysInMonth(y, m) { return m === 2 ? (isLeap(y) ? 29 : 28) : [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }

// Howard Hinnant: days since 1970-01-01 of a proleptic Gregorian date.
function daysFromCivil(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z) {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
}

const ORD_OFFSET = 719163; // proleptic Gregorian ordinal of 1970-01-01 (0001-01-01 is ordinal 1)

function isoweekToGregorian(year, week, day) {
  if (year < 1 || year > 9999) throw bad();
  if (!(week > 0 && week < 53)) {
    let outOfRange = true;
    if (week === 53) {
      const first = (daysFromCivil(year, 1, 1) + ORD_OFFSET) % 7;
      if (first === 4 || (first === 3 && isLeap(year))) outOfRange = false;
    }
    if (outOfRange) throw bad();
  }
  if (!(day > 0 && day < 8)) throw bad();
  const firstday = daysFromCivil(year, 1, 1) + ORD_OFFSET;
  const firstweekday = (firstday + 6) % 7;
  let week1monday = firstday - firstweekday;
  if (firstweekday > 3) week1monday += 7;
  return civilFromDays(week1monday + (week - 1) * 7 + (day - 1) - ORD_OFFSET);
}

// _find_isoformat_datetime_separator
function findSeparator(s) {
  const len = s.length;
  if (len === 7) return 7;
  if (s[4] === '-') {
    if (s[5] === 'W') {
      if (len > 8 && s[8] === '-') {
        if (len === 9) throw bad();
        if (len > 10 && isDigit(s[10])) return 8;
        return 10;
      }
      return 8;
    }
    return 10;
  }
  if (s[4] === 'W') {
    let idx = 7;
    while (idx < len) {
      if (!isDigit(s[idx])) break;
      idx++;
    }
    if (idx < 9) return idx;
    return idx % 2 === 0 ? 7 : 8;
  }
  return 8;
}

// parse_isoformat_date over s[0:len] -> [y, m, d] (calendar-validated later, except week dates)
function parseDate(s, len) {
  if (len !== 7 && len !== 8 && len !== 10) throw bad();
  let r = parseDigits(s, 0, 4);
  if (!r) throw bad();
  const year = r.v;
  let p = r.p;
  const sep = at(s, p) === '-';
  if (sep) p++;
  if (at(s, p) === 'W') {
    p++;
    r = parseDigits(s, p, 2);
    if (!r) throw bad();
    const week = r.v;
    p = r.p;
    let day = 1;
    if (p < len) {
      if ((at(s, p) === '-') !== sep) throw bad();
      if (sep) p++;
      r = parseDigits(s, p, 1);
      if (!r) throw bad();
      day = r.v;
    }
    return isoweekToGregorian(year, week, day);
  }
  r = parseDigits(s, p, 2);
  if (!r) throw bad();
  const month = r.v;
  p = r.p;
  if ((at(s, p) === '-') !== sep) throw bad();
  if (sep) p++;
  r = parseDigits(s, p, 2);
  if (!r) throw bad();
  return [year, month, r.v];
}

const CORRECTION = [100000, 10000, 1000, 100, 10];

// parse_hh_mm_ss_ff(s, start, end) -> { h, mi, sec, us, rest } ; rest = 1 when text remains (C return value 1)
function parseHhMmSsFf(s, start, end) {
  const vals = [0, 0, 0];
  let p = start;
  let hasSep = true;
  for (let i = 0; i < 3; i++) {
    const r = parseDigits(s, p, 2);
    if (!r) throw bad();
    vals[i] = r.v;
    p = r.p;
    const c = at(s, p);
    p++;
    if (i === 0) hasSep = c === ':';
    if (p >= end) return { h: vals[0], mi: vals[1], sec: vals[2], us: 0, rest: c !== NUL ? 1 : 0 };
    if (hasSep && c === ':') continue;
    if (c === '.' || c === ',') break;
    if (!hasSep) p--;
    else throw bad();
  }
  const lenRemains = end - p;
  const toParse = lenRemains >= 6 ? 6 : lenRemains;
  const f = parseDigits(s, p, toParse);
  if (!f) throw bad();
  let us = f.v;
  if (toParse < 6 && toParse > 0) us *= CORRECTION[toParse - 1];
  p = f.p;
  while (isDigit(at(s, p))) p++;
  return { h: vals[0], mi: vals[1], sec: vals[2], us, rest: at(s, p) !== NUL ? 1 : 0 };
}

// parse_isoformat_time -> { h, mi, sec, us, tz: null | { offUs } }
function parseTime(s) {
  const len = s.length;
  let tzPos = 0;
  do {
    const c = s[tzPos];
    if (c === 'Z' || c === '+' || c === '-') break;
    tzPos++;
  } while (tzPos < len);
  const t = parseHhMmSsFf(s, 0, tzPos);
  if (tzPos >= len) {
    if (t.rest === 1) throw bad();
    return { ...t, tz: null };
  }
  if (s[tzPos] === 'Z') {
    if (at(s, tzPos + 1) !== NUL) throw bad();
    return { ...t, tz: { offUs: 0 } };
  }
  const sign = s[tzPos] === '-' ? -1 : 1;
  const z = parseHhMmSsFf(s, tzPos + 1, len);
  if (z.rest) throw bad();
  const offSecs = z.h * 3600 + z.mi * 60 + z.sec;
  // C: a zero whole-second offset is UTC whatever the tz microseconds say
  const offUs = offSecs === 0 ? 0 : sign * (offSecs * 1e6 + z.us);
  return { ...t, tz: { offUs } };
}

const p2 = (n) => String(n).padStart(2, '0');

function formatOffset(offUs) {
  if (offUs === 0) return '+00:00';
  const sign = offUs < 0 ? '-' : '+';
  let a = Math.abs(offUs);
  const hh = Math.floor(a / 3600e6); a -= hh * 3600e6;
  const mm = Math.floor(a / 60e6); a -= mm * 60e6;
  const ss = Math.floor(a / 1e6);
  const us = a - ss * 1e6;
  let out = `${sign}${p2(hh)}:${p2(mm)}`;
  if (ss || us) {
    out += `:${p2(ss)}`;
    if (us) out += `.${String(us).padStart(6, '0')}`;
  }
  return out;
}

// -> { us, iso, date, dmy } ; throws ConvertError('bad_timestamp' | 'naive_timestamp')
export function parseTimestamp(text) {
  if (typeof text !== 'string' || text.length < 7) throw bad();
  const sepAt = findSeparator(text);
  const [year, month, day] = parseDate(text, sepAt);
  let time = { h: 0, mi: 0, sec: 0, us: 0, tz: null };
  const tstr = text.slice(sepAt + 1);
  if (text.length > sepAt) time = parseTime(tstr); // a separator with nothing after it is an error in C
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw bad();
  if (time.h > 23 || time.mi > 59 || time.sec > 59 || time.us > 999999) throw bad();
  if (time.tz === null) throw new ConvertError('naive_timestamp');
  const off = time.tz.offUs;
  if (!(Math.abs(off) < 86400e6)) throw bad();

  const days = daysFromCivil(year, month, day);
  const secs = days * 86400 + time.h * 3600 + time.mi * 60 + time.sec;
  let us;
  if (Math.abs(secs) < 8e9) us = secs * 1e6 + time.us - off;
  else us = Number(BigInt(secs) * 1000000n + BigInt(time.us) - BigInt(off));
  const date = `${String(year).padStart(4, '0')}-${p2(month)}-${p2(day)}`;
  const frac = time.us ? `.${String(time.us).padStart(6, '0')}` : '';
  return {
    us,
    iso: `${date}T${p2(time.h)}:${p2(time.mi)}:${p2(time.sec)}${frac}${formatOffset(off)}`,
    date,
    dmy: `${p2(day)}/${p2(month)}/${String(year).padStart(4, '0')}`,
  };
}
