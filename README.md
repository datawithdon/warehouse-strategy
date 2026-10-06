# Warehouse Strategy

Run a warehouse like a strategy game. Pickers automatically fulfill
incoming orders on a live 2D warehouse map while you manage the
economy: hire more pickers, upgrade their speed, and chase efficiency
and throughput targets as the order queue ramps up.

Inspired by [this demo](https://x.com/DilumSanjaya/status/2106426962738880879)
of gamified industrial software. Built as a small end-to-end canvas
game - no backend, no build step, no external game engine.

## Run it

No dependencies needed to play - it's a static site.

```bash
cd warehouse-strategy
python3 -m http.server 8080    # or: npm run serve
```

Then open **http://localhost:8080**.

(Serving over HTTP is required - opening `index.html` directly via
`file://` will have the browser block some script loading.)

## How it works

- **Warehouse grid** (`js/grid.js`): a floor plan with 12 shelf blocks,
  a receiving dock, and a shipping dock, plus BFS pathfinding between
  any two walkable tiles.
- **Entities** (`js/entities.js`): `Worker` (a picker that walks a path,
  dwells to pick/deliver, and reports events) and `Order` (a pick
  request with a deadline), both pure logic with no DOM dependency.
- **Economy** (`js/economy.js`): score as currency, with escalating
  costs for hiring workers and upgrading their speed.
- **Simulation** (`js/game.js`): ties it together - spawns orders,
  dispatches idle workers to the oldest pending order, expires late
  orders, tracks stats (completed/on-time/late), and levels up every
  10 completed orders (raising the worker cap).
- **Rendering** (`js/render.js`) and **UI wiring** (`js/main.js`):
  canvas drawing and the HUD/controls, browser-only.

Because the simulation (`game.js`) has zero DOM/canvas dependencies,
it runs identically in Node for testing and in the browser for play.

## Play

- **Pause/Resume** - freeze the simulation.
- **Hire Worker** - spend score to add another picker (cost rises each
  hire; capped by your current level).
- **Upgrade Speed** - spend score to make every picker faster.
- **Restart** - start a fresh game.

Pickers (blue dots, gold when carrying) path-find from the dock to a
shelf, pick, then deliver to the shipping dock. Red pulsing markers
show shelves with a pending order. Deliver on time for full score;
late orders expire and cost a small penalty.

## Tests

```bash
npm test
# or: node --test tests/*.test.js
```

Covers pathfinding, worker movement/dwell state machine, order
expiry, the dispatch loop, hiring/upgrade economy rules, and a ~90
simulated-second end-to-end run of the game loop.

## Project layout

```
warehouse-strategy/
├── index.html
├── css/style.css
├── js/
│   ├── rng.js        # seeded PRNG (deterministic for tests)
│   ├── grid.js        # warehouse layout + BFS pathfinding
│   ├── entities.js     # Worker, Order
│   ├── economy.js      # score + upgrade pricing
│   ├── game.js          # core simulation loop (DOM-free)
│   ├── render.js         # canvas drawing (browser-only)
│   └── main.js            # bootstraps Game + Renderer + UI (browser-only)
└── tests/
    ├── grid.test.js
    ├── entities.test.js
    └── game.test.js
```
