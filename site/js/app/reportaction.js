// Report click controller: pure orchestration with injected dependencies; no DOM.
const defaultYield = () => new Promise((r) => setTimeout(r, 0));

export function createReportAction({
  getSnapshot, loadLib, buildReport, renderMap, renderPdf, download, now, onState, yieldFn = defaultYield,
}) {
  let busy = false;
  const emit = (s) => { if (onState) onState(s); };

  async function run() {
    if (busy) return { status: 'skipped', warnings: [] };
    const snap = getSnapshot();
    if (!snap) return { status: 'skipped', warnings: [] };
    busy = true;
    emit('busy');
    try {
      await yieldFn();
      const { jsPDF, autoTable } = await loadLib();
      const model = buildReport(snap, { now: now() });
      const warnings = [];
      let mapImage = null;
      try {
        mapImage = await renderMap(model.map.input);
        if (mapImage && mapImage.basemapFailed) warnings.push('basemap');
      } catch (_) {
        mapImage = null;
        warnings.push('map');
      }
      const out = renderPdf(model, { jsPDF, autoTable, mapImage });
      const blob = new Blob([out.bytes], { type: 'application/pdf' });
      download(blob, model.filename);
      return { status: warnings.length ? 'warning' : 'ok', warnings, filename: model.filename };
    } catch (error) {
      return { status: 'error', warnings: [], error };
    } finally {
      busy = false;
      emit('idle');
    }
  }

  return { run, busy: () => busy };
}
