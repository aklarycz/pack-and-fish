import { FISH_TYPES, WORLD } from './config.js';

// Ryba może wypłynąć trochę poza krawędź ekranu, dopiero potem zawraca.
const EDGE_MARGIN = 60;

export function inAggroRange(fish, hookX, hookWorldY, types = FISH_TYPES) {
  const t = types[fish.type];
  const dx = fish.x - hookX;
  const dy = fish.y - hookWorldY;
  return Math.hypot(dx, dy) <= t.aggroRange;
}

// Aktualizuje pozycję ryby. hookWorldY = depthPx + hookStartY (świat). speedMul z rampy.
export function updateFish(fish, hookX, hookWorldY, dt, speedMul, rng = Math.random) {
  if (fish.state === 'stunned' || fish.state === 'escaped' || fish.state === 'latched') return;
  const t = FISH_TYPES[fish.type];
  const speed = t.speed * speedMul;
  fish.t = (fish.t || 0) + dt;

  // baseY = stała głębokość ryby (świat). Pion to TYLKO delikatny bujak wokół niej —
  // brak dryfu w pionie, żeby ruch ryby w górę po ekranie wynikał wyłącznie ze
  // schodzenia kamery (wrażenie zanurzania haka, nie "ryby płynące do góry").
  if (fish.baseY === undefined) fish.baseY = fish.y;

  if (fish.state === 'patrol') {
    // ruch GŁÓWNIE poziomy — gładko zmienna prędkość driftu
    const driftMod = 0.45 + Math.sin(fish.t * 0.6 + (fish.phaseX || 0)) * 0.3;
    fish.x += fish.dir * speed * driftMod * dt;
    // delikatny bujak pionowy (anti-sync przez phase offset)
    fish.y = fish.baseY + Math.sin(fish.t * 1.4 + (fish.phaseY || 0)) * (fish.bobAmp || 6);
    // losowy zwrot co kilka sekund — naturalna nawigacja
    fish.turnTimer = (fish.turnTimer ?? 3) - dt;
    if (fish.turnTimer <= 0) {
      if (rng() < 0.35) fish.dir = -fish.dir;
      fish.turnTimer = 2 + rng() * 4;
    }
    // soft turnaround za krawędzią — ryba może chwilę popływać poza
    if (fish.x < WORLD.hookMinX - EDGE_MARGIN) fish.dir = 1;
    if (fish.x > WORLD.hookMaxX + EDGE_MARGIN) fish.dir = -1;
    if (inAggroRange(fish, hookX, hookWorldY)) fish.state = 'aggro';
  } else if (fish.state === 'aggro') {
    // poza zasięgiem → wraca do patrolu (nie ciągnie się za hakiem w nieskończoność)
    if (!inAggroRange(fish, hookX, hookWorldY)) { fish.state = 'patrol'; return; }
    // natarcie GŁÓWNIE poziome: dopływa do kolumny haka. Pion zostawiamy
    // opadającemu hakowi (który i tak schodzi przez głębokość ryby) — tylko bujak.
    const dx = hookX - fish.x;
    fish.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * 1.3 * dt);
    fish.y = fish.baseY + Math.sin(fish.t * 2.0 + (fish.phaseY || 0)) * (fish.bobAmp || 6) * 0.4;
  }
}
