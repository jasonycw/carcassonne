/**
 * screenshot-game.spec.js — Play a P2P game on the live GitHub Pages site
 * with expansions (Inns & Cathedrals, Traders & Builders) and take
 * screenshots showing beginning, middle, and end of the game.
 *
 * Uses two browser contexts (host + remote client) plus hot-seat local
 * players for a total of 4 players in the lobby. The lobby screenshot
 * shows all 4 with proper naming:
 *   - Host (local)
 *   - Remote player 1 (connects via P2P)
 *   - Local player 1 (hot-seat on host)
 *   - Local player 2 (hot-seat on host)
 *
 * Screenshots are written to screenshots/*.png for the README.
 *
 * Screenshots captured:
 *  01-lobby.png              — Lobby with 4 players, all expansions
 *  02-game-started.png        — Board right after game start (host view)
 *  03-mid-game.png            — Mid-game with rotation indicator on pinned tile
 *  04-game-over.png           — Final board with game-over banner and scores
 */

let meeplePlacementCounter = 0;

import { test, expect } from '@playwright/test';

const GH_PAGES_URL = 'https://jasonycw.github.io/carcassonne/';

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
    await page.waitForTimeout(1000);
    return false;
  }

  // Click a valid placement on the board.
  await placement.dispatchEvent('click');
  await page.waitForTimeout(300);

  // Fire rotation-indicator hook (if provided) while the tile is pinned.
  if (hooks.onTilePinned) {
    await hooks.onTilePinned(page);
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

test.describe('Screenshot Game (P2P on GitHub Pages)', () => {
  test('play 4-player game with expansions and capture screenshots', async ({ browser }) => {
    test.setTimeout(600000); // 10 minutes

    const hostErrors = [];
    const clientErrors = [];

    // ── Host context ─────────────────────────────────────────────────────
    const hostContext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const hostPage = await hostContext.newPage();
    hostPage.on('console', (msg) => { if (msg.type() === 'error') hostErrors.push(msg.text()); });
    hostPage.on('pageerror', (err) => hostErrors.push(err.message));

    await hostPage.goto(GH_PAGES_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await hostPage.waitForSelector('#lobby-container', { timeout: 15000 });

    // ── Client context (Remote player 1) ─────────────────────────────────
    const clientContext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const clientPage = await clientContext.newPage();
    clientPage.on('console', (msg) => { if (msg.type() === 'error') clientErrors.push(msg.text()); });
    clientPage.on('pageerror', (err) => clientErrors.push(err.message));

    // ── 1. Lobby (4 players with expansions) ─────────────────────────────
    // Host setup: 4-player game with all expansions
    await hostPage.locator('#player-name').fill('Host');
    await hostPage.locator('#player-count').selectOption('4');

    // Enable available expansions
    await hostPage.locator('input[value="inns-and-cathedrals"]').check();
    await hostPage.locator('input[value="traders-and-builders"]').check();

    await hostPage.locator('#create-game-btn').click();

    await hostPage.waitForSelector('#room-code:not(:empty)', { timeout: 60000 });
    await hostPage.waitForSelector('#start-game-btn', { state: 'visible', timeout: 10000 });

    const roomCode = (await hostPage.locator('#room-code').textContent()).trim();
    console.log(`[Screenshot] Host room: "${roomCode}"`);

    // Name the local hot-seat players before client joins
    // Player 2 slot will be taken by Remote player 1
    // Player 3 = Local player 1
    // Player 4 = Local player 2
    const slotInputs = await hostPage.locator('#lobby-players input[type="text"]').all();
    if (slotInputs.length >= 3) {
      await slotInputs[1].fill('Local player 1');
      await slotInputs[2].fill('Local player 2');
    }

    // Remote player 1 joins via room code
    await clientPage.goto(`${GH_PAGES_URL}?room=${roomCode}`, {
      waitUntil: 'networkidle', timeout: 30000,
    });
    await clientPage.waitForSelector('#lobby-container', { timeout: 15000 });

    // Wait for join confirmation
    const statusLocator = clientPage.locator('#lobby-status');
    await expect(async () => {
      const text = await statusLocator.textContent();
      expect(text).toContain('Joined');
    }).toPass({ timeout: 60000 });
    console.log('[Screenshot] Remote player 1 joined');

    await hostPage.waitForTimeout(1000);

    // Verify no errors so far
    expect([...hostErrors, ...clientErrors]).toEqual([]);

    // Take lobby screenshot (host view, all 4 players visible)
    await hostPage.screenshot({ path: 'screenshots/01-lobby.png', fullPage: true });
    console.log('✓ Screenshot 1: lobby (Host + Remote player 1 + Local players 1-2, expansions)');

    // ── 2. Start game ───────────────────────────────────────────────────
    await hostPage.locator('#start-game-btn').click();
    await hostPage.waitForSelector('#game-container', { timeout: 15000 });
    await hostPage.waitForSelector('#game-svg', { state: 'visible', timeout: 5000 });
    await expect(hostPage.locator('#game-turn-indicator')).not.toBeEmpty();

    // Wait for client game view (P2P sync)
    await clientPage.waitForSelector('#game-container', { timeout: 60000 });
    await clientPage.waitForSelector('#game-svg', { state: 'visible', timeout: 15000 });
    await expect(clientPage.locator('#game-turn-indicator')).not.toBeEmpty();
    console.log('[Screenshot] Both game views loaded');

    await hostPage.waitForTimeout(1000);
    await hostPage.screenshot({ path: 'screenshots/02-game-started.png', fullPage: true });
    console.log('✓ Screenshot 2: game started');

    // ── 3. Place tiles ────────────────────────────────────────────────────
    // Play through the full game (host places tiles for all players).
    // The host plays for their own turns AND hot-seat local players.
    // The remote client plays their own turns via P2P state sync.
    // tryPlaceTile returns false when it's not the active player's turn,
    // so the loop naturally cycles between all 4 players.
    let totalPlaced = 0;
    let midGameDone = false;
    let gameOver = false;
    const MAX_TILES = 200;

    while (!gameOver && totalPlaced < MAX_TILES) {
      const placed = await tryPlaceTile(hostPage, {
        onTilePinned: midGameDone ? null : async (p) => {
          if (totalPlaced < 18) return;
          await p.waitForTimeout(1000);
          const hasIndicator = await p.evaluate(() => {
            const el = document.querySelector('#game-svg use.active-tile-rotation-indicator');
            if (!el) return false;
            const opacity = parseFloat(el.getAttribute('opacity') || '0');
            return opacity > 0;
          }).catch(() => false);
          if (!hasIndicator) return;
          await p.screenshot({ path: 'screenshots/03-mid-game.png', fullPage: true });
          console.log('✓ Screenshot 3: mid-game (with rotation indicator)');
          midGameDone = true;
        },
      });

      if (placed) {
        totalPlaced++;
        if (totalPlaced % 10 === 0) console.log(`Placed ${totalPlaced} tiles`);
      } else {
        for (let i = 0; i < 15; i++) {
          const visible = await hostPage
            .locator('#game-over-banner')
            .isVisible({ timeout: 1000 })
            .catch(() => false);
          if (visible) { gameOver = true; break; }
        }
      }
    }

    console.log(`Total tiles placed: ${totalPlaced}`);

    // ── 4. Game over screenshot ─────────────────────────────────────────
    if (!gameOver) await hostPage.waitForTimeout(5000);
    await hostPage.waitForTimeout(2000);
    await hostPage.screenshot({ path: 'screenshots/04-game-over.png', fullPage: true });
    console.log('✓ Screenshot 4: game over');

    // ── 5. Verify cloister scoring in breakdown ─────────────────────────
    const cloisterCells = await hostPage.locator('#game-over-banner table tbody tr td:nth-child(5)').allTextContents();
    const nonDashCloister = cloisterCells.filter(v => v.trim() !== '-');
    if (nonDashCloister.length > 0) {
      console.log(`✓ Cloister scores present in breakdown: ${nonDashCloister.join(', ')}`);
    } else {
      console.error('✗ FAIL: All cloister scores show "-" in game-over breakdown!');
    }

    // ── 6. Verify zero errors on both sides ─────────────────────────────
    console.log(`[Screenshot] Host errors: ${hostErrors.length}, Client errors: ${clientErrors.length}`);
    expect(hostErrors).toEqual([]);
    expect(clientErrors).toEqual([]);

    await hostContext.close();
    await clientContext.close();
  });
});
