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

// Startowy hak = item w plecaku. Celowo SŁABY (patrz spec: nie stroimy pod "fun solo").
export const STARTER_HOOK = {
  id: 'rusty_hook',
  name: 'Zardzewiały hak',
  kind: 'hook',
  atk: 8,                // dmg/s zadawany zaczepionej rybie
  zwrotnosc: 280,        // px/s dryfu L/P
  szybkoscOpadania: 40,  // px/s opadania (łagodny scroll w górę, by nie przebijał pływania ryb)
  maxLatch: 1,           // ile ryb naraz hak zaczepia (akcesoria dodają +)
  w: 1, h: 1,
};

// Akcesoria (plaster 2). Efekt liczy się TYLKO gdy połączone (adjacency) z hakiem.
// Kotwica = "hak z 2 haków": +1 jednoczesny zaczep oraz +1 atk (raw, jak hak).
export const ANCHOR = {
  id: 'anchor', name: 'Kotwica', kind: 'accessory',
  maxLatch: 1, atk: 1, w: 1, h: 1, desc: '+1 ryba naraz, +1 atk (połącz z hakiem)',
};

// Rejestr itemów (lookup po id z gridu plecaka).
export const ITEMS = {
  [STARTER_HOOK.id]: STARTER_HOOK,
  [ANCHOR.id]: ANCHOR,
};

// Nagroda ze skrzynki za ukończenie stage (≥1★). Pierwsza skrzynka wymusza Kotwicę.
export const CHEST_SC = 120;

// 3 archetypy: jedna oś = HP vs okno. scoreValue liczy się przy ogłuszeniu.
export const FISH_TYPES = {
  // speed = pozioma prędkość pływania (px/s). Wyższa niż szybkoscOpadania, żeby
  // ruch w bok DOMINOWAŁ nad scrollem opadania → ryby czytają się jak pływające.
  // coins (waluta do merge) oddzielone od scoreValue (do score).
  // okna szersze (łapanie z zapasem, nie "na styk"); radius +30% (większe ryby).
  plotka:    { id: 'plotka',    hp: 6,  window: 2.6, speed: 70,  aggroRange: 130, radius: 21, color: '#7fd1ff', scoreValue: 1, coins: 1 },
  sredniak:  { id: 'sredniak',  hp: 12, window: 3.4, speed: 85,  aggroRange: 150, radius: 29, color: '#ffd166', scoreValue: 3, coins: 3 },
  twardziel: { id: 'twardziel', hp: 34, window: 2.4, speed: 100, aggroRange: 170, radius: 39, color: '#ef476f', scoreValue: 6, coins: 8 },
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

// Score: ryby są głównym źródłem (wStun ×10), głębia ma SUFIT poniżej progu 1★
// (anti dodge-stall). depthCap jest per-stage; depthCeil = fallback.
export const SCORE = {
  wDepth: 1.0,     // pkt na metr
  wStun: 10.0,     // mnożnik scoreValue ryby (ryby dominują nad głębią)
  depthCeil: 60,   // domyślny sufit głębi (fallback gdy stage bez depthCap)
};

// Domyślne progi gwiazdek (fallback). T1 > depthCeil (gwarancja: sama głębia < 1★).
export const STARS = { t1: 80, t2: 200, t3: 380 };

// Stage'y (plaster 2 — meta). Balans wg specu ekonomii:
// - bag = dokładny worek ryb (gwarantuje max score), spawnowany easy->hard;
// - spawn = krzywa interwału { start, min, perM } dopasowana do maxLatch;
// - depthCap = sufit wkładu głębi do score; stars = progi (3★ ≈ perfekcja).
// Stage 1 MUSI być 3★-owalny bazowym hakiem (kotwica jest dopiero z jego skrzyni),
// dlatego brak twardziela i stały, "łapalny" interwał.
export const STAGES = [
  { id: 1, name: 'Przybrzeże', difficultyOffsetM: 0,
    bag: { plotka: 10, sredniak: 6, twardziel: 0 },
    spawn: { start: 2.3, min: 2.3, perM: 0 },
    depthCap: 30, stars: { t1: 180, t2: 245, t3: 290 } },
  { id: 2, name: 'Toń',        difficultyOffsetM: 20,
    bag: { plotka: 6, sredniak: 10, twardziel: 6 },
    spawn: { start: 1.6, min: 1.2, perM: 0.01 },
    depthCap: 45, stars: { t1: 445, t2: 600, t3: 720 } },
  { id: 3, name: 'Głębia',     difficultyOffsetM: 45,
    bag: { plotka: 4, sredniak: 12, twardziel: 12 },
    spawn: { start: 1.3, min: 0.9, perM: 0.012 },
    depthCap: 60, stars: { t1: 690, t2: 940, t3: 1110 } },
];

export const BACKPACK = {
  cols: 3,
  rows: 3,
  cell: 96,        // px komórki
};
