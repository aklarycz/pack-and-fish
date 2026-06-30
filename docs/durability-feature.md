# Durability / pasek wytrzymałości — walidacja mechaniki

Status: walidacja + design + liczby gotowe do configa. Kod NIE edytowany.
Bazuje na realnym kodzie: `config.js`, `combat.js`, `sim.js`, `state.js`, `scoring.js`, `fish.js`.

REWIZJA (3 decyzje): (1) ODRZUCONO GATE_MARGIN — czysta atrycja, muskie bazowym sprzętem zżera
3 serca w ~89% czasu na ubicie HP. (2) Soft-lock rozwiązany przez UNIKALNY latch. (3) Nowe
akcesorium "odważnik" (+2 dur) ze skrzyni za stage 3.

---

## 1. Werdykt

Ficzer jest **spójny i grywalny** w modelu czystej atrycji ("walcz dalej + −1 serce", bez twardego
progu ucieczki), POD WARUNKIEM rozwiązania soft-locka z §2 (latch musi być unikalny — inaczej stage 1
jest nieprzechodzalny bazowym sprzętem i gracz nigdy nie zdobędzie kotwicy).

Bramka na upgrade działa teraz przez DRAMATURGIĘ, nie przez twardy próg: bazowym sprzętem prawie
dorywasz muskie, ale pęka ostatnie serce tuż przed jego HP→0. Gracz widzi "było blisko — z lepszym
hakiem dam radę". To czytelniejszy i mniej karzący komunikat niż "linka zerwana, za słaby sprzęt".

Co działa dobrze:
- Brak okna czasowego — komunikat "ryba za mocna na sprzęt", nie "przegrałem bo zegar".
- Atrycja na jednym pasku (całe zejście) — napięcie narasta, muskie pojawia się na końcu puli
  (`SPAWN_WIN.twardziel = [0.92, 1.0]`, `state.js:216`) jako klimaks zjazdu.
- Dwie osie progresji: atk haka (HP/s, jak szybko łowisz) i durability (jak długo wytrzymujesz
  szarpanie). Rozłączne wektory upgrade'u = głębsze decyzje w plecaku.

---

## 2. Soft-lock — rozwiązanie (REKOMENDACJA: unikalny latch)

Problem: muskie spawnuje OSTATNI w worku, latch jest dziś AUTOMATYCZNY (`sim.js:88-93`: kontakt
`r+8` = zaczepienie). Skoro bazowym sprzętem muskie zżera 3 serca i NIE da się go pokonać, a nie da
się go nie zaczepić → stage 1 nieprzechodzalny → brak kotwicy → soft-lock.

**Rekomendacja: wariant (a) — UNIKALNY latch.** Hak zaczepia rybę tylko na intencję gracza, nie
automatycznie. Gracz może odprowadzić hak od muskie; muskie niezaczepiony schodzi z ekranu, pula
się czyści, stage liczy się jako `cleared` mimo niepokonanego muskie.

Dlaczego (a), nie (b):
- (b) "muskie nie blokuje cleared / descentCleared mimo niepokonanego muskie" — wymaga sztucznej
  reguły "ta ryba się nie liczy do wyczyszczenia", co jest nieczytelne i kruche (co z 2 muskie?
  co gdy gracz CHCE walczyć?). (a) jest emergentne: muskie schodzi bo nikt go nie złapał — to już
  działa dla każdej ryby która wypłynie poza ekran (`sim.js:142` filtruje ryby poza widokiem).
- (a) czyni bramkę DECYZJĄ gracza: "podejmę walkę i ryzykuję serca, czy odpuszczę?". To jest sedno
  ryzyka, które ma realizować ten ficzer. Z auto-latchem gracz nie ma sprawczości — to czyste karanie.

Co to znaczy dla kodu (`sim.js:85-95`):
- Dziś: `if (s.latched.length < maxLatch && (patrol|aggro) && ...) { startLatch }` — zaczepia każdą
  rybę w promieniu `r+8` automatycznie.
- Po zmianie: latch wymaga, by hak był blisko ryby ORAZ gracz nie odprowadzał haka aktywnie od niej.
  Najprostsza implementacja zgodna z obecnym sterowaniem (hak prowadzony pozycyjnie): zaczepiaj tylko
  gdy hak ZBLIŻA SIĘ do ryby (wektor ruchu haka skierowany ku rybie) lub gdy gracz trzyma hak na
  rybie przez krótki "grab delay" (np. 0.15 s kontaktu). Odprowadzenie haka = brak zaczepienia.
- ALTERNATYWNIE (minimalna zmiana): zmniejszyć promień latcha dla muskie (`radius 119` to dużo —
  hak musi go niemal dotknąć, by zaczepić), tak by łatwo było go ominąć. To słabsze (przypadkowy
  kontakt nadal latchuje), ale tanie. Rekomenduję pełny unikalny latch (grab delay), bo daje pełną
  sprawczość i jest spójny dla wszystkich gatunków.

`descentCleared` (`sim.js:146`, `state.js:228`) nie wymaga zmian — odpala gdy
`fishQueue` pusty + `fish` pusty + `latched` pusty. Niezaczepiony muskie wypływa za ekran
(`sim.js:142`), znika z `s.fish`, warunek się spełnia. Działa out-of-the-box po unikalnym latchu.

Konsekwencja dla gwiazdek: jeśli gracz odpuszcza muskie, nie zdobywa jego punktów → niższy score →
brak 3★. To jest POŻĄDANE: 3★ wymaga pokonania muskie (= wymaga lepszego sprzętu). 1★/2★ osiągalne
bez muskie (plotka/sum). Spójne z `starThresholds` (`config.js:178-185`).

---

## 3. Konkretne liczby — pkt 1 (atrycja dramatyczna)

### Cel
Bazowy sprzęt stage 1 = sam brązowy hak: durability **D=6**, atk haka **4**.
Muskie ma zdrenować 3 serca w **~89%** czasu potrzebnego na ubicie HP (prawie dorwany, pęka ostatnie).

### Wzór drenażu (bez zmian w formie)
```
if (A > D)  durabilityBar -= DRAIN_K * (A - D) * dt
durabilityBar == 0  ->  -1 serce, pasek = D (max), walcz dalej z TĄ SAMĄ rybą
3 serca == 0  ->  koniec gry
```

### Liczby
```
FISH_TYPES.twardziel.hp  = 48     // było 40
FISH_TYPES.twardziel.atk = 10     // NOWE (siła szarpania)
DRAIN_K = 0.42
```

### Weryfikacja celu (bazowy sprzęt: D=6, atk haka 4)
- Czas ubicia HP: `T_kill = hp / atk = 48 / 4 = 12.0 s`
- Rate drenażu: `r = DRAIN_K · (A − D) = 0.42 · (10 − 6) = 1.68` dur/s
- Czas jednego serca (pełny pasek D=6): `D / r = 6 / 1.68 = 3.57 s`
- Trzy serca: `3 · 3.57 = 10.71 s`
- Stosunek: `10.71 / 12.0 = 0.893` → **89.3%** ✓ (cel 85-95%)

Czyli: walcząc bazowym sprzętem z muskie, gracz drenuje 1. serce po 3.6 s, 2. po 7.1 s, 3. (koniec gry)
po 10.7 s — a HP muskie spada do zera dopiero w 12.0 s. Pęka ostatnie serce ~1.3 s przed łupem.
Dokładnie "prawie go miałem".

Uwaga rampa głębi: muskie spawnuje na końcu zjazdu, gdzie `hpMul = 1 + 0.006·m` podbija HP (np. na
~40 m efektywnych ×1.24 → hp ~60). To WYDŁUŻA `T_kill` (60/4 = 15 s), więc 3 serca (10.7 s, drenaż
nie zależy od głębi) padają jeszcze WCZEŚNIEJ względem łupu → stosunek spada do ~71%. To OK i nawet
korzystne: głębsze muskie jest jeszcze trudniejszy, bramka mocniejsza. Liczba 89% odnosi się do muskie
na powierzchni (pesymistyczny przypadek dla bramki — najłatwiejszy muskie i tak nie do pokonania).

### atk haka i HP plotki/suma — BEZ ZMIAN
atk haka 1/4/5 (rusty/+brąz/+kotwica) — zachowane (wymóg). hp plotka 6, sum 12 — bez zmian.

### atk ryb (siła szarpania)
```
FISH_TYPES.plotka.atk    = 1     // A < D zawsze -> 0 drenażu
FISH_TYPES.sredniak.atk  = 2     // A <= D zawsze -> 0 drenażu
FISH_TYPES.twardziel.atk = 10    // A > D na każdym tierze -> drenaż, skala bramki w §4
```

---

## 4. Durability per tier + bramka muskie (pkt 3: odważnik)

### Progresja durability
```
STARTER_HOOK.dur = 2     // goły hak
BRONZE_HOOK.dur  = 4     // suma rusty+brąz = 6   (sprzęt stage 1)
ANCHOR.dur       = 3     // suma = 9              (po skrzyni za stage 1/2)
WEIGHT.dur       = 2     // suma = 11             (po skrzyni za stage 3)  <- NOWE
```

Sumowanie analogiczne do `atk` w `computeHookStats` (`state.js:11-23`). Max paska = D (bieżąca suma).

### Nowe akcesorium "odważnik"
```
export const WEIGHT = {
  id: 'weight', name: 'Odważnik', kind: 'accessory', mount: 'side', rarity: 'rare',
  dur: 2, slots: 1, w: 1, h: 1, desc: '+2 wytrzymałość linki',
};
```
- Rzadkość: **rare** (nie epic). Uzasadnienie: to czysty stat-stick (+2 dur, bez nowej mechaniki),
  podczas gdy rakietnica = epic bo wnosi autonomiczny tor obrażeń. Hierarchia: uncommon (brąz) <
  rare (kotwica, odważnik) < epic (rakietnica). Odważnik na poziomie kotwicy — oba to liniowe staty.
- `mount: 'side'` (na ramieniu ciężarka, jak rakietnica) — nie konkuruje wizualnie o terminalny hak.
- Zajmuje 1 slot — tani w buildzie, ale konkuruje o miejsce z rakietnicą (2 sloty) w gridzie 3×3.

### Bramka muskie per tier (muskie hp48 powierzchnia, A=10, DRAIN_K=0.42)

| Tier | D | atk haka | T_kill = 48/atk | r = 0.42·(10−D) | czas 3 serc = 3·D/r | 3 serca / T_kill | werdykt |
|---|---|---|---|---|---|---|---|
| +brąz (stage 1)        | 6  | 4 | 12.0 s | 1.68 | 10.71 s | 0.89 | **przegrana** (pęka ostatnie serce) |
| +kotwica               | 9  | 5 | 9.6 s  | 0.42 | 64.3 s  | 6.70 | **wygrana z zapasem** — pasek prawie nie spada |
| +odważnik (stage 3)    | 11 | 5 | 9.6 s  | 0.0 (A=10<11) | ∞ | ∞ | **wygrana bezpiecznie** — ZERO drenażu |

Wnioski:
- **Bramka pęka przy KOTWICY, nie przy odważniku.** Z D=9 nadwyżka A−D = 1 → rate 0.42 dur/s →
  jeden pasek trzyma 21 s, znacznie dłużej niż 9.6 s na ubicie HP. Muskie staje się łowialny już
  z kotwicą, tracąc co najwyżej 0 serc (pasek nie zdąży pęknąć raz). To znaczy: skrzynia za stage 1/2
  (kotwica) JEST kluczem do muskie. Odważnik (stage 3) to komfort — czyni muskie zupełnie bezpiecznym
  (A=10 < D=11 → zero drenażu).
- Rakietnica NIE jest wymagana do pokonania muskie (kotwica wystarcza), ale przyspiesza: dokłada
  ~2 dps osobnym torem (`sim.js:122-137`), skracając `T_kill` z 9.6 s na ~6.9 s. Z kotwicą+rakietnicą
  muskie pada szybko i bez ryzyka serc. To dobry "power fantasy" za skompletowanie sprzętu.

Gdyby bramka miała trzymać AŻ do odważnika (gdybyś chciał muskie niezłowialny kotwicą):
podbij muskie A do 13 → przy D=9 nadwyżka 4, rate 1.68, 3 serca = 16 s vs T_kill 9.6 s → przegrana
z kotwicą; przy D=11 nadwyżka 2, rate 0.84, 3 serca = 39 s vs 9.6 s → wygrana. Wtedy odważnik =
prawdziwa bramka. REKOMENDACJA: zostaw A=10 (bramka na kotwicy) — kotwica przychodzi wcześniej
(skrzynia stage 1/2) i lepiej trzyma pacing "pierwszy muskie pokonany w okolicach stage 3-4".
Odważnik jako QoL/komfort jest zdrowszy niż druga twarda bramka tak blisko pierwszej.

---

## 5. Reconcyliacja z gwiazdkami

`starThresholds` (`config.js:178-185`): 3★ = depthCap + P + S + 0.5·M, wymaga ~połowy muskie.
Po zmianach:
- 1★ / 2★ — plotka/sum, A≤D → zero drenażu, durability nieistotne. **Progi bez zmian.**
- 3★ — wymaga muskie → wymaga ≥ kotwicy (bramka §4). Spójne: 3★ = sprzęt z 1-2 skrzyń.
- Soft-lock fix (§2, unikalny latch): gracz BEZ kotwicy odpuszcza muskie, czyści stage na 1★/2★,
  zdobywa skrzynię → kotwicę → wraca po 3★. Pętla progresji domknięta, **bez soft-locka**.

Muskie hp 40→48: drobne podbicie wartości łupu nieuzasadnione automatycznie. `scoreValue 6` /
`coins 8` zostają — score muskie nie zależy od HP. **Progi gwiazdek bez zmian.** Jeśli playtest
pokaże 3★ za łatwy z kotwicą+rakietnicą, najtańszy tuning: muskie A 10→13 (bramka skacze na odważnik,
§4) — bez ruszania progów.

---

## 6. Podsumowanie liczb (gotowe do configa)

```
// hak — durability (NOWE pola)
STARTER_HOOK.dur = 2
BRONZE_HOOK.dur  = 4    // suma 6  (stage 1)
ANCHOR.dur       = 3    // suma 9
WEIGHT.dur       = 2    // suma 11 (stage 3)   <- nowe akcesorium, rarity: 'rare', mount:'side', slots:1

// ryby — atk = siła szarpania (NOWE)
FISH_TYPES.plotka.atk    = 1
FISH_TYPES.sredniak.atk  = 2
FISH_TYPES.twardziel.atk = 10

// ryby — HP
FISH_TYPES.twardziel.hp  = 48      // było 40 (kalibracja atrycji 89%)

// stała mechaniki
DRAIN_K = 0.42                     // rate = DRAIN_K * (A - D)  [durability/s]

// skrzynie: stage1 -> kotwica, stage2 -> rakietnica, stage3 -> odważnik (openChest, state.js:184-201)

// BEZ ZMIAN: atk haka (1/4/5), rakietnica (osobny tor), progi gwiazdek, hp plotki/suma, hpMul
// USUNĄĆ: GATE_MARGIN (odrzucony), FISH_TYPES.*.window + logika windowLeft w combat.js (tickLatch)
// ZMIANA KODU: latch UNIKALNY (sim.js:88-93) — grab delay ~0.15 s / kierunek ruchu haka ku rybie,
//              by gracz mógł odprowadzić hak i nie zaczepić muskie (rozwiązuje soft-lock)
```

### Kontrola spójności trzech decyzji
1. Atrycja: bazowy sprzęt vs muskie powierzchnia = 89.3% (3 serca w 10.71 s vs łup w 12.0 s). ✓
2. Soft-lock: unikalny latch → muskie odpuszczalny → stage cleared na 1★/2★ → kotwica → bramka otwarta. ✓
3. Odważnik: +2 dur (suma 11), rare, stage 3; bramka muskie pęka już na kotwicy (D=9), odważnik =
   komfort (D=11 → zero drenażu na muskie). ✓
```
