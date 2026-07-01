import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFishType, createFish } from '../src/logic/spawn.js';
import { FISH_TYPES } from '../src/config.js';

test('shallow water only spawns plotka', () => {
  assert.equal(pickFishType(0, () => 0.0), 'plotka');
  assert.equal(pickFishType(0, () => 0.99), 'plotka');
});

test('pickFishType uses rng across weighted mix', () => {
  // at 25m mix ~ plotka .4, sredniak .4, twardziel .2
  assert.equal(pickFishType(25, () => 0.0), 'plotka');
  assert.equal(pickFishType(25, () => 0.5), 'sredniak');
  assert.equal(pickFishType(25, () => 0.95), 'twardziel');
});

test('createFish uses constant per-species hp (bez skalowania głębokością) and copies type stats', () => {
  const f = createFish('plotka', 0, 100);
  assert.equal(f.hp, FISH_TYPES.plotka.hp);
  assert.equal(f.hpMax, f.hp);
  assert.equal(f.type, 'plotka');
  assert.equal(f.state, 'patrol');
  const deep = createFish('plotka', 100, 100);
  assert.equal(deep.hp, FISH_TYPES.plotka.hp);  // to samo hp niezależnie od głębokości
});
