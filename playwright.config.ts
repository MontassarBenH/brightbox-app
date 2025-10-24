import { defineConfig, devices } from '@playwright/test';

const isLive = process.env.PLAYWRIGHT_NO_SERVER === '1';

// Reuse your shared test filters
  const AUTH_TESTS = [
    /.*\.auth\.spec\.ts$/,                     // auth-only tests
    /.*(?<!\.guest|\.setup|smoke)\.spec\.ts$/, // shared tests 
  ];

  const GUEST_TESTS = [
    /.*\.guest\.spec\.ts$/,                    // guest-only tests
    /.*smoke\.spec\.ts$/,                      // smoke tests 
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
      use: { 
        ...devices['Desktop Chrome'], 
        storageState: 'tests/e2e/.auth/storageState.json' 
      },
      dependencies: ['setup'],
      testMatch: AUTH_TESTS,
    },
    {
      name: 'chromium-desktop-guest',
      use: { ...devices['Desktop Chrome'], storageState: undefined },
      testMatch: GUEST_TESTS,
    },

    // ===== Mobile (Android-like) =====
    {
      name: 'chromium-mobile',
      use: { 
        ...devices['Pixel 7'], 
        storageState: 'tests/e2e/.auth/storageState.json' 
      },
      dependencies: ['setup'],
      testMatch: AUTH_TESTS,
    },
    {
      name: 'chromium-mobile-guest',
      use: { ...devices['Pixel 7'], storageState: undefined },
      testMatch: GUEST_TESTS,
    },

    // ===== Tablet (iPad-ish size) =====
    {
      name: 'chromium-tablet',
      use: { 
        ...devices['iPad (gen 7)'], 
        storageState: 'tests/e2e/.auth/storageState.json' 
      },
      dependencies: ['setup'],
      testMatch: AUTH_TESTS,
    },
    {
      name: 'chromium-tablet-guest',
      use: { ...devices['iPad (gen 7)'], storageState: undefined },
      testMatch: GUEST_TESTS,
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
