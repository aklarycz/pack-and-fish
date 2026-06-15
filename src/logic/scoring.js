import { SCORE, STARS } from '../config.js';

// stunnedPoints = suma scoreValue ogłuszonych ryb (wołający podaje już zsumowane jednostki).
export function computeScore(depthMeters, stunnedPoints) {
  const depthPart = Math.min(depthMeters * SCORE.wDepth, SCORE.depthCeil);
  return Math.round(depthPart + stunnedPoints * SCORE.wStun);
}

export function computeStars(score) {
  if (score >= STARS.t3) return 3;
  if (score >= STARS.t2) return 2;
  if (score >= STARS.t1) return 1;
  return 0;
}
