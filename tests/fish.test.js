import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inAggroRange, updateFish } from '../src/fish.js';
import { FISH_TYPES } from '../src/config.js';

test('inAggroRange true when hook within type aggroRange', () => {
  const f = { type: 'plotka', x: 100, y: 100 };
  assert.equal(inAggroRange(f, 100, 200, FISH_TYPES), true);   // 100 px < 130
  assert.equal(inAggroRange(f, 100, 400, FISH_TYPES), false);  // 300 px > 130
});

test('patrol fish holds its depth (only gentle bob) and moves horizontally', () => {
  const f = { type: 'plotka', x: 100, y: 500, baseY: undefined, dir: 1, t: 0, phaseX: 0, phaseY: 0, bobAmp: 10, turnTimer: 99, state: 'patrol' };
  const hookX = 400, hookWorldY = 50; // hak daleko w górze -> brak aggro
  const x0 = f.x;
  let maxDev = 0;
  for (let i = 0; i < 200; i++) {
    updateFish(f, hookX, hookWorldY, 0.05, 1, () => 0.9);
    maxDev = Math.max(maxDev, Math.abs(f.y - f.baseY));
  }
  assert.ok(maxDev <= 10 + 1e-9, 'pion mieści się w amplitudzie bujaka (brak dryfu w górę)');
  assert.ok(Math.abs(f.x - x0) > 20, 'ruszyła się poziomo');
});

test('aggro fish closes horizontally to hook column with vertical only as bob', () => {
  const hookX = 300, hookWorldY = 200;
  const f = { type: 'sredniak', x: 200, y: 200, baseY: undefined, dir: 1, t: 0, phaseX: 0, phaseY: 0, bobAmp: 10, state: 'aggro' };
  for (let i = 0; i < 80; i++) updateFish(f, hookX, hookWorldY, 0.05, 1, () => 0.9);
  assert.ok(Math.abs(f.x - hookX) < 20, 'domknęła się poziomo do kolumny haka');
  assert.ok(Math.abs(f.y - f.baseY) <= 10 + 1e-9, 'pion to tylko bujak, brak darcia w górę');
});
