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
 * 3. Place a tile and verify turn advances to Player 2
 */

import { test, expect } from '@playwright/test';

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

    // ── 3. Play a turn ───────────────────────────────────────────────
    let playedTurn = false;

    for (let i = 0; i < 20; i++) {
      // Try to click a valid placement on the SVG (image elements since migration)
      const placement = page.locator('#game-svg image.tile-placement').first();
      const hasPlacement = await placement.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasPlacement) {
        await placement.click({ timeout: 3000, force: true });
        await page.waitForTimeout(400);
        const confirmBtn = page.locator('#hud-confirm');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
          playedTurn = true;
          console.log('Placed tile via confirm button');
          break;
        }
      }

      await page.waitForTimeout(500);
    }

    expect(playedTurn).toBe(true);

    // ── 4. Verify turn advances to Player 2 ──────────────────────────
    // Wait briefly for the UI to update, then check the turn indicator.
    await page.waitForTimeout(500);
    const turnTextAfter = await turnIndicator.textContent();
    console.log('Turn text after play:', JSON.stringify(turnTextAfter));

    // Debug: check game state directly
    const currentPlayerIdx = await page.evaluate(() => {
      // Look for game state in the window or DOM
      try {
        const raw = localStorage.getItem('carcassonne_game_state');
        if (raw) {
          const state = JSON.parse(raw);
          return { currentPlayerIndex: state.state?.currentPlayerIndex, players: state.state?.players?.map(p => p.user?.username) };
        }
      } catch {}
      return null;
    });
    console.log('Saved game state:', JSON.stringify(currentPlayerIdx));

    // After Alice plays, it should be Player 2's turn (named "Player 2")
    expect(turnTextAfter).toContain("Player 2");
  });

});
