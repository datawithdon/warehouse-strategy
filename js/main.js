// main.js - bootstraps the Game simulation + Renderer + UI wiring and
// drives the requestAnimationFrame loop. Browser-only.

(function () {
  let game = new Game();
  const canvas = document.getElementById("game-canvas");
  const renderer = new Renderer(canvas, game.layout);

  const el = {
    score: document.getElementById("stat-score"),
    level: document.getElementById("stat-level"),
    efficiency: document.getElementById("stat-efficiency"),
    throughput: document.getElementById("stat-throughput"),
    workers: document.getElementById("stat-workers"),
    completed: document.getElementById("stat-completed"),
    btnPause: document.getElementById("btn-pause"),
    btnHire: document.getElementById("btn-hire"),
    btnSpeed: document.getElementById("btn-speed"),
    btnRestart: document.getElementById("btn-restart"),
    costHire: document.getElementById("cost-hire"),
    costSpeed: document.getElementById("cost-speed"),
    orderList: document.getElementById("order-list"),
    levelUpBanner: document.getElementById("level-up-banner"),
  };

  el.btnPause.addEventListener("click", () => {
    game.setPaused(!game.paused);
    el.btnPause.textContent = game.paused ? "Resume" : "Pause";
  });

  el.btnHire.addEventListener("click", () => {
    game.hireWorker();
  });

  el.btnSpeed.addEventListener("click", () => {
    game.upgradeSpeed();
  });

  el.btnRestart.addEventListener("click", () => {
    game = new Game();
  });

  function flashLevelUp() {
    el.levelUpBanner.hidden = false;
    // Restart the CSS animation every time.
    el.levelUpBanner.style.animation = "none";
    // eslint-disable-next-line no-unused-expressions
    el.levelUpBanner.offsetHeight;
    el.levelUpBanner.style.animation = "";
    setTimeout(() => { el.levelUpBanner.hidden = true; }, 1800);
  }

  function renderOrderList(state) {
    el.orderList.innerHTML = "";
    if (state.orders.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No active orders";
      el.orderList.appendChild(li);
      return;
    }
    for (const o of state.orders.slice(0, 8)) {
      const li = document.createElement("li");
      const remaining = Math.max(0, Math.round(o.deadline - state.clock));
      li.className = remaining <= 4 ? "late" : "";
      li.innerHTML = `<span>#${o.id} shelf ${o.shelfId}</span><span>${o.status} · ${remaining}s</span>`;
      el.orderList.appendChild(li);
    }
  }

  function updateHud(state) {
    el.score.textContent = Math.round(state.score);
    el.level.textContent = state.level;
    el.efficiency.textContent = state.efficiency + "%";
    el.throughput.textContent = state.throughput + "/min";
    el.workers.textContent = `${state.workerCount}/${state.maxWorkers}`;
    el.completed.textContent = state.stats.completed;

    el.costHire.textContent = `($${state.nextHireCost})`;
    el.costSpeed.textContent = `($${state.nextSpeedUpgradeCost})`;
    el.btnHire.disabled = state.workerCount >= state.maxWorkers || state.score < state.nextHireCost;
    el.btnSpeed.disabled = state.score < state.nextSpeedUpgradeCost;

    renderOrderList(state);
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    game.update(dt);
    for (const evt of game.drainEvents()) {
      if (evt.type === "level-up") flashLevelUp();
    }

    const state = game.getState();
    renderer.draw(state, now / 1000);
    updateHud(state);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
