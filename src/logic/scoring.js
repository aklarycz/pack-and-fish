import { SCORE, STARS } from '../config.js';

// stunnedPoints = suma scoreValue ogłuszonych ryb (wołający podaje już zsumowane jednostki).
// depthCap = sufit wkładu głębi (per-stage; domyślnie SCORE.depthCeil).
export function computeScore(depthMeters, stunnedPoints, depthCap = SCORE.depthCeil) {
  const depthPart = Math.min(depthMeters * SCORE.wDepth, depthCap);
  return Math.round(depthPart + stunnedPoints * SCORE.wStun);
}

export function computeStars(score, thresholds = STARS) {
  if (score >= thresholds.t3) return 3;
  if (score >= thresholds.t2) return 2;
  if (score >= thresholds.t1) return 1;
  return 0;
}
