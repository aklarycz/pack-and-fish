// Czysta symulacja jednej klatki descentu (bez DOM). main.js woła to w pętli rAF.
import { WORLD, FISH_TYPES, STAGES, ROCKET_FLIGHT, DRAIN_K, GRAB_DELAY, RECATCH_LIMIT, RECATCH_LOCK, BOTTOM_GRACE, BOSS_LULL } from './config.js';

const CLEAR_DELAY = 1.5; // s po opróżnieniu łowiska przy dnie zanim odpali ekran END (gracz zauważy)
import { difficultyAt } from './logic/ramp.js';
import { createFish } from './logic/spawn.js';
import { startLatch, tickLatch } from './logic/combat.js';
import { updateFish } from './fish.js';
import { addDepth, registerStun, registerEscape, descentCleared } from './state.js';

function removeFish(s, f) {
  const i = s.fish.indexOf(f);
  if (i >= 0) s.fish.splice(i, 1);
}

// Tworzy rybę danego typu i pozycjonuje ją (z boku lub z dołu, poniżej pasma haka). Wspólne dla ławicy i bossa.
function spawnFish(s, type, effDepthM, rng) {
  const spawnTop = WORLD.hookMaxY + 50;
  let fx, fy, fdir;
  if (rng() < 0.75) {
    const left = rng() < 0.5;
    fx = left ? WORLD.hookMinX - 35 : WORLD.hookMaxX + 35;
    fdir = left ? 1 : -1;
    fy = s.depthPx + spawnTop + rng() * (WORLD.H - spawnTop);
  } else {
    fx = WORLD.hookMinX + rng() * (WORLD.hookMaxX - WORLD.hookMinX);
    fdir = rng() < 0.5 ? 1 : -1;
    fy = s.depthPx + WORLD.H + 30;
  }
  const f = createFish(type, effDepthM, fx, rng);
  f.y = fy; f.dir = fdir;
  s.fish.push(f);
}

// Zrywa rybę z haka: usuwa z latched, oznacza jako escaped. Pierwsze zerwanie -> wolna ucieczka +
// jednorazowy re-latch (po buforze); kolejne -> szybka ucieczka bez możliwości ponownego chwytu.
function breakOff(s, f) {
  const li = s.latched.indexOf(f);
  if (li >= 0) s.latched.splice(li, 1);
  f.breakoffs = (f.breakoffs || 0) + 1;
  f.state = 'escaped';
  if (f.breakoffs > RECATCH_LIMIT) {
    f.recatchLeft = 0; f.escapeFast = true; f.recatchLock = 0;
  } else {
    f.recatchLeft = RECATCH_LIMIT - f.breakoffs + 1; f.escapeFast = false; f.recatchLock = RECATCH_LOCK;
  }
}

export function stepDescent(s, hookX, hookScreenY, dt, rng = Math.random) {
  if (s.mode !== 'DESCENT') return;
  if (s.reveal) return; // kurtyna jeszcze zakrywa/odsłania — hak nie tonie, ryby nie spawnują
  // trudność liczona od głębokości + offsetu stage'a (stage startuje "głębiej")
  const depthM = s.depthPx / WORLD.pxPerMeter + (s.stageOffsetM || 0);
  const localM = s.depthPx / WORLD.pxPerMeter;   // lokalna głębokość (bez offsetu) = długość opadania
  // TRYB TESTOWY: zamrażamy skalowanie trudności (hp/prędkość ryb) na płytkim poziomie,
  // by ryby były łowialne na DOWOLNEJ testowej głębokości (inaczej hp sumów rośnie w nieskończoność).
  // Realny depthPx (przyciemnianie, score) dalej rośnie normalnie.
  const effDepthM = s.endless ? Math.min(depthM, 10) : depthM;
  const diff = difficultyAt(effDepthM);
  if (localM < s.descentM) addDepth(s, s.hook.szybkoscOpadania * dt); // hak przestaje opadać na dnie (descentM)

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
  // ŁAWICA (płotka/sum) z worka — co interwał, dopóki nie dobiliśmy do dna.
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && s.fishQueue.length > 0 && (s.endless || localM < s.descentM)) {
    const sp = STAGES[s.stageIndex].spawn;
    s.spawnTimer = Math.max(sp.min, sp.start - localM * sp.perM);
    spawnFish(s, s.fishQueue.shift(), effDepthM, rng);
  }
  // FALA BOSSA (muskie): gdy worek regularny pusty -> ławica odpływa, po BOSS_LULL wpływa muskie SAM na końcu.
  if (!s.endless && !s.bossSpawned && s.fishQueue.length === 0 && s.bossCount > 0) {
    for (const f of s.fish) if (f.state === 'patrol' || f.state === 'aggro') f.state = 'leaving'; // ławica robi miejsce
    s.bossLullT += dt;
    if (s.bossLullT >= BOSS_LULL) {
      for (let k = 0; k < s.bossCount; k++) spawnFish(s, 'twardziel', effDepthM, rng);
      s.bossSpawned = true;
    }
  }

  const hookWorldY = s.depthPx + hookScreenY;

  // latch / damage — WIELE ryb naraz (maxLatch); każda obrywa atk/s. Łów gdy HP→0 (brak ucieczki).
  for (let li = s.latched.length - 1; li >= 0; li--) {
    const f = s.latched[li];
    // pozycja: rozłożone wokół haka, podążają za graczem
    f.x = hookX + (li - (s.latched.length - 1) / 2) * 50;
    f.y = hookWorldY + 4;
    if (tickLatch(f, s.hook.atk, dt) === 'stunned') {
      const straining = (FISH_TYPES[f.type].atk || 0) > s.hook.dur;
      registerStun(s, FISH_TYPES[f.type]);
      f.bubbleY = f.y; s.bubbles.push(f);
      removeFish(s, f); s.latched.splice(li, 1);
      if (straining && s.mode === 'DESCENT') s.durability = s.durabilityMax; // odnowa po złowieniu drenującej
    }
  }

  // === WYTRZYMAŁOŚĆ === ryby z atk > durability haka zdzierają pasek (suma po zaczepionych).
  // Pasek do zera → −1 serce; jeśli gra trwa, pasek się odnawia i WALCZYSZ DALEJ.
  let drain = 0;
  for (const f of s.latched) {
    const A = FISH_TYPES[f.type].atk || 0;
    if (A > s.hook.dur) drain += DRAIN_K * (A - s.hook.dur);
  }
  s.durDraining = drain > 0; // wskaźnik mocniej widoczny gdy pasek aktywnie spada
  if (drain > 0) {
    s.durability -= drain * dt;
    if (s.durability <= 0) {
      // najsilniejsza drenująca ryba odpada z haka (zerwanie żyłki)
      let victim = null, best = -Infinity;
      for (const f of s.latched) {
        const A = FISH_TYPES[f.type].atk || 0;
        if (A > s.hook.dur && A > best) { best = A; victim = f; }
      }
      registerEscape(s);                                       // −1 serce (może zakończyć grę)
      if (s.mode === 'DESCENT') s.durability = s.durabilityMax; // odnów pasek
      if (victim) breakOff(s, victim);                          // ryba odpada i ucieka
    }
  }

  // ruch ryb + wykrycie kontaktu. Zaczepienie po GRAB_DELAY ciągłego kontaktu (można odprowadzić hak).
  for (const f of s.fish) {
    updateFish(f, hookX, hookWorldY, dt, diff.speedMul);
    const canLatch = (f.state === 'patrol' || f.state === 'aggro' || f.state === 'leaving') ||
                     (f.state === 'escaped' && f.recatchLeft > 0 && (f.recatchLock || 0) <= 0);
    if (s.latched.length < s.hook.maxLatch && canLatch && s.latched.indexOf(f) < 0) {
      const r = FISH_TYPES[f.type].radius;
      if (Math.hypot(f.x - hookX, f.y - hookWorldY) <= r + 8) {
        f.contactT = (f.contactT || 0) + dt;
        if (f.contactT >= GRAB_DELAY) { startLatch(f); s.latched.push(f); }
      } else f.contactT = 0;
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
  // ROCKET_FLIGHT (config): czas lotu pocisku zanim zada dmg
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

  // "spawningDone" = ławica wypuszczona I boss (muskie) już się pojawił (albo go nie ma).
  const spawningDone = s.fishQueue.length === 0 && s.bossSpawned;
  // DNO osiągnięte + wszystko wpłynęło: OKNO ŁASKI (BOTTOM_GRACE) — boss atakuje/łowialny,
  // dopiero po nim niezłowione ODPŁYWAJĄ (leaving). Okno startuje dopiero gdy boss już jest.
  if (localM >= s.descentM && spawningDone) {
    s.bottomT += dt;
    if (s.bottomT >= BOTTOM_GRACE) {
      for (const f of s.fish) if (f.state === 'patrol' || f.state === 'aggro') f.state = 'leaving';
    }
  } else s.bottomT = 0;

  // bańki w górę + sprzątanie poza ekranem (zaczepione zostają; odpływające wypływają górą)
  for (const b of s.bubbles) b.bubbleY -= 90 * dt;
  s.bubbles = s.bubbles.filter(b => b.bubbleY - s.depthPx > -40);
  s.fish = s.fish.filter(f => s.latched.indexOf(f) >= 0 || (f.y - s.depthPx) > -160); // znikają dopiero górą

  // Stage kończy się DOPIERO gdy: dobiliśmy do dna, boss się pojawił i łowisko puste (wszystko
  // złowione albo uciekło). (Utrata żyć kończy natychmiast; endless nie odpala.)
  if (!s.endless && localM >= s.descentM && spawningDone && s.fish.length === 0 && s.latched.length === 0) {
    s.clearTimer += dt;
    if (s.clearTimer >= CLEAR_DELAY) descentCleared(s);
  } else s.clearTimer = 0;
}
