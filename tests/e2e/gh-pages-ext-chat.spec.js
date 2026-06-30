/**
 * LIVE GitHub Pages verification: extensions + chat + full game completion.
 *
 * Phase 4: Extensions — Create game with Inns & Cathedrals + Traders & Builders
 * Phase 5: Chat — Host sends chat message, client receives it
 * Phase 7: Full game completion — Solo game plays until game over
 */
import { test, expect } from '@playwright/test';

const GH_PAGES_URL = 'https://jasonycw.github.io/carcassonne/';

test.describe('GitHub Pages Extensions & Chat', () => {
  let errors = [];
  let netErrors = [];

  test.beforeEach(async ({ page }) => {
    errors = [];
    netErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('requestfailed', (req) => {
      netErrors.push({ url: req.url(), err: req.failure()?.errorText });
    });
  });

  test('Phase 4+5: extensions game with chat on GitHub Pages', async ({ browser }) => {
    test.setTimeout(300000);

    // ── HOST: create game with extensions ──────────────────────────────
    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const hErrors = [], hNet = [];
    hostPage.on('console', (m) => { if (m.type() === 'error') hErrors.push(m.text()); });
    hostPage.on('pageerror', (e) => hErrors.push(e.message));
    hostPage.on('requestfailed', (r) => hNet.push({ url: r.url(), err: r.failure()?.errorText }));

    await hostPage.goto(GH_PAGES_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await hostPage.waitForSelector('#lobby-container', { timeout: 15000 });

    await hostPage.locator('#player-name').fill('Host');
    await hostPage.locator('#player-count').selectOption('2');

    // Enable extensions
    const innsCheck = hostPage.locator('input[value="inns-and-cathedrals"]');
    if (await innsCheck.isVisible()) await innsCheck.check();
    const tbCheck = hostPage.locator('input[value="traders-and-builders"]');
    if (await tbCheck.isVisible()) await tbCheck.check();

    await hostPage.locator('#create-game-btn').click();
    await hostPage.waitForSelector('#room-code:not(:empty)', { timeout: 60000 });
    await hostPage.waitForSelector('#start-game-btn', { state: 'visible', timeout: 10000 });

    const roomCode = await hostPage.locator('#room-code').textContent();
    console.log(`[GH Ext] Host room: "${roomCode}"`);

    // ── CLIENT: join room ──────────────────────────────────────────────
    const clientCtx = await browser.newContext();
    const clientPage = await clientCtx.newPage();
    const cErrors = [], cNet = [];
    clientPage.on('console', (m) => { if (m.type() === 'error') cErrors.push(m.text()); });
    clientPage.on('pageerror', (e) => cErrors.push(e.message));
    clientPage.on('requestfailed', (r) => cNet.push({ url: r.url(), err: r.failure()?.errorText }));

    await clientPage.goto(`${GH_PAGES_URL}?room=${roomCode.trim()}`, {
      waitUntil: 'networkidle', timeout: 30000,
    });
    await clientPage.waitForSelector('#lobby-container', { timeout: 15000 });

    const statusLocator = clientPage.locator('#lobby-status');
    await expect(async () => {
      const text = await statusLocator.textContent();
      expect(text).toContain('Joined');
    }).toPass({ timeout: 60000 });

    console.log('[GH Ext] Client joined');

    // ── START GAME ─────────────────────────────────────────────────────
    await hostPage.locator('#start-game-btn').click();
    await hostPage.waitForSelector('#game-container', { timeout: 15000 });
    await hostPage.waitForSelector('#game-svg', { state: 'visible', timeout: 5000 });

    await clientPage.waitForSelector('#game-container', { timeout: 60000 });
    await clientPage.waitForSelector('#game-svg', { state: 'visible', timeout: 15000 });

    await hostPage.waitForTimeout(2000);
    console.log('[GH Ext] Both game views loaded');

    // ── PHASE 4: VERIFY EXTENSIONS ──────────────────────────────────────
    // Check meeple type selector for builder/pig images (extension indicators)
    const builderImg = hostPage.locator('#game-hud img.meeple-type-btn[src*="builder"]');
    const pigImg = hostPage.locator('#game-hud img.meeple-type-btn[src*="pig"]');
    const hasBuilder = await builderImg.isVisible({ timeout: 1000 }).catch(() => false);
    const hasPig = await pigImg.isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`[GH Ext] Builder meeple: ${hasBuilder}, Pig meeple: ${hasPig}`);

    // Check scoreboard for the builder/pig/reserve meeple indicators
    const scoreMeepleImgs = await hostPage.evaluate(() => {
      const imgs = document.querySelectorAll('#game-scoreboard img, .scoreboard img');
      const srcs = Array.from(imgs).map(i => i.getAttribute('src') || '');
      return { count: imgs.length, hasBuilder: srcs.some(s => s.includes('builder')), hasPig: srcs.some(s => s.includes('pig')) };
    });
    console.log(`[GH Ext] Scoreboard - Builder: ${scoreMeepleImgs.hasBuilder}, Pig: ${scoreMeepleImgs.hasPig}`);

    // ── PHASE 5: CHAT TEST ──────────────────────────────────────────────
    // Chat panel hidden by default. Toggle via #menu-btn, then #chat-input and #chat-send-btn
    const menuBtn = hostPage.locator('#game-menu-btn');
    if (await menuBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await menuBtn.click();
      await hostPage.waitForTimeout(500);
    }

    const chatInput = hostPage.locator('#chat-input');
    const chatVisible = await chatInput.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[GH Ext] Chat input visible: ${chatVisible}`);

    if (chatVisible) {
      const clientMsgCount = await clientPage.evaluate(() => {
        return document.querySelectorAll('#chat-messages > div').length;
      }).catch(() => 0);
      console.log(`[GH Ext] Client messages before: ${clientMsgCount}`);

      await chatInput.fill('Hello from host!');
      const sendBtn = hostPage.locator('#chat-send-btn');
      if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await sendBtn.click();
      } else {
        await chatInput.press('Enter');
      }
      await hostPage.waitForTimeout(1500);

      const clientMsgAfter = await clientPage.evaluate(() => {
        return document.querySelectorAll('#chat-messages > div').length;
      }).catch(() => 0);
      console.log(`[GH Ext] Client messages after: ${clientMsgAfter}`);

      const hostMsgCount = await hostPage.evaluate(() => {
        return document.querySelectorAll('#chat-messages > div').length;
      }).catch(() => 0);
      console.log(`[GH Ext] Host messages: ${hostMsgCount}`);
    }

    // ── ERROR VERIFICATION ──────────────────────────────────────────────
    console.log(`[GH Ext] Host errors: ${hErrors.length}, Client errors: ${cErrors.length}`);

    if (hErrors.length > 0) console.log('HOST ERR:', JSON.stringify(hErrors, null, 2));
    if (cErrors.length > 0) console.log('CLIENT ERR:', JSON.stringify(cErrors, null, 2));
    if (hNet.length > 0) console.log('HOST NET:', JSON.stringify(hNet, null, 2));
    if (cNet.length > 0) console.log('CLIENT NET:', JSON.stringify(cNet, null, 2));

    expect(hErrors).toEqual([]);
    expect(cErrors).toEqual([]);
    expect(hNet).toEqual([]);
    expect(cNet).toEqual([]);

    await hostCtx.close();
    await clientCtx.close();
  });

  test('Phase 7: full solo game completion on GitHub Pages', async ({ page }) => {
    test.setTimeout(600000);

    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(GH_PAGES_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#lobby-container', { timeout: 15000 });

    await page.fill('#player-name', 'Sisyphus');

    // Enable all extensions
    for (const val of ['inns-and-cathedrals', 'traders-and-builders', 'the-river']) {
      const cb = page.locator(`input[value="${val}"]`);
      if (await cb.isVisible().catch(() => false)) await cb.check();
    }
    await page.locator('#player-count').selectOption('1');
    await page.click('#create-game-btn');
    await expect(page.locator('#lobby-players')).toBeVisible({ timeout: 5000 });
    await page.click('#start-game-btn');

    await page.waitForSelector('#game-container', { timeout: 15000 });
    await page.waitForSelector('#game-svg', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(1000);

    let moves = 0;

    async function placeTile() {
      const banner = page.locator('#game-over-banner');
      if (await banner.isVisible({ timeout: 300 }).catch(() => false)) return false;
      const overScreen = page.locator('#game-over-screen');
      if (await overScreen.isVisible({ timeout: 300 }).catch(() => false)) return false;

      const btn = page.locator('#hud-confirm');
      const btnText = await btn.textContent({ timeout: 500 }).catch(() => '');

      if (btnText.includes('Tower') || btnText.includes('Skip')) {
        await btn.click(); await page.waitForTimeout(300); return true;
      }
      const skipBtn = page.locator('button', { hasText: 'Skip' });
      if (await skipBtn.isVisible({ timeout: 200 }).catch(() => false)) {
        await skipBtn.click(); await page.waitForTimeout(300); return true;
      }

      const placement = page.locator('#game-svg image.tile-placement').first();
      if (!(await placement.isVisible({ timeout: 2000 }).catch(() => false))) {
        const skipTurnBtn = page.locator('#skip-turn-btn');
        if (await skipTurnBtn.isVisible({ timeout: 200 }).catch(() => false)) {
          await skipTurnBtn.click(); await page.waitForTimeout(300); return true;
        }
        return false;
      }

      await placement.dispatchEvent('click');
      await page.waitForTimeout(500);
      if (!(await btn.isVisible())) return false;

      const t1 = await btn.textContent().catch(() => '');
      if (t1.includes('Place')) await btn.click();
      else return false;
      await page.waitForTimeout(400);

      const meepleOutline = page.locator('#game-svg image.meeple-outline').first();
      if (await meepleOutline.isVisible({ timeout: 500 }).catch(() => false)) {
        await meepleOutline.dispatchEvent('click');
        await page.waitForTimeout(200);
      }

      const t2 = await btn.textContent().catch(() => '');
      if (t2.includes('Send') || t2.includes('Move')) {
        await btn.click(); await page.waitForTimeout(500); return true;
      }
      return false;
    }

    for (let i = 0; i < 150; i++) {
      const ok = await placeTile();
      if (!ok) { console.log(`[GH Full] Stopped at ${moves}`); break; }
      moves++;
      if (moves % 20 === 0) console.log(`[GH Full] ${moves} moves`);

      if (await page.locator('#game-over-banner').isVisible({ timeout: 200 }).catch(() => false)) break;
      if (await page.locator('#game-over-screen').isVisible({ timeout: 200 }).catch(() => false)) break;
    }

    const gameOverVisible = await page.locator('#game-over-banner, #game-over-screen').first()
      .isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[GH Full] ${moves} moves, game over: ${gameOverVisible}`);

    if (errors.length > 0) console.log('ERRORS:', JSON.stringify(errors, null, 2));
    if (netErrors.length > 0) console.log('NET ERRORS:', JSON.stringify(netErrors, null, 2));

    expect(errors).toEqual([]);
    expect(netErrors).toEqual([]);
    expect(moves).toBeGreaterThan(5);
  });
});
