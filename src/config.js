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
