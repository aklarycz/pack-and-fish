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
  dur: 2,                // wytrzymałość (rating = max paska). Ryby z atk > dur zdzierają pasek.
  zwrotnosc: 280,        // px/s dryfu L/P
  szybkoscOpadania: 40,  // px/s opadania (łagodny scroll w górę, by nie przebijał pływania ryb)
  maxLatch: 1,           // ile ryb naraz hak zaczepia (akcesoria dodają +)
  w: 1, h: 1,
};

// Mechanika wytrzymałości: podczas zacięcia ryba z atk A > durability D haka zdziera pasek
// w tempie DRAIN_K·(A−D)/s. Pasek do zera = −1 serce + odnowienie paska (walczysz dalej). 3 serca = koniec.
export const DRAIN_K = 0.42;
export const GRAB_DELAY = 0.15; // s kontaktu zanim ryba się zaczepi (pozwala odprowadzić hak od muskie)

// Zerwanie żyłki: ryba drenująca pasek, której nie dobito w obrębie JEDNEGO paska, odpada z haka
// (state 'escaped') i ucieka. Można ją zaczepić RECATCH_LIMIT razy ponownie; potem ucieka szybko.
export const RECATCH_LIMIT = 1;        // ile razy odpiętą rybę można zaczepić ponownie
export const RECATCH_LOCK = 2.0;       // s bufora po zerwaniu zanim ryba może znów się zaczepić (tarcza widoczna)
export const ESCAPE_SPEED_SLOW = 35;   // px/s ucieczki po 1. zerwaniu (świat, ku powierzchni)
export const ESCAPE_SPEED_FAST = 160;  // px/s ucieczki po 2. zerwaniu (bez re-latchu)

// Akcesoria. `slots` = ile komórek gridu (poziomo) zajmuje item — tacklebox 3×3 = 9 slotów
// pojemności, więc itemy wieloslotowe to wybór builda. `mount` = jak rysuje się na żyłce:
// 'hook' (kotwica/brąz: terminalny hak na dole) lub 'side' (gadżet na ramieniu ciężarka).
// Efekt połączenia (maxLatch/+ryba) liczy się TYLKO gdy akcesorium połączone (adjacency) z hakiem.
// Brązowy hak — startowe akcesorium (z tutoriala): +3 atk (rusty 1 + brąz 3 = 4).
export const BRONZE_HOOK = {
  id: 'bronze', name: 'Brązowy hak', kind: 'accessory', mount: 'hook', rarity: 'uncommon',
  atk: 3, dur: 4, slots: 1, w: 1, h: 1, desc: '+3 atk, +4 wytrzymałości (na haku)',
};
// Kotwica — z 1. skrzyni: +1 jednoczesny zaczep (po połączeniu) + 2 atk. BEZ wytrzymałości —
// ta idzie z Odważnika (stage 4). Dzięki większemu atk muskie łowialny od stage 2, ale kosztem serca.
export const ANCHOR = {
  id: 'anchor', name: 'Kotwica', kind: 'accessory', mount: 'hook', rarity: 'rare',
  maxLatch: 1, atk: 2, slots: 1, w: 1, h: 1, desc: '+2 atk, +1 ryba naraz (połącz z hakiem)',
};
// Wyrzutnia rakiet — z 2. skrzyni: AUTONOMICZNA (działa niezależnie od połączenia). Co `rocketInterval` s
// namierza najbliższą rybę (zaczepioną lub nie), nakłada mark i zdejmuje `rocketDmg` hp. Zajmuje 2 sloty.
export const ROCKET = {
  id: 'rocket', name: 'Wyrzutnia rakiet', kind: 'accessory', mount: 'side', rarity: 'epic',
  slots: 2, w: 2, h: 1, rocketDmg: 4, rocketInterval: 2,
  desc: 'Co 2 s: 4 dmg do najbliższej ryby (działa też na zaczepioną). 2 sloty.',
};
// Odważnik — ze skrzyni za stage 3: +2 wytrzymałości (komfort vs mocne ryby). Wisi na żyłce (sinker).
export const WEIGHT = {
  id: 'weight', name: 'Odważnik', kind: 'accessory', mount: 'sinker', rarity: 'rare',
  dur: 2, slots: 1, w: 1, h: 1, desc: '+2 wytrzymałości haka',
};

// Rzadkości — kolor tła slotu pod ikoną itemu (sygnał siły). common→epic→legendary.
export const RARITY = {
  common:    { name: 'Common',    bg: '#33414f', edge: '#71808f' },
  uncommon:  { name: 'Uncommon',  bg: '#1d4a2c', edge: '#46c46a' },
  rare:      { name: 'Rare',      bg: '#1b3a63', edge: '#4f96e6' },
  epic:      { name: 'Epic',      bg: '#3a2356', edge: '#a96cf0' },
  legendary: { name: 'Legendary', bg: '#5a3a12', edge: '#f5a623' },
};

// Rejestr itemów (lookup po id z gridu plecaka).
export const ITEMS = {
  [STARTER_HOOK.id]: STARTER_HOOK,
  [BRONZE_HOOK.id]: BRONZE_HOOK,
  [ANCHOR.id]: ANCHOR,
  [ROCKET.id]: ROCKET,
  [WEIGHT.id]: WEIGHT,
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

// Czas lotu pocisku rakietnicy (s) — większy = wolniejszy pocisk. (2× wolniej: 0.32 → 0.64)
export const ROCKET_FLIGHT = 0.64;

// 3 archetypy. `hp` = ile dmg trzeba zadać hakiem (łów). `atk` = jak mocno szarpie: jeśli atk > durability
// haka, zdziera pasek wytrzymałości (DRAIN_K·(atk−dur)/s). scoreValue liczy się przy ogłuszeniu.
export const FISH_TYPES = {
  // speed = pozioma prędkość pływania (px/s). coins (merge) oddzielone od scoreValue (score). radius +20%.
  // bass (mała): szybka, UCIEKA; łatwa (niski hp, atk poniżej każdego haka → zero drenażu).
  plotka:    { id: 'plotka',    hp: 6,  atk: 1,  speed: 108, aggroRange: 130, radius: 44, color: '#7fd1ff', scoreValue: 1, coins: 1, behavior: 'flee' },
  // sum (średnia): UCIEKA; atk 2 ≤ durability każdego haka → bezpieczny do łowienia.
  sredniak:  { id: 'sredniak',  hp: 12, atk: 2,  speed: 72,  aggroRange: 150, radius: 76, color: '#ffd166', scoreValue: 3, coins: 3, behavior: 'flee' },
  // muskie (duża): ATAKUJE hak. atk 10 > dur brązu (6) → zrywa żyłkę (bramka na upgrade).
  // Stage 1 (brąz, atk4): niełowialny, ucieka. Stage 2 (kotwica, atk6): łowialny w 2 zaczepach = 1 serce.
  // Stage 4 (Odważnik, dur8): pasek starcza na dobicie → 0 serc. HP/atk STAŁE (bez skalowania głębokością).
  twardziel: { id: 'twardziel', hp: 32, atk: 10, speed: 90,  aggroRange: 210, radius: 119, color: '#ef476f', scoreValue: 6, coins: 8, behavior: 'attack' },
};

// Rampa wg głębokości (metry). Wartości interpolowane/progowane w ramp.js.
export const RAMP = {
  baseSpawnInterval: 1.4,   // s między spawnami na starcie
  minSpawnInterval: 0.45,   // sufit gęstości
  spawnTightenPerM: 0.004,  // o ile skraca się interwał na metr
  speedMulPerM: 0.006,      // HP jest STAŁE per gatunek (bez skalowania); skaluje się tylko prędkość
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

// Jawna kompozycja Areny 1 (przebalansowane przez game designera — patrz docs/balance-arena1.md):
// p/s/m = plotka/sredniak/muskie (suma = total: 20,25,...,65). Muskie ramp ⌈stage/2⌉ (1,1,2,2,3,3,4,4,5,5)
// — łagodniejszy niż dosłowne 1,3,5..., bo muskie są praktycznie niełowialne i 3 naraz = pewna strata żyć.
const ARENA1_STAGES = [
  { p: 15, s: 4,  m: 1, cap: 30, spawn: 2.30 },
  { p: 18, s: 6,  m: 1, cap: 34, spawn: 2.20 },
  { p: 20, s: 8,  m: 2, cap: 38, spawn: 2.10 },
  { p: 23, s: 10, m: 2, cap: 42, spawn: 2.00 },
  { p: 24, s: 13, m: 3, cap: 46, spawn: 1.90 },
  { p: 25, s: 17, m: 3, cap: 50, spawn: 1.80 },
  { p: 26, s: 20, m: 4, cap: 54, spawn: 1.75 },
  { p: 27, s: 24, m: 4, cap: 58, spawn: 1.70 },
  { p: 27, s: 28, m: 5, cap: 62, spawn: 1.65 },
  { p: 27, s: 33, m: 5, cap: 66, spawn: 1.60 },
];

// Progi gwiazdek wg REALNIE osiągalnego score per epoka sprzętu (nie % teoretycznego maxa).
// Naprawia "2 ostatnie ryby = 2 gwiazdki": T1 osiągalny plotką wszędzie, T2 wymaga sumów (rakietnica
// od stage 3 globalnie), T3 zawsze wymaga ulepszeń (muskie). hasRocket = gracz ma już rakietnicę.
function starThresholds(p, s, m, cap, hasRocket) {
  const P = p * 10, S = s * 30, M = m * 60, D = cap;
  return {
    t1: Math.round(D + 0.55 * P),
    t2: Math.round(D + 0.90 * P + (hasRocket ? 0.70 * S : 0)),
    t3: Math.round(D + P + S + 0.50 * M),
  };
}

// Generuje 10 stage'y areny. Arena 1 = jawna tabela (designer); areny 2-3 = heurystyka ze skalowanej bazy.
// Rakietnica dostępna od stage'a globalnego 3 (index 2) — po skrzyni za stage 2.
function buildArenaStages(base, arena, arenaIndex) {
  const stages = [];
  for (let i = 0; i < STAGES_PER_ARENA; i++) {
    const globalIndex = arenaIndex * STAGES_PER_ARENA + i;
    const hasRocket = globalIndex >= 2;
    let plotka, sredniak, muskie, depthCap, start;
    if (arenaIndex === 0) {
      const c = ARENA1_STAGES[i];
      plotka = c.p; sredniak = c.s; muskie = c.m; depthCap = c.cap; start = c.spawn;
    } else {
      const mult = 1 + i * 0.10;
      plotka = Math.round(base.plotka * mult);
      sredniak = Math.round(base.sredniak * mult);
      muskie = i < base.muskieFrom ? 0 : base.muskie + Math.floor((i - base.muskieFrom) * 0.3);
      depthCap = base.depthCap + i * 2;
      start = Math.max(base.spawnMin, base.spawnStart - i * 0.05);
    }
    const bag = { plotka, sredniak, twardziel: muskie };
    const difficultyOffsetM = base.offsetM + i * 2;
    stages.push({
      arenaId: arena.id, arenaName: arena.name, bg: arena.bg, no: i + 1,
      difficultyOffsetM, bag, spawn: { start, min: start, perM: base.perM }, depthCap,
      stars: starThresholds(plotka, sredniak, muskie, depthCap, hasRocket),
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

// Ile aren jest realnie dostępnych (mają content). Reszta zablokowana w nawigacji.
// Zwiększ, gdy dojdą areny 2/3. PLAYABLE_STAGES = górna granica nawigacji/odblokowań.
export const AVAILABLE_ARENAS = 1;
export const PLAYABLE_STAGES = AVAILABLE_ARENAS * STAGES_PER_ARENA;

// Płaska lista wszystkich stage'y (index globalny = arena*10 + lokalny).
export const STAGES = ARENAS.flatMap((a, idx) => buildArenaStages(a.base, a, idx));

// Pomocniki mapowania global<->arena/lokalny.
export function arenaOf(globalIndex) { return Math.floor(globalIndex / STAGES_PER_ARENA); }
export function localOf(globalIndex) { return globalIndex % STAGES_PER_ARENA; }

export const BACKPACK = {
  cols: 3,
  rows: 3,
  cell: 96,        // px komórki
};

// Poziomy tackleboxa — pojemność (cols×rows) rośnie z lepszym tackleboxem. Ikona pod gridem
// i rozmiar gridu biorą się z bieżącego poziomu (progress.tackleboxTier). Tier 0 = start (3×3).
export const TACKLEBOX_TIERS = [
  { cols: 3, rows: 3, name: 'Stary tacklebox', body: '#3c4a3a', trim: '#caa24a' },
  { cols: 4, rows: 3, name: 'Tacklebox podróżny', body: '#33485a', trim: '#7fc6ff' },
  { cols: 4, rows: 4, name: 'Tacklebox mistrza', body: '#46365a', trim: '#c08bff' },
];
export function tackleboxOf(tier) { return TACKLEBOX_TIERS[Math.max(0, Math.min(TACKLEBOX_TIERS.length - 1, tier || 0))]; }
