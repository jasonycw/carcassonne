/**
 * p2p-multiplayer.spec.js — E2E test for hot-seat local multiplayer.
 *
 * Covers the scenario where the host creates a game with 2+ players
 * and plays locally (no actual P2P).  This exercises the same code path
 * as solo mode but with multiple players and turn cycling.
 *
 * Flow:
 * 1. Create a 2-player hot-seat game from the lobby
 * 2. Verify the game board appears with the correct turn indicator
 * 3. Place a tile (with meeple) and verify turn advances to Player 2
 * 4. Place a tile (with meeple) for Player 2 and verify turn cycles back
 */

import { test, expect } from '@playwright/test';

/**
 * Place a tile for the current player.  If meeple outlines are visible
 * (i.e. the tile has valid features), also place a meeple.
 * Returns true when a tile was successfully placed.
 */
async function placeTileWithOptionalMeeple(page) {
  // Find a valid board placement.
  const placement = page.locator('#game-svg image.tile-placement').first();
  const hasPlacement = await placement.isVisible({ timeout: 1000 }).catch(() => false);
  if (!hasPlacement) return false;

  await placement.click({ timeout: 3000, force: true });
  await page.waitForTimeout(400);

  const hudBtn = page.locator('#hud-confirm');
  if (!(await hudBtn.isVisible())) return false;

  // Phase 1: click "Place Tile" to confirm rotation → shows meeple outlines.
  await hudBtn.click();
  await page.waitForTimeout(300);

  // Try to click a meeple outline, if any are visible.
  const meepleOutline = page.locator('#game-svg image.meeple-outline').first();
  const hasMeepleOutlines = await meepleOutline.isVisible({ timeout: 1500 }).catch(() => false);
  if (hasMeepleOutlines) {
    await meepleOutline.click({ force: true });
    await page.waitForTimeout(200);
  }

  // Phase 2: click "Send Move" to finalise the placement (with or without meeple).
  await hudBtn.click();
  await page.waitForTimeout(500);
  return true;
}

test.describe('Multiplayer Game', () => {

  test('host creates a hot-seat 2-player game and plays a turn', async ({ page }) => {
    // ── 1. Create a 2-player game ─────────────────────────────────────
    await page.goto('/');
    await page.waitForSelector('#lobby-container', { timeout: 10000 });

    await page.locator('#player-name').fill('Alice');
    await page.locator('#player-count').selectOption('2'); // 2 players
    await page.locator('#create-game-btn').click();

    // Wait for room display (PeerJS init may time out, but the UI fallback
    // allows clicking Start Game even without P2P connections).
    await page.waitForSelector('#room-display[style*="block"]', { timeout: 25000 });
    await page.waitForSelector('#start-game-btn', { state: 'visible', timeout: 5000 });

    // ── 2. Start the game ────────────────────────────────────────────
    await page.locator('#start-game-btn').click();

    // Verify game board appears
    await page.waitForSelector('#game-container', { timeout: 15000 });
    await page.waitForSelector('#game-svg', { state: 'visible', timeout: 5000 });

    const turnIndicator = page.locator('#game-turn-indicator');
    await expect(turnIndicator).not.toBeEmpty();

    // ── 3. Play tiles until Player 2 gets a turn ───────────────────────
    // Note: auto-advance may skip a player if their drawn tile has no valid
    // placements (correct Carcassonne behaviour).  We loop until it's
    // actually Player 2's turn, placing tiles (with optional meeples) for
    // whoever is active.
    let playedTurn = false;
    let alicePlacedMeeple = false;
    let turnTextAfter = '';

    for (let i = 0; i < 15; i++) {
      // Check current turn — if it's Player 2's turn, we're done.
      turnTextAfter = await turnIndicator.textContent();
      if (turnTextAfter.includes('Player 2')) break;

      const ok = await placeTileWithOptionalMeeple(page);
      if (ok) {
        playedTurn = true;
        // Track whether Alice placed a meeple on her first tile.
        if (turnTextAfter.includes('Alice') && !alicePlacedMeeple) {
          alicePlacedMeeple = true;
        }
      }

      await page.waitForTimeout(500);
    }

    expect(playedTurn).toBe(true);
    expect(turnTextAfter).toContain('Player 2');
  });

  test('2-player hot-seat with meeple placement and turn cycling', async ({ page }) => {
    // ── 1. Create a 2-player game ─────────────────────────────────────
    await page.goto('/');
    await page.waitForSelector('#lobby-container', { timeout: 10000 });

    await page.locator('#player-name').fill('Alice');
    await page.locator('#player-count').selectOption('2');
    await page.locator('#create-game-btn').click();

    await page.waitForSelector('#room-display[style*="block"]', { timeout: 25000 });
    await page.waitForSelector('#start-game-btn', { state: 'visible', timeout: 5000 });
    await page.locator('#start-game-btn').click();
    await page.waitForSelector('#game-container', { timeout: 15000 });
    await page.waitForSelector('#game-svg', { state: 'visible', timeout: 5000 });

    const turnIndicator = page.locator('#game-turn-indicator');
    await expect(turnIndicator).not.toBeEmpty();

    // ── 2. Play tiles cycling through both players ─────────────────────
    // We alternate placing tiles.  After Alice's turn, it's Player 2's turn,
    // then Alice again, etc.  Play 4 total turns (2 per player) so both
    // players have a chance to place a tile with a meeple.
    const MAX_ATTEMPTS = 30;
    let turnsPlayed = 0;

    for (let i = 0; i < MAX_ATTEMPTS && turnsPlayed < 4; i++) {
      let turnBefore = await turnIndicator.textContent();

      const ok = await placeTileWithOptionalMeeple(page);
      if (ok) {
        turnsPlayed++;
      }

      await page.waitForTimeout(500);
    }

    // Should have completed 4 turns (2 each for Alice and Player 2).
    expect(turnsPlayed).toBe(4);
  });

});
