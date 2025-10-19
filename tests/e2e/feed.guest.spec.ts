import { test, expect } from '@playwright/test';

test.use({ storageState: undefined });

test.describe('Feed (guest)', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/feed');

    await Promise.race([
      page.waitForURL('**/login*', { timeout: 15000 }),
      page.waitForSelector('form >> text=/sign in/i', { timeout: 15000 }),
    ]);

    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});
