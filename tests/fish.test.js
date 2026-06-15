import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inAggroRange } from '../src/fish.js';
import { FISH_TYPES } from '../src/config.js';

test('inAggroRange true when hook within type aggroRange', () => {
  const f = { type: 'plotka', x: 100, y: 100 };
  assert.equal(inAggroRange(f, 100, 200, FISH_TYPES), true);   // 100 px < 130
  assert.equal(inAggroRange(f, 100, 400, FISH_TYPES), false);  // 300 px > 130
});
