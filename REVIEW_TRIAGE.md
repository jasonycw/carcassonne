# PR #2 Review Triage & Action Plan

## Unresolved Issues Identified

### 1. Functional Correctness (High Priority)
- **Undefined Next Open River Direction**: `rotatedRiver.find(...)` can return `undefined` if the placed tile has no other river direction than the entry direction (e.g., Lake). This can cause the river phase to stay `true` but with an invalid direction, discarding the remaining river pile.
- **Tower Foundation Test Mismatch**: `placeTile` uses `tile.tower.offset.x != null` while the tower step uses `!tile.tile.tower?.offset`. These should be aligned to prevent a tile from being a tower target in one path but not the other.
- **Tower Closure Meeple Type**: The UI enables "Close Tower" if the player has a large meeple, but the handler always sends `'normal'`. This prevents legal large-meeple tower closures.
- **Prisoner Buy-Back Import/Runtime Bug**: `GameView.js` and `GameHost.js` call `buyBackCapturedMeeple` (or `glBuyBackCapturedMeeple`), but the functions are not imported or correctly named in the import block.
- **Buy-Back Limit**: Official rules limit buy-back to one prisoner per turn. The current implementation allows multiple buy-backs.

### 2. Data Integrity & Integration (Medium Priority)
- **Serialized Expansion State**: Initial client setup in `LobbyView.js` doesn't copy River and Tower fields into `clientState`, leading to an incorrect initial remote view until the first broadcast.
- **Split River Farms**: Straight river tiles list all 8 farm directions in one entry, treating both banks as one field. They should be split by the river bank.
- **Prisoner Exchange Choice**: `checkAndExchangePrisoners` always selects the first matching prisoner. Official rules let the owner decide if multiple types are held (e.g., large and normal).

### 3. Cleanup & Documentation (Low Priority)
- **Generated Evidence Artifacts**: Playwright artifacts under `docs/evidence/` and QA notes should be removed from the repo history to maintain clean-audit standards.
- **Rubbish Comments**: Remove any redundant or non-informative comments in the PR.

---

## Action Plan

### Commit 1: Fix River phase termination and foundation validation
- Update `GameLogic.js` to end the river phase if no continuation direction exists.
- Align tower foundation checks between `placeTile` and `placeTowerPiece`.

### Commit 2: Fix Tower closure meeple type and buy-back limit
- Update `GameView.js` to pass the correct meeple type for tower closure.
- Implement the one-buy-back-per-turn limit in `GameLogic.js` and sync it.

### Commit 3: Fix Prisoner buy-back runtime bugs and imports
- Fix missing/incorrect imports in `GameView.js` and `GameHost.js`.
- Ensure buy-back logic is correctly wired through the host-authoritative path.

### Commit 4: Improve Client state synchronization and Farm splitting
- Extract state reconstruction into a shared helper and use it in `LobbyView.js`.
- Split farm directions for river tiles in `TileData.js`.

### Commit 5: Final Cleanup and PR Resolution
- Remove generated evidence artifacts from the repository.
- Resolve all review threads on GitHub.
- Update PR description with the final verified state.
