import { WORLD, BACKPACK, layoutWorld } from './config.js';
import { createGame, placeHook, placeAccessory, selectAccessory, moveItem, startStage, carouselMove, openBackpack, closeBackpack, returnHome, openChest, dismissChest } from './state.js';
import { stepDescent } from './sim.js';
import { attachInput, clampHookX, clampHookY } from './input.js';
import { render } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let s = createGame();
let hookX = 0;
let hookY = 0;

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
      if (h.chest && hit(h.chest, x, y)) openChest(s);
      else if (hit(h.left, x, y)) carouselMove(s, -1);
      else if (hit(h.right, x, y)) carouselMove(s, 1);
      else if (hit(h.backpack, x, y)) openBackpack(s);
      else if (hit(h.start, x, y) || hit(h.stage, x, y)) {
        if (startStage(s)) { hookX = WORLD.W / 2; hookY = WORLD.hookStartY; } // startStage sam sprawdza hak/odblokowanie
      }
    } else if (s.mode === 'BACKPACK') {
      if (s._backpackBack && hit(s._backpackBack, x, y)) { closeBackpack(s); return; }
      if (s._bpPlaceBtn && hit(s._bpPlaceBtn, x, y)) { placeAccessory(s, s.bpSelected); return; }
      const cell = cellAt(s._grid, x, y);
      if (!s.hook) {
        if (cell >= 0) placeHook(s, cell % BACKPACK.cols, Math.floor(cell / BACKPACK.cols));
      } else if (cell >= 0 && s.grid.cells[cell]) {
        s.bpDrag = { fromIdx: cell, id: s.grid.cells[cell], x, y }; // podnieś do przeciągania
      } else if (s._bpInv) {
        for (const it of s._bpInv) if (hit(it.rect, x, y)) { selectAccessory(s, it.id); break; } // klik = opis
      }
    } else if (s.mode === 'END') {
      returnHome(s);
    } else if (s.mode === 'DESCENT') {
      hookX = clampHookX(x); hookY = clampHookY(y);
    }
  },
  onPointerMove(x, y) {
    if (s.mode === 'DESCENT') { hookX = clampHookX(x); hookY = clampHookY(y); }
    else if (s.mode === 'BACKPACK' && s.bpDrag) { s.bpDrag.x = x; s.bpDrag.y = y; }
  },
  onPointerUp(x, y) {
    if (s.mode === 'BACKPACK' && s.bpDrag) {
      const to = cellAt(s._grid, x, y);
      if (to >= 0) moveItem(s, s.bpDrag.fromIdx, to);
      s.bpDrag = null;
    }
  },
});

let last = 0;
function loop(ts) {
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
  last = ts;
  stepDescent(s, hookX, hookY, dt);
  render(ctx, s, hookX, hookY);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
