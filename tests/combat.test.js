import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startLatch, tickLatch } from '../src/logic/combat.js';

function fish(hp, windowS) {
  return { hp, hpMax: hp, window: windowS, windowLeft: 0, state: 'aggro' };
}

test('startLatch arms the window and marks fish latched', () => {
  const f = fish(10, 2.0);
  startLatch(f);
  assert.equal(f.state, 'latched');
  assert.equal(f.windowLeft, 2.0);
});

test('hp reaching 0 within window => stunned', () => {
  const f = fish(10, 2.0); startLatch(f);
  // atk 8/s, 1.0s -> 8 dmg (ongoing), another 0.5s -> 12 total -> stunned
  assert.equal(tickLatch(f, 8, 1.0), 'ongoing');
  assert.equal(tickLatch(f, 8, 0.5), 'stunned');
  assert.equal(f.state, 'stunned');
});

test('window expiring before kill => escaped', () => {
  const f = fish(100, 2.0); startLatch(f);
  assert.equal(tickLatch(f, 8, 1.5), 'ongoing');
  assert.equal(tickLatch(f, 8, 0.6), 'escaped');  // windowLeft < 0
  assert.equal(f.state, 'escaped');
});

test('stun wins ties when hp hits 0 exactly as window ends', () => {
  const f = fish(8, 1.0); startLatch(f);
  assert.equal(tickLatch(f, 8, 1.0), 'stunned');  // hp check before window check
});
