import { test, expect } from '@playwright/test';

const TEST_USER_ID = process.env.E2E_TEST_USER_ID!;

// Run these with saved auth
test.use({ storageState: 'tests/e2e/.auth/storageState.json' });

test.describe('Profile (auth)', () => {
  test('shows profile content when logged in (happy-path smoke)', async ({ page }) => {
    await page.goto(`/profile/${TEST_USER_ID}`);
    await expect(page.getByRole('heading', { name: /^videos$/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /^posts$/i })).toBeVisible({ timeout: 10000 });
  });
});
