import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startLatch, tickLatch } from '../src/logic/combat.js';

function fish(hp) {
  return { hp, hpMax: hp, state: 'aggro' };
}

test('startLatch marks fish latched (brak okna — ryzyko przez durability w sim)', () => {
  const f = fish(10);
  startLatch(f);
  assert.equal(f.state, 'latched');
});

test('hp reaching 0 => stunned (łów tylko przez HP)', () => {
  const f = fish(10); startLatch(f);
  assert.equal(tickLatch(f, 8, 1.0), 'ongoing');   // 8 dmg
  assert.equal(tickLatch(f, 8, 0.5), 'stunned');   // +4 = 12 >= 10
  assert.equal(f.state, 'stunned');
});

test('no time limit: długo trzymana ryba NIE ucieka (tylko ongoing aż HP spadnie)', () => {
  const f = fish(100); startLatch(f);
  assert.equal(tickLatch(f, 8, 5.0), 'ongoing');   // 40 dmg, wciąż żyje, brak ucieczki
  assert.equal(tickLatch(f, 8, 5.0), 'ongoing');   // 80 dmg
  assert.equal(tickLatch(f, 8, 3.0), 'stunned');   // 104 >= 100
});
