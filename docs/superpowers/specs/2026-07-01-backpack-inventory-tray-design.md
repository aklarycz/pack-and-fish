# Spec: Przebudowa ekranu plecaka — tacka inventory + drag + tło Tofu

Data: 2026-07-01
Branch: pack-and-fish-slice1

Ekran BACKPACK: dziś akcesoria w ekwipunku to pozioma linijka kwadratów 1×1 bez ramek
("wiszą w powietrzu"), rakietnica (2 sloty) pokazana jako 1×1, a wkładanie tylko tap→WŁÓŻ.
Cel: tacka z siatką slotów (footprint odwzorowany), drag z tacki do tackleboxa, tło z Tofu.

---

## A. Tacka inventory (przewijalna siatka slotów)

### Docelowe zachowanie
- Pod obudową tackleboxa: prostokątna tacka (bordered) z siatką **unit-kratek**: ~6 kolumn,
  widoczne ~2,5 rzędu (peek na kolejny rząd = sygnał, że można przewinąć).
- Akcesoria układane flow (lewo→prawo, potem następny rząd). Każdy item zajmuje **footprint**
  = `ITEMS[id].slots` kratek w poziomie (rakietnica = 2). Jeśli nie mieści się w pozostałej
  szerokości rzędu — przechodzi do następnego rzędu (bez dzielenia itemu).
- Duplikaty **stackowane**: jeden kafelek na typ, licznik `xN` w rogu.
- **Scroll pionowy** gdy suma rzędów przekracza widoczne: przeciąganie po pustym polu tacki
  (touch/mysz) + kółko myszy (desktop). Zawartość **clipowana** do prostokąta tacki.

### Zmiany w kodzie

**`config.js`** — stałe tacki:
```js
export const INV_COLS = 6;            // docelowa liczba kolumn siatki inventory
export const INV_VISIBLE_ROWS = 2.5;  // ile rzędów widać (0.5 = peek -> sygnał scrolla)
```

**`render.js`** — nowy helper `drawInventoryTray(ctx, s, top)`:
- Liczy: `cell = floor(trayW / INV_COLS)`, `trayW ≈ W*0.9`, `trayH = INV_VISIBLE_ROWS * cell`,
  `ox/oy` (wyśrodkowana pozioma, `oy = top`).
- Layout: iteruje `Object.entries(inventory)` (n>0); dla każdego liczy pozycję (row,col)
  uwzględniając footprint `w` i zawijanie; `contentRows` = łączna liczba zajętych rzędów.
- `scrollMax = max(0, contentRows*cell - trayH)`; `s.bpInvScroll` clampowane do `[0, scrollMax]`.
- Rysuje: ramkę tacki, potem `ctx.save()` + clip do prostokąta tacki; ramki kratek (widoczne)
  i itemy przesunięte o `-s.bpInvScroll` (footprint przez `drawItemSpan`), `xN`, ramka zaznaczenia
  jeśli `bpSelected`; pomija aktualnie przeciągany (`bpInvDrag`). `ctx.restore()`.
- Zapamiętuje `s._bpInvGrid = { ox, oy, cell, cols, trayH, scrollMax }` oraz
  `s._bpInv = [{ rect, id, w }]` (rect w EKRANOWYCH współrzędnych, już z offsetem scrolla —
  do trafień; itemy poza widocznym obszarem pomijane w trafieniach).
- Wywoływana z `renderBackpack` w miejscu obecnej linijki ekwipunku (zastępuje `inv.forEach`).

**Uwaga:** `s._bpInv` zachowuje kształt `{rect, id}` (dodane `w`) — istniejący tutorial
(`invRect('anchor')`, `invRect('bronze')` w `drawTutorial`) działa dalej bez zmian.

---

## B. Drag inventory→tacklebox (+ WŁÓŻ zostaje)

### Docelowe zachowanie
- Pointer-down na kafelku w tacce → start `s.bpInvDrag = { id, x, y, ox, oy, moved:false }`.
- Ghost itemu (footprint) podąża za palcem (rysowany w `renderBackpack`, jak istniejący ghost `bpDrag`).
- Pointer-up:
  - jeśli `moved` i kursor nad kratką gridu → **`placeAccessoryAt(s, id, cell)`** (kładzie na
    wskazanym ciągu, jeśli wolny i mieści się w wierszu); sukces zdejmuje z inventory.
  - jeśli **nie** `moved` (tap) → `selectAccessory(s, id)` (opis + przycisk WŁÓŻ, jak dziś).
- **WŁÓŻ** (`_bpPlaceBtn`) zostaje: auto pierwsza wolna przez `placeAccessory` (z fixem tutoriala
  kotwicy — `findFreeRunAvoiding` dla `anchor` gdy `!tutAnchorDone`).
- Drag **w obrębie gridu** (`bpDrag`) — bez zmian.
- Scroll: pointer-down na PUSTYM polu tacki (nie na kafelku) gdy `scrollMax>0` →
  `s.bpInvScrollDrag = { oy:y, start:s.bpInvScroll }`; move aktualizuje `s.bpInvScroll`.

### Zmiany w kodzie

**`state.js`** — nowa funkcja (mirror `placeAccessory`, ale na wskazany idx):
```js
// Kładzie akcesorium na KONKRETNYM ciągu `slots` kratek zaczynającym się w idx (drag-drop).
// Zwraca false gdy: brak w inventory / idx poza gridem / ciąg wychodzi poza wiersz / kratka zajęta.
export function placeAccessoryAt(s, itemId, idx) {
  if (!s.progress.inventory[itemId]) return false;
  const w = (ITEMS[itemId] && ITEMS[itemId].slots) || 1;
  const cols = s.grid.cols;
  if (idx < 0 || idx >= s.grid.cells.length) return false;
  if ((idx % cols) + w > cols) return false;                       // nie mieści się w wierszu
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
Pola stanu w `createGame()`: dodać `bpInvDrag: null, bpInvScroll: 0, bpInvScrollDrag: null`.

**`input.js`** — dodać obsługę kółka myszy do `attachInput`:
```js
canvas.addEventListener('wheel', (e) => { e.preventDefault(); const { x, y } = toCanvas(e);
  if (handlers.onWheel) handlers.onWheel(x, y, e.deltaY); }, { passive: false });
```

**`main.js`** — w `onPointerDown` (BACKPACK), PO obsłudze gridu/bpDrag, PRZED `_bpInv` tap:
- jeśli `hitInvItem(x,y)` → `s.bpInvDrag = { id, x, y, ox:x, oy:y, moved:false }`.
- else jeśli w prostokącie tacki i `s._bpInvGrid.scrollMax > 0` → `s.bpInvScrollDrag = { oy:y, start:s.bpInvScroll }`.
- `onPointerMove`: jeśli `bpInvDrag` → aktualizuj x,y + `moved` (próg 10px). jeśli `bpInvScrollDrag`
  → `s.bpInvScroll = clamp(start - (y-oy), 0, scrollMax)`.
- `onPointerUp`: jeśli `bpInvDrag`: `to = cellAt(s._grid, x, y)`; gdy `moved && to>=0` →
  `placeAccessoryAt(s, bpInvDrag.id, to)`; gdy `!moved` → `selectAccessory(s, bpInvDrag.id)`; wyczyść.
- `onWheel`: w BACKPACK gdy kursor nad tacką → `s.bpInvScroll = clamp(s.bpInvScroll + deltaY*0.5, 0, scrollMax)`.

**`render.js`** — ghost `bpInvDrag` (analogicznie do `bpDrag`, ale footprint `w*cell`).

---

## C. Tło Tofu z tackleboxem

### Docelowe zachowanie
- Pełnoekranowe tło ekranu BACKPACK: Tofu (kot) przodem do gracza, trzyma **otwarty** drewniany
  tacklebox; wnętrze skrzynki w górno-centralnej strefie (tam gdzie rysowany jest grid).
- Render: `img('assets/ui/backpack-tofu.png')` rozciągnięte na cały ekran (cover). **Fallback**:
  gdy plik nie załadowany → obecne `fillStyle #0a2236 + fillRect` (nic się nie psuje przed
  wygenerowaniem grafiki). Rysowana obudowa `drawTacklebox` zostaje jako warstwa pod gridem
  (nad tłem) — czytelność slotów niezależna od grafiki.
- Grid + tacka rysowane NA WIERZCHU jako warstwa UI (bez pixel-perfect wpasowania w grafikę).

### Zmiany w kodzie
**`render.js`** — na początku `renderBackpack`:
```js
const bg = img('assets/ui/backpack-tofu.png');
if (bg && bg.complete && bg.naturalWidth) drawCover(ctx, bg, 0, 0, W, H);
else { ctx.fillStyle = '#0a2236'; ctx.fillRect(0, 0, W, H); }
```
(`drawCover` — jeśli brak helpera „cover", użyć istniejącego wzorca skalowania jak dla innych
pełnoekranowych teł; inaczej dodać krótki helper.)

### Deliverable: prompt do ChatGPT (asset generuje użytkownik → `assets/ui/backpack-tofu.png`)
```
[STYLE BLOCK]
STYLE (LOCKED): cute kawaii 2D mobile game art, cozy and warm, premium polish.
Thick consistent dark-teal outlines (not pure black), soft cel-shading with subtle
gradients, single top-left warm light, gentle cool shadows. Rounded chunky shapes,
MEDIUM detail (clean, readable, a few cute accents - not busy), warm cozy mood, high
readability at small sizes. No photoreal textures, no harsh contrast, no thin scratchy lines.
Palette: amber CTA #FFB627->#FF8A00, gold #FFCB45, water #0E3B5C->#041422, UI #0E2233,
gem #52D0FF, green #7CFF8A, warm sky #BFE0FF.

CHARACTER: "Tofu", an ADORABLE KAWAII chibi cat angler. Big round head (~1:1.6 head:body),
huge sparkly eyes, tiny rosy cheek blush, small triangular ears, stubby little paws. Soft
cream-orange fur with white muzzle and belly, pink nose. Outfit: cozy mustard knitted beanie,
teal fishing vest with tiny colourful lures. Super sweet, cute, slightly goofy. Keep identical
colours, outfit and proportions.

SCENE: Full-bleed vertical 1080x1920 backpack/inventory screen background. Tofu FACING THE
VIEWER (front view), centered-lower, holding open with both paws a big chunky WOODEN TACKLE BOX
whose OPEN INTERIOR (empty compartment tray) faces the camera and sits in the UPPER-CENTER of
the frame (leave the interior clean and empty - game UI grid slots are drawn on top of it).
Cozy warm ambient background (soft bokeh, warm wood/teal tones), no text, no UI, no grid lines,
no items inside the box. Keep top ~8% and bottom ~15% calm for UI. 1080x1920.
```

---

## Testy (node --test)

**`tests/state.test.js`** — `placeAccessoryAt`:
- kładzie 1-slotowy item na wskazanej wolnej kratce; zdejmuje 1 z inventory
- kładzie 2-slotowy (rocket) na idx gdy dwie kolejne wolne i mieszczą się w wierszu
- odrzuca gdy ciąg wychodzi poza wiersz (idx = ostatnia kolumna, w=2)
- odrzuca gdy któraś kratka zajęta
- odrzuca gdy brak itemu w inventory
- po położeniu przelicza `s.hook` (np. rocket → hasRocket true)

Tacka/scroll/drag/tło — weryfikacja w przeglądarce (canvas, nietestowalne jednostkowo):
- itemy w slotach z ramkami (nie wiszą), rakietnica 2 kratki
- drag kafelka z tacki na grid kładzie item; drop poza gridem = wraca
- scroll gdy dużo itemów (dołożyć testowo do inventory)
- WŁÓŻ i drag w gridzie dalej działają
- tło: fallback (brak pliku) rysuje się bez błędu; po wgraniu PNG widać Tofu

---

## Poza zakresem (YAGNI)
- Pixel-perfect wpasowanie gridu w namalowaną skrzynkę (grid = warstwa UI nad tłem).
- Zmiana rozmiaru tła per tier tackleboxa (tło stałe; tylko tier 0 w prototypie).
- Reorganizacja/sortowanie inventory, przeciąganie itemu Z gridu DO tacki (wypinanie zostaje przyciskiem WYPNIJ).
