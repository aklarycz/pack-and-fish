import { WORLD, FISH_TYPES, BACKPACK, STARTER_HOOK, STAGES, ITEMS } from './config.js';
import { computeStars } from './logic/scoring.js';

// --- proste ładowanie sprite'ów (Image tworzony leniwie, tylko w przeglądarce) ---
const _imgCache = {};
function img(src) {
  let im = _imgCache[src];
  if (!im) { im = new Image(); im.src = src; _imgCache[src] = im; }
  return im;
}
function ready(im) { return im && im.complete && im.naturalWidth > 0; }
const FISH_SPRITE = {
  plotka: 'assets/fish/plotka.png',
  sredniak: 'assets/fish/sredniak.png',
  twardziel: 'assets/fish/twardziel.png',
};
const BUBBLE_SRC = 'assets/bubble.png';
const BG_SURFACE = 'assets/bg-surface.png';
const STAGE_SPRITE = ['assets/stages/stage1.png', 'assets/stages/stage2.png', 'assets/stages/stage3.png'];
const STAGE_LOCKED = [null, 'assets/stages/stage2_locked.png', 'assets/stages/stage3_locked.png'];
const SPRITE_SCALE = 2.8; // szerokość sprite ≈ radius * scale

function drawFishSprite(ctx, im, cx, cy, radius, dir, alpha) {
  const w = radius * SPRITE_SCALE;
  const h = w * (im.naturalHeight / im.naturalWidth);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  if (dir < 0) ctx.scale(-1, 1); // sprite'y patrzą w prawo; ruch w lewo = odbicie
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function render(ctx, s, hookX, hookY) {
  ctx.clearRect(0, 0, WORLD.W, WORLD.H);
  if (s.mode === 'HOME') return renderHome(ctx, s);
  if (s.mode === 'BACKPACK') return renderBackpack(ctx, s);
  renderDescent(ctx, s, hookX, hookY);
  if (s.mode === 'END') renderEnd(ctx, s);
}

// --- HOME: layout wg specu UI (strefy A–F, scrimy, glass, START dominuje) ---
function renderHome(ctx, s) {
  const W = WORLD.W, H = WORLD.H;
  const i = s.stageIndex, prog = s.progress.stages[i], unlocked = prog.unlocked;
  const cx = W / 2;

  // 1. tło (pełnoekranowy PNG) 2. vignette 3/4. scrimy
  ctx.fillStyle = '#0b1f33'; ctx.fillRect(0, 0, W, H);
  const bg = img(BG_SURFACE);
  if (ready(bg)) drawCover(ctx, bg, 0, 0, W, H);
  const vg = ctx.createRadialGradient(cx, H * 0.45, H * 0.2, cx, H * 0.45, H * 0.72);
  vg.addColorStop(0, 'rgba(6,18,28,0)'); vg.addColorStop(1, 'rgba(6,18,28,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  let g = ctx.createLinearGradient(0, 0, 0, H * 0.12);
  g.addColorStop(0, 'rgba(6,18,28,0.55)'); g.addColorStop(1, 'rgba(6,18,28,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.12);
  g = ctx.createLinearGradient(0, H * 0.80, 0, H);
  g.addColorStop(0, 'rgba(6,18,28,0)'); g.addColorStop(1, 'rgba(6,18,28,0.85)');
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.80, W, H * 0.2);

  // === C: scena / karuzela ===
  const cyArt = H * 0.43, S = W * 0.62, ax = cx - S / 2, ay = cyArt - S / 2;
  for (let e = 0; e < 3; e++) {
    ctx.fillStyle = `rgba(0,0,0,${0.12 - e * 0.035})`;
    ctx.beginPath(); ctx.ellipse(cx, cyArt + S * 0.46, W * 0.25 - e * 6, H * 0.025 - e * 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  const src = unlocked ? STAGE_SPRITE[i] : (STAGE_LOCKED[i] || STAGE_SPRITE[i]);
  const im = img(src);
  if (ready(im)) ctx.drawImage(im, ax, ay, S, S);
  else { ctx.fillStyle = unlocked ? '#2e6f9e' : '#3a3f46'; ctx.fillRect(ax, ay, S, S); }
  if (!unlocked) {
    ctx.fillStyle = 'rgba(10,22,32,0.62)'; ctx.fillRect(ax, ay, S, S);
    ctx.beginPath(); ctx.arc(cx, H * 0.40, W * 0.06, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10,22,32,0.7)'; ctx.fill();
    drawLock(ctx, cx, H * 0.40, W * 0.045);
    fillRR(ctx, cx - W * 0.21, H * 0.50 - H * 0.025, W * 0.42, H * 0.05, H * 0.025, 'rgba(10,22,32,0.6)');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(H * 0.026)}px sans-serif`;
    ctx.fillText('ZABLOKOWANE', cx, H * 0.50 + H * 0.009);
  }
  navArrow(ctx, W * 0.085, cyArt, W * 0.055, -1, i > 0);
  navArrow(ctx, W * 0.915, cyArt, W * 0.055, 1, i < STAGES.length - 1);
  // kropki paginacji
  const dotY = H * 0.61, gap = W * 0.022, totalW = (STAGES.length - 1) * gap;
  for (let k = 0; k < STAGES.length; k++) {
    const dx = cx - totalW / 2 + k * gap;
    if (k === i) fillRR(ctx, dx - H * 0.012, dotY - H * 0.006, H * 0.024, H * 0.012, H * 0.006, '#ffcb45');
    else { ctx.beginPath(); ctx.arc(dx, dotY, H * 0.008, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill(); }
  }

  // === B: nagłówek stage (shelf + teksty + gwiazdki) ===
  g = ctx.createLinearGradient(0, H * 0.10, 0, H * 0.20);
  g.addColorStop(0, 'rgba(10,22,32,0)'); g.addColorStop(1, 'rgba(10,22,32,0.35)');
  ctx.fillStyle = g; ctx.fillRect(W * 0.05, H * 0.10, W * 0.9, H * 0.10);
  ctx.textAlign = 'center';
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = H * 0.0025;
  ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(H * 0.040)}px sans-serif`;
  ctx.fillText(`${STAGES[i].id}. ${STAGES[i].name}`, cx, H * 0.13);
  ctx.restore();
  ctx.fillStyle = '#c8d4de'; ctx.font = `${Math.round(H * 0.022)}px sans-serif`;
  ctx.fillText('Best: ' + prog.bestScore + ' pkt', cx, H * 0.158);
  const starR = W * 0.025, sgap = W * 0.012, sw = starR * 2, starsW = 3 * sw + 2 * sgap;
  for (let k = 0; k < 3; k++) {
    const sx = cx - starsW / 2 + sw / 2 + k * (sw + sgap);
    star(ctx, sx, H * 0.182, starR * (k === 1 ? 1.1 : 1), k < prog.stars);
  }

  // === A: top HUD (poziom + XP + chipy zasobów) ===
  ctx.beginPath(); ctx.arc(W * 0.10, H * 0.045, W * 0.035, 0, Math.PI * 2);
  const lg = ctx.createLinearGradient(0, H * 0.01, 0, H * 0.08); lg.addColorStop(0, '#2e6bb0'); lg.addColorStop(1, '#16406e');
  ctx.fillStyle = lg; ctx.fill(); ctx.strokeStyle = '#ffcb45'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(H * 0.030)}px sans-serif`;
  ctx.fillText('1', W * 0.10, H * 0.045 + H * 0.011);
  const totalStars = s.progress.stages.reduce((a, st) => a + st.stars, 0);
  const xpFrac = Math.max(0.12, totalStars / (STAGES.length * 3));
  const xpX = W * 0.155, xpY = H * 0.046, xpW = W * 0.20, xpH = H * 0.013;
  fillRR(ctx, xpX, xpY, xpW, xpH, xpH / 2, 'rgba(14,34,51,0.6)');
  if (xpFrac > 0) fillRR(ctx, xpX, xpY, xpW * xpFrac, xpH, xpH / 2, '#52d0ff');
  // chipy (energia / gemy / złoto) — prawy align do 0.95W
  const chW = W * 0.165, chH = H * 0.046, chU = H * 0.012, chY = H * 0.046;
  chip(ctx, W * 0.95, chY, chW, chH, '#ffcb45', String(s.progress.coins)); // złoto = realne monety
  chip(ctx, W * 0.95 - chW - chU, chY, chW, chH, '#52d0ff', '0');          // gemy (placeholder)
  chip(ctx, W * 0.95 - 2 * (chW + chU), chY, chW, chH, '#7cff8a', '∞');    // energia (brak gate'u)

  // === D: START ===
  const btnW = W * 0.66, btnH = H * 0.092, bx = cx - btnW / 2, byy = H * 0.715 - btnH / 2;
  const canStart = unlocked && s.hook;
  fillRR(ctx, bx, byy + H * 0.006, btnW, btnH, btnH / 2, 'rgba(0,0,0,0.28)');
  rrPath(ctx, bx, byy, btnW, btnH, btnH / 2);
  if (canStart) { const sg = ctx.createLinearGradient(0, byy, 0, byy + btnH); sg.addColorStop(0, '#ffb627'); sg.addColorStop(1, '#ff8a00'); ctx.fillStyle = sg; }
  else ctx.fillStyle = '#5b6670';
  ctx.fill();
  fillRR(ctx, bx + btnH * 0.3, byy + btnH * 0.12, btnW - btnH * 0.6, btnH * 0.26, btnH * 0.13, 'rgba(255,255,255,0.22)');
  ctx.textAlign = 'center'; ctx.fillStyle = canStart ? '#3a1e00' : 'rgba(200,212,222,0.7)';
  ctx.font = `900 ${Math.round(H * 0.044)}px sans-serif`;
  ctx.fillText('START', cx, byy + btnH * 0.66);
  const start = { x: bx, y: byy, w: btnW, h: btnH };
  if (!s.hook) {
    ctx.fillStyle = '#ffcb45'; ctx.font = `${Math.round(H * 0.020)}px sans-serif`;
    ctx.fillText('Zdobądź hak w plecaku, by zacząć', cx, H * 0.788);
  }

  // === F: tab bar ===
  const tabH = H * 0.12, tabY = H - tabH;
  ctx.fillStyle = 'rgba(10,22,32,0.92)'; ctx.fillRect(0, tabY, W, tabH);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, tabY + 0.5); ctx.lineTo(W, tabY + 0.5); ctx.stroke();
  const tabs = [['Sklep', false], ['Plecak', true], ['Battle', true], ['Łowy', false], ['Kasa', false]];
  let backpack = null;
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

  // skrzynka do odebrania (jeśli jest oczekująca)
  let chest = null;
  if (s.progress.pendingChests > 0) {
    chest = { x: W * 0.05, y: H * 0.47, w: W * 0.17, h: W * 0.17 };
    fillRR(ctx, chest.x, chest.y, chest.w, chest.h, 8, '#3a2f12');
    rrPath(ctx, chest.x, chest.y, chest.w, chest.h, 8); ctx.strokeStyle = '#ffcb45'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffcb45'; ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(chest.w * 0.2)}px sans-serif`;
    ctx.fillText('SKRZYNIA', chest.x + chest.w / 2, chest.y + chest.h * 0.58);
    ctx.beginPath(); ctx.arc(chest.x + chest.w, chest.y, 12, 0, Math.PI * 2); ctx.fillStyle = '#ff4d4d'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(String(s.progress.pendingChests), chest.x + chest.w, chest.y + 5);
  }

  ctx.textAlign = 'left';
  const ar = W * 0.055;
  s._home = {
    stage: { x: ax, y: ay, w: S, h: S },
    left: { x: W * 0.085 - ar, y: cyArt - ar, w: ar * 2, h: ar * 2 },
    right: { x: W * 0.915 - ar, y: cyArt - ar, w: ar * 2, h: ar * 2 },
    start, backpack, chest,
  };

  // overlay otwarcia skrzynki
  if (s.chestReveal) {
    ctx.fillStyle = 'rgba(3,12,20,0.9)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffd166'; ctx.font = `bold ${Math.round(H * 0.045)}px sans-serif`;
    ctx.fillText('SKRZYNIA!', cx, H * 0.36);
    ctx.fillStyle = '#7fe0a0'; ctx.font = `${Math.round(H * 0.032)}px sans-serif`;
    ctx.fillText('+' + s.chestReveal.sc + ' monet', cx, H * 0.45);
    if (s.chestReveal.anchor) {
      ctx.fillStyle = '#9fd0ff';
      ctx.fillText('Nowe akcesorium: Kotwica', cx, H * 0.52);
      ctx.fillStyle = '#cfe2f5'; ctx.font = `${Math.round(H * 0.022)}px sans-serif`;
      ctx.fillText('Włóż ją w plecaku: +1 ryba naraz', cx, H * 0.56);
    }
    ctx.fillStyle = '#9fd0ff'; ctx.font = `${Math.round(H * 0.024)}px sans-serif`;
    ctx.fillText('Tap, by zamknąć', cx, H * 0.64);
    ctx.textAlign = 'left';
  }
}

function drawCover(ctx, im, x, y, w, h) {
  const iw = im.naturalWidth, ih = im.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
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

function chip(ctx, rightX, cy, w, h, color, value) {
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

function roundedBtn(ctx, r, color, label) {
  ctx.fillStyle = color; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#eaf4ff'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(r.h * 0.42)}px sans-serif`;
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + r.h * 0.15);
  ctx.textAlign = 'left';
}

function drawItemCell(ctx, it, x, y, cell) {
  const pad = cell * 0.12;
  fillRR(ctx, x + pad, y + pad, cell - 2 * pad, cell - 2 * pad, 6, it.kind === 'hook' ? '#cdbb6a' : '#5aa9e0');
  ctx.fillStyle = '#06121f'; ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(cell * 0.16)}px sans-serif`;
  ctx.fillText(it.kind === 'hook' ? 'HAK' : 'KOTW', x + cell / 2, y + cell / 2 + cell * 0.06);
}

function renderBackpack(ctx, s) {
  const W = WORLD.W, H = WORLD.H;
  ctx.fillStyle = '#0a2236'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e6f0ff'; ctx.font = `bold ${Math.round(H * 0.03)}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(s.hook ? 'Plecak' : 'Włóż hak do plecaka', W / 2, H * 0.08);

  const gw = BACKPACK.cols * BACKPACK.cell, gh = BACKPACK.rows * BACKPACK.cell;
  const ox = (W - gw) / 2, oy = H * 0.13;
  for (let r = 0; r < BACKPACK.rows; r++) for (let c = 0; c < BACKPACK.cols; c++) {
    const cellX = ox + c * BACKPACK.cell, cellY = oy + r * BACKPACK.cell;
    ctx.strokeStyle = '#2c5a82'; ctx.lineWidth = 2; ctx.strokeRect(cellX, cellY, BACKPACK.cell, BACKPACK.cell);
    const idx = r * BACKPACK.cols + c;
    const id = s.grid.cells[idx];
    if (id && ITEMS[id] && !(s.bpDrag && s.bpDrag.fromIdx === idx)) drawItemCell(ctx, ITEMS[id], cellX, cellY, BACKPACK.cell);
  }
  s._grid = { ox, oy, cell: BACKPACK.cell };

  // staty haka (efekt ułożenia/adjacency) + hint przeciągania
  if (s.hook) {
    ctx.fillStyle = '#9fd0ff'; ctx.font = `${Math.round(H * 0.024)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(`Hak: ${s.hook.atk} atk · łapie ${s.hook.maxLatch} naraz`, W / 2, oy + gh + H * 0.04);
    ctx.fillStyle = 'rgba(207,226,245,0.6)'; ctx.font = `${Math.round(H * 0.017)}px sans-serif`;
    ctx.fillText('Przeciągnij itemy — połącz Kotwicę z hakiem', W / 2, oy + gh + H * 0.065);
  }

  let y = oy + gh + H * 0.10;
  s._bpInv = [];
  if (!s.hook) {
    ctx.fillStyle = '#ffd166'; ctx.font = `${Math.round(H * 0.024)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('Tap pole, by włożyć: ' + STARTER_HOOK.name, W / 2, y);
  } else {
    const inv = Object.entries(s.progress.inventory).filter(([, n]) => n > 0);
    ctx.fillStyle = '#cfe2f5'; ctx.font = `${Math.round(H * 0.022)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(inv.length ? 'Ekwipunek — tap, by włożyć:' : 'Brak akcesoriów — zdobądź skrzynię na Home', W / 2, y);
    y += H * 0.02;
    const cell = BACKPACK.cell * 0.9;
    const rowW = inv.length * cell + (inv.length - 1) * 10;
    inv.forEach(([id, n], k) => {
      const r = { x: W / 2 - rowW / 2 + k * (cell + 10), y, w: cell, h: cell };
      drawItemCell(ctx, ITEMS[id], r.x, r.y, cell);
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(cell * 0.2)}px sans-serif`; ctx.textAlign = 'right';
      ctx.fillText('x' + n, r.x + r.w - 4, r.y + r.h - 6);
      s._bpInv.push({ rect: r, id });
    });
    y += cell + H * 0.03;
  }

  const bw = Math.round(W * 0.4), bh = Math.round(H * 0.07);
  const back = { x: W / 2 - bw / 2, y: Math.min(y, H - bh - H * 0.04), w: bw, h: bh };
  roundedBtn(ctx, back, '#2e7d4f', s.hook ? 'WRÓĆ NA HOME' : 'WRÓĆ');
  s._backpackBack = back;

  // ghost przeciąganego itemu (podąża za palcem)
  if (s.bpDrag && ITEMS[s.bpDrag.id]) {
    const cs = BACKPACK.cell;
    ctx.globalAlpha = 0.8;
    drawItemCell(ctx, ITEMS[s.bpDrag.id], s.bpDrag.x - cs / 2, s.bpDrag.y - cs / 2, cs);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
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

  // scena powierzchni (pierwsze łowisko) — widoczna u góry na starcie, receduje
  // z parallaxem i zanika z głębokością (otoczenie ciemnieje gdy schodzimy niżej)
  const bg = img(BG_SURFACE);
  if (ready(bg)) {
    const bw = WORLD.W;
    const bh = bw * (bg.naturalHeight / bg.naturalWidth);
    const bottomY = WORLD.H * 0.42 - camY * 0.5; // linia wody @ depth0 ~0.42H, parallax 0.5
    const fade = Math.max(0, 1 - df * 1.3);       // znika w miarę schodzenia
    if (fade > 0.01 && bottomY > -bh) {
      ctx.globalAlpha = fade;
      ctx.drawImage(bg, 0, bottomY - bh, bw, bh);
      ctx.globalAlpha = 1;
    }
  }
  // dodatkowe ściemnienie otoczenia z głębokością (atmosfera głębin)
  if (df > 0) { ctx.fillStyle = `rgba(2,9,16,${(df * 0.55).toFixed(3)})`; ctx.fillRect(0, 0, WORLD.W, WORLD.H); }

  // "słup wody" — drobinki na stałych pozycjach świata, parallax. Przewijają się
  // w górę razem z kamerą, dając stały układ odniesienia: to MY opadamy.
  drawParticles(ctx, camY, 0.55, 96, 1.4, 0.10); // warstwa daleka: wolniejsza, drobna
  drawParticles(ctx, camY, 1.0, 70, 2.0, 0.16);  // warstwa bliska: szybsza, większa
  // ryby — sprite'y (fallback na kółko, gdy obraz jeszcze się ładuje)
  for (const f of s.fish) {
    const sy = f.y - camY;
    if (sy < -60 || sy > WORLD.H + 60) continue;
    const t = FISH_TYPES[f.type];
    const im = img(FISH_SPRITE[f.type]);
    if (ready(im)) {
      drawFishSprite(ctx, im, f.x, sy, t.radius, f.dir, 1);
    } else {
      ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(f.x, sy, t.radius, 0, Math.PI * 2); ctx.fill();
    }
    // wskaźnik HP + okno na zaczepionej rybie (KRYTYCZNE do feelu)
    if (f.state === 'latched') {
      const w = t.radius * 2;
      ctx.fillStyle = '#000'; ctx.fillRect(f.x - t.radius, sy - t.radius - 14, w, 5);
      ctx.fillStyle = '#ff5d5d'; ctx.fillRect(f.x - t.radius, sy - t.radius - 14, w * Math.max(0, f.hp / f.hpMax), 5);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(f.x - t.radius, sy - t.radius - 8, w * Math.max(0, f.windowLeft / f.window), 4);
    }
  }
  // bańki z ogłuszonymi (sprite ryby + bańka)
  for (const b of s.bubbles || []) {
    const sy = b.bubbleY - camY;
    if (sy < -60 || sy > WORLD.H + 60) continue;
    const t = FISH_TYPES[b.type];
    const fim = img(FISH_SPRITE[b.type]);
    if (ready(fim)) drawFishSprite(ctx, fim, b.x, sy, t.radius * 0.8, b.dir, 0.9);
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

  // hak — swobodna pozycja (hookX, hookY) w paśmie; żyłka od góry do haka
  ctx.strokeStyle = '#dfe9f5'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hookX, 0); ctx.lineTo(hookX, hookY); ctx.stroke();
  ctx.fillStyle = '#dfe9f5'; ctx.beginPath(); ctx.arc(hookX, hookY, 8, 0, Math.PI * 2); ctx.fill();
  // hook na przyszłe efekty (lasery/aury) — placeholder, nic nie rysuje w p1

  // top bar (HUD) na wierzchu — hak/ryby pod niego nie wchodzą
  ctx.fillStyle = 'rgba(4,18,31,0.9)'; ctx.fillRect(0, 0, WORLD.W, WORLD.topBarH);
  ctx.strokeStyle = 'rgba(127,209,255,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, WORLD.topBarH + 0.5); ctx.lineTo(WORLD.W, WORLD.topBarH + 0.5); ctx.stroke();
  const baseY = Math.round(WORLD.topBarH / 2) + 6;
  // życia (lewo)
  ctx.fillStyle = '#ff6b8a'; ctx.font = '20px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('❤'.repeat(s.lives), 12, baseY);
  // głębia (prawo)
  ctx.fillStyle = '#9fd0ff'; ctx.font = '16px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(Math.round(s.depthPx / WORLD.pxPerMeter) + ' m', WORLD.W - 12, baseY);
  // score + palące się gwiazdki (środek) — na bieżąco wg progów stage'a
  const liveStars = computeStars(s.score, STAGES[s.stageIndex].stars);
  const starR = WORLD.topBarH * 0.16, sgap = starR * 2.5, groupW = 3 * sgap;
  const scoreRight = WORLD.W / 2 - groupW / 2 - 8;
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(s.score + ' pkt', scoreRight, baseY);
  const starsX0 = scoreRight + 12;
  for (let k = 0; k < 3; k++) star(ctx, starsX0 + sgap * (k + 0.5), baseY - 6, starR, k < liveStars);
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
  const cx = WORLD.W / 2, H = WORLD.H;
  ctx.fillStyle = 'rgba(3,12,20,0.86)'; ctx.fillRect(0, 0, WORLD.W, H);
  ctx.textAlign = 'center';
  const st = STAGES[s.stageIndex];
  ctx.fillStyle = '#e6f0ff'; ctx.font = `${Math.round(H * 0.03)}px sans-serif`;
  ctx.fillText(st.id + '. ' + st.name, cx, H * 0.30);
  // status: wyczyszczone vs fail
  const cleared = s.lastResult && s.lastResult.cleared;
  ctx.fillStyle = cleared ? '#7fffa1' : '#ff9a9a'; ctx.font = `bold ${Math.round(H * 0.034)}px sans-serif`;
  ctx.fillText(cleared ? 'Łowisko wyczyszczone!' : 'Ryby uciekły!', cx, H * 0.35);
  // gwiazdki (wektorowe)
  const sr = H * 0.035, sg = sr * 2.6;
  for (let k = 0; k < 3; k++) star(ctx, cx - sg + k * sg, H * 0.43, sr * (k === 1 ? 1.1 : 1), k < s.stars);
  // staty
  ctx.fillStyle = '#cfe2f5'; ctx.font = `${Math.round(H * 0.026)}px sans-serif`;
  ctx.fillText('Głębia ' + Math.round(s.depthPx / WORLD.pxPerMeter) + ' m · ' + s.stunned + ' ryb · ' + s.score + ' pkt', cx, H * 0.50);
  if (s.lastResult && s.lastResult.newUnlock) {
    ctx.fillStyle = '#7fffa1'; ctx.fillText('Odblokowano kolejny stage!', cx, H * 0.55);
  } else if (s.stars === 0) {
    ctx.fillStyle = '#ffd166'; ctx.fillText('Wzmocnij hak w plecaku', cx, H * 0.55);
  }
  ctx.fillStyle = '#9fd0ff'; ctx.fillText('Tap — wróć na Home', cx, H * 0.62);
  ctx.textAlign = 'left';
}
