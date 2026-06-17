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
  atk: 8,                // dmg/s zadawany zaczepionej rybie
  zwrotnosc: 280,        // px/s dryfu L/P
  szybkoscOpadania: 40,  // px/s opadania (łagodny scroll w górę, by nie przebijał pływania ryb)
  w: 1, h: 1,
};

// 3 archetypy: jedna oś = HP vs okno. scoreValue liczy się przy ogłuszeniu.
export const FISH_TYPES = {
  // speed = pozioma prędkość pływania (px/s). Wyższa niż szybkoscOpadania, żeby
  // ruch w bok DOMINOWAŁ nad scrollem opadania → ryby czytają się jak pływające.
  plotka:    { id: 'plotka',    hp: 6,  window: 2.0, speed: 70,  aggroRange: 130, radius: 16, color: '#7fd1ff', scoreValue: 1 },
  sredniak:  { id: 'sredniak',  hp: 14, window: 2.2, speed: 85,  aggroRange: 150, radius: 22, color: '#ffd166', scoreValue: 3 },
  twardziel: { id: 'twardziel', hp: 34, window: 2.0, speed: 100, aggroRange: 170, radius: 30, color: '#ef476f', scoreValue: 6 },
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

// Domyślne progi gwiazdek (fallback). T1 > depthCeil (gwarancja: sama głębia < 1★).
export const STARS = { t1: 80, t2: 200, t3: 380 };

// Stage'y (plaster 2 — meta). Różnią się trudnością (difficultyOffsetM przesuwa
// rampę: stage startuje "głębiej") i progami gwiazdek. ≥1★ odblokowuje kolejny.
export const STAGES = [
  { id: 1, name: 'Przybrzeże', difficultyOffsetM: 0,  stars: { t1: 60,  t2: 140, t3: 240 } },
  { id: 2, name: 'Rafa',       difficultyOffsetM: 18, stars: { t1: 80,  t2: 170, t3: 290 } },
  { id: 3, name: 'Głębia',     difficultyOffsetM: 36, stars: { t1: 100, t2: 200, t3: 340 } },
];

export const BACKPACK = {
  cols: 3,
  rows: 3,
  cell: 96,        // px komórki
};
