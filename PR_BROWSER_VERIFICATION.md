# GitHub PR rendering verification

Source checked in the browser: https://github.com/jasonycw/carcassonne/pull/2

On Aug 14, 2026, the PR description rendered the proof matrix but the repository-linked HTML video tags did not appear as inline video players. GitHub's extracted markdown showed an empty proof table cell for the former video column. After changing the table to standard Markdown image syntax with `docs/evidence/demo.gif`, the signed-in browser visibly rendered animated image thumbnails in the table; this confirmed the GIF was inline but low resolution.

The user explicitly rejected the low-resolution GIF and confirmed that HD recordings should be uploaded directly through the signed-in GitHub PR interface so GitHub can generate native `github.com/user-attachments/assets/...` URLs. The browser session is now signed in and the PR page is open at the URL above. The PR description's action menu/editor still needs to be located before direct HD uploads can be completed.

Human-confirmed River asset semantics: `the-river/LIRI.png` is a straight horizontal West-East river; the north side is farm/field; the cathedral/building is north of the river; and the road runs from the cathedral toward the South edge. Current TileData.js mapping is `northEdge: field`, `eastEdge: river`, `southEdge: road`, `westEdge: river`, `river.directions: ['W','E']`, and `roads: [{ directions: ['S'] }]`.

References:
1. [PR #2](https://github.com/jasonycw/carcassonne/pull/2)
2. [GitHub Markdown basic syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github)

## Fresh screenshot regeneration — 2026-08-14
The six-scenario Playwright matrix was rerun after the final River metadata correction; all 6 tests passed in 1.5 minutes. Fresh PNGs were generated at 1280x720 under `docs/evidence/fresh/` with timestamps from 10:41:59 through 10:43:21.

Visual spot-checks completed:

- `docs/evidence/fresh/river-completed.png`: current River-phase result rendered from the corrected branch; the visible river chain is continuous through the captured board state, with no legacy screenshot overlay or red annotation.
- `docs/evidence/fresh/all-dlc-midgame.png`: current combined-expansion board rendered at 1280x720, showing River, Tower, I&C, and T&B elements in one live multiplayer state.

These newly rendered captures must replace the stale PR screenshot URLs; the previous screenshot references must not be reused.

## 2026-08-15 browser verification after f97c00e

The signed-in GitHub PR page was reloaded after the PR body was updated through the GitHub API. The rendered description now has six `video.webm` media entries shown by the browser as expandable video controls rather than the prior plain URL-only table cells. The browser DOM exposed six `summary` elements labeled `video.webm`, confirming GitHub recognized the standalone user-attachment URLs as media. The latest PR body also uses the corrected River descriptions: `CcII` has its North/West city and South/East River bend; `LIRI` has a North farm with cathedral, a West/East River, and a South road; and the River flow is described as rejecting upstream/backtracking paths.

The fresh screenshot table is visible in the PR body and displays the 1280x720 board captures. The current viewport showed the Base Game, Inns & Cathedrals, and Traders & Builders screenshots; the remaining rows continue below.

## 2026-08-15 final inline-player check

The browser viewport reached the HD Video Proof section of PR #2. The Base Game recording is visibly rendered as a native HTML video player with a play button, timeline, fullscreen control, mute control, and a 0:14 duration; it is not a plain URL or low-resolution GIF. The next recording, Inns & Cathedrals, is also rendered as a `video.webm` media entry and continues below the viewport. GitHub's browser element map exposes six `summary` controls labeled `video.webm` for the six standalone attachment URLs.
