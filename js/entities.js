// entities.js - Worker and Order simulation entities (no DOM/canvas
// dependencies, so these are fully unit-testable in Node).

const PICK_DWELL = 0.8; // seconds spent "picking" an item at a shelf
const DELIVER_DWELL = 0.5; // seconds spent "delivering" at the dock

class Order {
  constructor(id, shelf, dockOut, createdAt, timeLimit, reward) {
    this.id = id;
    this.shelfId = shelf.id;
    this.pick = shelf.pick;
    this.dock = dockOut;
    this.createdAt = createdAt;
    this.deadline = createdAt + timeLimit;
    this.reward = reward;
    this.status = "pending"; // pending -> assigned -> picking -> toDock -> delivering -> done/expired
    this.assignedWorkerId = null;
  }

  isLate(now) {
    return now > this.deadline;
  }
}

class Worker {
  constructor(id, startCell, speed) {
    this.id = id;
    this.cell = { x: startCell.x, y: startCell.y }; // last confirmed grid cell
    this.pos = { x: startCell.x, y: startCell.y }; // interpolated render position
    this.speed = speed; // cells per second
    this.state = "idle"; // idle | toPick | picking | toDock | delivering
    this.path = null;
    this.pathIndex = 0;
    this.dwellTimer = 0;
    this.orderId = null;
    this.carrying = false;
  }

  assign(order, path) {
    this.orderId = order.id;
    this.path = path;
    this.pathIndex = 0;
    this.state = "toPick";
    this.carrying = false;
  }

  /** Advance movement/dwell timers by dt seconds. Returns an event string or null. */
  update(dt) {
    if (this.state === "toPick" || this.state === "toDock") {
      return this._advancePath(dt);
    }
    if (this.state === "picking" || this.state === "delivering") {
      this.dwellTimer -= dt;
      if (this.dwellTimer <= 0) {
        if (this.state === "picking") {
          this.carrying = true;
          return "picked";
        }
        this.carrying = false;
        return "delivered";
      }
    }
    return null;
  }

  _advancePath(dt) {
    if (!this.path || this.pathIndex >= this.path.length - 1) {
      // Already at destination (e.g. zero-length path): trigger dwell.
      return this._arrive();
    }
    let remaining = this.speed * dt;
    while (remaining > 0 && this.pathIndex < this.path.length - 1) {
      const from = this.path[this.pathIndex];
      const to = this.path[this.pathIndex + 1];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const segLen = Math.hypot(dx, dy) || 1;
      const curProgress = Math.hypot(this.pos.x - from.x, this.pos.y - from.y);
      const left = segLen - curProgress;
      if (remaining >= left) {
        remaining -= left;
        this.pathIndex += 1;
        this.pos = { x: to.x, y: to.y };
        this.cell = { x: to.x, y: to.y };
        if (this.pathIndex >= this.path.length - 1) {
          return this._arrive();
        }
      } else {
        const t = (curProgress + remaining) / segLen;
        this.pos = { x: from.x + dx * t, y: from.y + dy * t };
        remaining = 0;
      }
    }
    return null;
  }

  _arrive() {
    if (this.state === "toPick") {
      this.state = "picking";
      this.dwellTimer = PICK_DWELL;
    } else if (this.state === "toDock") {
      this.state = "delivering";
      this.dwellTimer = DELIVER_DWELL;
    }
    return null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Order, Worker, PICK_DWELL, DELIVER_DWELL };
}
