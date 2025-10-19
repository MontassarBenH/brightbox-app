import { test, expect } from '@playwright/test';

const TEST_USER_ID = process.env.E2E_TEST_USER_ID!;

// Run these logged out
test.use({ storageState: undefined });

test.describe('Profile (guest)', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => localStorage.clear());

    await page.goto(`/profile/${TEST_USER_ID}`);

    await Promise.race([
      page.waitForURL('**/login*', { timeout: 15000 }),
      page.waitForSelector('form >> text=/sign in/i', { timeout: 15000 }),
    ]);

    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});
