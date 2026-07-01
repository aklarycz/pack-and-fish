// Tłumaczy pointer events na intencje. Czyste pozycjonowanie; logika w state/main.
import { WORLD, TEST_FREE_HOOK } from './config.js';

export function attachInput(canvas, handlers) {
  // handlers: { onPointerDown(x,y), onPointerMove(x,y), onPointerUp(x,y) }
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) || e;
    const sx = WORLD.W / r.width;   // mapuj na WORLD (CSS px), nie na backing store (device px, dpr)
    const sy = WORLD.H / r.height;
    return { x: (p.clientX - r.left) * sx, y: (p.clientY - r.top) * sy };
  };
  const down = (e) => { e.preventDefault(); const { x, y } = toCanvas(e); handlers.onPointerDown(x, y); };
  const move = (e) => { e.preventDefault(); const { x, y } = toCanvas(e); handlers.onPointerMove(x, y); };
  const up   = (e) => { e.preventDefault(); const { x, y } = toCanvas(e); handlers.onPointerUp(x, y); };
  canvas.addEventListener('mousedown', down);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', up, { passive: false });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); const { x, y } = toCanvas(e);
    if (handlers.onWheel) handlers.onWheel(x, y, e.deltaY);
  }, { passive: false });
}

export function clampHookX(x) {
  if (TEST_FREE_HOOK) return Math.max(0, Math.min(WORLD.W, x));
  return Math.max(WORLD.hookMinX, Math.min(WORLD.hookMaxX, x));
}

export function clampHookY(y) {
  if (TEST_FREE_HOOK) return Math.max(0, Math.min(WORLD.H, y));
  return Math.max(WORLD.hookMinY, Math.min(WORLD.hookMaxY, y));
}
