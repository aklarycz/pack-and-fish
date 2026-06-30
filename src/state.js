import { STARTER_HOOK, ITEMS, BACKPACK, WORLD, STAGES, CHEST_SC, ARENA_COUNT, STAGES_PER_ARENA, arenaOf, localOf, tackleboxOf } from './config.js';
import { createGrid, placeItem, findFreeRun, itemOrigin, gridItems } from './logic/backpack.js';
import { computeScore, computeStars } from './logic/scoring.js';
import { loadProgress, saveProgress } from './persistence.js';

// Staty haka. Zardzewiały hak NIE jest itemem — to bazowe staty gracza (zawsze coś wisi na lince).
// Grid trzyma TYLKO akcesoria. RAW atk dolicza KAŻDE położone akcesorium (niezależnie od ułożenia).
// Bonusy "połączenia" (maxLatch / +ryba) liczą się tylko dla akcesoriów POŁĄCZONYCH (adjacency)
// z brązowym hakiem — czyli kotwica musi sąsiadować z brązowym hakiem, by dać +1 zacięcie.
// Zwraca ZAWSZE staty (nigdy null). hasBronze/hasAnchor = co jest położone (do wizualu).
export function computeHookStats(grid) {
  const { cells, cols, rows } = grid;
  let atk = STARTER_HOOK.atk, maxLatch = STARTER_HOOK.maxLatch, dur = STARTER_HOOK.dur;
  let bronzeIdx = -1, hasBronze = false, hasAnchor = false, hasWeight = false;
  let hasRocket = false, rocketDmg = 0, rocketInterval = 0;
  for (const { id, idx } of gridItems(grid, ITEMS)) {   // każdy item RAZ (nie per-komórka)
    const it = ITEMS[id];
    if (!it || it.kind !== 'accessory') continue;
    atk += it.atk || 0;                    // raw atk — zawsze
    dur += it.dur || 0;                    // raw wytrzymałość — zawsze
    if (it.id === 'bronze') { bronzeIdx = idx; hasBronze = true; }
    if (it.id === 'anchor') hasAnchor = true;
    if (it.id === 'weight') hasWeight = true;
    if (it.id === 'rocket') { hasRocket = true; rocketDmg = it.rocketDmg || 0; rocketInterval = it.rocketInterval || 0; }
  }
  if (bronzeIdx >= 0) { // komponent spójny (per-komórka) zawierający brązowy hak → bonus latch
    const seen = new Set([bronzeIdx]), stack = [bronzeIdx];
    while (stack.length) {
      const idx = stack.pop(), r = Math.floor(idx / cols), c = idx % cols, nb = [];
      if (r > 0) nb.push(idx - cols); if (r < rows - 1) nb.push(idx + cols);
      if (c > 0) nb.push(idx - 1); if (c < cols - 1) nb.push(idx + 1);
      for (const n of nb) { const it = cells[n] && ITEMS[cells[n]]; if (it && it.kind === 'accessory' && !seen.has(n)) { seen.add(n); stack.push(n); } }
    }
    const counted = new Set();             // maxLatch liczymy RAZ na item (po origin), nie per-komórka
    for (const i of seen) {
      const o = itemOrigin(grid, i);
      if (o < 0 || counted.has(o)) continue;
      counted.add(o);
      const it = ITEMS[cells[o]];
      if (it) maxLatch += it.maxLatch || 0;
    }
  }
  return { atk, maxLatch, dur, zwrotnosc: STARTER_HOOK.zwrotnosc, szybkoscOpadania: STARTER_HOOK.szybkoscOpadania, hasBronze, hasAnchor, hasWeight, hasRocket, rocketDmg, rocketInterval };
}

export function createGame() {
  const progress = loadProgress(STAGES.length);
  const tb = tackleboxOf(progress.tackleboxTier);   // pojemność gridu z poziomu tackleboxa
  const grid = (progress.grid && progress.grid.length === tb.cols * tb.rows)
    ? { cols: tb.cols, rows: tb.rows, cells: [...progress.grid] }
    : createGrid(tb.cols, tb.rows);                 // brak/zła długość (np. po upgrade) -> świeży grid
  return {
    mode: 'HOME',
    splash: true,         // ekran startowy (login Guest) — overlay nad HOME do kliknięcia "Graj jako Gość"
    stageIndex: 0,
    progress,
    grid,
    hook: computeHookStats(grid),
    chestReveal: null,    // aktualnie otwierana skrzynka (overlay Home)
    cast: null,           // animacja zarzutu po STARCIE { t } przed zejściem pod wodę
    reveal: null,         // kurtyna rozjeżdżająca się na starcie descentu { t }
    bpDrag: null,         // przeciągany item w plecaku { fromIdx, id, x, y }
    bpSelected: null,     // akcesorium wybrane do podglądu opisu (id)
    // pola descentu (resetowane w startStage)
    lives: 3, depthPx: 0, stunned: 0, stunnedPoints: 0, coinsEarned: 0, score: 0, stars: 0,
    fish: [], latched: [], bubbles: [], spawnTimer: 0, stageOffsetM: 0, fishQueue: [], endless: false,
    rockets: [], rocketCd: 0, rocketTarget: null, // wyrzutnia: pociski + cooldown + ZABLOKOWANY cel
    durability: 0, durabilityMax: 0, clearTimer: 0, // pasek wytrzymałości + opóźnienie końca stage'a
    lastResult: null,
  };
}

function recompute(s) {
  const cap = STAGES[s.stageIndex] ? STAGES[s.stageIndex].depthCap : undefined;
  s.score = computeScore(s.depthPx / WORLD.pxPerMeter, s.stunnedPoints, cap);
}

function persist(s) {
  s.progress.grid = [...s.grid.cells];
  s.progress.hookEquipped = !!s.hook;
  saveProgress(s.progress);
}

// --- nawigacja Home ---
export function carouselMove(s, dir) {
  s.stageIndex = Math.max(0, Math.min(STAGES.length - 1, s.stageIndex + dir));
}
// strzałki u góry: zmiana ARENY (skok o 10), zachowując lokalny stage. Zmienia scenę Home.
export function arenaMove(s, dir) {
  const arena = Math.max(0, Math.min(ARENA_COUNT - 1, arenaOf(s.stageIndex) + dir));
  s.stageIndex = arena * STAGES_PER_ARENA + localOf(s.stageIndex);
}
// pasek na dole: wybór konkretnego stage (global index) w obrębie bieżącej areny.
export function selectStageIndex(s, idx) {
  s.stageIndex = Math.max(0, Math.min(STAGES.length - 1, idx));
}
export function stageUnlocked(s, i = s.stageIndex) {
  return !!(s.progress.stages[i] && s.progress.stages[i].unlocked);
}
export function openBackpack(s) { if (s.mode === 'HOME') s.mode = 'BACKPACK'; }
export function closeBackpack(s) {
  if (s.mode !== 'BACKPACK') return;
  s.mode = 'HOME';
  let dirty = false;
  if (s.hook && s.hook.atk >= 4 && !s.progress.tutBronzeDone) { s.progress.tutBronzeDone = true; dirty = true; }
  if (s.hook && s.hook.maxLatch >= 2 && !s.progress.tutAnchorDone) { s.progress.tutAnchorDone = true; dirty = true; }
  if (dirty) saveProgress(s.progress);
}
export function returnHome(s) {
  // po ZALICZENIU stage'a przeskocz na kolejny odblokowany (gracz od razu gotowy do gry dalej)
  if (s.lastResult && s.lastResult.cleared) {
    const next = s.stageIndex + 1;
    if (next < STAGES.length && stageUnlocked(s, next)) s.stageIndex = next;
  }
  s.mode = 'HOME'; s.cast = null; s.reveal = null;
  s.lastResult = null;
}
// splash/login: wejście do gry jako Gość (zamyka overlay startowy)
export function loginGuest(s) { s.splash = false; }

// --- plecak: hak (tutorial) + akcesoria ---
export function placeHook(s, col, row) {
  if (s.hook) return false;
  if (!placeItem(s.grid, STARTER_HOOK.id, col, row)) return false;
  s.hook = computeHookStats(s.grid);
  persist(s);
  return true;
}

// Wkłada akcesorium z ekwipunku w pierwszy wolny CIĄG `slots` komórek (placement aktywuje efekt).
export function placeAccessory(s, itemId) {
  if (!s.progress.inventory[itemId]) return false;
  const w = (ITEMS[itemId] && ITEMS[itemId].slots) || 1;
  const idx = findFreeRun(s.grid, w);
  if (idx < 0) return false;                       // brak miejsca na item tej szerokości
  for (let k = 0; k < w; k++) s.grid.cells[idx + k] = itemId;
  s.progress.inventory[itemId] -= 1;
  if (s.progress.inventory[itemId] <= 0) delete s.progress.inventory[itemId];
  s.hook = computeHookStats(s.grid);
  s.bpSelected = null;
  persist(s);
  return true;
}

// wybór akcesorium z ekwipunku do podglądu (gridIdx=null → przycisk WŁÓŻ)
export function selectAccessory(s, id) { s.bpSelected = { id, gridIdx: null }; }
// wybór itemu W gridzie (tap, nie drag) → opis + WYPNIJ (jeśli akcesorium)
export function selectPlaced(s, gridIdx) {
  const id = s.grid.cells[gridIdx];
  if (id && ITEMS[id] && ITEMS[id].kind !== 'hook') s.bpSelected = { id, gridIdx }; // bazowego haka nie zaznaczamy
}
// wypnij akcesorium z gridu z powrotem do ekwipunku (haka nie wypinamy) — czyści cały footprint
export function unequipAccessory(s, gridIdx) {
  const o = itemOrigin(s.grid, gridIdx);
  if (o < 0) return false;
  const id = s.grid.cells[o], it = ITEMS[id];
  if (!it || it.kind === 'hook') return false;
  const w = it.slots || 1;
  for (let k = 0; k < w; k++) s.grid.cells[o + k] = null;
  s.progress.inventory[id] = (s.progress.inventory[id] || 0) + 1;
  s.hook = computeHookStats(s.grid);
  s.bpSelected = null;
  persist(s);
  return true;
}

// Przeniesienie itemu (z całym footprintem) na docelowy CIĄG komórek; anuluje gdy zajęte.
export function moveItem(s, fromIdx, toIdx) {
  const cells = s.grid.cells, cols = s.grid.cols;
  const o = itemOrigin(s.grid, fromIdx);
  if (o < 0 || toIdx < 0 || toIdx >= cells.length) return false;
  const id = cells[o], w = (ITEMS[id] && ITEMS[id].slots) || 1;
  const tr = Math.floor(toIdx / cols);
  let tc = toIdx % cols; if (tc + w > cols) tc = cols - w;   // clamp do szerokości wiersza
  const dest = tr * cols + tc;
  if (dest === o) return false;
  const self = new Set(); for (let k = 0; k < w; k++) self.add(o + k);
  for (let k = 0; k < w; k++) { const d = dest + k; if (cells[d] !== null && !self.has(d)) return false; }
  for (let k = 0; k < w; k++) cells[o + k] = null;
  for (let k = 0; k < w; k++) cells[dest + k] = id;
  s.hook = computeHookStats(s.grid);
  persist(s);
  return true;
}

// --- skrzynka (otwierana na Home) ---
export function openChest(s) {
  if (s.progress.pendingChests <= 0) return null;
  s.progress.pendingChests -= 1;
  const reward = { sc: CHEST_SC, anchor: false, rocket: false, weight: false };
  s.progress.coins += CHEST_SC;
  if (!s.progress.gotAnchor) {           // 1. skrzynka WYMUSZA Kotwicę
    s.progress.inventory.anchor = (s.progress.inventory.anchor || 0) + 1;
    s.progress.gotAnchor = true;
    reward.anchor = true;
  } else if (!s.progress.gotRocket) {    // 2. skrzynka WYMUSZA Wyrzutnię rakiet
    s.progress.inventory.rocket = (s.progress.inventory.rocket || 0) + 1;
    s.progress.gotRocket = true;
    reward.rocket = true;
  } else if (!s.progress.gotWeight) {    // 3. skrzynka WYMUSZA Odważnik
    s.progress.inventory.weight = (s.progress.inventory.weight || 0) + 1;
    s.progress.gotWeight = true;
    reward.weight = true;
  }
  saveProgress(s.progress);
  s.chestReveal = reward;
  return reward;
}
export function dismissChest(s) { s.chestReveal = null; }

// --- rozgrywka ---
export function startStage(s) {
  if (s.mode !== 'HOME') return false;
  if (!s.hook) return false;
  if (!stageUnlocked(s)) return false;
  s.lives = 3; s.depthPx = 0; s.stunned = 0; s.stunnedPoints = 0; s.coinsEarned = 0; s.score = 0; s.stars = 0;
  s.fish = []; s.latched = []; s.bubbles = []; s.spawnTimer = 0;
  s.rockets = []; s.rocketTarget = null; s.rocketCd = s.hook.hasRocket ? s.hook.rocketInterval : 0; // 1. strzał po interwale
  s.durabilityMax = s.hook.dur; s.durability = s.durabilityMax; s.clearTimer = 0; // pełna wytrzymałość na start
  const stage = STAGES[s.stageIndex];
  s.stageOffsetM = stage.difficultyOffsetM;
  // spawn MIESZANY (nie falami): każdej rybie losujemy pozycję w sekwencji z okna wg trudności —
  // bass dominuje na starcie, sumy dochodzą po chwili (mieszają się z bassami), muskie na sam koniec.
  const SPAWN_WIN = { plotka: [0.0, 0.82], sredniak: [0.28, 1.0], twardziel: [0.92, 1.0] };
  const items = [];
  for (const t of ['plotka', 'sredniak', 'twardziel']) {
    const w = SPAWN_WIN[t] || [0, 1];
    for (let k = 0; k < (stage.bag[t] || 0); k++) items.push({ t, key: w[0] + Math.random() * (w[1] - w[0]) });
  }
  items.sort((a, b) => a.key - b.key);
  s.fishQueue = items.map(it => it.t);
  s.mode = 'DESCENT';
  return true;
}

export function descentCleared(s) {
  if (s.mode === 'DESCENT') finishDescent(s, 'cleared');
}

export function addDepth(s, deltaPx) {
  if (s.mode !== 'DESCENT') return;
  s.depthPx += deltaPx;
  recompute(s);
}

export function registerStun(s, fishType) {
  s.stunned += 1;
  s.stunnedPoints += fishType.scoreValue;
  s.coinsEarned += fishType.coins;         // monety = osobne pole (nie scoreValue)
  recompute(s);
}

export function registerEscape(s) {
  s.lives -= 1;
  if (s.lives <= 0) { s.lives = 0; finishDescent(s, 'fail'); }
}

function finishDescent(s, reason = 'fail') {
  s.mode = 'END';
  recompute(s);
  const st = s.progress.stages[s.stageIndex];
  const prevStars = st.stars;
  s.progress.coins += s.coinsEarned;       // złowione ryby = zarobione monety (nawet przy przegranej)
  let newUnlock = false, chestEarned = false;
  if (reason === 'cleared') {              // tylko WYCZYSZCZENIE łowiska liczy gwiazdki/progres
    s.stars = computeStars(s.score, STAGES[s.stageIndex].stars);
    st.bestScore = Math.max(st.bestScore, s.score);
    st.stars = Math.max(st.stars, s.stars);
    const next = s.stageIndex + 1;
    if (s.stars >= 1 && next < STAGES.length && !s.progress.stages[next].unlocked) {
      s.progress.stages[next].unlocked = true; newUnlock = true;
    }
    if (s.stars >= 1 && !st.chestClaimed) {          // skrzynka JEDNORAZOWA: clear z ≥1★
      s.progress.pendingChests += 1; st.chestClaimed = true; chestEarned = true;
    }
  } else {
    s.stars = 0;                           // PRZEGRANA (utrata 3 żyć) — 0 gwiazdek, bez odblokowania/skrzyni
  }
  saveProgress(s.progress);
  s.lastResult = {
    stars: s.stars, score: s.score, stunned: s.stunned, coins: s.coinsEarned,
    newUnlock, improved: s.stars > prevStars, cleared: reason === 'cleared', chestEarned,
  };
}
