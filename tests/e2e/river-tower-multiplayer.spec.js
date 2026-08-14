import { test, expect } from '@playwright/test';

test.use({ video: 'on', screenshot: 'on' });

async function finishOptionalTowerOrCaptureStep(page) {
  const hud = page.locator('#hud-confirm');
  for (let i = 0; i < 3; i += 1) {
    if (!(await hud.isVisible().catch(() => false))) return;
    const label = (await hud.textContent().catch(() => '')) || '';
    if (label.includes('Skip Tower') || label.includes('Skip Capture')) {
      await hud.click({ force: true });
      await page.waitForTimeout(250);
      return;
    }
    return;
  }
}

async function placeAnyTile(page, towerEvidencePath) {
  const placement = page.locator('#game-svg image.tile-placement').first();
  if (!(await placement.count())) return false;

  // Use dispatchEvent click on the SVG image element to bypass viewport center checks
  await placement.first().dispatchEvent('click');
  await page.waitForTimeout(200);

  const confirm = page.locator('#hud-confirm');
  if (!(await confirm.isVisible().catch(() => false))) return false;
  await confirm.click({ force: true });
  await page.waitForTimeout(200);

  const meeple = page.locator('#game-svg image.meeple-outline').first();
  if (await meeple.isVisible({ timeout: 500 }).catch(() => false)) {
    await meeple.click({ force: true });
    await page.waitForTimeout(100);
  }

  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click({ force: true });
    await page.waitForTimeout(350);
  }

  const towerVisible = await page.locator('#hud-tower-actions').isVisible().catch(() => false);
  if (towerVisible && towerEvidencePath) {
    await page.screenshot({ path: towerEvidencePath, fullPage: true });
  }
  await finishOptionalTowerOrCaptureStep(page);
  return { placed: true, towerVisible };
}

async function setupGame(page, expansions = []) {
  await page.goto('/');
  await page.locator('#lobby-container').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#player-name').fill('Test Host');
  await page.locator('#player-count').selectOption('2');

  // Set expansions
  const allExpansions = ['inns-and-cathedrals', 'traders-and-builders', 'the-river', 'the-tower'];
  for (const exp of allExpansions) {
    const cb = page.locator(`input[value="${exp}"]`);
    if (expansions.includes(exp)) {
      if (!(await cb.isChecked())) await cb.check();
    } else {
      if (await cb.isChecked()) await cb.uncheck();
    }
  }

  await page.locator('#create-game-btn').click();
  await page.waitForSelector('#room-display[style*="block"], #lobby-players[style*="block"]', { timeout: 35000 });
  await page.locator('#start-game-btn').click();
  await page.waitForSelector('#game-container', { timeout: 15000 });
  await page.waitForSelector('#game-svg', { state: 'visible', timeout: 5000 });
}

test.describe('Carcassonne Comprehensive Expansion & Base Game Matrix E2E', () => {
  test('1. Base Game Only (No DLC)', async ({ page }, testInfo) => {
    await setupGame(page, []);
    await page.screenshot({ path: testInfo.outputPath('base-start.png'), fullPage: true });
    let placed = 0;
    for (let i = 0; i < 6; i++) {
      if (await placeAnyTile(page)) placed++;
      await page.waitForTimeout(300);
    }
    expect(placed).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('base-midgame.png'), fullPage: true });
  });

  test('2. Inns & Cathedrals Expansion', async ({ page }, testInfo) => {
    await setupGame(page, ['inns-and-cathedrals']);
    await page.screenshot({ path: testInfo.outputPath('ic-start.png'), fullPage: true });
    let placed = 0;
    for (let i = 0; i < 6; i++) {
      if (await placeAnyTile(page)) placed++;
      await page.waitForTimeout(300);
    }
    expect(placed).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('ic-midgame.png'), fullPage: true });
  });

  test('3. Traders & Builders Expansion', async ({ page }, testInfo) => {
    await setupGame(page, ['traders-and-builders']);
    await page.screenshot({ path: testInfo.outputPath('tb-start.png'), fullPage: true });
    let placed = 0;
    for (let i = 0; i < 6; i++) {
      if (await placeAnyTile(page)) placed++;
      await page.waitForTimeout(300);
    }
    expect(placed).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('tb-midgame.png'), fullPage: true });
  });

  test('4. The River Expansion', async ({ page }, testInfo) => {
    await setupGame(page, ['the-river']);
    const indicator = page.locator('#game-turn-indicator');
    await expect(indicator).toContainText('River phase');
    await page.screenshot({ path: testInfo.outputPath('river-start.png'), fullPage: true });

    let riverTurns = 0;
    for (let i = 0; i < 15; i++) {
      const before = await indicator.textContent();
      const res = await placeAnyTile(page);
      if (!res) {
        await page.waitForTimeout(500);
        continue;
      }
      riverTurns++;
      await page.waitForTimeout(200);
      if (before?.includes('River phase') && !(await indicator.textContent()).includes('River phase')) break;
    }
    expect(riverTurns).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('river-completed.png'), fullPage: true });
  });

  test('5. The Tower Expansion', async ({ page }, testInfo) => {
    await setupGame(page, ['the-tower']);
    await page.screenshot({ path: testInfo.outputPath('tower-start.png'), fullPage: true });
    let placed = 0;
    for (let i = 0; i < 8; i++) {
      if (await placeAnyTile(page, testInfo.outputPath('tower-action.png'))) placed++;
      await page.waitForTimeout(300);
    }
    expect(placed).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('tower-midgame.png'), fullPage: true });
  });

  test('6. All Expansions Combined (River + Tower + I&C + T&B)', async ({ page }, testInfo) => {
    await setupGame(page, ['inns-and-cathedrals', 'traders-and-builders', 'the-river', 'the-tower']);
    const indicator = page.locator('#game-turn-indicator');
    await expect(indicator).toContainText('River phase');
    await page.screenshot({ path: testInfo.outputPath('all-dlc-start.png'), fullPage: true });

    let turns = 0;
    for (let i = 0; i < 15; i++) {
      const res = await placeAnyTile(page, testInfo.outputPath('all-dlc-action.png'));
      if (!res) {
        await page.waitForTimeout(500);
        continue;
      }
      turns++;
      await page.waitForTimeout(200);
    }
    expect(turns).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('all-dlc-midgame.png'), fullPage: true });
  });
});
