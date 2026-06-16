import { WORLD, BACKPACK } from './config.js';
import { createGame, placeHook, startDescent } from './state.js';
import { stepDescent } from './sim.js';
import { attachInput, clampHookX, clampHookY } from './input.js';
import { render } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let s = createGame();
let hookX = WORLD.W / 2;
let hookY = WORLD.hookStartY;

function reset() {
  s = createGame();
  hookX = WORLD.W / 2;
  hookY = WORLD.hookStartY;
}

attachInput(canvas, {
  onPointerDown(x, y) {
    if (s.mode === 'BACKPACK') {
      const gi = s._grid;
      if (!s.hook && gi) {
        const c = Math.floor((x - gi.ox) / gi.cell);
        const r = Math.floor((y - gi.oy) / gi.cell);
        if (c >= 0 && r >= 0 && c < BACKPACK.cols && r < BACKPACK.rows) placeHook(s, c, r);
      } else if (s.hook) {
        startDescent(s);
      }
    } else if (s.mode === 'END') {
      reset();
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
