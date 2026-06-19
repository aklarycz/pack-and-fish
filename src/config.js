// Wszystkie liczby tuningowe w jednym miejscu. Plaster 2 dokłada itemy i modyfikuje staty.
// Layout zależny od rozdzielczości — wartości domyślne dla 540x720, nadpisywane
// przez layoutWorld() na podstawie realnego rozmiaru canvasa (uniwersalne).
export const WORLD = {
  W: 540,
  H: 720,
  pxPerMeter: 40,
  topBarH: 56,           // pasek HUD u góry (score/życia/głębia) — hak tu nie wchodzi
  hookMinX: 40,
  hookMaxX: 500,
  hookMinY: 80,          // tuż pod top barem
  hookMaxY: 330,         // dolna granica pasma; pasmo ruchu haka = 250 px (hookMaxY - hookMinY)
  hookStartY: 205,       // startowa pozycja Y haka (środek pasma)
};

// Proporcje (ułamki ekranu) — utrzymują spójny układ niezależnie od rozdzielczości.
const TOP_BAR_FRAC = 56 / 720;     // ~0.078 wysokości
const SIDE_FRAC = 40 / 540;        // ~0.074 szerokości (margines boczny)
const HOOK_GAP_FRAC = 24 / 720;    // odstęp pasma pod top barem
const HOOK_BAND_FRAC = 250 / 720;  // wysokość pasma ruchu haka (250 px @ 720)

// Przelicza layout z realnego rozmiaru canvasa. Wołane na starcie i przy resize.
// Mutuje WORLD w miejscu, żeby wszystkie importy (render/sim/input/fish) widziały zmianę.
export function layoutWorld(W, H) {
  WORLD.W = W;
  WORLD.H = H;
  WORLD.topBarH = Math.round(H * TOP_BAR_FRAC);
  const side = Math.round(W * SIDE_FRAC);
  WORLD.hookMinX = side;
  WORLD.hookMaxX = W - side;
  WORLD.hookMinY = WORLD.topBarH + Math.round(H * HOOK_GAP_FRAC);
  WORLD.hookMaxY = WORLD.hookMinY + Math.round(H * HOOK_BAND_FRAC);
  WORLD.hookStartY = Math.round((WORLD.hookMinY + WORLD.hookMaxY) / 2);
}

// Startowy hak = item w plecaku. GOŁY (zardzewiały) jest celowo bardzo słaby: atk 1.
// Moc daje brązowy hak (akcesorium dawane od razu w tutorialu, +7 → 8). Można wypiąć wszystko
// i dalej zarzucić, ale wtedy atk1 (ledwo cokolwiek).
export const STARTER_HOOK = {
  id: 'rusty_hook',
  name: 'Zardzewiały hak',
  kind: 'hook',
  atk: 1,                // dmg/s — goły hak prawie nic nie ubija
  zwrotnosc: 280,        // px/s dryfu L/P
  szybkoscOpadania: 40,  // px/s opadania (łagodny scroll w górę, by nie przebijał pływania ryb)
  maxLatch: 1,           // ile ryb naraz hak zaczepia (akcesoria dodają +)
  w: 1, h: 1,
};

// Akcesoria. Efekt liczy się TYLKO gdy połączone (adjacency) z hakiem.
// Brązowy hak — startowe akcesorium (z tutoriala): +7 atk (rusty 1 + brąz 7 = 8 → łowi bass/sum).
export const BRONZE_HOOK = {
  id: 'bronze', name: 'Brązowy hak', kind: 'accessory',
  atk: 7, w: 1, h: 1, desc: '+7 atk (połącz z hakiem)',
};
// Kotwica — z 1. skrzyni: +1 jednoczesny zaczep oraz +1 atk.
export const ANCHOR = {
  id: 'anchor', name: 'Kotwica', kind: 'accessory',
  maxLatch: 1, atk: 1, w: 1, h: 1, desc: '+1 ryba naraz, +1 atk (połącz z hakiem)',
};

// Rejestr itemów (lookup po id z gridu plecaka).
export const ITEMS = {
  [STARTER_HOOK.id]: STARTER_HOOK,
  [BRONZE_HOOK.id]: BRONZE_HOOK,
  [ANCHOR.id]: ANCHOR,
};

// Nagroda ze skrzynki za ukończenie stage (≥1★). Pierwsza skrzynka wymusza Kotwicę.
export const CHEST_SC = 120;

// Czas całej sekwencji po STARCIE (s): najpierw animacja zarzutu Tofu (CAST_ANIM),
// potem zjazd kamery + kurtyna z krzaków, na końcu zejście pod wodę.
export const CAST_DUR = 1.9;
export const CAST_ANIM = 1.2; // ile z tego trwa sama animacja zarzutu (reszta = zjazd/kurtyna)

// Nieskończone schodzenie — łowisko nie kończy się po wyczerpaniu worka (ryby dolewają się
// wg głębokości, descentCleared nie odpala). NA STAGE'ACH WYŁĄCZONE (skończona liczba ryb —
// inaczej łatwo przegrać). Przyszły osobny tryb: endless z rankingami i nagrodami za best.
export const TEST_ENDLESS_DESCENT = false;
// TRYB TESTOWY: zdejmuje granicę sterowania hakiem (pasmo hookMinX/Max, hookMinY/Max) —
// hak można prowadzić po całym ekranie. Ustaw false, by wrócić do normalnego pasma ruchu.
export const TEST_FREE_HOOK = true;

// 3 archetypy: jedna oś = HP vs okno. scoreValue liczy się przy ogłuszeniu.
export const FISH_TYPES = {
  // speed = pozioma prędkość pływania (px/s). Wyższa niż szybkoscOpadania, żeby
  // ruch w bok DOMINOWAŁ nad scrollem opadania → ryby czytają się jak pływające.
  // coins (waluta do merge) oddzielone od scoreValue (do score).
  // okna szersze (łapanie z zapasem, nie "na styk"); radius powiększany etapami (większe ryby, ostatnio +15%).
  // bass (mała): szybka, UCIEKA od haka; łatwa do złapania (niski hp)
  plotka:    { id: 'plotka',    hp: 6,  window: 2.6, speed: 108, aggroRange: 130, radius: 37, color: '#7fd1ff', scoreValue: 1, coins: 1, behavior: 'flee' },
  // sum (średnia): wolniejszy, UCIEKA; łowialny bazowym brązem (atk8·okno3.6 = 28.8 dmg)
  // przez cały stage — na ~40m hp = 20·1.24 ≈ 25, margines ~4 (komfortowo, nie "na styk")
  sredniak:  { id: 'sredniak',  hp: 20, window: 3.6, speed: 72,  aggroRange: 150, radius: 63, color: '#ffd166', scoreValue: 3, coins: 3, behavior: 'flee' },
  // muskie (duża): ATAKUJE hak, NIE DO ZŁAPANIA bazowym sprzętem (8·2.4=19.2 ≪ 40; z kotwicą 9·2.4=21.6 ≪ 40)
  twardziel: { id: 'twardziel', hp: 40, window: 2.4, speed: 90,  aggroRange: 210, radius: 99, color: '#ef476f', scoreValue: 6, coins: 8, behavior: 'attack' },
};

// Rampa wg głębokości (metry). Wartości interpolowane/progowane w ramp.js.
export const RAMP = {
  baseSpawnInterval: 1.4,   // s między spawnami na starcie
  minSpawnInterval: 0.45,   // sufit gęstości
  spawnTightenPerM: 0.004,  // o ile skraca się interwał na metr
  hpMulPerM: 0.006,         // wzrost HP na metr (zmniejszone z 0.012 — sumy były niełowialne
                            // pod koniec stage'a: na ~40m ×1.46 dawało hp 29 > atk8·okno 27.2.
                            // Teraz ×1.24 → hp ~25, łowialne gołym brązem przez cały stage)
  speedMulPerM: 0.006,
  // miks archetypów: udział twardzieli/średniaków rośnie z głębokością
  mix: [
    { maxDepth: 8,   weights: { plotka: 1.0, sredniak: 0.0, twardziel: 0.0 } },
    { maxDepth: 20,  weights: { plotka: 0.6, sredniak: 0.4, twardziel: 0.0 } },
    { maxDepth: 40,  weights: { plotka: 0.4, sredniak: 0.4, twardziel: 0.2 } },
    { maxDepth: Infinity, weights: { plotka: 0.25, sredniak: 0.4, twardziel: 0.35 } },
  ],
};

// Score: ryby są głównym źródłem (wStun ×10), głębia ma SUFIT poniżej progu 1★
// (anti dodge-stall). depthCap jest per-stage; depthCeil = fallback.
export const SCORE = {
  wDepth: 1.0,     // pkt na metr
  wStun: 10.0,     // mnożnik scoreValue ryby (ryby dominują nad głębią)
  depthCeil: 60,   // domyślny sufit głębi (fallback gdy stage bez depthCap)
};

// Domyślne progi gwiazdek (fallback). T1 > depthCeil (gwarancja: sama głębia < 1★).
export const STARS = { t1: 80, t2: 200, t3: 380 };

// === ARENY × STAGE'Y (plaster 2 — meta) ===
// Arena = temat wizualny Home (tło + Tofu) i grupa 10 stage'y. Przełączanie stage'y
// w obrębie areny NIE zmienia sceny — zmienia ją dopiero przejście do innej areny.
// Wewnętrznie trzymamy PŁASKĄ listę STAGES (30 = 3 areny × 10): unlock/progres liczą się
// po globalnym indeksie (stage N+1 odblokowuje się po ≥1★ na N, także przez granicę areny).
export const STAGES_PER_ARENA = 10;

// Progi gwiazdek jako UŁAMKI teoretycznego maxa worka (depthCap + Σ scoreValue·wStun).
// 3★ ≈ 93% (złap prawie wszystko) — spójne i zawsze osiągalne, bez ręcznego strojenia.
const STAR_FRAC = { t1: 0.58, t2: 0.79, t3: 0.93 };

// Generuje 10 stage'y areny ze skalowanej bazy. muskie (twardziel) spawnuje się na KOŃCU worka
// (głęboko) i LICZY się do maxScore — bazowym hakiem go nie złapiesz, więc na MAX punktów (3★)
// trzeba ulepszeń (to celowa marchewka). Bare hookiem da się wyczyścić i zrobić ~2★.
// UWAGA: balans stage'y 2-10 jest heurystyczny — stage 1 trzyma sprawdzone liczby.
function buildArenaStages(base, arena) {
  const stages = [];
  for (let i = 0; i < STAGES_PER_ARENA; i++) {
    const mult = 1 + i * 0.10;
    const plotka = Math.round(base.plotka * mult);
    const sredniak = Math.round(base.sredniak * mult);
    // muskie (hazard) pojawia się od stage'a `muskieFrom` w danej arenie (w arenie 1 dopiero od 2.)
    const muskie = i < base.muskieFrom ? 0 : base.muskie + Math.floor((i - base.muskieFrom) * 0.3);
    const bag = { plotka, sredniak, twardziel: muskie };
    const difficultyOffsetM = base.offsetM + i * 2;
    const depthCap = base.depthCap + i * 2;
    const start = Math.max(base.spawnMin, base.spawnStart - i * 0.05);
    const maxScore = depthCap + // muskie WLICZONY — max wymaga ulepszeń (bare hook go nie ubije)
      (plotka * FISH_TYPES.plotka.scoreValue + sredniak * FISH_TYPES.sredniak.scoreValue
        + muskie * FISH_TYPES.twardziel.scoreValue) * SCORE.wStun;
    stages.push({
      arenaId: arena.id, arenaName: arena.name, bg: arena.bg, no: i + 1,
      difficultyOffsetM, bag, spawn: { start, min: start, perM: base.perM }, depthCap,
      stars: {
        t1: Math.round(maxScore * STAR_FRAC.t1),
        t2: Math.round(maxScore * STAR_FRAC.t2),
        t3: Math.round(maxScore * STAR_FRAC.t3),
      },
    });
  }
  return stages;
}

// 3 areny. `bg` = prefiks assetu sceny (arena-01-surface.png itd.). Tylko arena-01 ma art;
// pozostałe pokazują tintowany fallback do czasu dodania grafik.
export const ARENAS = [
  { id: 1, name: 'Przybrzeże', bg: 'arena-01', tint: ['#16406e', '#0b2138'],
    base: { plotka: 10, sredniak: 6,  muskie: 1, muskieFrom: 0, offsetM: 0,  depthCap: 30, spawnStart: 2.3, spawnMin: 2.3, perM: 0 } },
  { id: 2, name: 'Toń',        bg: 'arena-02', tint: ['#114b5f', '#06222b'],
    base: { plotka: 12, sredniak: 10, muskie: 2, muskieFrom: 0, offsetM: 12, depthCap: 40, spawnStart: 1.9, spawnMin: 1.4, perM: 0.008 } },
  { id: 3, name: 'Głębia',     bg: 'arena-03', tint: ['#2a2a5e', '#0a0a22'],
    base: { plotka: 10, sredniak: 16, muskie: 3, muskieFrom: 0, offsetM: 25, depthCap: 50, spawnStart: 1.6, spawnMin: 1.1, perM: 0.01 } },
];
export const ARENA_COUNT = ARENAS.length;

// Płaska lista wszystkich stage'y (index globalny = arena*10 + lokalny).
export const STAGES = ARENAS.flatMap(a => buildArenaStages(a.base, a));

// Pomocniki mapowania global<->arena/lokalny.
export function arenaOf(globalIndex) { return Math.floor(globalIndex / STAGES_PER_ARENA); }
export function localOf(globalIndex) { return globalIndex % STAGES_PER_ARENA; }

export const BACKPACK = {
  cols: 3,
  rows: 3,
  cell: 96,        // px komórki
};
