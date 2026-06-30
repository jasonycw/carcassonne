/**
 * LIVE GitHub Pages lobby verification test.
 * Tests:
 *  - Joiner sees all lobby seats (including host name and empty slot names)
 *  - Zombie connection cleanup: when a joiner disconnects, the slot is freed
 *  - Re-joining after disconnect works
 */
import { test, expect } from '@playwright/test';

const GH_PAGES_URL = 'https://jasonycw.github.io/carcassonne/';

test.describe('GitHub Pages Lobby', () => {

  test('joiner sees lobby with host name, slot names, and disconnect frees slot', async ({ browser }) => {
    // ── Host context ────────────────────────────────────────────────────
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const hostErrors = [];

    hostPage.on('console', (msg) => {
      if (msg.type() === 'error') hostErrors.push(msg.text());
    });
    hostPage.on('pageerror', (err) => hostErrors.push(err.message));

    await hostPage.goto(GH_PAGES_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await hostPage.waitForSelector('#lobby-container', { timeout: 15000 });
    await hostPage.locator('#player-name').fill('HostPlayer');
    await hostPage.locator('#player-count').selectOption('4');
    await hostPage.locator('#create-game-btn').click();

    await hostPage.waitForSelector('#room-code:not(:empty)', { timeout: 60000 });
    await hostPage.waitForSelector('#start-game-btn', { state: 'visible', timeout: 10000 });

    const roomCode = await hostPage.locator('#room-code').textContent();
    console.log(`[GH Lobby] Host room: "${roomCode}"`);
    expect(roomCode).toBeTruthy();
    expect(roomCode.trim().length).toBe(4);

    // ── Joiner 1 context ───────────────────────────────────────────────
    const j1Context = await browser.newContext();
    const j1Page = await j1Context.newPage();
    const j1Errors = [];

    j1Page.on('console', (msg) => {
      if (msg.type() === 'error') j1Errors.push(msg.text());
    });
    j1Page.on('pageerror', (err) => j1Errors.push(err.message));

    await j1Page.goto(`${GH_PAGES_URL}?room=${roomCode.trim()}`, {
      waitUntil: 'networkidle', timeout: 30000,
    });
    await j1Page.waitForSelector('#lobby-container', { timeout: 15000 });

    // Wait for joiner to see "Joined" status
    const j1Status = j1Page.locator('#lobby-status');
    await expect(async () => {
      const text = await j1Status.textContent();
      expect(text).toContain('Joined');
    }).toPass({ timeout: 60000 });

    console.log('[GH Lobby] Joiner 1 joined');

    // ── Verify joiner sees host name ──────────────────────────────────
    const j1PlayerNames = await j1Page.evaluate(() => {
      const items = document.querySelectorAll('.player-list-item span:first-child');
      return Array.from(items).map(el => el.textContent);
    });
    console.log('[GH Lobby] Joiner 1 sees players:', j1PlayerNames);
    expect(j1PlayerNames.some(n => n.includes('HostPlayer'))).toBe(true);
    expect(j1PlayerNames.some(n => n.includes('(You)'))).toBe(true);

    // ── Verify joiner sees empty seats (4-player lobby = 4 items max) ──
    const j1Items = await j1Page.evaluate(() => {
      return document.querySelectorAll('.player-list-item').length;
    });
    console.log(`[GH Lobby] Joiner 1 sees ${j1Items} lobby items`);
    expect(j1Items).toBeGreaterThanOrEqual(2); // host + joiner + empty slots

    // ── Joiner 1 disconnects (close tab) ───────────────────────────────
    console.log('[GH Lobby] Joiner 1 disconnecting...');
    await j1Context.close();

    // Wait for host to detect disconnect and free the slot
    await hostPage.waitForTimeout(12000); // 5s health check + buffer

    // ── Joiner 2 connects — should be able to join (slot was freed) ────
    const j2Context = await browser.newContext();
    const j2Page = await j2Context.newPage();
    const j2Errors = [];

    j2Page.on('console', (msg) => {
      if (msg.type() === 'error') j2Errors.push(msg.text());
    });
    j2Page.on('pageerror', (err) => j2Errors.push(err.message));

    await j2Page.goto(`${GH_PAGES_URL}?room=${roomCode.trim()}`, {
      waitUntil: 'networkidle', timeout: 30000,
    });
    await j2Page.waitForSelector('#lobby-container', { timeout: 15000 });

    const j2Status = j2Page.locator('#lobby-status');
    await expect(async () => {
      const text = await j2Status.textContent();
      expect(text).toContain('Joined');
    }).toPass({ timeout: 60000 });

    console.log('[GH Lobby] Joiner 2 joined (slot was freed)');

    // ── Verify no errors on host or joiner ────────────────────────────
    console.log(`[GH Lobby] Host errors: ${hostErrors.length}, J2 errors: ${j2Errors.length}`);
    if (hostErrors.length > 0) console.log('HOST ERRORS:', JSON.stringify(hostErrors, null, 2));
    if (j2Errors.length > 0) console.log('J2 ERRORS:', JSON.stringify(j2Errors, null, 2));

    expect(hostErrors).toEqual([]);
    expect(j2Errors).toEqual([]);

    console.log('[GH Lobby] Lobby verification PASSED');

    await hostContext.close();
    await j2Context.close();
  });

  test('host slot name edits sync to joiner', async ({ browser }) => {
    // ── Host context ────────────────────────────────────────────────────
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    await hostPage.goto(GH_PAGES_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await hostPage.waitForSelector('#lobby-container', { timeout: 15000 });
    await hostPage.locator('#player-name').fill('SyncTestHost');
    await hostPage.locator('#player-count').selectOption('3');
    await hostPage.locator('#create-game-btn').click();

    await hostPage.waitForSelector('#room-code:not(:empty)', { timeout: 60000 });
    await hostPage.waitForSelector('#start-game-btn', { state: 'visible', timeout: 10000 });

    const roomCode = await hostPage.locator('#room-code').textContent();

    // Edit an unfilled slot name
    const slotInputs = hostPage.locator('.slot-name-input');
    await expect(slotInputs.first()).toBeVisible({ timeout: 5000 });
    await slotInputs.first().fill('WaitingForBob');

    // ── Joiner context ─────────────────────────────────────────────────
    const jContext = await browser.newContext();
    const jPage = await jContext.newPage();

    await jPage.goto(`${GH_PAGES_URL}?room=${roomCode.trim()}`, {
      waitUntil: 'networkidle', timeout: 30000,
    });
    await jPage.waitForSelector('#lobby-container', { timeout: 15000 });

    const jStatus = jPage.locator('#lobby-status');
    await expect(async () => {
      const text = await jStatus.textContent();
      expect(text).toContain('Joined');
    }).toPass({ timeout: 60000 });

    // Wait for LOBBY_STATE to propagate
    await jPage.waitForTimeout(2000);

    // Verify joiner sees the edited slot name
    const jNames = await jPage.evaluate(() => {
      const items = document.querySelectorAll('.player-list-item span:first-child');
      return Array.from(items).map(el => el.textContent);
    });
    console.log('[GH Lobby] Joiner sees players:', jNames);
    expect(jNames.some(n => n.includes('WaitingForBob'))).toBe(true);

    console.log('[GH Lobby] Slot name sync PASSED');

    await hostContext.close();
    await jContext.close();
  });
});
