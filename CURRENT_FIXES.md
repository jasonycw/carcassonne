# Carcassonne Migration Fixes

## Completed Fixes ✅
1. Lobby background now uses bg.jpg with proper tiling
2. Semi-transparent dark overlay on lobby content for readability
3. Removed duplicate "Tiles Left" counter from top bar
4. Added rotation indicator (0°, 90°, 180°, 270°) to active tile with fade animation

## Known Working Features
- Solo game play with 1-6 players
- Hot-seat (local) multiplayer on same browser
- Game state persistence to localStorage
- Base game tiles and scoring
- Turn indicators and scoreboard

## Known Issues to Fix
1. Meeple outline visibility on active tile (contrast/size)
2. Meeple placement positioning by tile orientation
3. Temporary tile ghost placement alignment with zoom/pan
4. Crown.png missing (non-critical visual)
5. Room joining via URL /?room=XXXX (joiner sees start screen)
6. P2P multiplayer state sync (host not sending moves to guests)
7. Missing AI/NPC for empty player slots
8. Extension image loading (traders, builders, tower)

## Recent Commits
- ad7f6d9: Add rotation indicator feedback to active tile
- a815b04: Fix lobby background rendering with proper tiling and overlay
- f4e6b61: Fix lobby background and remove duplicate tiles counter

## Next Priority
1. Build and deploy to GitHub Pages
2. Test complete game flow from start to finish locally
3. Take screenshots for README
4. Fix critical rendering bugs found during manual testing
5. Verify multiplayer P2P connection flow
