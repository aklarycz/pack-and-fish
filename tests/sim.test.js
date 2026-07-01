import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, placeHook, placeAccessory, startStage } from '../src/state.js';
import { stepDescent } from '../src/sim.js';
import { createFish } from '../src/logic/spawn.js';
import { WORLD } from '../src/config.js';

// perfekcyjny pościg: gdy ryba odpięta i minął bufor, wróć nią na hak (symuluje gracza goniącego rybę)
function chase(s, f, hookX) {
  if (f.state === 'escaped' && (f.recatchLock || 0) <= 0) { f.x = hookX; f.y = s.depthPx + HOOK_Y; }
}

function started() {
  // realny loadout: rusty hak (atk1) + brązowy hak (+3 = atk4) — jak po tutorialu
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
  s.fishQueue = []; s.bossSpawned = true;                               // bez nowych spawnów
  const hookX = 200, hookWorldY = s.depthPx + HOOK_Y;
  const f = { type: 'twardziel', x: hookX + 20, y: hookWorldY, hp: 6, hpMax: 60, window: 2, windowLeft: 2, state: 'patrol', dir: 1, bubbleY: 0 };
  s.fish.push(f);
  s.rocketCd = 0;                                 // wystrzel od razu
  let safety = 0, hpStart = f.hp;
  while (s.fish.includes(f) && safety++ < 200) stepDescent(s, hookX, HOOK_Y, 0.05, () => 0.5);
  // rakieta (4 dmg) dobiła rybę (hp6) -> ogłuszenie, nawet bez zaczepienia na haku
  assert.equal(s.stunned >= 1, true);
});

test('rocket locks nearest target and keeps the mark (does not switch)', () => {
  const s = started();
  s.progress.inventory.rocket = 1; placeAccessory(s, 'rocket'); startStage(s);
  s.fishQueue = []; s.bossSpawned = true;
  const hookX = 200, hwy = s.depthPx + HOOK_Y;
  const near = { type: 'plotka', x: hookX + 20, y: hwy, hp: 12, hpMax: 12, window: 3, windowLeft: 3, state: 'patrol', dir: 1, bubbleY: 0 };
  const far = { type: 'plotka', x: hookX + 240, y: hwy, hp: 12, hpMax: 12, window: 3, windowLeft: 3, state: 'patrol', dir: 1, bubbleY: 0 };
  s.fish.push(near, far);
  s.rocketCd = 1;
  stepDescent(s, hookX, HOOK_Y, 0.05, () => 0.5);
  assert.equal(s.rocketTarget, near);    // zablokował najbliższą
  assert.equal(near.marked, true);
  assert.equal(!!far.marked, false);     // druga ryba nietknięta
  // kolejne kroki nie przełączają celu na drugą rybę
  for (let i = 0; i < 5; i++) stepDescent(s, hookX, HOOK_Y, 0.05, () => 0.5);
  if (s.fish.includes(near)) assert.equal(s.rocketTarget, near);
});

test('durability: muskie zrywa się po jednym pasku -> -1 serce, ryba escaped z zachowanym HP', () => {
  const s = started();                 // brąz: dur 6, atk haka 4
  s.fishQueue = []; s.bossSpawned = true;
  const hookX = 200, hwy = s.depthPx + HOOK_Y;
  const muskie = { type: 'twardziel', x: hookX, y: hwy, hp: 48, hpMax: 48, state: 'aggro', dir: 1, bubbleY: 0 };
  s.fish.push(muskie);
  let safety = 0;
  while (s.lives === 3 && safety++ < 3000) stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(s.lives, 2);                       // dokładnie JEDNO serce (nie 3)
  assert.equal(muskie.state, 'escaped');          // odpięty, nie wisi dalej
  assert.equal(s.latched.includes(muskie), false);
  assert.ok(muskie.hp > 0 && muskie.hp < 48);     // nie złowiony, ale oberwał
  assert.equal(s.mode, 'DESCENT');                // gra trwa
});

test('durability: dobicie drenującej ryby przed zerwaniem odnawia pasek, bez utraty serca', () => {
  const s = started();
  s.fishQueue = []; s.bossSpawned = true;
  const hookX = 200, hwy = s.depthPx + HOOK_Y;
  s.durability = s.durabilityMax - 1;             // pasek nadszarpnięty
  s.fish.push({ type: 'twardziel', x: hookX, y: hwy, hp: 2, hpMax: 48, state: 'aggro', dir: 1, bubbleY: 0 });
  let safety = 0;
  while (s.stunned === 0 && safety++ < 200) stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(s.stunned, 1);                     // złowiony (hp 2, atk 4)
  assert.equal(s.lives, 3);                       // bez utraty serca
  assert.equal(s.durability, s.durabilityMax);    // pasek odnowiony do maksa
});

test('zerwana ryba re-latchuje raz na kontakt i kontynuuje od swojego HP', () => {
  const s = started();
  s.fishQueue = []; s.bossSpawned = true;
  const hookX = 200, hwy = s.depthPx + HOOK_Y;
  const f = { type: 'twardziel', x: hookX, y: hwy, hp: 20, hpMax: 48,
              state: 'escaped', dir: 1, bubbleY: 0, breakoffs: 1, recatchLeft: 1, recatchLock: 0, escapeFast: false };
  s.fish.push(f);
  let safety = 0;
  while (f.state !== 'latched' && safety++ < 100) stepDescent(s, hookX, HOOK_Y, 0.1, () => 0.5);
  assert.equal(f.state, 'latched');
  assert.ok(s.latched.includes(f));
  assert.ok(f.hp <= 20);                            // nie zresetowane do 48
});

test('po drugim zerwaniu ryba ucieka szybko i nie da się jej złapać', () => {
  const s = started();
  s.fishQueue = []; s.bossSpawned = true;
  const hookX = 200, hwy = s.depthPx + HOOK_Y;
  const f = { type: 'twardziel', x: hookX, y: hwy, hp: 48, hpMax: 48,
              state: 'escaped', dir: 1, bubbleY: 0, breakoffs: 1, recatchLeft: 1, recatchLock: 0, escapeFast: false };
  s.fish.push(f);
  let safety = 0;
  while (f.breakoffs < 2 && safety++ < 5000) stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(f.breakoffs, 2);
  assert.equal(f.escapeFast, true);
  assert.equal(f.recatchLeft, 0);
  for (let i = 0; i < 30; i++) stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(s.latched.includes(f), false);       // brak ponownego chwytu
});

test('jeden muskie kosztuje maksymalnie 2 serca, potem znika z łowiska', () => {
  const s = started();
  s.fishQueue = []; s.bossSpawned = true;
  const hookX = 200, hwy = s.depthPx + HOOK_Y;
  const f = { type: 'twardziel', x: hookX, y: hwy, hp: 9999, hpMax: 9999, state: 'aggro', dir: 1, bubbleY: 0 };
  s.fish.push(f);
  let safety = 0;
  while (s.fish.includes(f) && s.mode === 'DESCENT' && safety++ < 20000) stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(s.fish.includes(f), false);          // muskie zniknął
  assert.ok(s.lives >= 1);                           // NIE odebrał 3. serca
  assert.equal(s.mode, 'DESCENT');
});

test('durability: słaba ryba (atk<=dur) NIE drenuje paska ani żyć', () => {
  const s = started();
  s.fishQueue = []; s.bossSpawned = true;
  const hookX = 200, hwy = s.depthPx + HOOK_Y;
  const dur0 = s.durability;
  s.fish.push({ type: 'sredniak', x: hookX, y: hwy, hp: 9999, hpMax: 9999, state: 'aggro', dir: 1, bubbleY: 0 });
  for (let i = 0; i < 120; i++) stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(s.durability, dur0);    // sum atk2 <= dur6 -> zero drenażu
  assert.equal(s.lives, 3);
  assert.equal(s.durDraining, false);  // flaga wraca do false (wskaźnik nie zostaje podświetlony)
});

test('balans: muskie na stage 1 (tylko brąz) ucieka - niełowialny nawet przy pościgu', () => {
  const s = started();                              // brąz: atk 4, dur 6
  s.fishQueue = []; s.bossSpawned = true;
  const hookX = 200;
  const muskie = createFish('twardziel', 0, hookX, () => 0.5); // hp stałe 32
  muskie.y = s.depthPx + HOOK_Y; muskie.x = hookX; muskie.state = 'aggro';
  s.fish.push(muskie);
  let safety = 0;
  while (s.fish.includes(muskie) && s.mode === 'DESCENT' && safety++ < 6000) {
    stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
    chase(s, muskie, hookX);
  }
  assert.equal(s.stunned, 0);                       // NIE złowiony (2 zaczepy < hp32)
  assert.ok(s.lives <= 1);                          // pościg = 2 zerwania = 2 serca
});

test('balans: muskie na stage 2 (kotwica) łowialny kosztem 1 serca', () => {
  const s = createGame(); placeHook(s, 0, 0); placeAccessory(s, 'bronze');
  s.progress.inventory.anchor = 1; s.progress.tutAnchorDone = true; placeAccessory(s, 'anchor'); // atk6, bez dur
  startStage(s);                                    // przelicza hak
  s.fishQueue = []; s.bossSpawned = true;
  const hookX = 200;
  const muskie = createFish('twardziel', 0, hookX, () => 0.5);
  muskie.y = s.depthPx + HOOK_Y; muskie.x = hookX; muskie.state = 'aggro';
  s.fish.push(muskie);
  let safety = 0;
  while (s.fish.includes(muskie) && s.mode === 'DESCENT' && safety++ < 6000) {
    stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
    chase(s, muskie, hookX);
  }
  assert.equal(s.stunned, 1);                       // złowiony (2 zaczepy: 42.9 >= hp32)
  assert.equal(s.lives, 2);                         // dokładnie 1 stracone serce
});

test('balans: muskie z Odważnikiem (stage 4) łowialny bez utraty serca', () => {
  const s = createGame(); placeHook(s, 0, 0); placeAccessory(s, 'bronze');
  s.progress.inventory.anchor = 1; s.progress.tutAnchorDone = true; placeAccessory(s, 'anchor');
  s.progress.inventory.weight = 1; placeAccessory(s, 'weight'); // dur 8
  startStage(s);
  s.fishQueue = []; s.bossSpawned = true;
  const hookX = 200;
  const muskie = createFish('twardziel', 0, hookX, () => 0.5);
  muskie.y = s.depthPx + HOOK_Y; muskie.x = hookX; muskie.state = 'aggro';
  s.fish.push(muskie);
  let safety = 0;
  while (s.stunned === 0 && s.mode === 'DESCENT' && safety++ < 3000) stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(s.stunned, 1);                       // złowiony w jednym pasku
  assert.equal(s.lives, 3);                         // bez utraty serca
});

test('stage kończy się po descentM gdy ryby wypłyną górą (nie od razu przy dnie)', () => {
  const s = started();
  s.descentM = 5;                                   // krótkie opadanie
  s.bossCount = 0; s.bossSpawned = true;            // izolacja od fali bossa
  s.fishQueue = ['plotka', 'plotka', 'plotka'];     // worek NADAL pełny
  const straggler = { type: 'plotka', x: 200, y: s.depthPx + 300, hp: 9999, hpMax: 9999, state: 'patrol', dir: 1, bubbleY: 0 };
  s.fish.push(straggler);                            // niezłowiona ryba na ekranie
  let safety = 0, endedAtDepth = -1;
  while (s.mode === 'DESCENT' && safety++ < 8000) {
    stepDescent(s, 200, HOOK_Y, 1 / 60, () => 0.5);
    if (endedAtDepth < 0 && s.fish.length === 0) endedAtDepth = s.depthPx / WORLD.pxPerMeter; // moment opróżnienia łowiska
  }
  assert.equal(s.mode, 'END');
  assert.ok(s.depthPx / WORLD.pxPerMeter >= 5);     // dobił do dna
  assert.ok(endedAtDepth >= 5);                      // łowisko opróżniło się DOPIERO przy/za dnem (nie wcześniej)
});

test('pusty worek NIE kończy stage przedwcześnie (trwa do descentM)', () => {
  const s = started();
  s.descentM = 4;
  s.fishQueue = []; s.bossSpawned = true; s.fish = []; s.latched = [];     // brak ryb od startu
  let safety = 0;
  while (s.mode === 'DESCENT' && safety++ < 5000) stepDescent(s, 200, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(s.mode, 'END');
  assert.ok(s.depthPx / WORLD.pxPerMeter >= 4);      // skończył się DOPIERO po głębokości
});

test('boss (muskie) spawnuje się SAM po opróżnieniu worka regularnego + cisza (nie w grupie)', () => {
  const s = started();
  s.descentM = 999;                          // nie kończymy stage przez głębokość w tym teście
  s.fish = []; s.latched = [];
  s.fishQueue = ['plotka', 'plotka'];        // mały worek regularny
  s.bossCount = 1; s.bossSpawned = false; s.bossLullT = 0;
  const hookX = 200;
  let safety = 0;
  while (!s.bossSpawned && safety++ < 4000) stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(s.bossSpawned, true);
  assert.equal(s.fishQueue.length, 0);                     // boss dopiero po opróżnieniu worka
  assert.ok(s.fish.some(f => f.type === 'twardziel'));     // muskie wpłynął jako fala bossa (na końcu)
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
