import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, placeHook, placeAccessory, startStage } from '../src/state.js';
import { stepDescent } from '../src/sim.js';
import { WORLD } from '../src/config.js';

function started() {
  // realny loadout: rusty hak (atk1) + brązowy hak obok (+7 = atk8) — jak po tutorialu
  const s = createGame(); placeHook(s, 0, 0); placeAccessory(s, 'bronze'); startStage(s);
  return s;
}

const HOOK_Y = 200; // ekranowe Y haka w paśmie ruchu (dla testów)

test('latched fish that dies becomes a bubble and scores', () => {
  const s = started();
  const hookX = 200;
  s.fish.push({ type: 'plotka', x: hookX, y: HOOK_Y, hp: 6, hpMax: 6, window: 2.0, windowLeft: 0, state: 'aggro', dir: 1, bubbleY: 0 });
  let safety = 0;
  while (s.stunned === 0 && safety++ < 200) stepDescent(s, hookX, HOOK_Y, 0.1, () => 0.5);
  assert.equal(s.stunned, 1);
  assert.ok(s.bubbles.length >= 1);
});

test('three tough fish that escape end the descent at END', () => {
  const s = started();
  const hookX = 200;
  let safety = 0;
  while (s.mode === 'DESCENT' && safety++ < 500) {
    if (s.latched.length === 0) {
      const hookWorldY = s.depthPx + HOOK_Y;
      s.fish.push({ type: 'twardziel', x: hookX, y: hookWorldY, hp: 9999, hpMax: 9999, window: 2.0, windowLeft: 0, state: 'aggro', dir: 1, bubbleY: 0 });
    }
    stepDescent(s, hookX, HOOK_Y, 0.2, () => 0.99);
  }
  assert.equal(s.mode, 'END');
  assert.equal(s.lives, 0);
  assert.equal(typeof s.stars, 'number');
});

test('autonomous rocket marks nearest fish and damages it regardless of latch', () => {
  const s = started();
  s.progress.inventory.rocket = 1; placeAccessory(s, 'rocket');
  startStage(s);                                  // przelicza hook + init rocketCd
  s.fishQueue = [];                               // bez nowych spawnów
  const hookX = 200, hookWorldY = s.depthPx + HOOK_Y;
  const f = { type: 'twardziel', x: hookX + 20, y: hookWorldY, hp: 6, hpMax: 60, window: 2, windowLeft: 2, state: 'patrol', dir: 1, bubbleY: 0 };
  s.fish.push(f);
  s.rocketCd = 0;                                 // wystrzel od razu
  let safety = 0, hpStart = f.hp;
  while (s.fish.includes(f) && safety++ < 200) stepDescent(s, hookX, HOOK_Y, 0.05, () => 0.5);
  // rakieta (4 dmg) dobiła rybę (hp6) -> ogłuszenie, nawet bez zaczepienia na haku
  assert.equal(s.stunned >= 1, true);
});

test('descent runs many steps without throwing and accrues depth', () => {
  const s = started();
  for (let i = 0; i < 400; i++) {
    if (s.mode !== 'DESCENT') break;
    const x = WORLD.hookMinX + ((i * 37) % (WORLD.hookMaxX - WORLD.hookMinX));
    stepDescent(s, x, HOOK_Y, 0.05, () => ((i * 0.131) % 1));
  }
  assert.ok(s.depthPx > 0);
});
