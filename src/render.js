import { WORLD, FISH_TYPES, BACKPACK, STARTER_HOOK, STAGES, ITEMS, RARITY, CAST_DUR, CAST_ANIM, ROCKET_FLIGHT, ARENAS, ARENA_COUNT, AVAILABLE_ARENAS, STAGES_PER_ARENA, INV_COLS, INV_VISIBLE_ROWS, arenaOf, localOf, tackleboxOf } from './config.js';
import { computeStars } from './logic/scoring.js';
import { gridItems, itemOrigin, bronzeComponent } from './logic/backpack.js';
import { isAudioMuted } from './audio.js';

// --- proste ładowanie sprite'ów (Image tworzony leniwie, tylko w przeglądarce) ---
const ASSET_VER = 'b47'; // bumpuj, by wymusić refetch assetów (omija cache obrazków przeglądarki)
const _imgCache = {};
function img(src) {
  let im = _imgCache[src];
  if (!im) { im = new Image(); im.src = src + (src.indexOf('?') < 0 ? '?' : '&') + 'v=' + ASSET_VER; _imgCache[src] = im; }
  return im;
}
function ready(im) { return im && im.complete && im.naturalWidth > 0; }

// Usuwa tło z assetów GPT, łącznie z ZAMKNIĘTYMI kieszeniami (np. trójkąty w ramie
// krzesełka), których flood-fill od krawędzi nie dosięga. Metoda: znajdź spójne obszary
// NEUTRALNIE-białych pikseli (R≈G≈B, jasne) i usuń te o DUŻYM polu (tło + kieszenie).
// Ciepła biel kota (kremowy podkoszulek: R>B) i drobne refleksy (małe obszary) zostają. Cache.
const _keyed = {};
// aggressive=true: usuwa CAŁĄ neutralną biel (bez progu wielkości) — dla assetów bez białych
// detali do ochrony (np. zarośla). false: usuwa tylko duże obszary (chroni biel kota/refleksy).
function keyedSheet(src, aggressive = false) {
  const key = src + (aggressive ? '|agg' : '');
  const im = img(src);
  if (!ready(im)) return null;
  if (_keyed[key]) return _keyed[key];
  const w = im.naturalWidth, h = im.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cc = c.getContext('2d'); cc.drawImage(im, 0, 0);
  let id; try { id = cc.getImageData(0, 0, w, h); } catch (e) { _keyed[key] = im; return im; }
  const d = id.data, N = w * h;
  // już ma prawdziwą alfę (przezroczysty róg) → tło/kieszenie wycięte przez grafika; nie ruszamy
  if (d[3] < 20) { _keyed[key] = c; return c; }
  const cand = new Uint8Array(N);
  const lumT = aggressive ? 200 : 225, chrT = aggressive ? 26 : 14; // agresywny łapie też jaśniejszą obwódkę
  for (let p = 0; p < N; p++) {
    if (d[p * 4 + 3] < 20) continue;
    const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > lumT && (Math.max(r, g, b) - Math.min(r, g, b)) < chrT) cand[p] = 1; // neutralna biel/obwódka
  }
  if (aggressive) {
    for (let p = 0; p < N; p++) if (cand[p]) d[p * 4 + 3] = 0; // wszystko białe precz
  } else {
    const seen = new Uint8Array(N), big = N * 0.00008; // próg pola: tło/kieszenie » refleksy
    for (let s0 = 0; s0 < N; s0++) {
      if (!cand[s0] || seen[s0]) continue;
      const stack = [s0], px = [s0]; seen[s0] = 1;
      while (stack.length) {
        const p = stack.pop(), x = p % w, y = (p / w) | 0;
        const nb = []; if (x > 0) nb.push(p - 1); if (x < w - 1) nb.push(p + 1); if (y > 0) nb.push(p - w); if (y < h - 1) nb.push(p + w);
        for (const n of nb) if (cand[n] && !seen[n]) { seen[n] = 1; stack.push(n); px.push(n); }
      }
      if (px.length > big) for (const p of px) d[p * 4 + 3] = 0;
    }
  }
  cc.putImageData(id, 0, 0);
  _keyed[key] = c; return c;
}
// Keying przez FLOOD-FILL od krawędzi: usuwa jasne tło (też wypalony checker) połączone z
// brzegiem, zatrzymując się na ciemnym konturze — wnętrze (jasny brzuch/srebro) zostaje. Dla ryb.
const _keyedE = {};
function keyedEdge(src) {
  const im = img(src); if (!ready(im)) return null;
  if (_keyedE[src]) return _keyedE[src];
  const w = im.naturalWidth, h = im.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cc = c.getContext('2d'); cc.drawImage(im, 0, 0);
  let id; try { id = cc.getImageData(0, 0, w, h); } catch (e) { _keyedE[src] = im; return im; }
  const d = id.data;
  if (d[3] < 20) { _keyedE[src] = c; return c; } // już ma alfę
  const seen = new Uint8Array(w * h), st = [];
  const lum = (p) => 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2];
  const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const p = y * w + x; if (seen[p] || lum(p) < 175) return; seen[p] = 1; st.push(p); };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) { const p = st.pop(); d[p * 4 + 3] = 0; const x = p % w, y = (p / w) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  cc.putImageData(id, 0, 0); _keyedE[src] = c; return c;
}
const FISH_SPRITE = {
  plotka: 'assets/fish/bass.png',       // mała = bass
  sredniak: 'assets/fish/sum.png',      // średnia = sum
  twardziel: 'assets/fish/muskie.png',  // duża = muskie
};
const BUBBLE_SRC = 'assets/bubble.png';
// itemy (hak/akcesoria) — ikony plecaka + nakładki na hak w minigrze
const ITEM_SPRITE = { rusty_hook: 'assets/items/hook.png', bronze: 'assets/items/bronze.png', anchor: 'assets/items/anchor.png', rocket: 'assets/items/rocket.png', weight: 'assets/items/weight.png' };
const ROCKET_SHOT_SRC = 'assets/items/rocket-shot.png'; // pocisk (dziób w prawo → obracany w stronę celu)
const SPLASH_SRC = 'assets/ui/splash.png'; // tło splash: pędzący Tofu z tackleboxem i wędką
const LOGO_SRC = 'assets/ui/logo.png';     // logo "Pack&Fish"
const FOLIAGE = 'assets/arenas/arena-01-foliage.png'; // przednie zarośla (Home) + fallback kurtyny
const CURTAIN = 'assets/arenas/arena-01-curtain.png'; // dedykowana kurtyna przejścia (pełna wysokość, alfa)
const REVEAL_HOLD = 0.3;  // ile kurtyna trzyma ZAKRYTE po wejściu pod wodę ("loading")
const REVEAL_OPEN = 0.55; // ile trwa rozjeżdżanie; hak tonie dopiero po (HOLD+OPEN)
// tło sceny zależne od areny bieżącego stage'a (arena-01-surface.png, arena-02-…).
function arenaBgSrc(globalIndex) { return `assets/arenas/${ARENAS[arenaOf(globalIndex)].bg}-surface.png`; }

// Przednie zarośla: kołyszą się (idle), a przy zarzucie/zanurzeniu rozsuwają na boki.
// part 0..1 = stopień rozsunięcia (0 = kołysanie, 1 = w pełni rozsunięte).
function drawFoliage(ctx, fol, W, H, now, part) {
  const iw = fol.naturalWidth || fol.width, ih = fol.naturalHeight || fol.height;
  const scale = W / iw, dw = W, dh = ih * scale, dy = H - dh; // pełna szerokość, kotwiczone do dołu
  const off = part * W * 0.55;                                 // rozsuw na boki
  const sway = Math.sin(now * 1.5) * 0.02 * (1 - part);        // kołysanie zanika gdy się rozsuwa
  ctx.save();
  ctx.transform(1, 0, sway, 1, -sway * H, 0);                  // shear (dół kołysze się najmocniej)
  ctx.drawImage(fol, 0, 0, iw / 2, ih, -off, dy, dw / 2, dh);          // lewa połowa → w lewo
  ctx.drawImage(fol, iw / 2, 0, iw / 2, ih, W / 2 + off, dy, dw / 2, dh); // prawa połowa → w prawo
  ctx.restore();
}

// Kurtyna przejścia: dwa skrzydła zarośli najeżdżają z boków. cover 0..1 (0=poza ekranem,
// 1=zakryte). Używane przy zarzucie (cover rośnie) i na starcie descentu (cover maleje).
// Wybiera asset kurtyny: dedykowany (pełna wysokość) lub fallback (pas trzciny z foliage).
function drawTransitionCurtain(ctx, W, H, cover) {
  if (cover <= 0) return;
  const cur = keyedSheet(CURTAIN, true);
  if (cur) drawCurtain(ctx, cur, W, H, cover, false);          // dedykowany: cały obraz (pełna wysokość)
  else { const f = keyedSheet(FOLIAGE, true); if (f) drawCurtain(ctx, f, W, H, cover, true); } // fallback: pas trzciny
}
function drawCurtain(ctx, im, W, H, cover, bandOnly) {
  if (cover <= 0) return;
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  const sy = bandOnly ? ih * 0.42 : 0, sh = bandOnly ? ih * 0.58 : ih; // fallback bierze tylko pas trzciny
  const e = cover * cover * (3 - 2 * cover);     // smoothstep
  const wingW = W * 0.6;                           // skrzydła z zakładem w środku → pełne zakrycie przy cover=1
  const lx = -wingW + e * wingW;                   // lewe: -wingW → 0
  const rx = W - e * wingW;                         // prawe: W → W-wingW
  ctx.drawImage(im, 0, sy, iw / 2, sh, lx, 0, wingW, H);        // lewa połowa → pełna wysokość
  ctx.save(); ctx.translate(rx + wingW, 0); ctx.scale(-1, 1);   // prawe lustrzane
  ctx.drawImage(im, iw / 2, sy, iw / 2, sh, 0, 0, wingW, H);
  ctx.restore();
}
const CAT_FRONT_IDLE = 'assets/cat/cat-front-idle.png';
const CAT_FRONT_SLEEP = 'assets/cat/cat-front-sleep.png'; // śpiący front (oczy zamknięte, cały stołek, alfa)
const CAT_FRONT_CAST = 'assets/cat/cat-front-cast.png';
// sheety klatkowe w siatce 3x3 (9 klatek; priorytet nad pozą+tween jeśli istnieją).
const CAT_IDLE_SHEET = 'assets/cat/cat-front-idle-sheet-3x3.png';
const CAT_CAST_SHEET = 'assets/cat/cat-front-cast-sheet-3x3.png';
const CAT_COLS = 3, CAT_ROWS = 3, CAT_FRAMES = 9;
const CAT_SLEEP_FRAME = 4; // klatka z zamkniętymi oczami (kot śpi na Home)
const CAST_FIT = 0.82; // korekta rozmiaru castu (sheet) do pozy śpiącej (inne kadrowanie treści)
const SLEEP_FIT = 0.80; // śpiąca poza ~20% mniejsza (dorównuje mniejszemu castowi)
const STAGE_SPRITE = ['assets/stages/stage1.png', 'assets/stages/stage2.png', 'assets/stages/stage3.png'];
const STAGE_LOCKED = [null, 'assets/stages/stage2_locked.png', 'assets/stages/stage3_locked.png'];
const CAT_DOZE = 'assets/cat/cat-doze-sheet-6x1.png';
const CAT_CAST = 'assets/cat/cat-cast-sheet-6x1.png';
let _homeFrame = 0;
let _lineLagX = null; // wygładzona pozycja żyłki (podąża z opóźnieniem za hakiem → wygięcie)
const SPRITE_SCALE = 2.8; // szerokość sprite ≈ radius * scale
const BUILD = 'b84'; // znacznik wersji (sanity: czy przeglądarka ma świeży kod)

// Rysuje rybę: delikatny ruch w kodzie (kołysanie ogona/ciała = tilt) + PŁYNNE zawracanie
// (scaleX `sx` przechodzi przez 0 zamiast skoku) + przyciemnienie z głębokością (dark 0..1).
function drawFishSprite(ctx, im, cx, cy, radius, sx, alpha, tilt, dark) {
  const w = radius * SPRITE_SCALE;
  const h = w * ((im.naturalHeight || im.height) / (im.naturalWidth || im.width));
  ctx.save();
  ctx.globalAlpha = alpha;
  if (dark > 0 && 'filter' in ctx) ctx.filter = `brightness(${(1 - dark).toFixed(3)})`;
  ctx.translate(cx, cy);
  if (tilt) ctx.rotate(tilt);
  ctx.scale(sx < 0 ? -Math.max(0.04, -sx) : Math.max(0.04, sx), 1); // |sx|→0 przy zawracaniu (sprite patrzy w prawo)
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function render(ctx, s, hookX, hookY) {
  ctx.clearRect(0, 0, WORLD.W, WORLD.H);
  if (s.splash) { renderSplash(ctx, s); return; } // overlay startowy (login Guest) na wierzchu wszystkiego
  if (s.mode === 'HOME') { renderHome(ctx, s); drawTutorial(ctx, s); return; }
  if (s.mode === 'BACKPACK') { renderBackpack(ctx, s); drawTutorial(ctx, s); return; }
  renderDescent(ctx, s, hookX, hookY);
  if (s.mode === 'END') {
    const fail = !(s.lastResult && s.lastResult.cleared);
    if (fail && (s.endElapsed || 0) < END_HOLD) drawEndFlash(ctx, s); // beat: "ZERWANA ŻYŁKA!" zanim podsumowanie
    else renderEnd(ctx, s);
  }
}

const END_HOLD = 2.4; // s beatu po przegranej zanim pokaże się podsumowanie (gracz widzi co się stało)
function drawEndFlash(ctx, s) {
  const W = WORLD.W, H = WORLD.H;
  ctx.fillStyle = 'rgba(3,12,20,0.3)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  const a = 0.55 + 0.45 * Math.sin((s.endElapsed || 0) * 6); // pulsuje
  ctx.fillStyle = `rgba(255,120,120,${a.toFixed(2)})`;
  ctx.font = `bold ${Math.round(H * 0.05)}px sans-serif`;
  ctx.fillText('ZERWANA ŻYŁKA!', W / 2, H * 0.46);
  ctx.fillStyle = 'rgba(207,226,245,0.8)'; ctx.font = `${Math.round(H * 0.022)}px sans-serif`;
  ctx.fillText('Wszystkie serca stracone', W / 2, H * 0.51);
  ctx.textAlign = 'left';
}

// Wskaźniki PRZY HAKU: durability jako łuk po LEWEJ + serca na zewnętrznym łuku.
// Prawa strona zarezerwowana pod przyszłą tarczę (dla równowagi).
function drawHookGauge(ctx, hx, hy, s) {
  const hookH = WORLD.H * 0.085;
  const cx = hx, cy = hy - hookH * 0.35, R = hookH * 1.35;
  ctx.save();
  ctx.globalAlpha = s.durDraining ? 0.8 : 0.3; // dyskretny w spoczynku, mocniejszy gdy pasek spada
  const a0 = Math.PI * 0.70, a1 = Math.PI * 1.30;        // lewy łuk
  const frac = s.durabilityMax > 0 ? Math.max(0, Math.min(1, s.durability / s.durabilityMax)) : 1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(6,16,26,0.6)'; ctx.lineWidth = hookH * 0.17;
  ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
  const col = frac > 0.5 ? '#5fd56f' : frac > 0.25 ? '#ecc24a' : '#ec5a5a';
  if (frac > 0) { ctx.strokeStyle = col; ctx.lineWidth = hookH * 0.12; ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + (a1 - a0) * frac); ctx.stroke(); }
  ctx.lineCap = 'butt';
  // serca na łuku tuż na zewnątrz durability (lewa-góra)
  const hr = R + hookH * 0.36;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.round(hookH * 0.34)}px sans-serif`;
  for (let i = 0; i < 3; i++) {
    const ang = Math.PI * 0.83 + i * Math.PI * 0.12;
    ctx.fillStyle = i < s.lives ? '#ff6b8a' : 'rgba(120,140,160,0.45)';
    ctx.fillText('❤', cx + Math.cos(ang) * hr, cy + Math.sin(ang) * hr);
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}

// === SPLASH / LOGIN (Guest) — overlay startowy. Art: pędzący Tofu (splash.png) + logo (logo.png) ===
function renderSplash(ctx, s) {
  const W = WORLD.W, H = WORLD.H;
  // splash.png to PEŁNA kompozycja (logo + Tofu + ryby wmalowane). Logo/tytuł rysujemy TYLKO
  // w fallbacku (gdy brak arta), żeby się nie dublowało z wmalowanym logo.
  const bg = img(SPLASH_SRC);
  const hasArt = ready(bg);
  if (hasArt) { ctx.fillStyle = '#0b1f33'; ctx.fillRect(0, 0, W, H); drawCover(ctx, bg, 0, 0, W, H); }
  else { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1e6390'); g.addColorStop(1, '#06223a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // scrim dołu (czytelność przycisków)
  let sc = ctx.createLinearGradient(0, H * 0.68, 0, H);
  sc.addColorStop(0, 'rgba(4,18,31,0)'); sc.addColorStop(1, 'rgba(4,18,31,0.72)');
  ctx.fillStyle = sc; ctx.fillRect(0, H * 0.68, W, H * 0.32);
  if (!hasArt) { // fallback: logo PNG (wykeyowane) lub tekst
    const logo = keyedEdge(LOGO_SRC);
    if (logo) {
      const ar = (logo.width || 1) / (logo.height || 1);
      let lh = H * 0.30, lw = lh * ar;
      if (lw > W * 0.96) { lw = W * 0.96; lh = lw / ar; }
      ctx.drawImage(logo, W / 2 - lw / 2, H * 0.012, lw, lh);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd24a'; ctx.font = `bold ${Math.round(H * 0.078)}px sans-serif`;
      ctx.fillText('Pack&Fish', W / 2, H * 0.17);
    }
  }
  // 3 przyciski logowania (domyślny układ). AKTYWNY tylko Gość; Google/Apple = placeholdery ("wkrótce").
  const bw = W * 0.66, bh = H * 0.07, bx = W / 2 - bw / 2, by1 = H * 0.80;
  roundedBtn(ctx, { x: bx, y: by1, w: bw, h: bh }, '#2e7d4f', 'GRAJ JAKO GOŚĆ');
  s._splashBtn = { x: bx, y: by1, w: bw, h: bh };
  // 2 loginy społecznościowe (nieaktywne, wyszarzone)
  const gap = W * 0.03, sw = (bw - gap) / 2, sy = by1 + bh + H * 0.016;
  roundedBtn(ctx, { x: bx, y: sy, w: sw, h: bh }, '#39485a', 'Google');
  roundedBtn(ctx, { x: bx + sw + gap, y: sy, w: sw, h: bh }, '#39485a', 'Apple');
  ctx.fillStyle = 'rgba(207,226,245,0.45)'; ctx.textAlign = 'center'; ctx.font = `${Math.round(H * 0.014)}px sans-serif`;
  ctx.fillText('Logowanie kontem — wkrótce', W / 2, sy + bh + H * 0.022);
  ctx.textAlign = 'left';
}

// === TUTORIAL: dymki + łapka + strzałki, sterowany stanem ===
let _tutFrame = 0;
function rectCenter(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
function tutCellRect(gi, idx) {
  const c = idx % BACKPACK.cols, r = Math.floor(idx / BACKPACK.cols);
  return { x: gi.ox + c * gi.cell, y: gi.oy + r * gi.cell, w: gi.cell, h: gi.cell };
}
function freeAdjacentToHook(grid) { // „hak" do połączenia = brązowy hak (akcesorium)
  const { cells, cols, rows } = grid;
  let hi = cells.indexOf('bronze');
  if (hi < 0) return -1;
  const r = Math.floor(hi / cols), c = hi % cols, nb = [];
  if (r > 0) nb.push(hi - cols); if (r < rows - 1) nb.push(hi + cols);
  if (c > 0) nb.push(hi - 1); if (c < cols - 1) nb.push(hi + 1);
  for (const n of nb) if (!cells[n]) return n;
  return nb.length ? nb[0] : -1;
}

function drawTutorial(ctx, s) {
  if (s.mode === 'BACKPACK' && s.bpSelected) return; // czytanie opisu — nie zaśmiecaj tutorialem
  _tutFrame++;
  const W = WORLD.W, H = WORLD.H, bob = Math.abs(Math.sin(_tutFrame * 0.09)) * 8;
  let target = null, text = null, from = null;

  const invRect = (id) => { const it = s._bpInv && s._bpInv.find(e => e.id === id); return it ? it.rect : null; };
  if (s.mode === 'HOME') {
    const h = s._home; if (!h) return;
    // tutoriale JEDNORAZOWE — bramkowane flagami (nie wracają po wypięciu itemu)
    if (!s.progress.tutBronzeDone && s.hook.atk < 4) { target = rectCenter(h.backpack); text = 'Otwórz plecak — wzmocnij hak (brązowy hak)'; }
    else if (s.progress.tutBronzeDone && !s.progress.tutAnchorDone && s.progress.gotAnchor && s.hook.maxLatch < 2) { target = rectCenter(h.backpack); text = 'Masz Kotwicę! Otwórz plecak'; }
    else if (s.progress.pendingChests > 0 && !s.progress.gotAnchor && h.chest) { target = rectCenter(h.chest); text = 'Otwórz skrzynię!'; }
    else if (!s.progress.gotAnchor && s.progress.stages[0].stars === 0 && h.start) { target = rectCenter(h.start); text = 'Tap, by zarzucić wędkę'; }
  } else if (s.mode === 'BACKPACK') {
    const gi = s._grid;
    if (!s.progress.tutBronzeDone) {          // tutorial brązu — dopóki nie zaliczony (zamknięcie plecaka z atk>=4)
      if (s.hook.atk < 4) {
        const r = invRect('bronze');
        if (r) { target = rectCenter(r); text = 'Tap, by włożyć Brązowy hak'; }
      } else if (s._backpackBack) { target = rectCenter(s._backpackBack); text = 'Gotowe! +3 atk — Wróć na Home'; }
    } else if (s.progress.gotAnchor && !s.progress.tutAnchorDone) { // tutorial kotwicy — dopóki nie zaliczony
      if (s.hook.maxLatch < 2) {
        const r = invRect('anchor');
        if (r) { target = rectCenter(r); text = 'Tap, by włożyć Kotwicę'; }
        else if (gi) {
          const ai = s.grid.cells.indexOf('anchor'), adj = freeAdjacentToHook(s.grid);
          if (ai >= 0 && adj >= 0) { from = rectCenter(tutCellRect(gi, ai)); target = rectCenter(tutCellRect(gi, adj)); text = 'Przeciągnij Kotwicę obok Brązowego haka'; }
        }
      } else if (s._backpackBack) { target = rectCenter(s._backpackBack); text = 'Połączone! +1 ryba naraz — Wróć na Home'; }
    }
  }
  if (!text) return;

  if (from) tutArrow(ctx, from.x, from.y, target.x, target.y);
  pulseRing(ctx, target.x, target.y, gi_radius(), _tutFrame);
  drawHand(ctx, target.x, target.y + 16, bob);
  const by = target.y < H * 0.28 ? target.y + H * 0.11 : target.y - H * 0.10;
  drawBubble(ctx, target.x, by, text);
}

function gi_radius() { return Math.round(WORLD.H * 0.035); }

function pulseRing(ctx, cx, cy, r, frame) {
  const p = (Math.sin(frame * 0.12) + 1) / 2;
  ctx.strokeStyle = `rgba(255,203,69,${0.45 + 0.4 * p})`; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, r + p * 8, 0, Math.PI * 2); ctx.stroke();
}

function drawHand(ctx, x, y, bob) {
  const hy = y + 14 + bob; // łapka nieco pod targetem, wskazuje w górę
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
  // palec (trójkąt w górę)
  ctx.beginPath(); ctx.moveTo(x, hy - 16); ctx.lineTo(x - 9, hy); ctx.lineTo(x + 9, hy); ctx.closePath(); ctx.fill(); ctx.stroke();
  // pięść
  fillRR(ctx, x - 11, hy - 2, 22, 17, 7, '#fff');
  rrPath(ctx, x - 11, hy - 2, 22, 17, 7); ctx.stroke();
}

function drawBubble(ctx, cx, cy, text) {
  ctx.font = `bold ${Math.round(WORLD.H * 0.021)}px sans-serif`; ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 28, h = Math.round(WORLD.H * 0.05);
  let x = cx - w / 2; const y = cy - h / 2;
  x = Math.max(8, Math.min(WORLD.W - w - 8, x));
  fillRR(ctx, x, y, w, h, 10, 'rgba(255,255,255,0.96)');
  ctx.fillStyle = '#0a1b2b'; ctx.fillText(text, x + w / 2, y + h / 2 + WORLD.H * 0.0075);
}

function tutArrow(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = '#ffcb45'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 14 * Math.cos(a - 0.4), y2 - 14 * Math.sin(a - 0.4));
  ctx.lineTo(x2 - 14 * Math.cos(a + 0.4), y2 - 14 * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fillStyle = '#ffcb45'; ctx.fill(); ctx.lineCap = 'butt';
}

// Ruch wody na Home: miękki, WĘDRUJĄCY blask (sheen) przesuwający się po tafli — duże,
// rozmyte refleksy światła clipowane do pasa wody (nie linie, nie kółka). Kilka warstw w
// różnych fazach/prędkościach daje organiczny, przelewający się połysk jak shader na wodzie.
function drawWaterShimmer(ctx, W, H, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // jeden przelewający się blask: wielki, rozmyty gradient radialny przycięty do pasa wody,
  // którego środek wędruje w bok → światło przesuwa się po tafli.
  const sheen = (y0f, y1f, speed, phase, col, amax) => {
    const y0 = H * y0f, h = H * (y1f - y0f), cy = y0 + h * (0.45 + 0.1 * Math.sin(t * speed * 0.6 + phase));
    const cx = W * (0.5 + 0.6 * Math.sin(t * speed + phase));
    const rr = W * 0.6;
    const a = amax * (0.5 + 0.5 * Math.sin(t * speed * 0.85 + phase * 1.3));
    if (a < 0.003) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, W, h); ctx.clip();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, `rgba(${col},${a.toFixed(3)})`);
    g.addColorStop(0.6, `rgba(${col},${(a * 0.35).toFixed(3)})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, h);
    ctx.restore();
  };
  // główna tafla przybrzeża (między molem a UI): dwa blaski w kontrfazie = przelewający się połysk
  sheen(0.56, 0.80, 0.22, 0.0, '206,240,255', 0.16);
  sheen(0.56, 0.80, 0.33, 2.3, '176,222,255', 0.11);
  // dalekie odbicie zachodu (za molem): wolniejszy, ciepły blask
  sheen(0.30, 0.43, 0.15, 1.0, '255,226,170', 0.12);
  ctx.restore();
}

// --- HOME: arena (góra, scena/Tofu per-arena) + pasek stage 1-10 nad przyciskiem ---
function renderHome(ctx, s) {
  const W = WORLD.W, H = WORLD.H;
  const i = s.stageIndex, prog = s.progress.stages[i], unlocked = prog.unlocked;
  const arena = arenaOf(i), local = localOf(i), arenaStart = arena * STAGES_PER_ARENA;
  const A = ARENAS[arena], cx = W / 2;
  let homeLeft, homeRight, catRect, start = null, backpack = null, chest = null, stageNodes = [];

  // === Po animacji zarzutu (CAST_ANIM) kamera zjeżdża w górę + woda; kurtyna z krzaków zakrywa ===
  const diveT = s.cast ? Math.max(0, Math.min(1, (s.cast.t - CAST_ANIM) / (CAST_DUR - CAST_ANIM))) : 0;
  const castPart = diveT; // używane przez pan/kurtynę (zjazd zaczyna się dopiero po animacji)
  const panY = (castPart * castPart * (3 - 2 * castPart)) * H * 0.7; // scena zjeżdża w górę (góra staje się wodą)
  if (castPart > 0) {
    const wg = ctx.createLinearGradient(0, 0, 0, H);
    wg.addColorStop(0, 'rgb(14,59,92)'); wg.addColorStop(1, 'rgb(4,20,34)');
    ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
  }
  ctx.save(); if (panY) ctx.translate(0, -panY);

  // 1. tło sceny areny (PNG jeśli jest, inaczej tintowany fallback per arena) 2. vignette 3/4. scrimy
  const bg = img(arenaBgSrc(i));
  if (ready(bg)) { ctx.fillStyle = '#0b1f33'; ctx.fillRect(0, 0, W, H); drawCover(ctx, bg, 0, 0, W, H); }
  else { const tg = ctx.createLinearGradient(0, 0, 0, H); tg.addColorStop(0, A.tint[0]); tg.addColorStop(1, A.tint[1]); ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H); }
  const vg = ctx.createRadialGradient(cx, H * 0.45, H * 0.2, cx, H * 0.45, H * 0.72);
  vg.addColorStop(0, 'rgba(6,18,28,0)'); vg.addColorStop(1, 'rgba(6,18,28,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  let g = ctx.createLinearGradient(0, 0, 0, H * 0.12);
  g.addColorStop(0, 'rgba(6,18,28,0.55)'); g.addColorStop(1, 'rgba(6,18,28,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.12);
  g = ctx.createLinearGradient(0, H * 0.62, 0, H);
  g.addColorStop(0, 'rgba(6,18,28,0)'); g.addColorStop(1, 'rgba(6,18,28,0.9)');
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.62, W, H * 0.38);

  // delikatny ruch wody — proceduralny shimmer (woda w grafice jest statyczna)
  drawWaterShimmer(ctx, W, H, (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000);

  // === UI górne (HUD + nazwa areny) — ukryte przy zarzucie ===
  if (!s.cast) {
  // === A: top HUD (poziom + XP areny + chipy zasobów) ===
  ctx.beginPath(); ctx.arc(W * 0.10, H * 0.045, W * 0.035, 0, Math.PI * 2);
  const lg = ctx.createLinearGradient(0, H * 0.01, 0, H * 0.08); lg.addColorStop(0, '#2e6bb0'); lg.addColorStop(1, '#16406e');
  ctx.fillStyle = lg; ctx.fill(); ctx.strokeStyle = '#ffcb45'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(H * 0.030)}px sans-serif`;
  ctx.fillText('1', W * 0.10, H * 0.045 + H * 0.011);
  // XP bar = gwiazdki bieżącej areny / 30 (10 stage'y × 3★)
  const arenaStars = s.progress.stages.slice(arenaStart, arenaStart + STAGES_PER_ARENA).reduce((a, st) => a + st.stars, 0);
  const xpFrac = Math.max(0.06, arenaStars / (STAGES_PER_ARENA * 3));
  const xpX = W * 0.155, xpY = H * 0.046, xpW = W * 0.20, xpH = H * 0.013;
  fillRR(ctx, xpX, xpY, xpW, xpH, xpH / 2, 'rgba(14,34,51,0.6)');
  fillRR(ctx, xpX, xpY, xpW * xpFrac, xpH, xpH / 2, '#52d0ff');
  const chW = W * 0.165, chH = H * 0.046, chY = H * 0.046;
  chip(ctx, W * 0.95, chY, chW, chH, '#ffcb45', formatSC(s.progress.coins)); // tylko złoto; pigułka auto-skaluje

  // === Nazwa ARENY (góra) — strzałki przełączają ARENĘ (zmieniają scenę) ===
  const ar = W * 0.05, arCy = H * 0.135;
  homeLeft = { x: W * 0.04, y: arCy - ar, w: ar * 2, h: ar * 2 };
  homeRight = { x: W - W * 0.04 - ar * 2, y: arCy - ar, w: ar * 2, h: ar * 2 };
  navArrow(ctx, homeLeft.x + ar, arCy, ar, -1, arena > 0);
  navArrow(ctx, homeRight.x + ar, arCy, ar, 1, arena < AVAILABLE_ARENAS - 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fd0ff'; ctx.font = `bold ${Math.round(H * 0.018)}px sans-serif`;
  ctx.fillText(`ARENA ${A.id}`, cx, H * 0.108);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = H * 0.002;
  ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(H * 0.036)}px sans-serif`;
  ctx.fillText(A.name, cx, H * 0.148);
  ctx.restore();
  } // koniec UI górnego

  // bohater Tofu — FRONT, śpi; osadzony GŁĘBIEJ na deskach molo (nie na krawędzi) — oba stany
  const baselineY = H * 0.50, catH = H * 0.265, catCy = baselineY - catH * 0.5;
  catRect = { x: cx - W * 0.22, y: baselineY - catH * 0.9, w: W * 0.44, h: catH * 0.9 };
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(cx, baselineY, W * 0.15, H * 0.012, 0, 0, Math.PI * 2); ctx.fill();
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  const castSheet = keyedSheet(CAT_CAST_SHEET);
  if (s.cast && castSheet) {
    const f = Math.min(CAT_FRAMES - 1, Math.floor(s.cast.t / CAST_ANIM * CAT_FRAMES));
    // cast to inny asset (sheet) — CAST_FIT zrównuje rozmiar kota z pozą śpiącą (różne kadrowanie)
    drawCatFrame(ctx, CAT_CAST_SHEET, f, CAT_COLS, CAT_ROWS, cx, baselineY, catH * CAST_FIT);
  } else if (!s.cast && keyedSheet(CAT_FRONT_SLEEP)) {
    // śpi: osobna poza (cały stołek, zamknięte oczy) + oddech + Zzz; SLEEP_FIT zrównuje rozmiar z castem
    const sh = catH * SLEEP_FIT;
    const breath = 1 + Math.sin(now * 1.3) * 0.01;
    ctx.save(); ctx.translate(cx, baselineY); ctx.scale(1, breath); ctx.translate(-cx, -baselineY);
    drawCatFrame(ctx, CAT_FRONT_SLEEP, 0, 1, 1, cx, baselineY, sh);
    ctx.restore();
    drawDozeZ(ctx, cx - sh * 0.24, baselineY - sh * 1.02, now);
  } else {
    const catIm = (s.cast ? keyedSheet(CAT_FRONT_CAST) : null) || keyedSheet(CAT_FRONT_IDLE);
    if (catIm) {
      const opt = {};
      if (s.cast) { const p = Math.min(1, s.cast.t / CAST_ANIM); opt.scale = 1 + 0.1 * Math.sin(p * Math.PI); opt.dy = -H * 0.015 * Math.sin(p * Math.PI); }
      else { const b = Math.sin(now * 1.8); opt.dy = b * H * 0.012; opt.tilt = Math.sin(now * 0.9) * 0.05; opt.scaleX = 1 - b * 0.03; opt.scaleY = 1 + b * 0.03; }
      drawImageCentered(ctx, catIm, cx, catCy, catH, opt);
      if (!s.cast) drawDozeZ(ctx, cx + catH * 0.34, catCy - catH * 0.42, now);
    }
  }

  // przednie zarośla — kołyszą się w idle (przy zarzucie zamiast tego kurtyna na overlayu)
  const fol = keyedSheet(FOLIAGE, true); // agresywne keying (zarośla bez białych detali)
  if (fol && !s.cast) drawFoliage(ctx, fol, W, H, now, 0);

  // === DOLNE UI (pasek stage, przycisk, taby, skrzynka) — ukryte przy zarzucie ===
  if (!s.cast) {
  // === Pasek wyboru STAGE 1-10 (nad przyciskiem) ===
  const stripY = H * 0.685, m = W * 0.06, usable = W - 2 * m, gap = usable / STAGES_PER_ARENA;
  const nodeR = Math.min(gap * 0.34, H * 0.021);
  ctx.fillStyle = 'rgba(207,226,245,0.55)'; ctx.font = `${Math.round(H * 0.016)}px sans-serif`; ctx.textAlign = 'left';
  ctx.fillText('Stage', m, stripY - nodeR - H * 0.012);
  stageNodes = [];
  for (let k = 0; k < STAGES_PER_ARENA; k++) {
    const gi = arenaStart + k, st = s.progress.stages[gi];
    const ncx = m + gap * (k + 0.5), sel = k === local;
    ctx.beginPath(); ctx.arc(ncx, stripY, nodeR, 0, Math.PI * 2);
    if (!st.unlocked) ctx.fillStyle = 'rgba(40,58,74,0.85)';
    else if (st.stars > 0) ctx.fillStyle = '#caa23a';
    else ctx.fillStyle = '#2e6bb0';
    ctx.fill();
    if (sel) { ctx.strokeStyle = '#ffcb45'; ctx.lineWidth = 3; ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.stroke(); }
    if (!st.unlocked) { drawLock(ctx, ncx, stripY, nodeR * 0.8); }
    else {
      ctx.fillStyle = st.stars > 0 ? '#06121f' : '#eaf4ff'; ctx.textAlign = 'center';
      ctx.font = `bold ${Math.round(nodeR * 1.05)}px sans-serif`;
      ctx.fillText(String(k + 1), ncx, stripY + nodeR * 0.38);
    }
    stageNodes.push({ rect: { x: ncx - gap / 2, y: stripY - nodeR - 6, w: gap, h: nodeR * 2 + 12 }, index: gi });
  }

  // gwiazdki WYBRANEGO stage'a (nad przyciskiem)
  const ssR = W * 0.024, ssg = W * 0.014, ssw = ssR * 2, starsW = 3 * ssw + 2 * ssg;
  for (let k = 0; k < 3; k++) star(ctx, cx - starsW / 2 + ssw / 2 + k * (ssw + ssg), H * 0.735, ssR * (k === 1 ? 1.1 : 1), k < prog.stars);

  // === Przycisk STAGE N (zamiast START) + wskaźnik skrzynki-nagrody (locked/claimed) ===
  const btnW = W * 0.62, btnH = H * 0.09, bx = cx - btnW / 2, byy = H * 0.80 - btnH / 2;
  const canStart = unlocked && s.hook;
  fillRR(ctx, bx, byy + H * 0.006, btnW, btnH, btnH / 2, 'rgba(0,0,0,0.28)');
  rrPath(ctx, bx, byy, btnW, btnH, btnH / 2);
  if (canStart) { const sg = ctx.createLinearGradient(0, byy, 0, byy + btnH); sg.addColorStop(0, '#ffb627'); sg.addColorStop(1, '#ff8a00'); ctx.fillStyle = sg; }
  else ctx.fillStyle = '#5b6670';
  ctx.fill();
  fillRR(ctx, bx + btnH * 0.3, byy + btnH * 0.12, btnW - btnH * 0.6, btnH * 0.24, btnH * 0.12, 'rgba(255,255,255,0.22)');
  ctx.textAlign = 'center'; ctx.fillStyle = canStart ? '#3a1e00' : 'rgba(220,228,238,0.8)';
  ctx.font = `900 ${Math.round(H * 0.038)}px sans-serif`;
  ctx.fillText(unlocked ? `STAGE ${local + 1}` : 'ZABLOKOWANE', cx - (unlocked ? btnH * 0.35 : 0), byy + btnH * 0.64);
  start = { x: bx, y: byy, w: btnW, h: btnH };
  // skrzynka-nagroda za TEN stage, doczepiona do prawej krawędzi przycisku
  if (unlocked) drawStageChest(ctx, bx + btnW - btnH * 0.2, byy + btnH / 2, btnH * 0.62, prog.chestClaimed ? 'claimed' : 'locked');
  if (!s.hook) {
    ctx.fillStyle = '#ffcb45'; ctx.textAlign = 'center'; ctx.font = `${Math.round(H * 0.019)}px sans-serif`;
    ctx.fillText('Zdobądź hak w plecaku, by zacząć', cx, byy - H * 0.018);
  }

  // === F: tab bar ===
  const tabH = H * 0.12, tabY = H - tabH;
  ctx.fillStyle = 'rgba(10,22,32,0.92)'; ctx.fillRect(0, tabY, W, tabH);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, tabY + 0.5); ctx.lineTo(W, tabY + 0.5); ctx.stroke();
  const tabs = [['Sklep', false], ['Plecak', true], ['Battle', true], ['Łowy', false], ['Kasa', false]];
  backpack = null;
  for (let k = 0; k < 5; k++) {
    const tcx = W * (0.10 + 0.20 * k), active = k === 2, functional = tabs[k][1];
    if (active) {
      fillRR(ctx, tcx - W * 0.08, tabY + H * 0.012, W * 0.16, H * 0.06, H * 0.03, 'rgba(255,203,69,0.15)');
      ctx.beginPath(); ctx.arc(tcx, tabY + H * 0.007, H * 0.005, 0, Math.PI * 2); ctx.fillStyle = '#ffcb45'; ctx.fill();
    }
    ctx.globalAlpha = functional ? 1 : 0.45;
    ctx.beginPath(); ctx.arc(tcx, tabY + H * 0.04, H * 0.018, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#ffcb45' : '#c8d4de'; ctx.fill();
    ctx.fillStyle = active ? '#fff' : '#c8d4de'; ctx.textAlign = 'center'; ctx.font = `${Math.round(H * 0.017)}px sans-serif`;
    ctx.fillText(tabs[k][0], tcx, tabY + H * 0.078);
    ctx.globalAlpha = 1;
    if (k === 1) backpack = { x: tcx - W * 0.10, y: tabY, w: W * 0.20, h: tabH };
  }

  // skrzynka do ODEBRANIA (pending) — pływa po lewej nad paskiem stage
  if (s.progress.pendingChests > 0) {
    chest = { x: W * 0.05, y: H * 0.56, w: W * 0.16, h: W * 0.16 };
    fillRR(ctx, chest.x, chest.y, chest.w, chest.h, 8, '#3a2f12');
    rrPath(ctx, chest.x, chest.y, chest.w, chest.h, 8); ctx.strokeStyle = '#ffcb45'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffcb45'; ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(chest.w * 0.19)}px sans-serif`;
    ctx.fillText('SKRZYNIA', chest.x + chest.w / 2, chest.y + chest.h * 0.58);
    ctx.beginPath(); ctx.arc(chest.x + chest.w, chest.y, 12, 0, Math.PI * 2); ctx.fillStyle = '#ff4d4d'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(String(s.progress.pendingChests), chest.x + chest.w, chest.y + 5);
  }
  } // koniec dolnego UI (ukryte przy zarzucie)

  ctx.restore(); // koniec panoramy sceny

  // kurtyna z krzaków najeżdża z boków przy zarzucie — zakrywa scenę na switch pod wodę
  if (s.cast) drawTransitionCurtain(ctx, W, H, Math.min(1, castPart / 0.85));

  // znacznik buildu (mały, w rogu)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = `bold ${Math.round(H * 0.015)}px monospace`; ctx.textAlign = 'left';
  ctx.fillText(BUILD, W * 0.02, H * 0.86);

  // przycisk RESET postępu (dev/test) — dwa tapnięcia potwierdzają. Lewy, pod nazwą areny.
  const rbw = W * 0.30, rbh = H * 0.038, rbx = W * 0.02, rby = H * 0.20;
  const resetRect = { x: rbx, y: rby, w: rbw, h: rbh };
  fillRR(ctx, rbx, rby, rbw, rbh, 8, s.resetArm ? 'rgba(154,75,75,0.95)' : 'rgba(14,34,51,0.8)');
  rrPath(ctx, rbx, rby, rbw, rbh, 8); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = s.resetArm ? '#fff' : 'rgba(207,226,245,0.7)'; ctx.font = `bold ${Math.round(H * 0.017)}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(s.resetArm ? 'Na pewno? Tap' : 'Reset postępu', rbx + rbw / 2, rby + rbh * 0.68);

  // przycisk MUZYKA (mute) — symetrycznie po prawej, pod nazwą areny
  const mbw = W * 0.30, mbh = H * 0.038, mbx = W - mbw - W * 0.02, mby = H * 0.20;
  const muteRect = { x: mbx, y: mby, w: mbw, h: mbh };
  fillRR(ctx, mbx, mby, mbw, mbh, 8, 'rgba(14,34,51,0.8)');
  rrPath(ctx, mbx, mby, mbw, mbh, 8); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(207,226,245,0.7)'; ctx.font = `bold ${Math.round(H * 0.017)}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(isAudioMuted() ? 'Muzyka: wył' : 'Muzyka: wł', mbx + mbw / 2, mby + mbh * 0.68);

  ctx.textAlign = 'left';
  s._home = { stage: catRect, left: homeLeft, right: homeRight, start, backpack, chest, stageNodes, reset: resetRect, mute: muteRect };

  // overlay otwarcia skrzynki — pokazuje IKONĘ otrzymanego itemu + nazwę + opis (gracz musi wiedzieć co dostał)
  if (s.chestReveal) {
    ctx.fillStyle = 'rgba(3,12,20,0.92)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166'; ctx.font = `bold ${Math.round(H * 0.045)}px sans-serif`;
    ctx.fillText('SKRZYNIA!', cx, H * 0.30);
    const itemId = s.chestReveal.anchor ? 'anchor' : s.chestReveal.rocket ? 'rocket' : s.chestReveal.weight ? 'weight' : null;
    const HINT = { anchor: 'Włóż w plecaku: +1 ryba naraz, +1 atk', rocket: 'Włóż w plecaku: strzela 4 dmg co 2 s', weight: 'Włóż w plecaku: +2 wytrzymałości haka' };
    if (itemId && ITEMS[itemId]) {
      const sz = H * 0.15, w = (ITEMS[itemId].slots || 1) * sz; // ikona z footprintem (rakietnica = 2 sloty)
      drawItemSpan(ctx, ITEMS[itemId], cx - w / 2, H * 0.355, w, sz, true); // panel rzadkości
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(H * 0.03)}px sans-serif`;
      ctx.fillText(ITEMS[itemId].name, cx, H * 0.57);
      ctx.fillStyle = '#cfe2f5'; ctx.font = `${Math.round(H * 0.021)}px sans-serif`;
      ctx.fillText(HINT[itemId] || 'Włóż w plecaku', cx, H * 0.61);
    }
    ctx.fillStyle = '#7fe0a0'; ctx.font = `${Math.round(H * 0.03)}px sans-serif`;
    ctx.fillText('+' + s.chestReveal.sc + ' monet', cx, H * 0.67);
    ctx.fillStyle = '#9fd0ff'; ctx.font = `${Math.round(H * 0.024)}px sans-serif`;
    ctx.fillText('Tap, by zamknąć', cx, H * 0.73);
    ctx.textAlign = 'left';
  }
}

function drawCover(ctx, im, x, y, w, h) {
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// rysuje klatkę `frame` z sheetu w siatce cols×rows, wyśrodkowaną w (cx,cy).
// `im` może być <img> lub <canvas> (po keyedSheet). `inset` przycina krawędzie klatki
// (anti-sliver z sąsiedniej klatki). targetH = docelowa wysokość klatki.
function drawSheet(ctx, im, frame, cols, rows, cx, cy, targetH, inset = 0) {
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  const fw = iw / cols, fh = ih / rows;
  const col = frame % cols, row = Math.floor(frame / cols) % rows;
  const padX = fw * inset, padY = fh * inset;
  const sx = col * fw + padX, sy = row * fh + padY, sw = fw - 2 * padX, sh = fh - 2 * padY;
  const w = sw * (targetH / sh);
  ctx.drawImage(im, sx, sy, sw, sh, cx - w / 2, cy - targetH / 2, w, targetH);
}

// kontekst 2D z pikselami obrazka/canvasa (do skanu alfy)
function _pixCtx(c) {
  if (c.getContext) return c.getContext('2d');
  const t = document.createElement('canvas'); t.width = c.naturalWidth; t.height = c.naturalHeight;
  const tc = t.getContext('2d'); tc.drawImage(c, 0, 0); return tc;
}

// Przycięcie komórki kota: GÓRA i BOKI tną przeciek z sąsiednich klatek (fragmenty stołka/wędki),
// DÓŁ nietknięty (stołek w całości). Region = [cropSide..1-cropSide] × [cropTop..1] komórki.
const CAT_CROP_TOP = 0.05, CAT_CROP_SIDE = 0.015;

// UNIA bbox treści wszystkich klatek w PRZYCIĘTYM regionie (współrzędne lokalne regionu),
// liczona raz i cache'owana. Normalizuje kadr sheetu (stały rozmiar) i jest stała dla wszystkich
// klatek → zero jittera/„rośnięcia".
const _ub = {};
function unionBBox(src, cols, rows, cropTop, cropSide) {
  const key = src + '|' + cropTop + '|' + cropSide;
  if (_ub[key]) return _ub[key];
  const c = keyedSheet(src); if (!c) return null;
  const IW = c.naturalWidth || c.width, IH = c.naturalHeight || c.height;
  const fw = IW / cols, fh = IH / rows;
  let d; try { d = _pixCtx(c).getImageData(0, 0, IW, IH).data; } catch (e) { return null; }
  const rx = fw * cropSide, ry = fh * cropTop, rw = fw * (1 - 2 * cropSide), rh = fh * (1 - cropTop);
  let minx = rw, miny = rh, maxx = 0, maxy = 0, found = false;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const ox = Math.floor(col * fw + rx), oy = Math.floor(row * fh + ry);
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
      if (d[((oy + y) * IW + (ox + x)) * 4 + 3] > 30) {
        found = true; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
  }
  const bb = found ? { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 } : { x: 0, y: 0, w: rw, h: rh };
  bb.IW = IW; bb.IH = IH; bb.cellH = fh;
  _ub[key] = bb; return bb;
}

// bbox DOLNEJ części klatki w przyciętym regionie (siedzący korpus + stołek — stabilny między
// klatkami), współrzędne lokalne regionu. Punkt kotwiczenia: środek-X i dół tego bboxa.
const _lb = {};
function lowerBBox(src, frame, cols, rows, cropTop, cropSide, lowFrac) {
  const key = src + '|' + frame + '|' + cropTop + '|' + cropSide + '|' + lowFrac;
  if (_lb[key]) return _lb[key];
  const c = keyedSheet(src); if (!c) return null;
  const IW = c.naturalWidth || c.width, IH = c.naturalHeight || c.height, fw = IW / cols, fh = IH / rows;
  const col = frame % cols, row = Math.floor(frame / cols) % rows;
  let d; try { d = _pixCtx(c).getImageData(0, 0, IW, IH).data; } catch (e) { return null; }
  const rx = fw * cropSide, ry = fh * cropTop, rw = fw * (1 - 2 * cropSide), rh = fh * (1 - cropTop);
  const ox = Math.floor(col * fw + rx), oy = Math.floor(row * fh + ry), yStart = Math.floor(lowFrac * rh);
  let minx = rw, miny = rh, maxx = 0, maxy = 0, found = false;
  for (let y = yStart; y < rh; y++) for (let x = 0; x < rw; x++) {
    if (d[((oy + y) * IW + (ox + x)) * 4 + 3] > 30) { found = true; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  }
  const bb = found ? { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 } : { x: 0, y: yStart, w: rw, h: rh - yStart };
  _lb[key] = bb; return bb;
}

// Klatka kota STABILNA (idle i cast): rysuje PRZYCIĘTY region komórki (góra+boki bez przecieku),
// rozmiar ze stałego union-bbox, pozycja kotwiczona po DOLNYM korpusie danej klatki (środek-X i
// dół) — kot/stołek STOI w miejscu na molo (zero lewitacji), góra (mina/łapy/wędka) animuje się.
function drawCatFrame(ctx, src, frame, cols, rows, cx, baselineY, contentH) {
  const c = keyedSheet(src); if (!c) return;
  const IW = c.naturalWidth || c.width, IH = c.naturalHeight || c.height, fw = IW / cols, fh = IH / rows;
  const ub = unionBBox(src, cols, rows, CAT_CROP_TOP, CAT_CROP_SIDE); if (!ub) return;
  const lb = lowerBBox(src, frame, cols, rows, CAT_CROP_TOP, CAT_CROP_SIDE, 0.45); if (!lb) return;
  const col = frame % cols, row = Math.floor(frame / cols) % rows;
  const x0 = col * fw + fw * CAT_CROP_SIDE, y0 = row * fh + fh * CAT_CROP_TOP;
  const cw = fw * (1 - 2 * CAT_CROP_SIDE), ch = fh * (1 - CAT_CROP_TOP);
  const sc = contentH / ub.h;
  const destX = cx - (lb.x + lb.w / 2) * sc;
  const destY = baselineY - (lb.y + lb.h) * sc;
  ctx.drawImage(c, x0, y0, cw, ch, destX, destY, cw * sc, ch * sc);
}

// pojedynczy sprite wyśrodkowany; dy/tilt/scaleX/scaleY do animacji z kodu (squash&stretch)
function drawImageCentered(ctx, im, cx, cy, targetH, opt = {}) {
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  const base = targetH / ih;
  const scx = base * (opt.scaleX || opt.scale || 1), scy = base * (opt.scaleY || opt.scale || 1);
  const w = iw * scx, hh = ih * scy;
  ctx.save();
  ctx.translate(cx, cy + (opt.dy || 0));
  if (opt.tilt) ctx.rotate(opt.tilt);
  ctx.drawImage(im, -w / 2, -hh / 2, w, hh);
  ctx.restore();
}

// unoszące się "Z" przy drzemiącym kocie
function drawDozeZ(ctx, x, y, t) {
  for (let k = 0; k < 2; k++) {
    const p = ((t * 0.5 + k * 0.5) % 1);
    ctx.globalAlpha = (1 - p) * 0.8;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.font = `bold ${Math.round(WORLD.H * (0.022 + k * 0.008))}px sans-serif`;
    ctx.fillText('z', x + p * WORLD.W * 0.03, y - p * WORLD.H * 0.06);
  }
  ctx.globalAlpha = 1;
}

function rrPath(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, style) {
  rrPath(ctx, x, y, w, h, r); ctx.fillStyle = style; ctx.fill();
}

// skrót dużych liczb: do 999999 pełna wartość, powyżej "M" (np. 1.2M)
function formatSC(n) { return n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'M' : String(n); }

// `minW` = minimalna szerokość; pigułka AUTO-rośnie w lewo, by zmieścić liczbę (dziesiątki tysięcy+).
function chip(ctx, rightX, cy, minW, h, color, value) {
  ctx.font = `bold ${Math.round(h * 0.42)}px sans-serif`;
  const textW = ctx.measureText(value).width;
  const w = Math.max(minW, h * 0.92 + textW + h * 0.64); // ikona+tekst+przycisk(+)
  const x = rightX - w, y = cy - h / 2;
  fillRR(ctx, x, y, w, h, h / 2, 'rgba(14,34,51,0.55)');
  rrPath(ctx, x, y, w, h, h / 2); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(x + h * 0.52, cy, h * 0.28, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = `bold ${Math.round(h * 0.42)}px sans-serif`;
  ctx.fillText(value, x + h * 0.92, cy + h * 0.15);
  ctx.beginPath(); ctx.arc(x + w - h * 0.32, cy, h * 0.25, 0, Math.PI * 2); ctx.fillStyle = '#ffcb45'; ctx.fill();
  ctx.fillStyle = '#06121f'; ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(h * 0.5)}px sans-serif`;
  ctx.fillText('+', x + w - h * 0.32, cy + h * 0.18);
  ctx.textAlign = 'left';
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const ang = -Math.PI / 2 + k * Math.PI / 5;
    const rad = k % 2 ? r * 0.45 : r;
    const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
    if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  if (filled) { ctx.fillStyle = '#ffcb45'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  else { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill(); }
}

function navArrow(ctx, cx, cy, r, dir, enabled) {
  ctx.globalAlpha = enabled ? 1 : 0.3;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(14,34,51,0.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, r * 0.14); ctx.lineCap = 'round';
  const sz = r * 0.4; ctx.beginPath();
  if (dir < 0) { ctx.moveTo(cx + sz * 0.5, cy - sz); ctx.lineTo(cx - sz * 0.5, cy); ctx.lineTo(cx + sz * 0.5, cy + sz); }
  else { ctx.moveTo(cx - sz * 0.5, cy - sz); ctx.lineTo(cx + sz * 0.5, cy); ctx.lineTo(cx - sz * 0.5, cy + sz); }
  ctx.stroke(); ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
}

function drawLock(ctx, cx, cy, r) {
  ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.22;
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.25, r * 0.5, Math.PI, 0); ctx.stroke();
  fillRR(ctx, cx - r * 0.6, cy - r * 0.1, r * 1.2, r * 0.95, r * 0.15, '#fff');
}

// skrzynka-nagroda za stage przy przycisku: 'locked' (jeszcze nie zdobyta) / 'claimed' (odebrana)
function drawStageChest(ctx, cx, cy, size, state) {
  const claimed = state === 'claimed';
  const w = size, h = size * 0.8, x = cx - w / 2, y = cy - h / 2;
  fillRR(ctx, x, y, w, h, size * 0.14, claimed ? '#caa23a' : '#48566a');
  rrPath(ctx, x, y, w, h, size * 0.14); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.36); ctx.lineTo(x + w, y + h * 0.36); ctx.stroke();
  if (claimed) {
    ctx.strokeStyle = '#2e7d4f'; ctx.lineWidth = Math.max(2, size * 0.12); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - size * 0.18, cy + size * 0.02); ctx.lineTo(cx - size * 0.04, cy + size * 0.16); ctx.lineTo(cx + size * 0.2, cy - size * 0.14); ctx.stroke(); ctx.lineCap = 'butt';
  } else {
    ctx.fillStyle = '#ffcf5a'; fillRR(ctx, cx - size * 0.1, cy - size * 0.02, size * 0.2, size * 0.18, size * 0.04, '#ffcf5a');
    ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = Math.max(1.5, size * 0.05);
    ctx.beginPath(); ctx.arc(cx, cy - size * 0.02, size * 0.08, Math.PI, 0); ctx.stroke();
  }
}

function roundedBtn(ctx, r, color, label) {
  ctx.fillStyle = color; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#eaf4ff'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(r.h * 0.42)}px sans-serif`;
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + r.h * 0.15);
  ctx.textAlign = 'left';
}

const ITEM_FB = { // fallback (zanim ikona się wczyta): kolor + etykieta
  rusty_hook: ['#9aa3ad', 'HAK'], bronze: ['#c87f3a', 'BRĄZ'], anchor: ['#5aa9e0', 'KOTW'], rocket: ['#b85c4a', 'RAKIETA'], weight: ['#6b7783', 'ODWAŻNIK'],
};
function drawItemCell(ctx, it, x, y, cell) { drawItemSpan(ctx, it, x, y, cell, cell, true); }
// Rysuje item w prostokącie wpx×hpx (item wieloslotowy rozciąga się na swój footprint).
// bg=true → maluje tło slotu w kolorze rzadkości (sygnał siły); na żyłce bg=false.
function drawItemSpan(ctx, it, x, y, wpx, hpx, bg) {
  const pad = Math.min(wpx, hpx) * 0.1;
  if (bg) {
    const rar = RARITY[it.rarity] || RARITY.common;
    fillRR(ctx, x + 2, y + 2, wpx - 4, hpx - 4, 8, rar.bg);
    rrPath(ctx, x + 2, y + 2, wpx - 4, hpx - 4, 8); ctx.strokeStyle = rar.edge; ctx.lineWidth = 2.5; ctx.stroke();
  }
  const im = keyedEdge(ITEM_SPRITE[it.id]);
  if (im) {
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const bw = wpx - 2 * pad, bh = hpx - 2 * pad, sc = Math.min(bw / iw, bh / ih), w = iw * sc, h = ih * sc;
    ctx.drawImage(im, x + wpx / 2 - w / 2, y + hpx / 2 - h / 2, w, h);
  } else {
    const [col, label] = ITEM_FB[it.id] || ['#9aa3ad', '?'];
    if (!bg) fillRR(ctx, x + pad, y + pad, wpx - 2 * pad, hpx - 2 * pad, 6, col); // bg już maluje tło rzadkości
    ctx.fillStyle = bg ? '#eaf2ff' : '#06121f'; ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(hpx * 0.15)}px sans-serif`;
    ctx.fillText(label, x + wpx / 2, y + hpx / 2 + hpx * 0.06);
  }
}

// Obudowa tackleboxa (proceduralna) — grid siedzi w środku. Styl/kolor wg poziomu (tb).
function drawTacklebox(ctx, x, y, w, h, tb) {
  const r = Math.max(8, Math.min(w, h) * 0.07);
  // uchwyt nad korpusem
  const hw = w * 0.30, hx = x + w / 2 - hw / 2, hTop = y - h * 0.16;
  ctx.save();
  ctx.strokeStyle = tb.trim; ctx.lineWidth = Math.max(5, h * 0.028); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx, y + 4);
  ctx.lineTo(hx, hTop + hw * 0.5);
  ctx.arc(hx + hw / 2, hTop + hw * 0.5, hw / 2, Math.PI, 0);
  ctx.lineTo(hx + hw, y + 4);
  ctx.stroke();
  ctx.restore();
  // korpus
  fillRR(ctx, x, y, w, h, r, tb.body);
  rrPath(ctx, x, y, w, h, r); ctx.strokeStyle = tb.trim; ctx.lineWidth = Math.max(3, h * 0.02); ctx.stroke();
  // górna listwa (pokrywa/zatrzask)
  fillRR(ctx, x + w * 0.04, y + h * 0.03, w * 0.92, h * 0.10, r * 0.6, 'rgba(0,0,0,0.22)');
  fillRR(ctx, x + w / 2 - w * 0.06, y + h * 0.05, w * 0.12, h * 0.055, 4, tb.trim); // zatrzask na środku
  // nity po bokach
  ctx.fillStyle = tb.trim;
  for (const py of [y + h * 0.45, y + h * 0.75]) for (const px of [x + w * 0.045, x + w * 0.955]) {
    ctx.beginPath(); ctx.arc(px, py, Math.max(2, h * 0.013), 0, Math.PI * 2); ctx.fill();
  }
}

// Tacka ekwipunku: przewijalna siatka slotów, itemy zajmują footprint (slots×1), duplikaty xN.
// Zwraca Y pod tacką (do dalszego layoutu). Zapisuje s._bpInvGrid i s._bpInv (rect ekranowe).
function drawInventoryTray(ctx, s, top) {
  const W = WORLD.W, H = WORLD.H;
  const inv = Object.entries(s.progress.inventory).filter(([, n]) => n > 0);
  ctx.fillStyle = '#cfe2f5'; ctx.font = `${Math.round(H * 0.02)}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(inv.length ? 'Ekwipunek — przeciągnij do tackleboxa (tap = opis):'
                          : 'Brak akcesoriów — zdobądź skrzynię na Home', W / 2, top);
  const trayTop = Math.round(top + H * 0.016);
  const trayW = Math.round(W * 0.9), ox = Math.round((W - trayW) / 2);
  const cols = INV_COLS, cell = Math.floor(trayW / cols);
  const trayH = Math.round(INV_VISIBLE_ROWS * cell);
  // layout flow z footprintem
  const placed = []; let col = 0, row = 0;
  for (const [id, n] of inv) {
    const w = (ITEMS[id] && ITEMS[id].slots) || 1;
    if (col + w > cols) { col = 0; row++; }
    placed.push({ id, n, col, row, w }); col += w;
  }
  const contentRows = inv.length ? row + 1 : 0;
  const scrollMax = Math.max(0, contentRows * cell - trayH);
  s.bpInvScroll = Math.max(0, Math.min(scrollMax, s.bpInvScroll || 0));
  const sc = s.bpInvScroll;
  // tło tacki + ramka
  fillRR(ctx, ox, trayTop, trayW, trayH, 8, 'rgba(8,20,30,0.55)');
  rrPath(ctx, ox, trayTop, trayW, trayH, 8); ctx.strokeStyle = 'rgba(127,209,255,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); rrPath(ctx, ox, trayTop, trayW, trayH, 8); ctx.clip();
  // ramki kratek (widoczne)
  const gridRows = Math.max(contentRows, Math.ceil(trayH / cell) + 1);
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < cols; c++) {
    const cy = trayTop + r * cell - sc;
    if (cy + cell < trayTop || cy > trayTop + trayH) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    ctx.strokeRect(ox + c * cell + 1, cy + 1, cell - 2, cell - 2);
  }
  s._bpInv = [];
  for (const p of placed) {
    if (s.bpInvDrag && s.bpInvDrag.moved && s.bpInvDrag.id === p.id) continue; // ghost rysowany osobno
    const cx = ox + p.col * cell, cy = trayTop + p.row * cell - sc, wpx = p.w * cell;
    if (cy + cell < trayTop || cy > trayTop + trayH) continue;
    drawItemSpan(ctx, ITEMS[p.id], cx, cy, wpx, cell, true);
    if (s.bpSelected && s.bpSelected.gridIdx == null && s.bpSelected.id === p.id) {
      rrPath(ctx, cx, cy, wpx, cell, 8); ctx.strokeStyle = '#ffcb45'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(cell * 0.2)}px sans-serif`; ctx.textAlign = 'right';
    ctx.fillText('x' + p.n, cx + wpx - 4, cy + cell - 6);
    s._bpInv.push({ rect: { x: cx, y: cy, w: wpx, h: cell }, id: p.id, w: p.w });
  }
  ctx.restore();
  s._bpInvGrid = { ox, oy: trayTop, cell, cols, trayH, trayW, scrollMax };
  if (scrollMax > 0 && sc < scrollMax - 1) {  // sygnał scrolla
    ctx.fillStyle = 'rgba(207,226,245,0.55)'; ctx.textAlign = 'center'; ctx.font = `${Math.round(H * 0.02)}px sans-serif`;
    ctx.fillText('▼', W / 2, trayTop + trayH - 3);
  }
  return trayTop + trayH + H * 0.028;
}

function renderBackpack(ctx, s) {
  const W = WORLD.W, H = WORLD.H;
  const bg = img('assets/ui/backpack-bg.png');
  const hasBg = ready(bg);
  if (hasBg) {
    const iw = bg.naturalWidth, ih = bg.naturalHeight;
    const scale = Math.max(W / iw, H / ih), dw = iw * scale, dh = ih * scale;
    ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);   // cover
  } else {
    ctx.fillStyle = '#0a2236'; ctx.fillRect(0, 0, W, H);     // fallback: brak pliku
  }
  ctx.fillStyle = '#e6f0ff'; ctx.font = `bold ${Math.round(H * 0.03)}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(s.hook ? 'Plecak' : 'Włóż hak do plecaka', W / 2, H * 0.065);

  // wymiary gridu z bieżącego tackleboxa (rosną z lepszym tackleboxem)
  const cols = s.grid.cols, rows = s.grid.rows;
  const tb = tackleboxOf(s.progress.tackleboxTier);
  let bcell, gw, gh, ox, oy;
  if (hasBg) {
    // wpasuj grid w NAMALOWANE wnętrze tacy (frakcje obrazu 1080x1920 == canvas 9:16, cover 1:1)
    const ix0 = W * 0.19, ix1 = W * 0.81, iy0 = H * 0.25, iy1 = H * 0.51;
    const iw2 = ix1 - ix0, ih2 = iy1 - iy0;
    bcell = Math.floor(Math.min(iw2 / cols, ih2 / rows));
    gw = cols * bcell; gh = rows * bcell;
    ox = Math.round(ix0 + (iw2 - gw) / 2);
    oy = Math.round(iy0 + (ih2 - gh) / 2);
    // malowany box JEST obudową — nie rysujemy drawTacklebox
  } else {
    bcell = Math.round(Math.min((W * 0.74) / cols, H * 0.092));
    gw = cols * bcell; gh = rows * bcell;
    ox = Math.round((W - gw) / 2); oy = Math.round(H * 0.175);
    const p = Math.round(bcell * 0.34);
    drawTacklebox(ctx, ox - p, oy - p, gw + 2 * p, gh + 2 * p, tb); // rysowana obudowa gdy brak tła
  }
  const pad = Math.round(bcell * 0.34);

  // 1) komórki jako wcięte wnęki tackleboxa. Z malowanym tłem — subtelnie (drewno już jest);
  //    bez tła — rysujemy też drewnianą tacę pod spodem. Grid skaluje się do tieru i UI.
  if (!hasBg) fillRR(ctx, ox - 4, oy - 4, gw + 8, gh + 8, 8, 'rgba(46,30,16,0.6)');
  const wellCol = hasBg ? 'rgba(20,13,7,0.32)' : 'rgba(18,12,7,0.62)';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cxp = ox + c * bcell, cyp = oy + r * bcell;
    fillRR(ctx, cxp + 3, cyp + 3, bcell - 6, bcell - 6, 6, wellCol);                  // wcięta wnęka
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;                           // cień górnej-lewej krawędzi (głębia)
    ctx.beginPath(); ctx.moveTo(cxp + 4, cyp + bcell - 5); ctx.lineTo(cxp + 4, cyp + 4); ctx.lineTo(cxp + bcell - 5, cyp + 4); ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.5; rrPath(ctx, cxp + 2, cyp + 2, bcell - 4, bcell - 4, 6); // listwa (ciepła krawędź wnęki)
    ctx.strokeStyle = tb.trim; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }
  // 2) itemy — każdy RAZ, rozciągnięty na swój footprint (slots×1). Pomijamy aktualnie przeciągany.
  const dragOrigin = s.bpDrag ? itemOrigin(s.grid, s.bpDrag.fromIdx) : -1;
  const linked = bronzeComponent(s.grid, ITEMS);       // komórki połączone z brązem
  // link AKTYWNY tylko gdy w komponencie jest akcesorium z bonusem połączenia (maxLatch, np. kotwica)
  const linkActive = [...linked].some(i => { const it = ITEMS[s.grid.cells[i]]; return it && it.maxLatch > 0; });
  for (const { id, idx, w } of gridItems(s.grid, ITEMS)) {
    if (!ITEMS[id] || idx === dragOrigin) continue;
    const c = idx % cols, r = Math.floor(idx / cols);
    const cx = ox + c * bcell, cy = oy + r * bcell, wpx = w * bcell;
    drawItemSpan(ctx, ITEMS[id], cx, cy, wpx, bcell, true); // tło rzadkości
    // ramka POŁĄCZENIA — tylko brąz i akcesoria z bonusem połączenia (nie zwykli sąsiedzi jak odważnik/rakieta)
    if (linkActive && (id === 'bronze' || ITEMS[id].maxLatch > 0)) {
      let inLink = false; for (let k = 0; k < w; k++) if (linked.has(idx + k)) { inLink = true; break; }
      if (inLink) {
        ctx.save(); ctx.shadowColor = '#52d0ff'; ctx.shadowBlur = 8;
        rrPath(ctx, cx + 1, cy + 1, wpx - 2, bcell - 2, 8); ctx.strokeStyle = '#52d0ff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
      }
    }
    if (s.bpSelected && itemOrigin(s.grid, s.bpSelected.gridIdx) === idx) {
      rrPath(ctx, cx, cy, wpx, bcell, 8); ctx.strokeStyle = '#ffcb45'; ctx.lineWidth = 3; ctx.stroke();
    }
  }
  s._grid = { ox, oy, cell: bcell };
  // nazwa tackleboxa pod obudową
  ctx.fillStyle = tb.trim; ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(H * 0.019)}px sans-serif`;
  ctx.fillText(tb.name + `  (${cols}×${rows})`, W / 2, oy + gh + pad + H * 0.028);

  // panel PODSUMOWANIA statów haka (suma włożonych akcesoriów) — zastępuje linijkę + stary hint
  let y = oy + gh + pad + H * 0.05;
  s._bpInv = [];
  s._bpPlaceBtn = null;
  s._bpUnequipBtn = null;
  if (s.hook) {
    const pw = W * 0.9, px = (W - pw) / 2, ph = H * 0.048;
    fillRR(ctx, px, y, pw, ph, 8, 'rgba(14,34,51,0.85)');
    rrPath(ctx, px, y, pw, ph, 8); ctx.strokeStyle = 'rgba(127,209,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    const parts = [`Atak ${s.hook.atk}`, `Ryby ${s.hook.maxLatch}`, `Wytrz. ${s.hook.dur}`];
    const projectiles = gridItems(s.grid, ITEMS).filter(g => ITEMS[g.id] && ITEMS[g.id].rocketDmg > 0).length;
    if (projectiles > 0) parts.push(`Pociski ${projectiles}`);
    ctx.fillStyle = '#cfe2f5'; ctx.font = `bold ${Math.round(H * 0.021)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(parts.join('    ·    '), W / 2, y + ph * 0.64);
    y += ph + H * 0.022;
    y = drawInventoryTray(ctx, s, y);
  } else {
    ctx.fillStyle = '#ffd166'; ctx.font = `${Math.round(H * 0.024)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('Tap pole, by włożyć: ' + STARTER_HOOK.name, W / 2, y);
    y += H * 0.04;
  }

  const bw = Math.round(W * 0.4), bh = Math.round(H * 0.07);
  const back = { x: W / 2 - bw / 2, y: Math.min(y, H - bh - H * 0.04), w: bw, h: bh };
  roundedBtn(ctx, back, '#2e7d4f', s.hook ? 'WRÓĆ NA HOME' : 'WRÓĆ');
  s._backpackBack = back;

  // ghost przeciąganego itemu (podąża za palcem) — tylko gdy faktycznie ciągniemy
  if (s.bpDrag && s.bpDrag.moved && ITEMS[s.bpDrag.id]) {
    const cs = s._grid.cell;
    ctx.globalAlpha = 0.8;
    drawItemCell(ctx, ITEMS[s.bpDrag.id], s.bpDrag.x - cs / 2, s.bpDrag.y - cs / 2, cs);
    ctx.globalAlpha = 1;
  }
  // ghost itemu przeciąganego Z tacki inventory (footprint)
  if (s.bpInvDrag && s.bpInvDrag.moved && ITEMS[s.bpInvDrag.id]) {
    const cs = (s._bpInvGrid && s._bpInvGrid.cell) || s._grid.cell;
    const w = ((ITEMS[s.bpInvDrag.id].slots) || 1) * cs;
    ctx.globalAlpha = 0.8;
    drawItemSpan(ctx, ITEMS[s.bpInvDrag.id], s.bpInvDrag.x - cs / 2, s.bpInvDrag.y - cs / 2, w, cs, true);
    ctx.globalAlpha = 1;
  }

  // POPUP itemu (modal, minimal: nazwa + staty + akcja) — nad wszystkim, tap obok zamyka
  if (s.bpSelected && ITEMS[s.bpSelected.id]) {
    const it = ITEMS[s.bpSelected.id], placed = s.bpSelected.gridIdx != null;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);            // dim
    const pw = W * 0.72, ph = H * 0.2, px = (W - pw) / 2, py = (H - ph) / 2;
    fillRR(ctx, px, py, pw, ph, 12, 'rgba(14,34,51,0.98)');
    rrPath(ctx, px, py, pw, ph, 12); ctx.strokeStyle = 'rgba(127,209,255,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(H * 0.026)}px sans-serif`;
    ctx.fillText(it.name, W / 2, py + H * 0.05);
    const stats = [];
    if (it.atk) stats.push('+' + it.atk + ' atk');
    if (it.maxLatch) stats.push('+' + it.maxLatch + ' ryba');
    if (it.dur) stats.push('+' + it.dur + ' wytrz.');
    if (it.rocketDmg) stats.push('rakieta ' + it.rocketDmg);
    ctx.fillStyle = '#9fd0ff'; ctx.font = `${Math.round(H * 0.021)}px sans-serif`;
    ctx.fillText(stats.join('   ·   '), W / 2, py + H * 0.092);
    const bw2 = pw * 0.72, bh2 = H * 0.052, bx2 = W / 2 - bw2 / 2, by2 = py + ph - bh2 - H * 0.024;
    if (placed && it.kind !== 'hook') {
      roundedBtn(ctx, { x: bx2, y: by2, w: bw2, h: bh2 }, '#9a4b4b', 'WYPNIJ');
      s._bpUnequipBtn = { x: bx2, y: by2, w: bw2, h: bh2 };
    } else if (!placed && s.progress.inventory[s.bpSelected.id] > 0) {
      roundedBtn(ctx, { x: bx2, y: by2, w: bw2, h: bh2 }, '#2e7d4f', 'WŁÓŻ');
      s._bpPlaceBtn = { x: bx2, y: by2, w: bw2, h: bh2 };
    }
    ctx.fillStyle = 'rgba(207,226,245,0.5)'; ctx.font = `${Math.round(H * 0.015)}px sans-serif`;
    ctx.fillText('tap obok, by zamknąć', W / 2, py + ph - H * 0.007);
  }
  ctx.textAlign = 'left';
}

function renderDescent(ctx, s, hookX, hookY) {
  const camY = s.depthPx; // świat -> ekran: screenY = worldY - camY
  const hookH = WORLD.H * 0.085; // rozmiar haka — używany też wcześniej (pociski) → liczony na górze

  // gradient głębi — przyciemnia się wraz z głębokością. df liczone od głębi ABSOLUTNEJ
  // (lokalna + offset areny) i skalowane do ~55 m, by ciemnienie było WYRAŹNE w grywalnym zakresie.
  const depthM = s.depthPx / WORLD.pxPerMeter + (s.stageOffsetM || 0);
  const df = Math.min(1, depthM / 55);
  const top = lerpRgb([14, 59, 92], [2, 12, 22], df);
  const bot = lerpRgb([4, 20, 34], [0, 3, 7], df);
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.H);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, WORLD.W, WORLD.H);

  // tło podwodne — zapętlone w pionie, przewija się z głębokością (ciemnieje wyraźnie)
  const uw = img(arenaUnderwaterSrc(s.stageIndex));
  if (ready(uw)) drawScrollTiles(ctx, uw, camY, 0.92 - df * 0.78);

  // (scena powierzchni usunięta — descent zaczyna się OD RAZU pod wodą; przejście maskuje kurtyna)
  // dodatkowe ściemnienie otoczenia z głębokością (atmosfera głębin)
  if (df > 0) { ctx.fillStyle = `rgba(1,6,12,${(df * 0.7).toFixed(3)})`; ctx.fillRect(0, 0, WORLD.W, WORLD.H); }

  // "shader wody": snopy światła z powierzchni (god rays) — animowane, zanikają z głębokością
  const nowD = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  drawGodRays(ctx, nowD, df);

  // "słup wody" — drobinki na stałych pozycjach świata, parallax. Przewijają się
  // w górę razem z kamerą, dając stały układ odniesienia: to MY opadamy.
  drawParticles(ctx, camY, 0.55, 96, 1.4, 0.10); // warstwa daleka: wolniejsza, drobna
  drawParticles(ctx, camY, 1.0, 70, 2.0, 0.16);  // warstwa bliska: szybsza, większa
  // ryby — sprite'y (fallback na kółko, gdy obraz jeszcze się ładuje)
  for (const f of s.fish) {
    const sy = f.y - camY;
    if (sy < -60 || sy > WORLD.H + 60) continue;
    const t = FISH_TYPES[f.type];
    const rad = t.radius * (f.scale || 1);   // bossy 20% większe (f.scale = 1.2)
    const im = keyedEdge(FISH_SPRITE[f.type]);
    if (im) {
      f._sx = (f._sx === undefined ? f.dir : f._sx + (f.dir - f._sx) * 0.12); // płynne zawracanie (scaleX przez 0)
      const tilt = Math.sin(nowD * 1.6 + (f.phaseX || 0)) * 0.06;             // delikatne kołysanie ciała
      drawFishSprite(ctx, im, f.x, sy, rad, f._sx, 1, tilt, df * 0.7);        // ciemnieje z głębokością
    } else {
      ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(f.x, sy, rad, 0, Math.PI * 2); ctx.fill();
    }
    // tarcza "nieuchwytna" — ryba po zerwaniu, której NIE można teraz zahaczyć: bufor po 1. zerwaniu
    // (recatchLock) lub na stałe po 2. zerwaniu (recatchLeft<=0) aż ucieknie. Niebieski transparentny klosz.
    if (f.state === 'escaped' && ((f.recatchLock || 0) > 0 || (f.recatchLeft || 0) <= 0)) {
      const rr = rad + 6, pulse = 0.5 + 0.5 * Math.sin(nowD * 4);
      ctx.save();
      ctx.beginPath(); ctx.arc(f.x, sy, rr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(90,170,255,${0.14 + 0.06 * pulse})`; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(130,200,255,${0.5 + 0.3 * pulse})`; ctx.stroke();
      ctx.restore();
    }
    // wskaźnik HP — na zaczepionej ORAZ na namierzonej przez rakietnicę (widać ubywanie hp).
    if (f.state === 'latched' || f.marked) {
      const w = rad * 2;
      ctx.fillStyle = '#000'; ctx.fillRect(f.x - rad, sy - rad - 14, w, 5);
      ctx.fillStyle = '#ff5d5d'; ctx.fillRect(f.x - rad, sy - rad - 14, w * Math.max(0, f.hp / f.hpMax), 5);
    }
    // mark celownika rakietnicy — czerwony narożnikowy reticle (cel namierzony przez wyrzutnię)
    if (f.marked) {
      const rr = rad + 6, k = rr * 0.5, sp = nowD * 2.5;
      ctx.save(); ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2.5;
      ctx.translate(f.x, sy); ctx.rotate(sp * 0.0); // narożniki
      for (const [sxn, syn] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(sxn * rr, syn * rr - syn * k); ctx.lineTo(sxn * rr, syn * rr); ctx.lineTo(sxn * rr - sxn * k, syn * rr);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  // pociski rakiet — sprite obracany w stronę celu (fallback: proceduralna smuga)
  const shotIm = keyedEdge(ROCKET_SHOT_SRC);
  for (const rk of s.rockets || []) {
    const f = rk.target; if (!f) continue;
    const p = Math.min(1, rk.t / ROCKET_FLIGHT);
    const x0 = rk.x, y0 = rk.y - camY, x1 = f.x, y1 = f.y - camY;
    const px = x0 + (x1 - x0) * p, py = y0 + (y1 - y0) * p;
    const a = Math.atan2(y1 - y0, x1 - x0); // sprite dziobem w prawo (0 rad) → rotacja = kąt lotu
    if (shotIm) {
      const sw = hookH * 0.6, sh = sw * (shotIm.naturalHeight || 1) / (shotIm.naturalWidth || 1);
      ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.drawImage(shotIm, -sw / 2, -sh / 2, sw, sh); ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,200,120,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * 18, py - Math.sin(a) * 18); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = '#fff2c8'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // bańki z ogłuszonymi (sprite ryby + bańka)
  for (const b of s.bubbles || []) {
    const sy = b.bubbleY - camY;
    if (sy < -60 || sy > WORLD.H + 60) continue;
    const t = FISH_TYPES[b.type];
    const fim = keyedEdge(FISH_SPRITE[b.type]);
    if (fim) drawFishSprite(ctx, fim, b.x, sy, t.radius * 0.8, b.dir, 0.9, 0, df * 0.7);
    const bim = img(BUBBLE_SRC);
    if (ready(bim)) {
      const d = t.radius * 3.4;
      ctx.globalAlpha = 0.85; ctx.drawImage(bim, b.x - d / 2, sy - d / 2, d, d); ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = 'rgba(200,235,255,0.6)'; ctx.beginPath(); ctx.arc(b.x, sy, t.radius + 6, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // dolna granica pasma ruchu haka (subtelna linia orientacyjna)
  ctx.strokeStyle = 'rgba(223,233,245,0.12)'; ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  ctx.beginPath(); ctx.moveTo(0, WORLD.hookMaxY); ctx.lineTo(WORLD.W, WORLD.hookMaxY); ctx.stroke();
  ctx.setLineDash([]);

  // żyłka — NIE prosta kreska: wygina się i reaguje na ruch. _lineLagX podąża z opóźnieniem
  // za hakiem → różnica (drag) wygina żyłkę w stronę przeciwną do ruchu; do tego delikatna fala.
  // hak rysujemy OSTRZEM (dół obrazka) na linii zaczepu (hookY) — ryby łapią się na ostrzu,
  // oczko jest WYŻEJ i tam łączy się żyłka.
  const eyeletY = hookY - hookH * 0.82;           // oczko ~ górna część obrazka
  _lineLagX = _lineLagX === null ? hookX : _lineLagX + (hookX - _lineLagX) * 0.12;
  const drag = hookX - _lineLagX;                 // proxy prędkości bocznej
  const sway = Math.sin(nowD * 1.6) * 6;          // delikatne falowanie w wodzie
  ctx.strokeStyle = '#e8eef6'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hookX - drag * 0.5, 0);
  ctx.bezierCurveTo(
    hookX - drag * 1.4 + sway, eyeletY * 0.34,
    hookX - drag * 1.9 + sway * 0.6, eyeletY * 0.72,
    hookX, eyeletY);                               // żyłka kończy się na OCZKU haka
  ctx.stroke(); ctx.lineCap = 'butt';

  // === BOCZNE ATTACHEMENTY na żyłce === gadżety (mount:'side') mają WBUDOWANE zaciski, więc
  // montują się wprost na żyłce nad hakiem, stackowane w górę i naprzemiennie L/P (żeby się nie
  // nakładały). Sprite flipowany dla lewej strony, by zacisk patrzył na żyłkę.
  const sideItems = gridItems(s.grid, ITEMS).filter(g => ITEMS[g.id] && ITEMS[g.id].mount === 'side');
  sideItems.forEach((it, i) => {
    const aSize = hookH * 0.92, stepY = hookH * 0.95;
    const ay = eyeletY - hookH * 0.55 - i * stepY;     // stackowane w górę nad oczkiem
    const sway = Math.sin(nowD * 1.6 + i) * 3;
    // obrót o 90° (dziób w dół, ku rybom) + przesunięcie tak, by ZACISK (po obrocie z lewej)
    // siadł dokładnie na żyłce (hookX), a korpus wystawał w bok.
    ctx.save();
    ctx.translate(hookX + sway + aSize * 0.30, ay);
    ctx.rotate(Math.PI / 2);
    drawItemSpan(ctx, ITEMS[it.id], -aSize / 2, -aSize / 2, aSize, aSize, false);
    ctx.restore();
  });

  // ODWAŻNIK (sinker) — wisi na żyłce tuż nad oczkiem (jeśli założony). weight.png lub proceduralny teardrop.
  if (s.hook && s.hook.hasWeight) {
    const wsz = hookH * 0.5, wx = hookX + Math.sin(nowD * 1.6) * 3, wy = eyeletY - hookH * 0.30;
    const wim = keyedEdge(ITEM_SPRITE.weight);
    if (wim) {
      const ar = (wim.width || 1) / (wim.height || 1), wh = wsz, ww = wh * ar;
      ctx.drawImage(wim, wx - ww / 2, wy - wh / 2, ww, wh);
    } else {
      ctx.save();
      ctx.fillStyle = '#5b6b7a'; ctx.strokeStyle = '#27313c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(wx, wy + wsz * 0.08, wsz * 0.32, wsz * 0.44, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8b97a3'; ctx.beginPath(); ctx.ellipse(wx, wy - wsz * 0.34, wsz * 0.12, wsz * 0.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // oczko
      ctx.fillStyle = 'rgba(200,222,244,0.35)'; ctx.beginPath(); ctx.ellipse(wx - wsz * 0.1, wy - wsz * 0.04, wsz * 0.09, wsz * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // JEDEN widoczny hak wg tego co założone: kotwiczka > brąz > rusty (baza). Z kotwą+brązem → kotwa na brąz.
  const hasBronze = s.hook && s.hook.hasBronze, hasAnchor = s.hook && s.hook.hasAnchor;
  const hookSrc = hasAnchor ? ITEM_SPRITE.anchor : hasBronze ? ITEM_SPRITE.bronze : ITEM_SPRITE.rusty_hook;
  const him = keyedEdge(hookSrc);
  if (him) {
    const hw = hookH * (him.naturalWidth || him.width) / (him.naturalHeight || him.height);
    const dx = hookX - hw / 2, dy = hookY - hookH; // ostrze (dół) na hookY, oczko u góry
    if (hasAnchor && hasBronze && 'filter' in ctx) ctx.filter = 'sepia(1) saturate(1.35) brightness(0.78) contrast(1.05)'; // kotwa → brąz (ciemny, odsycony — nie złoty)
    ctx.drawImage(him, dx, dy, hw, hookH);
    ctx.filter = 'none';
  } else { ctx.fillStyle = '#dfe9f5'; ctx.beginPath(); ctx.arc(hookX, hookY, 8, 0, Math.PI * 2); ctx.fill(); }

  // wskaźniki PRZY HAKU: durability (lewy łuk) + serca — żeby gracz je widział w akcji
  drawHookGauge(ctx, hookX, hookY, s);

  // top bar (HUD) na wierzchu — hak/ryby pod niego nie wchodzą
  ctx.fillStyle = 'rgba(4,18,31,0.9)'; ctx.fillRect(0, 0, WORLD.W, WORLD.topBarH);
  ctx.strokeStyle = 'rgba(127,209,255,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, WORLD.topBarH + 0.5); ctx.lineTo(WORLD.W, WORLD.topBarH + 0.5); ctx.stroke();
  const baseY = Math.round(WORLD.topBarH / 2) + 6;
  // (życia przeniesione PRZY HAK — drawHookGauge)
  // głębia (prawo)
  ctx.fillStyle = '#9fd0ff'; ctx.font = '16px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(Math.round(s.depthPx / WORLD.pxPerMeter) + ' m', WORLD.W - 12, baseY);
  // score + palące się gwiazdki (środek) — na bieżąco wg progów stage'a
  const liveStars = computeStars(s.score, STAGES[s.stageIndex].stars);
  const starR = WORLD.topBarH * 0.16, sgap = starR * 2.5, groupW = 3 * sgap;
  const scoreRight = WORLD.W / 2 - groupW / 2 - 8;
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(s.score + ' score', scoreRight, baseY);
  const starsX0 = scoreRight + 12;
  for (let k = 0; k < 3; k++) star(ctx, starsX0 + sgap * (k + 0.5), baseY - 6, starR, k < liveStars);
  ctx.textAlign = 'left';

  // kurtyna reveal: krzaki trzymają ZAKRYTE (HOLD, "loading"), potem rozjeżdżają się (OPEN)
  if (s.reveal) {
    const t = s.reveal.t;
    const cover = t < REVEAL_HOLD ? 1 : Math.max(0, 1 - (t - REVEAL_HOLD) / REVEAL_OPEN);
    drawTransitionCurtain(ctx, WORLD.W, WORLD.H, cover);
  }
}

// --- helpery wizualne (bez wpływu na logikę) ---

function lerpRgb(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

// Deterministyczny hash na komórkę siatki — stabilne pozycje drobinek (bez migotania).
function hash(a, b) {
  let n = (a * 73856093) ^ (b * 19349663);
  n = (n ^ (n >>> 13)) >>> 0;
  return n;
}

function drawParticles(ctx, camY, parallax, spacing, size, alpha) {
  const cam = camY * parallax;
  const startRow = Math.floor((cam - spacing) / spacing);
  const endRow = Math.floor((cam + WORLD.H + spacing) / spacing);
  const cols = Math.ceil(WORLD.W / spacing) + 1;
  ctx.fillStyle = `rgba(190,224,255,${alpha})`;
  for (let row = startRow; row <= endRow; row++) {
    for (let col = 0; col < cols; col++) {
      const h = hash(row, col);
      const wx = col * spacing + (h % spacing);
      const wy = row * spacing + ((h >>> 3) % spacing);
      const sy = wy - cam;
      ctx.beginPath(); ctx.arc(wx, sy, size, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// źródło tła podwodnego per arena (zapętlane w pionie)
function arenaUnderwaterSrc(globalIndex) { return `assets/arenas/${ARENAS[arenaOf(globalIndex)].bg}-underwater.png`; }

// zapętlone tło podwodne — kafle w pionie, LUSTRZANE (co druga odbita) by krawędzie się zgrały
// (asset nie jest tileable: góra jasna, dół ciemny → mirror łączy dół-z-dołem, górę-z-górą).
function drawScrollTiles(ctx, im, camY, brightness) {
  const W = WORLD.W, H = WORLD.H, iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  const tileH = W * (ih / iw), scroll = camY * 0.6, first = Math.floor(scroll / tileH);
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, brightness));
  for (let wi = first; ; wi++) {
    const y = wi * tileH - scroll;
    if (y >= H) break;
    if ((((wi % 2) + 2) % 2) === 1) { // nieparzysta → odbita w pionie
      ctx.save(); ctx.translate(0, y + tileH); ctx.scale(1, -1); ctx.drawImage(im, 0, 0, W, tileH); ctx.restore();
    } else ctx.drawImage(im, 0, y, W, tileH);
  }
  ctx.restore();
}

// "shader wody": miękkie snopy światła z powierzchni — rozmyte krawędzie, pochylone pod kątem,
// migoczą i SZYBKO zanikają z głębokością (przy dnie znikają zupełnie).
function drawGodRays(ctx, now, df) {
  const W = WORLD.W, H = WORLD.H;
  const fade = Math.pow(Math.max(0, 1 - df), 1.7); // wygaszanie z głębią (szybsze niż liniowe)
  const base = fade * 0.12;
  if (base <= 0.006) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if ('filter' in ctx) ctx.filter = `blur(${Math.max(6, Math.round(W * 0.04))}px)`; // miękkie krawędzie
  for (let k = 0; k < 3; k++) {
    const x = W * (0.27 + 0.23 * k) + Math.sin(now * 0.22 + k * 2.1) * W * 0.035;
    const tilt = W * 0.12, w = W * (0.05 + 0.018 * (k % 2));
    const flick = 0.65 + 0.35 * Math.sin(now * 0.9 + k * 1.3); // migotanie jasności
    const endY = H * (0.5 + 0.12 * (k % 2));
    const grd = ctx.createLinearGradient(0, 0, 0, endY);
    grd.addColorStop(0, `rgba(175,222,255,${(base * flick).toFixed(3)})`);
    grd.addColorStop(0.6, `rgba(175,222,255,${(base * flick * 0.4).toFixed(3)})`);
    grd.addColorStop(1, 'rgba(175,222,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(x - w, 0); ctx.lineTo(x + w, 0);
    ctx.lineTo(x + tilt + w * 1.8, endY); ctx.lineTo(x + tilt - w * 1.8, endY);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function renderEnd(ctx, s) {
  const cx = WORLD.W / 2, H = WORLD.H;
  ctx.fillStyle = 'rgba(3,12,20,0.86)'; ctx.fillRect(0, 0, WORLD.W, H);
  ctx.textAlign = 'center';
  const st = STAGES[s.stageIndex];
  ctx.fillStyle = '#e6f0ff'; ctx.font = `${Math.round(H * 0.03)}px sans-serif`;
  ctx.fillText(st.arenaName + ' · Stage ' + st.no, cx, H * 0.30);
  // status: wyczyszczone vs fail
  const cleared = s.lastResult && s.lastResult.cleared;
  ctx.fillStyle = cleared ? '#7fffa1' : '#ff9a9a'; ctx.font = `bold ${Math.round(H * 0.034)}px sans-serif`;
  ctx.fillText(cleared ? 'Łowisko wyczyszczone!' : 'Zerwana żyłka!', cx, H * 0.35);
  // gwiazdki (wektorowe)
  const sr = H * 0.035, sg = sr * 2.6;
  for (let k = 0; k < 3; k++) star(ctx, cx - sg + k * sg, H * 0.43, sr * (k === 1 ? 1.1 : 1), k < s.stars);
  // staty
  ctx.fillStyle = '#cfe2f5'; ctx.font = `${Math.round(H * 0.026)}px sans-serif`;
  ctx.fillText('Głębia ' + Math.round(s.depthPx / WORLD.pxPerMeter) + ' m · ' + s.stunned + ' ryb · ' + s.score + ' score', cx, H * 0.50);
  if (s.lastResult && s.lastResult.newUnlock) {
    ctx.fillStyle = '#7fffa1'; ctx.fillText('Odblokowano kolejny stage!', cx, H * 0.55);
  } else if (s.stars === 0) {
    ctx.fillStyle = '#ffd166'; ctx.fillText('Wzmocnij hak w plecaku', cx, H * 0.55);
  }
  ctx.fillStyle = '#9fd0ff'; ctx.fillText('Tap — wróć na Home', cx, H * 0.62);
  ctx.textAlign = 'left';
}
