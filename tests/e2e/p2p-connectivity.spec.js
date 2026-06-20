/**
 * p2p-connectivity.spec.js — E2E test for actual P2P WebRTC connectivity.
 *
 * Uses two separate browser contexts to simulate two different users:
 *   - Context A (host): creates a room, gets a room code
 *   - Context B (client): joins the room via the room code
 *
 * Flow:
 * 1. Host creates a 2-player game → room code appears
 * 2. Client navigates to ?room=XXXX → joins the lobby
 * 3. Host clicks Start Game → both transition to game view
 * 4. Host places a tile → client receives the state update
 */

import { test, expect } from '@playwright/test';

test.describe('P2P Connectivity', () => {

  test('host and client connect via room code, start game, host makes a move', async ({ browser }) => {
    // ── 1. Context A (host) ──────────────────────────────────────────
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/');
    await hostPage.waitForSelector('#lobby-container', { timeout: 10000 });

    await hostPage.locator('#player-name').fill('Alice');
    await hostPage.locator('#player-count').selectOption('2');
    await hostPage.locator('#create-game-btn').click();

    await hostPage.waitForSelector('#room-code:not(:empty)', { timeout: 60000 });
    await hostPage.waitForSelector('#start-game-btn', { state: 'visible', timeout: 10000 });

    const roomCode = await hostPage.locator('#room-code').textContent();
    console.log(`[P2P Test] Host created room: "${roomCode}"`);
    expect(roomCode).toBeTruthy();
    expect(roomCode.trim().length).toBe(4);

    // ── 2. Context B (client) ────────────────────────────────────────
    const clientContext = await browser.newContext();
    const clientPage = await clientContext.newPage();

    await clientPage.goto(`/?room=${roomCode.trim()}`);
    await clientPage.waitForSelector('#lobby-container', { timeout: 10000 });

    // Wait for "Joined! Waiting for host" status
    const statusLocator = clientPage.locator('#lobby-status');
    await expect(async () => {
      const text = await statusLocator.textContent();
      expect(text).toContain('Joined');
    }).toPass({ timeout: 60000 });

    console.log('[P2P Test] Client joined the room');

    // ── 3. Host starts the game ──────────────────────────────────────
    await hostPage.locator('#start-game-btn').click();

    // Wait for game board on host
    await hostPage.waitForSelector('#game-container', { timeout: 15000 });
    await hostPage.waitForSelector('#game-svg', { state: 'visible', timeout: 5000 });
    await expect(hostPage.locator('#game-turn-indicator')).not.toBeEmpty();

    console.log('[P2P Test] Host game view loaded');

    // ── 4. Client transitions to game view ───────────────────────────
    await clientPage.waitForSelector('#game-container', { timeout: 60000 });
    await clientPage.waitForSelector('#game-svg', { state: 'visible', timeout: 15000 });
    await expect(clientPage.locator('#game-turn-indicator')).not.toBeEmpty();

    console.log('[P2P Test] Client game view loaded');

    // Wait a moment for initial state sync to render tiles
    await hostPage.waitForTimeout(2000);

    // Verify host has the starting tile (placed at 0,0)
    const hostStartingTileCount = await hostPage.evaluate(() =>
      document.querySelectorAll('#game-svg image.placed-tile-image').length
    );
    console.log(`[P2P Test] Host sees ${hostStartingTileCount} tiles (after start)`);
    expect(hostStartingTileCount).toBeGreaterThanOrEqual(1);

    // ── 5. Host places a tile ────────────────────────────────────────
    const hostPlacement = hostPage.locator('#game-svg image.tile-placement').first();
    await expect(hostPlacement).toBeVisible({ timeout: 10000 });
    await hostPlacement.click({ force: true });
    await hostPage.waitForTimeout(500);

    const hostHudBtn = hostPage.locator('#hud-confirm');
    await expect(hostHudBtn).toBeVisible({ timeout: 3000 });

    // Phase 1: confirm rotation
    await hostHudBtn.click();
    await hostPage.waitForTimeout(500);

    // Phase 2: optionally place a meeple
    const hostMeepleOutline = hostPage.locator('#game-svg image.meeple-outline').first();
    const hasOutlines = await hostMeepleOutline.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasOutlines) {
      console.log('[P2P Test] Placing meeple');
      await hostMeepleOutline.click({ force: true });
      await hostPage.waitForTimeout(300);
    }

    // Phase 3: send move
    await hostHudBtn.click();
    await hostPage.waitForTimeout(2000);

    // Verify host's tile count increased
    const hostFinalTileCount = await hostPage.evaluate(() =>
      document.querySelectorAll('#game-svg image.placed-tile-image').length
    );
    console.log(`[P2P Test] Host sees ${hostFinalTileCount} tiles after move`);
    expect(hostFinalTileCount).toBeGreaterThan(hostStartingTileCount);

    // ── 6. Verify client received state update ───────────────────────
    const clientTileCount = await clientPage.evaluate(() =>
      document.querySelectorAll('#game-svg image.placed-tile-image').length
    );
    console.log(`[P2P Test] Client sees ${clientTileCount} tiles on board`);
    expect(clientTileCount).toBeGreaterThanOrEqual(2);

    console.log('[P2P Test] P2P connectivity test PASSED');

    await hostContext.close();
    await clientContext.close();
  });

});
