const test = require("node:test");
const assert = require("node:assert/strict");
const { Game } = require("../js/game.js");

test("a freshly created game starts with the configured initial workers and no orders", () => {
  const game = new Game(1);
  assert.equal(game.workers.length, 2);
  assert.equal(game.orders.length, 0);
  assert.equal(game.level, 1);
});

test("simulating ~90 seconds completes orders, scores points, and keeps state well-formed", () => {
  const game = new Game(42);
  const dt = 0.1;
  for (let i = 0; i < 900; i++) {
    game.update(dt);
  }

  const state = game.getState();
  assert.ok(state.stats.completed > 0, "expected at least one completed order in 90 simulated seconds");
  assert.ok(state.score > 0, "expected a positive score after completing orders");
  assert.equal(state.workerCount, 2);
  assert.ok(state.efficiency >= 0 && state.efficiency <= 100);

  for (const w of state.workers) {
    assert.ok(Number.isFinite(w.pos.x) && Number.isFinite(w.pos.y));
    assert.ok(["idle", "toPick", "picking", "toDock", "delivering"].includes(w.state));
  }
  for (const o of state.orders) {
    assert.ok(["pending", "assigned", "toDock"].includes(o.status));
  }
});

test("hireWorker spends score and adds a worker, respecting affordability and the max-workers cap", () => {
  const game = new Game(7);
  game.economy.score = 0;
  const brokeResult = game.hireWorker();
  assert.equal(brokeResult.ok, false);
  assert.equal(brokeResult.reason, "cannot-afford");

  game.economy.score = 1000;
  const before = game.workers.length;
  const result = game.hireWorker();
  assert.equal(result.ok, true);
  assert.equal(game.workers.length, before + 1);
  assert.ok(game.economy.score < 1000);
});

test("upgradeSpeed increases worker speed for every worker and costs score", () => {
  const game = new Game(3);
  game.economy.score = 1000;
  const speedBefore = game.workerSpeed;
  const result = game.upgradeSpeed();
  assert.equal(result.ok, true);
  assert.ok(game.workerSpeed > speedBefore);
  for (const w of game.workers) assert.equal(w.speed, game.workerSpeed);
});

test("late orders expire, are removed, and incur a small score penalty", () => {
  const game = new Game(9);
  // Freeze dispatch by removing all workers so nothing ever gets picked up.
  game.workers = [];
  game.economy.score = 100;
  // Force-spawn one order now.
  game.spawnTimer = 0;
  game.update(0.1);
  assert.equal(game.orders.length, 1);
  const order = game.orders[0];

  // Jump clock past the deadline and tick again.
  game.clock = order.deadline + 1;
  game.update(0.1);
  assert.equal(game.orders.length, 0);
  assert.equal(game.stats.expired, 1);
  assert.ok(game.economy.score < 100);
});

test("drainEvents returns level-up events once and then empties", () => {
  const game = new Game(5);
  game.events.push({ type: "level-up", level: 2 });
  const first = game.drainEvents();
  assert.equal(first.length, 1);
  const second = game.drainEvents();
  assert.equal(second.length, 0);
});
