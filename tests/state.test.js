import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, placeHook, startStage, addDepth, registerStun, registerEscape,
  carouselMove, arenaMove, selectStageIndex, openBackpack, closeBackpack, stageUnlocked, descentCleared,
  openChest, placeAccessory, moveItem, computeHookStats, loginGuest, returnHome,
} from '../src/state.js';
import { STARTER_HOOK, FISH_TYPES, WORLD, STAGES, STAGES_PER_ARENA, PLAYABLE_STAGES } from '../src/config.js';

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

test('new game shows splash; loginGuest enters the game', () => {
  const s = createGame();
  assert.equal(s.splash, true);
  loginGuest(s);
  assert.equal(s.splash, false);
  assert.equal(s.mode, 'HOME');
});

test('carouselMove clampuje do grywalnej areny 1 (0..9)', () => {
  const s = createGame();
  carouselMove(s, -1); assert.equal(s.stageIndex, 0);
  for (let i = 0; i < 50; i++) carouselMove(s, 1);
  assert.equal(s.stageIndex, PLAYABLE_STAGES - 1);   // 9, nie STAGES.length-1
});

test('arenaMove nie wychodzi poza arenę 1 (brak contentu aren 2+)', () => {
  const s = createGame();
  arenaMove(s, 1);
  assert.ok(s.stageIndex < STAGES_PER_ARENA);
  arenaMove(s, 5);
  assert.ok(s.stageIndex < STAGES_PER_ARENA);
});

test('selectStageIndex clampuje do areny 1', () => {
  const s = createGame();
  selectStageIndex(s, 25);
  assert.equal(s.stageIndex, PLAYABLE_STAGES - 1);
});

test('stage 10 nie odblokowuje areny 2, returnHome nie zawija', () => {
  const s = createGame();
  s.stageIndex = PLAYABLE_STAGES - 1;                       // stage 10 (idx 9)
  s.progress.stages[s.stageIndex].unlocked = true;
  startStage(s);
  s.stunnedPoints = 300; descentCleared(s);                 // clear z gwiazdkami
  returnHome(s);
  assert.equal(s.stageIndex, PLAYABLE_STAGES - 1);          // został na stage 10 (brak skoku)
  assert.equal(!!(s.progress.stages[PLAYABLE_STAGES] && s.progress.stages[PLAYABLE_STAGES].unlocked), false);
});

test('backpack open/close toggles mode', () => {
  const s = createGame();
  openBackpack(s); assert.equal(s.mode, 'BACKPACK');
  closeBackpack(s); assert.equal(s.mode, 'HOME');
});

test('bronze hook accessory raises atk to 4', () => {
  const s = createGame();                       // rusty pre-equipped (atk1) + bronze in inventory
  assert.equal(s.hook.atk, STARTER_HOOK.atk);   // 1
  assert.equal(placeAccessory(s, 'bronze'), true);
  assert.equal(s.hook.atk, 4);                  // 1 + 3
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

test('losing all 3 lives = fail: 0 stars, no unlock, no chest (even with high score)', () => {
  const s = createGame(); placeHook(s, 0, 0); startStage(s);
  s.stunnedPoints = 300;                        // wysoki wynik, ale i tak przegrana
  registerEscape(s); registerEscape(s);
  assert.equal(s.mode, 'DESCENT');
  registerEscape(s);
  assert.equal(s.mode, 'END');
  assert.equal(s.stars, 0);                     // przegrana = brak gwiazdek
  assert.equal(s.progress.stages[0].stars, 0);
  assert.equal(s.progress.stages[1].unlocked, false); // brak odblokowania
  assert.equal(s.lastResult.cleared, false);
  assert.equal(s.lastResult.newUnlock, false);
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

test('anchor connected to bronze hook raises maxLatch to 2', () => {
  const s = createGame();                          // bronze in inventory
  placeAccessory(s, 'bronze');                     // index 0
  s.progress.inventory.anchor = 1;
  s.progress.tutAnchorDone = true;                 // po tutorialu: auto-placement w pierwszy wolny (obok)
  assert.equal(placeAccessory(s, 'anchor'), true); // index 1, sąsiaduje z brązem
  assert.equal(s.hook.maxLatch, 2);                // połączone → +1 ryba
});

test('tutorialowa kotwica ląduje z dala od brązowego haka (wymusza przeciągnięcie)', () => {
  const s = createGame();
  placeAccessory(s, 'bronze');                      // index 0
  s.progress.inventory.anchor = 1;
  assert.equal(s.progress.tutAnchorDone, false);    // tutorial trwa
  assert.equal(placeAccessory(s, 'anchor'), true);
  const ai = s.grid.cells.indexOf('anchor');
  assert.notEqual(ai, 1);                           // nie w prawo od brązu (idx 0)
  assert.notEqual(ai, 3);                           // nie pod brązem
  assert.equal(s.hook.maxLatch, 1);                 // niepołączone -> gracz musi przeciągnąć
});

test('raw atk always counts; +fish (maxLatch) only when anchor connected to bronze hook', () => {
  const s = createGame();
  s.grid.cells[0] = 'bronze'; s.grid.cells[8] = 'anchor'; // bronze i kotwica DALEKO (niepołączone)
  s.hook = computeHookStats(s.grid);
  assert.equal(s.hook.atk, STARTER_HOOK.atk + 3 + 1); // raw atk: baza1 + brąz3 + kotwica1 = 5 (zawsze)
  assert.equal(s.hook.maxLatch, 1);                   // niepołączone → brak +ryba
  moveItem(s, 8, 1);                                  // kotwica obok brązowego haka
  assert.equal(s.hook.maxLatch, 2);                   // połączone → +1 ryba
  assert.equal(s.hook.atk, STARTER_HOOK.atk + 3 + 1); // atk bez zmian (raw)
});

test('rocket takes 2 grid slots and sets rocket stats (autonomous)', () => {
  const s = createGame();
  s.progress.inventory.rocket = 1;
  assert.equal(placeAccessory(s, 'rocket'), true);
  // zajmuje 2 sąsiednie komórki tym samym id
  assert.equal(s.grid.cells[0], 'rocket');
  assert.equal(s.grid.cells[1], 'rocket');
  assert.equal(s.hook.hasRocket, true);
  assert.equal(s.hook.rocketDmg, 4);
  assert.equal(s.hook.rocketInterval, 2);
  assert.equal(s.hook.atk, STARTER_HOOK.atk); // rakieta nie dodaje raw atk
});

test('second chest forces the rocket (after anchor)', () => {
  const s = createGame(); placeHook(s, 0, 0); startStage(s);
  s.stunnedPoints = 300; descentCleared(s);
  assert.equal(openChest(s).anchor, true);          // 1. skrzynia = kotwica
  s.progress.pendingChests = 1;                      // wymuś 2. skrzynię
  const reward = openChest(s);
  assert.equal(reward.rocket, true);
  assert.equal(s.progress.inventory.rocket, 1);
  assert.equal(s.progress.gotRocket, true);
});

test('multi-slot item does not double-count stats', () => {
  const s = createGame();
  s.grid.cells[0] = 'rocket'; s.grid.cells[1] = 'rocket'; // 2 komórki = 1 item
  s.hook = computeHookStats(s.grid);
  assert.equal(s.hook.atk, STARTER_HOOK.atk);        // raz, nie 2×
  assert.equal(s.hook.hasRocket, true);
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

test('returnHome after clear advances to next unlocked stage; after fail it does not', () => {
  const s = createGame(); startStage(s);
  s.stunnedPoints = 300; descentCleared(s);          // clear stage 0 (>=1 star -> unlock 1)
  assert.equal(s.stageIndex, 0);
  returnHome(s);
  assert.equal(s.stageIndex, 1);                      // przeskok na kolejny
  assert.equal(s.mode, 'HOME');
  // fail nie przeskakuje
  startStage(s);
  registerEscape(s); registerEscape(s); registerEscape(s);
  returnHome(s);
  assert.equal(s.stageIndex, 1);                      // został na bieżącym
});

test('zero-star run does not unlock the next stage', () => {
  const s = createGame(); placeHook(s, 0, 0); startStage(s);
  s.stunnedPoints = 0;
  registerEscape(s); registerEscape(s); registerEscape(s);
  assert.equal(s.mode, 'END');
  assert.equal(s.stars, 0);
  assert.equal(s.progress.stages[1].unlocked, false);
});
