// DOM-free upload helpers: file selection, caps, decoding, messages.
import { ConvertError, ERROR_CODES, MAX_FILES, MAX_FILE_BYTES } from '../core/convert/index.js';
import { T } from './i18n.js';
import { fmtInt, fmtDec } from './format.js';

// Mirrors Python read_run's glob("*.csv"); case-insensitive.
export function isCsvName(name) {
  return /\.csv$/i.test(String(name));
}

export function selectCsv(files) {
  const csv = [];
  const ignored = [];
  for (const f of files) {
    if (isCsvName(f.name)) csv.push(f);
    else ignored.push(f.name);
  }
  if (files.length === 0) throw new ConvertError('no_files');
  if (csv.length === 0) throw new ConvertError('no_csv', { ignored });
  return { csv, ignored };
}

async function sha256Hex(buf) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return '';
  try {
    const d = new Uint8Array(await subtle.digest('SHA-256', buf));
    return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_) {
    return '';
  }
}

export async function readSelected(fileList, { maxFiles = MAX_FILES, maxFileBytes = MAX_FILE_BYTES } = {}) {
  const { csv, ignored } = selectCsv([...fileList]);
  if (csv.length > maxFiles) throw new ConvertError('too_many_files', { max: maxFiles });
  for (const f of csv) {
    if (f.size > maxFileBytes) {
      throw new ConvertError('too_large', {
        file: f.name,
        mb: Math.round((f.size / 1048576) * 10) / 10,
        max: maxFileBytes / 1048576,
      });
    }
  }
  const files = [];
  for (const f of csv) {
    let buf;
    try {
      buf = await f.arrayBuffer();
    } catch (_) {
      throw new ConvertError('read_failed', { file: f.name });
    }
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch (_) {
      throw new ConvertError('bad_encoding', { file: f.name });
    }
    files.push({ name: f.name, text, sha256: await sha256Hex(buf) });
  }
  return { files, ignored };
}

function fill(template, detail) {
  const d = detail || {};
  const vals = {
    file: d.file,
    line: d.line == null ? undefined : fmtInt(d.line),
    column: d.column,
    text: d.text,
    channel: d.channel,
    index: d.index == null ? undefined : fmtInt(d.index),
    mb: d.mb == null ? undefined : fmtDec(d.mb, 1),
    max: d.max == null ? undefined : fmtInt(d.max),
  };
  return template.replace(/\{(\w+)\}/g, (m, k) => (vals[k] === undefined ? '' : String(vals[k])));
}

// Message for the failure notice (without the "Não foi possível…"/"mantida" wrapper).
function reason(err) {
  const code = err && err.code;
  if ((err instanceof ConvertError || ERROR_CODES.includes(code)) && T.uploadErrors[code]) {
    return fill(T.uploadErrors[code], err.detail);
  }
  return T.uploadErrGeneric;
}

export function errorMessage(err) {
  return reason(err);
}

export function failureNotice(err) {
  return `${T.uploadFailed} ${errorMessage(err)} ${T.uploadKept}`;
}

export function loadedMessage(summary, ignored = []) {
  const n = summary.unrecovered || 0;
  const parts = [
    `${T.uploadLoaded}: ${fmtInt(summary.rows)} linhas, ${summary.lineName}; ${fmtInt(n)} ${n === 1 ? 'valor não recuperado' : 'valores não recuperados'}.`,
  ];
  if (summary.ambiguous) parts.push(T.uploadWarnAmbiguous);
  if (summary.lineHits === 1) parts.push(T.uploadWarnFewStations);
  if (ignored.length) parts.push(`${T.uploadIgnored}: ${ignored.join(', ')}.`);
  return parts.join(' ');
}

export function bannerText(summary) {
  return T.uploadBanner
    .replace('{files}', summary.files.join(', '))
    .replace('{rows}', fmtInt(summary.rows));
}
