// game.js - the core simulation (no canvas/DOM dependencies), so it is
// fully unit-testable in Node and reusable as-is in the browser.

(function () {
  var GridClass, CellTypeObj, buildDefaultLayoutFn, WorkerClass, OrderClass, EconomyClass, createRngFn;

  if (typeof module !== "undefined" && module.exports) {
    ({ Grid: GridClass, CellType: CellTypeObj, buildDefaultLayout: buildDefaultLayoutFn } = require("./grid.js"));
    ({ Worker: WorkerClass, Order: OrderClass } = require("./entities.js"));
    ({ Economy: EconomyClass } = require("./economy.js"));
    ({ createRng: createRngFn } = require("./rng.js"));
  } else {
    GridClass = Grid;
    CellTypeObj = CellType;
    buildDefaultLayoutFn = buildDefaultLayout;
    WorkerClass = Worker;
    OrderClass = Order;
    EconomyClass = Economy;
    createRngFn = createRng;
  }

  const INITIAL_WORKERS = 2;
  const ORDER_TIME_LIMIT = 18; // seconds an order stays valid before being "late"
  const ORDER_REWARD = 12;
  const LATE_PENALTY = 3;
  const SPAWN_INTERVAL_MIN = 1.6;
  const SPAWN_INTERVAL_MAX = 3.2;
  const MAX_PENDING_ORDERS = 14;
  const BASE_WORKER_SPEED = 3.2; // cells per second
  const LEVEL_UP_EVERY = 10; // completed orders per level

  class Game {
    constructor(seed) {
      this.rng = createRngFn(seed === undefined ? Date.now() >>> 0 : seed);
      const layout = buildDefaultLayoutFn();
      this.layout = layout;
      this.grid = new GridClass(layout.width, layout.height, layout.cells);
      this.economy = new EconomyClass(50);

      this.workers = [];
      this.orders = [];
      this.nextOrderId = 1;
      this.nextWorkerId = 1;
      this.clock = 0;
      this.spawnTimer = this._randomSpawnDelay();
      this.speedUpgradeLevel = 0;
      this.workerSpeed = BASE_WORKER_SPEED;
      this.paused = false;

      this.stats = { completed: 0, onTime: 0, late: 0, totalSpawned: 0, expired: 0 };
      this.level = 1;
      this.events = []; // transient event log for the UI (e.g. "level-up"), drained by getState()

      for (let i = 0; i < INITIAL_WORKERS; i++) this._addWorker();
    }

    _randomSpawnDelay() {
      return SPAWN_INTERVAL_MIN + this.rng() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    }

    _addWorker() {
      const w = new WorkerClass(this.nextWorkerId++, this.layout.dockIn, this.workerSpeed);
      this.workers.push(w);
      return w;
    }

    maxWorkers() {
      return 2 + this.level * 2;
    }

    hireWorker() {
      if (this.workers.length >= this.maxWorkers()) return { ok: false, reason: "max-workers" };
      const cost = EconomyClass.hireWorkerCost(this.workers.length);
      if (!this.economy.canAfford(cost)) return { ok: false, reason: "cannot-afford", cost };
      this.economy.spend(cost);
      this._addWorker();
      return { ok: true, cost };
    }

    upgradeSpeed() {
      const cost = EconomyClass.speedUpgradeCost(this.speedUpgradeLevel);
      if (!this.economy.canAfford(cost)) return { ok: false, reason: "cannot-afford", cost };
      this.economy.spend(cost);
      this.speedUpgradeLevel += 1;
      this.workerSpeed = BASE_WORKER_SPEED * (1 + 0.18 * this.speedUpgradeLevel);
      for (const w of this.workers) w.speed = this.workerSpeed;
      return { ok: true, cost };
    }

    setPaused(paused) {
      this.paused = paused;
    }

    /** Advance the simulation by dt seconds. */
    update(dt) {
      if (this.paused || dt <= 0) return;
      this.clock += dt;

      this._spawnOrders(dt);
      this._expireLateOrders();
      this._dispatch();
      this._updateWorkers(dt);
    }

    _spawnOrders(dt) {
      this.spawnTimer -= dt;
      if (this.spawnTimer > 0) return;
      this.spawnTimer = this._randomSpawnDelay();

      const pendingCount = this.orders.filter((o) => o.status === "pending" || o.status === "assigned").length;
      if (pendingCount >= MAX_PENDING_ORDERS) return;

      const shelf = this.layout.shelves[Math.floor(this.rng() * this.layout.shelves.length)];
      const order = new OrderClass(this.nextOrderId++, shelf, this.layout.dockOut, this.clock, ORDER_TIME_LIMIT, ORDER_REWARD);
      this.orders.push(order);
      this.stats.totalSpawned += 1;
    }

    _expireLateOrders() {
      for (const order of this.orders) {
        if (order.status === "pending" && order.isLate(this.clock)) {
          order.status = "expired";
        }
      }
      const before = this.orders.length;
      this.orders = this.orders.filter((o) => o.status !== "expired");
      const expiredCount = before - this.orders.length;
      if (expiredCount > 0) {
        this.stats.expired += expiredCount;
        this.economy.earn(-LATE_PENALTY * expiredCount);
        if (this.economy.score < 0) this.economy.score = 0;
      }
    }

    _dispatch() {
      const idleWorkers = this.workers.filter((w) => w.state === "idle");
      if (idleWorkers.length === 0) return;

      const pending = this.orders.filter((o) => o.status === "pending").sort((a, b) => a.createdAt - b.createdAt);

      for (const worker of idleWorkers) {
        const order = pending.shift();
        if (!order) break;
        const path = this.grid.bfsPath(worker.cell, order.pick);
        if (!path) continue; // shouldn't happen with the default layout, but stay safe
        order.status = "assigned";
        order.assignedWorkerId = worker.id;
        worker.assign(order, path);
      }
    }

    _updateWorkers(dt) {
      for (const worker of this.workers) {
        const event = worker.update(dt);
        if (!worker.orderId) continue;
        const order = this.orders.find((o) => o.id === worker.orderId);
        if (!order) continue;

        if (event === "picked") {
          order.status = "toDock";
          const path = this.grid.bfsPath(worker.cell, order.dock);
          worker.path = path || [{ x: worker.cell.x, y: worker.cell.y }];
          worker.pathIndex = 0;
          worker.state = "toDock";
        } else if (event === "delivered") {
          const onTime = !order.isLate(this.clock);
          this.stats.completed += 1;
          if (onTime) {
            this.stats.onTime += 1;
            this.economy.earn(order.reward);
          } else {
            this.stats.late += 1;
            this.economy.earn(Math.max(1, Math.round(order.reward * 0.4)));
          }
          order.status = "done";
          worker.state = "idle";
          worker.orderId = null;
          worker.path = null;

          const newLevel = 1 + Math.floor(this.stats.completed / LEVEL_UP_EVERY);
          if (newLevel > this.level) {
            this.level = newLevel;
            this.events.push({ type: "level-up", level: this.level });
          }
        }
      }
      this.orders = this.orders.filter((o) => o.status !== "done");
    }

    efficiency() {
      if (this.stats.completed === 0) return 100;
      return Math.round((this.stats.onTime / this.stats.completed) * 100);
    }

    throughputPerMinute() {
      if (this.clock < 1) return 0;
      return Math.round((this.stats.completed / this.clock) * 60 * 10) / 10;
    }

    /** Drain and return queued one-off events (e.g. level-ups) for the UI. */
    drainEvents() {
      const out = this.events;
      this.events = [];
      return out;
    }

    getState() {
      return {
        clock: this.clock,
        paused: this.paused,
        score: this.economy.score,
        level: this.level,
        efficiency: this.efficiency(),
        throughput: this.throughputPerMinute(),
        stats: { ...this.stats },
        workerCount: this.workers.length,
        maxWorkers: this.maxWorkers(),
        nextHireCost: EconomyClass.hireWorkerCost(this.workers.length),
        nextSpeedUpgradeCost: EconomyClass.speedUpgradeCost(this.speedUpgradeLevel),
        speedUpgradeLevel: this.speedUpgradeLevel,
        workers: this.workers.map((w) => ({
          id: w.id,
          pos: { x: w.pos.x, y: w.pos.y },
          state: w.state,
          carrying: w.carrying,
        })),
        orders: this.orders.map((o) => ({
          id: o.id,
          shelfId: o.shelfId,
          pick: o.pick,
          status: o.status,
          createdAt: o.createdAt,
          deadline: o.deadline,
        })),
      };
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { Game, CONFIG: { ORDER_TIME_LIMIT, ORDER_REWARD, LEVEL_UP_EVERY } };
  } else {
    window.Game = Game;
  }
})();
