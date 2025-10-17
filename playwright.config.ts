import { defineConfig } from '@playwright/test';

const isLive = process.env.PLAYWRIGHT_NO_SERVER === '1';

export default defineConfig({
  testDir: 'tests/e2e',

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  webServer: isLive
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
