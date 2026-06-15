import { RAMP } from '../config.js';

export function difficultyAt(depthMeters) {
  const spawnInterval = Math.max(
    RAMP.minSpawnInterval,
    RAMP.baseSpawnInterval - depthMeters * RAMP.spawnTightenPerM
  );
  const hpMul = 1 + depthMeters * RAMP.hpMulPerM;
  const speedMul = 1 + depthMeters * RAMP.speedMulPerM;
  const band = RAMP.mix.find(b => depthMeters <= b.maxDepth) ?? RAMP.mix[RAMP.mix.length - 1];
  return { spawnInterval, hpMul, speedMul, mix: { ...band.weights } };
}
