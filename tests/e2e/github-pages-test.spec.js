/**
 * End-to-end test for GitHub Pages deployment.
 * Tests the game loaded from a subpath URL like /carcassonne/
 */

import { test, expect } from '@playwright/test';

test.describe('GitHub Pages Deployment Test', () => {
  // Test from the /carcassonne/ subpath
  const baseURL = 'http://localhost:5173/carcassonne/';

  test('loads without errors', async ({ page }) => {
    await page.goto(baseURL);
    
    // Check that the lobby is visible
    const lobbyContainer = page.locator('#lobby-container');
    await expect(lobbyContainer).toBeVisible();
    
    // Check that the title appears
    const title = page.locator('text=Carcassonne');
    await expect(title).toBeVisible();
  });

  test('background image loads from subpath', async ({ page }) => {
    await page.goto(baseURL);
    
    const lobbyContainer = page.locator('#lobby-container');
    const bgImage = await lobbyContainer.evaluate(el => 
      window.getComputedStyle(el).backgroundImage
    );
    
    // Should contain the bg.jpg path
    expect(bgImage).toContain('bg.jpg');
  });

  test('create game button works', async ({ page }) => {
    await page.goto(baseURL);
    
    // Enter player name
    await page.fill('#player-name', 'TestPlayer');
    
    // Click create game
    await page.click('#create-game-btn');
    
    // Wait for room code to appear
    const roomCode = page.locator('#room-code');
    await expect(roomCode).toBeVisible({ timeout: 5000 });
    
    // Room code should be 4 characters
    const codeText = await roomCode.textContent();
    expect(codeText).toMatch(/^[A-Z0-9]{4}$/);
  });

  test('solo game starts and shows board', async ({ page }) => {
    await page.goto(baseURL);
    
    // Enter player name
    await page.fill('#player-name', 'SoloPlayer');
    
    // Select solo player
    await page.selectOption('#player-count', '1');
    
    // Click create game
    await page.click('#create-game-btn');
    
    // Wait for room code
    await expect(page.locator('#room-code')).toBeVisible({ timeout: 5000 });
    
    // Click start game button
    await page.click('#start-game-btn');
    
    // Wait for game board to appear
    await expect(page.locator('#game-svg')).toBeVisible({ timeout: 10000 });
    
    // Check that scoreboard exists
    const scoreboard = page.locator('#game-scoreboard');
    await expect(scoreboard).toBeVisible();
  });

  test('tile placement flow works', async ({ page }) => {
    await page.goto(baseURL);
    
    // Setup solo game
    await page.fill('#player-name', 'PlacementTester');
    await page.selectOption('#player-count', '1');
    await page.click('#create-game-btn');
    await expect(page.locator('#room-code')).toBeVisible({ timeout: 5000 });
    await page.click('#start-game-btn');
    
    // Wait for game board and active tile
    await expect(page.locator('#game-svg')).toBeVisible({ timeout: 10000 });
    
    // The active tile should be visible in the top-right
    const activeTile = page.locator('g[visibility="null"] image.active-tile-image');
    
    // Click on a valid placement on the board (center area)
    const svg = page.locator('#game-svg');
    const boundingBox = await svg.boundingBox();
    if (boundingBox) {
      // Click center of board
      await svg.click({
        position: { 
          x: boundingBox.width / 2, 
          y: boundingBox.height / 2 
        }
      });
    }
    
    // "Place Tile" button should appear in HUD
    await expect(page.locator('#hud-confirm').first()).toBeVisible({ timeout: 5000 });
  });

  test('lobby background has semi-transparent overlay', async ({ page }) => {
    await page.goto(baseURL);
    
    // Get the content container
    const contentDiv = page.locator('#lobby-container > div').first();
    const bgColor = await contentDiv.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Should have rgba background (semi-transparent dark)
    expect(bgColor).toMatch(/rgba\(\s*26,\s*26,\s*46/);
  });

  test('no 404 errors on images', async ({ page, context }) => {
    const failedRequests = [];
    
    page.on('response', (response) => {
      if (response.status() === 404 && 
          (response.url().includes('/images/') || 
           response.url().includes('/sounds/'))) {
        failedRequests.push(response.url());
      }
    });
    
    await page.goto(baseURL);
    await page.fill('#player-name', 'ImageTester');
    await page.click('#create-game-btn');
    await expect(page.locator('#room-code')).toBeVisible({ timeout: 5000 });
    
    // Give time for all image requests
    await page.waitForTimeout(2000);
    
    expect(failedRequests).toEqual([]);
  });
});
