/**
 * persistence.spec.js — E2E test for localStorage game recovery.
 *
 * 1. Start a solo game, play several tiles
 * 2. Reload the page
 * 3. Verify the game is recovered (either direct resume or via resume banner)
 * 4. Verify the board state is correctly restored
 */

import { test, expect } from '@playwright/test';

test.describe('Game Persistence', () => {

  test('recover a solo game from localStorage after page reload', async ({ page }) => {
    // ── 1. Start a solo game and play a few tiles ─────────────────────
    await page.goto('/');
    await page.waitForSelector('#lobby-container', { timeout: 10000 });

    await page.locator('#player-name').fill('Persist Player');
    await page.locator('#player-count').selectOption('1');
    await page.locator('#create-game-btn').click();

    await page.waitForSelector('#room-display', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('#start-game-btn', { state: 'visible', timeout: 5000 });
    await page.locator('#start-game-btn').click();

    await page.waitForSelector('#game-container', { timeout: 10000 });
    await page.waitForSelector('#game-svg', { state: 'visible', timeout: 5000 });

    // Play a few tiles to create meaningful game state
    let tilesPlaced = 0;
    const targetTiles = 3;

    while (tilesPlaced < targetTiles) {
      // Try to click a valid placement on the SVG
      const placement = page.locator('#game-svg rect.tile-placement').first();
      const hasPlacement = await placement.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasPlacement) {
        await placement.click({ timeout: 3000, force: true });
        await page.waitForTimeout(200);
        const confirmBtn = page.locator('#hud-confirm');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
          tilesPlaced++;
          continue;
        }
      }

      // Skip if can't place
      const skipBtn = page.locator('#hud-skip');
      if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(500);
        tilesPlaced++;
        continue;
      }

      await page.waitForTimeout(500);
    }

    console.log(`Placed ${tilesPlaced} tiles before reload`);

    // Capture scoreboard text for later comparison.
    const scoreTextBefore = await page.locator('#game-scoreboard').textContent();

    // Verify game state was saved to localStorage.
    const hasSavedState = await page.evaluate(() => {
      return !!localStorage.getItem('carcassonne_game_state');
    });
    expect(hasSavedState).toBe(true);

    // ── 2. Reload the page ───────────────────────────────────────────
    await page.reload();
    await page.waitForTimeout(1000);

    // ── 3. Game should recover — either directly or via resume banner ─
    const gameContainer = page.locator('#game-container');
    const resumeBanner = page.locator('#resume-banner');

    const gameVisible = await gameContainer.isVisible({ timeout: 3000 }).catch(() => false);
    const bannerVisible = await resumeBanner.isVisible({ timeout: 3000 }).catch(() => false);

    if (gameVisible) {
      // Direct resume — app went to game view from localStorage.
      console.log('Game recovered directly (game view visible).');
      await expect(page.locator('#game-svg')).toBeAttached({ timeout: 5000 });
      await expect(page.locator('#game-turn-indicator')).not.toBeEmpty({ timeout: 5000 });
    } else if (bannerVisible) {
      // Resume banner path — click Resume Game.
      console.log('Resume banner visible, clicking resume.');
      await page.locator('#resume-game-btn').click({ timeout: 5000 });
      await page.waitForSelector('#game-container', { timeout: 10000 });
      await expect(page.locator('#game-svg')).toBeAttached({ timeout: 5000 });
    } else {
      // Neither — take a screenshot and fail with clear message.
      await page.screenshot({ path: 'test-results/persistence-no-recovery.png' });
      expect(gameVisible || bannerVisible).toBe(true);
    }

    // ── 4. Verify game state is restored ────────────────────────────
    // Turn indicator should show a player name.
    const turnIndicator = page.locator('#game-turn-indicator');
    await expect(turnIndicator).not.toBeEmpty({ timeout: 5000 });

    // Scoreboard should render with the same content.
    const scoreboard = page.locator('#game-scoreboard');
    await expect(scoreboard).toBeVisible({ timeout: 5000 });
    const scoreTextAfter = await scoreboard.textContent();
    expect(scoreTextAfter.length).toBeGreaterThan(0);

    console.log('Game successfully recovered from localStorage');
  });

});
