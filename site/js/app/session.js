// Pure module: no DOM/window.
// Swap controller: mounts a Run, replaces it atomically on a successful load, restores the example.
// A generation token is the only race protection: stale results are dropped, never cancelled.

export function isShareable(run) {
  return !(run && run.meta && run.meta.uploaded);
}

export function createDisposers() {
  let list = [];
  return {
    add(fn) { list.push(fn); return fn; },
    run() {
      const todo = list;
      list = [];
      let reported = false;
      for (let i = todo.length - 1; i >= 0; i--) {
        try { todo[i](); } catch (err) {
          if (!reported) { reported = true; console.error(err); }
        }
      }
    },
  };
}

export function createSession(mount) {
  let generation = 0;
  let pendingGen = 0;
  let example = null;
  let cur = null; // { run, opts, handle }

  function destroyCurrent() {
    if (!cur) return;
    const c = cur;
    cur = null;
    try { c.handle.destroy(); } catch (err) { console.error(err); }
  }

  function mountInto(run, opts) {
    const handle = mount(run, opts);
    cur = { run, opts, handle };
  }

  return {
    showExample(run, opts = {}) {
      generation++;
      example = run;
      destroyCurrent();
      mountInto(run, { ...opts, uploaded: false });
    },

    async tryLoad(produce) {
      const gen = ++generation;
      pendingGen = gen;
      let run;
      try {
        run = await produce();
      } catch (error) {
        if (gen !== generation) return { ok: false, stale: true };
        pendingGen = 0;
        return { ok: false, error };
      }
      if (gen !== generation) return { ok: false, stale: true };
      pendingGen = 0;
      const prev = cur;
      destroyCurrent();
      try {
        mountInto(run, { uploaded: true });
        return { ok: true, run };
      } catch (error) {
        if (!prev) return { ok: false, error, fatal: true };
        try {
          mountInto(prev.run, prev.opts);
        } catch (_) {
          cur = null;
          return { ok: false, error, fatal: true };
        }
        return { ok: false, error };
      }
    },

    restoreExample() {
      generation++;
      pendingGen = 0;
      destroyCurrent();
      mountInto(example, { uploaded: false, fresh: true });
    },

    current() {
      return cur ? { run: cur.run, uploaded: !!cur.opts.uploaded } : null;
    },

    busy() {
      return pendingGen !== 0 && pendingGen === generation;
    },
  };
}
