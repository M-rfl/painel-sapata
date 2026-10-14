// stations.json -> line definitions used by the geofence port.
export function prepareLines(stationsJson) {
  return stationsJson.lines.map((ln) => {
    const directions = ln.directions.map((d) => {
      const stations = d.stations;
      const codes = stations.map((s) => s.code);
      return {
        index: d.index,
        stations,
        codes,
        fromCode: codes[0],
        toCode: codes[codes.length - 1],
      };
    });
    const codes = new Set();
    const terminals = new Set();
    for (const d of directions) {
      for (const c of d.codes) codes.add(c);
      terminals.add(d.fromCode);
      terminals.add(d.toCode);
    }
    return {
      lineId: ln.line_id,
      name: ln.name,
      sourceFile: ln.source_file,
      directions,
      codes,
      terminals,
      siteStations: ln.site_stations,
      overlapWarnings: ln.overlap_warnings,
    };
  });
}
