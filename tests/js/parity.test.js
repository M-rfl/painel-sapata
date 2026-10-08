import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, fromArrays } from '../../site/js/core/index.js';
import { loadJson, loadRun1, fnv1a, arr } from './helpers.js';

const fixture = loadJson('tests/fixtures/parity_cases.json');
const RUN1 = 'site/data/run-2026-10-02-l4-t102.json';

function runFor(c) {
  if (c.source === 'synthetic') {
    const i = c.input;
    return fromArrays({
      ax: i.ax, ay: i.ay, az: i.az, tMs: i.t_ms, locKey: i.loc,
      trecho: i.trecho, trechoNames: i.trechos, source: i.source,
    });
  }
  assert.equal(c.source, RUN1, `${c.name}: unexpected source path`);
  return loadRun1();
}

test('fixture lists the run-1 input hash', () => {
  assert.equal(typeof fixture.inputs_sha256[RUN1], 'string');
  assert.ok(fixture.cases.length >= 16);
});

for (const c of fixture.cases) {
  test(`parity ${c.name}`, () => {
    const r = analyze(runFor(c), c.params);
    const ex = c.expected;
    const eq = (field, actual, expected) =>
      assert.deepStrictEqual(actual, expected, `${c.name}: field ${field}`);
    eq('medians_lsb', arr(r.mediansLsb), ex.medians_lsb);
    eq('offsets2', arr(r.off2), ex.offsets2);
    eq('class_counts', r.classCounts, ex.class_counts);
    eq('eventos', r.eventos, ex.eventos);
    eq('impactos', r.impactos, ex.impactos);
    eq('impact_starts', r.impacts.map((s) => s.start), ex.impact_starts);
    eq('impact_peaks', r.impacts.map((s) => s.peak), ex.impact_peaks);
    eq('impacts_by_class', r.impactsByClass, ex.impacts_by_class);
    eq('pontos', r.pontos, ex.pontos);
    eq('point_rows', arr(r.pointRows), ex.point_rows);
    eq('points_by_class', r.pointsByClass, ex.points_by_class);
    eq('unclassified', r.naoClassificadas, ex.unclassified);
    eq('class_digest', fnv1a(r.cls), ex.class_digest);
    eq('per_trecho', r.perTrecho.map((p) => [p.records, p.eventos, p.impactos, p.pontos]), ex.per_trecho);
    eq('priority', r.priority.map((p) => [p.name, p.level, p.topCount, p.peakDom2]), ex.priority);
    eq('region_records', r.regionSplit ? r.regionSplit.records : null, ex.region_records);
    eq('region_eventos', r.regionSplit ? r.regionSplit.eventos : null, ex.region_eventos);
  });
}
