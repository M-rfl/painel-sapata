// Pure module: no DOM. Tiny pub-sub between charts and map.
// hover(row): chart -> map position marker (deduped: 7 synced charts fire for the same move).
// select(row): map click -> chart cursor + ±30 s zoom. The two channels never feed each other.
export function createLink() {
  const hoverFns = new Set();
  const selectFns = new Set();
  let last; // undefined = nothing published yet
  const sub = (set) => (fn) => {
    set.add(fn);
    return () => set.delete(fn);
  };
  return {
    hover(row) {
      const r = row == null ? null : row;
      if (r === last) return;
      last = r;
      for (const fn of [...hoverFns]) fn(r);
    },
    select(row) {
      for (const fn of [...selectFns]) fn(row);
    },
    onHover: sub(hoverFns),
    onSelect: sub(selectFns),
  };
}
