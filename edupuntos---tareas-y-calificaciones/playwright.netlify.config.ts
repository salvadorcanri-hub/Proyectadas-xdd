import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/netlify-browser', timeout: 30000, workers: 1,
  use: { headless: true, launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}, trace: 'retain-on-failure' },
  webServer: { command: 'node --import tsx tests/netlify-server.ts', url: 'http://127.0.0.1:3200', reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 } },
});
