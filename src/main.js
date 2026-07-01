import { WORLD, BACKPACK, layoutWorld, CAST_DUR, ITEMS, TEST_ENDLESS_DESCENT } from './config.js';
import { createGame, placeHook, placeAccessory, placeAccessoryAt, selectAccessory, selectPlaced, unequipAccessory, moveItem, startStage, stageUnlocked, carouselMove, arenaMove, selectStageIndex, openBackpack, closeBackpack, returnHome, openChest, dismissChest, loginGuest, clearProgress } from './state.js';
import { stepDescent } from './sim.js';
import { attachInput, clampHookX, clampHookY } from './input.js';
import { render } from './render.js';
import { startAudio, setTrack, setUnderwaterBoss, restartUnderwater, toggleMute, audioUpdate } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let s = createGame();
let hookX = 0;
let hookY = 0;
let hookTX = 0; // cel (palec) — hak nadąża z LIMITEM prędkości (manewrowanie spowolnione)
let hookTY = 0;
const HOOK_SPEED = 520; // px/s — max prędkość nadążania haka za palcem (3× wolniej niż "skok")

// Dopasuj canvas do okna (portret 3:4) i przelicz layout — niezależnie od rozdzielczości.
let dpr = 1;
function fitCanvas() {
  const aspect = 9 / 16; // szer:wys — proporcje telefonu (węższy, wyższy)
  let h = window.innerHeight;
  let w = Math.round(h * aspect);
  if (w > window.innerWidth) { w = window.innerWidth; h = Math.round(w / aspect); }
  dpr = Math.min(window.devicePixelRatio || 1, 3); // ostrość na hi-DPI (telefon 2-3×); cap 3 dla wydajności
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  layoutWorld(w, h);   // WORLD w CSS px (logika/feel bez zmian); render skalowany transformem dpr
  hookX = clampHookX(hookX || WORLD.W / 2);
  hookY = clampHookY(hookY || WORLD.hookStartY);
  hookTX = hookX; hookTY = hookY;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function hit(r, x, y) {
  return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// indeks pola plecaka pod (x,y) lub -1 (wymiary z bieżącego gridu — rosną z tackleboxem)
function cellAt(gi, x, y) {
  if (!gi) return -1;
  const cols = s.grid.cols, rows = s.grid.rows;
  const c = Math.floor((x - gi.ox) / gi.cell), r = Math.floor((y - gi.oy) / gi.cell);
  if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
  return r * cols + c;
}

attachInput(canvas, {
  onPointerDown(x, y) {
    if (s.splash) { if (hit(s._splashBtn, x, y)) { loginGuest(s); startAudio('home'); } return; } // Guest + odblokuj muzykę (gest)
    if (s.mode === 'HOME') {
      if (s.chestReveal) { dismissChest(s); return; }  // tap zamyka reveal skrzynki
      const h = s._home;
      if (!h) return;
      if (h.reset && hit(h.reset, x, y)) {                 // reset postępu: 1. tap uzbraja, 2. tap czyści
        if (s.resetArm) { clearProgress(); s = createGame(); s.splash = false; }
        else s.resetArm = true;
        return;
      }
      s.resetArm = false;                                  // tap gdziekolwiek indziej rozbraja
      if (h.mute && hit(h.mute, x, y)) { toggleMute(); return; } // przełącz muzykę
      if (h.chest && hit(h.chest, x, y)) { openChest(s); return; }
      if (hit(h.left, x, y)) { arenaMove(s, -1); return; }   // strzałki = zmiana ARENY
      if (hit(h.right, x, y)) { arenaMove(s, 1); return; }
      if (hit(h.backpack, x, y)) { openBackpack(s); return; }
      if (h.stageNodes) { for (const n of h.stageNodes) if (hit(n.rect, x, y)) { selectStageIndex(s, n.index); return; } }
      if (hit(h.start, x, y) || hit(h.stage, x, y)) {
        if (!s.cast && s.hook && stageUnlocked(s)) s.cast = { t: 0 }; // zarzut -> potem descent
      }
    } else if (s.mode === 'BACKPACK') {
      if (s.bpSelected) {   // popup modal otwarty — ma priorytet, blokuje resztę
        if (s._bpPlaceBtn && hit(s._bpPlaceBtn, x, y)) placeAccessory(s, s.bpSelected.id);
        else if (s._bpUnequipBtn && hit(s._bpUnequipBtn, x, y)) unequipAccessory(s, s.bpSelected.gridIdx);
        else s.bpSelected = null;   // tap obok zamyka popup
        return;
      }
      if (s._backpackBack && hit(s._backpackBack, x, y)) { closeBackpack(s); return; }
      const cell = cellAt(s._grid, x, y);
      if (!s.hook) {
        if (cell >= 0) placeHook(s, cell % s.grid.cols, Math.floor(cell / s.grid.cols));
      } else if (cell >= 0 && s.grid.cells[cell] && ITEMS[s.grid.cells[cell]] && ITEMS[s.grid.cells[cell]].kind !== 'hook') {
        s.bpDrag = { fromIdx: cell, id: s.grid.cells[cell], x, y, ox: x, oy: y, moved: false }; // tap=opis / drag=przenieś (bazowego haka nie ruszamy)
      } else {
        // ekwipunek: down na kafelku -> start drag (tap vs drag rozstrzygane na up); pusta tacka -> scroll
        let onItem = null;
        if (s._bpInv) for (const it of s._bpInv) if (hit(it.rect, x, y)) { onItem = it; break; }
        if (onItem) {
          s.bpInvDrag = { id: onItem.id, x, y, ox: x, oy: y, moved: false };
        } else if (s._bpInvGrid && s._bpInvGrid.scrollMax > 0 &&
                   hit({ x: s._bpInvGrid.ox, y: s._bpInvGrid.oy, w: s._bpInvGrid.trayW, h: s._bpInvGrid.trayH }, x, y)) {
          s.bpInvScrollDrag = { oy: y, start: s.bpInvScroll };
        }
      }
    } else if (s.mode === 'END') {
      if ((s.endElapsed || 0) >= 0.6) returnHome(s); // krótka blokada, by nie przeskoczyć beatu tapem
    } else if (s.mode === 'DESCENT') {
      hookTX = clampHookX(x); hookTY = clampHookY(y); // ustaw cel; hak nadąża z limitem prędkości
    }
  },
  onPointerMove(x, y) {
    if (s.mode === 'DESCENT') { hookTX = clampHookX(x); hookTY = clampHookY(y); }
    else if (s.mode === 'BACKPACK') {
      if (s.bpDrag) {
        s.bpDrag.x = x; s.bpDrag.y = y;
        if (Math.hypot(x - s.bpDrag.ox, y - s.bpDrag.oy) > 10) s.bpDrag.moved = true;
      } else if (s.bpInvDrag) {
        s.bpInvDrag.x = x; s.bpInvDrag.y = y;
        if (Math.hypot(x - s.bpInvDrag.ox, y - s.bpInvDrag.oy) > 10) s.bpInvDrag.moved = true;
      } else if (s.bpInvScrollDrag && s._bpInvGrid) {
        s.bpInvScroll = Math.max(0, Math.min(s._bpInvGrid.scrollMax, s.bpInvScrollDrag.start - (y - s.bpInvScrollDrag.oy)));
      }
    }
  },
  onPointerUp(x, y) {
    if (s.mode === 'BACKPACK') {
      if (s.bpDrag) {
        const to = cellAt(s._grid, x, y);
        if (s.bpDrag.moved && to >= 0 && to !== s.bpDrag.fromIdx) moveItem(s, s.bpDrag.fromIdx, to);
        else selectPlaced(s, s.bpDrag.fromIdx); // tap (bez przesunięcia) = opis
        s.bpDrag = null;
      } else if (s.bpInvDrag) {
        const to = cellAt(s._grid, x, y);
        if (s.bpInvDrag.moved && to >= 0) placeAccessoryAt(s, s.bpInvDrag.id, to); // drop na grid = włóż na wskazany slot
        else if (!s.bpInvDrag.moved) selectAccessory(s, s.bpInvDrag.id);           // tap = opis
        s.bpInvDrag = null;
      }
      s.bpInvScrollDrag = null;
    }
  },
  onWheel(x, y, deltaY) {
    if (s.mode === 'BACKPACK' && s._bpInvGrid && s._bpInvGrid.scrollMax > 0) {
      s.bpInvScroll = Math.max(0, Math.min(s._bpInvGrid.scrollMax, s.bpInvScroll + deltaY * 0.5));
    }
  },
});

let last = 0;
let prevUwBoss = false; // poprzedni stan "boss na descencie" (do wykrycia rising edge dla cue muzyki)
function loop(ts) {
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
  last = ts;
  if (s.cast) {
    s.cast.t += dt;
    if (s.cast.t >= CAST_DUR) { s.cast = null; if (startStage(s)) { hookX = hookTX = WORLD.W / 2; hookY = hookTY = WORLD.hookStartY; s.reveal = { t: 0 }; s.endless = TEST_ENDLESS_DESCENT; } }
  }
  if (s.reveal) { s.reveal.t += dt; if (s.reveal.t >= 0.85) s.reveal = null; } // HOLD+OPEN; potem hak tonie
  // hak nadąża za palcem z LIMITEM prędkości (spowolnione manewrowanie)
  if (s.mode === 'DESCENT' && !s.reveal) {
    const mx = HOOK_SPEED * dt;
    hookX += Math.max(-mx, Math.min(mx, hookTX - hookX));
    hookY += Math.max(-mx, Math.min(mx, hookTY - hookY));
  }
  if (s.mode === 'END') s.endElapsed = (s.endElapsed || 0) + dt; // beat przed pokazaniem podsumowania
  stepDescent(s, hookX, hookY, dt);
  // muzyka; underwater przyspiesza już w ~2s zapowiedzi bossa (lull) i restartuje się od początku (cue)
  const uwBoss = s.mode === 'DESCENT' && s.bossCount > 0 && (s.bossSpawned || s.bossLullT > 0);
  if (uwBoss && !prevUwBoss) restartUnderwater();   // rising edge: zagraj od początku tuż przed bossem
  prevUwBoss = uwBoss;
  setTrack(s.mode === 'DESCENT' ? 'underwater' : 'home');
  setUnderwaterBoss(uwBoss);
  audioUpdate(dt);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // skala hi-DPI: rysujemy w CSS px, backing store w device px
  render(ctx, s, hookX, hookY);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
