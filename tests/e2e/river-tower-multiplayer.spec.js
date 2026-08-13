import { test, expect } from '@playwright/test';

// Keep the generated recording as proof for the PR evidence bundle.
test.use({ video: 'on', screenshot: 'only-on-failure' });

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

async function placeRiverOrLandTile(page, towerEvidencePath) {
  const placement = page.locator('#game-svg image.tile-placement').first();
  if (!(await placement.isVisible({ timeout: 2500 }).catch(() => false))) return false;

  await placement.click({ force: true });
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

test.describe('The River and The Tower multiplayer flow', () => {
  test('plays the River opening and exposes official Tower actions', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.locator('#lobby-container').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#player-name').fill('River Host');
    await page.locator('#player-count').selectOption('2');
    await page.locator('input[value="the-river"]').check();
    await page.locator('input[value="the-tower"]').check();
    await page.locator('#create-game-btn').click();

    await page.waitForSelector('#room-display[style*="block"], #lobby-players[style*="block"]', { timeout: 35000 });
    await page.locator('#start-game-btn').click();
    await page.waitForSelector('#game-container', { timeout: 15000 });
    await page.waitForSelector('#game-svg', { state: 'visible', timeout: 5000 });

    const indicator = page.locator('#game-turn-indicator');
    await expect(indicator).toContainText('River phase');
    await page.screenshot({ path: testInfo.outputPath('river-phase-start.png'), fullPage: true });

    let towerHudSeen = false;
    let riverTurns = 0;
    for (let attempt = 0; attempt < 24 && riverTurns < 12; attempt += 1) {
      const before = await indicator.textContent();
        const result = await placeRiverOrLandTile(page, testInfo.outputPath('tower-actions.png'));
      if (!result) {
        await page.waitForTimeout(500);
        continue;
      }
      riverTurns += 1;

      if (result.towerVisible) {
        towerHudSeen = true;
      }
      await page.waitForTimeout(200);
      if (before?.includes('River phase') && !(await indicator.textContent()).includes('River phase')) break;
    }

    expect(riverTurns).toBeGreaterThan(0);
    expect(towerHudSeen).toBe(true);
    await testInfo.attach('river-phase-screenshot', {
      path: testInfo.outputPath('river-phase-start.png'),
      contentType: 'image/png',
    });
    await testInfo.attach('tower-actions-screenshot', {
      path: testInfo.outputPath('tower-actions.png'),
      contentType: 'image/png',
    });
  });
});
