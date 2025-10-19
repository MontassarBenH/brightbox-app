import { defineConfig, devices } from '@playwright/test';

const isLive = process.env.PLAYWRIGHT_NO_SERVER === '1';

// Reuse your shared test filters
const AUTH_AND_SHARED = [
  /.*\.auth\.spec\.ts$/,                // auth-only
  /.*(?<!\.guest|\.setup)\.spec\.ts$/,  // shared (*.spec.ts)
];
const GUEST_AND_SHARED = [
  /.*\.guest\.spec\.ts$/,               // guest-only
  /.*(?<!\.auth|\.setup)\.spec\.ts$/,   // shared (*.spec.ts)
];

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    // runs once to create storageState
    { name: 'setup', testMatch: /.*\.setup\.ts$/ },

    // ===== Desktop (Chromium) =====
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/storageState.json' },
      dependencies: ['setup'],
      testMatch: AUTH_AND_SHARED,
    },
    {
      name: 'chromium-desktop-guest',
      use: { ...devices['Desktop Chrome'], storageState: undefined },
      testMatch: GUEST_AND_SHARED,
    },

    // ===== Mobile (Android-like) =====
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'], storageState: 'tests/e2e/.auth/storageState.json' },
      dependencies: ['setup'],
      testMatch: AUTH_AND_SHARED,
    },
    {
      name: 'chromium-mobile-guest',
      use: { ...devices['Pixel 7'], storageState: undefined },
      testMatch: GUEST_AND_SHARED,
    },

    // ===== Tablet (iPad-ish size; still Chromium engine in CI) =====
    {
      name: 'chromium-tablet',
      use: { ...devices['iPad (gen 7)'], storageState: 'tests/e2e/.auth/storageState.json' },
      dependencies: ['setup'],
      testMatch: AUTH_AND_SHARED,
    },
    {
      name: 'chromium-tablet-guest',
      use: { ...devices['iPad (gen 7)'], storageState: undefined },
      testMatch: GUEST_AND_SHARED,
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
