# Contributing

## Getting Started

```bash
git clone <repo-url>
cd concarneau
npm install
npm run dev        # → http://localhost:5173/carcassonne/
```

## Coding Standards

- **Indentation:** tabs (not spaces)
- **Quotes:** single quotes
- **Semicolons:** required
- **Line endings:** Unix (LF)
- **Linting:** `eslint:recommended` — run `npx eslint .` before committing
- **D3 version:** v7 ES Module format exclusively for board SVG rendering
- **No jQuery or Bootstrap:** use vanilla JS and modern CSS (Custom Properties, Grid, Flexbox)

All source code is ESM (`import`/`export`, no CommonJS). Config files are `.js` with ESM syntax.

## Testing

```bash
npm test              # unit + E2E
npm run test:unit     # Vitest (fast, run often)
npm run test:e2e      # Playwright Chromium (slower, run before PR)
```

### Unit tests (`tests/unit/`)
- Vitest framework
- Cover scoring, tile placement, feature tracking, and game logic
- No browser needed

### E2E tests (`tests/e2e/`)
- Playwright with Chromium
- Cover solo game, P2P multiplayer, persistence, and GitHub Pages deployment
- The `screenshot-game.spec.js` test plays a full 4-player game with expansions on the live GitHub Pages site and captures README screenshots

Before submitting a PR, run `npm test` and ensure all tests pass.

## Commit Conventions

- **Atomic commits:** one specific change per commit, never bundle unrelated changes
- **Iterative & traceable:** commits should read as a step-by-step assembly; document what changed and why
- **Clean history:** no merge commits, no fixup commits that should have been squashed
- **No artifacts left behind:** remove untracked files, ignore test artifacts in `.gitignore`, every committed file must be necessary
- **Message format:** human-readable subject line, body with details, and model/tool trailers:
  ```
  Short description of the change

  Longer explanation of what changed and why, if needed.

  LLM-Model: <model-name>
  Co-authored-by: <provider> <email>
  Co-authored-by: OpenCode <noreply@opencode.ai>
  ```

## Pull Request Guidelines

1. **Run the full test suite** (`npm test`) before opening a PR
2. **Verify the build** (`npm run build`) produces no errors
3. **Gameplay changes and new expansions** MUST include:
   - An update to `README.md` describing the new feature
   - Updated screenshots in `screenshots/` (run `npm run test:e2e -- --grep "Screenshot Game"` to regenerate)
4. **Bug fixes** should include a minimal reproduction in the PR description
5. **Reference related issues** using `Closes #123` or `Relates to #456`

## Definition of Done

Before marking any feature complete, pass all of the following:

1. **Build passes** — `npm run build` exits with code 0
2. **Zero console errors** — open the dev server locally, play a full game loop, check for errors or failed network requests
3. **Full game loop works** — simulate a game from start to finish with correct scoring and tile placement
4. **Nested-path test passes** — serve the built `dist/` folder under `localhost:8080/carcassonne/` and verify all assets load without 404s
5. **P2P tested on GitHub Pages** — push to `main`, wait for deploy, then verify a complete P2P game from start to finish at `https://jasonycw.github.io/carcassonne/` with zero errors

## Technical Constraints

- **Static hosting only:** the build produces only HTML, JS, CSS, and images — no server, no Node.js runtime, no database
- **Multiplayer:** host-authoritative PeerJS WebRTC P2P; the host executes game logic and broadcasts state to up to 5 clients
- **State persistence:** full game state saved to `localStorage` after every move for session recovery
- **Path resolution:** the Vite `base` is `/carcassonne/` — all asset paths must work under this subdirectory on GitHub Pages
- **`ISSUES.md` is human-only:** this file must NOT be modified by automated tooling

## Project Structure

```
src/
├── main.js                 # App entry point + router
├── game/                   # Game logic (state machine, tiles, scoring)
├── rendering/              # D3 SVG rendering (board, active tile, scoreboard)
├── network/                # P2P networking (PeerJS, host, client, sync)
├── ui/                     # UI components (lobby, game view, chat, settings)
├── utils/                  # Utilities (event emitter, asset paths)
└── styles/                 # CSS (game-specific, global)
tests/
├── unit/                   # Vitest unit tests
└── e2e/                    # Playwright E2E tests
```

## Questions?

Open a [Discussion](https://github.com/jasonycw/carcassonne/discussions) or file an [Issue](https://github.com/jasonycw/carcassonne/issues).
