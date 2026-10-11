import { defineConfig } from '@playwright/test';
export default defineConfig({
  outputDir: './test-results/local',
  testDir: './tests/browser', timeout: 30000, workers: 1, fullyParallel: false,
  use: { headless: true, launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}, trace: 'retain-on-failure' },
  webServer: { command: 'node --import tsx tests/browser-server.ts', url: process.env.SERVE_HOSTED ? 'http://127.0.0.1:3100' : 'http://127.0.0.1:3101', reuseExistingServer: false, timeout: 30000, gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 } },
});
