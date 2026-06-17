import { STARTER_HOOK, ITEMS, BACKPACK, WORLD, STAGES, CHEST_SC } from './config.js';
import { createGrid, placeItem } from './logic/backpack.js';
import { computeScore, computeStars } from './logic/scoring.js';
import { loadProgress, saveProgress } from './persistence.js';

// Staty haka = hak bazowy + akcesoria POŁĄCZONE z hakiem (adjacency: spójny
// komponent ortogonalny zawierający hak). Akcesoria odłączone NIE dają efektu.
// null = brak haka w plecaku.
export function computeHookStats(grid) {
  const { cells, cols, rows } = grid;
  let hookIdx = -1;
  for (let i = 0; i < cells.length; i++) {
    const it = cells[i] && ITEMS[cells[i]];
    if (it && it.kind === 'hook') { hookIdx = i; break; }
  }
  if (hookIdx < 0) return null;
  // flood-fill po zajętych, ortogonalnie sąsiednich polach od haka
  const seen = new Set([hookIdx]); const stack = [hookIdx];
  while (stack.length) {
    const idx = stack.pop(), r = Math.floor(idx / cols), c = idx % cols;
    const nb = [];
    if (r > 0) nb.push(idx - cols);
    if (r < rows - 1) nb.push(idx + cols);
    if (c > 0) nb.push(idx - 1);
    if (c < cols - 1) nb.push(idx + 1);
    for (const n of nb) if (!seen.has(n) && cells[n]) { seen.add(n); stack.push(n); }
  }
  const hook = ITEMS[cells[hookIdx]];
  const stats = {
    atk: hook.atk, zwrotnosc: hook.zwrotnosc,
    szybkoscOpadania: hook.szybkoscOpadania, maxLatch: hook.maxLatch,
  };
  for (const idx of seen) {
    if (idx === hookIdx) continue;
    const it = ITEMS[cells[idx]]; if (!it) continue;
    stats.atk += it.atk || 0;
    stats.zwrotnosc += it.zwrotnosc || 0;
    stats.szybkoscOpadania += it.szybkoscOpadania || 0;
    stats.maxLatch += it.maxLatch || 0;
  }
  return stats;
}

export function createGame() {
  const progress = loadProgress(STAGES.length);
  const grid = progress.grid
    ? { cols: BACKPACK.cols, rows: BACKPACK.rows, cells: [...progress.grid] }
    : createGrid(BACKPACK.cols, BACKPACK.rows);
  return {
    mode: 'HOME',
    stageIndex: 0,
    progress,
    grid,
    hook: computeHookStats(grid),
    chestReveal: null,    // aktualnie otwierana skrzynka (overlay Home)
    bpDrag: null,         // przeciągany item w plecaku { fromIdx, id, x, y }
    bpSelected: null,     // akcesorium wybrane do podglądu opisu (id)
    // pola descentu (resetowane w startStage)
    lives: 3, depthPx: 0, stunned: 0, stunnedPoints: 0, coinsEarned: 0, score: 0, stars: 0,
    fish: [], latched: [], bubbles: [], spawnTimer: 0, stageOffsetM: 0, fishQueue: [],
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
export function stageUnlocked(s, i = s.stageIndex) {
  return !!(s.progress.stages[i] && s.progress.stages[i].unlocked);
}
export function openBackpack(s) { if (s.mode === 'HOME') s.mode = 'BACKPACK'; }
export function closeBackpack(s) {
  if (s.mode !== 'BACKPACK') return;
  s.mode = 'HOME';
  if (s.hook && s.hook.maxLatch >= 2 && !s.progress.tutAnchorDone) {
    s.progress.tutAnchorDone = true; saveProgress(s.progress);  // zobaczył komunikat o połączeniu
  }
}
export function returnHome(s) { s.mode = 'HOME'; }

// --- plecak: hak (tutorial) + akcesoria ---
export function placeHook(s, col, row) {
  if (s.hook) return false;
  if (!placeItem(s.grid, STARTER_HOOK.id, col, row)) return false;
  s.hook = computeHookStats(s.grid);
  persist(s);
  return true;
}

// Wkłada akcesorium z ekwipunku w pierwsze wolne pole (placement aktywuje efekt).
export function placeAccessory(s, itemId) {
  if (!s.progress.inventory[itemId]) return false;
  const idx = s.grid.cells.indexOf(null);
  if (idx < 0) return false;
  s.grid.cells[idx] = itemId;
  s.progress.inventory[itemId] -= 1;
  if (s.progress.inventory[itemId] <= 0) delete s.progress.inventory[itemId];
  s.hook = computeHookStats(s.grid);
  s.bpSelected = null;
  persist(s);
  return true;
}

// wybór akcesorium do podglądu opisu (nie wkłada — to robi przycisk WŁÓŻ)
export function selectAccessory(s, id) { s.bpSelected = id; }

// Swobodne przesuwanie w gridzie: przenieś (na puste) lub zamień (swap).
export function moveItem(s, fromIdx, toIdx) {
  const cells = s.grid.cells;
  if (fromIdx === toIdx || !cells[fromIdx]) return false;
  if (toIdx < 0 || toIdx >= cells.length) return false;
  const tmp = cells[toIdx];
  cells[toIdx] = cells[fromIdx];
  cells[fromIdx] = tmp;
  s.hook = computeHookStats(s.grid);
  persist(s);
  return true;
}

// --- skrzynka (otwierana na Home) ---
export function openChest(s) {
  if (s.progress.pendingChests <= 0) return null;
  s.progress.pendingChests -= 1;
  const reward = { sc: CHEST_SC, anchor: false };
  s.progress.coins += CHEST_SC;
  if (!s.progress.gotAnchor) {           // pierwsza skrzynka WYMUSZA Kotwicę
    s.progress.inventory.anchor = (s.progress.inventory.anchor || 0) + 1;
    s.progress.gotAnchor = true;
    reward.anchor = true;
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
  const stage = STAGES[s.stageIndex];
  s.stageOffsetM = stage.difficultyOffsetM;
  // worek ryb easy->hard (spawn bierze z przodu) — gwarantuje pulę i max score
  const bag = [];
  for (const t of ['plotka', 'sredniak', 'twardziel']) {
    for (let k = 0; k < (stage.bag[t] || 0); k++) bag.push(t);
  }
  s.fishQueue = bag;
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
  const thr = STAGES[s.stageIndex].stars;
  s.stars = computeStars(s.score, thr);
  const st = s.progress.stages[s.stageIndex];
  const prevStars = st.stars;
  st.bestScore = Math.max(st.bestScore, s.score);
  st.stars = Math.max(st.stars, s.stars);
  s.progress.coins += s.coinsEarned;
  let newUnlock = false;
  const next = s.stageIndex + 1;
  if (s.stars >= 1 && next < STAGES.length && !s.progress.stages[next].unlocked) {
    s.progress.stages[next].unlocked = true;
    newUnlock = true;
  }
  let chestEarned = false;                 // skrzynka JEDNORAZOWA: clear z ≥1★, raz na stage
  if (reason === 'cleared' && s.stars >= 1 && !st.chestClaimed) {
    s.progress.pendingChests += 1; st.chestClaimed = true; chestEarned = true;
  }
  saveProgress(s.progress);
  s.lastResult = {
    stars: s.stars, score: s.score, stunned: s.stunned, coins: s.coinsEarned,
    newUnlock, improved: s.stars > prevStars, cleared: reason === 'cleared', chestEarned,
  };
}
