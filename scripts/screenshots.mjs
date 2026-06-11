/**
 * screenshots.mjs — Take screenshots of the game at key stages.
 *
 * Usage: node scripts/screenshots.mjs
 *
 * Requires: playwright (npm install @playwright/test)
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:5173/carcassonne/';
const OUT = 'screenshots';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // ── 1. Lobby ────────────────────────────────────────────────────────
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForSelector('#lobby-container');
  await page.screenshot({ path: `${OUT}/01-lobby.png` });
  console.log('1/5 Lobby');

  // ── 2. Create solo game ─────────────────────────────────────────────
  await page.locator('#player-name').fill('Tester');
  await page.locator('#player-count').selectOption('1');
  await page.locator('#create-game-btn').click();
  await page.waitForSelector('#room-display[style*="block"]', { timeout: 25000 });
  await page.screenshot({ path: `${OUT}/02-room-created.png` });
  console.log('2/5 Room created');

  // ── 3. Game board ──────────────────────────────────────────────────
  await page.locator('#start-game-btn').click();
  await page.waitForSelector('#game-container', { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03-game-board.png` });
  console.log('3/5 Game board');

  // ── 4. Place a tile ────────────────────────────────────────────────
  for (let attempt = 0; attempt < 30; attempt++) {
    const placement = page.locator('#game-svg .valid-placement').first();
    if (await placement.isVisible({ timeout: 500 }).catch(() => false)) {
      await placement.click();
      await page.waitForTimeout(200);
      const confirm = page.locator('#hud-confirm');
      if (await confirm.isVisible()) {
        await confirm.click();
        await page.waitForTimeout(500);
        break;
      }
    }
    const skip = page.locator('#hud-skip');
    if (await skip.isVisible({ timeout: 300 }).catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(500);
      break;
    }
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${OUT}/04-after-placement.png` });
  console.log('4/5 After tile placement');

  // ── 5. Multiple tiles placed ────────────────────────────────────────
  for (let t = 0; t < 5; t++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const placement = page.locator('#game-svg .valid-placement').first();
      if (await placement.isVisible({ timeout: 500 }).catch(() => false)) {
        await placement.click();
        await page.waitForTimeout(200);
        const confirm = page.locator('#hud-confirm');
        if (await confirm.isVisible()) {
          await confirm.click();
          await page.waitForTimeout(300);
          break;
        }
      }
      const skip = page.locator('#hud-skip');
      if (await skip.isVisible({ timeout: 300 }).catch(() => false)) {
        await skip.click();
        await page.waitForTimeout(300);
        break;
      }
      await page.waitForTimeout(300);
    }
  }
  await page.screenshot({ path: `${OUT}/05-multiple-tiles.png` });
  console.log('5/5 Multiple tiles placed');

  await browser.close();
}

main().catch(console.error);
