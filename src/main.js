import { WORLD, BACKPACK, layoutWorld } from './config.js';
import { createGame, placeHook, startStage, carouselMove, openBackpack, closeBackpack, returnHome } from './state.js';
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
  const aspect = 3 / 4; // szer:wys
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

attachInput(canvas, {
  onPointerDown(x, y) {
    if (s.mode === 'HOME') {
      const h = s._home;
      if (!h) return;
      if (hit(h.left, x, y)) carouselMove(s, -1);
      else if (hit(h.right, x, y)) carouselMove(s, 1);
      else if (hit(h.backpack, x, y)) openBackpack(s);
      else if (hit(h.start, x, y) || hit(h.stage, x, y)) {
        if (startStage(s)) { hookX = WORLD.W / 2; hookY = WORLD.hookStartY; } // startStage sam sprawdza hak/odblokowanie
      }
    } else if (s.mode === 'BACKPACK') {
      if (s._backpackBack && hit(s._backpackBack, x, y)) { closeBackpack(s); return; }
      const gi = s._grid;
      if (!s.hook && gi) {
        const c = Math.floor((x - gi.ox) / gi.cell);
        const r = Math.floor((y - gi.oy) / gi.cell);
        if (c >= 0 && r >= 0 && c < BACKPACK.cols && r < BACKPACK.rows) placeHook(s, c, r);
      }
    } else if (s.mode === 'END') {
      returnHome(s);
    } else if (s.mode === 'DESCENT') {
      hookX = clampHookX(x); hookY = clampHookY(y);
    }
  },
  onPointerMove(x, y) { if (s.mode === 'DESCENT') { hookX = clampHookX(x); hookY = clampHookY(y); } },
  onPointerUp() {},
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
