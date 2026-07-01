// Menedżer muzyki: dwie zapętlone ścieżki (home / underwater), crossfade, mute (zapisywany),
// spowolnienie przez playbackRate. Autoplay wymaga gestu -> startAudio() wołane po tapie na splashu.
const VER = 'a1'; // bumpuj przy podmianie plików audio (cache-bust)
const TRACKS = {
  home:       { src: 'assets/audio/home.mp3',       rate: 0.90, vol: 0.25 }, // 10% wolniej
  underwater: { src: 'assets/audio/underwater.mp3', rate: 0.70, bossRate: 0.90, vol: 0.25 }, // 30% wolniej; boss -> 10%
};
const FADE = 1.2;                 // s crossfade
const MUTE_KEY = 'packfish_muted';

let els = null, current = null, muted = false, started = false;

function readMuted() { try { return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; } }
function writeMuted(m) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { /* ignoruj */ } }

function ensure() {
  if (els) return;
  muted = readMuted();
  els = {};
  for (const [name, t] of Object.entries(TRACKS)) {
    const a = new Audio(t.src + '?v=' + VER);
    a.loop = true; a.preload = 'auto'; a.volume = 0;
    a.playbackRate = t.rate;
    if ('preservesPitch' in a) a.preservesPitch = true;   // wolniej, ale ta sama wysokość dźwięku
    a.addEventListener('error', () => { t.failed = true; }); // brak pliku -> fallback (patrz setTrack)
    els[name] = a;
  }
}

// Wołane po pierwszym geście użytkownika (tap na splashu) — odblokowuje odtwarzanie.
export function startAudio(name = 'home') { ensure(); started = true; setTrack(name); }

// Przełącz aktywną ścieżkę (crossfade robi audioUpdate). No-op jeśli audio nieodblokowane.
let underwaterBoss = false;

export function setTrack(name) {
  if (!started || !els || !TRACKS[name] || current === name) return;
  current = name;
  const a = els[name];
  a.playbackRate = (name === 'underwater' && underwaterBoss) ? TRACKS.underwater.bossRate : TRACKS[name].rate;
  try { a.currentTime = 0; } catch (e) { /* ignoruj */ } // każde wejście na ekran gra od początku
  a.play().catch(() => {});
}

// Boss na descencie: przyspiesz underwater (0.70 -> 0.90). Poza descentem/bez bossa: wolno.
export function setUnderwaterBoss(on) {
  on = !!on;
  if (on === underwaterBoss) return;
  underwaterBoss = on;
  if (els && els.underwater) els.underwater.playbackRate = on ? TRACKS.underwater.bossRate : TRACKS.underwater.rate;
}

// Zagraj underwater od początku (cue tuż przed bossem).
export function restartUnderwater() { if (els && els.underwater) { try { els.underwater.currentTime = 0; } catch (e) { /* ignoruj */ } } }

export function isAudioMuted() { return els ? muted : readMuted(); }
export function toggleMute() { ensure(); muted = !muted; writeMuted(muted); return muted; }

// Lerp głośności ku celowi (aktywna ścieżka -> vol, reszta -> 0). Wołane co klatkę z main loop.
export function audioUpdate(dt) {
  if (!els) return;
  const step = (dt || 0) / FADE;
  for (const [name, a] of Object.entries(els)) {
    const target = (!muted && name === current) ? TRACKS[name].vol : 0;
    if (a.volume < target) a.volume = Math.min(target, a.volume + step);
    else if (a.volume > target) a.volume = Math.max(0, a.volume - step);
  }
}
