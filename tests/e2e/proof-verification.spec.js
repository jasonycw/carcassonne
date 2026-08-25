import fs from 'node:fs';
import { test, expect } from '@playwright/test';

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
    ransomCompleted: false,
    turnsPlayed: 0,
    midGameCaptured: false,
    midGameTurn: null,
  };

  await page.screenshot({ path: testInfo.outputPath(`${scenarioName}-start.png`), fullPage: true });

  // Play until natural game over (max 2000 iterations to be safe)
  for (let iteration = 0; iteration < 2000; iteration++) {
    if (iteration % 10 === 0) console.log(`Iteration ${iteration}, turns played: ${audit.turnsPlayed}`);
    if (await isGameOver(page)) {
      console.log('Game over detected!');
      break;
    }

    // Handle tower step. Only place a floor when the selected foundation has
    // an eligible opponent meeple in the official capture range and that
    // owner can afford the 3-point ransom. This makes the proof deterministic
    // without mutating game state behind the rules engine.
    const towerHud = page.locator('#hud-tower-actions');
    if (await towerHud.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log('Tower HUD visible');
      audit.towerActionsTriggered++;
      const floorBtn = page.locator('#hud-tower-floor');
      const closeBtn = page.locator('#hud-tower-close');
      const candidate = await page.evaluate(() => {
        const gs = window.gameView.gamestate;
        if (!gs || gs.step !== 'tower') return null;
        const currentPlayer = gs.currentPlayerIndex;
        const outlines = Array.from(document.querySelectorAll('#game-svg image.tower-outline'));
        for (const outline of outlines) {
          const tileIndex = outline.__data__?.tileIndex;
          if (tileIndex == null) continue;
          const towerTile = gs.placedTiles[tileIndex];
          if (!towerTile) continue;
          const nextHeight = Math.min((towerTile.tower?.height || 0) + 1, 5);
          const hasRansomTarget = gs.placedTiles.some(target => {
            const dx = Math.abs(target.x - towerTile.x);
            const dy = Math.abs(target.y - towerTile.y);
            const inRange = (dx === 0 && dy <= nextHeight) || (dy === 0 && dx <= nextHeight);
            return inRange && (target.meeples || []).some(meeple =>
              meeple.playerIndex !== currentPlayer &&
              !['builder', 'pig', 'shepherd', 'tower'].includes(meeple.meepleType) &&
              (gs.players[meeple.playerIndex]?.points || 0) >= 3
            );
          });
          if (hasRansomTarget) return { tileIndex };
        }
        return null;
      });

      const shouldPlaceFloor = hasTower && !audit.ransomCompleted && candidate;
      if (shouldPlaceFloor && await floorBtn.isEnabled().catch(() => false)) {
        console.log(`Placing tower floor on authentic ransom target ${candidate.tileIndex}`);
        await floorBtn.click();
        await page.evaluate((tileIndex) => {
          window.gameView._handleTowerPiecePlacement(tileIndex);
        }, candidate.tileIndex);
        audit.floorPlaced = true;
        await page.waitForTimeout(500);
        const placedTowerCount = await page.locator('#game-svg image.tower').count();
        expect(placedTowerCount, `Tower floor was placed but no rendered tower image exists in ${scenarioName}`).toBeGreaterThan(0);
        await page.screenshot({ path: testInfo.outputPath(`${scenarioName}-tower-floor.png`), fullPage: true });
        await page.locator('#game-svg').screenshot({ path: testInfo.outputPath(`${scenarioName}-tower-floor-board.png`) });
      } else if (hasTower && audit.ransomCompleted && !audit.towerClosed && await closeBtn.isEnabled().catch(() => false)) {
        const closeTarget = page.locator('#game-svg image.tower-outline').first();
        if (await closeTarget.isVisible().catch(() => false)) {
          console.log('Closing tower via GameView after ransom proof');
          await closeBtn.click();
          await closeTarget.evaluate(el => window.gameView._handleTowerPiecePlacement(el.__data__.tileIndex));
          audit.towerClosed = true;
          await page.screenshot({ path: testInfo.outputPath(`${scenarioName}-tower-close.png`), fullPage: true });
        }
      } else {
        // No legal ransom setup is available on this turn; skip the optional action.
        const confirmBtn = page.locator('#hud-confirm');
        if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click({ force: true });
      }
      await page.waitForTimeout(300);
      continue;
    }

    // Handle a real capture step produced by placeTowerPiece().
    const captureConfirm = page.locator('#hud-confirm');
    const captureText = await captureConfirm.textContent({ timeout: 500 }).catch(() => '');
    if (hasTower && captureText.includes('Capture')) {
      const capturable = page.locator('#game-svg image.meeple[filter*="capture-glow"]').first();
      if (await capturable.isVisible({ timeout: 500 }).catch(() => false)) {
        console.log('Capturing an authentic opponent meeple via GameView');
        await capturable.evaluate(el => {
          const d = el.__data__;
          window.gameView._handleCaptureMeeple(d.tileIndex, d.meepleIndex);
        });
        audit.captureCompleted = true;
        await page.screenshot({ path: testInfo.outputPath(`${scenarioName}-capture.png`), fullPage: true });
      } else {
        await page.evaluate(() => window.gameView._handleSkipCapture());
      }
      await page.waitForTimeout(300);
      continue;
    }

    // Buy back the actual prisoner through the game action. Do not alter
    // points or capturedMeeples directly; wait until the owner has 3 points.
    if (hasTower && audit.captureCompleted && !audit.ransomCompleted) {
      const ransomed = await page.evaluate(() => {
        const gs = window.gameView.gamestate;
        if (!gs?.players) return false;
        for (let cIdx = 0; cIdx < gs.players.length; cIdx++) {
          const capturer = gs.players[cIdx];
          for (let pIdx = 0; pIdx < (capturer.capturedMeeples || []).length; pIdx++) {
            const prisoner = capturer.capturedMeeples[pIdx];
            const owner = gs.players[prisoner.playerIndex];
            if (!owner || owner.points < 3) continue;
            const before = (gs.featureScores || []).length;
            window.gameView._handleBuyBackPrisoner(cIdx, pIdx);
            const newEvents = (gs.featureScores || []).slice(before);
            return newEvents.some(event => event.type === 'tower' &&
              event.players.some(award => award.playerIndex === cIdx && award.points === 3) &&
              event.players.some(award => award.playerIndex === prisoner.playerIndex && award.points === -3));
          }
        }
        return false;
      });
      if (ransomed) {
        console.log('Completed authentic 3-point Tower ransom');
        audit.ransomCompleted = true;
        await page.waitForTimeout(300);
      }
    }

    // Handle placement and confirmation
    const placement = page.locator('#game-svg image.tile-placement').first();
    const isConfirmedPhase = await page.evaluate(() => window.gameView._confirmPhase !== '');
    
    if (!isConfirmedPhase && await placement.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log('Triggering placement via GameView');
      await placement.evaluate(el => {
        const d = el.__data__;
        const rotation = (d.rotations && d.rotations.length > 0) ? d.rotations[0].rotation : 0;
        window.gameView._pendingPlacement = { x: d.x, y: d.y, rotation };
        window.gameView._showActiveTileAt(d.x, d.y, rotation);
      });
      await page.waitForTimeout(500);
    } else if (await page.evaluate(() => {
      const btn = document.querySelector('#hud-confirm');
      return btn && btn.style.display !== 'none' && !btn.disabled && btn.offsetParent !== null;
    })) {
      const btnText = await page.evaluate(() => document.querySelector('#hud-confirm').textContent);
      
      // If we are in the 'confirmed' phase, we can place a meeple before sending the move.
      const isConfirmedPhase = await page.evaluate(() => window.gameView._confirmPhase === 'confirmed');
      if (isConfirmedPhase && Math.random() < 0.8) {
        const meepleOutline = page.locator('#game-svg image.meeple-outline').first();
        if (await meepleOutline.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('Clicking meeple outline to place scoring meeple');
          await meepleOutline.evaluate(el => {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          });
          await page.waitForTimeout(300);
        }
      }

      console.log(`Confirming "${btnText}" via GameView`);
      await page.evaluate(() => window.gameView._confirmPlacement());
      
      if (btnText === 'Send Move' || btnText === 'Skip Tower Action' || btnText === 'Skip Capture' || btnText === 'Place Tile') {
        if (btnText !== 'Place Tile') audit.turnsPlayed++;
      }
      await page.waitForTimeout(500);
    } else {
      // If no placement visible, check if we need to cycle rotations
      const activeTile = page.locator('#game-svg image.active-tile');
      if (await activeTile.isVisible().catch(() => false)) {
        console.log('Rotating active tile via GameView');
        await page.evaluate(() => {
           // In ActiveTile.js, clicking the active tile cycles rotation.
           // We can simulate this by calling _showActiveTileAt with the same coords.
           const pp = window.gameView._pendingPlacement;
           if (pp) {
             window.gameView._showActiveTileAt(pp.x, pp.y, pp.rotation);
           }
        });
        await page.waitForTimeout(500);
      } else {
        await page.waitForTimeout(1000);
      }
    }

    // Capture an authentic mid-game state after substantial progress. This is
    // deliberately separate from the start screenshot and occurs after 30
    // completed moves, when the board contains real gameplay history.
    if (!audit.midGameCaptured && audit.turnsPlayed >= 30 && !(await isGameOver(page))) {
      audit.midGameCaptured = true;
      audit.midGameTurn = audit.turnsPlayed;
      console.log(`Capturing authentic mid-game proof at turn ${audit.turnsPlayed}`);
      await page.waitForTimeout(500);
      await page.screenshot({ path: testInfo.outputPath(`${scenarioName}-mid-game.png`), fullPage: true });
      await page.locator('#game-svg').screenshot({ path: testInfo.outputPath(`${scenarioName}-mid-game-board.png`) });
    }

    // Check River phase completion
    if (hasRiver && !audit.riverCompleted) {
      const indicator = await page.locator('#game-turn-indicator').textContent().catch(() => '');
      if (indicator && !indicator.includes('River phase') && audit.turnsPlayed > 5) {
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
  const towerHeaderCount = await page.locator('#game-over-banner th', { hasText: 'Towers' }).count();
  expect(towerHeaderCount, `Unexpected Towers column in ${scenarioName} final scoreboard`).toBe(hasTower ? 1 : 0);
  expect(audit.midGameCaptured, `Missing authentic mid-game screenshot in ${scenarioName}`).toBe(true);
  if (hasTower) expect(audit.ransomCompleted, `Missing non-zero Tower ransom proof in ${scenarioName}`).toBe(true);
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

test('1. Base Game Only', async ({ page }, testInfo) => {
  test.setTimeout(900000);
  await setupGame(page, []);
  await playTurns(page, testInfo, [], 'base');
});

test('2. The River', async ({ page }, testInfo) => {
  test.setTimeout(900000);
  await setupGame(page, ['the-river']);
  await playTurns(page, testInfo, ['the-river'], 'river');
});

test('3. The Tower', async ({ page }, testInfo) => {
  test.setTimeout(900000);
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

// Dedicated visual proof: stop immediately after a real Tower floor placement so
// the recorded video clearly shows the action and the rendered tower block.
test('6. Tower Floor Placement Demo', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await setupGame(page, ['the-tower']);
  await page.screenshot({ path: testInfo.outputPath('tower-demo-before.png'), fullPage: true });

  for (let iteration = 0; iteration < 120; iteration++) {
    const towerHud = page.locator('#hud-tower-actions');
    if (await towerHud.isVisible({ timeout: 500 }).catch(() => false)) {
      const floorBtn = page.locator('#hud-tower-floor');
      const outline = page.locator('#game-svg image.tower-outline').first();
      if (await floorBtn.isEnabled().catch(() => false) && await outline.isVisible().catch(() => false)) {
        console.log('Tower demo: selecting Place Floor and placing a real tower floor');
        const outlineTileIndex = await outline.evaluate((el) => el.__data__.tileIndex);
        await floorBtn.click();
        await outline.click();
        await page.waitForTimeout(1000);
        const placedHeight = await page.evaluate((tileIndex) => {
          return window.gameView.gamestate.placedTiles[tileIndex]?.tower?.height || 0;
        }, outlineTileIndex);
        expect(placedHeight, 'The clicked foundation must gain exactly one tower floor').toBe(1);
        const towerImage = page.locator('#game-svg image.tower').first();
        const renderedForTile = await page.locator('#game-svg image.tower').evaluateAll((els, tileIndex) => {
          return els.some((el) => el.__data__?.tileIndex === tileIndex);
        }, outlineTileIndex);
        expect(renderedForTile, 'The clicked foundation must render its tower floor').toBe(true);
        const towerBox = await towerImage.boundingBox();
        if (towerBox) {
          // Use the real board zoom gesture so the tower block is unmistakable in video.
          await page.mouse.move(towerBox.x + towerBox.width / 2, towerBox.y + towerBox.height / 2);
          await page.mouse.wheel(0, -900);
          await page.waitForTimeout(1200);
        }
        await page.screenshot({ path: testInfo.outputPath('tower-demo-floor-placed.png'), fullPage: true });
        await page.locator('#game-svg').screenshot({ path: testInfo.outputPath('tower-demo-floor-board.png') });
        // Keep the enlarged rendered result on screen long enough to be unambiguous in video.
        await page.waitForTimeout(5000);
        return;
      }
    }

    const placement = page.locator('#game-svg image.tile-placement').first();
    const isConfirmedPhase = await page.evaluate(() => window.gameView._confirmPhase !== '');
    if (!isConfirmedPhase && await placement.isVisible({ timeout: 500 }).catch(() => false)) {
      await placement.evaluate(el => {
        const d = el.__data__;
        const rotation = d.rotations?.[0]?.rotation || 0;
        window.gameView._pendingPlacement = { x: d.x, y: d.y, rotation };
        window.gameView._showActiveTileAt(d.x, d.y, rotation);
      });
      await page.waitForTimeout(500);
    } else if (await page.evaluate(() => {
      const btn = document.querySelector('#hud-confirm');
      return btn && btn.style.display !== 'none' && !btn.disabled && btn.offsetParent !== null;
    })) {
      await page.evaluate(() => window.gameView._confirmPlacement());
      await page.waitForTimeout(500);
    } else {
      await page.waitForTimeout(500);
    }
  }

  throw new Error('Tower Floor Placement Demo did not reach a visible Tower action');
});
