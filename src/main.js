import { WORLD, BACKPACK, layoutWorld, CAST_DUR } from './config.js';
import { createGame, placeHook, placeAccessory, selectAccessory, selectPlaced, unequipAccessory, moveItem, startStage, stageUnlocked, carouselMove, arenaMove, selectStageIndex, openBackpack, closeBackpack, returnHome, openChest, dismissChest } from './state.js';
import { stepDescent } from './sim.js';
import { attachInput, clampHookX, clampHookY } from './input.js';
import { render } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let s = createGame();
let hookX = 0;
let hookY = 0;
let hookTX = 0; // cel (palec) — hak nadąża z LIMITEM prędkości (manewrowanie spowolnione)
let hookTY = 0;
const HOOK_SPEED = 520; // px/s — max prędkość nadążania haka za palcem (3× wolniej niż "skok")

// Dopasuj canvas do okna (portret 3:4) i przelicz layout — niezależnie od rozdzielczości.
function fitCanvas() {
  const aspect = 9 / 16; // szer:wys — proporcje telefonu (węższy, wyższy)
  let h = window.innerHeight;
  let w = Math.round(h * aspect);
  if (w > window.innerWidth) { w = window.innerWidth; h = Math.round(w / aspect); }
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  layoutWorld(w, h);
  hookX = clampHookX(hookX || WORLD.W / 2);
  hookY = clampHookY(hookY || WORLD.hookStartY);
  hookTX = hookX; hookTY = hookY;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function hit(r, x, y) {
  return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// indeks pola plecaka pod (x,y) lub -1
function cellAt(gi, x, y) {
  if (!gi) return -1;
  const c = Math.floor((x - gi.ox) / gi.cell), r = Math.floor((y - gi.oy) / gi.cell);
  if (c < 0 || r < 0 || c >= BACKPACK.cols || r >= BACKPACK.rows) return -1;
  return r * BACKPACK.cols + c;
}

attachInput(canvas, {
  onPointerDown(x, y) {
    if (s.mode === 'HOME') {
      if (s.chestReveal) { dismissChest(s); return; }  // tap zamyka reveal skrzynki
      const h = s._home;
      if (!h) return;
      if (h.chest && hit(h.chest, x, y)) { openChest(s); return; }
      if (hit(h.left, x, y)) { arenaMove(s, -1); return; }   // strzałki = zmiana ARENY
      if (hit(h.right, x, y)) { arenaMove(s, 1); return; }
      if (hit(h.backpack, x, y)) { openBackpack(s); return; }
      if (h.stageNodes) { for (const n of h.stageNodes) if (hit(n.rect, x, y)) { selectStageIndex(s, n.index); return; } }
      if (hit(h.start, x, y) || hit(h.stage, x, y)) {
        if (!s.cast && s.hook && stageUnlocked(s)) s.cast = { t: 0 }; // zarzut -> potem descent
      }
    } else if (s.mode === 'BACKPACK') {
      if (s._backpackBack && hit(s._backpackBack, x, y)) { closeBackpack(s); return; }
      if (s._bpPlaceBtn && hit(s._bpPlaceBtn, x, y)) { placeAccessory(s, s.bpSelected.id); return; }
      if (s._bpUnequipBtn && hit(s._bpUnequipBtn, x, y)) { unequipAccessory(s, s.bpSelected.gridIdx); return; }
      const cell = cellAt(s._grid, x, y);
      if (!s.hook) {
        if (cell >= 0) placeHook(s, cell % BACKPACK.cols, Math.floor(cell / BACKPACK.cols));
      } else if (cell >= 0 && s.grid.cells[cell]) {
        s.bpDrag = { fromIdx: cell, id: s.grid.cells[cell], x, y, ox: x, oy: y, moved: false }; // tap=opis / drag=przenieś
      } else if (s._bpInv) {
        for (const it of s._bpInv) if (hit(it.rect, x, y)) { selectAccessory(s, it.id); break; } // klik = opis
      }
    } else if (s.mode === 'END') {
      returnHome(s);
    } else if (s.mode === 'DESCENT') {
      hookTX = clampHookX(x); hookTY = clampHookY(y); // ustaw cel; hak nadąża z limitem prędkości
    }
  },
  onPointerMove(x, y) {
    if (s.mode === 'DESCENT') { hookTX = clampHookX(x); hookTY = clampHookY(y); }
    else if (s.mode === 'BACKPACK' && s.bpDrag) {
      s.bpDrag.x = x; s.bpDrag.y = y;
      if (Math.hypot(x - s.bpDrag.ox, y - s.bpDrag.oy) > 10) s.bpDrag.moved = true;
    }
  },
  onPointerUp(x, y) {
    if (s.mode === 'BACKPACK' && s.bpDrag) {
      const to = cellAt(s._grid, x, y);
      if (s.bpDrag.moved && to >= 0 && to !== s.bpDrag.fromIdx) moveItem(s, s.bpDrag.fromIdx, to);
      else selectPlaced(s, s.bpDrag.fromIdx); // tap (bez przesunięcia) = opis
      s.bpDrag = null;
    }
  },
});

let last = 0;
function loop(ts) {
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
  last = ts;
  if (s.cast) {
    s.cast.t += dt;
    if (s.cast.t >= CAST_DUR) { s.cast = null; if (startStage(s)) { hookX = hookTX = WORLD.W / 2; hookY = hookTY = WORLD.hookStartY; s.reveal = { t: 0 }; } }
  }
  if (s.reveal) { s.reveal.t += dt; if (s.reveal.t >= 0.85) s.reveal = null; } // HOLD+OPEN; potem hak tonie
  // hak nadąża za palcem z LIMITEM prędkości (spowolnione manewrowanie)
  if (s.mode === 'DESCENT' && !s.reveal) {
    const mx = HOOK_SPEED * dt;
    hookX += Math.max(-mx, Math.min(mx, hookTX - hookX));
    hookY += Math.max(-mx, Math.min(mx, hookTY - hookY));
  }
  stepDescent(s, hookX, hookY, dt);
  render(ctx, s, hookX, hookY);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
