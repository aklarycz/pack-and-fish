import { FISH_TYPES, WORLD, ESCAPE_SPEED_SLOW, ESCAPE_SPEED_FAST } from './config.js';

// Ryba może wypłynąć tylko TROCHĘ poza pasmo haka — i tak musi zostać w zasięgu połowu
// (clamp na końcu updateFish), żeby uciekająca ryba nie zniknęła z ekranu poza zasięgiem.
const EDGE_MARGIN = 30;

export function inAggroRange(fish, hookX, hookWorldY, types = FISH_TYPES) {
  const t = types[fish.type];
  const dx = fish.x - hookX;
  const dy = fish.y - hookWorldY;
  return Math.hypot(dx, dy) <= t.aggroRange;
}

// Aktualizuje pozycję ryby. hookWorldY = depthPx + hookStartY (świat). speedMul z rampy.
export function updateFish(fish, hookX, hookWorldY, dt, speedMul, rng = Math.random) {
  if (fish.state === 'stunned' || fish.state === 'latched') return;
  if (fish.state === 'escaped') {
    if (fish.recatchLock > 0) fish.recatchLock -= dt;
    const sp = fish.escapeFast ? ESCAPE_SPEED_FAST : ESCAPE_SPEED_SLOW;
    fish.y -= sp * dt;                                    // ku powierzchni (świat y maleje -> znika górą)
    fish.x += (fish.x < hookX ? -1 : 1) * sp * 0.4 * dt;  // lekki dryf od haka
    fish.x = Math.max(WORLD.hookMinX - EDGE_MARGIN, Math.min(WORLD.hookMaxX + EDGE_MARGIN, fish.x));
    return;
  }
  const t = FISH_TYPES[fish.type];
  const speed = t.speed * speedMul;
  fish.t = (fish.t || 0) + dt;

  // baseY = stała głębokość ryby (świat). Pion to TYLKO delikatny bujak wokół niej —
  // brak dryfu w pionie, żeby ruch ryby w górę po ekranie wynikał wyłącznie ze
  // schodzenia kamery (wrażenie zanurzania haka, nie "ryby płynące do góry").
  if (fish.baseY === undefined) fish.baseY = fish.y;

  // per-rybi mnożnik prędkości — jedne pływają szybciej, drugie wolniej (stabilny z phaseX)
  const indiv = 0.8 + ((Math.sin((fish.phaseX || 0) * 1.7) + 1) / 2) * 0.5; // 0.8..1.3

  if (fish.state === 'patrol') {
    // ruch GŁÓWNIE poziomy — zmienna prędkość driftu, dominuje nad scrollem opadania
    const driftMod = 0.7 + Math.sin(fish.t * 0.6 + (fish.phaseX || 0)) * 0.3; // 0.4..1.0
    fish.x += fish.dir * speed * indiv * driftMod * dt;
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
    const dx = hookX - fish.x;
    if (t.behavior === 'attack') {
      // muskie: natarcie poziome do kolumny haka (atakuje)
      fish.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * indiv * 1.3 * dt);
      if (dx !== 0) fish.dir = Math.sign(dx);
    } else {
      // bass/sum: UCIEKA — odpływa od haka (gracz musi go zapędzić)
      const away = dx === 0 ? fish.dir : -Math.sign(dx);
      fish.x += away * speed * indiv * dt;
      fish.dir = away;
    }
    fish.y = fish.baseY + Math.sin(fish.t * 2.0 + (fish.phaseY || 0)) * (fish.bobAmp || 6) * 0.4;
  }
  // ZAWSZE w zasięgu połowu — uciekająca ryba zatrzymuje się przy krawędzi (zapędzona), nie znika
  fish.x = Math.max(WORLD.hookMinX - EDGE_MARGIN, Math.min(WORLD.hookMaxX + EDGE_MARGIN, fish.x));
}
