import { FISH_TYPES } from '../config.js';
import { difficultyAt } from './ramp.js';

const ORDER = ['plotka', 'sredniak', 'twardziel'];

export function pickFishType(depthMeters, rng = Math.random) {
  const mix = difficultyAt(depthMeters).mix;
  const total = ORDER.reduce((s, id) => s + (mix[id] || 0), 0) || 1;
  let r = rng() * total;
  for (const id of ORDER) {
    r -= (mix[id] || 0);
    if (r < 0) return id;
  }
  return ORDER[0];
}

export function createFish(typeId, depthMeters, x) {
  const t = FISH_TYPES[typeId];
  const hp = Math.round(t.hp * difficultyAt(depthMeters).hpMul);
  return {
    type: typeId, x, y: 0, hp, hpMax: hp, window: t.window, windowLeft: 0,
    state: 'patrol', dir: x < 270 ? 1 : -1, bubbleY: 0,
  };
}
