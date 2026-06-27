All known issues found during the previous round of live-site testing have been resolved.

## Resolved

- Issue 1 (Tile animation): The floating tile now rotates smoothly while sliding to the board position, instead of snapping to the final orientation first.
- Issue 2 (Host reconnection): The host can refresh the page, recreate the room via `_recoverHostGame()`, and clients will auto-detect the disconnect and reconnect. The host's GameHost._handleJoinRequest handles the reconnection flow with preferred slot assignment.
- Issue 3 (Joiner awareness): The scoreboard no longer hardcodes the host as always-connected. When the host disconnects, the client sees a red dot and a "Host disconnected — Reconnecting..." overlay. The client attempts to reconnect (up to 10 retries) and, on success, receives a full GAME_STATE_SYNC from the host.
