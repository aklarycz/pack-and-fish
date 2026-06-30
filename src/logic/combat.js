export function startLatch(fish) {
  fish.state = 'latched';
}

// Zwraca 'ongoing' | 'stunned'. Brak okna/ucieczki — ryba łowiona gdy HP spadnie do 0.
// Ryzyko = pasek wytrzymałości haka (drenowany osobno w sim, gdy ryba.atk > hook.dur).
export function tickLatch(fish, atk, dt) {
  fish.hp -= atk * dt;
  if (fish.hp <= 0) { fish.state = 'stunned'; return 'stunned'; }
  return 'ongoing';
}
