import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, placeHook, startStage, addDepth, registerStun, registerEscape,
  carouselMove, openBackpack, closeBackpack, stageUnlocked,
} from '../src/state.js';
import { STARTER_HOOK, FISH_TYPES, WORLD, STAGES } from '../src/config.js';

test('new game starts at HOME, stage 0 unlocked, rest locked, no hook', () => {
  const s = createGame();
  assert.equal(s.mode, 'HOME');
  assert.equal(s.stageIndex, 0);
  assert.equal(stageUnlocked(s, 0), true);
  assert.equal(stageUnlocked(s, 1), false);
  assert.equal(s.hook, null);
});

test('carouselMove clamps to stage range', () => {
  const s = createGame();
  carouselMove(s, -1); assert.equal(s.stageIndex, 0);
  carouselMove(s, 1); assert.equal(s.stageIndex, 1);
  for (let i = 0; i < 10; i++) carouselMove(s, 1);
  assert.equal(s.stageIndex, STAGES.length - 1);
});

test('backpack open/close toggles mode', () => {
  const s = createGame();
  openBackpack(s); assert.equal(s.mode, 'BACKPACK');
  closeBackpack(s); assert.equal(s.mode, 'HOME');
});

test('placeHook equips hook and marks progress', () => {
  const s = createGame();
  assert.equal(placeHook(s, 1, 1), true);
  assert.equal(s.hook.id, STARTER_HOOK.id);
  assert.equal(s.progress.hookEquipped, true);
});

test('startStage needs a hook and an unlocked stage', () => {
  const s = createGame();
  assert.equal(startStage(s), false);          // brak haka
  placeHook(s, 0, 0);
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

test('zero-star run does not unlock the next stage', () => {
  const s = createGame(); placeHook(s, 0, 0); startStage(s);
  s.stunnedPoints = 0;
  registerEscape(s); registerEscape(s); registerEscape(s);
  assert.equal(s.mode, 'END');
  assert.equal(s.stars, 0);
  assert.equal(s.progress.stages[1].unlocked, false);
});
