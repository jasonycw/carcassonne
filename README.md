# Concarneau — Carcassonne P2P Web Game

A browser-based Carcassonne board game with solo play and peer-to-peer multiplayer. Originally an Express/MongoDB app, now a fully static SPA powered by Vite, D3.js, and PeerJS.

Play solo against yourself, or create a room and share the code to play with friends over WebRTC!

## Screenshots

| Lobby | Game Board | Tiles Placed |
|-------|------------|--------------|
| ![Lobby](screenshots/01-lobby.png) | ![Game Board](screenshots/03-game-board.png) | ![Multiple Tiles](screenshots/05-multiple-tiles.png) |

## Features

- **Solo play** — play a full game by yourself
- **Hot-seat multiplayer** — 2–6 players on one device
- **P2P multiplayer** — real-time WebRTC via PeerJS (room-based)
- **Tile placement** — drag-and-drop tile positioning with rotation
- **Meeple placement** — place meeples on cities, roads, cloisters, and fields
- **Scoring** — automatic scoring for completed features (cities, roads, cloisters)
- **Game recovery** — saved game state survives browser refresh
- **Expansions** (optional):
  - Inns & Cathedrals
  - Traders & Builders
  - The Tower
- **Responsive SVG board** — pan & zoom with mouse wheel
- **Scoreboard** — live player scores with meeple pool

## Quick Start

```bash
git clone <repo-url>
cd concarneau
npm install
npm run dev        # → http://localhost:5173/carcassonne/
```

Open the URL, enter your name, select "Solo" (or more players), and click **Create Game**. The room code will appear — for a solo game just click **Start Game**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (hot-reload) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm test` | Run all tests (unit + E2E) |
| `npm run test:unit` | Run unit tests only (Vitest) |
| `npm run test:e2e` | Run E2E tests only (Playwright) |
| `npm run deploy` | Build + verify production output |

## Running E2E Tests

E2E tests use Playwright with Chromium. The test runner auto-starts the Vite dev server.

```bash
npx playwright install chromium   # one-time setup
npm run test:e2e
```

Tests cover:
- **Solo game** — create room, start game, board renders
- **P2P multiplayer** — hot-seat 2-player turn cycling
- **Persistence** — game state survives page reload

## Project Structure

```
src/
├── main.js                 # App entry point + router
├── game/
│   ├── GameLogic.js        # Game state machine (tile placement, scoring)
│   ├── TileData.js         # All tile definitions
│   └── FeatureTracker.js   # Connected feature tracking
├── rendering/
│   ├── GameBoard.js        # D3 SVG board renderer (tiles, placements, scoreboard)
│   ├── ActiveTile.js       # Floating active tile & meeple placement UI
│   └── ScoreBoard.js       # HTML scoreboard component
├── network/
│   ├── PeerManager.js      # PeerJS P2P networking (host + client)
│   ├── GameHost.js         # Host-side game orchestration
│   ├── GameClient.js       # Client-side game sync
│   ├── StateSync.js        # localStorage persistence
│   └── Protocol.js         # Message types & helpers
├── ui/
│   ├── LobbyView.js        # Create / join game lobby
│   ├── GameView.js         # Main game screen (orchestrates rendering + logic)
│   ├── Router.js           # Hash-based SPA router
│   ├── ChatPanel.js        # In-game chat
│   └── SettingsPanel.js    # Settings UI
├── utils/
│   └── EventEmitter.js     # Simple event emitter
└── styles/
    ├── game.css            # Game-specific styles
    └── modern.css          # Global styles
```

## GitHub Pages Deployment

This project is configured for GitHub Pages at the `/carcassonne/` sub-path.

1. Push to the `main` branch
2. In your repo settings → Pages → set source to GitHub Actions
3. The included `.github/workflows/deploy.yml` workflow builds and deploys automatically

The deployed site will be available at `https://<org>.github.io/carcassonne/`.

## Technical Stack

- **Build**: [Vite](https://vitejs.dev/) — fast dev server + optimized builds
- **Rendering**: [D3.js v7](https://d3js.org/) — SVG zoom/pan, data joins, transitions
- **Networking**: [PeerJS](https://peerjs.com/) — WebRTC P2P via cloud signaling server
- **Tests**: [Vitest](https://vitest.dev/) (unit) + [Playwright](https://playwright.dev/) (E2E)
- **CI**: GitHub Actions — test, build, deploy

## License

Original project by [btouellette](https://github.com/btouellette/concarneau). Migrated to static SPA.
