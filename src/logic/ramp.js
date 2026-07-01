import { RAMP } from '../config.js';

export function difficultyAt(depthMeters) {
  const spawnInterval = Math.max(
    RAMP.minSpawnInterval,
    RAMP.baseSpawnInterval - depthMeters * RAMP.spawnTightenPerM
  );
  const speedMul = 1 + depthMeters * RAMP.speedMulPerM;
  const band = RAMP.mix.find(b => depthMeters <= b.maxDepth) ?? RAMP.mix[RAMP.mix.length - 1];
  return { spawnInterval, speedMul, mix: { ...band.weights } };
}
