# Migration: Carcassonne → GitHub Pages + WebRTC P2P Multiplayer

## Current Architecture Summary

The app ("Concarneau") is a **full-stack server-rendered** Carcassonne implementation:

| Layer | Technology | Key Files |
|-------|-----------|-----------|
| Server | Express 4 + Node.js | [server.js](file:///D:/Documents/Repositories/carcassonne/server.js) |
| Templating | EJS (server-rendered views) | [views/game.ejs](file:///D:/Documents/Repositories/carcassonne/views/game.ejs) (1984 lines — monolithic) |
| Database | MongoDB + Mongoose | [gamestate.js](file:///D:/Documents/Repositories/carcassonne/app/models/gamestate.js) (1655 lines), [tile.js](file:///D:/Documents/Repositories/carcassonne/app/models/tile.js) (1148 lines), [user.js](file:///D:/Documents/Repositories/carcassonne/app/models/user.js) |
| Auth | Passport.js (local + Facebook/Twitter/Google OAuth) | [config/passport.js](file:///D:/Documents/Repositories/carcassonne/config/passport.js), [app/routes.js](file:///D:/Documents/Repositories/carcassonne/app/routes.js) |
| Real-time | Raw WebSocket (`ws` library) with custom event wrapper | [app/gameserver.js](file:///D:/Documents/Repositories/carcassonne/app/gameserver.js) |
| Game Rendering | D3.js v3 + SVG | Inline in [game.ejs](file:///D:/Documents/Repositories/carcassonne/views/game.ejs) |
| UI Framework | Bootstrap 3 + jQuery 1.11 | CDN-loaded |
| Styling | [game.css](file:///D:/Documents/Repositories/carcassonne/content/css/game.css) + Bootstrap 3 |
| Assets | Tile images (PNG), meeple SVGs, sound effects | [content/](file:///D:/Documents/Repositories/carcassonne/content) |

### What Must Be Removed (Server Dependencies)
- **MongoDB/Mongoose** — All game state, tile definitions, user data, and feature tracking stored in DB
- **Passport.js** — Login (local email/password, Facebook, Twitter, Google OAuth)
- **Express sessions** — Session cookies used for WebSocket auth
- **Server-side game logic** — Tile placement validation, scoring, feature tracking all in `gamestate.js` (1655 lines of Mongoose model methods)
- **Email/Twitter notifications** — Turn notification system via nodemailer/twit
- **Friends system** — Server-managed friend lists stored in User model

### What Can Be Preserved
- **D3.js SVG rendering** — The entire game board rendering (`draw()` function, ~800 lines) is already client-side
- **Tile data** — Static tile definitions can be extracted from `tile.js` Mongoose seeder to JSON
- **Game logic** — The core algorithms in `gamestate.js` (placement validation, scoring, feature merging) can be ported to pure JS
- **CSS/assets** — All tile images, meeple images, sounds, and styling transfer directly
- **Client-side WebSocket wrapper** — The `WrappedSocket` event dispatch pattern works for P2P communication

---

## Finalized Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **P2P Signaling** | PeerJS (npm dependency bundled in static site) | Enables seamless "open URL → auto-join" UX. PeerJS handles only the ~2s signaling handshake; all game data flows direct P2P via WebRTC DataChannel. No accounts, no setup, no cost. |
| **Game Authority** | Host-authoritative | Room creator runs all game logic. Mirrors the current server model. Simple architecture for a casual game with friends. |
| **Expansions** | Iterative — base game first, all expansions in final result | Start with base game to validate the architecture, then add Inns & Cathedrals, Traders & Builders, and The Tower incrementally. |
| **Persistence** | localStorage recovery | Game state saved to `localStorage` so a browser refresh doesn't lose the game. If *all* players close tabs, the game is still lost. |
| **Chat** | Keep — over P2P data channel | Minimal extra effort, good UX for a multiplayer game. |
| **UI** | Moderate modernization | Drop Bootstrap 3 + jQuery. Use modern CSS (custom properties, grid, flexbox). Keep D3.js for game board rendering. |

> [!WARNING]
> **Breaking Changes**: This migration completely removes:
> - All user accounts (login, signup, profile, password reset)
> - Friend lists (replaced by room codes/links)
> - Server-side game persistence (replaced by localStorage)
> - Email/Twitter turn notifications
> - OAuth social login
>
> All existing users and saved games would become incompatible.

### P2P Connection Flow (PeerJS + Shareable URL)

PeerJS is bundled as an npm dependency in the static site. It handles only the initial ~2-second signaling handshake — all game data flows directly between browsers via WebRTC DataChannel after that.

```
┌──────────────────┐                                 ┌──────────────────┐
│      HOST         │                                 │      GUEST        │
│                    │                                 │                    │
│ 1. Click "Create" │                                 │                    │
│    → PeerJS peer   │                                 │                    │
│    → Room code     │                                 │                    │
│    (e.g. K7X9M2)  │                                 │                    │
│                    │                                 │                    │
│ 2. Share URL       │   site.github.io/carcassonne    │                    │
│    via Discord,    │──────/?room=K7X9M2─────────────►│ 3. Open URL        │
│    SMS, etc.       │                                 │    → Enter name    │
│                    │                                 │    → Auto-connects │
│                    │                                 │      via PeerJS    │
│                    │                                 │                    │
│ 4. "Player2 joined"│◄═══ WebRTC DataChannel ════════►│ 4. Connected!      │
│    [Kick] button   │    (direct P2P from here on)    │                    │
│                    │                                 │                    │
│ 5. Click "Start"  │──── GAME_START message ─────────►│ 5. Game begins!    │
│    when ready      │                                 │                    │
└──────────────────┘                                 └──────────────────┘
```

**How it works:**
1. **Host** clicks "Create Game" → a PeerJS `Peer` is created with a random room code as its ID
2. **Host** gets a shareable URL: `https://user.github.io/carcassonne/?room=K7X9M2`
3. **Guest** opens the URL → enters a nickname → PeerJS auto-connects to the host's peer ID from the URL
4. **Host** sees "Player2 joined!" in the lobby with a **[Kick]** button per player
5. **Host** clicks **Start Game** when all players have joined (first come, first serve)
6. All game data (moves, state, chat) flows directly via WebRTC `RTCDataChannel` — PeerJS is no longer involved

**Key details:**
- PeerJS public signaling server is free, requires no account, and is open-source infrastructure
- Multiple guests supported (up to 5 players, each connects to host independently)
- If a guest is kicked, their DataChannel is closed and they're redirected to the lobby
- Host can share the URL at any time — late joiners appear in the lobby until the game starts

---

## Proposed Changes

### Phase 1: Static SPA Foundation

Convert from server-rendered EJS to a static single-page application.

---

#### Build System & Project Structure

##### [NEW] `vite.config.js`
Set up Vite as the build tool with static asset handling. Configure `base` for GitHub Pages subdirectory deployment.

##### [MODIFY] [package.json](file:///D:/Documents/Repositories/carcassonne/package.json)
- Remove all server dependencies: `express`, `mongoose`, `passport`, `bcrypt-nodejs`, `ws`, `connect-mongo`, `cookie-parser`, `body-parser`, `express-session`, `helmet`, `compression`, `nodemailer`, `twit`, `newrelic`, `raven`, `passport-*`, etc.
- Add dev dependencies: `vite`, `vitest`, `@playwright/test`
- Add runtime dependencies: `peerjs` (WebRTC signaling, ~45KB gzipped), `d3` v7 (ES module)
- Update scripts: `dev`, `build`, `preview`, `test:unit`, `test:e2e`, `test`, `verify`, `deploy`
- Add `"type": "module"`

##### [NEW] `index.html`
Root HTML file for the SPA. Combines the current structure from `index.ejs` and `game.ejs` into a single-page app with view switching.

##### [NEW] `src/main.js`
Application entry point. Initializes the app, sets up routing/view management.

##### New directory structure:
```
src/
├── main.js                    # Entry point
├── styles/
│   └── game.css               # Migrated from content/css/game.css
├── game/
│   ├── GameLogic.js           # Ported from gamestate.js (pure JS, no Mongoose)
│   ├── TileData.js            # Static tile definitions (extracted from tile.js)
│   ├── FeatureTracker.js      # City/road/farm/cloister feature tracking
│   ├── Scoring.js             # Scoring algorithms
│   └── TilePlacement.js       # Tile placement validation
├── rendering/
│   ├── GameBoard.js           # D3 SVG rendering (extracted from game.ejs draw())
│   ├── ScoreBoard.js          # Score UI rendering
│   ├── ActiveTile.js          # Active tile management
│   └── MeeplePlacements.js    # Meeple placement UI
├── network/
│   ├── PeerManager.js         # WebRTC P2P connection via PeerJS
│   ├── GameHost.js            # Host-side game orchestration
│   ├── GameClient.js          # Client-side move sending
│   └── Protocol.js            # Message types and serialization
├── ui/
│   ├── LobbyView.js           # Nickname + create/join room UI
│   ├── GameView.js            # Main game view (menus, chat, SVG wrapper)
│   └── SettingsPanel.js       # Sound/dark mode/color preferences (localStorage)
└── utils/
    └── EventEmitter.js        # Lightweight event system (replacing WrappedSocket)
public/
├── images/                    # Moved from content/images
├── sounds/                    # Moved from content/sounds
└── fonts/
```

---

#### Game Logic Port (Server → Client)

##### [NEW] `src/game/TileData.js`
Extract all tile definitions from [tile.js](file:///D:/Documents/Repositories/carcassonne/app/models/tile.js) into a static JSON/JS data file. Each tile currently stored as a Mongoose `create()` call (lines 45-1148) will become a plain object:
```js
export const BASE_GAME_TILES = [
  {
    id: 'RCr',
    northEdge: 'city', southEdge: 'field', westEdge: 'road', eastEdge: 'road',
    roads: [{ directions: ['W','E'], meepleOffset: { x: 0.5, y: 0.5 }}],
    cities: [{ directions: ['N'], meepleOffset: { x: 0.5, y: 0.125 }}],
    farms: [/*...*/],
    imageURL: '/images/tiles/base-game/RCr.png',
    count: 4,
    startingTile: true
  },
  // ... ~24 base game tiles, ~18 I&C tiles, etc.
];
```

##### [NEW] `src/game/GameLogic.js`
Port the core game logic from [gamestate.js](file:///D:/Documents/Repositories/carcassonne/app/models/gamestate.js). This is the largest porting effort (~1655 lines). Key methods to port:
- `initializeNewGame()` (lines ~400-600) — Shuffle tiles, assign colors, set up initial state
- `drawTile()` (lines 196-400) — Draw random tile, compute valid placements with all 4 rotations
- `placeTile()` — Validate and execute tile placement, merge features
- `completeGame()` (lines 133-194) — End-game scoring
- Feature tracking: `checkAndFinalizeFeature()`, city/road/farm/cloister scoring
- All Mongoose-specific code (`populate`, `save`, `markModified`, `ObjectId` refs) replaced with plain object manipulation

##### [NEW] `src/game/FeatureTracker.js`
Port the feature models from:
- [featureCity.js](file:///D:/Documents/Repositories/carcassonne/app/models/featureCity.js)
- [featureRoad.js](file:///D:/Documents/Repositories/carcassonne/app/models/featureRoad.js)
- [featureFarm.js](file:///D:/Documents/Repositories/carcassonne/app/models/featureFarm.js)
- [featureCloister.js](file:///D:/Documents/Repositories/carcassonne/app/models/featureCloister.js)

These are currently Mongoose schemas — convert to plain JS classes/objects.

---

#### Rendering Extraction

##### [NEW] `src/rendering/GameBoard.js`
Extract the `draw()` function and supporting rendering code from [game.ejs](file:///D:/Documents/Repositories/carcassonne/views/game.ejs) (approximately lines 1200-1984). This includes:
- D3 SVG board rendering
- Tile image placement
- Meeple rendering
- Score display
- Valid placement highlighting
- Zoom/pan behavior
- Active tile management

The rendering code is already client-side JavaScript embedded in the EJS template — it needs to be extracted into ES modules, with EJS template variables (`<%= user.xxx %>`) replaced with runtime state.

##### [NEW] `src/rendering/ActiveTile.js`
Extract the active tile management code:
- `resetActiveTile()` (lines 406-460)
- `changeMeepleMode()` (lines 462-515)
- `updateMeeplePlacements()` (lines 517-574)
- Tile rotation and placement click handlers

---

### Phase 2: P2P Multiplayer & Room System

Replace the server-mediated auth/friends/game-creation flow with a P2P room system.

---

#### Network Layer

##### [NEW] `src/network/PeerManager.js`
PeerJS-based P2P connection management:
```js
import Peer from 'peerjs';

// Host:
// 1. const peer = new Peer(roomCode)  → registers with PeerJS signaling
// 2. peer.on('connection', conn => { ... })  → auto-accepts guests
// 3. Share URL: site.github.io/carcassonne/?room=<roomCode>

// Guest:
// 1. Read roomCode from URL query string
// 2. const peer = new Peer()  → anonymous peer
// 3. const conn = peer.connect(roomCode)  → auto-connects to host
// 4. conn.on('open', () => { send nickname })

// After connection:
// - conn.send(data) / conn.on('data', handler)  → all game communication
// - PeerJS signaling is no longer involved
// - Host maintains Map<peerId, { conn, nickname, playerIndex }>
// - Kick: conn.close() + remove from map + broadcast updated player list
// - Reconnection: guest re-opens URL, host accepts new connection for same nickname
```

##### [NEW] `src/network/StateSync.js`
LocalStorage-based game state persistence:
- Save full game state to `localStorage` after every move
- On page load, check for saved state and offer to resume
- Host re-broadcasts state to reconnecting peers
- Clear saved state when game ends

##### [NEW] `src/network/Protocol.js`
Define the P2P message protocol replacing the current WebSocket events:

| Current Server Event | New P2P Message | Direction |
|---------------------|-----------------|-----------|
| `new game` | `GAME_START` | Host → All |
| `sending move` | `SUBMIT_MOVE` | Client → Host |
| `sending gamestate` | `GAME_STATE_UPDATE` | Host → All |
| `load game` | *(not needed — state is in memory)* | — |
| `add friend` / `remove friend` | *(removed — no friends system)* | — |
| `sending message` | `CHAT_MESSAGE` | Any → All |
| `message sent` | `CHAT_MESSAGE` | Host → All |
| `game started` | `GAME_START` | Host → All |

##### [NEW] `src/network/GameHost.js`
Host-side game orchestration (replaces [gameserver.js](file:///D:/Documents/Repositories/carcassonne/app/gameserver.js)):
- Manages connected peers
- Runs game logic (tile drawing, move validation, scoring)
- Broadcasts game state updates to all peers
- Handles player disconnection/reconnection

##### [NEW] `src/network/GameClient.js`
Client-side counterpart:
- Sends moves to host
- Receives and applies game state updates
- Renders game based on received state

---

#### Lobby & Room UI

##### [NEW] `src/ui/LobbyView.js`
Replaces the current login/signup/friends flow with a simple room-based system:

**Landing screen** (no `?room=` in URL):
1. **Nickname input** — Pre-filled from `localStorage` if returning player
2. **"Create Game" button** — Generates room code, shows lobby as host
3. **"Join Game" input** — Enter a room code manually (alternative to URL)

**Landing screen** (with `?room=XXXXX` in URL):
1. **Nickname input** — Pre-filled from `localStorage`
2. **"Join" button** — Auto-connects to the room from the URL

**Host lobby** (after creating or while waiting):
- Shareable URL displayed prominently with **Copy Link** button
- Player list showing connected guests with **[Kick]** button per guest
- Expansion checkboxes (base game always on, others optional)
- **"Start Game"** button (enabled when ≥1 player connected)
- First come, first serve — no invite/accept flow

**Guest lobby** (after joining):
- "Waiting for host to start..." message
- Player list (read-only, no kick buttons)
- Leave button

This replaces all of:
- [views/index.ejs](file:///D:/Documents/Repositories/carcassonne/views/index.ejs) (login page)
- [views/login.ejs](file:///D:/Documents/Repositories/carcassonne/views/login.ejs)
- [views/signup.ejs](file:///D:/Documents/Repositories/carcassonne/views/signup.ejs)
- [views/username.ejs](file:///D:/Documents/Repositories/carcassonne/views/username.ejs)
- [views/profile.ejs](file:///D:/Documents/Repositories/carcassonne/views/profile.ejs)
- Friends menu in `game.ejs` (lines 59-72)

##### [NEW] `src/ui/SettingsPanel.js`
User preferences stored in `localStorage` instead of MongoDB User model:
- Sound notifications
- Dark mode
- Collapsible menu
- Preferred meeple color
- Nickname (persisted across sessions)

##### [NEW] `src/ui/ChatPanel.js`
In-game chat over P2P data channel:
- Messages sent via the same WebRTC DataChannel as game moves
- Chat protocol message type: `CHAT_MESSAGE { sender, text, timestamp }`
- Chat history included in localStorage state save
- System messages for game events (scoring, turn changes)

---

#### Files to Delete

##### [DELETE] `server.js`
##### [DELETE] `app/` (entire directory)
- `app/gameserver.js`
- `app/routes.js`
- `app/mailer.js`
- `app/models/user.js`
- `app/models/gamestate.js`
- `app/models/tile.js`
- `app/models/featureCity.js`
- `app/models/featureRoad.js`
- `app/models/featureFarm.js`
- `app/models/featureCloister.js`

##### [DELETE] `config/` (entire directory)
- `config/auth.js`
- `config/database.js`
- `config/passport.js`
- `config/proxy.js`
- `config/c9.js`

##### [DELETE] `views/` (entire directory)
All EJS templates replaced by the SPA

##### [DELETE] Server-specific files
- `Dockerfile`, `Dockerfile-staging`
- `Procfile`
- `processes.json`, `processes-staging.json`
- `proxy.conf`
- `newrelic.js`
- `mongod_c9`, `reset_c9`

---

### Phase 3: GitHub Pages Deployment & Polish

---

#### Deployment Configuration

##### [NEW] `.github/workflows/deploy.yml`
GitHub Actions workflow for automatic deployment:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - uses: actions/deploy-pages@v4
```

##### [MODIFY] `vite.config.js`
Set `base: '/<repo-name>/'` for GitHub Pages subdirectory hosting. Ensure all asset paths are relative.

##### [NEW] `src/styles/modern.css`
Moderate UI modernization (replacing Bootstrap 3 + jQuery):
- CSS custom properties for theming (dark/light mode toggle)
- Modern layout with CSS Grid/Flexbox replacing Bootstrap 3 grid
- Updated typography (Google Fonts — Inter or similar)
- Responsive design with modern breakpoints
- Custom form controls replacing Bootstrap defaults
- Smooth transitions for menu/panel interactions
- No jQuery dependency — vanilla JS for DOM manipulation
- D3.js retained for SVG game board rendering

---

## Migration Complexity Estimate

| Component | Effort | Lines of Code (approx) | Notes |
|-----------|--------|----------------------|-------|
| Tile data extraction | Low | ~200 | Mechanical conversion from Mongoose create calls |
| Game logic port (base game) | **High** | ~800 | Core game logic — Mongoose methods → pure JS (base game first) |
| Expansion logic port | **High** | ~600 | I&C, T&B, Tower — added incrementally after base game works |
| Feature tracker port | Medium | ~300 | 4 small Mongoose models → plain classes |
| D3 rendering extraction | Medium | ~800 | Already client-side, needs module extraction |
| P2P networking (PeerJS) | Medium | ~350 | PeerJS handles signaling, WebRTC DataChannel for game data |
| State persistence | Low | ~150 | localStorage save/restore + reconnection logic |
| Lobby/room UI | Medium | ~350 | Nickname picker, offer/answer code exchange UI, room lobby |
| Chat panel | Low | ~100 | P2P chat over DataChannel |
| Settings migration | Low | ~100 | localStorage instead of DB |
| Build system (Vite) | Low | ~50 | Configuration + index.html |
| Automated tests | Medium | ~600 | Playwright E2E + Vitest unit tests + deploy verification |
| GitHub Pages deployment | Low | ~50 | GitHub Actions workflows (test + deploy) |
| **Total** | | **~4,600** | |

---

## Verification Plan

All verification is automated. After all commits are complete, running `npm test` must pass before the site is deployed.

### Automated Test Suite (Playwright E2E)

##### [NEW] `tests/e2e/solo-game.spec.js`
End-to-end test for a single-player game:
- Load the app, enter a nickname, create a room
- Start a solo game (no guests)
- Place the first tile on a valid position
- Verify the tile appears on the board SVG
- Place a meeple, confirm move
- Verify score updates in the scoreboard
- Continue until game ends, verify final scoring

##### [NEW] `tests/e2e/p2p-multiplayer.spec.js`
End-to-end test simulating two players in the **same browser** using two Playwright `BrowserContext`s:
- **Context 1 (Host)**: Enter nickname, click Create Game, copy room URL
- **Context 2 (Guest)**: Navigate to room URL, enter nickname, auto-joins
- Verify host lobby shows the guest's name
- Host clicks Start Game
- Verify both contexts see the same initial board state
- Host places a tile → verify guest sees the update
- Turn advances to guest → guest places a tile → verify host sees the update
- Verify chat messages propagate bidirectionally

##### [NEW] `tests/e2e/persistence.spec.js`
Test localStorage recovery:
- Start a solo game, place several tiles
- Reload the page
- Verify the game state is restored from localStorage
- Verify the board renders correctly after restore

##### [NEW] `tests/unit/game-logic.spec.js`
Unit tests for ported game logic (run via Vitest):
- Tile placement validation: verify valid/invalid placements match expected results
- Feature completion: verify cities, roads, cloisters score correctly when completed
- Feature merging: verify features merge correctly when tiles connect them
- End-game scoring: verify incomplete feature scoring and goods majority bonuses
- Tile rotation: verify edge matching works for all 4 rotations

##### [NEW] `tests/unit/tile-data.spec.js`
Validation of extracted tile data:
- Verify all base game tiles are present with correct counts
- Verify all expansion tiles are present
- Verify tile edge types are valid (`'road'`, `'city'`, `'field'`)
- Verify every tile has a valid `imageURL` pointing to an existing file
- Verify meeple offsets are within [0, 1] range

### Build & Deploy Readiness Script

##### [NEW] `scripts/verify-deploy.js`
Automated script that validates the production build is GitHub Pages-ready:
```js
// Run via: npm run verify
// 1. Run `vite build` and assert exit code 0
// 2. Scan dist/ for all asset references in HTML/JS/CSS
// 3. Verify every referenced asset file exists in dist/
// 4. Verify no absolute paths (must all be relative or use base path)
// 5. Verify no references to localhost, external APIs, or server endpoints
// 6. Verify index.html exists at dist root
// 7. Verify all tile images are present in dist/images/tiles/
// 8. Verify all meeple images are present in dist/images/meeples/
// 9. Start a local static file server on dist/, load in Playwright
// 10. Verify the app renders without console errors
// 11. Run the full E2E test suite against the production build
```

### CI Pipeline

##### [NEW] `.github/workflows/test.yml`
GitHub Actions workflow that runs on every push/PR:
```yaml
name: Test & Validate
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:unit      # Vitest unit tests
      - run: npm run test:e2e       # Playwright E2E tests
      - run: npm run verify         # Deploy readiness check
```

##### [MODIFY] `.github/workflows/deploy.yml`
Deploy workflow only runs after tests pass:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  test:
    # ... same as test.yml ...
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - uses: actions/deploy-pages@v4
```

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "test": "npm run test:unit && npm run test:e2e",
    "verify": "node scripts/verify-deploy.js",
    "deploy": "npm run verify && npm run build"
  }
}
```

### Key Game Logic Parity Checks
- Tile placement validation produces the same valid placements as the original
- Feature completion scoring matches (cities with shields, roads with inns, farm scoring)
- Meeple placement restrictions are correctly enforced
- Game end scoring (incomplete features, goods majorities) is correct
