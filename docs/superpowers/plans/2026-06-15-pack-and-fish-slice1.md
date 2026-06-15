# Pack&Fish — Plaster 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudować grywalny plaster 1 Pack&Fish — mini-plecak (tutorial: włóż startowy hak) → top-down opadający descent z zaczepianiem ryb, oknem czasowym, 3 życiami i ekranem wyniku z 0–3 gwiazdkami.

**Architecture:** Vanilla JS + HTML5 canvas, bez build-stepu. Czysta logika (scoring, rampa trudności, combat, spawn, grid plecaka, maszyna stanu) wydzielona do ES-modułów w `src/logic/` i `src/state.js` — testowana jednostkowo wbudowanym `node:test`. Warstwa IO/render/feel (canvas, input, pętla) w osobnych modułach, weryfikowana ręcznie w przeglądarce. Wszystko data-driven przez `src/config.js`, żeby plaster 2 (plecak, akcesoria) tylko dokładał itemy i modyfikował staty.

**Tech Stack:** ES modules, HTML5 Canvas 2D, `node:test` + `node:assert` (zero zależności), Live Server do podglądu.

**Spec:** `docs/superpowers/specs/2026-06-15-pack-and-fish-slice1-design.md`

---

## File Structure

**Create:**
- `package.json` — `"type": "module"` + skrypt testów
- `src/config.js` — stałe świata, `STARTER_HOOK` (item), `FISH_TYPES`, `RAMP`, `SCORE` (z sufitem depth), `STARS`, `BACKPACK`
- `src/logic/scoring.js` — `computeScore`, `computeStars`
- `src/logic/ramp.js` — `difficultyAt(depthMeters)`
- `src/logic/combat.js` — `startLatch`, `tickLatch`
- `src/logic/spawn.js` — `pickFishType`, `createFish`
- `src/logic/backpack.js` — model gridu: `createGrid`, `canPlace`, `placeItem`
- `src/state.js` — maszyna stanu gry + akcje
- `src/fish.js` — AI/update ryb (patrol/aggro/dopływ)
- `src/input.js` — drag-drop w plecaku + drag L/P w descentcie
- `src/render.js` — warstwy rysowania
- `src/main.js` — wiring: pętla rAF, dt, podpięcie input/state/render
- `tests/scoring.test.js`, `tests/ramp.test.js`, `tests/combat.test.js`, `tests/spawn.test.js`, `tests/backpack.test.js`, `tests/state.test.js`

**Modify:**
- `index.html` — tytuł Pack&Fish, `<script type="module" src="src/main.js">`
- `src/style.css` — tło/centrowanie (kosmetyka)
- `README.md` — opis Pack&Fish + jak uruchomić i testować

**Delete:**
- `src/game.js` — stara logika PaperEmpire (zastąpiona modułami)

**Interfejsy (spójne w całym planie):**

```js
// Item (startowy hak): { id, name, atk (dmg/s), zwrotnosc (px/s), szybkoscOpadania (px/s), w, h }
// FishType:            { id, hp, window (s), speed (px/s), aggroRange (px), radius (px), color, scoreValue }
// Fish (runtime): { type, x, y, hp, hpMax, windowLeft, state:'patrol'|'aggro'|'latched'|'stunned'|'escaped', dir, bubbleY }
// Grid: { cols, rows, cells: Array<itemId|null> }  // index = row*cols + col
// GameState: { mode:'BACKPACK'|'DESCENT'|'END', lives, depthPx, stunned, score, stars, fish:[], latched:Fish|null, grid, hook:Item|null }
```

---

### Task 1: Repo prep — wyczyść PaperEmpire, postaw moduły i test runner

**Files:**
- Delete: `src/game.js`
- Create: `package.json`
- Modify: `index.html`, `src/style.css`, `README.md`

- [ ] **Step 1: Usuń starą logikę**

```bash
git rm src/game.js
```

- [ ] **Step 2: Utwórz `package.json`**

```json
{
  "name": "pack-and-fish",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 3: Przepisz `index.html`**

```html
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pack&amp;Fish</title>
  <link rel="stylesheet" href="src/style.css" />
</head>
<body>
  <main id="app">
    <canvas id="game" width="540" height="720"></canvas>
  </main>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Przepisz `src/style.css`**

```css
html, body { margin: 0; height: 100%; background: #06121f; }
#app { display: flex; align-items: center; justify-content: center; min-height: 100%; }
#game { background: #0a2236; touch-action: none; max-width: 100%; max-height: 100vh; }
```

- [ ] **Step 5: Przepisz `README.md`**

```markdown
# Pack&Fish

Prototyp HTML5 (plaster 1: fishing descent + mini-plecak). Vanilla JS + canvas, bez build-stepu.

## Uruchomienie
Otwórz `index.html` w przeglądarce — albo VS Code **Live Server** (prawy klik → "Open with Live Server") dla hot reload i ES modules.

## Testy logiki
```
npm test
```
(uruchamia `node --test` na `tests/` — wymaga Node 18+)

## Struktura
- `src/config.js` — wszystkie staty/stałe (data-driven)
- `src/logic/` — czysta logika (testowana jednostkowo)
- `src/state.js` — maszyna stanu gry
- `src/fish.js`, `src/input.js`, `src/render.js`, `src/main.js` — warstwa IO/render/feel
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: reset worktree from PaperEmpire to Pack&Fish skeleton"
```

---

### Task 2: `src/config.js` — data-driven staty i stałe

**Files:**
- Create: `src/config.js`

- [ ] **Step 1: Napisz config**

```js
// Wszystkie liczby tuningowe w jednym miejscu. Plaster 2 dokłada itemy i modyfikuje staty.
export const WORLD = {
  W: 540,
  H: 720,
  pxPerMeter: 40,
  hookStartY: 90,        // y ekranowy haka (stały — kamera scrolluje świat)
  hookMinX: 40,
  hookMaxX: 500,
};

// Startowy hak = item w plecaku. Celowo SŁABY (patrz spec: nie stroimy pod "fun solo").
export const STARTER_HOOK = {
  id: 'rusty_hook',
  name: 'Zardzewiały hak',
  atk: 8,                // dmg/s zadawany zaczepionej rybie
  zwrotnosc: 280,        // px/s dryfu L/P
  szybkoscOpadania: 55,  // px/s opadania
  w: 1, h: 1,
};

// 3 archetypy: jedna oś = HP vs okno. scoreValue liczy się przy ogłuszeniu.
export const FISH_TYPES = {
  plotka:    { id: 'plotka',    hp: 6,  window: 2.0, speed: 40, aggroRange: 130, radius: 16, color: '#7fd1ff', scoreValue: 1 },
  sredniak:  { id: 'sredniak',  hp: 14, window: 2.2, speed: 55, aggroRange: 150, radius: 22, color: '#ffd166', scoreValue: 3 },
  twardziel: { id: 'twardziel', hp: 34, window: 2.0, speed: 70, aggroRange: 170, radius: 30, color: '#ef476f', scoreValue: 6 },
};

// Rampa wg głębokości (metry). Wartości interpolowane/progowane w ramp.js.
export const RAMP = {
  baseSpawnInterval: 1.4,   // s między spawnami na starcie
  minSpawnInterval: 0.45,   // sufit gęstości
  spawnTightenPerM: 0.004,  // o ile skraca się interwał na metr
  hpMulPerM: 0.012,         // wzrost HP na metr (mnożnik narasta liniowo od 1)
  speedMulPerM: 0.006,
  // miks archetypów: udział twardzieli/średniaków rośnie z głębokością
  mix: [
    { maxDepth: 8,   weights: { plotka: 1.0, sredniak: 0.0, twardziel: 0.0 } },
    { maxDepth: 20,  weights: { plotka: 0.6, sredniak: 0.4, twardziel: 0.0 } },
    { maxDepth: 40,  weights: { plotka: 0.4, sredniak: 0.4, twardziel: 0.2 } },
    { maxDepth: Infinity, weights: { plotka: 0.25, sredniak: 0.4, twardziel: 0.35 } },
  ],
};

// Score: depth ma SUFIT poniżej progu 1★ — bez łapania ryb nie ma gwiazdek (anti dodge-stall).
export const SCORE = {
  wDepth: 1.0,     // pkt na metr
  wStun: 1.0,      // mnożnik scoreValue ryby
  depthCeil: 60,   // maks. wkład samej głębokości
};

// Progi gwiazdek. T1 > depthCeil (gwarancja: sama głębia < 1★).
export const STARS = { t1: 80, t2: 200, t3: 380 };

export const BACKPACK = {
  cols: 3,
  rows: 3,
  cell: 96,        // px komórki
};
```

- [ ] **Step 2: Commit**

```bash
git add src/config.js
git commit -m "feat(config): data-driven stats for Pack&Fish slice 1"
```

---

### Task 3: `src/logic/scoring.js` — score z sufitem głębokości + gwiazdki

**Files:**
- Create: `src/logic/scoring.js`
- Test: `tests/scoring.test.js`

- [ ] **Step 1: Napisz failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, computeStars } from '../src/logic/scoring.js';
import { SCORE, STARS } from '../src/config.js';

test('depth contributes points but is capped at depthCeil', () => {
  assert.equal(computeScore(30, 0), 30);              // 30m * wDepth=1
  assert.equal(computeScore(1000, 0), SCORE.depthCeil); // capped
});

test('pure depth never reaches 1 star (anti dodge-stall)', () => {
  assert.ok(SCORE.depthCeil < STARS.t1, 'config invariant: depthCeil < t1');
  assert.equal(computeStars(computeScore(1000, 0)), 0);
});

test('stuns add points and unlock stars', () => {
  // 1000m -> depth capped at 60, + stuns
  assert.equal(computeScore(1000, 5), SCORE.depthCeil + 5); // wStun=1, scoreValue passed as units
});

test('computeStars maps thresholds', () => {
  assert.equal(computeStars(STARS.t1 - 1), 0);
  assert.equal(computeStars(STARS.t1), 1);
  assert.equal(computeStars(STARS.t2), 2);
  assert.equal(computeStars(STARS.t3), 3);
});
```

- [ ] **Step 2: Uruchom test — ma FAIL**

Run: `node --test tests/scoring.test.js`
Expected: FAIL — `Cannot find module '../src/logic/scoring.js'`

- [ ] **Step 3: Zaimplementuj**

```js
import { SCORE, STARS } from '../config.js';

// stunnedPoints = suma scoreValue ogłuszonych ryb (wołający podaje już zsumowane jednostki).
export function computeScore(depthMeters, stunnedPoints) {
  const depthPart = Math.min(depthMeters * SCORE.wDepth, SCORE.depthCeil);
  return Math.round(depthPart + stunnedPoints * SCORE.wStun);
}

export function computeStars(score) {
  if (score >= STARS.t3) return 3;
  if (score >= STARS.t2) return 2;
  if (score >= STARS.t1) return 1;
  return 0;
}
```

- [ ] **Step 4: Uruchom test — ma PASS**

Run: `node --test tests/scoring.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/logic/scoring.js tests/scoring.test.js
git commit -m "feat(scoring): depth-capped score + star mapping with TDD"
```

---

### Task 4: `src/logic/ramp.js` — trudność wg głębokości

**Files:**
- Create: `src/logic/ramp.js`
- Test: `tests/ramp.test.js`

- [ ] **Step 1: Napisz failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { difficultyAt } from '../src/logic/ramp.js';

test('spawn interval tightens with depth but never below floor', () => {
  const shallow = difficultyAt(0);
  const deep = difficultyAt(500);
  assert.ok(deep.spawnInterval < shallow.spawnInterval);
  assert.ok(deep.spawnInterval >= 0.45);
});

test('hp and speed multipliers grow monotonically from 1', () => {
  assert.equal(difficultyAt(0).hpMul, 1);
  assert.ok(difficultyAt(50).hpMul > difficultyAt(10).hpMul);
  assert.ok(difficultyAt(50).speedMul > 1);
});

test('mix shifts toward harder fish with depth', () => {
  assert.equal(difficultyAt(0).mix.twardziel, 0);
  assert.ok(difficultyAt(50).mix.twardziel > 0);
});

test('mix weights are returned for all three types', () => {
  const m = difficultyAt(25).mix;
  assert.ok('plotka' in m && 'sredniak' in m && 'twardziel' in m);
});
```

- [ ] **Step 2: Uruchom test — ma FAIL**

Run: `node --test tests/ramp.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Zaimplementuj**

```js
import { RAMP } from '../config.js';

export function difficultyAt(depthMeters) {
  const spawnInterval = Math.max(
    RAMP.minSpawnInterval,
    RAMP.baseSpawnInterval - depthMeters * RAMP.spawnTightenPerM
  );
  const hpMul = 1 + depthMeters * RAMP.hpMulPerM;
  const speedMul = 1 + depthMeters * RAMP.speedMulPerM;
  const band = RAMP.mix.find(b => depthMeters <= b.maxDepth) ?? RAMP.mix[RAMP.mix.length - 1];
  return { spawnInterval, hpMul, speedMul, mix: { ...band.weights } };
}
```

- [ ] **Step 4: Uruchom test — ma PASS**

Run: `node --test tests/ramp.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/logic/ramp.js tests/ramp.test.js
git commit -m "feat(ramp): depth-based difficulty curve with TDD"
```

---

### Task 5: `src/logic/combat.js` — zaczepienie i okno czasowe

**Files:**
- Create: `src/logic/combat.js`
- Test: `tests/combat.test.js`

- [ ] **Step 1: Napisz failing test**

```js
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
```

- [ ] **Step 2: Uruchom test — ma FAIL**

Run: `node --test tests/combat.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Zaimplementuj**

```js
export function startLatch(fish) {
  fish.state = 'latched';
  fish.windowLeft = fish.window;
}

// Zwraca 'ongoing' | 'stunned' | 'escaped'. HP sprawdzane PRZED oknem (remis = stun).
export function tickLatch(fish, atk, dt) {
  fish.hp -= atk * dt;
  fish.windowLeft -= dt;
  if (fish.hp <= 0) { fish.state = 'stunned'; return 'stunned'; }
  if (fish.windowLeft <= 0) { fish.state = 'escaped'; return 'escaped'; }
  return 'ongoing';
}
```

- [ ] **Step 4: Uruchom test — ma PASS**

Run: `node --test tests/combat.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/logic/combat.js tests/combat.test.js
git commit -m "feat(combat): latch + time-window resolution with TDD"
```

---

### Task 6: `src/logic/spawn.js` — wybór i tworzenie ryb

**Files:**
- Create: `src/logic/spawn.js`
- Test: `tests/spawn.test.js`

- [ ] **Step 1: Napisz failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFishType, createFish } from '../src/logic/spawn.js';
import { FISH_TYPES } from '../src/config.js';

test('shallow water only spawns plotka', () => {
  assert.equal(pickFishType(0, () => 0.0), 'plotka');
  assert.equal(pickFishType(0, () => 0.99), 'plotka');
});

test('pickFishType uses rng across weighted mix', () => {
  // at 25m mix ~ plotka .4, sredniak .4, twardziel .2
  assert.equal(pickFishType(25, () => 0.0), 'plotka');
  assert.equal(pickFishType(25, () => 0.5), 'sredniak');
  assert.equal(pickFishType(25, () => 0.95), 'twardziel');
});

test('createFish applies depth hp multiplier and copies type stats', () => {
  const f = createFish('plotka', 0, 100);
  assert.equal(f.hp, FISH_TYPES.plotka.hp);
  assert.equal(f.hpMax, f.hp);
  assert.equal(f.type, 'plotka');
  assert.equal(f.state, 'patrol');
  const deep = createFish('plotka', 100, 100);
  assert.ok(deep.hp > FISH_TYPES.plotka.hp);  // hpMul > 1
});
```

- [ ] **Step 2: Uruchom test — ma FAIL**

Run: `node --test tests/spawn.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Zaimplementuj**

```js
import { FISH_TYPES } from '../config.js';
import { difficultyAt } from './ramp.js';

const ORDER = ['plotka', 'sredniak', 'twardziel'];

export function pickFishType(depthMeters, rng = Math.random) {
  const mix = difficultyAt(depthMeters).mix;
  const total = ORDER.reduce((s, id) => s + (mix[id] || 0), 0) || 1;
  let r = rng() * total;
  for (const id of ORDER) {
    r -= (mix[id] || 0);
    if (r < 0) return id;
  }
  return ORDER[0];
}

export function createFish(typeId, depthMeters, x) {
  const t = FISH_TYPES[typeId];
  const hp = Math.round(t.hp * difficultyAt(depthMeters).hpMul);
  return {
    type: typeId, x, y: 0, hp, hpMax: hp, window: t.window, windowLeft: 0,
    state: 'patrol', dir: x < 270 ? 1 : -1, bubbleY: 0,
  };
}
```

- [ ] **Step 4: Uruchom test — ma PASS**

Run: `node --test tests/spawn.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/logic/spawn.js tests/spawn.test.js
git commit -m "feat(spawn): weighted fish selection + depth-scaled creation with TDD"
```

---

### Task 7: `src/logic/backpack.js` — model gridu plecaka

**Files:**
- Create: `src/logic/backpack.js`
- Test: `tests/backpack.test.js`

- [ ] **Step 1: Napisz failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, canPlace, placeItem } from '../src/logic/backpack.js';

test('createGrid makes an empty cols*rows grid', () => {
  const g = createGrid(3, 3);
  assert.equal(g.cols, 3);
  assert.equal(g.cells.length, 9);
  assert.ok(g.cells.every(c => c === null));
});

test('canPlace true on empty cell in bounds, false out of bounds', () => {
  const g = createGrid(3, 3);
  assert.equal(canPlace(g, 0, 0), true);
  assert.equal(canPlace(g, 3, 0), false);
  assert.equal(canPlace(g, -1, 0), false);
});

test('placeItem fills the cell and blocks reuse', () => {
  const g = createGrid(3, 3);
  assert.equal(placeItem(g, 'rusty_hook', 1, 1), true);
  assert.equal(g.cells[1 * 3 + 1], 'rusty_hook');
  assert.equal(canPlace(g, 1, 1), false);
  assert.equal(placeItem(g, 'other', 1, 1), false);
});
```

- [ ] **Step 2: Uruchom test — ma FAIL**

Run: `node --test tests/backpack.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Zaimplementuj**

```js
// Plaster 1: itemy 1x1, brak adjacency. Plaster 2 rozszerzy o kształty/relacje.
export function createGrid(cols, rows) {
  return { cols, rows, cells: new Array(cols * rows).fill(null) };
}

export function canPlace(grid, col, row) {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return false;
  return grid.cells[row * grid.cols + col] === null;
}

export function placeItem(grid, itemId, col, row) {
  if (!canPlace(grid, col, row)) return false;
  grid.cells[row * grid.cols + col] = itemId;
  return true;
}
```

- [ ] **Step 4: Uruchom test — ma PASS**

Run: `node --test tests/backpack.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/logic/backpack.js tests/backpack.test.js
git commit -m "feat(backpack): grid model for tutorial placement with TDD"
```

---

### Task 8: `src/state.js` — maszyna stanu gry

**Files:**
- Create: `src/state.js`
- Test: `tests/state.test.js`

- [ ] **Step 1: Napisz failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, placeHook, startDescent, addDepth, registerStun, registerEscape } from '../src/state.js';
import { STARTER_HOOK, FISH_TYPES, WORLD } from '../src/config.js';

test('new game starts in BACKPACK mode with 3 lives and no hook', () => {
  const s = createGame();
  assert.equal(s.mode, 'BACKPACK');
  assert.equal(s.lives, 3);
  assert.equal(s.hook, null);
});

test('placeHook puts starter hook into grid and equips it', () => {
  const s = createGame();
  assert.equal(placeHook(s, 1, 1), true);
  assert.equal(s.hook.id, STARTER_HOOK.id);
  assert.equal(s.grid.cells[1 * 3 + 1], STARTER_HOOK.id);
});

test('startDescent only works after hook placed', () => {
  const s = createGame();
  assert.equal(startDescent(s), false);
  placeHook(s, 0, 0);
  assert.equal(startDescent(s), true);
  assert.equal(s.mode, 'DESCENT');
});

test('addDepth accrues meters and updates score', () => {
  const s = createGame(); placeHook(s, 0, 0); startDescent(s);
  addDepth(s, WORLD.pxPerMeter * 10); // 10 m worth of px
  assert.equal(Math.round(s.depthPx / WORLD.pxPerMeter), 10);
  assert.ok(s.score >= 10);
});

test('registerStun adds scoreValue points and counts fish', () => {
  const s = createGame(); placeHook(s, 0, 0); startDescent(s);
  registerStun(s, FISH_TYPES.sredniak);
  assert.equal(s.stunned, 1);
  assert.ok(s.score >= FISH_TYPES.sredniak.scoreValue);
});

test('three escapes end the descent and compute stars', () => {
  const s = createGame(); placeHook(s, 0, 0); startDescent(s);
  registerEscape(s); registerEscape(s);
  assert.equal(s.mode, 'DESCENT');
  registerEscape(s);
  assert.equal(s.mode, 'END');
  assert.equal(s.lives, 0);
  assert.equal(typeof s.stars, 'number');
});
```

- [ ] **Step 2: Uruchom test — ma FAIL**

Run: `node --test tests/state.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Zaimplementuj**

```js
import { STARTER_HOOK, BACKPACK, WORLD } from './config.js';
import { createGrid, placeItem } from './logic/backpack.js';
import { computeScore, computeStars } from './logic/scoring.js';

export function createGame() {
  return {
    mode: 'BACKPACK',
    lives: 3,
    depthPx: 0,
    stunned: 0,
    stunnedPoints: 0,
    score: 0,
    stars: 0,
    fish: [],
    latched: null,
    grid: createGrid(BACKPACK.cols, BACKPACK.rows),
    hook: null,
  };
}

function recompute(s) {
  s.score = computeScore(s.depthPx / WORLD.pxPerMeter, s.stunnedPoints);
}

export function placeHook(s, col, row) {
  if (s.hook) return false;
  if (!placeItem(s.grid, STARTER_HOOK.id, col, row)) return false;
  s.hook = { ...STARTER_HOOK };
  return true;
}

export function startDescent(s) {
  if (!s.hook || s.mode !== 'BACKPACK') return false;
  s.mode = 'DESCENT';
  return true;
}

export function addDepth(s, deltaPx) {
  if (s.mode !== 'DESCENT') return;
  s.depthPx += deltaPx;
  recompute(s);
}

export function registerStun(s, fishType) {
  s.stunned += 1;
  s.stunnedPoints += fishType.scoreValue;
  recompute(s);
}

export function registerEscape(s) {
  s.lives -= 1;
  if (s.lives <= 0) {
    s.lives = 0;
    s.mode = 'END';
    recompute(s);
    s.stars = computeStars(s.score);
  }
}
```

- [ ] **Step 4: Uruchom test — ma PASS**

Run: `node --test tests/state.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Uruchom pełny zestaw**

Run: `npm test`
Expected: PASS — wszystkie pliki (scoring, ramp, combat, spawn, backpack, state)

- [ ] **Step 6: Commit**

```bash
git add src/state.js tests/state.test.js
git commit -m "feat(state): game state machine (backpack->descent->end) with TDD"
```

---

### Task 9: `src/fish.js` — AI ryb (patrol / aggro / dopływ)

**Files:**
- Create: `src/fish.js`
- Test: `tests/fish.test.js`

- [ ] **Step 1: Napisz failing test (czysta detekcja aggro)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inAggroRange } from '../src/fish.js';
import { FISH_TYPES } from '../src/config.js';

test('inAggroRange true when hook within type aggroRange', () => {
  const f = { type: 'plotka', x: 100, y: 100 };
  assert.equal(inAggroRange(f, 100, 200, FISH_TYPES), true);   // 100 px < 130
  assert.equal(inAggroRange(f, 100, 400, FISH_TYPES), false);  // 300 px > 130
});
```

- [ ] **Step 2: Uruchom test — ma FAIL**

Run: `node --test tests/fish.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Zaimplementuj `src/fish.js`**

```js
import { FISH_TYPES, WORLD } from './config.js';

export function inAggroRange(fish, hookX, hookWorldY, types = FISH_TYPES) {
  const t = types[fish.type];
  const dx = fish.x - hookX;
  const dy = fish.y - hookWorldY;
  return Math.hypot(dx, dy) <= t.aggroRange;
}

// Aktualizuje pozycję ryby. hookWorldY = depthPx + hookStartY (świat). speedMul z rampy.
export function updateFish(fish, hookX, hookWorldY, dt, speedMul) {
  if (fish.state === 'stunned' || fish.state === 'escaped' || fish.state === 'latched') return;
  const t = FISH_TYPES[fish.type];
  const speed = t.speed * speedMul;
  if (fish.state === 'patrol') {
    fish.x += fish.dir * speed * 0.5 * dt;
    if (fish.x < WORLD.hookMinX) { fish.x = WORLD.hookMinX; fish.dir = 1; }
    if (fish.x > WORLD.hookMaxX) { fish.x = WORLD.hookMaxX; fish.dir = -1; }
    if (inAggroRange(fish, hookX, hookWorldY)) fish.state = 'aggro';
  } else if (fish.state === 'aggro') {
    const dx = hookX - fish.x;
    const dy = hookWorldY - fish.y;
    const len = Math.hypot(dx, dy) || 1;
    fish.x += (dx / len) * speed * dt;
    fish.y += (dy / len) * speed * dt;
  }
}
```

- [ ] **Step 4: Uruchom test — ma PASS**

Run: `node --test tests/fish.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/fish.js tests/fish.test.js
git commit -m "feat(fish): patrol/aggro AI with tested aggro detection"
```

---

### Task 10: `src/input.js` — wejście (drag-drop plecak + dryf L/P)

**Files:**
- Create: `src/input.js`

- [ ] **Step 1: Zaimplementuj (warstwa IO — weryfikacja ręczna)**

```js
// Tłumaczy pointer events na intencje. Czyste pozycjonowanie; logika w state/main.
import { WORLD } from './config.js';

export function attachInput(canvas, handlers) {
  // handlers: { onPointerDown(x,y), onPointerMove(x,y), onPointerUp(x,y) }
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) || e;
    const sx = canvas.width / r.width;
    const sy = canvas.height / r.height;
    return { x: (p.clientX - r.left) * sx, y: (p.clientY - r.top) * sy };
  };
  const down = (e) => { e.preventDefault(); const { x, y } = toCanvas(e); handlers.onPointerDown(x, y); };
  const move = (e) => { e.preventDefault(); const { x, y } = toCanvas(e); handlers.onPointerMove(x, y); };
  const up   = (e) => { e.preventDefault(); const { x, y } = toCanvas(e); handlers.onPointerUp(x, y); };
  canvas.addEventListener('mousedown', down);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', up, { passive: false });
}

export function clampHookX(x) {
  return Math.max(WORLD.hookMinX, Math.min(WORLD.hookMaxX, x));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/input.js
git commit -m "feat(input): pointer abstraction for backpack + lateral drift"
```

---

### Task 11: `src/render.js` — warstwy rysowania

**Files:**
- Create: `src/render.js`

- [ ] **Step 1: Zaimplementuj (weryfikacja ręczna w przeglądarce)**

```js
import { WORLD, FISH_TYPES, BACKPACK, STARTER_HOOK } from './config.js';

export function render(ctx, s, hookX) {
  ctx.clearRect(0, 0, WORLD.W, WORLD.H);
  if (s.mode === 'BACKPACK') return renderBackpack(ctx, s);
  renderDescent(ctx, s, hookX);
  if (s.mode === 'END') renderEnd(ctx, s);
}

function renderBackpack(ctx, s) {
  ctx.fillStyle = '#0a2236'; ctx.fillRect(0, 0, WORLD.W, WORLD.H);
  ctx.fillStyle = '#e6f0ff'; ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Włóż hak do plecaka', WORLD.W / 2, 90);
  const gw = BACKPACK.cols * BACKPACK.cell, gh = BACKPACK.rows * BACKPACK.cell;
  const ox = (WORLD.W - gw) / 2, oy = 150;
  for (let r = 0; r < BACKPACK.rows; r++) for (let c = 0; c < BACKPACK.cols; c++) {
    ctx.strokeStyle = '#2c5a82'; ctx.lineWidth = 2;
    ctx.strokeRect(ox + c * BACKPACK.cell, oy + r * BACKPACK.cell, BACKPACK.cell, BACKPACK.cell);
    if (s.grid.cells[r * BACKPACK.cols + c]) {
      ctx.fillStyle = '#cdbb6a';
      ctx.fillRect(ox + c * BACKPACK.cell + 12, oy + r * BACKPACK.cell + 12, BACKPACK.cell - 24, BACKPACK.cell - 24);
    }
  }
  if (!s.hook) {
    ctx.fillStyle = '#ffd166';
    ctx.fillText('↓ ' + STARTER_HOOK.name + ' ↓', WORLD.W / 2, oy + gh + 50);
  } else {
    ctx.fillStyle = '#7fffa1';
    ctx.fillText('Tap, by zarzucić', WORLD.W / 2, oy + gh + 50);
  }
  ctx.textAlign = 'left';
  // współrzędne gridu udostępnione main.js przez ten sam wzór (ox, oy, cell)
  s._grid = { ox, oy, cell: BACKPACK.cell };
}

function renderDescent(ctx, s, hookX) {
  // gradient głębi
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.H);
  g.addColorStop(0, '#0e3b5c'); g.addColorStop(1, '#041422');
  ctx.fillStyle = g; ctx.fillRect(0, 0, WORLD.W, WORLD.H);

  const camY = s.depthPx; // świat -> ekran: screenY = worldY - camY
  // ryby
  for (const f of s.fish) {
    const sy = f.y - camY;
    if (sy < -40 || sy > WORLD.H + 40) continue;
    const t = FISH_TYPES[f.type];
    ctx.fillStyle = f.state === 'stunned' ? '#bfe9ff' : t.color;
    ctx.beginPath(); ctx.arc(f.x, sy, t.radius, 0, Math.PI * 2); ctx.fill();
    // oczy / mina
    ctx.fillStyle = '#06121f'; ctx.font = `${t.radius}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(f.state === 'stunned' ? 'x x' : '• •', f.x, sy + 4);
    ctx.textAlign = 'left';
    // wskaźnik HP + okno na zaczepionej rybie (KRYTYCZNE do feelu)
    if (f.state === 'latched') {
      const w = t.radius * 2;
      ctx.fillStyle = '#000'; ctx.fillRect(f.x - t.radius, sy - t.radius - 12, w, 5);
      ctx.fillStyle = '#ff5d5d'; ctx.fillRect(f.x - t.radius, sy - t.radius - 12, w * Math.max(0, f.hp / f.hpMax), 5);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(f.x - t.radius, sy - t.radius - 6, w * Math.max(0, f.windowLeft / f.window), 4);
    }
  }
  // bańki z ogłuszonymi
  // (ogłuszone ryby przeniesione do s.bubbles przez main.js)
  for (const b of s.bubbles || []) {
    const sy = b.y - camY;
    ctx.strokeStyle = 'rgba(200,235,255,0.6)'; ctx.beginPath(); ctx.arc(b.x, sy, 18, 0, Math.PI * 2); ctx.stroke();
  }
  // hak (stały y ekranowy)
  ctx.strokeStyle = '#dfe9f5'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hookX, 0); ctx.lineTo(hookX, WORLD.hookStartY); ctx.stroke();
  ctx.fillStyle = '#dfe9f5'; ctx.beginPath(); ctx.arc(hookX, WORLD.hookStartY, 8, 0, Math.PI * 2); ctx.fill();
  // hook na przyszłe efekty (lasery/aury) — placeholder, nic nie rysuje w p1

  // HUD
  ctx.fillStyle = '#e6f0ff'; ctx.font = '18px sans-serif';
  ctx.fillText('❤'.repeat(s.lives), 12, 26);
  ctx.fillText('Głębia: ' + Math.round(s.depthPx / WORLD.pxPerMeter) + ' m', 12, 50);
  ctx.fillText('Wynik: ' + s.score + '  (' + s.stunned + ' ryb)', 12, 74);
}

function renderEnd(ctx, s) {
  ctx.fillStyle = 'rgba(3,12,20,0.82)'; ctx.fillRect(0, 0, WORLD.W, WORLD.H);
  ctx.fillStyle = '#e6f0ff'; ctx.textAlign = 'center'; ctx.font = '26px sans-serif';
  ctx.fillText('Hak za słaby — wzmocnij się', WORLD.W / 2, 250);
  ctx.font = '48px sans-serif';
  ctx.fillText('★'.repeat(s.stars) + '☆'.repeat(3 - s.stars), WORLD.W / 2, 330);
  ctx.font = '20px sans-serif';
  ctx.fillText('Głębia ' + Math.round(s.depthPx / WORLD.pxPerMeter) + ' m · ' + s.stunned + ' ryb · ' + s.score + ' pkt', WORLD.W / 2, 380);
  ctx.fillText('Tap, by zagrać ponownie', WORLD.W / 2, 440);
  ctx.textAlign = 'left';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render.js
git commit -m "feat(render): backpack/descent/end layers incl. hp+window indicator"
```

---

### Task 12: `src/main.js` — wiring pętli i podpięcie wszystkiego

**Files:**
- Create: `src/main.js`

- [ ] **Step 1: Zaimplementuj pętlę i wiring**

```js
import { WORLD, BACKPACK } from './config.js';
import { createGame, placeHook, startDescent, addDepth, registerStun, registerEscape } from './state.js';
import { difficultyAt } from './logic/ramp.js';
import { pickFishType, createFish } from './logic/spawn.js';
import { startLatch, tickLatch } from './logic/combat.js';
import { updateFish } from './fish.js';
import { attachInput, clampHookX } from './input.js';
import { render } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let s = createGame();
let hookX = WORLD.W / 2;
let spawnTimer = 0;
s.bubbles = [];

function reset() { s = createGame(); s.bubbles = []; hookX = WORLD.W / 2; spawnTimer = 0; }

attachInput(canvas, {
  onPointerDown(x, y) {
    if (s.mode === 'BACKPACK') {
      const gi = s._grid;
      if (!s.hook && gi) {
        const c = Math.floor((x - gi.ox) / gi.cell);
        const r = Math.floor((y - gi.oy) / gi.cell);
        if (c >= 0 && r >= 0 && c < BACKPACK.cols && r < BACKPACK.rows) placeHook(s, c, r);
      } else if (s.hook) {
        startDescent(s);
      }
    } else if (s.mode === 'END') {
      reset();
    } else if (s.mode === 'DESCENT') {
      hookX = clampHookX(x);
    }
  },
  onPointerMove(x) { if (s.mode === 'DESCENT') hookX = clampHookX(x); },
  onPointerUp() {},
});

function update(dt) {
  if (s.mode !== 'DESCENT') return;
  const depthM = s.depthPx / WORLD.pxPerMeter;
  const diff = difficultyAt(depthM);
  addDepth(s, s.hook.szybkoscOpadania * dt);

  // spawn
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer = diff.spawnInterval;
    const type = pickFishType(depthM);
    const x = WORLD.hookMinX + Math.random() * (WORLD.hookMaxX - WORLD.hookMinX);
    const f = createFish(type, depthM, x);
    f.y = s.depthPx + WORLD.H + 30; // spawn poniżej dolnej krawędzi
    s.fish.push(f);
  }

  const hookWorldY = s.depthPx + WORLD.hookStartY;

  // latch / damage
  if (s.latched) {
    const res = tickLatch(s.latched, s.hook.atk, dt);
    if (res === 'stunned') { registerStun(s, fishType(s.latched)); s.latched.bubbleY = s.latched.y; s.bubbles.push(s.latched); s.latched = null; }
    else if (res === 'escaped') { registerEscape(s); s.latched = null; }
  }

  // ruch ryb + wykrycie kontaktu
  for (const f of s.fish) {
    updateFish(f, hookX, hookWorldY, dt, diff.speedMul);
    if (!s.latched && (f.state === 'patrol' || f.state === 'aggro')) {
      const r = require_radius(f);
      if (Math.hypot(f.x - hookX, f.y - hookWorldY) <= r + 8) { startLatch(f); s.latched = f; }
    }
  }

  // bańki w górę + sprzątanie
  for (const b of s.bubbles) b.bubbleY -= 90 * dt;
  s.bubbles = s.bubbles.filter(b => b.bubbleY > s.depthPx - 40);
  s.fish = s.fish.filter(f => f.state !== 'escaped' && f !== s.latched &&
    f.state !== 'stunned' && f.y - s.depthPx > -120);
  if (s.latched) s.fish = s.fish.includes(s.latched) ? s.fish : [...s.fish, s.latched];
}

import { FISH_TYPES } from './config.js';
function fishType(f) { return FISH_TYPES[f.type]; }
function require_radius(f) { return FISH_TYPES[f.type].radius; }

let last = 0;
function loop(ts) {
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
  last = ts;
  update(dt);
  render(ctx, s, hookX);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

- [ ] **Step 2: Weryfikacja ręczna w przeglądarce**

Otwórz `index.html` przez Live Server. Sprawdź kolejno:
- Ekran plecaka: tap w komórkę gridu wkłada hak; potem "Tap, by zarzucić" startuje descent.
- Descent: kamera scrolluje w dół, ryby pojawiają się od dołu i patrolują/dopływają.
- Dryf L/P myszą/palcem rusza hakiem; pierwszy kontakt z rybą = zaczepienie (pasek HP + okno).
- Płotka ogłuszana spokojnie → leci bańka w górę, wynik rośnie. Twardziel zwykle ucieka → −życie.
- 3 zerwy → end-screen z gwiazdkami i statami; tap restartuje.

Jeśli `require()` rzuca błąd w przeglądarce — to artefakt: usuń pomocniczą funkcję i użyj `FISH_TYPES[f.type].radius` inline (patrz Step 3 fix).

- [ ] **Step 3: Fix — usuń przypadkowe `require_radius`/`require` (czysty ES)**

Zamień w pętli kolizji `const r = require_radius(f);` na bezpośrednie:

```js
    if (!s.latched && (f.state === 'patrol' || f.state === 'aggro')) {
      const r = FISH_TYPES[f.type].radius;
      if (Math.hypot(f.x - hookX, f.y - hookWorldY) <= r + 8) { startLatch(f); s.latched = f; }
    }
```

I usuń definicję `function require_radius(...)`. Upewnij się, że `import { FISH_TYPES }` jest na górze pliku (przenieś tam, jeśli trzeba — bez importów w środku modułu).

- [ ] **Step 4: Ponowna weryfikacja w przeglądarce**

Odśwież. Konsola bez błędów; pełna pętla backpack → descent → end → restart działa.

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat(main): wire loop, spawn, latch, bubbles, restart for slice 1"
```

---

### Task 13: Pełny zielony zestaw + playtest tuningowy

**Files:** brak nowych — strojenie `src/config.js`

- [ ] **Step 1: Uruchom wszystkie testy**

Run: `npm test`
Expected: PASS — scoring, ramp, combat, spawn, backpack, state, fish

- [ ] **Step 2: Playtest i strojenie (iteracyjnie, tylko `config.js`)**

Zagraj 5–10 razy i sprawdź feel wg spec:
- Czy okno czasowe jest **czytelne** — widać "zdążę / nie zdążę"? (jeśli nie — zwiększ kontrast pasków / wydłuż `window`)
- Czy startowy hak jest **celowo za słaby** — ściana mocy przychodzi po ~30–60 s? (strojenie `atk`, `hpMulPerM`)
- Czy **dodge-stall nie opłaca się** — czysty zjazd daje 0★? (potwierdza `depthCeil < t1`)
- Czy twardziel czytelnie sygnalizuje "omijaj"? (kolor/rozmiar)
- Progi gwiazdek `STARS` dają rozsądny rozkład 1/2/3★?

Zapisuj zmiany tylko w `config.js`.

- [ ] **Step 3: Commit strojenia**

```bash
git add src/config.js
git commit -m "tune: slice 1 feel pass (hook strength, windows, star thresholds)"
```

---

## Self-Review

**Spec coverage:**
- Onboarding mini-plecak (tutaj: tap→hak→placement→cast) → Task 7 (grid), Task 8 (placeHook/startDescent), Task 11 (render backpack), Task 12 (input).
- Pętla descent (opadanie, dryf L/P, zaczepienie, dmg/s, okno, ogłusz/ucieczka, 3 życia, koniec) → Task 5 (combat), Task 8 (state), Task 9 (fish AI), Task 12 (wiring).
- Czytelność okna czasowego → Task 11 (paski HP+okno na latched).
- Rampa trudności wg głębi + brak dna → Task 4 (ramp), Task 12 (spawn poniżej krawędzi, kamera).
- 3 archetypy ryb → Task 2 (config FISH_TYPES), Task 6 (spawn).
- Startowy hak jako item, data-driven, celowo słaby → Task 2 (STARTER_HOOK), Task 13 (tuning).
- Score z sufitem głębokości + 0–3★ → Task 3 (scoring), Task 8 (END→stars), Task 11 (end-screen).
- Anti dodge-stall (sufit depth + gęstość) → Task 3 (depthCeil<t1, test), Task 4 (spawnInterval floor).
- Eye-candy lekko (bańki, miny, placeholder na lasery) → Task 11 (bubbles, oczy, hook-comment).
- Tylko restart, brak level-select/zapisu → Task 12 (reset na tap w END).
- Forward-looking (adjacency, areny, karty) → świadomie POZA planem (spec sekcja "Spójność z plastrem 2+").

**Placeholder scan:** Jedyny celowy placeholder to komentarz w renderze "hook na przyszłe efekty" — zgodny ze spec (lasery/aury nie strzelają w p1). Brak TBD/TODO w krokach. Każdy krok z kodem ma pełny kod.

**Type consistency:** `Fish` ma pola `type/x/y/hp/hpMax/window/windowLeft/state/dir/bubbleY` — `createFish` (Task 6) je ustawia, `startLatch`/`tickLatch` (Task 5) używają `hp/window/windowLeft/state`, render (Task 11) używa `hp/hpMax/windowLeft/window`. `GameState` pola spójne między Task 8 a Task 12. `STARTER_HOOK` ma `atk/zwrotnosc/szybkoscOpadania` używane w state/main. Naprawiony jeden realny błąd (`require_radius`/`require` w środowisku ES) w Task 12 Step 3 — celowo zostawiony jako jawny fix-step, bo łatwo go napisać odruchowo.

---

## Execution Handoff

Plan zapisany do `docs/superpowers/plans/2026-06-15-pack-and-fish-slice1.md`. Dwie opcje wykonania:

1. **Subagent-Driven (rekomendowane)** — świeży subagent na task, review między taskami, szybka iteracja.
2. **Inline Execution** — wykonanie w tej sesji (executing-plans), batch z checkpointami.

Którą?
