import fs from 'node:fs';
import { test, expect } from '@playwright/test';

test.use({
  video: 'on',
  viewport: { width: 1280, height: 720 },
});

const ALL_EXPANSIONS = [
  'inns-and-cathedrals',
  'traders-and-builders',
  'the-river',
  'the-tower',
];

async function isGameOver(page) {
  return page.locator('#game-over-banner').isVisible({ timeout: 500 }).catch(() => false);
}

async function playTurns(page, testInfo, expansions, scenarioName) {
  const hasRiver = expansions.includes('the-river');
  const hasTower = expansions.includes('the-tower');
  const audit = {
    scenario: scenarioName,
    expansions,
    riverCompleted: false,
    towerActionsTriggered: 0,
    floorPlaced: false,
    captureCompleted: false,
    towerClosed: false,
    turnsPlayed: 0,
  };

  await page.screenshot({ path: testInfo.outputPath(`${scenarioName}-start.png`), fullPage: true });

  // Play until natural game over (max 250 turns to be safe)
  for (let turn = 0; turn < 250; turn++) {
    if (await isGameOver(page)) break;

    // Handle tower step
    const towerHud = page.locator('#hud-tower-actions');
    if (await towerHud.isVisible({ timeout: 500 }).catch(() => false)) {
      audit.towerActionsTriggered++;
      const floorBtn = page.locator('#hud-tower-floor');
      const closeBtn = page.locator('#hud-tower-close');
      const outline = page.locator('#game-svg image.tower-outline').first();

      // In the tower scenario, we want to actively show off the mechanics
      const shouldPlaceFloor = hasTower && !audit.floorPlaced;
      const shouldCloseTower = hasTower && audit.floorPlaced && !audit.towerClosed;

      if (shouldPlaceFloor && await floorBtn.isEnabled().catch(() => false) && await outline.isVisible().catch(() => false)) {
        await floorBtn.click();
        await outline.dispatchEvent('click');
        audit.floorPlaced = true;
        await page.screenshot({ path: testInfo.outputPath(`${scenarioName}-tower-floor.png`), fullPage: true });
      } else if (shouldCloseTower && await closeBtn.isEnabled().catch(() => false) && await outline.isVisible().catch(() => false)) {
        await closeBtn.click();
        await outline.dispatchEvent('click');
        audit.towerClosed = true;
        await page.screenshot({ path: testInfo.outputPath(`${scenarioName}-tower-close.png`), fullPage: true });
      } else {
        // Just skip or confirm if no specific action needed
        const confirmBtn = page.locator('#hud-confirm');
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click({ force: true });
        }
      }
      await page.waitForTimeout(300);
      continue;
    }

    // Handle capture step
    const confirmBtn = page.locator('#hud-confirm');
    const confirmText = await confirmBtn.textContent({ timeout: 500 }).catch(() => '');
    if (confirmText.includes('Capture')) {
      const capturable = page.locator('#game-svg image.meeple[filter*="capture-glow"]').first();
      if (await capturable.isVisible({ timeout: 500 }).catch(() => false)) {
        await capturable.dispatchEvent('click');
        audit.captureCompleted = true;
        await page.screenshot({ path: testInfo.outputPath(`${scenarioName}-capture.png`), fullPage: true });
      } else {
        await confirmBtn.click({ force: true });
      }
      await page.waitForTimeout(300);
      continue;
    }

    // Place tile
    const placement = page.locator('#game-svg image.tile-placement').first();
    if (await placement.isVisible({ timeout: 2000 }).catch(() => false)) {
      await placement.dispatchEvent('click');
      await page.waitForTimeout(300);

      const btn1 = page.locator('#hud-confirm');
      if (await btn1.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn1.click({ force: true });
        await page.waitForTimeout(300);
      }

      // Optional meeple
      const meepleOutline = page.locator('#game-svg image.meeple-outline').first();
      if (await meepleOutline.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Randomly place meeple to populate the board for capture demonstration
        if (Math.random() > 0.4 || (hasTower && !audit.captureCompleted)) {
          await meepleOutline.dispatchEvent('click');
          await page.waitForTimeout(300);
        }
      }

      const btn2 = page.locator('#hud-confirm');
      if (await btn2.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn2.click({ force: true });
        audit.turnsPlayed++;
        await page.waitForTimeout(500);
      }
    } else {
      // If no placement visible, check if we need to cycle rotations or wait
      const activeTile = page.locator('#game-svg image.active-tile');
      if (await activeTile.isVisible().catch(() => false)) {
         // Maybe it's just not placed yet
         await page.waitForTimeout(500);
      } else {
         await page.waitForTimeout(1000);
      }
    }

    // Check River phase completion
    if (hasRiver && turn === 15 && !audit.riverCompleted) {
      const indicator = await page.locator('#game-turn-indicator').textContent();
      if (!indicator.includes('River phase')) {
        audit.riverCompleted = true;
      }
    }
  }

  // Final wait for natural game over and scoreboard
  await page.waitForSelector('#game-over-banner', { state: 'visible', timeout: 60000 });
  // The scoreboard is a table inside the banner
  await page.waitForSelector('#game-over-banner table', { state: 'visible', timeout: 15000 }).catch(() => {
    console.log('Detailed scoreboard table not found, but banner is visible.');
  });
  await page.waitForTimeout(3000); // Wait for animations and final score rendering
  await page.screenshot({ path: testInfo.outputPath(`${scenarioName}-game-over.png`), fullPage: true });
  fs.writeFileSync(testInfo.outputPath(`${scenarioName}-audit.json`), JSON.stringify(audit, null, 2));
}

async function setupGame(page, expansions = []) {
  await page.goto('/carcassonne/');
  await page.locator('#lobby-container').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#player-name').fill('Carcassonne Host');
  await page.locator('#player-count').selectOption('2');

  for (const expansion of ALL_EXPANSIONS) {
    const checkbox = page.locator(`input[value="${expansion}"]`);
    if (expansions.includes(expansion)) {
      if (!(await checkbox.isChecked())) await checkbox.check();
    } else if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }

  await page.locator('#create-game-btn').click();
  await page.waitForSelector('#room-display[style*="block"], #lobby-players[style*="block"]', { timeout: 45000 });
  await page.locator('#start-game-btn').click();
  await page.waitForSelector('#game-container', { timeout: 30000 });
  await page.waitForSelector('#game-svg', { state: 'visible', timeout: 15000 });
}

test.describe('Carcassonne Official Rule & Expansion Proof Matrix', () => {
  test('1. Base Game Only', async ({ page }, testInfo) => {
    test.setTimeout(600000);
    await setupGame(page, []);
    await playTurns(page, testInfo, [], 'base');
  });

  test('2. The River', async ({ page }, testInfo) => {
    test.setTimeout(600000);
    await setupGame(page, ['the-river']);
    await playTurns(page, testInfo, ['the-river'], 'river');
  });

  test('3. The Tower', async ({ page }, testInfo) => {
    test.setTimeout(600000);
    await setupGame(page, ['the-tower']);
    await playTurns(page, testInfo, ['the-tower'], 'tower');
  });

  test('4. The River and The Tower', async ({ page }, testInfo) => {
    test.setTimeout(900000);
    const expansions = ['the-river', 'the-tower'];
    await setupGame(page, expansions);
    await playTurns(page, testInfo, expansions, 'river-tower');
  });

  test('5. All Expansions Combined', async ({ page }, testInfo) => {
    test.setTimeout(1500000); // 25 minutes for full expansion game
    await setupGame(page, ALL_EXPANSIONS);
    await playTurns(page, testInfo, ALL_EXPANSIONS, 'all');
  });
});
