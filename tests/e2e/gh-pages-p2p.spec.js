/**
 * LIVE GitHub Pages P2P verification test.
 * Two browser contexts: host creates room, client joins via room code.
 * Both start game, host places tile with meeple, client verifies sync.
 * Monitors console errors throughout on both contexts.
 */
import { test, expect } from '@playwright/test';

const GH_PAGES_URL = 'https://jasonycw.github.io/carcassonne/';

test.describe('GitHub Pages P2P Verification', () => {

  test('host+client P2P full flow on GitHub Pages - zero errors', async ({ browser }) => {
    // ── Host context ───────────────────────────────────────────────────
    const hostErrors = [];
    const hostNetErrors = [];
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    hostPage.on('console', (msg) => {
      if (msg.type() === 'error') hostErrors.push(msg.text());
    });
    hostPage.on('pageerror', (err) => hostErrors.push(err.message));
    hostPage.on('requestfailed', (req) => {
      hostNetErrors.push({ url: req.url(), err: req.failure()?.errorText });
    });

    await hostPage.goto(GH_PAGES_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await hostPage.waitForSelector('#lobby-container', { timeout: 15000 });
    await hostPage.locator('#player-name').fill('HostPlayer');
    await hostPage.locator('#player-count').selectOption('2');
    await hostPage.locator('#create-game-btn').click();

    await hostPage.waitForSelector('#room-code:not(:empty)', { timeout: 60000 });
    await hostPage.waitForSelector('#start-game-btn', { state: 'visible', timeout: 10000 });

    const roomCode = await hostPage.locator('#room-code').textContent();
    console.log(`[GH P2P] Host room: "${roomCode}"`);
    expect(roomCode).toBeTruthy();
    expect(roomCode.trim().length).toBe(4);

    // ── Client context ─────────────────────────────────────────────────
    const clientErrors = [];
    const clientNetErrors = [];
    const clientContext = await browser.newContext();
    const clientPage = await clientContext.newPage();

    clientPage.on('console', (msg) => {
      if (msg.type() === 'error') clientErrors.push(msg.text());
    });
    clientPage.on('pageerror', (err) => clientErrors.push(err.message));
    clientPage.on('requestfailed', (req) => {
      clientNetErrors.push({ url: req.url(), err: req.failure()?.errorText });
    });

    await clientPage.goto(`${GH_PAGES_URL}?room=${roomCode.trim()}`, {
      waitUntil: 'networkidle', timeout: 30000,
    });
    await clientPage.waitForSelector('#lobby-container', { timeout: 15000 });

    // Wait for join confirmation
    const statusLocator = clientPage.locator('#lobby-status');
    await expect(async () => {
      const text = await statusLocator.textContent();
      expect(text).toContain('Joined');
    }).toPass({ timeout: 60000 });

    console.log('[GH P2P] Client joined room');
    await hostPage.waitForTimeout(1000);

    // Check no errors so far
    expect([...hostErrors, ...clientErrors]).toEqual([]);

    // ── Start game ─────────────────────────────────────────────────────
    await hostPage.locator('#start-game-btn').click();

    // Host game view
    await hostPage.waitForSelector('#game-container', { timeout: 15000 });
    await hostPage.waitForSelector('#game-svg', { state: 'visible', timeout: 5000 });
    await expect(hostPage.locator('#game-turn-indicator')).not.toBeEmpty();

    // Client game view
    await clientPage.waitForSelector('#game-container', { timeout: 60000 });
    await clientPage.waitForSelector('#game-svg', { state: 'visible', timeout: 15000 });
    await expect(clientPage.locator('#game-turn-indicator')).not.toBeEmpty();

    console.log('[GH P2P] Both game views loaded');
    await hostPage.waitForTimeout(2000);

    const hostStartingTileCount = await hostPage.evaluate(() =>
      document.querySelectorAll('#game-svg image.placed-tile-image').length
    );
    console.log(`[GH P2P] Host tiles after start: ${hostStartingTileCount}`);
    expect(hostStartingTileCount).toBeGreaterThanOrEqual(1);

    // ── Host places tile ───────────────────────────────────────────────
    const hostPlacement = hostPage.locator('#game-svg image.tile-placement').first();
    await expect(hostPlacement).toBeVisible({ timeout: 10000 });
    await hostPlacement.click({ force: true });
    await hostPage.waitForTimeout(500);

    const hostHudBtn = hostPage.locator('#hud-confirm');
    await expect(hostHudBtn).toBeVisible({ timeout: 3000 });

    // Phase 1: Place Tile
    await hostHudBtn.click();
    await hostPage.waitForTimeout(500);

    // Phase 2: optional meeple
    const hostMeepleOutline = hostPage.locator('#game-svg image.meeple-outline').first();
    const hasOutlines = await hostMeepleOutline.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasOutlines) {
      console.log('[GH P2P] Placing meeple');
      await hostMeepleOutline.click({ force: true });
      await hostPage.waitForTimeout(300);
    }

    // Phase 3: Send Move
    await hostHudBtn.click();
    await hostPage.waitForTimeout(2000);

    const hostFinalTileCount = await hostPage.evaluate(() =>
      document.querySelectorAll('#game-svg image.placed-tile-image').length
    );
    console.log(`[GH P2P] Host tiles after move: ${hostFinalTileCount}`);
    expect(hostFinalTileCount).toBeGreaterThan(hostStartingTileCount);

    // ── Verify client received state update ────────────────────────────
    const clientTileCount = await clientPage.evaluate(() =>
      document.querySelectorAll('#game-svg image.placed-tile-image').length
    );
    console.log(`[GH P2P] Client tiles: ${clientTileCount}`);
    expect(clientTileCount).toBeGreaterThanOrEqual(2);

    // ── Final error check ──────────────────────────────────────────────
    console.log(`[GH P2P] Host errors: ${hostErrors.length}, Client errors: ${clientErrors.length}`);
    console.log(`[GH P2P] Host net errors: ${hostNetErrors.length}, Client net errors: ${clientNetErrors.length}`);

    if (hostErrors.length > 0) console.log('HOST ERRORS:', JSON.stringify(hostErrors, null, 2));
    if (clientErrors.length > 0) console.log('CLIENT ERRORS:', JSON.stringify(clientErrors, null, 2));
    if (hostNetErrors.length > 0) console.log('HOST NET ERRORS:', JSON.stringify(hostNetErrors, null, 2));
    if (clientNetErrors.length > 0) console.log('CLIENT NET ERRORS:', JSON.stringify(clientNetErrors, null, 2));

    expect(hostErrors).toEqual([]);
    expect(clientErrors).toEqual([]);
    expect(hostNetErrors).toEqual([]);
    expect(clientNetErrors).toEqual([]);

    console.log('[GH P2P] P2P verification PASSED');

    await hostContext.close();
    await clientContext.close();
  });
});
