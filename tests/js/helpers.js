import { readFileSync } from 'node:fs';
import { decodeRun } from '../../site/js/core/index.js';

export function repoUrl(rel) { return new URL('../../' + rel, import.meta.url); }
export function loadJson(rel) { return JSON.parse(readFileSync(repoUrl(rel), 'utf8')); }

let cached = null;
export function loadRun1() {
  if (!cached) cached = decodeRun(loadJson('site/data/run-2026-10-02-l4-t102.json'));
  return cached;
}
export function golden() { return loadJson('tests/fixtures/golden_run1.json'); }
export const arr = (typed) => Array.from(typed);

// FNV-1a 32-bit over class bytes (c & 0xFF, so -1 -> 0xFF); matches Python class_digest.
export function fnv1a(cls) {
  let h = 0x811c9dc5;
  for (let i = 0; i < cls.length; i++) h = Math.imul(h ^ (cls[i] & 0xff), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}
