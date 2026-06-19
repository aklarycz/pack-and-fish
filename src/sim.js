// Czysta symulacja jednej klatki descentu (bez DOM). main.js woła to w pętli rAF.
import { WORLD, FISH_TYPES, STAGES } from './config.js';
import { difficultyAt } from './logic/ramp.js';
import { createFish } from './logic/spawn.js';
import { startLatch, tickLatch } from './logic/combat.js';
import { updateFish } from './fish.js';
import { addDepth, registerStun, registerEscape, descentCleared } from './state.js';

function removeFish(s, f) {
  const i = s.fish.indexOf(f);
  if (i >= 0) s.fish.splice(i, 1);
}

export function stepDescent(s, hookX, hookScreenY, dt, rng = Math.random) {
  if (s.mode !== 'DESCENT') return;
  if (s.reveal) return; // kurtyna jeszcze zakrywa/odsłania — hak nie tonie, ryby nie spawnują
  // trudność liczona od głębokości + offsetu stage'a (stage startuje "głębiej")
  const depthM = s.depthPx / WORLD.pxPerMeter + (s.stageOffsetM || 0);
  // TRYB TESTOWY: zamrażamy skalowanie trudności (hp/prędkość ryb) na płytkim poziomie,
  // by ryby były łowialne na DOWOLNEJ testowej głębokości (inaczej hp sumów rośnie w nieskończoność).
  // Realny depthPx (przyciemnianie, score) dalej rośnie normalnie.
  const effDepthM = s.endless ? Math.min(depthM, 10) : depthM;
  const diff = difficultyAt(effDepthM);
  addDepth(s, s.hook.szybkoscOpadania * dt);

  // spawn — GŁÓWNIE z boków (ryba wpływa poziomo do środka i przecina scenę),
  // część z dołu dla urozmaicenia. Boczny spawn sprawia, że dominującym ruchem
  // jest pływanie w bok, a nie "lecenie w górę" przez cały ekran.
  // TRYB TESTOWY: worek pusty -> dolewaj ryby wg głębokości (nieskończone schodzenie)
  if (s.endless && s.fishQueue.length === 0) {
    const r = rng();
    const tt = depthM < 15 ? (r < 0.7 ? 'plotka' : 'sredniak')
      : depthM < 35 ? (r < 0.4 ? 'plotka' : r < 0.85 ? 'sredniak' : 'twardziel')
        : (r < 0.25 ? 'sredniak' : 'twardziel');
    s.fishQueue.push(tt);
  }
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && s.fishQueue.length > 0) {
    const sp = STAGES[s.stageIndex].spawn;
    const localM = s.depthPx / WORLD.pxPerMeter;
    s.spawnTimer = Math.max(sp.min, sp.start - localM * sp.perM);
    const type = s.fishQueue.shift();   // worek easy->hard
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
    const f = createFish(type, effDepthM, fx, rng);
    f.y = fy;
    f.dir = fdir;
    s.fish.push(f);
  }

  const hookWorldY = s.depthPx + hookScreenY;

  // latch / damage — WIELE ryb naraz (maxLatch); każda obrywa atk/s niezależnie
  for (let li = s.latched.length - 1; li >= 0; li--) {
    const f = s.latched[li];
    // pozycja: rozłożone wokół haka, podążają za graczem
    f.x = hookX + (li - (s.latched.length - 1) / 2) * 50;
    f.y = hookWorldY + 4;
    const res = tickLatch(f, s.hook.atk, dt);
    if (res === 'stunned') {
      registerStun(s, FISH_TYPES[f.type]);
      f.bubbleY = f.y; s.bubbles.push(f);
      removeFish(s, f); s.latched.splice(li, 1);
    } else if (res === 'escaped') {
      registerEscape(s);
      removeFish(s, f); s.latched.splice(li, 1);
    }
  }

  // ruch ryb + wykrycie kontaktu (zaczepia dopóki jest wolny slot maxLatch)
  for (const f of s.fish) {
    updateFish(f, hookX, hookWorldY, dt, diff.speedMul);
    if (s.latched.length < s.hook.maxLatch && (f.state === 'patrol' || f.state === 'aggro') && s.latched.indexOf(f) < 0) {
      const r = FISH_TYPES[f.type].radius;
      if (Math.hypot(f.x - hookX, f.y - hookWorldY) <= r + 8) {
        startLatch(f);
        s.latched.push(f);
      }
    }
  }

  // === AUTONOMICZNA WYRZUTNIA RAKIET === BLOKUJE cel (mark trzyma się tej samej ryby) i wali
  // w nią co rocketInterval AŻ ją wykończy. Dopiero gdy cel zginie/ucieknie -> namierza nowy (najbliższy).
  if (s.hook.hasRocket) {
    let tgt = s.rocketTarget;
    // zwolnij cel jeśli zniknął / ogłuszony / uciekł
    if (tgt && (s.fish.indexOf(tgt) < 0 || tgt.state === 'stunned' || tgt.state === 'escaped')) {
      tgt.marked = false; tgt = s.rocketTarget = null;
    }
    // brak celu -> namierz najbliższą rybę i ZABLOKUJ
    if (!tgt) {
      let best = null, bestD = Infinity;
      for (const f of s.fish) {
        if (f.state === 'stunned' || f.state === 'escaped') continue;
        const d = Math.hypot(f.x - hookX, f.y - hookWorldY);
        if (d < bestD) { bestD = d; best = f; }
      }
      if (best) { best.marked = true; s.rocketTarget = best; tgt = best; }
    }
    // strzelaj w utrzymany cel
    if (tgt) {
      s.rocketCd -= dt;
      if (s.rocketCd <= 0) { s.rockets.push({ target: tgt, x: hookX, y: hookWorldY, t: 0 }); s.rocketCd = s.hook.rocketInterval; }
    }
  }
  const ROCKET_FLIGHT = 0.32; // s lotu pocisku zanim zada dmg
  for (let ri = s.rockets.length - 1; ri >= 0; ri--) {
    const rk = s.rockets[ri];
    rk.t += dt;
    if (rk.t < ROCKET_FLIGHT) continue;
    const f = rk.target;
    s.rockets.splice(ri, 1);
    if (!f || s.fish.indexOf(f) < 0 || f.state === 'stunned' || f.state === 'escaped') continue;
    f.hp -= s.hook.rocketDmg;             // mark NIE znika — cel pozostaje zablokowany
    if (f.hp <= 0) {                      // rakieta dobiła rybę -> ogłuszenie + bańka + score
      registerStun(s, FISH_TYPES[f.type]);
      f.bubbleY = f.y; s.bubbles.push(f);
      removeFish(s, f);
      const li = s.latched.indexOf(f); if (li >= 0) s.latched.splice(li, 1);
      if (s.rocketTarget === f) { f.marked = false; s.rocketTarget = null; } // zwolnij cel po zabiciu
    }
  }

  // bańki w górę + sprzątanie poza ekranem (zaczepione zostają)
  for (const b of s.bubbles) b.bubbleY -= 90 * dt;
  s.bubbles = s.bubbles.filter(b => b.bubbleY - s.depthPx > -40);
  s.fish = s.fish.filter(f => s.latched.indexOf(f) >= 0 || (f.y - s.depthPx) > -160);

  // pula wyczerpana i wszystkie ryby zeszły/rozstrzygnięte -> łowisko wyczyszczone
  // (w trybie testowym nieskończonym worek nigdy nie jest pusty, więc to nie odpala)
  if (!s.endless && s.fishQueue.length === 0 && s.fish.length === 0 && s.latched.length === 0) descentCleared(s);
}
