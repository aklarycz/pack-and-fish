import { FISH_TYPES, WORLD } from './config.js';

export function inAggroRange(fish, hookX, hookWorldY, types = FISH_TYPES) {
  const t = types[fish.type];
  const dx = fish.x - hookX;
  const dy = fish.y - hookWorldY;
  return Math.hypot(dx, dy) <= t.aggroRange;
}

// Aktualizuje pozycję ryby. hookWorldY = depthPx + hookStartY (świat). speedMul z rampy.
export function updateFish(fish, hookX, hookWorldY, dt, speedMul) {
  if (fish.state === 'stunned' || fish.state === 'escaped' || fish.state === 'latched') return;
  const t = FISH_TYPES[fish.type];
  const speed = t.speed * speedMul;
  if (fish.state === 'patrol') {
    fish.x += fish.dir * speed * 0.5 * dt;
    if (fish.x < WORLD.hookMinX) { fish.x = WORLD.hookMinX; fish.dir = 1; }
    if (fish.x > WORLD.hookMaxX) { fish.x = WORLD.hookMaxX; fish.dir = -1; }
    if (inAggroRange(fish, hookX, hookWorldY)) fish.state = 'aggro';
  } else if (fish.state === 'aggro') {
    const dx = hookX - fish.x;
    const dy = hookWorldY - fish.y;
    const len = Math.hypot(dx, dy) || 1;
    fish.x += (dx / len) * speed * dt;
    fish.y += (dy / len) * speed * dt;
  }
}
