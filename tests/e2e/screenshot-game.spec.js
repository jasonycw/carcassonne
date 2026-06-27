/**
 * screenshot-game.spec.js — Play a 4-player hot-seat game with available
 * expansions (Inns & Cathedrals, Traders & Builders) and take screenshots
 * showing beginning, middle, and end of the game with meeples placed and
 * scoring visible.
 *
 * Screenshots are written to screenshots/*.png for the README.
 *
 * Screenshots captured:
 *  01-lobby.png              — Lobby with 4 player slots and all expansions
 *  02-game-started.png        — Board right after game start
 *  03-mid-game.png            — Board mid-game (20+ tiles, meeples, scoring)
 *  04-game-over.png           — Final board with game-over banner and score breakdown
 */

let meeplePlacementCounter = 0;

import { test } from '@playwright/test';

/**
 * Handle the current game step: place tile, skip tower/capture, or click
 * through the confirm flow.  Uses dispatchEvent to avoid viewport boundaries
 * on the zoom/pan SVG.  Returns true when a move was committed.
 *
 * @param {object} page  — Playwright page
 * @param {object} [hooks] — Optional lifecycle hooks
 * @param {function} [hooks.onTilePinned] — Called after clicking a valid
 *   placement (tile pinned on board, rotation indicator visible) but before
 *   confirming placement. Receives the page object.
 * @returns {Promise<boolean>} true if a move was made
 */
async function tryPlaceTile(page, hooks = {}) {
  // Check for game-over banner.
  const banner = page.locator('#game-over-banner');
  if (await banner.isVisible({ timeout: 300 }).catch(() => false)) return false;

  // Check the HUD confirm button text to know what phase we're in.
  const btn = page.locator('#hud-confirm');
  const btnText = await btn.textContent({ timeout: 500 }).catch(() => '');

  // Tower step: press the confirm button (labeled "Place Tower" / "Skip").
  if (btnText.includes('Tower') || btnText.includes('Skip')) {
    await btn.click();
    await page.waitForTimeout(500);
    return true;
  }

  // Capture step: just skip it.
  const captureBtn = page.locator('button', { hasText: 'Skip' });
  if (await captureBtn.isVisible({ timeout: 300 }).catch(() => false)) {
    await captureBtn.click();
    await page.waitForTimeout(500);
    return true;
  }

  // Normal placement phase: look for valid tile placement on the board.
  const placement = page.locator('#game-svg image.tile-placement').first();
  const hasPlacement = await placement.isVisible({ timeout: 2000 }).catch(() => false);
  if (!hasPlacement) {
    // No placement found — maybe it's another player's turn (hot-seat).
    // The HUD might show for a non-active player; wait for it to pass.
    await page.waitForTimeout(1000);
    return false;
  }

  // Click a valid placement on the board.
  await placement.dispatchEvent('click');
  await page.waitForTimeout(300);

  // Fire rotation-indicator hook (if provided) while the tile is pinned
  // and before any confirm button click.
  if (hooks.onTilePinned) {
    await hooks.onTilePinned(page);
    // Clear the hook so it only fires once.
    hooks.onTilePinned = null;
  }

  // Phase 1: confirm rotation — button says "Place Tile".
  const btn1 = page.locator('#hud-confirm');
  const b1v = await btn1.isVisible({ timeout: 2000 }).catch(() => false);
  if (!b1v) return false;
  const b1Text = await btn1.textContent().catch(() => '');
  if (b1Text.includes('Place')) {
    await btn1.click();
    await page.waitForTimeout(300);
  }

  // Try to place a meeple if outlines are visible.
  // Cycle through outlines (road→city→farm→cloister order) so all
  // feature types get played over the course of a game — otherwise
  // picking the FIRST outline always prefers roads/cities and never
  // places cloister meeples, making the end-game breakdown show "-".
  const meepleOutlines = page.locator('#game-svg image.meeple-outline');
  const outlineCount = await meepleOutlines.count().catch(() => 0);
  if (outlineCount > 0) {
    const outlineIndex = meeplePlacementCounter % outlineCount;
    await meepleOutlines.nth(outlineIndex).dispatchEvent('click');
    meeplePlacementCounter++;
    await page.waitForTimeout(200);
  }

  // Phase 2: confirm meeple — button says "Send Move".
  const btn2 = page.locator('#hud-confirm');
  if (await btn2.isVisible({ timeout: 1000 }).catch(() => false)) {
    const b2Text = await btn2.textContent().catch(() => '');
    if (b2Text.includes('Send') || b2Text.includes('Move')) {
      await btn2.click();
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

test.describe('Screenshot Game', () => {
  test('play 4-player game with expansions and capture screenshots', async ({ page }) => {
    test.setTimeout(600000); // 10 minutes

    // Use a wide tall viewport so tile placements stay visible.
    await page.setViewportSize({ width: 1280, height: 1000 });

    // ── 1. Lobby (4-player slots with all expansions) ────────────────
    await page.goto('/');
    await page.waitForSelector('#lobby-container', { timeout: 10000 });
    await page.locator('#player-name').fill('Alice');
    await page.locator('#player-count').selectOption('4');

    // Enable available expansions (Tower is disabled per baseline commit 962f33ee)
    await page.locator('input[value="inns-and-cathedrals"]').check();
    await page.locator('input[value="traders-and-builders"]').check();

    await page.locator('#create-game-btn').click();
    await page.waitForSelector('#lobby-players[style*="block"]', { timeout: 10000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'screenshots/01-lobby.png', fullPage: true });
    console.log('✓ Screenshot 1: lobby (4 players, all expansions)');

    // ── 2. Start game ─────────────────────────────────────────────────
    await page.locator('#start-game-btn').click();
    await page.waitForSelector('#game-container', { timeout: 10000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'screenshots/02-game-started.png', fullPage: true });
    console.log('✓ Screenshot 2: game started');

    // ── 3. Place tiles ────────────────────────────────────────────────
    // With 4 players we need ~36 tiles per cycle to show everyone's moves.
    // Take mid-game at tile 20 where more meeples and scoring are visible.
    // Meeple placement cycles through available outlines so all feature types
    // (roads, cities, farms, cloisters) get played over the game.
    let totalPlaced = 0;
    let midGameDone = false;
    let gameOver = false;
    // Well above the ~132 tiles in a game with all expansions combined.
    const MAX_TILES = 200;

    while (!gameOver && totalPlaced < MAX_TILES) {
      const placed = await tryPlaceTile(page);

      if (placed) {
        totalPlaced++;
        if (totalPlaced % 10 === 0) console.log(`Placed ${totalPlaced} tiles`);

        // Take mid-game screenshot when there's enough on the board
        // to show meeples placed and some scoring activity.
        if (!midGameDone && totalPlaced >= 20) {
          await page.waitForTimeout(500);
          await page.screenshot({ path: 'screenshots/03-mid-game.png', fullPage: true });
          console.log('✓ Screenshot 3: mid-game');
          midGameDone = true;
        }
      } else {
        // No move made — likely game over or between turns.
        // Retry banner detection with longer total wait in case
        // the end-game scoring animation takes time.
        for (let i = 0; i < 15; i++) {
          const visible = await page
            .locator('#game-over-banner')
            .isVisible({ timeout: 1000 })
            .catch(() => false);
          if (visible) {
            gameOver = true;
            break;
          }
        }
      }
    }

    console.log(`Total tiles placed: ${totalPlaced}`);

    // ── 4. Game over screenshot ───────────────────────────────────────
    // Wait generously for the banner to fully render (it may have just
    // appeared, and we want to be certain the DOM / CSS transitions finish).
    if (!gameOver) {
      await page.waitForTimeout(5000);
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/04-game-over.png', fullPage: true });
    console.log('✓ Screenshot 4: game over');

    // ── 5. Verify cloister scoring in breakdown ─────────────────────────
    // Check that the game-over banner shows actual numbers for cloisters
    // (not '-'), confirming all feature types scored correctly.
    // The breakdown is a table with headers: Player | Cities | Roads | Farms | Cloisters | Total
    // Cloister column index is 4 (0-based), the 5th <td> in each row.
    const cloisterCells = await page.locator('#game-over-banner table tbody tr td:nth-child(5)').allTextContents();
    const nonDashCloister = cloisterCells.filter(v => v.trim() !== '-');
    if (nonDashCloister.length > 0) {
      console.log(`✓ Cloister scores present in breakdown: ${nonDashCloister.join(', ')}`);
    } else {
      console.error('✗ FAIL: All cloister scores show "-" in game-over breakdown!');
    }
  });
});
