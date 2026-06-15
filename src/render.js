import { WORLD, FISH_TYPES, BACKPACK, STARTER_HOOK } from './config.js';

export function render(ctx, s, hookX) {
  ctx.clearRect(0, 0, WORLD.W, WORLD.H);
  if (s.mode === 'BACKPACK') return renderBackpack(ctx, s);
  renderDescent(ctx, s, hookX);
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

function renderDescent(ctx, s, hookX) {
  // gradient głębi
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.H);
  g.addColorStop(0, '#0e3b5c'); g.addColorStop(1, '#041422');
  ctx.fillStyle = g; ctx.fillRect(0, 0, WORLD.W, WORLD.H);

  const camY = s.depthPx; // świat -> ekran: screenY = worldY - camY
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
  // hak (stały y ekranowy)
  ctx.strokeStyle = '#dfe9f5'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hookX, 0); ctx.lineTo(hookX, WORLD.hookStartY); ctx.stroke();
  ctx.fillStyle = '#dfe9f5'; ctx.beginPath(); ctx.arc(hookX, WORLD.hookStartY, 8, 0, Math.PI * 2); ctx.fill();
  // hook na przyszłe efekty (lasery/aury) — placeholder, nic nie rysuje w p1

  // HUD
  ctx.fillStyle = '#e6f0ff'; ctx.font = '18px sans-serif';
  ctx.fillText('❤'.repeat(s.lives), 12, 26);
  ctx.fillText('Głębia: ' + Math.round(s.depthPx / WORLD.pxPerMeter) + ' m', 12, 50);
  ctx.fillText('Wynik: ' + s.score + '  (' + s.stunned + ' ryb)', 12, 74);
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
