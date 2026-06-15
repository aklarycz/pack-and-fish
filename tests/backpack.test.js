import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, canPlace, placeItem } from '../src/logic/backpack.js';

test('createGrid makes an empty cols*rows grid', () => {
  const g = createGrid(3, 3);
  assert.equal(g.cols, 3);
  assert.equal(g.cells.length, 9);
  assert.ok(g.cells.every(c => c === null));
});

test('canPlace true on empty cell in bounds, false out of bounds', () => {
  const g = createGrid(3, 3);
  assert.equal(canPlace(g, 0, 0), true);
  assert.equal(canPlace(g, 3, 0), false);
  assert.equal(canPlace(g, -1, 0), false);
});

test('placeItem fills the cell and blocks reuse', () => {
  const g = createGrid(3, 3);
  assert.equal(placeItem(g, 'rusty_hook', 1, 1), true);
  assert.equal(g.cells[1 * 3 + 1], 'rusty_hook');
  assert.equal(canPlace(g, 1, 1), false);
  assert.equal(placeItem(g, 'other', 1, 1), false);
});
