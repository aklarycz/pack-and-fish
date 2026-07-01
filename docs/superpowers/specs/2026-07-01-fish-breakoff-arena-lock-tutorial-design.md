# Spec: Zerwanie żyłki + blokada aren + fix tutoriala kotwicy

Data: 2026-07-01
Branch: pack-and-fish-slice1

Trzy niezależne zmiany w jednym spec-u (wspólny cel: stage 1 grywalny do końca + porządek nawigacji + niezawodny tutorial).

---

## A. Zerwanie żyłki zamiast dobicia-na-śmierć

### Problem
Dziś ryba, której `atk > wytrzymałość haka` (muskie: atk 10 vs brąz dur 6), po zaczepieniu
wisi na haku i drenuje pasek wytrzymałości w kółko. Pasek → 0 = −1 serce + odnowienie paska,
ale ryba **zostaje zaczepiona** i drenuje dalej → zjada wszystkie 3 serca w ~10 s i nigdy nie
zostaje złowiona (brązem trzeba ~12 s). Efekt: stage 1 (1 muskie) kończy się przegraną.

### Docelowe zachowanie
1. **Dobicie na czas** — jeśli gracz zdąży zbić HP ryby do 0 zanim pasek zejdzie do zera:
   ryba złowiona normalnie, **pasek odnawia się do maksa**, brak utraty serca.
   (Reguła: pasek odnawia się, gdy ryba drenująca opuszcza hak przez ZŁOWIENIE — nie przez zerwanie.)
2. **Zerwanie #1** (pasek → 0, ryba wciąż żywa):
   - `−1 serce` (istniejące `registerEscape`)
   - ryba **odpada z haka** (usuwana z `latched`), wchodzi w stan `escaped`
   - pasek odnawia się do maksa
   - ryba **powoli** odpływa (w górę, ku powierzchni) i za ekranem znika
   - zachowuje **aktualne HP** (obrażenia zostają)
   - jest **jednorazowo** łapalna ponownie — z krótkim buforem (~0,8 s), zanim może się
     zaczepić (żeby nie relatchowała natychmiast, będąc jeszcze przy haku)
3. **Ponowny chwyt** — gdy gracz dogoni odpiętą rybę hakiem (kontakt po buforze):
   zaczepia się ponownie, walczy od swojego HP. Bufor/limit chwytów spada.
4. **Zerwanie #2** (drugie zerwanie tej samej ryby):
   - `−1 serce`
   - ryba `escaped`, ale teraz ucieka **szybko** i **nie da się jej już zaczepić** — znika
5. **Przegrana**: 3 zerwania łącznie (dowolne ryby) = koniec gry ("Zerwana żyłka!" — bez zmian).

Cap: jedna ryba może kosztować **maksymalnie 2 serca** (i tylko jeśli gracz świadomie ją goni;
odpuszczona po pierwszym zerwaniu = 1 serce). To gwarantuje, że muskie na stage 1 nie wymiata run.

### Zmiany w kodzie

**`config.js`** — nowe stałe (tunable):
- `RECATCH_LIMIT = 1` — ile razy odpiętą rybę można zaczepić ponownie
- `RECATCH_LOCK = 0.8` — s bufora po zerwaniu zanim ryba może się znów zaczepić
- `ESCAPE_SPEED_SLOW = 35` — px/s ucieczki po zerwaniu #1 (ruch ku powierzchni, świat y maleje)
- `ESCAPE_SPEED_FAST = 160` — px/s ucieczki po zerwaniu #2 (znacznie szybsza, bez re-latchu)

  (Wartości startowe do strojenia. Uwaga: kamera i tak przesuwa ryby w górę ekranu o
  `szybkoscOpadania` = 40 px/s, więc realna prędkość ucieczki na ekranie = suma.)

**`sim.js`**:
- Blok drenażu (dziś ~85–97): gdy `durability <= 0`, zamiast tylko `registerEscape + refresh`:
  - wybierz **najsilniejszą** drenującą rybę z `latched` (`atk > dur`, max `atk`)
  - `registerEscape(s)` (−1 serce; może zakończyć grę)
  - jeśli gra trwa: `durability = durabilityMax`
  - `breakOff(s, f)` — patrz helper
- Blok latch/dmg (dziś ~71–81): gdy `tickLatch === 'stunned'` i ryba była drenująca
  (`FISH_TYPES[f.type].atk > s.hook.dur`) → po usunięciu `durability = durabilityMax`
- Blok rakiety (dziś ~144–150): gdy rakieta dobija rybę, która była `latched` i drenująca →
  `durability = durabilityMax`
- Detekcja kontaktu (dziś ~100–108): dopuść re-latch dla `state === 'escaped'`, gdy
  `f.recatchLeft > 0 && f.recatchLock <= 0`
- Helper `breakOff(s, f)`:
  - `s.latched` usuń `f`
  - `f.breakoffs = (f.breakoffs || 0) + 1`
  - `f.state = 'escaped'`
  - jeśli `f.breakoffs > RECATCH_LIMIT` → `f.recatchLeft = 0`, `f.escapeFast = true`
    inaczej → `f.recatchLeft = RECATCH_LIMIT - f.breakoffs + 1` (=1 przy pierwszym), `f.recatchLock = RECATCH_LOCK`
  - (HP nie ruszamy — zostaje)

**`fish.js`** (`updateFish`):
- Dodaj obsługę `state === 'escaped'` (dziś early-return):
  - `f.recatchLock` maleje o `dt`
  - ruch: ku powierzchni (świat, `y` maleje) z prędkością `ESCAPE_SPEED_FAST` gdy `escapeFast`,
    inaczej `ESCAPE_SPEED_SLOW`; lekki dryf poziomy od haka
  - clamp poziomy jak dziś (nie znika w bok, znika górą przez istniejący cleanup)
- `startLatch` (combat.js): przy re-latchu `state = 'latched'` — HP i `breakoffs` zostają (bez resetu)

**Uwaga — cleanup off-screen** (`sim.js` ~156): istniejący filtr usuwa ryby powyżej góry
(`y - depthPx <= -160`), więc odpływająca `escaped` znika sama. Dopóki jest na ekranie, blokuje
`descentCleared` (jak każda ryba) — co jest OK ("gracz dalej łowi to, co zostało").

### Edge case
Kilka drenujących ryb naraz (możliwe dopiero z kotwicą, rzadkie): na jedno wyczerpanie paska
odpada **jedna** (najsilniejsza) ryba = −1 serce. Jeśli druga drenująca zostaje, zejdzie
kolejny (odnowiony) pasek → kolejne zerwanie. Naturalnie się rozliczy.

---

## B. Blokada aren 2+ i brak zawijania (pętla na stage 10)

### Problem
Areny 2 i 3 nie mają contentu/grafik, ale nawigacja pozwala na nie przejść.

### Docelowe zachowanie
- Gracz porusza się tylko po arenie 1 (stage 1–10).
- Odblokowania i nawigacja ograniczone do stage 1–10; stage 10 **nie** odblokowuje areny 2.
- **Bez auto-zawijania**: po zaliczeniu stage 10 gracz zostaje na stage 10 (może go grindować
  dla score/SC — pod przyszły sklep za SC). Żadnego skoku na stage 1.
- Rozszerzalne: gdy dojdą areny → podbicie jednej stałej.

### Zmiany w kodzie

**`config.js`**:
- `AVAILABLE_ARENAS = 1`
- `PLAYABLE_STAGES = AVAILABLE_ARENAS * STAGES_PER_ARENA` (=10)

**`state.js`**:
- `carouselMove` — clamp do `[0, PLAYABLE_STAGES - 1]`
- `selectStageIndex` — clamp do `[0, PLAYABLE_STAGES - 1]`
- `arenaMove` — clamp areny do `[0, AVAILABLE_ARENAS - 1]` (przy 1 arenie = no-op)
- `finishDescent` — odblokowanie: `if (s.stars >= 1 && next < PLAYABLE_STAGES && !unlocked) unlock`
- `returnHome` — auto-advance: `if (cleared && next < PLAYABLE_STAGES && unlocked) advance`
  (dla stage 10: `next = 10`, nie `< 10` → brak skoku → gracz zostaje na stage 10)

**`render.js`** (polish):
- Gdy `AVAILABLE_ARENAS <= 1` — ukryj/wygaś strzałki zmiany areny (żeby nie sugerować nawigacji).

---

## C. Fix tutoriala kotwicy (wymuszony ruch obok haka)

### Problem
`placeAccessory` wkłada kotwicę w pierwszy wolny slot (`findFreeRun` = skan od lewej-góry).
Gdy ten slot trafia **obok** brązowego haka, kotwica łączy się od razu (`computeHookStats`
adjacency → `maxLatch 2`), więc krok tutoriala "Przeciągnij Kotwicę obok Brązowego haka" się
nie odpala — gra przeskakuje do "Połączone!". Niespójne UX.

### Docelowe zachowanie
Podczas tutoriala kotwica **zawsze** ląduje w slocie **nie sąsiadującym** z brązowym hakiem,
więc gracz musi ją przeciągnąć obok — niezależnie od pozycji haka.

### Zmiany w kodzie

**`logic/backpack.js`**:
- Nowy helper `findFreeRunAvoiding(grid, w, avoidId)` — pierwszy wolny ciąg `w` komórek,
  którego żadna komórka nie sąsiaduje (4-kier.) z komórką zawierającą `avoidId`.
  Fallback: gdy brak takiego ciągu → `findFreeRun(grid, w)` (żeby nigdy nie zablokować włożenia).

**`state.js`** (`placeAccessory`):
- Jeśli `itemId === 'anchor' && !s.progress.tutAnchorDone` → użyj
  `findFreeRunAvoiding(s.grid, w, 'bronze')` zamiast `findFreeRun`.
- W pozostałych przypadkach — bez zmian (`findFreeRun`).

Render tutoriala (`drawTutorial`) już obsługuje krok "przeciągnij obok haka" (gdy kotwica
w gridzie, `maxLatch < 2`) — po tej zmianie odpali się niezawodnie.

---

## Testy (node --test, `tests/`)

**A** (`tests/sim.test.js` / nowe):
- muskie zaczepiony brązem: pasek → 0 → −1 serce, ryba w `state==='escaped'`, poza `latched`, HP > 0
- odpięta ryba (recatchLeft=1) po buforze re-latchuje na kontakt; HP kontynuowane (bez resetu)
- drugie zerwanie: −1 serce, `escapeFast=true`, `recatchLeft=0`, brak re-latchu na kontakt
- dobicie drenującej ryby przed zerwaniem → `durability === durabilityMax`, serca bez zmian
- jeden muskie = max 2 stracone serca (nie 3)

**B** (`tests/state.test.js`):
- `arenaMove(+1)` z areny 0 → nadal arena 0
- `selectStageIndex(15)` → clamp do 9
- clear stage 10 (idx 9) → `returnHome` zostawia `stageIndex === 9` (brak zawijania), stage 11 nie odblokowany

**C** (`tests/backpack.test.js` / `state.test.js`):
- `placeAccessory('anchor')` przy `tutAnchorDone=false` z brązem w gridzie → kotwica NIE sąsiaduje z brązem
- po tutorialu (`tutAnchorDone=true`) → placement wg `findFreeRun` (bez zmian)

---

## Poza zakresem (YAGNI)
- Rakietnica nie namierza `escaped` (bez zmian — pościg jest ręczny).
- Wizual `escaped` (przygaszenie ryby) — opcjonalny, nie wymagany do działania.
- Sklep za SC — przyszłość, tylko motywacja dla braku zawijania.
