import { defineConfig, devices } from '@playwright/test';

const isLive = process.env.PLAYWRIGHT_NO_SERVER === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts$/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/storageState.json' },
    dependencies: ['setup'],
    testMatch: [
      /.*\.auth\.spec\.ts$/,                // auth-only
      /.*(?<!\.guest|\.setup)\.spec\.ts$/,  // shared (*.spec.ts)
    ],
  },
  {
    name: 'chromium-guest',
    use: { ...devices['Desktop Chrome'], storageState: undefined },
    testMatch: [
      /.*\.guest\.spec\.ts$/,               // guest-only
      /.*(?<!\.auth|\.setup)\.spec\.ts$/,   // shared (*.spec.ts)
    ],
  },
],


  webServer: isLive
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
