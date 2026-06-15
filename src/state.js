import { STARTER_HOOK, BACKPACK, WORLD } from './config.js';
import { createGrid, placeItem } from './logic/backpack.js';
import { computeScore, computeStars } from './logic/scoring.js';

export function createGame() {
  return {
    mode: 'BACKPACK',
    lives: 3,
    depthPx: 0,
    stunned: 0,
    stunnedPoints: 0,
    score: 0,
    stars: 0,
    fish: [],
    latched: null,
    grid: createGrid(BACKPACK.cols, BACKPACK.rows),
    hook: null,
  };
}

function recompute(s) {
  s.score = computeScore(s.depthPx / WORLD.pxPerMeter, s.stunnedPoints);
}

export function placeHook(s, col, row) {
  if (s.hook) return false;
  if (!placeItem(s.grid, STARTER_HOOK.id, col, row)) return false;
  s.hook = { ...STARTER_HOOK };
  return true;
}

export function startDescent(s) {
  if (!s.hook || s.mode !== 'BACKPACK') return false;
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
  if (s.lives <= 0) {
    s.lives = 0;
    s.mode = 'END';
    recompute(s);
    s.stars = computeStars(s.score);
  }
}
