import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, placeHook, startDescent, addDepth, registerStun, registerEscape } from '../src/state.js';
import { STARTER_HOOK, FISH_TYPES, WORLD } from '../src/config.js';

test('new game starts in BACKPACK mode with 3 lives and no hook', () => {
  const s = createGame();
  assert.equal(s.mode, 'BACKPACK');
  assert.equal(s.lives, 3);
  assert.equal(s.hook, null);
});

test('placeHook puts starter hook into grid and equips it', () => {
  const s = createGame();
  assert.equal(placeHook(s, 1, 1), true);
  assert.equal(s.hook.id, STARTER_HOOK.id);
  assert.equal(s.grid.cells[1 * 3 + 1], STARTER_HOOK.id);
});

test('startDescent only works after hook placed', () => {
  const s = createGame();
  assert.equal(startDescent(s), false);
  placeHook(s, 0, 0);
  assert.equal(startDescent(s), true);
  assert.equal(s.mode, 'DESCENT');
});

test('addDepth accrues meters and updates score', () => {
  const s = createGame(); placeHook(s, 0, 0); startDescent(s);
  addDepth(s, WORLD.pxPerMeter * 10); // 10 m worth of px
  assert.equal(Math.round(s.depthPx / WORLD.pxPerMeter), 10);
  assert.ok(s.score >= 10);
});

test('registerStun adds scoreValue points and counts fish', () => {
  const s = createGame(); placeHook(s, 0, 0); startDescent(s);
  registerStun(s, FISH_TYPES.sredniak);
  assert.equal(s.stunned, 1);
  assert.ok(s.score >= FISH_TYPES.sredniak.scoreValue);
});

test('three escapes end the descent and compute stars', () => {
  const s = createGame(); placeHook(s, 0, 0); startDescent(s);
  registerEscape(s); registerEscape(s);
  assert.equal(s.mode, 'DESCENT');
  registerEscape(s);
  assert.equal(s.mode, 'END');
  assert.equal(s.lives, 0);
  assert.equal(typeof s.stars, 'number');
});
