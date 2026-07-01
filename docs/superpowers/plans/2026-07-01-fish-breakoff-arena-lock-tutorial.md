# Zerwanie żyłki + blokada aren + fix tutoriala — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ryba niedobita w obrębie jednego paska wytrzymałości zrywa się z haka i ucieka (max 1 ponowny chwyt), stage 1 staje się grywalny do końca; nawigacja zablokowana do areny 1; tutorial kotwicy zawsze wymusza ruch obok haka.

**Architecture:** Czysta logika w `src/logic/` + `src/sim.js` + `src/state.js`, testowana `node --test` bez DOM. Render (`render.js`) tylko dla wizualnego wygaszenia strzałek aren. Wszystkie stałe tuningowe w `src/config.js`.

**Tech Stack:** Vanilla JS (ES modules), `node:test` + `node:assert/strict`, brak build-stepu.

## Global Constraints

- Bez nowych zależności (vanilla JS, ES modules).
- Wszystkie liczby tuningowe w `src/config.js`.
- Testy: `npm test` (uruchamia `node --test` na `tests/`), Node 18+.
- Styl testów: `import { test } from 'node:test'` + `assert from 'node:assert/strict'` (jak w istniejących plikach).
- Nie commituj bez zgody użytkownika (reguła projektu) — kroki „Commit" wykonuje operator po akceptacji.
- Muskie = `twardziel` (atk 10). Brąz: dur 6, atk haka 4. `durabilityMax = s.hook.dur`.

---

## Task 1: Zerwanie żyłki — break-off, odnowa paska, escaped

**Files:**
- Modify: `src/config.js` (nowe stałe)
- Modify: `src/sim.js` (helper `breakOff`, zmiana bloku drenażu, odnowa paska przy złowieniu, re-latch stanu `escaped`)
- Modify: `src/fish.js` (ruch ryby `escaped`, malejący `recatchLock`)
- Modify: `tests/sim.test.js` (zastąp stary test muskie, dodaj nowe)

**Interfaces:**
- Consumes: `stepDescent(s, hookX, hookScreenY, dt, rng)`, `FISH_TYPES`, `DRAIN_K`, `registerEscape`, `registerStun` (istniejące).
- Produces:
  - `config.RECATCH_LIMIT: number`, `config.RECATCH_LOCK: number`, `config.ESCAPE_SPEED_SLOW: number`, `config.ESCAPE_SPEED_FAST: number`
  - Pola ryby po zerwaniu: `state: 'escaped'`, `breakoffs: number`, `recatchLeft: number`, `recatchLock: number`, `escapeFast: boolean`

- [ ] **Step 1: Dodaj stałe do `src/config.js`**

Wstaw po `export const GRAB_DELAY = 0.15;` (linia ~54):

```js
// Zerwanie żyłki: ryba drenująca pasek, której nie dobito w obrębie JEDNEGO paska, odpada z haka
// (state 'escaped') i ucieka. Można ją zaczepić RECATCH_LIMIT razy ponownie; potem ucieka szybko.
export const RECATCH_LIMIT = 1;        // ile razy odpiętą rybę można zaczepić ponownie
export const RECATCH_LOCK = 0.8;       // s bufora po zerwaniu zanim ryba może znów się zaczepić
export const ESCAPE_SPEED_SLOW = 35;   // px/s ucieczki po 1. zerwaniu (świat, ku powierzchni)
export const ESCAPE_SPEED_FAST = 160;  // px/s ucieczki po 2. zerwaniu (bez re-latchu)
```

- [ ] **Step 2: Zastąp stary test muskie i dodaj testy break-off/odnowy w `tests/sim.test.js`**

USUŃ test zaczynający się od `'durability: muskie (atk>dur) zdziera pasek -> 3 serca -> game over...'` (linie ~74-84). Wstaw w jego miejsce:

```js
test('durability: muskie zrywa się po jednym pasku -> -1 serce, ryba escaped z zachowanym HP', () => {
  const s = started();                 // brąz: dur 6, atk haka 4
  s.fishQueue = [];
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
  s.fishQueue = [];
  const hookX = 200, hwy = s.depthPx + HOOK_Y;
  s.durability = s.durabilityMax - 1;             // pasek nadszarpnięty
  s.fish.push({ type: 'twardziel', x: hookX, y: hwy, hp: 2, hpMax: 48, state: 'aggro', dir: 1, bubbleY: 0 });
  let safety = 0;
  while (s.stunned === 0 && safety++ < 200) stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(s.stunned, 1);                     // złowiony (hp 2, atk 4)
  assert.equal(s.lives, 3);                       // bez utraty serca
  assert.equal(s.durability, s.durabilityMax);    // pasek odnowiony do maksa
});
```

- [ ] **Step 3: Uruchom testy — mają NIE przejść**

Run: `npm test`
Expected: FAIL — `muskie zrywa się...` (dziś ryba wisi dalej, lives→0), `dobicie drenującej...` (dziś brak odnowy paska).

- [ ] **Step 4: Zaimplementuj break-off i odnowę w `src/sim.js`**

4a. Rozszerz import z config (linia 2) o nowe stałe:

```js
import { WORLD, FISH_TYPES, STAGES, ROCKET_FLIGHT, DRAIN_K, GRAB_DELAY, RECATCH_LIMIT, RECATCH_LOCK } from './config.js';
```

4b. Dodaj helper obok `removeFish` (po linii ~14):

```js
// Zrywa rybę z haka: usuwa z latched, oznacza jako escaped. Pierwsze zerwanie -> wolna ucieczka +
// jednorazowy re-latch (po buforze); kolejne -> szybka ucieczka bez możliwości ponownego chwytu.
function breakOff(s, f) {
  const li = s.latched.indexOf(f);
  if (li >= 0) s.latched.splice(li, 1);
  f.breakoffs = (f.breakoffs || 0) + 1;
  f.state = 'escaped';
  if (f.breakoffs > RECATCH_LIMIT) {
    f.recatchLeft = 0; f.escapeFast = true; f.recatchLock = 0;
  } else {
    f.recatchLeft = RECATCH_LIMIT - f.breakoffs + 1; f.escapeFast = false; f.recatchLock = RECATCH_LOCK;
  }
}
```

4c. W pętli latch/dmg (dziś ~76-80) odnów pasek gdy DRENUJĄCA ryba zostanie dobita. Zastąp blok:

```js
    if (tickLatch(f, s.hook.atk, dt) === 'stunned') {
      registerStun(s, FISH_TYPES[f.type]);
      f.bubbleY = f.y; s.bubbles.push(f);
      removeFish(s, f); s.latched.splice(li, 1);
    }
```

na:

```js
    if (tickLatch(f, s.hook.atk, dt) === 'stunned') {
      const straining = (FISH_TYPES[f.type].atk || 0) > s.hook.dur;
      registerStun(s, FISH_TYPES[f.type]);
      f.bubbleY = f.y; s.bubbles.push(f);
      removeFish(s, f); s.latched.splice(li, 1);
      if (straining && s.mode === 'DESCENT') s.durability = s.durabilityMax; // odnowa po złowieniu drenującej
    }
```

4d. Zmień blok wytrzymałości (dziś ~91-97). Zastąp:

```js
  if (drain > 0) {
    s.durability -= drain * dt;
    if (s.durability <= 0) {
      registerEscape(s);                                       // −1 serce (może zakończyć grę)
      if (s.mode === 'DESCENT') s.durability = s.durabilityMax; // odnów pasek, walcz dalej
    }
  }
```

na:

```js
  if (drain > 0) {
    s.durability -= drain * dt;
    if (s.durability <= 0) {
      // najsilniejsza drenująca ryba odpada z haka (zerwanie żyłki)
      let victim = null, best = -Infinity;
      for (const f of s.latched) {
        const A = FISH_TYPES[f.type].atk || 0;
        if (A > s.hook.dur && A > best) { best = A; victim = f; }
      }
      registerEscape(s);                                       // −1 serce (może zakończyć grę)
      if (s.mode === 'DESCENT') s.durability = s.durabilityMax; // odnów pasek
      if (victim) breakOff(s, victim);                          // ryba odpada i ucieka
    }
  }
```

4e. W detekcji kontaktu (dziś ~101-108) dopuść re-latch ryby `escaped`. Zastąp warunek:

```js
    if (s.latched.length < s.hook.maxLatch && (f.state === 'patrol' || f.state === 'aggro') && s.latched.indexOf(f) < 0) {
```

na:

```js
    const canLatch = (f.state === 'patrol' || f.state === 'aggro') ||
                     (f.state === 'escaped' && f.recatchLeft > 0 && (f.recatchLock || 0) <= 0);
    if (s.latched.length < s.hook.maxLatch && canLatch && s.latched.indexOf(f) < 0) {
```

- [ ] **Step 5: Zaimplementuj ruch ryby `escaped` w `src/fish.js`**

5a. Rozszerz import (linia 1):

```js
import { FISH_TYPES, WORLD, ESCAPE_SPEED_SLOW, ESCAPE_SPEED_FAST } from './config.js';
```

5b. Zastąp pierwszą linię ciała `updateFish` (dziś: `if (fish.state === 'stunned' || fish.state === 'escaped' || fish.state === 'latched') return;`) na:

```js
  if (fish.state === 'stunned' || fish.state === 'latched') return;
  if (fish.state === 'escaped') {
    if (fish.recatchLock > 0) fish.recatchLock -= dt;
    const sp = fish.escapeFast ? ESCAPE_SPEED_FAST : ESCAPE_SPEED_SLOW;
    fish.y -= sp * dt;                                    // ku powierzchni (świat y maleje -> znika górą)
    fish.x += (fish.x < hookX ? -1 : 1) * sp * 0.4 * dt;  // lekki dryf od haka
    fish.x = Math.max(WORLD.hookMinX - EDGE_MARGIN, Math.min(WORLD.hookMaxX + EDGE_MARGIN, fish.x));
    return;
  }
```

(Re-latch: `startLatch` w `combat.js` ustawia `state='latched'` — HP i `breakoffs` NIE są resetowane, więc ryba kontynuuje od swojego HP. Bez zmian w `combat.js`.)

- [ ] **Step 6: Uruchom testy z kroku 2 — mają przejść**

Run: `npm test`
Expected: PASS dla obu nowych testów.

- [ ] **Step 7: Dodaj testy re-latch / szybkiej ucieczki / capu 2 serc w `tests/sim.test.js`**

```js
test('zerwana ryba re-latchuje raz na kontakt i kontynuuje od swojego HP', () => {
  const s = started();
  s.fishQueue = [];
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
  s.fishQueue = [];
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
  s.fishQueue = [];
  const hookX = 200, hwy = s.depthPx + HOOK_Y;
  const f = { type: 'twardziel', x: hookX, y: hwy, hp: 9999, hpMax: 9999, state: 'aggro', dir: 1, bubbleY: 0 };
  s.fish.push(f);
  let safety = 0;
  while (s.fish.includes(f) && s.mode === 'DESCENT' && safety++ < 20000) stepDescent(s, hookX, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(s.fish.includes(f), false);          // muskie zniknął
  assert.ok(s.lives >= 1);                           // NIE odebrał 3. serca
  assert.equal(s.mode, 'DESCENT');
});
```

- [ ] **Step 8: Uruchom cały pakiet — wszystko zielone**

Run: `npm test`
Expected: PASS wszystkie (nowe + istniejące). Jeśli `three tough fish that escape end the descent at END` się wywali — przeanalizuj i dostosuj (nowa mechanika: ryba może się zerwać max 2×; 3 różne ryby wciąż dają 3 zerwania → END).

- [ ] **Step 9: Commit (po akceptacji operatora)**

```bash
git add src/config.js src/sim.js src/fish.js tests/sim.test.js
git commit -m "feat: zerwanie zylki - ryba niedobita odpada z haka i ucieka (max 1 re-chwyt)"
```

---

## Task 2: Blokada aren 2+ i brak zawijania

**Files:**
- Modify: `src/config.js` (`AVAILABLE_ARENAS`, `PLAYABLE_STAGES`)
- Modify: `src/state.js` (`carouselMove`, `arenaMove`, `selectStageIndex`, `finishDescent`, `returnHome`)
- Modify: `src/render.js` (wygaszenie strzałki areny w prawo)
- Modify: `tests/state.test.js` (aktualizacja testu clamp + nowe testy)

**Interfaces:**
- Consumes: `STAGES_PER_ARENA`, `arenaOf`, `localOf` (istniejące).
- Produces: `config.AVAILABLE_ARENAS: number`, `config.PLAYABLE_STAGES: number`.

- [ ] **Step 1: Dodaj stałe do `src/config.js`**

Wstaw zaraz po `export const ARENA_COUNT = ARENAS.length;` (linia ~237):

```js
// Ile aren jest realnie dostępnych (mają content). Reszta zablokowana w nawigacji.
// Zwiększ, gdy dojdą areny 2/3. PLAYABLE_STAGES = górna granica nawigacji/odblokowań.
export const AVAILABLE_ARENAS = 1;
export const PLAYABLE_STAGES = AVAILABLE_ARENAS * STAGES_PER_ARENA;
```

- [ ] **Step 2: Zaktualizuj istniejący test clamp i dodaj nowe w `tests/state.test.js`**

2a. Rozszerz import z config (linia 8):

```js
import { STARTER_HOOK, FISH_TYPES, WORLD, STAGES, STAGES_PER_ARENA, PLAYABLE_STAGES } from '../src/config.js';
```

2b. Rozszerz import z state.js (linie 3-7) o `arenaMove, selectStageIndex`:

```js
import {
  createGame, placeHook, startStage, addDepth, registerStun, registerEscape,
  carouselMove, arenaMove, selectStageIndex, openBackpack, closeBackpack, stageUnlocked, descentCleared,
  openChest, placeAccessory, moveItem, computeHookStats, loginGuest, returnHome,
} from '../src/state.js';
```

2c. ZASTĄP test `'carouselMove clamps to stage range'` na:

```js
test('carouselMove clampuje do grywalnej areny 1 (0..9)', () => {
  const s = createGame();
  carouselMove(s, -1); assert.equal(s.stageIndex, 0);
  for (let i = 0; i < 50; i++) carouselMove(s, 1);
  assert.equal(s.stageIndex, PLAYABLE_STAGES - 1);   // 9, nie STAGES.length-1
});
```

2d. DODAJ nowe testy:

```js
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
```

- [ ] **Step 3: Uruchom testy — nowe/zmienione mają NIE przejść**

Run: `npm test`
Expected: FAIL — clamp dziś do 29, `arenaMove` dziś wchodzi na arenę 2, `selectStageIndex` do 29, stage 10 dziś odblokowuje 11.

- [ ] **Step 4: Zaimplementuj clampy w `src/state.js`**

4a. Rozszerz import z config (linia 1) o `AVAILABLE_ARENAS, PLAYABLE_STAGES`:

```js
import { STARTER_HOOK, ITEMS, BACKPACK, WORLD, STAGES, CHEST_SC, ARENA_COUNT, STAGES_PER_ARENA, AVAILABLE_ARENAS, PLAYABLE_STAGES, arenaOf, localOf, tackleboxOf } from './config.js';
```

4b. `carouselMove` — zastąp `STAGES.length - 1` na `PLAYABLE_STAGES - 1`:

```js
export function carouselMove(s, dir) {
  s.stageIndex = Math.max(0, Math.min(PLAYABLE_STAGES - 1, s.stageIndex + dir));
}
```

4c. `arenaMove` — clamp areny do `AVAILABLE_ARENAS - 1`:

```js
export function arenaMove(s, dir) {
  const arena = Math.max(0, Math.min(AVAILABLE_ARENAS - 1, arenaOf(s.stageIndex) + dir));
  s.stageIndex = arena * STAGES_PER_ARENA + localOf(s.stageIndex);
}
```

4d. `selectStageIndex` — zastąp `STAGES.length - 1` na `PLAYABLE_STAGES - 1`:

```js
export function selectStageIndex(s, idx) {
  s.stageIndex = Math.max(0, Math.min(PLAYABLE_STAGES - 1, idx));
}
```

4e. `finishDescent` — w bloku odblokowania (dziś: `if (s.stars >= 1 && next < STAGES.length && !s.progress.stages[next].unlocked)`) zmień `next < STAGES.length` na `next < PLAYABLE_STAGES`:

```js
    const next = s.stageIndex + 1;
    if (s.stars >= 1 && next < PLAYABLE_STAGES && !s.progress.stages[next].unlocked) {
      s.progress.stages[next].unlocked = true; newUnlock = true;
    }
```

4f. `returnHome` — zmień `next < STAGES.length` na `next < PLAYABLE_STAGES`:

```js
  if (s.lastResult && s.lastResult.cleared) {
    const next = s.stageIndex + 1;
    if (next < PLAYABLE_STAGES && stageUnlocked(s, next)) s.stageIndex = next;
  }
```

- [ ] **Step 5: Uruchom testy — mają przejść**

Run: `npm test`
Expected: PASS wszystkie.

- [ ] **Step 6: Wygaś strzałkę zmiany areny w `src/render.js` (polish)**

6a. Rozszerz import z config (linia 1) o `AVAILABLE_ARENAS`.

6b. W `renderHome` (linia ~445) zmień warunek `enabled` prawej strzałki z `arena < ARENA_COUNT - 1` na `arena < AVAILABLE_ARENAS - 1`:

```js
  navArrow(ctx, homeRight.x + ar, arCy, ar, 1, arena < AVAILABLE_ARENAS - 1);
```

(Lewa strzałka `arena > 0` bez zmian — i tak nieaktywna na arenie 0. Przy `AVAILABLE_ARENAS = 1` obie strzałki wygaszone.)

- [ ] **Step 7: Weryfikacja wizualna (manualna)**

Run: `python __serve.py` → otwórz `http://127.0.0.1:8123/` → na Home strzałki zmiany areny wygaszone, nie da się wejść na arenę 2.

- [ ] **Step 8: Commit (po akceptacji operatora)**

```bash
git add src/config.js src/state.js src/render.js tests/state.test.js
git commit -m "feat: blokada aren 2+ i grind stage 10 (bez zawijania)"
```

---

## Task 3: Fix tutoriala kotwicy (wymuszony ruch obok haka)

**Files:**
- Modify: `src/logic/backpack.js` (helper `findFreeRunAvoiding`)
- Modify: `src/state.js` (`placeAccessory` — tutorialowa kotwica z dala od brązu)
- Modify: `tests/state.test.js` (aktualizacja testu maxLatch + nowy test placementu)

**Interfaces:**
- Consumes: `findFreeRun(grid, w)` (istniejący).
- Produces: `findFreeRunAvoiding(grid, w, avoidId): number` — origin pierwszego wolnego ciągu `w` komórek, którego żadna komórka nie sąsiaduje (4-kier.) z `avoidId`; fallback `findFreeRun`.

- [ ] **Step 1: Zaktualizuj test maxLatch i dodaj test placementu w `tests/state.test.js`**

1a. ZASTĄP test `'anchor connected to bronze hook raises maxLatch to 2'` na (dodany `tutAnchorDone = true`):

```js
test('anchor connected to bronze hook raises maxLatch to 2', () => {
  const s = createGame();
  placeAccessory(s, 'bronze');                     // index 0
  s.progress.inventory.anchor = 1;
  s.progress.tutAnchorDone = true;                 // po tutorialu: auto-placement w pierwszy wolny (obok)
  assert.equal(placeAccessory(s, 'anchor'), true); // index 1, sąsiaduje z brązem
  assert.equal(s.hook.maxLatch, 2);
});
```

1b. DODAJ nowy test:

```js
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
```

- [ ] **Step 2: Uruchom testy — mają NIE przejść**

Run: `npm test`
Expected: FAIL — `tutorialowa kotwica...` (dziś kotwica trafia w idx 1, obok brązu → maxLatch 2); `anchor connected...` przejdzie już z flagą, ale bez helpera import się nie wysypie dopóki nie użyty. Kluczowy FAIL: nowy test placementu.

- [ ] **Step 3: Dodaj helper `findFreeRunAvoiding` w `src/logic/backpack.js`**

Wstaw na końcu pliku:

```js
// Origin pierwszego wolnego ciągu `w` komórek, którego ŻADNA komórka nie sąsiaduje (4-kier.)
// z komórką zawierającą `avoidId`. Fallback do findFreeRun, gdy taki ciąg nie istnieje.
export function findFreeRunAvoiding(grid, w, avoidId) {
  const { cells, cols, rows } = grid;
  const adjToAvoid = (idx) => {
    const r = Math.floor(idx / cols), c = idx % cols, nb = [];
    if (r > 0) nb.push(idx - cols); if (r < rows - 1) nb.push(idx + cols);
    if (c > 0) nb.push(idx - 1); if (c < cols - 1) nb.push(idx + 1);
    return nb.some(n => cells[n] === avoidId);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c + w <= cols; c++) {
      let ok = true;
      for (let k = 0; k < w; k++) {
        const idx = r * cols + c + k;
        if (cells[idx] !== null || adjToAvoid(idx)) { ok = false; break; }
      }
      if (ok) return r * cols + c;
    }
  }
  return findFreeRun(grid, w);
}
```

- [ ] **Step 4: Użyj helpera w `placeAccessory` (`src/state.js`)**

4a. Rozszerz import z backpack (linia 2) o `findFreeRunAvoiding`:

```js
import { createGrid, placeItem, findFreeRun, findFreeRunAvoiding, itemOrigin, gridItems } from './logic/backpack.js';
```

4b. W `placeAccessory` zastąp linię `const idx = findFreeRun(s.grid, w);` na:

```js
  const idx = (itemId === 'anchor' && !s.progress.tutAnchorDone)
    ? findFreeRunAvoiding(s.grid, w, 'bronze')   // tutorial: kotwica z dala od haka -> gracz musi przeciągnąć
    : findFreeRun(s.grid, w);
```

- [ ] **Step 5: Uruchom testy — mają przejść**

Run: `npm test`
Expected: PASS wszystkie (46+ nowych).

- [ ] **Step 6: Weryfikacja wizualna tutoriala (manualna)**

Run: `python __serve.py` → nowa gra (localStorage czysty) → przejdź tutorial brązu → zalicz stage 1 z ≥1★ → otwórz skrzynię (kotwica) → w plecaku „Tap, by włożyć Kotwicę": kotwica ląduje z dala od haka, tutorial pokazuje „Przeciągnij Kotwicę obok Brązowego haka".

- [ ] **Step 7: Commit (po akceptacji operatora)**

```bash
git add src/logic/backpack.js src/state.js tests/state.test.js
git commit -m "fix: tutorialowa kotwica laduje z dala od haka (wymusza polaczenie)"
```

---

## Self-Review

**Spec coverage:**
- A (zerwanie żyłki, dobicie=odnowa, zerwanie=−1 serce+ucieczka, re-catch 1×, fast flee, cap 2 serca) → Task 1 (Steps 1-9). ✓
- B (AVAILABLE_ARENAS/PLAYABLE_STAGES, clampy carousel/arena/select, unlock+returnHome bez zawijania, wygaszenie strzałki) → Task 2. ✓
- C (findFreeRunAvoiding + placeAccessory tutorialowej kotwicy) → Task 3. ✓
- Edge case „kilka drenujących naraz" → obsłużony (najsilniejsza victim w Step 4d). ✓

**Placeholder scan:** brak TBD/TODO; każdy krok ma realny kod i komendy. ✓

**Type consistency:** `breakOff`, pola `breakoffs/recatchLeft/recatchLock/escapeFast` spójne między sim.js (zapis) a fish.js/sim.js (odczyt). `PLAYABLE_STAGES`/`AVAILABLE_ARENAS` spójne config↔state↔render. `findFreeRunAvoiding(grid, w, avoidId)` spójny backpack↔state. ✓

**Ryzyko regresji:** istniejący test `three tough fish that escape end the descent at END` (sim.test) — nowa mechanika wciąż daje 3 zerwania z 3 różnych ryb → END/lives 0; jeśli się wywali, dostosuj w Task 1 Step 8.
