This Pull Request implements **The River** and **The Tower** extensions for Carcassonne, ensuring 100% adherence to official rule sets, full multiplayer P2P compatibility, and pixel-perfect graphical continuity.

#### 1. The River Extension (Official Rules)
- **Tile Distribution**: Includes all 12 official river tiles (Source `I.s`, Lake `I.e`, 2 Bends, 8 Straights/Specials).
- **Setup**: Shuffles the 10 internal river tiles between the Source (start) and Lake (end).
- **Continuous Flow**: Strictly enforces that every river tile must connect to the current open river tail.
- **Definitive Orientation Fix**: All 12 river assets have been pixel-audited. Metadata in `TileData.js` is now perfectly aligned with native PNG orientations (e.g., `LIRI` is confirmed as a West-East straight with a North cathedral and South road).
- **Visual Connectivity**: Ensures that river edges only connect to other river edges, maintaining a seamless visual flow without mismatches to roads or fields.

#### 2. The Tower Extension (Official Rules)
- **Tower Placement**: Players can place a tower floor on any foundation or existing tower.
- **Meeple Capture**: Captures orthogonal meeples within range (1 tile per floor height), including the player's own meeples.
- **Prisoner Exchange**: Automatic exchange of prisoners when two players hold each other's meeples.
- **Ransom**: Buy back prisoners for 3 points during the tower action phase.
- **Tower Closing**: Use a meeple to close a tower, preventing further growth or capture from that tower.

#### 3. Visual Proof Matrix (Base Game + All DLC Combinations)

The following high-definition session recordings demonstrate the game running successfully across all expansion combinations and base game with native GitHub inline playback:

| Scenario / Expansion Mode | Board State (Screenshot) | Session Recording (HD Inline Video) |
| --- | --- | --- |
| **Base Game Only** | ![Base Start](https://github.com/jasonycw/carcassonne/raw/fix/river-tower-official-rules/docs/evidence/base-start.png) | https://github.com/user-attachments/assets/6f76b429-ca35-4748-a484-ca44ef30d9e0 |
| **Inns & Cathedrals (I&C)** | ![IC Start](https://github.com/jasonycw/carcassonne/raw/fix/river-tower-official-rules/docs/evidence/ic-start.png) | https://github.com/user-attachments/assets/e45abf09-7dec-4611-a2a7-fd68f9dcf5d9 |
| **Traders & Builders (T&B)** | ![TB Start](https://github.com/jasonycw/carcassonne/raw/fix/river-tower-official-rules/docs/evidence/tb-start.png) | https://github.com/user-attachments/assets/acee6bf1-8135-45a7-994b-5a1f22d4f392 |
| **The River Extension** | ![River Start](https://github.com/jasonycw/carcassonne/raw/fix/river-tower-official-rules/docs/evidence/river-start.png) | https://github.com/user-attachments/assets/15491ca5-ef46-46ef-89bc-ca5dd5de634e |
| **The Tower Extension** | ![Tower Action](https://github.com/jasonycw/carcassonne/raw/fix/river-tower-official-rules/docs/evidence/all-dlc-action.png) | https://github.com/user-attachments/assets/625760e1-7a92-4905-aaf2-3d1b1b6f6f7b |
| **All DLC Combined** | ![All DLC Start](https://github.com/jasonycw/carcassonne/raw/fix/river-tower-official-rules/docs/evidence/all-dlc-start.png) | https://github.com/user-attachments/assets/6823b600-a9fc-4f34-82ce-13f2e1f6a819 |

#### 4. Verification & Testing
- **Unit Tests**: 289/289 passing.
- **E2E Tests**: Playwright test suite successfully executed across all 6 scenario combinations with HD recording enabled.
- **Visual Audit**: High-resolution pixel audit confirmed all river tile edges. `LIRI` confirmed as straight horizontal.
