// Czysta symulacja jednej klatki descentu (bez DOM). main.js woła to w pętli rAF.
import { WORLD, FISH_TYPES } from './config.js';
import { difficultyAt } from './logic/ramp.js';
import { pickFishType, createFish } from './logic/spawn.js';
import { startLatch, tickLatch } from './logic/combat.js';
import { updateFish } from './fish.js';
import { addDepth, registerStun, registerEscape } from './state.js';

function removeFish(s, f) {
  const i = s.fish.indexOf(f);
  if (i >= 0) s.fish.splice(i, 1);
}

export function stepDescent(s, hookX, hookScreenY, dt, rng = Math.random) {
  if (s.mode !== 'DESCENT') return;
  // trudność liczona od głębokości + offsetu stage'a (stage startuje "głębiej")
  const depthM = s.depthPx / WORLD.pxPerMeter + (s.stageOffsetM || 0);
  const diff = difficultyAt(depthM);
  addDepth(s, s.hook.szybkoscOpadania * dt);

  // spawn — GŁÓWNIE z boków (ryba wpływa poziomo do środka i przecina scenę),
  // część z dołu dla urozmaicenia. Boczny spawn sprawia, że dominującym ruchem
  // jest pływanie w bok, a nie "lecenie w górę" przez cały ekran.
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0) {
    s.spawnTimer = diff.spawnInterval;
    const type = pickFishType(depthM, rng);
    // WSZYSTKIE ryby pojawiają się PONIŻEJ granicy ruchu haka (hookMaxY) — gracz
    // zawsze widzi je nadpływające z dołu i ma czas zaplanować.
    const spawnTop = WORLD.hookMaxY + 50;
    let fx, fy, fdir;
    if (rng() < 0.75) {
      // z boku: tuż za krawędzią (w obrębie EDGE_MARGIN, by nie zawróciła od razu),
      // na losowej wysokości poniżej granicy; płynie do środka
      const left = rng() < 0.5;
      fx = left ? WORLD.hookMinX - 35 : WORLD.hookMaxX + 35;
      fdir = left ? 1 : -1;
      fy = s.depthPx + spawnTop + rng() * (WORLD.H - spawnTop);
    } else {
      // z dołu: pełna szerokość, kierunek losowy
      fx = WORLD.hookMinX + rng() * (WORLD.hookMaxX - WORLD.hookMinX);
      fdir = rng() < 0.5 ? 1 : -1;
      fy = s.depthPx + WORLD.H + 30;
    }
    const f = createFish(type, depthM, fx, rng);
    f.y = fy;
    f.dir = fdir;
    s.fish.push(f);
  }

  const hookWorldY = s.depthPx + hookScreenY;

  // latch / damage
  if (s.latched) {
    // ryba zaczepiona — zwisamy z haka, podążamy za przesunięciami pozimymi gracza
    s.latched.x = hookX;
    s.latched.y = hookWorldY + 4;
    const res = tickLatch(s.latched, s.hook.atk, dt);
    if (res === 'stunned') {
      registerStun(s, FISH_TYPES[s.latched.type]);
      s.latched.bubbleY = s.latched.y;
      s.bubbles.push(s.latched);
      removeFish(s, s.latched);
      s.latched = null;
    } else if (res === 'escaped') {
      registerEscape(s);
      removeFish(s, s.latched);
      s.latched = null;
    }
  }

  // ruch ryb + wykrycie kontaktu
  for (const f of s.fish) {
    updateFish(f, hookX, hookWorldY, dt, diff.speedMul);
    if (!s.latched && (f.state === 'patrol' || f.state === 'aggro')) {
      const r = FISH_TYPES[f.type].radius;
      if (Math.hypot(f.x - hookX, f.y - hookWorldY) <= r + 8) {
        startLatch(f);
        // snap do haka — ryba wisi na haku, nie obok niego
        f.x = hookX;
        f.y = hookWorldY + 4;
        s.latched = f;
      }
    }
  }

  // bańki w górę + sprzątanie poza ekranem
  for (const b of s.bubbles) b.bubbleY -= 90 * dt;
  s.bubbles = s.bubbles.filter(b => b.bubbleY - s.depthPx > -40);
  s.fish = s.fish.filter(f => f === s.latched || (f.y - s.depthPx) > -160);
}
