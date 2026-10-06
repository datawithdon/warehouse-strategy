const test = require("node:test");
const assert = require("node:assert/strict");
const { Order, Worker, PICK_DWELL, DELIVER_DWELL } = require("../js/entities.js");

function makeShelf() {
  return { id: 3, x: 1, y: 1, w: 2, h: 4, pick: { x: 3, y: 2 } };
}

test("Order.isLate reflects the deadline", () => {
  const order = new Order(1, makeShelf(), { x: 18, y: 10 }, 0, 10, 12);
  assert.equal(order.isLate(5), false);
  assert.equal(order.isLate(10.1), true);
});

test("Worker walks a path, then dwells through picking and reports 'picked'", () => {
  const w = new Worker(1, { x: 0, y: 0 }, 2); // speed 2 cells/sec
  const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  w.assign({ id: 1 }, path);
  assert.equal(w.state, "toPick");

  // 1 second at speed 2 covers both 1-cell segments -> arrives and starts dwelling.
  let event = w.update(1.0);
  assert.equal(event, null);
  assert.equal(w.state, "picking");
  assert.deepEqual(w.cell, { x: 2, y: 0 });

  // Advance through the pick dwell time.
  event = w.update(PICK_DWELL);
  assert.equal(event, "picked");
  assert.equal(w.carrying, true);
});

test("Worker reports 'delivered' after the deliver dwell completes", () => {
  const w = new Worker(1, { x: 5, y: 5 }, 5);
  w.state = "toDock";
  w.path = [{ x: 5, y: 5 }]; // already standing on the dock cell (single-node path)
  w.pathIndex = 0;
  const arriveEvent = w.update(0.01); // pathIndex >= path.length-1 -> immediate arrival
  assert.equal(arriveEvent, null);
  assert.equal(w.state, "delivering");
  const event = w.update(DELIVER_DWELL);
  assert.equal(event, "delivered");
  assert.equal(w.carrying, false);
});
