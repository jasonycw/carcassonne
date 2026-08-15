# River and Tower Rule Audit

## Sources

1. WikiCarpedia, [River](https://wikicarpedia.com/car/River), accessed 2026-08-15.
2. WikiCarpedia, [The Tower](https://wikicarpedia.com/car/The_Tower), accessed 2026-08-15.
3. Carcassonne Central, [The River I & II](https://www.carcassonnecentral.com/community/index.php?topic=2961.0), accessed 2026-08-15.

## River: rules confirmed

The River replaces the normal starting tile. Set aside the Source and Lake; shuffle the remaining River tiles, place the Lake at the bottom of the River stack, and place the Source face-up first. Players draw River tiles until the River stack is exhausted, then place the Lake and resume normal land-tile play.

Every River tile must continue the existing River illustration and must be placed on the current open end for the single-ended River variant implemented in this repository. River tiles may be connected only through their River feature for purposes of this forced opening; ordinary land-feature edge matching still applies to the rest of the tile. The River itself is not a scoreable feature, but other features on River tiles follow normal meeple and scoring rules. A meeple cannot be placed on the River feature.

The explicit geometric restriction is that bend tiles may not turn directly into the same direction one after another: an immediate 180-degree U-turn is forbidden. The official clarification also says that the restriction is about immediate U-turns; however, the downstream interpretation used by this project is stricter and must be stated as an implementation choice only if it is supported by an explicit invariant: the river path from Source to Lake must never move toward the Source or reconnect to an earlier segment. A bend followed by one or more straight tiles and then a later bend must therefore be evaluated against the complete path, not only against the immediately previous tile.

A robust invariant for this single-ended implementation is: after each placement, walk the River graph from Source to the current tail; it must be one simple path, the tail must be the only open River endpoint, and each new segment's continuation must not enter an already occupied River tile or any cell on the Source-to-tail path. A global source-distance check alone is insufficient because Manhattan distance can stay constant or increase while a path still folds around and points back toward an earlier segment.

## Tower: rules confirmed

The Tower expansion adds 18 Tower-foundation land tiles, neutral Tower floors, and a dispenser. Tower floors are distributed by player count: 10 each for 2 players, 9 for 3, 7 for 4, 6 for 5, and 5 for 6. Foundations are placed like ordinary land tiles.

After placing a tile, the active player chooses exactly one of four actions: place one of their meeples on the just-placed tile under normal rules; place one of their Tower floors on a foundation space on any placed tile; place one of their Tower floors on any open Tower; or place one of their meeples on any open Tower, which closes that Tower. A closed Tower cannot receive additional floors, and the meeple placed on it remains until captured or the game ends.

Whenever a Tower floor is placed, the player may immediately capture one eligible meeple from the board, including their own. The floor level determines range: the tile containing the newly placed floor is always reachable, and each floor adds one tile of reach in each cardinal direction. Empty spaces and other Towers do not block the range. A shorter Tower can capture from a taller Tower because height only determines range. Capturing one's own meeple returns it to that player's supply; capturing an opponent's meeple places it in front of the captor as a prisoner.

Whenever two players hold one another's prisoners, the prisoners are exchanged immediately, with the owner choosing which prisoner if multiple prisoners are held. During a player's turn, they may buy back one of their captured meeples by paying 3 points to its captor. The buy-back can occur once per turn and is not a scoring action. The Tower expansion does not change feature scoring; final scoring remains the base game's end-of-game scoring, including incomplete features and prisoner state only insofar as the implementation's normal game rules require.

## Proof requirements derived from the audit

The visual proof must include a mid-game Tower floor placement, the resulting capture or explicit no-capture path, a Tower closure with a meeple, prisoner exchange or ransom, a River path containing straight tiles between bends, completion of the River with the Lake, continuation into normal land-tile play, and a full game reaching final scoring. The PR description must describe these rules directly rather than explaining GitHub's rendering behavior.

## Correction required in current implementation

`RiverPlacement.js` currently checks immediate bend direction and local source-distance heuristics, but it does not yet prove the complete River path remains downstream after arbitrary intervening straight tiles. The implementation must replace or supplement those heuristics with a global path invariant and tests that construct a bend-straight-straight-bend sequence which points back toward the Source or an earlier River segment and is rejected.

The PR's previous visual assets are not sufficient proof because the Tower video ends near the beginning of play and does not show a floor being placed, capture/ransom, or final scoring. Fresh assets must be generated from a deterministic full-game scenario and uploaded to GitHub as user attachments before the PR body is rewritten.

The stale comment identified by the user is issue comment `5300680104` and must be deleted, subject to the authenticated account's permissions.
