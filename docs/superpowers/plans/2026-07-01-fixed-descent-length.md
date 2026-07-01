# Stała długość opadania + krzywa gęstości — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stage kończy się po stałej głębokości `descentM` (rosnącej per stage), a nie po wyczerpaniu worka ryb; gęstość spawnu rośnie s1–s5 i jest maksymalna s6–s10.

**Architecture:** Nowe pole `descentM` per stage w `config.js`; `state.startStage` przenosi je do stanu; `sim.stepDescent` kończy descent po głębokości i g asi spawn po dobiciu dna. Worek (p/s/m) zostaje, ale nie kończy stage'a.

**Tech Stack:** Vanilla JS (ES modules), `node:test` + `node:assert/strict`.

## Global Constraints

- Bez nowych zależności; liczby tuningowe w `config.js`.
- Testy: `npm test` (Node 18+).
- 40 px/s opadania ÷ 40 px/m ⇒ 1 m/s (descentM w metrach = sekundy opadania).
- `depthCap = descentM + difficultyOffsetM` (offset areny 1 = 2·i).

---

## Task 1: Stała długość opadania (descentM) + krzywa gęstości

**Files:**
- Modify: `src/config.js` (`ARENA1_STAGES` kolumny + `buildArenaStages` + `ARENAS` base descentM)
- Modify: `src/state.js` (`createGame` pole, `startStage` przypisanie)
- Modify: `src/sim.js` (hoisting `localM`, gate spawnu, koniec po głębokości)
- Test: `tests/sim.test.js`

**Interfaces:**
- Produces: `STAGES[i].descentM: number` (metry lokalne), `s.descentM: number` (stan).

- [ ] **Step 1: Napisz testy końca po głębokości w `tests/sim.test.js`**

Dodaj (np. przed `test('descent runs many steps...')`):
```js
test('stage kończy się po descentM mimo pełnego worka i ryby na ekranie', () => {
  const s = started();
  s.descentM = 5;                                   // krótkie opadanie
  s.fishQueue = ['plotka', 'plotka', 'plotka'];     // worek NADAL pełny
  s.fish.push({ type: 'plotka', x: 200, y: s.depthPx + 100000, hp: 9999, hpMax: 9999, state: 'patrol', dir: 1, bubbleY: 0 }); // niezłowiona
  let safety = 0;
  while (s.mode === 'DESCENT' && safety++ < 5000) stepDescent(s, 200, HOOK_Y, 1 / 60, () => 0.5);
  assert.equal(s.mode, 'END');
  assert.ok(s.depthPx / WORLD.pxPerMeter >= 5);     // dobił do dna
});

test('pusty worek NIE kończy stage przedwcześnie (trwa do descentM)', () => {
  const s = started();
  s.descentM = 4;
  s.fishQueue = []; s.fish = []; s.latched = [];     // brak ryb od startu
  let safety = 0, ended = -1;
  while (s.mode === 'DESCENT' && safety++ < 5000) {
    stepDescent(s, 200, HOOK_Y, 1 / 60, () => 0.5);
    if (ended < 0 && s.depthPx / WORLD.pxPerMeter >= 4) ended = safety; // moment osiągnięcia dna
  }
  assert.equal(s.mode, 'END');
  assert.ok(s.depthPx / WORLD.pxPerMeter >= 4);      // skończył się DOPIERO po głębokości, nie od razu
});
```

- [ ] **Step 2: Uruchom — mają NIE przejść**

Run: `npm test`
Expected: FAIL — dziś `s.descentM` undefined; koniec liczony po worku (pusty worek kończy od razu → drugi test wyłapie przedwczesny koniec / pierwszy nie dobije do dna).

- [ ] **Step 3: Pole `descentM` w `src/state.js`**

3a. `createGame()` — przy `durability: 0, ...` (linia ~68) dodaj `descentM: 0,`:
```js
    durability: 0, durabilityMax: 0, durDraining: false, clearTimer: 0, endElapsed: 0, descentM: 0, // pasek + opóźnienia końca
```
3b. `startStage()` — obok `s.stageOffsetM = stage.difficultyOffsetM;` dodaj:
```js
    s.stageOffsetM = stage.difficultyOffsetM;
    s.descentM = stage.descentM;
```

- [ ] **Step 4: `descentM` w `src/config.js`**

4a. Zastąp `ARENA1_STAGES` (kolumny `d` + spawn; bez `cap` — wyliczane):
```js
// Stage 1: spokojny intro (maxLatch 1). Stage 2+: kotwica (maxLatch 2). d = descentM (metry = sekundy
// opadania). Gęstość (spawn) rośnie s1–s5, max płaska s6–s10. Worek ≈ d/spawn (wypełnia opadanie).
const ARENA1_STAGES = [
  { p: 9,  s: 3,  m: 1, d: 20, spawn: 1.60 },
  { p: 12, s: 5,  m: 1, d: 24, spawn: 1.40 },
  { p: 14, s: 7,  m: 2, d: 28, spawn: 1.20 },
  { p: 18, s: 10, m: 2, d: 32, spawn: 1.05 },
  { p: 23, s: 14, m: 3, d: 36, spawn: 0.90 },
  { p: 25, s: 16, m: 3, d: 40, spawn: 0.90 },
  { p: 27, s: 18, m: 4, d: 44, spawn: 0.90 },
  { p: 28, s: 21, m: 4, d: 48, spawn: 0.90 },
  { p: 29, s: 24, m: 5, d: 52, spawn: 0.90 },
  { p: 30, s: 27, m: 5, d: 56, spawn: 0.90 },
];
```

4b. W `ARENAS` dodaj `descentM` do base aren 2 i 3 (arena 1 base nieużywane dla tabeli):
```js
  { id: 2, name: 'Toń',        bg: 'arena-02', tint: ['#114b5f', '#06222b'],
    base: { plotka: 12, sredniak: 10, muskie: 2, muskieFrom: 0, offsetM: 12, depthCap: 40, descentM: 32, spawnStart: 1.9, spawnMin: 1.4, perM: 0.008 } },
  { id: 3, name: 'Głębia',     bg: 'arena-03', tint: ['#2a2a5e', '#0a0a22'],
    base: { plotka: 10, sredniak: 16, muskie: 3, muskieFrom: 0, offsetM: 25, depthCap: 50, descentM: 40, spawnStart: 1.6, spawnMin: 1.1, perM: 0.01 } },
```
(Arena 1 base zostaw jak jest — tabela `ARENA1_STAGES` ją nadpisuje.)

4c. W `buildArenaStages` policz `descentM` i wylicz `depthCap` z niego. Zastąp środek pętli:
```js
    let plotka, sredniak, muskie, depthCap, start, descentM;
    const difficultyOffsetM = base.offsetM + i * 2;
    if (arenaIndex === 0) {
      const c = ARENA1_STAGES[i];
      plotka = c.p; sredniak = c.s; muskie = c.m; descentM = c.d; start = c.spawn;
    } else {
      const mult = 1 + i * 0.10;
      plotka = Math.round(base.plotka * mult);
      sredniak = Math.round(base.sredniak * mult);
      muskie = i < base.muskieFrom ? 0 : base.muskie + Math.floor((i - base.muskieFrom) * 0.3);
      descentM = base.descentM + i * 4;
      start = Math.max(base.spawnMin, base.spawnStart - i * 0.05);
    }
    depthCap = descentM + difficultyOffsetM;
    const bag = { plotka, sredniak, twardziel: muskie };
    stages.push({
      arenaId: arena.id, arenaName: arena.name, bg: arena.bg, no: i + 1,
      difficultyOffsetM, bag, spawn: { start, min: start, perM: base.perM }, depthCap, descentM,
      stars: starThresholds(plotka, sredniak, muskie, depthCap, hasRocket),
    });
```
(Usuń poprzednie deklaracje `let plotka...`, `const difficultyOffsetM`, `depthCap = ...`, `stages.push` — zastępuje je powyższy blok. `hasRocket` liczone wcześniej w pętli zostaje.)

- [ ] **Step 5: Koniec po głębokości + gate spawnu w `src/sim.js`**

5a. Po `const depthM = ...` (linia ~20) dodaj hoisting `localM`:
```js
  const depthM = s.depthPx / WORLD.pxPerMeter + (s.stageOffsetM || 0);
  const localM = s.depthPx / WORLD.pxPerMeter;   // lokalna głębokość (długość opadania)
```
5b. W bloku spawnu usuń wewnętrzne `const localM = s.depthPx / WORLD.pxPerMeter;` (używa hoistowanego)
i dodaj warunek dna do `if`:
```js
  if (s.spawnTimer <= 0 && s.fishQueue.length > 0 && localM < s.descentM) {
    const sp = STAGES[s.stageIndex].spawn;
    s.spawnTimer = Math.max(sp.min, sp.start - localM * sp.perM);
```
5c. Zastąp warunek końca (dziś ~160-163):
```js
  // dobicie do dna (stała długość opadania) -> po CLEAR_DELAY koniec. Niezłowione ryby przepadają.
  if (!s.endless && localM >= s.descentM) {
    s.clearTimer += dt;
    if (s.clearTimer >= CLEAR_DELAY) descentCleared(s);
  } else s.clearTimer = 0;
```

- [ ] **Step 6: Uruchom — wszystko zielone**

Run: `npm test`
Expected: PASS (nowe 2 + istniejące 62). Jeśli `descent runs many steps` się wywali (kończy się
wcześniej po głębokości): to OK — test ma `if (s.mode !== 'DESCENT') break;` i sprawdza tylko
`depthPx > 0`, więc przejdzie.

- [ ] **Step 7: Weryfikacja składni**

Run: `node --check src/config.js && node --check src/sim.js && node --check src/state.js`
Expected: brak błędów.

- [ ] **Step 8: Weryfikacja w przeglądarce**

Run: `python __serve.py` → zagraj. Oczekiwane: każdy stage opada stałą długość (dłuższą na wyższych
stage'ach); ryby gęstsze na s2+; niezłowione przepadają przy dobiciu do dna; score = złowione + głębia.

- [ ] **Step 9: Commit (po akceptacji operatora)**

```bash
git add src/config.js src/state.js src/sim.js tests/sim.test.js
git commit -m "feat: stala dlugosc opadania (descentM) + krzywa gestosci s1-5 rosnie, s6-10 max"
```

---

## Self-Review

**Spec coverage:**
- Stała długość (descentM, koniec po głębokości) → Task 1 Step 3-5. ✓
- Worek na stałej długości (nie kończy stage) → Step 5c + testy Step 1. ✓
- Krzywa gęstości (spawn s1–5 → s6–10 max) + worki → Step 4a tabela. ✓
- depthCap = descentM + offset → Step 4c. ✓
- Areny 2–3 nie undefined → Step 4b/4c (descentM base + derive). ✓

**Placeholder scan:** brak TBD/TODO; realny kod i komendy. ✓

**Type consistency:** `descentM` spójne config(Step4)↔state(Step3)↔sim(Step5). `localM` hoistowane raz,
używane w gate i końcu. `depthCap` liczone z descentM. ✓

**Ryzyko:** istniejące testy sim używają `started()` (stage 0, descentM=20 → koniec po 20 m ≈ 20 s);
testy które biją krótko (łów/zerwanie) rozstrzygają się przed 20 m. Sprawdzone: break-off/balans/rocket
kończą się przez złowienie/utratę żyć/zniknięcie ryby przed dobiciem dna. `descent runs many steps`
toleruje wcześniejszy koniec (break na mode!==DESCENT).
