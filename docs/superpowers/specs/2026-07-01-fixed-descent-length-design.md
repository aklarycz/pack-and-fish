# Spec: Stała długość opadania + krzywa gęstości

Data: 2026-07-01
Branch: pack-and-fish-slice1

## Problem
Dziś stage kończy się gdy wyczerpie się worek ryb (`fishQueue` pusty + brak ryb na ekranie).
Skutek: więcej ryb = dłuższy stage. To kłóci się z docelowym modelem: **długość opadania stała
i rosnąca ze stage'ami, gęstość ryb niezależna**. Gracz nie musi łapać wszystkich; ulepszając
sprzęt łapie coraz większy % (gęstego) worka i podbija score ponad próg 3★ (farming).

## Model docelowy
- **Długość opadania**: stała per stage (`descentM`, metry lokalne), rośnie s1→s10. Stage kończy
  się gdy głębokość lokalna `depthPx/pxPerMeter >= descentM` (potem beat `CLEAR_DELAY` → END).
- **Worek na stałej długości**: zostają liczby p/s/m per stage. Ryby spawnują z worka co interwał
  przez całe opadanie; worek dobrany tak, by starczył na ~całą długość. Po dobiciu do dna
  niezłowione ryby przepadają.
- **Krzywa gęstości** (interwał spawnu): s1–s5 maleje (gęstość rośnie), s6–s10 na minimum (max, płasko).
- **Score/gwiazdki**: bez zmian mechaniki. Dobicie do dna daje bazę z głębi (do `depthCap`), złowione
  ryby ×10 na wierzch. `depthCap` = `descentM + difficultyOffsetM` (depth zawsze osiąga sufit →
  progi gwiazdek kalibrowane do realnie osiąganej głębi).

## Liczby (Arena 1) — tunable

`d` = descentM (metry lokalne = sekundy opadania, bo 40 px/s ÷ 40 px/m = 1 m/s).
Worek total ≈ `d / spawn` (wypełnia opadanie). Muskie ramp 1,1,2,2,3,3,4,4,5,5.
depthCap wyliczane w kodzie = `d + difficultyOffsetM` (offset arena1 = 2·i).

| stage | p  | s  | m | d  | spawn | ~total | gęstość |
|-------|----|----|---|----|-------|--------|---------|
| 1     | 9  | 3  | 1 | 20 | 1.60  | 13     | intro   |
| 2     | 12 | 5  | 1 | 24 | 1.40  | 18     | ↑       |
| 3     | 14 | 7  | 2 | 28 | 1.20  | 23     | ↑       |
| 4     | 18 | 10 | 2 | 32 | 1.05  | 30     | ↑       |
| 5     | 23 | 14 | 3 | 36 | 0.90  | 40     | max     |
| 6     | 25 | 16 | 3 | 40 | 0.90  | 44     | max     |
| 7     | 27 | 18 | 4 | 44 | 0.90  | 49     | max     |
| 8     | 28 | 21 | 4 | 48 | 0.90  | 53     | max     |
| 9     | 29 | 24 | 5 | 52 | 0.90  | 58     | max     |
| 10    | 30 | 27 | 5 | 56 | 0.90  | 62     | max     |

Krzywa interwału: 1.60 → 0.90 przez s1–s5, potem płaskie 0.90 (max gęstość) s6–s10.

## Zmiany w kodzie

### `config.js`
- `ARENA1_STAGES`: kolumny `{ p, s, m, d, spawn }` (usunąć `cap` — wyliczane z `d + offset`).
- `ARENAS` (base) dla aren 2–3: dodać `descentM` bazowe (arena2: 30, arena3: 40) zamiast polegać na `depthCap`.
- `buildArenaStages`:
  - arena1: `descentM = c.d`; `depthCap = c.d + difficultyOffsetM`; `start = c.spawn`.
  - areny 2–3: `descentM = base.descentM + i * 4`; `depthCap = descentM + difficultyOffsetM`.
  - Dodać `descentM` do obiektu stage (obok `depthCap`, `bag`, `spawn`).

### `state.js`
- `createGame()`: dodać pole `descentM: 0` (przy `depthPx`).
- `startStage()`: `s.descentM = stage.descentM;` (obok `s.stageOffsetM = stage.difficultyOffsetM;`).

### `sim.js`
- Hoistować `localM` na górę `stepDescent` (po `depthM`), by był w scope w spawnie i na końcu:
  ```js
  const depthM = s.depthPx / WORLD.pxPerMeter + (s.stageOffsetM || 0);
  const localM = s.depthPx / WORLD.pxPerMeter;   // lokalna głębokość (bez offsetu) — długość opadania
  ```
  Usunąć wewnętrzne `const localM = ...` z bloku spawnu (używa hoistowanego).
- W bloku spawnu: nie spawnować po dobiciu do dna — warunek `if`:
  `if (s.spawnTimer <= 0 && s.fishQueue.length > 0 && localM < s.descentM)`.
- Koniec stage'a — zastąpić warunek „worek pusty":
  ```js
  // było: if (!s.endless && s.fishQueue.length === 0 && s.fish.length === 0 && s.latched.length === 0)
  if (!s.endless && localM >= s.descentM) {
    s.clearTimer += dt;
    if (s.clearTimer >= CLEAR_DELAY) descentCleared(s);
  } else s.clearTimer = 0;
  ```
  (Niezłowione ryby/worek przepadają — stage kończy się po głębokości.)

## Testy (`tests/sim.test.js`)
- **stage kończy się po `descentM` mimo pełnego worka i ryb na ekranie**: ustaw `s.descentM` małe,
  zostaw `fishQueue` pełny i niezłowioną rybę → po dobiciu głębokości `s.mode === 'END'`,
  `depthPx/pxPerMeter >= descentM`.
- **worek NIE kończy stage przedwcześnie**: pusty `fishQueue` na starcie, brak ryb → stage trwa aż
  do `descentM` (nie kończy się od razu jak w starym modelu).

Ryby/gęstość/feel — weryfikacja w przeglądarce.

## Poza zakresem (YAGNI)
- Ciągły spawn wg mixu głębokości (wybrano worek).
- Zmiana `CLEAR_DELAY` (zostaje 3.5 s beat po dobiciu dna).
- Rebalans aren 2–3 (zablokowane; tylko sensowne wartości domyślne, by nie było `undefined`).
