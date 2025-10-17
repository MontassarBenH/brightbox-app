// playwright.config.ts
import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const isLocal = baseURL.startsWith('http://localhost');

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: isLocal && !isCI
    ? {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
