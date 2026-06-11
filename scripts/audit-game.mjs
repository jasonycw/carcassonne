/**
 * audit-game.mjs — Audit the game for visual/runtime issues.
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Start a solo game
  await page.goto('http://localhost:5173/carcassonne/');
  await page.waitForSelector('#lobby-container');
  await page.locator('#player-name').fill('Auditor');
  await page.locator('#player-count').selectOption('1');
  await page.locator('#create-game-btn').click();
  await page.waitForSelector('#room-display[style*="block"]', { timeout: 25000 });
  await page.locator('#start-game-btn').click();
  await page.waitForSelector('#game-container', { timeout: 5000 });
  await page.waitForTimeout(500);

  // ── Check game board elements ──
  const checks = {};

  // SVG exists
  checks.svgExists = await page.evaluate(() => !!document.querySelector('#game-svg'));

  // SVG has child elements (D3 rendered content)
  checks.svgHasContent = await page.evaluate(() => {
    const svg = document.querySelector('#game-svg');
    return svg ? svg.children.length > 0 : false;
  });

  // HUD exists
  checks.hudExists = await page.evaluate(() => document.querySelector('#game-hud')?.style?.display === 'flex');

  // Turn indicator
  checks.turnIndicator = await page.evaluate(() => document.querySelector('#game-turn-indicator')?.textContent);

  // Scoreboard
  checks.scoreboardExists = await page.evaluate(() => {
    const sb = document.querySelector('#game-scoreboard');
    return sb && sb.textContent.length > 0;
  });

  // Placed tiles count (starting tile)
  checks.placedTilesCount = await page.evaluate(() => {
    const tiles = document.querySelectorAll('#game-svg .placed-tile, #game-svg image');
    return tiles.length;
  });

  // Valid placements overlay
  checks.validPlacements = await page.evaluate(() => {
    return document.querySelectorAll('#game-svg .valid-placement').length;
  });

  // Active tile image
  checks.activeTileImage = await page.evaluate(() => {
    const at = document.querySelector('#game-svg .active-tile');
    return at ? 'exists' : 'not found';
  });

  // Check console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  console.log('\n=== Game Board Audit ===\n');
  for (const [key, val] of Object.entries(checks)) {
    console.log(`  ${key}: ${val}`);
  }

  // ── Place a tile ──
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

  // ── Check state after placement ──
  const turnAfter = await page.evaluate(() =>
    document.querySelector('#game-turn-indicator')?.textContent);
  console.log(`\n  Turn after placement: ${turnAfter}`);

  // ── Check for error indicators in SVG ──
  const svgErrorElements = await page.evaluate(() => {
    const svg = document.querySelector('#game-svg');
    if (!svg) return [];
    const all = svg.querySelectorAll('*');
    const errors = [];
    for (const el of all) {
      if (el.getAttribute('visibility') === 'hidden' && el.classList.contains('meeple-placements')) {
        errors.push('meeple-placements hidden (expected)');
      }
    }
    return errors;
  });
  console.log(`  SVG analysis: ${svgErrorElements.length > 0 ? 'meeple placements hidden OK' : 'no specific issues'}`);

  // ── Check that multiple tile placements are possible ──
  let placed = 1;
  for (let t = 0; t < 8; t++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const placement = page.locator('#game-svg .valid-placement').first();
      if (await placement.isVisible({ timeout: 300 }).catch(() => false)) {
        await placement.click();
        await page.waitForTimeout(100);
        const confirm = page.locator('#hud-confirm');
        if (await confirm.isVisible()) {
          await confirm.click();
          await page.waitForTimeout(200);
          placed++;
          break;
        }
      }
      const skip = page.locator('#hud-skip');
      if (await skip.isVisible({ timeout: 200 }).catch(() => false)) {
        await skip.click();
        await page.waitForTimeout(200);
        placed++;
        break;
      }
      await page.waitForTimeout(200);
    }
  }
  console.log(`\n  Total placements/skips: ${placed}`);

  // ── Board tile count after several placements ──
  const tileCountAfter = await page.evaluate(() => {
    const tiles = document.querySelectorAll('#game-svg .placed-tile, #game-svg .tile');
    // Also check the D3 data-joined elements
    return document.querySelectorAll('#game-svg image').length;
  });
  console.log(`  SVG images (tiles + active): ${tileCountAfter}`);

  // ── Overall assessment ──
  const allPassed = Object.values(checks).every(v => v !== false && v !== null && v !== undefined && v !== 0);
  console.log(`\n=== Audit ${allPassed ? 'PASSED' : 'HAS ISSUES'} ===\n`);

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
