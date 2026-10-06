// grid.js - warehouse floor plan model + BFS pathfinding.
//
// The grid is uniform-cost (every floor step costs the same), so a
// breadth-first search gives an optimal shortest path without needing
// a weighted A* search.

const CellType = {
  FLOOR: "floor",
  SHELF: "shelf",
  DOCK_IN: "dockIn",
  DOCK_OUT: "dockOut",
};

class Grid {
  constructor(width, height, cells) {
    this.width = width;
    this.height = height;
    this.cells = cells; // cells[y][x] = CellType
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  cellAt(x, y) {
    return this.inBounds(x, y) ? this.cells[y][x] : null;
  }

  isWalkable(x, y) {
    return this.inBounds(x, y) && this.cells[y][x] !== CellType.SHELF;
  }

  neighbors(x, y) {
    const candidates = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    return candidates.filter(([nx, ny]) => this.isWalkable(nx, ny));
  }

  /** Shortest 4-directional path from start to goal (inclusive), or null. */
  bfsPath(start, goal) {
    if (!this.isWalkable(start.x, start.y) || !this.isWalkable(goal.x, goal.y)) {
      return null;
    }
    if (start.x === goal.x && start.y === goal.y) {
      return [{ x: start.x, y: start.y }];
    }

    const key = (x, y) => `${x},${y}`;
    const visited = new Set([key(start.x, start.y)]);
    const prev = new Map();
    const queue = [start];
    let qi = 0;

    while (qi < queue.length) {
      const cur = queue[qi++];
      if (cur.x === goal.x && cur.y === goal.y) break;
      for (const [nx, ny] of this.neighbors(cur.x, cur.y)) {
        const k = key(nx, ny);
        if (visited.has(k)) continue;
        visited.add(k);
        prev.set(k, cur);
        queue.push({ x: nx, y: ny });
      }
    }

    if (!visited.has(key(goal.x, goal.y))) return null; // unreachable

    const path = [];
    let node = { x: goal.x, y: goal.y };
    while (!(node.x === start.x && node.y === start.y)) {
      path.push(node);
      node = prev.get(key(node.x, node.y));
    }
    path.push({ x: start.x, y: start.y });
    path.reverse();
    return path;
  }
}

/**
 * Builds the default warehouse layout: an outer aisle ring, two
 * horizontal aisle bands, and 12 shelf blocks (2x6 grid of blocks,
 * each 2 cells wide x 4 cells tall) each with one designated "pick
 * point" on the aisle tile just outside it.
 */
function buildDefaultLayout() {
  const width = 19; // x: 0..18
  const height = 11; // y: 0..10

  const cells = [];
  for (let y = 0; y < height; y++) {
    cells.push(new Array(width).fill(CellType.FLOOR));
  }

  const blockColStarts = [1, 4, 7, 10, 13, 16]; // 6 column-pairs, width 2 each
  const blockRowStarts = [1, 6]; // 2 row-bands, height 4 each
  const shelves = [];
  let shelfId = 0;

  for (const rowStart of blockRowStarts) {
    for (const colStart of blockColStarts) {
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          cells[rowStart + dy][colStart + dx] = CellType.SHELF;
        }
      }
      const pick = { x: colStart + 2, y: rowStart + 2 }; // aisle tile right of block, mid-height
      shelves.push({ id: shelfId++, x: colStart, y: rowStart, w: 2, h: 4, pick });
    }
  }

  const dockIn = { x: 0, y: 0 };
  const dockOut = { x: width - 1, y: height - 1 };
  cells[dockIn.y][dockIn.x] = CellType.DOCK_IN;
  cells[dockOut.y][dockOut.x] = CellType.DOCK_OUT;

  return { width, height, cells, shelves, dockIn, dockOut };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Grid, CellType, buildDefaultLayout };
}
