import { SCORE, STARS } from '../config.js';

// stunnedPoints = suma scoreValue ogłuszonych ryb (wołający podaje już zsumowane jednostki).
export function computeScore(depthMeters, stunnedPoints) {
  const depthPart = Math.min(depthMeters * SCORE.wDepth, SCORE.depthCeil);
  return Math.round(depthPart + stunnedPoints * SCORE.wStun);
}

export function computeStars(score, thresholds = STARS) {
  if (score >= thresholds.t3) return 3;
  if (score >= thresholds.t2) return 2;
  if (score >= thresholds.t1) return 1;
  return 0;
}
