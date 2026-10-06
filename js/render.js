// render.js - canvas drawing. Browser-only (reads the Game state
// snapshot and draws it; does not mutate simulation state).

const COLORS = {
  floor: "#1b2030",
  floorAlt: "#1f2536",
  shelf: "#caa15a",
  shelfEdge: "#8a6a30",
  dockIn: "#4ea8ff",
  dockOut: "#52c97a",
  grid: "rgba(255,255,255,0.04)",
  worker: "#5b8cff",
  workerCarrying: "#ffcf5b",
  orderPulse: "rgba(255, 90, 90, 0.9)",
  text: "#e7e9ee",
};

class Renderer {
  constructor(canvas, layout) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.layout = layout;
    this.cellSize = 32;
    this._resizeToLayout();
  }

  _resizeToLayout() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.layout.width * this.cellSize;
    const h = this.layout.height * this.cellSize;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(state, pulseT) {
    const { ctx, cellSize, layout } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Floor + shelves
    for (let y = 0; y < layout.height; y++) {
      for (let x = 0; x < layout.width; x++) {
        const cell = layout.cells[y][x];
        const px = x * cellSize;
        const py = y * cellSize;
        if (cell === "shelf") {
          ctx.fillStyle = COLORS.shelf;
          ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
          ctx.strokeStyle = COLORS.shelfEdge;
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
          ctx.fillRect(px, py, cellSize, cellSize);
          if (cell === "dockIn" || cell === "dockOut") {
            ctx.fillStyle = cell === "dockIn" ? COLORS.dockIn : COLORS.dockOut;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    // Dock labels
    ctx.fillStyle = COLORS.text;
    ctx.font = "11px -apple-system, sans-serif";
    ctx.fillText("IN", layout.dockIn.x * cellSize + 5, layout.dockIn.y * cellSize + cellSize - 10);
    ctx.fillText(
      "OUT",
      layout.dockOut.x * cellSize - 24,
      layout.dockOut.y * cellSize + 14
    );

    // Pending order pulses on shelves that have an active order
    const activeShelfIds = new Set(state.orders.filter((o) => o.status !== "done").map((o) => o.shelfId));
    for (const shelf of layout.shelves) {
      if (!activeShelfIds.has(shelf.id)) continue;
      const cx = shelf.pick.x * cellSize + cellSize / 2;
      const cy = shelf.pick.y * cellSize + cellSize / 2;
      const r = 6 + 3 * Math.sin(pulseT * 4);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.orderPulse;
      ctx.fill();
    }

    // Workers
    for (const w of state.workers) {
      const cx = w.pos.x * cellSize + cellSize / 2;
      const cy = w.pos.y * cellSize + cellSize / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = w.carrying ? COLORS.workerCarrying : COLORS.worker;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (w.carrying) {
        ctx.fillStyle = "#2a2000";
        ctx.font = "10px -apple-system, sans-serif";
        ctx.fillText("▤", cx - 4, cy + 4);
      }
    }
  }
}

if (typeof window !== "undefined") {
  window.Renderer = Renderer;
}
