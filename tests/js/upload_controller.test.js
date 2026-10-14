import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, isShareable, createDisposers } from '../../site/js/app/session.js';

function fakeMount(opts = {}) {
  const calls = [];
  const handles = [];
  const mount = (run, o) => {
    calls.push({ run, opts: o });
    if (opts.throwFor && opts.throwFor(run, calls.length)) throw new Error('mount failed');
    const h = { destroys: 0, destroy() { this.destroys++; }, run };
    handles.push(h);
    return h;
  };
  return { mount, calls, handles };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const A = { id: 'A', meta: {} };
const B = { id: 'B', meta: { uploaded: true } };

test('showExample mounts the bundled run as not uploaded', () => {
  const f = fakeMount();
  const s = createSession(f.mount);
  s.showExample(A);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].run, A);
  assert.equal(f.calls[0].opts.uploaded, false);
  assert.deepEqual(s.current(), { run: A, uploaded: false });
});

test('failed produce changes nothing', async () => {
  const f = fakeMount();
  const s = createSession(f.mount);
  s.showExample(A);
  const err = new Error('bad csv');
  const r = await s.tryLoad(() => Promise.reject(err));
  assert.equal(r.ok, false);
  assert.equal(r.error, err);
  assert.equal(f.calls.length, 1);
  assert.equal(f.handles[0].destroys, 0);
  assert.equal(s.current().run, A);
});

test('successful load destroys previous once and mounts uploaded', async () => {
  const f = fakeMount();
  const s = createSession(f.mount);
  s.showExample(A);
  const r = await s.tryLoad(async () => B);
  assert.equal(r.ok, true);
  assert.equal(r.run, B);
  assert.equal(f.handles[0].destroys, 1);
  assert.equal(f.calls[1].opts.uploaded, true);
  assert.deepEqual(s.current(), { run: B, uploaded: true });
});

test('mount failure remounts previous run with its previous opts', async () => {
  const f = fakeMount({ throwFor: (run) => run === B });
  const s = createSession(f.mount);
  s.showExample(A, { fresh: false });
  const r = await s.tryLoad(async () => B);
  assert.equal(r.ok, false);
  assert.ok(r.error);
  assert.equal(f.handles[0].destroys, 1);
  const last = f.calls[f.calls.length - 1];
  assert.equal(last.run, A);
  assert.deepEqual(last.opts, f.calls[0].opts);
  assert.equal(s.current().run, A);
  assert.equal(s.current().uploaded, false);
});

test('mount failure and failed remount is fatal and clears current', async () => {
  let n = 0;
  const f = fakeMount({ throwFor: () => ++n > 1 });
  const s = createSession(f.mount);
  s.showExample(A);
  const r = await s.tryLoad(async () => B);
  assert.equal(r.ok, false);
  assert.equal(r.fatal, true);
  assert.equal(s.current(), null);
});

test('restoreExample destroys upload and mounts example fresh', async () => {
  const f = fakeMount();
  const s = createSession(f.mount);
  s.showExample(A);
  await s.tryLoad(async () => B);
  s.restoreExample();
  assert.equal(f.handles[1].destroys, 1);
  const last = f.calls[f.calls.length - 1];
  assert.equal(last.run, A);
  assert.equal(last.opts.uploaded, false);
  assert.equal(last.opts.fresh, true);
  assert.deepEqual(s.current(), { run: A, uploaded: false });
});

test('two consecutive uploads destroy each handle exactly once', async () => {
  const f = fakeMount();
  const s = createSession(f.mount);
  s.showExample(A);
  const B2 = { id: 'B2', meta: { uploaded: true } };
  await s.tryLoad(async () => B);
  await s.tryLoad(async () => B2);
  assert.deepEqual(f.handles.map((h) => h.destroys), [1, 1, 0]);
  assert.equal(s.current().run, B2);
});

test('race: slow A then fast B discards A', async () => {
  const f = fakeMount();
  const s = createSession(f.mount);
  s.showExample(A);
  const slow = deferred();
  const pA = s.tryLoad(() => slow.promise);
  const rB = await s.tryLoad(async () => B);
  assert.equal(rB.ok, true);
  const mounts = f.calls.length;
  const slowRun = { id: 'slow', meta: { uploaded: true } };
  slow.resolve(slowRun);
  const rA = await pA;
  assert.deepEqual(rA, { ok: false, stale: true });
  assert.equal(f.calls.length, mounts);
  assert.ok(!f.calls.some((c) => c.run === slowRun));
  assert.equal(s.current().run, B);
  assert.equal(f.handles[f.handles.length - 1].destroys, 0);
});

test('race: slow A rejecting after B is swallowed as stale', async () => {
  const f = fakeMount();
  const s = createSession(f.mount);
  s.showExample(A);
  const slow = deferred();
  const pA = s.tryLoad(() => slow.promise);
  await s.tryLoad(async () => B);
  slow.reject(new Error('late'));
  const rA = await pA;
  assert.deepEqual(rA, { ok: false, stale: true });
  assert.equal(s.current().run, B);
});

test('race: restoreExample invalidates in-flight load', async () => {
  const f = fakeMount();
  const s = createSession(f.mount);
  s.showExample(A);
  const slow = deferred();
  const pA = s.tryLoad(() => slow.promise);
  s.restoreExample();
  const mounts = f.calls.length;
  slow.resolve({ id: 'late', meta: { uploaded: true } });
  const rA = await pA;
  assert.deepEqual(rA, { ok: false, stale: true });
  assert.equal(f.calls.length, mounts);
  assert.deepEqual(s.current(), { run: A, uploaded: false });
});

test('busy tracks the latest pending load only', async () => {
  const f = fakeMount();
  const s = createSession(f.mount);
  s.showExample(A);
  assert.equal(s.busy(), false);
  const d1 = deferred();
  const d2 = deferred();
  const p1 = s.tryLoad(() => d1.promise);
  assert.equal(s.busy(), true);
  const p2 = s.tryLoad(() => d2.promise);
  d1.resolve(B);
  await p1;
  assert.equal(s.busy(), true);
  d2.resolve({ id: 'B2', meta: { uploaded: true } });
  await p2;
  assert.equal(s.busy(), false);
});

test('createDisposers runs in reverse, survives throwers, is idempotent', () => {
  const order = [];
  const d = createDisposers();
  const origErr = console.error;
  console.error = () => {};
  try {
    d.add(() => order.push('a'));
    d.add(() => { throw new Error('x'); });
    d.add(() => order.push('c'));
    d.run();
    assert.deepEqual(order, ['c', 'a']);
    d.run();
    assert.deepEqual(order, ['c', 'a']);
  } finally {
    console.error = origErr;
  }
});

test('partial mount rollback disposes created resources once and restores previous', async () => {
  let spyCalls = 0;
  const handles = [];
  const calls = [];
  const mount = (run, o) => {
    calls.push({ run, opts: o });
    const d = createDisposers();
    d.add(() => { if (run === B) spyCalls++; });
    try {
      if (run === B) throw new Error('boom');
      const h = { destroy: () => d.run() };
      handles.push(h);
      return h;
    } catch (e) {
      d.run();
      throw e;
    }
  };
  const s = createSession(mount);
  s.showExample(A);
  const r = await s.tryLoad(async () => B);
  assert.equal(r.ok, false);
  assert.equal(r.error.message, 'boom');
  assert.equal(spyCalls, 1);
  assert.equal(calls[calls.length - 1].run, A);
  assert.equal(s.current().run, A);
});

test('isShareable', () => {
  assert.equal(isShareable({ meta: {} }), true);
  assert.equal(isShareable({ meta: { uploaded: true } }), false);
});
