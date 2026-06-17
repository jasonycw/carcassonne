/**
 * screenshot-game.spec.js — Play a 2-player hot-seat game and take screenshots.
 *
 * Flows through the full lifecycle: lobby → start → mid-game → game-over.
 * Screenshots are written to screenshots/*.png for the README.
 */
import { test } from '@playwright/test';

/**
 * Place a tile for the current player, optionally placing a meeple if
 * outlines are visible.  Uses dispatchEvent to avoid viewport boundaries
 * on the zoom/pan SVG.  Returns true when a tile was successfully placed.
 */
async function tryPlaceTile(page) {
  const placement = page.locator('#game-svg image.tile-placement').first();
  const hasPlacement = await placement.isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasPlacement) return false;

  // Use dispatchEvent so we don't trip viewport boundary checks on the
  // zoom/pan SVG.  The native click fires the same D3 event handler.
  await placement.dispatchEvent('click');
  await page.waitForTimeout(300);

  const btn = page.locator('#hud-confirm');
  const bv = await btn.isVisible({ timeout: 2000 }).catch(() => false);
  if (!bv) return false;

  // Phase 1: Click "Place Tile" → confirms rotation, shows meeple outlines.
  await btn.click();
  await page.waitForTimeout(300);

  // Try to place a meeple if outlines are visible.
  const meepleOutline = page.locator('#game-svg image.meeple-outline').first();
  if (await meepleOutline.isVisible({ timeout: 1000 }).catch(() => false)) {
    await meepleOutline.dispatchEvent('click');
    await page.waitForTimeout(200);
  }

  // Phase 2: Click "Send Move" → finalises the placement.
  const btn2 = page.locator('#hud-confirm');
  if (await btn2.isVisible({ timeout: 1000 }).catch(() => false)) {
    await btn2.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

test.describe('Screenshot Game', () => {
  test('play 2-player game with meeples and capture all 4 screenshots', async ({ page }) => {
    test.setTimeout(600000); // 10 minutes

    // Use a tall viewport so tile placements stay visible.
    await page.setViewportSize({ width: 1280, height: 1000 });

    // ── 1. Lobby (2-player slots) ─────────────────────────────────────
    await page.goto('/');
    await page.waitForSelector('#lobby-container', { timeout: 10000 });
    await page.locator('#player-name').fill('Alice');
    await page.locator('#player-count').selectOption('2');
    await page.locator('#create-game-btn').click();
    await page.waitForSelector('#lobby-players[style*="block"]', { timeout: 10000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'screenshots/01-lobby.png', fullPage: true });
    console.log('✓ Screenshot 1: lobby');

    // ── 2. Start game ─────────────────────────────────────────────────
    await page.locator('#start-game-btn').click();
    await page.waitForSelector('#game-container', { timeout: 10000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'screenshots/02-game-started.png', fullPage: true });
    console.log('✓ Screenshot 2: game started');

    // ── 3. Place ~30 tiles (with meeples when possible) ────────────────
    let totalPlaced = 0;
    let midGameDone = false;
    let gameOver = false;

    while (!gameOver && totalPlaced < 130) {
      const placed = await tryPlaceTile(page);
      if (placed) {
        totalPlaced++;
        if (totalPlaced % 10 === 0) console.log(`Placed ${totalPlaced} tiles`);

        if (!midGameDone && totalPlaced >= 12) {
          await page.waitForTimeout(500);
          await page.screenshot({ path: 'screenshots/03-mid-game.png', fullPage: true });
          console.log('✓ Screenshot 3: mid-game');
          midGameDone = true;
        }
      } else {
        // Check if the game-over banner has appeared.
        try {
          const banner = page.locator('#game-over-banner');
          gameOver = await banner.isVisible({ timeout: 500 });
        } catch {
          await page.waitForTimeout(500);
        }
      }
    }

    console.log(`Total tiles placed: ${totalPlaced}`);

    // ── 4. Game over screenshot ───────────────────────────────────────
    if (!gameOver) {
      // If the banner never appeared, the loop ended because we hit the
      // tile limit.  Wait a bit for any late banner render.
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/04-game-over.png', fullPage: true });
    console.log('✓ Screenshot 4: game over');
  });
});
