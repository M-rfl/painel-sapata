// Shared parity contract for convert_parity.test.js and convert_run1.test.js (helper module, not a test file).
// Keys that legitimately differ between any JS upload and a Python conversion run with DEFAULT CLI args.
export const UPLOAD_ONLY_META = ['generated_at', 'converter_version', 'title', 'uploaded'];
// The committed run-1 JSON was built with --run-id/--title/--golden; those args only change these meta keys.
export const RUN1_IGNORED_META = ['run_id', 'title', 'workbook_reference', 'uploaded', 'generated_at', 'converter_version'];

export function stripMeta(json, keys) {
  const c = JSON.parse(JSON.stringify(json));
  for (const k of keys) delete c.meta[k];
  return c;
}

// First differing JSON path between a and b, or null.
export function firstDiff(a, b, path = '$') {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    return `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array vs object`;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return `${path}: length ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.join() !== kb.join()) return `${path}: keys ${ka.join()} vs ${kb.join()}`;
  for (const k of ka) {
    const d = firstDiff(a[k], b[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}
