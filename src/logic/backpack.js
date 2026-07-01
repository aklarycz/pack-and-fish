// Grid tackleboxa. Itemy zajmują ITEMS[id].slots kolejnych komórek POZIOMO (1×N).
// cells trzyma id w KAŻDEJ zajętej komórce; szerokość itemu odczytujemy z ITEMS przy enumeracji.
export function createGrid(cols, rows) {
  return { cols, rows, cells: new Array(cols * rows).fill(null) };
}

export function canPlace(grid, col, row) {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return false;
  return grid.cells[row * grid.cols + col] === null;
}

// (zachowane dla haka 1×1) — wkłada item 1-slotowy w konkretną komórkę.
export function placeItem(grid, itemId, col, row) {
  if (!canPlace(grid, col, row)) return false;
  grid.cells[row * grid.cols + col] = itemId;
  return true;
}

// Pierwsza komórka (origin) ciągu `w` wolnych komórek w jednym wierszu, lub -1.
export function findFreeRun(grid, w) {
  const { cells, cols, rows } = grid;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c + w <= cols; c++) {
      let ok = true;
      for (let k = 0; k < w; k++) if (cells[r * cols + c + k] !== null) { ok = false; break; }
      if (ok) return r * cols + c;
    }
  }
  return -1;
}

// Origin (lewa komórka) itemu, do którego należy `idx` — skanuje w lewo w obrębie wiersza.
export function itemOrigin(grid, idx) {
  if (idx < 0 || !grid.cells[idx]) return -1;
  const cols = grid.cols, id = grid.cells[idx], row = Math.floor(idx / cols);
  let o = idx;
  while (o - 1 >= row * cols && grid.cells[o - 1] === id) o--;
  return o;
}

// Origin pierwszego wolnego ciągu `w` komórek, którego ŻADNA komórka nie sąsiaduje (4-kier.)
// z komórką zawierającą `avoidId`. Fallback do findFreeRun, gdy taki ciąg nie istnieje.
export function findFreeRunAvoiding(grid, w, avoidId) {
  const { cells, cols, rows } = grid;
  const adjToAvoid = (idx) => {
    const r = Math.floor(idx / cols), c = idx % cols, nb = [];
    if (r > 0) nb.push(idx - cols); if (r < rows - 1) nb.push(idx + cols);
    if (c > 0) nb.push(idx - 1); if (c < cols - 1) nb.push(idx + 1);
    return nb.some(n => cells[n] === avoidId);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c + w <= cols; c++) {
      let ok = true;
      for (let k = 0; k < w; k++) {
        const idx = r * cols + c + k;
        if (cells[idx] !== null || adjToAvoid(idx)) { ok = false; break; }
      }
      if (ok) return r * cols + c;
    }
  }
  return findFreeRun(grid, w);
}

// Lista itemów w gridzie: {id, idx (origin), w}. Każdy item raz (nie per-komórka).
export function gridItems(grid, ITEMS) {
  const out = [], { cells, cols, rows } = grid;
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const idx = r * cols + c, id = cells[idx];
      if (!id) { c++; continue; }
      const w = (ITEMS[id] && ITEMS[id].slots) || 1;
      out.push({ id, idx, w });
      c += w;
    }
  }
  return out;
}
