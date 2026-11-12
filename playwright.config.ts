import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173', locale: 'cs-CZ', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobil', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  // Testuje se produkční build, protože service worker v dev režimu neběží.
  webServer: { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
