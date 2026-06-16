import { WORLD, FISH_TYPES, BACKPACK, STARTER_HOOK } from './config.js';

export function render(ctx, s, hookX, hookY) {
  ctx.clearRect(0, 0, WORLD.W, WORLD.H);
  if (s.mode === 'BACKPACK') return renderBackpack(ctx, s);
  renderDescent(ctx, s, hookX, hookY);
  if (s.mode === 'END') renderEnd(ctx, s);
}

function renderBackpack(ctx, s) {
  ctx.fillStyle = '#0a2236'; ctx.fillRect(0, 0, WORLD.W, WORLD.H);
  ctx.fillStyle = '#e6f0ff'; ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Włóż hak do plecaka', WORLD.W / 2, 90);
  const gw = BACKPACK.cols * BACKPACK.cell, gh = BACKPACK.rows * BACKPACK.cell;
  const ox = (WORLD.W - gw) / 2, oy = 150;
  for (let r = 0; r < BACKPACK.rows; r++) for (let c = 0; c < BACKPACK.cols; c++) {
    ctx.strokeStyle = '#2c5a82'; ctx.lineWidth = 2;
    ctx.strokeRect(ox + c * BACKPACK.cell, oy + r * BACKPACK.cell, BACKPACK.cell, BACKPACK.cell);
    if (s.grid.cells[r * BACKPACK.cols + c]) {
      ctx.fillStyle = '#cdbb6a';
      ctx.fillRect(ox + c * BACKPACK.cell + 12, oy + r * BACKPACK.cell + 12, BACKPACK.cell - 24, BACKPACK.cell - 24);
    }
  }
  if (!s.hook) {
    ctx.fillStyle = '#ffd166';
    ctx.fillText('↓ ' + STARTER_HOOK.name + ' ↓', WORLD.W / 2, oy + gh + 50);
  } else {
    ctx.fillStyle = '#7fffa1';
    ctx.fillText('Tap, by zarzucić', WORLD.W / 2, oy + gh + 50);
  }
  ctx.textAlign = 'left';
  // współrzędne gridu udostępnione main.js przez ten sam wzór (ox, oy, cell)
  s._grid = { ox, oy, cell: BACKPACK.cell };
}

function renderDescent(ctx, s, hookX, hookY) {
  const camY = s.depthPx; // świat -> ekran: screenY = worldY - camY

  // gradient głębi — przyciemnia się wraz z głębokością (cue "schodzimy niżej")
  const df = Math.min(1, s.depthPx / (WORLD.pxPerMeter * 120)); // pełne ściemnienie ~120 m
  const top = lerpRgb([14, 59, 92], [3, 16, 28], df);
  const bot = lerpRgb([4, 20, 34], [0, 4, 9], df);
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.H);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, WORLD.W, WORLD.H);

  // "słup wody" — drobinki na stałych pozycjach świata, parallax. Przewijają się
  // w górę razem z kamerą, dając stały układ odniesienia: to MY opadamy.
  drawParticles(ctx, camY, 0.55, 96, 1.4, 0.10); // warstwa daleka: wolniejsza, drobna
  drawParticles(ctx, camY, 1.0, 70, 2.0, 0.16);  // warstwa bliska: szybsza, większa
  // ryby
  for (const f of s.fish) {
    const sy = f.y - camY;
    if (sy < -40 || sy > WORLD.H + 40) continue;
    const t = FISH_TYPES[f.type];
    ctx.fillStyle = f.state === 'stunned' ? '#bfe9ff' : t.color;
    ctx.beginPath(); ctx.arc(f.x, sy, t.radius, 0, Math.PI * 2); ctx.fill();
    // oczy / mina
    ctx.fillStyle = '#06121f'; ctx.font = `${t.radius}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(f.state === 'stunned' ? 'x x' : '• •', f.x, sy + 4);
    ctx.textAlign = 'left';
    // wskaźnik HP + okno na zaczepionej rybie (KRYTYCZNE do feelu)
    if (f.state === 'latched') {
      const w = t.radius * 2;
      ctx.fillStyle = '#000'; ctx.fillRect(f.x - t.radius, sy - t.radius - 12, w, 5);
      ctx.fillStyle = '#ff5d5d'; ctx.fillRect(f.x - t.radius, sy - t.radius - 12, w * Math.max(0, f.hp / f.hpMax), 5);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(f.x - t.radius, sy - t.radius - 6, w * Math.max(0, f.windowLeft / f.window), 4);
    }
  }
  // bańki z ogłuszonymi (przeniesione do s.bubbles przez main.js)
  for (const b of s.bubbles || []) {
    const sy = b.bubbleY - camY;
    const t = FISH_TYPES[b.type];
    ctx.strokeStyle = 'rgba(200,235,255,0.6)'; ctx.beginPath(); ctx.arc(b.x, sy, t.radius + 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#bfe9ff'; ctx.beginPath(); ctx.arc(b.x, sy, t.radius, 0, Math.PI * 2); ctx.fill();
  }
  // dolna granica pasma ruchu haka (subtelna linia orientacyjna)
  ctx.strokeStyle = 'rgba(223,233,245,0.12)'; ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  ctx.beginPath(); ctx.moveTo(0, WORLD.hookMaxY); ctx.lineTo(WORLD.W, WORLD.hookMaxY); ctx.stroke();
  ctx.setLineDash([]);

  // hak — swobodna pozycja (hookX, hookY) w paśmie; żyłka od góry do haka
  ctx.strokeStyle = '#dfe9f5'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hookX, 0); ctx.lineTo(hookX, hookY); ctx.stroke();
  ctx.fillStyle = '#dfe9f5'; ctx.beginPath(); ctx.arc(hookX, hookY, 8, 0, Math.PI * 2); ctx.fill();
  // hook na przyszłe efekty (lasery/aury) — placeholder, nic nie rysuje w p1

  // top bar (HUD) na wierzchu — hak/ryby pod niego nie wchodzą
  ctx.fillStyle = 'rgba(4,18,31,0.9)'; ctx.fillRect(0, 0, WORLD.W, WORLD.topBarH);
  ctx.strokeStyle = 'rgba(127,209,255,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, WORLD.topBarH + 0.5); ctx.lineTo(WORLD.W, WORLD.topBarH + 0.5); ctx.stroke();
  const baseY = Math.round(WORLD.topBarH / 2) + 7;
  ctx.fillStyle = '#ff6b8a'; ctx.font = '20px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('❤'.repeat(s.lives), 14, baseY);
  ctx.fillStyle = '#9fd0ff'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(Math.round(s.depthPx / WORLD.pxPerMeter) + ' m', WORLD.W / 2, baseY);
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(s.score + ' pkt · ' + s.stunned + ' ryb', WORLD.W - 14, baseY);
  ctx.textAlign = 'left';
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

function renderEnd(ctx, s) {
  ctx.fillStyle = 'rgba(3,12,20,0.82)'; ctx.fillRect(0, 0, WORLD.W, WORLD.H);
  ctx.fillStyle = '#e6f0ff'; ctx.textAlign = 'center'; ctx.font = '26px sans-serif';
  ctx.fillText('Hak za słaby — wzmocnij się', WORLD.W / 2, 250);
  ctx.font = '48px sans-serif';
  ctx.fillText('★'.repeat(s.stars) + '☆'.repeat(3 - s.stars), WORLD.W / 2, 330);
  ctx.font = '20px sans-serif';
  ctx.fillText('Głębia ' + Math.round(s.depthPx / WORLD.pxPerMeter) + ' m · ' + s.stunned + ' ryb · ' + s.score + ' pkt', WORLD.W / 2, 380);
  ctx.fillText('Tap, by zagrać ponownie', WORLD.W / 2, 440);
  ctx.textAlign = 'left';
}
