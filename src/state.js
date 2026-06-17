import { STARTER_HOOK, BACKPACK, WORLD, STAGES } from './config.js';
import { createGrid, placeItem } from './logic/backpack.js';
import { computeScore, computeStars } from './logic/scoring.js';
import { loadProgress, saveProgress } from './persistence.js';

// Tryby: HOME (wybór stage'a + plecak) | BACKPACK (układanie/tutorial) |
//        DESCENT (rozgrywka) | END (wynik stage'a)
export function createGame() {
  const progress = loadProgress(STAGES.length);
  const grid = createGrid(BACKPACK.cols, BACKPACK.rows);
  let hook = null;
  if (progress.hookEquipped) { placeItem(grid, STARTER_HOOK.id, 0, 0); hook = { ...STARTER_HOOK }; }
  return {
    mode: 'HOME',
    stageIndex: 0,        // wybór w karuzeli
    progress,
    grid,
    hook,
    // pola descentu (resetowane w startStage)
    lives: 3, depthPx: 0, stunned: 0, stunnedPoints: 0, score: 0, stars: 0,
    fish: [], latched: null, bubbles: [], spawnTimer: 0, stageOffsetM: 0,
    lastResult: null,     // wynik ostatniego descentu na end-screen
  };
}

function recompute(s) {
  s.score = computeScore(s.depthPx / WORLD.pxPerMeter, s.stunnedPoints);
}

// --- nawigacja Home ---
export function carouselMove(s, dir) {
  s.stageIndex = Math.max(0, Math.min(STAGES.length - 1, s.stageIndex + dir));
}

export function stageUnlocked(s, i = s.stageIndex) {
  return !!(s.progress.stages[i] && s.progress.stages[i].unlocked);
}

export function openBackpack(s) { if (s.mode === 'HOME') s.mode = 'BACKPACK'; }
export function closeBackpack(s) { if (s.mode === 'BACKPACK') s.mode = 'HOME'; }
export function returnHome(s) { s.mode = 'HOME'; }

// --- plecak / hak (tutorial: pierwszy hak) ---
export function placeHook(s, col, row) {
  if (s.hook) return false;
  if (!placeItem(s.grid, STARTER_HOOK.id, col, row)) return false;
  s.hook = { ...STARTER_HOOK };
  s.progress.hookEquipped = true;
  saveProgress(s.progress);
  return true;
}

// --- start rozgrywki na wybranym stage ---
export function startStage(s) {
  if (s.mode !== 'HOME') return false;
  if (!s.hook) return false;                 // wymaga haka (tutorial w plecaku)
  if (!stageUnlocked(s)) return false;
  s.lives = 3; s.depthPx = 0; s.stunned = 0; s.stunnedPoints = 0; s.score = 0; s.stars = 0;
  s.fish = []; s.latched = null; s.bubbles = []; s.spawnTimer = 0;
  s.stageOffsetM = STAGES[s.stageIndex].difficultyOffsetM;
  s.mode = 'DESCENT';
  return true;
}

export function addDepth(s, deltaPx) {
  if (s.mode !== 'DESCENT') return;
  s.depthPx += deltaPx;
  recompute(s);
}

export function registerStun(s, fishType) {
  s.stunned += 1;
  s.stunnedPoints += fishType.scoreValue;
  recompute(s);
}

export function registerEscape(s) {
  s.lives -= 1;
  if (s.lives <= 0) { s.lives = 0; finishDescent(s); }
}

function finishDescent(s) {
  s.mode = 'END';
  recompute(s);
  const thr = STAGES[s.stageIndex].stars;
  s.stars = computeStars(s.score, thr);
  const st = s.progress.stages[s.stageIndex];
  const prevStars = st.stars;
  st.bestScore = Math.max(st.bestScore, s.score);
  st.stars = Math.max(st.stars, s.stars);
  let newUnlock = false;
  const next = s.stageIndex + 1;
  if (s.stars >= 1 && next < STAGES.length && !s.progress.stages[next].unlocked) {
    s.progress.stages[next].unlocked = true;
    newUnlock = true;
  }
  saveProgress(s.progress);
  s.lastResult = { stars: s.stars, score: s.score, stunned: s.stunned, newUnlock, improved: s.stars > prevStars };
}
