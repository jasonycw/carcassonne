# Issues — Resolved

All issues identified during migration testing have been fixed and verified on the deployed site at `https://jasonycw.github.io/carcassonne/`.

## Resolved Issues

1. **Tile animation on cancel (old Issue 2)** — Clicking outside a valid placement now animates the tile back to the top-right corner with both position and zoom transitions in a single click. Fixed by removing the `_showActiveTileIfNeeded()` call from `_cancelPlacement()` which was synchronously rebuilding the tile at the corner position, making the animation invisible.

2. **Meeple outlines rotation (old Issue 3)** — Meeple outlines now consistently counter-rotate to face the screen regardless of when `showMeeplePlacements()` is called. Fixed by adding `_updateOutlineCounterRotation()` call inside `showMeeplePlacements()`.

3. **Double-click to rotate after meeple cancel (old Issue 4)** — Clicking a non-outline area of a placed tile now both reverts from meeple selection AND rotates the tile in a single click. Fixed by removing the `return` statement after the revert callback in the tile image click handler, allowing the rotation logic to run in the same click.

4. **Tower checkbox visible in home page (old Issue 5)** — The Tower expansion is disabled per the original baseline (commit `962f33ee`). The checkbox has been removed from the lobby UI to avoid confusion.

5. **Host refresh loses game (new Issue 5)** — When the host refreshes the page, they now automatically recreate the PeerJS room using the saved room code and transition directly to the game view with the saved game state. GameHost handles incoming JOIN_REQUESTs from reconnecting clients.
