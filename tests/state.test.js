import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, placeHook, startStage, addDepth, registerStun, registerEscape,
  carouselMove, openBackpack, closeBackpack, stageUnlocked, descentCleared,
  openChest, placeAccessory, moveItem, computeHookStats,
} from '../src/state.js';
import { STARTER_HOOK, FISH_TYPES, WORLD, STAGES } from '../src/config.js';

test('new game: HOME, stage 0 unlocked, rest locked, rusty hook pre-equipped (default, atk1)', () => {
  const s = createGame();
  assert.equal(s.mode, 'HOME');
  assert.equal(s.stageIndex, 0);
  assert.equal(stageUnlocked(s, 0), true);
  assert.equal(stageUnlocked(s, 1), false);
  assert.ok(s.hook);                          // zardzewiały hak jest DEFAULT (pre-założony)
  assert.equal(s.hook.atk, STARTER_HOOK.atk); // atk 1
  assert.equal(s.hook.maxLatch, 1);
});

test('carouselMove clamps to stage range', () => {
  const s = createGame();
  carouselMove(s, -1); assert.equal(s.stageIndex, 0);
  carouselMove(s, 1); assert.equal(s.stageIndex, 1);
  for (let i = 0; i < STAGES.length + 5; i++) carouselMove(s, 1);
  assert.equal(s.stageIndex, STAGES.length - 1);
});

test('backpack open/close toggles mode', () => {
  const s = createGame();
  openBackpack(s); assert.equal(s.mode, 'BACKPACK');
  closeBackpack(s); assert.equal(s.mode, 'HOME');
});

test('bronze hook accessory (connected) raises atk to 8', () => {
  const s = createGame();                       // rusty pre-equipped (atk1) + bronze in inventory
  assert.equal(s.hook.atk, STARTER_HOOK.atk);   // 1
  assert.equal(placeAccessory(s, 'bronze'), true); // auto first free = adjacent to hook
  assert.equal(s.hook.atk, 8);                  // 1 + 7
});

test('startStage needs an unlocked stage (hook is always present)', () => {
  const s = createGame();
  s.stageIndex = 1;                             // zablokowany
  assert.equal(startStage(s), false);
  s.stageIndex = 0;
  assert.equal(startStage(s), true);
  assert.equal(s.mode, 'DESCENT');
});

test('addDepth and registerStun update score during descent', () => {
  const s = createGame(); placeHook(s, 0, 0); startStage(s);
  addDepth(s, WORLD.pxPerMeter * 10);
  assert.ok(s.score >= 10);
  registerStun(s, FISH_TYPES.sredniak);
  assert.equal(s.stunned, 1);
});

test('three escapes end the stage; >=1 star unlocks next and saves stars', () => {
  const s = createGame(); placeHook(s, 0, 0); startStage(s);
  s.stunnedPoints = 300;                        // wymuś wysoki wynik
  registerEscape(s); registerEscape(s);
  assert.equal(s.mode, 'DESCENT');
  registerEscape(s);
  assert.equal(s.mode, 'END');
  assert.ok(s.stars >= 1);
  assert.equal(s.progress.stages[0].stars, s.stars);
  assert.ok(s.progress.stages[0].bestScore >= 300);
  assert.equal(s.progress.stages[1].unlocked, true);
  assert.equal(s.lastResult.newUnlock, true);
});

test('chest earned only on clear with >=1 star; first chest forces the anchor', () => {
  const s = createGame(); placeHook(s, 0, 0); startStage(s);
  s.stunnedPoints = 300; descentCleared(s);
  assert.equal(s.lastResult.chestEarned, true);
  assert.equal(s.progress.pendingChests, 1);
  const reward = openChest(s);
  assert.equal(reward.anchor, true);
  assert.ok(s.progress.coins >= 120);
  assert.equal(s.progress.inventory.anchor, 1);
  assert.equal(s.progress.pendingChests, 0);
});

test('placing the anchor (adjacent) raises hook maxLatch to 2', () => {
  const s = createGame(); placeHook(s, 0, 0);
  s.progress.inventory.anchor = 1;
  assert.equal(placeAccessory(s, 'anchor'), true); // auto first free = index 1, adjacent
  assert.equal(s.hook.maxLatch, 2);
});

test('accessory gives effect only when connected to hook (adjacency)', () => {
  const s = createGame(); placeHook(s, 0, 0); // hook at index 0
  s.grid.cells[8] = 'anchor'; s.hook = computeHookStats(s.grid); // far corner, not connected
  assert.equal(s.hook.maxLatch, 1);
  assert.equal(s.hook.atk, STARTER_HOOK.atk);
  moveItem(s, 8, 1);                                              // connect to hook
  assert.equal(s.hook.maxLatch, 2);
  assert.equal(s.hook.atk, STARTER_HOOK.atk + 1);                 // anchor +1 atk when connected
});

test('fish award coins from their coins field', () => {
  const s = createGame(); placeHook(s, 0, 0); startStage(s);
  registerStun(s, FISH_TYPES.twardziel);
  assert.equal(s.coinsEarned, FISH_TYPES.twardziel.coins);
});

test('descentCleared ends the stage as success (cleared) and scores stars', () => {
  const s = createGame(); placeHook(s, 0, 0); startStage(s);
  s.stunnedPoints = 300;
  descentCleared(s);
  assert.equal(s.mode, 'END');
  assert.equal(s.lastResult.cleared, true);
  assert.ok(s.stars >= 1);
  assert.equal(s.progress.stages[1].unlocked, true);
});

test('zero-star run does not unlock the next stage', () => {
  const s = createGame(); placeHook(s, 0, 0); startStage(s);
  s.stunnedPoints = 0;
  registerEscape(s); registerEscape(s); registerEscape(s);
  assert.equal(s.mode, 'END');
  assert.equal(s.stars, 0);
  assert.equal(s.progress.stages[1].unlocked, false);
});
