import { test } from 'node:test';
import assert from 'node:assert/strict';
import { difficultyAt } from '../src/logic/ramp.js';

test('spawn interval tightens with depth but never below floor', () => {
  const shallow = difficultyAt(0);
  const deep = difficultyAt(500);
  assert.ok(deep.spawnInterval < shallow.spawnInterval);
  assert.ok(deep.spawnInterval >= 0.45);
});

test('hp and speed multipliers grow monotonically from 1', () => {
  assert.equal(difficultyAt(0).hpMul, 1);
  assert.ok(difficultyAt(50).hpMul > difficultyAt(10).hpMul);
  assert.ok(difficultyAt(50).speedMul > 1);
});

test('mix shifts toward harder fish with depth', () => {
  assert.equal(difficultyAt(0).mix.twardziel, 0);
  assert.ok(difficultyAt(50).mix.twardziel > 0);
});

test('mix weights are returned for all three types', () => {
  const m = difficultyAt(25).mix;
  assert.ok('plotka' in m && 'sredniak' in m && 'twardziel' in m);
});
