import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLink } from '../../site/js/app/link.js';

test('hover dedupes identical rows and notifies null once', () => {
  const link = createLink();
  const seen = [];
  link.onHover((r) => seen.push(r));
  link.hover(5); link.hover(5); link.hover(6); link.hover(null); link.hover(null);
  assert.deepEqual(seen, [5, 6, null]);
});

test('select always notifies select subscribers only', () => {
  const link = createLink();
  const hov = []; const sel = [];
  link.onHover((r) => hov.push(r));
  link.onSelect((r) => sel.push(r));
  link.select(3); link.select(3);
  assert.deepEqual(sel, [3, 3]);
  assert.deepEqual(hov, []);
});

test('unsubscribe stops notifications', () => {
  const link = createLink();
  const seen = [];
  const off = link.onHover((r) => seen.push(r));
  link.hover(1); off(); link.hover(2);
  assert.deepEqual(seen, [1]);
});
