// Plaster 1: itemy 1x1, brak adjacency. Plaster 2 rozszerzy o kształty/relacje.
export function createGrid(cols, rows) {
  return { cols, rows, cells: new Array(cols * rows).fill(null) };
}

export function canPlace(grid, col, row) {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return false;
  return grid.cells[row * grid.cols + col] === null;
}

export function placeItem(grid, itemId, col, row) {
  if (!canPlace(grid, col, row)) return false;
  grid.cells[row * grid.cols + col] = itemId;
  return true;
}
