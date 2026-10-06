const test = require("node:test");
const assert = require("node:assert/strict");
const { Grid, CellType, buildDefaultLayout } = require("../js/grid.js");

test("buildDefaultLayout produces 12 shelf blocks with valid pick points", () => {
  const layout = buildDefaultLayout();
  assert.equal(layout.shelves.length, 12);
  for (const shelf of layout.shelves) {
    assert.equal(layout.cells[shelf.pick.y][shelf.pick.x], CellType.FLOOR);
  }
});

test("dockIn and dockOut are walkable and distinct", () => {
  const layout = buildDefaultLayout();
  const grid = new Grid(layout.width, layout.height, layout.cells);
  assert.ok(grid.isWalkable(layout.dockIn.x, layout.dockIn.y));
  assert.ok(grid.isWalkable(layout.dockOut.x, layout.dockOut.y));
  assert.notDeepEqual(layout.dockIn, layout.dockOut);
});

test("bfsPath finds a route from dockIn to every shelf's pick point and to dockOut", () => {
  const layout = buildDefaultLayout();
  const grid = new Grid(layout.width, layout.height, layout.cells);
  for (const shelf of layout.shelves) {
    const path = grid.bfsPath(layout.dockIn, shelf.pick);
    assert.ok(path, `no path to shelf ${shelf.id} pick point`);
    assert.deepEqual(path[0], layout.dockIn);
    assert.deepEqual(path[path.length - 1], shelf.pick);
  }
  const toDock = grid.bfsPath(layout.dockIn, layout.dockOut);
  assert.ok(toDock);
});

test("bfsPath returns null for an unwalkable goal (inside a shelf)", () => {
  const layout = buildDefaultLayout();
  const grid = new Grid(layout.width, layout.height, layout.cells);
  const shelf = layout.shelves[0];
  const path = grid.bfsPath(layout.dockIn, { x: shelf.x, y: shelf.y });
  assert.equal(path, null);
});

test("bfsPath of a point to itself returns a single-cell path", () => {
  const layout = buildDefaultLayout();
  const grid = new Grid(layout.width, layout.height, layout.cells);
  const path = grid.bfsPath(layout.dockIn, layout.dockIn);
  assert.deepEqual(path, [{ x: layout.dockIn.x, y: layout.dockIn.y }]);
});
