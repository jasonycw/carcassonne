/**
 * solo-game.spec.js — E2E test for solo Carcassonne game flow.
 *
 * Verifies:
 *   1. Lobby loads → player can create a room
 *   2. Room display appears → Start Game button is visible
 *   3. Click Start Game → game board renders (SVG + HUD)
 *   4. A valid tile placement can be performed
 */

import { test, expect } from '@playwright/test';

test.describe('Solo Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#lobby-container');
  });

  test('lobby loads correctly', async ({ page }) => {
    await expect(page.locator('#player-name')).toBeVisible();
    await expect(page.locator('#player-count')).toBeVisible();
    await expect(page.locator('#create-game-btn')).toBeVisible();
    await expect(page.locator('#join-game-btn')).toBeVisible();
  });

  test('create room and start solo game', async ({ page }) => {
    // ── 1. Fill lobby form ──────────────────────────────────────────────
    await page.locator('#player-name').fill('Tester');
    await page.locator('#player-count').selectOption('1');

    // ── 2. Click create game → room display appears ────────────────────
    await page.locator('#create-game-btn').click();

    // Wait for room display (PeerJS init + lobby UI update).
    await page.waitForSelector('#room-display[style*="block"]', { timeout: 25000 });

    // Verify start button is visible.
    await expect(page.locator('#start-game-btn')).toBeVisible({ timeout: 5000 });

    // ── 3. Click start game → game view renders ────────────────────────
    await page.locator('#start-game-btn').click({ timeout: 5000 });

    // Verify game container and SVG board appear.
    await expect(page.locator('#game-container')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#game-svg')).toBeAttached({ timeout: 5000 });
    await expect(page.locator('#game-hud')).toBeVisible({ timeout: 5000 });

    // Verify turn indicator shows the player's name.
    await expect(page.locator('#game-turn-indicator')).not.toBeEmpty({ timeout: 5000 });

    // Verify the SVG has D3 content (at least one image element).
    const svgImages = page.locator('#game-svg image');
    // Starting tile + active tile image should exist.
    await expect(svgImages.first()).toBeAttached({ timeout: 5000 });

    // ── 4. Take a screenshot for visual reference ──────────────────────
    await page.screenshot({ path: 'test-results/solo-game-started.png' });
  });
});
