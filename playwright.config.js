// playwright.config.js — E2E test configuration for Carcassonne SPA
//
// Uses Vite dev server as the web server. Tests run against the development
// build so there's no need to run `npm run build` before testing.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,          // Run tests serially (each is stateful)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                     // One worker to avoid port conflicts
  reporter: [['html', { outputFolder: 'playwright-report' }]],

  use: {
    baseURL: 'http://localhost:5173/carcassonne/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Start Vite dev server before tests.
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173/carcassonne/',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
