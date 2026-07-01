# Przebudowa plecaka (tacka inventory + drag + tło Tofu) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ekran plecaka: przewijalna tacka inventory z siatką slotów (footprint odwzorowany), drag akcesoriów z tacki do tackleboxa, tło z Tofu trzymającym tacklebox.

**Architecture:** Logika kładzenia na wskazanym slocie jako czysta funkcja w `state.js` (testowalna). Render tacki jako helper `drawInventoryTray` w `render.js` (canvas, weryfikacja wizualna). Input: rozszerzenie handlerów BACKPACK w `main.js` + kółko myszy w `input.js`. Grafika: prompt do ChatGPT (asset generuje użytkownik), render z fallbackiem.

**Tech Stack:** Vanilla JS (ES modules), `node:test` + `node:assert/strict`, canvas 2D, brak build-stepu.

## Global Constraints

- Bez nowych zależności (vanilla JS, ES modules).
- Wszystkie liczby tuningowe w `src/config.js`.
- Testy: `npm test` (Node 18+); styl `import { test } from 'node:test'` + `assert from 'node:assert/strict'`.
- Nie commituj bez zgody użytkownika — kroki „Commit" wykonuje operator po akceptacji.
- Grid tackleboxa 3×3 (tier 0): idx wiersz0 `0,1,2`, wiersz1 `3,4,5`, wiersz2 `6,7,8`.
- `img(src)` w render.js zwraca cache'owany `HTMLImageElement` (ma `.complete`/`.naturalWidth`).

---

## Task 1: `placeAccessoryAt` + pola stanu (logika, testowalna)

**Files:**
- Modify: `src/state.js` (nowa funkcja `placeAccessoryAt`, pola w `createGame`)
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: `ITEMS`, `computeHookStats`, `persist` (istniejące w state.js).
- Produces: `placeAccessoryAt(s, itemId, idx): boolean` — kładzie akcesorium na ciągu `slots`
  kratek od `idx`; false gdy brak w inventory / poza gridem / poza wierszem / zajęte.
  Pola stanu: `s.bpInvDrag`, `s.bpInvScroll`, `s.bpInvScrollDrag`.

- [ ] **Step 1: Napisz testy `placeAccessoryAt` w `tests/state.test.js`**

Rozszerz import z state.js o `placeAccessoryAt`:
```js
  openChest, placeAccessory, placeAccessoryAt, moveItem, computeHookStats, loginGuest, returnHome,
```
Dodaj testy (np. po teście `multi-slot item does not double-count stats`):
```js
test('placeAccessoryAt kładzie 1-slotowy item na wskazanej wolnej kratce', () => {
  const s = createGame(); placeHook(s, 0, 0);            // rusty w idx 0
  s.progress.inventory.weight = 1;
  assert.equal(placeAccessoryAt(s, 'weight', 4), true);  // środek gridu 3x3
  assert.equal(s.grid.cells[4], 'weight');
  assert.equal(s.progress.inventory.weight, undefined);  // zdjęte z inventory
});

test('placeAccessoryAt kładzie 2-slotowy (rocket) na dwóch kolejnych wolnych', () => {
  const s = createGame(); placeHook(s, 0, 0);
  s.progress.inventory.rocket = 1;
  assert.equal(placeAccessoryAt(s, 'rocket', 3), true);  // wiersz 1: idx 3,4
  assert.equal(s.grid.cells[3], 'rocket');
  assert.equal(s.grid.cells[4], 'rocket');
  assert.equal(s.hook.hasRocket, true);                  // przeliczony hook
});

test('placeAccessoryAt odrzuca gdy ciąg wychodzi poza wiersz', () => {
  const s = createGame(); placeHook(s, 0, 0);
  s.progress.inventory.rocket = 1;
  assert.equal(placeAccessoryAt(s, 'rocket', 2), false); // idx2 = ostatnia kolumna, w=2
  assert.equal(s.progress.inventory.rocket, 1);          // nie zużyte
});

test('placeAccessoryAt odrzuca gdy kratka zajęta', () => {
  const s = createGame(); placeHook(s, 0, 0);            // rusty w idx 0
  s.progress.inventory.weight = 1;
  assert.equal(placeAccessoryAt(s, 'weight', 0), false);
});

test('placeAccessoryAt odrzuca gdy brak itemu w inventory', () => {
  const s = createGame(); placeHook(s, 0, 0);
  assert.equal(placeAccessoryAt(s, 'weight', 4), false);
});
```

- [ ] **Step 2: Uruchom — testy mają NIE przejść**

Run: `npm test`
Expected: FAIL — `placeAccessoryAt is not a function` / import error.

- [ ] **Step 3: Dodaj `placeAccessoryAt` i pola stanu w `src/state.js`**

3a. W `createGame()` przy `bpDrag`/`bpSelected` (linia ~63) dodaj pola:
```js
    bpDrag: null,         // przeciągany item w plecaku { fromIdx, id, x, y }
    bpSelected: null,     // akcesorium wybrane do podglądu opisu (id)
    bpInvDrag: null,      // przeciągany item Z tacki inventory { id, x, y, ox, oy, moved }
    bpInvScroll: 0,       // offset przewinięcia tacki inventory (px)
    bpInvScrollDrag: null,// aktywne przewijanie tacki { oy, start }
```

3b. Po funkcji `placeAccessory` (linia ~143) dodaj:
```js
// Kładzie akcesorium na KONKRETNYM ciągu `slots` kratek zaczynającym się w idx (drag-drop z tacki).
// Zwraca false gdy: brak w inventory / idx poza gridem / ciąg wychodzi poza wiersz / kratka zajęta.
export function placeAccessoryAt(s, itemId, idx) {
  if (!s.progress.inventory[itemId]) return false;
  const w = (ITEMS[itemId] && ITEMS[itemId].slots) || 1;
  const cols = s.grid.cols;
  if (idx < 0 || idx >= s.grid.cells.length) return false;
  if ((idx % cols) + w > cols) return false;                        // nie mieści się w wierszu
  for (let k = 0; k < w; k++) if (s.grid.cells[idx + k] !== null) return false; // zajęte
  for (let k = 0; k < w; k++) s.grid.cells[idx + k] = itemId;
  s.progress.inventory[itemId] -= 1;
  if (s.progress.inventory[itemId] <= 0) delete s.progress.inventory[itemId];
  s.hook = computeHookStats(s.grid);
  s.bpSelected = null;
  persist(s);
  return true;
}
```

- [ ] **Step 4: Uruchom — testy mają przejść**

Run: `npm test`
Expected: PASS (wszystkie, w tym 5 nowych `placeAccessoryAt`).

- [ ] **Step 5: Commit (po akceptacji operatora)**

```bash
git add src/state.js tests/state.test.js
git commit -m "feat: placeAccessoryAt - kladzenie akcesorium na wskazanym slocie (drag) + pola stanu tacki"
```

---

## Task 2: Tacka inventory — render (footprint + scroll + sloty)

**Files:**
- Modify: `src/config.js` (`INV_COLS`, `INV_VISIBLE_ROWS`)
- Modify: `src/render.js` (helper `drawInventoryTray`, użycie w `renderBackpack`, import stałych)

**Interfaces:**
- Consumes: `ITEMS`, `drawItemSpan`, `fillRR`, `rrPath` (istniejące w render.js), `WORLD`.
- Produces: `s._bpInvGrid = { ox, oy, cell, cols, trayH, trayW, scrollMax }`,
  `s._bpInv = [{ rect:{x,y,w,h}, id, w }]` (rect w EKRANOWYCH współrzędnych z offsetem scrolla).

- [ ] **Step 1: Dodaj stałe tacki w `src/config.js`**

Po `BACKPACK`/`TACKLEBOX_TIERS` (koniec pliku) dodaj:
```js
// Tacka ekwipunku w plecaku: siatka slotów, footprint itemów, scroll gdy nie mieści.
export const INV_COLS = 6;            // liczba kolumn siatki inventory
export const INV_VISIBLE_ROWS = 2.5;  // ile rzędów widać (0.5 = peek -> sygnał scrolla)
```

- [ ] **Step 2: Import stałych w `src/render.js`**

Dopisz do importu z config (linia 1) `INV_COLS, INV_VISIBLE_ROWS`.

- [ ] **Step 3: Dodaj helper `drawInventoryTray` w `src/render.js`**

Wstaw przed `function renderBackpack`:
```js
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
```

- [ ] **Step 4: Podłącz `drawInventoryTray` w `renderBackpack`**

W `renderBackpack` zastąp blok ekwipunku (dziś: `} else { const inv = ...; ... y += cell + H * 0.03; }`,
linie ~927-943) na:
```js
  } else {
    y = drawInventoryTray(ctx, s, y);
  }
```
(Pozostaw `if (!s.hook) { ...tekst Tap pole... }` powyżej bez zmian. Linie `s._bpInv = [];`
`s._bpPlaceBtn = null;` `s._bpUnequipBtn = null;` przed `if (!s.hook)` zostają — `_bpInv`
zostanie nadpisany przez helper.)

- [ ] **Step 5: Weryfikacja składni + testy (render nietestowany jednostkowo)**

Run: `node --check src/render.js && npm test`
Expected: `render.js` bez błędu; testy PASS (bez regresji).

- [ ] **Step 6: Weryfikacja wizualna**

Run: `python __serve.py` → `http://127.0.0.1:8123/` → wejdź w Plecak. Zdobądź akcesoria
(lub w konsoli: `localStorage` — łatwiej po prostu zaliczyć stage'e). Oczekiwane: itemy w tacce
z ramkami slotów (nie wiszą), rakietnica zajmuje 2 kratki, `xN` w rogu.

- [ ] **Step 7: Commit (po akceptacji operatora)**

```bash
git add src/config.js src/render.js
git commit -m "feat: tacka inventory z siatka slotow + footprint itemow + scroll (render)"
```

---

## Task 3: Drag inventory→tacklebox + scroll (input)

**Files:**
- Modify: `src/input.js` (obsługa kółka myszy)
- Modify: `src/main.js` (drag z tacki, scroll, `onWheel`, import `placeAccessoryAt`)
- Modify: `src/render.js` (ghost `bpInvDrag`)

**Interfaces:**
- Consumes: `placeAccessoryAt`, `selectAccessory` (state.js), `cellAt`, `hit` (main.js),
  `s._bpInv`, `s._bpInvGrid` (Task 2), `drawItemSpan` (render.js).

- [ ] **Step 1: Dodaj obsługę kółka myszy w `src/input.js`**

W `attachInput`, po listenerach touch, dodaj:
```js
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); const { x, y } = toCanvas(e);
    if (handlers.onWheel) handlers.onWheel(x, y, e.deltaY);
  }, { passive: false });
```

- [ ] **Step 2: Import `placeAccessoryAt` w `src/main.js`**

Dopisz do importu z state.js (linia 2) `placeAccessoryAt` (obok `placeAccessory`).

- [ ] **Step 3: Drag z tacki + scroll-down w `onPointerDown` (BACKPACK)**

W `main.js`, w gałęzi `else if (s.mode === 'BACKPACK')`, zastąp końcowy fragment
`} else if (s._bpInv) { for (const it of s._bpInv) if (hit(it.rect, x, y)) { selectAccessory(s, it.id); break; } }`
na:
```js
      } else {
        // ekwipunek: down na kafelku -> start drag (tap vs drag na up); down na pustej tacce -> scroll
        let onItem = null;
        if (s._bpInv) for (const it of s._bpInv) if (hit(it.rect, x, y)) { onItem = it; break; }
        if (onItem) {
          s.bpInvDrag = { id: onItem.id, x, y, ox: x, oy: y, moved: false };
        } else if (s._bpInvGrid && s._bpInvGrid.scrollMax > 0 &&
                   hit({ x: s._bpInvGrid.ox, y: s._bpInvGrid.oy, w: s._bpInvGrid.trayW, h: s._bpInvGrid.trayH }, x, y)) {
          s.bpInvScrollDrag = { oy: y, start: s.bpInvScroll };
        }
      }
```

- [ ] **Step 4: Ruch drag/scroll w `onPointerMove` (BACKPACK)**

Zastąp gałąź `else if (s.mode === 'BACKPACK' && s.bpDrag) { ... }` na:
```js
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
```

- [ ] **Step 5: Upuszczenie w `onPointerUp` (BACKPACK)**

Zastąp cały blok `onPointerUp` na:
```js
  onPointerUp(x, y) {
    if (s.mode === 'BACKPACK') {
      if (s.bpDrag) {
        const to = cellAt(s._grid, x, y);
        if (s.bpDrag.moved && to >= 0 && to !== s.bpDrag.fromIdx) moveItem(s, s.bpDrag.fromIdx, to);
        else selectPlaced(s, s.bpDrag.fromIdx);
        s.bpDrag = null;
      } else if (s.bpInvDrag) {
        const to = cellAt(s._grid, x, y);
        if (s.bpInvDrag.moved && to >= 0) placeAccessoryAt(s, s.bpInvDrag.id, to);
        else if (!s.bpInvDrag.moved) selectAccessory(s, s.bpInvDrag.id);
        s.bpInvDrag = null;
      }
      s.bpInvScrollDrag = null;
    }
  },
```

- [ ] **Step 6: `onWheel` w `attachInput` (main.js)**

Dodaj do obiektu handlerów (po `onPointerUp`):
```js
  onWheel(x, y, deltaY) {
    if (s.mode === 'BACKPACK' && s._bpInvGrid && s._bpInvGrid.scrollMax > 0) {
      s.bpInvScroll = Math.max(0, Math.min(s._bpInvGrid.scrollMax, s.bpInvScroll + deltaY * 0.5));
    }
  },
```

- [ ] **Step 7: Ghost `bpInvDrag` w `renderBackpack` (`src/render.js`)**

Po istniejącym ghost `bpDrag` (linie ~981-986) dodaj:
```js
  if (s.bpInvDrag && s.bpInvDrag.moved && ITEMS[s.bpInvDrag.id]) {
    const cs = (s._bpInvGrid && s._bpInvGrid.cell) || s._grid.cell;
    const w = ((ITEMS[s.bpInvDrag.id].slots) || 1) * cs;
    ctx.globalAlpha = 0.8;
    drawItemSpan(ctx, ITEMS[s.bpInvDrag.id], s.bpInvDrag.x - cs / 2, s.bpInvDrag.y - cs / 2, w, cs, true);
    ctx.globalAlpha = 1;
  }
```

- [ ] **Step 8: Weryfikacja składni + testy**

Run: `node --check src/main.js && node --check src/input.js && node --check src/render.js && npm test`
Expected: brak błędów; testy PASS.

- [ ] **Step 9: Weryfikacja wizualna**

Run: `python __serve.py` → Plecak. Oczekiwane: przeciągnięcie kafelka z tacki na kratkę gridu
kładzie item (znika z tacki, pojawia w tackleboxie); drop poza gridem = wraca; tap = opis + WŁÓŻ;
przeciąganie w gridzie działa dalej; przy nadmiarze itemów scroll (drag po pustym polu / kółko).
Aby przetestować scroll: w konsoli `for (const k of ['anchor','rocket','weight']) {}` — prościej
tymczasowo w `defaultProgress` dać `inventory: { bronze: 9, anchor: 9, rocket: 9, weight: 9 }`,
sprawdzić scroll, cofnąć.

- [ ] **Step 10: Commit (po akceptacji operatora)**

```bash
git add src/input.js src/main.js src/render.js
git commit -m "feat: drag akcesoriow z tacki do tackleboxa + scroll tacki (kolko/drag)"
```

---

## Task 4: Tło Tofu z tackleboxem + prompt do ChatGPT

**Files:**
- Modify: `src/render.js` (tło `backpack-tofu.png` z fallbackiem)
- Asset (użytkownik): `assets/ui/backpack-tofu.png` (z promptu poniżej)

**Interfaces:**
- Consumes: `img(src)` (render.js), `WORLD`.

- [ ] **Step 1: Tło z fallbackiem w `renderBackpack` (`src/render.js`)**

Zastąp początek `renderBackpack` (dziś: `ctx.fillStyle = '#0a2236'; ctx.fillRect(0, 0, W, H);`) na:
```js
  const bg = img('assets/ui/backpack-tofu.png');
  if (bg && bg.complete && bg.naturalWidth) {
    const iw = bg.naturalWidth, ih = bg.naturalHeight;
    const scale = Math.max(W / iw, H / ih), dw = iw * scale, dh = ih * scale;
    ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);          // cover
  } else {
    ctx.fillStyle = '#0a2236'; ctx.fillRect(0, 0, W, H);           // fallback: brak pliku
  }
```
(Rysowana obudowa `drawTacklebox` i grid zostają jako warstwa UI NAD tłem — czytelność slotów
niezależna od grafiki.)

- [ ] **Step 2: Weryfikacja składni + testy + fallback wizualny**

Run: `node --check src/render.js && npm test`
Expected: brak błędu; testy PASS. W przeglądarce (bez pliku PNG) plecak renderuje się jak dotąd
(fallback — ciemne tło), bez błędów w konsoli.

- [ ] **Step 3: Wygeneruj grafikę w ChatGPT (użytkownik) i zapisz jako `assets/ui/backpack-tofu.png`**

Prompt (z briefu `docs/art/gpt-asset-brief.md` — STYLE + CHARACTER + scena):
```
STYLE (LOCKED): cute kawaii 2D mobile game art, cozy and warm, premium polish.
Thick consistent dark-teal outlines (not pure black), soft cel-shading with subtle
gradients, single top-left warm light, gentle cool shadows. Rounded chunky shapes,
MEDIUM detail (clean, readable, a few cute accents - not busy), warm cozy mood, high
readability. No photoreal textures, no harsh contrast, no thin scratchy lines.
Palette: amber #FFB627->#FF8A00, gold #FFCB45, water #0E3B5C->#041422, UI #0E2233,
gem #52D0FF, green #7CFF8A, warm sky #BFE0FF.

CHARACTER: "Tofu", an ADORABLE KAWAII chibi cat angler. Big round head, huge sparkly eyes,
tiny rosy cheek blush, small triangular ears, stubby little paws. Soft cream-orange fur with
white muzzle and belly, pink nose. Cozy mustard knitted beanie, teal fishing vest with tiny
colourful lures. Keep identical colours, outfit and proportions.

SCENE: Full-bleed vertical 1080x1920 backpack/inventory screen background. Tofu FACING THE
VIEWER (front view), centered-lower, holding open with both paws a big chunky WOODEN TACKLE BOX
whose OPEN INTERIOR (empty compartment tray) faces the camera and sits in the UPPER-CENTER of
the frame - keep that interior clean and EMPTY (game UI grid is drawn on top of it). Cozy warm
ambient background (soft bokeh, warm wood/teal tones). No text, no UI, no grid lines, no items
inside the box. Keep top ~8% and bottom ~15% calm for UI. 1080x1920.
```
Po zapisaniu pliku odśwież grę — tło Tofu pojawia się automatycznie (render już to obsługuje).

- [ ] **Step 4: Commit (po akceptacji operatora)**

```bash
git add src/render.js assets/ui/backpack-tofu.png
git commit -m "feat: tlo Tofu z tackleboxem w plecaku (z fallbackiem)"
```
(Jeśli PNG jeszcze nie wygenerowany — commituj sam `src/render.js`; asset dojdzie osobno.)

---

## Self-Review

**Spec coverage:**
- A (tacka: siatka ~6 kol, 2.5 rzędu, footprint, xN, scroll, clip) → Task 2. ✓
- B (drag inv→tacklebox `placeAccessoryAt`, WŁÓŻ zostaje, scroll drag/wheel, tap=opis) → Task 1 (logika) + Task 3 (input). ✓
- C (tło Tofu, fallback, prompt) → Task 4. ✓

**Placeholder scan:** brak TBD/TODO; każdy krok ma realny kod/komendy. ✓

**Type consistency:** `placeAccessoryAt(s, itemId, idx)` spójny state↔main. `s._bpInvGrid`
(`ox,oy,cell,cols,trayH,trayW,scrollMax`) i `s._bpInv` (`rect,id,w`) spójne render(Task2)↔input(Task3)↔ghost.
`bpInvDrag`/`bpInvScroll`/`bpInvScrollDrag` spójne createGame(Task1)↔input(Task3)↔render(Task2/3). ✓

**Ryzyko:** `drawItemSpan`/`fillRR`/`rrPath`/`img` istnieją w render.js (zweryfikowane w eksploracji).
Scroll rzadko aktywny w prototypie (mało itemów) — testowany tymczasowym napełnieniem inventory (Task 3 Step 9).
