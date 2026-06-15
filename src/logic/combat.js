export function startLatch(fish) {
  fish.state = 'latched';
  fish.windowLeft = fish.window;
}

// Zwraca 'ongoing' | 'stunned' | 'escaped'. HP sprawdzane PRZED oknem (remis = stun).
export function tickLatch(fish, atk, dt) {
  fish.hp -= atk * dt;
  fish.windowLeft -= dt;
  if (fish.hp <= 0) { fish.state = 'stunned'; return 'stunned'; }
  if (fish.windowLeft <= 0) { fish.state = 'escaped'; return 'escaped'; }
  return 'ongoing';
}
