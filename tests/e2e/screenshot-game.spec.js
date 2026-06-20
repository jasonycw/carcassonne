/**
 * screenshot-game.spec.js — Play a 4-player hot-seat game with all expansions
 * and take screenshots showing beginning, middle, and end of the game
 * with meeples placed and scoring visible.
 *
 * Screenshots are written to screenshots/*.png for the README.
 */
import { test } from '@playwright/test';

/**
 * Handle the current game step: place tile, skip tower/capture, or click
 * through the confirm flow.  Uses dispatchEvent to avoid viewport boundaries
 * on the zoom/pan SVG.  Returns true when a move was committed.
 */
async function tryPlaceTile(page) {
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
  const meepleOutline = page.locator('#game-svg image.meeple-outline').first();
  if (await meepleOutline.isVisible({ timeout: 800 }).catch(() => false)) {
    await meepleOutline.dispatchEvent('click');
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
  test('play 4-player game with expansions and capture all 4 screenshots', async ({ page }) => {
    test.setTimeout(600000); // 10 minutes

    // Use a wide tall viewport so tile placements stay visible.
    await page.setViewportSize({ width: 1280, height: 1000 });

    // ── 1. Lobby (4-player slots with all expansions) ────────────────
    await page.goto('/');
    await page.waitForSelector('#lobby-container', { timeout: 10000 });
    await page.locator('#player-name').fill('Alice');
    await page.locator('#player-count').selectOption('4');

    // Enable all three expansions
    await page.locator('input[value="inns-and-cathedrals"]').check();
    await page.locator('input[value="traders-and-builders"]').check();
    await page.locator('input[value="the-tower"]').check();

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
    let totalPlaced = 0;
    let midGameDone = false;
    let gameOver = false;

    while (!gameOver && totalPlaced < 130) {
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
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/04-game-over.png', fullPage: true });
    console.log('✓ Screenshot 4: game over');
  });
});
